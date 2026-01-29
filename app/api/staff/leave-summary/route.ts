import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

// 勞基法特休額度（週年制）計算：依總年資決定該年度額度
// 規則：
// - 滿 0.5 年: 3天
// - 滿 1 年: 7天
// - 滿 2 年: 10天
// - 滿 3-4 年: 14天
// - 滿 5-9 年: 15天
// - 10 年以上: 16 + (N - 10) 天，N 為已滿年數，上限 30 天
function calculateAnnualQuotaBySeniority(startDate: Date, referenceDate: Date): number {
  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  const years = (referenceDate.getTime() - startDate.getTime()) / msPerYear;

  if (years < 0.5) return 0; // 未滿半年
  if (years < 1) return 3; // 滿半年未滿一年
  if (years < 2) return 7; // 滿一年未滿二年
  if (years < 3) return 10; // 滿二年未滿三年
  if (years < 5) return 14; // 滿三年未滿五年
  if (years < 10) return 15; // 滿五年未滿十年

  // 10 年以上：依已滿年數計算 16 + (N - 10)，上限 30 天
  const fullYears = Math.floor(years);
  const quota = 16 + (fullYears - 10);
  return Math.min(quota, 30);
}

// 將 Date 轉成 YYYY-MM-DD（台灣時區不嚴格要求，使用 ISO 切割即可）
function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  try {
    // 多租戶：取得診所 ID
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { error: '無法識別診所，請重新登入' },
        { status: 401 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const staffIdParam = searchParams.get('staff_id');

    if (!staffIdParam) {
      return NextResponse.json(
        { error: '缺少 staff_id 參數' },
        { status: 400 },
      );
    }

    const staffId = Number(staffIdParam);
    if (!Number.isFinite(staffId)) {
      return NextResponse.json(
        { error: '無效的 staff_id' },
        { status: 400 },
      );
    }

    // 1. 讀取員工基本資料（含 start_date）
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, start_date')
      .eq('id', staffId)
      .eq('clinic_id', clinicId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { error: '找不到員工或無權限查詢' },
        { status: 404 },
      );
    }

    if (!staff.start_date) {
      // 沒有到職日則無法計算特休
      return NextResponse.json({
        staff,
        years: [],
      });
    }

    const startDate = new Date(staff.start_date);
    const today = new Date();

    // 2. 讀取該員工所有核准的「特休」請假紀錄
    const { data: leaveRequests, error: leaveError } = await supabaseAdmin
      .from('leave_requests')
      .select('hours, start_time')
      .eq('clinic_id', clinicId)
      .eq('staff_id', staffId)
      .eq('type', '特休')
      .eq('status', 'approved');

    if (leaveError) {
      console.error('leave-summary: fetch leave_requests error', leaveError);
      return NextResponse.json(
        { error: `讀取特休請假紀錄失敗: ${leaveError.message}` },
        { status: 500 },
      );
    }

    // 3. 讀取該員工所有特休結算紀錄
    const { data: settlements, error: settleError } = await supabaseAdmin
      .from('leave_settlements')
      .select('days, pay_month, status, notes, created_at, target_year')
      .eq('clinic_id', clinicId)
      .eq('staff_id', staffId);

    if (settleError) {
      console.error('leave-summary: fetch leave_settlements error', settleError);
      return NextResponse.json(
        { error: `讀取特休結算紀錄失敗: ${settleError.message}` },
        { status: 500 },
      );
    }

    // 4. 以週年制計算每一個特休週期
    const cycles: any[] = [];
    let cycleIndex = 0;
    const msPerYear = 1000 * 60 * 60 * 24 * 365.25;

    while (true) {
      const cycleStart = new Date(startDate);
      cycleStart.setFullYear(startDate.getFullYear() + cycleIndex);

      // 若該週期起始時間已超過今天，停止迴圈
      if (cycleStart > today) break;

      const nextCycleStart = new Date(cycleStart);
      nextCycleStart.setFullYear(cycleStart.getFullYear() + 1);

      // 週期結束日 = 下個週期前一天
      const cycleEnd = new Date(nextCycleStart);
      cycleEnd.setDate(cycleEnd.getDate() - 1);

      // 週期對應的「服務年資」：取 cycleStart 時點
      const quota = calculateAnnualQuotaBySeniority(startDate, cycleStart);

      // 已使用：統計該週期內的特休請假總時數 / 8
      let usedHours = 0;
      (leaveRequests || []).forEach((req: any) => {
        if (!req.start_time) return;
        const leaveDate = new Date(req.start_time);
        if (leaveDate >= cycleStart && leaveDate <= cycleEnd) {
          usedHours += Number(req.hours || 0);
        }
      });
      const usedDays = Math.round((usedHours / 8) * 100) / 100;

      // 已結算：優先使用 target_year 或備註，其次才依結算日期落在週期內來判斷
      const cycleYear = cycleStart.getFullYear();
      let settledDays = 0;
      (settlements || []).forEach((s: any) => {
        let matchedCycle = false;

        // 1) 明確標記的 target_year 欄位
        if (s.target_year != null) {
          const ty = Number(s.target_year);
          if (!Number.isNaN(ty) && ty === cycleYear) {
            matchedCycle = true;
          }
        }

        // 2) 從備註中解析年度（例如「2024年度特休結算」）
        if (!matchedCycle && typeof s.notes === 'string' && s.notes) {
          const match = s.notes.match(/(\d{4})\s*年度/);
          if (match) {
            const ny = Number(match[1]);
            if (!Number.isNaN(ny) && ny === cycleYear) {
              matchedCycle = true;
            }
          }
        }

        // 3) 若無明確標記，則看結算日期是否落在該週期內
        if (!matchedCycle) {
          let settleDate: Date | null = null;
          if (s.created_at) {
            const d = new Date(s.created_at);
            if (!Number.isNaN(d.getTime())) settleDate = d;
          } else if (s.pay_month) {
            const d = new Date(`${s.pay_month}-01T00:00:00`);
            if (!Number.isNaN(d.getTime())) settleDate = d;
          }

          if (settleDate && settleDate >= cycleStart && settleDate <= cycleEnd) {
            matchedCycle = true;
          }
        }

        if (matchedCycle) {
          settledDays += Number(s.days || 0);
        }
      });
      settledDays = Math.round(settledDays * 100) / 100;

      const balance = Math.max(0, Math.round((quota - usedDays - settledDays) * 100) / 100);

      cycles.push({
        year: cycleYear,
        cycle_start: toDateString(cycleStart),
        cycle_end: toDateString(cycleEnd),
        quota,
        used: usedDays,
        settled: settledDays,
        balance,
        status: cycleEnd < today ? 'expired' : 'active',
      });

      cycleIndex += 1;

      // 安全保險：避免理論上無窮迴圈，若超過 60 年資就中斷
      if (cycleIndex > 60) break;
    }

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
    console.error('leave-summary API Error:', error);
    return NextResponse.json(
      { error: error.message || '伺服器錯誤' },
      { status: 500 },
    );
  }
}

