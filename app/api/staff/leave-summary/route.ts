import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

export const dynamic = 'force-dynamic';

// 勞基法特休額度計算 (週年制)
function getLeaveQuota(yearsOfService: number, isHalfYear: boolean): number {
  if (isHalfYear) return 3; // 滿半年
  if (yearsOfService < 1) return 0;
  if (yearsOfService < 2) return 7;  // 滿1年
  if (yearsOfService < 3) return 10; // 滿2年
  if (yearsOfService < 5) return 14; // 滿3-4年
  if (yearsOfService < 10) return 15; // 滿5-9年
  
  // 10年以上: 16 + (N-10)，上限30
  const extra = Math.floor(yearsOfService - 10) + 1;
  return Math.min(30, 15 + extra);
}

// 🛡️ 安全的日期轉字串函式 (防呆)
function toDateString(d: Date): string {
  try {
    if (isNaN(d.getTime())) return ''; // 如果是無效日期，回傳空字串
    return d.toISOString().split('T')[0];
  } catch (e) {
    return '';
  }
}

export async function GET(request: NextRequest) {
  try {
    // 1. 權限與參數檢查
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) return NextResponse.json({ error: '無法識別診所' }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const staffIdParam = searchParams.get('staff_id');

    if (!staffIdParam || isNaN(Number(staffIdParam))) {
      return NextResponse.json({ error: '無效的 staff_id 參數' }, { status: 400 });
    }

    const staffId = Number(staffIdParam);

    // 2. 讀取員工基本資料
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, start_date')
      .eq('id', staffId)
      .eq('clinic_id', clinicId)
      .single();

    if (staffError || !staff) {
      console.error('Leave Summary: Staff not found', staffError);
      return NextResponse.json({ error: '找不到員工' }, { status: 404 });
    }

    // 若無到職日，直接回傳空列表，避免崩潰
    if (!staff.start_date) {
      return NextResponse.json({ staff, years: [] });
    }

    const startDate = new Date(staff.start_date);
    if (isNaN(startDate.getTime())) {
       return NextResponse.json({ error: '員工到職日格式錯誤' }, { status: 400 });
    }
    
    const today = new Date();

    // 3. 讀取「特休」請假紀錄
    const { data: leaveRequests } = await supabaseAdmin
      .from('leave_requests')
      .select('hours, start_time')
      .eq('clinic_id', clinicId)
      .eq('staff_id', staffId)
      .eq('type', '特休')
      .eq('status', 'approved');

    // 4. 讀取結算紀錄
    const { data: settlements } = await supabaseAdmin
      .from('leave_settlements')
      .select('days, pay_month, notes, created_at, target_year')
      .eq('clinic_id', clinicId)
      .eq('staff_id', staffId);

    const cycles: any[] = [];
    const allRequests = leaveRequests || [];
    const allSettlements = settlements || [];

    // ==========================================
    // 核心演算法：先處理滿半年 (0.5年)
    // ==========================================
    const halfYearDate = new Date(startDate);
    halfYearDate.setMonth(halfYearDate.getMonth() + 6);

    // 只有當「滿半年的日期」已經過去，或今天剛好滿半年，才產生這筆額度
    if (halfYearDate <= today) {
        const cycleStart = new Date(halfYearDate);
        const cycleEnd = new Date(startDate);
        cycleEnd.setFullYear(cycleEnd.getFullYear() + 1); 
        cycleEnd.setDate(cycleEnd.getDate() - 1);

        const used = calculateUsed(allRequests, cycleStart, cycleEnd);
        const settled = calculateSettled(allSettlements, cycleStart, cycleEnd, 0.5);
        const quota = 3; 

        cycles.push({
            year: 0.5,
            label: "滿半年特休",
            cycle_start: toDateString(cycleStart),
            cycle_end: toDateString(cycleEnd),
            quota,
            used,
            settled,
            balance: parseFloat((quota - used - settled).toFixed(2)),
            status: cycleEnd < today ? 'expired' : 'active'
        });
    }

    // ==========================================
    // 核心演算法：處理滿 N 年 (從 1 年開始)
    // ==========================================
    let currentYear = 1;
    while (true) {
        // 週期開始：到職日 + N 年
        const cycleStart = new Date(startDate);
        cycleStart.setFullYear(startDate.getFullYear() + currentYear);

        // 如果週期的開始日已經超過今天，就不算了 (不預算未來)
        if (cycleStart > today) break;

        // 週期結束：到職日 + N+1 年 的前一天
        const cycleEnd = new Date(startDate);
        cycleEnd.setFullYear(startDate.getFullYear() + currentYear + 1);
        cycleEnd.setDate(cycleEnd.getDate() - 1);

        const quota = getLeaveQuota(currentYear, false);
        const used = calculateUsed(allRequests, cycleStart, cycleEnd);
        const settled = calculateSettled(allSettlements, cycleStart, cycleEnd, currentYear);
        const balance = quota - used - settled;

        cycles.push({
            year: currentYear,
            label: `滿 ${currentYear} 年特休`,
            cycle_start: toDateString(cycleStart),
            cycle_end: toDateString(cycleEnd),
            quota,
            used,
            settled,
            balance: parseFloat(balance.toFixed(2)),
            status: cycleEnd < today ? 'expired' : 'active'
        });

        currentYear++;
        if (currentYear > 60) break; // 安全煞車，避免無窮迴圈
    }

    // 排序：最新的年份在上面
    cycles.sort((a, b) => new Date(b.cycle_start).getTime() - new Date(a.cycle_start).getTime());

    return NextResponse.json({
      staff: {
        staff_id: staff.id,
        staff_name: staff.name,
        role: staff.role ?? null,
        start_date: staff.start_date,
      },
      years: cycles,
    });

  } catch (error: any) {
    // 這裡會把錯誤印在 Vercel Logs，方便除錯
    console.error('API Error [leave-summary]:', error);
    return NextResponse.json({ error: `伺服器內部錯誤: ${error.message}` }, { status: 500 });
  }
}

// ---------------- Helper Functions ----------------

function calculateUsed(requests: any[], start: Date, end: Date): number {
  let hours = 0;
  requests.forEach((req: any) => {
    // 確保 start_time 有效
    if (!req.start_time) return;
    const d = new Date(req.start_time);
    if (isNaN(d.getTime())) return;

    if (d >= start && d <= end) {
      hours += Number(req.hours || 0);
    }
  });
  return hours / 8; 
}

function calculateSettled(settlements: any[], start: Date, end: Date, targetYear: number): number {
  let days = 0;
  settlements.forEach((s: any) => {
    // 1. 優先比對 target_year
    if (s.target_year != null) {
       if (Number(s.target_year) === targetYear) {
         days += Number(s.days || 0);
         return;
       }
    }
    
    // 2. 比對備註
    if (!s.target_year && s.notes && typeof s.notes === 'string') {
        if (s.notes.includes(`${targetYear}年`) || s.notes.includes(`滿${targetYear}年`)) {
            days += Number(s.days || 0);
            return;
        }
    }

    // 3. 最後手段：看結算單日期
    const dateStr = s.created_at || s.pay_month;
    if (!s.target_year && (!s.notes || !s.notes.match(/\d+年/)) && dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime()) && d >= start && d <= end) {
            days += Number(s.days || 0);
        }
    }
  });
  return days;
}