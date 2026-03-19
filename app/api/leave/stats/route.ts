import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

export const dynamic = 'force-dynamic';

// 🟢 勞基法特休額度計算 (週年制 + 支援兼職比例)
function getLeaveQuota(yearsOfService: number, isHalfYear: boolean, staff: any): number {
  let baseQuota = 0;
  if (isHalfYear) baseQuota = 3;
  else if (yearsOfService < 1) baseQuota = 0;
  else if (yearsOfService < 2) baseQuota = 7;
  else if (yearsOfService < 3) baseQuota = 10;
  else if (yearsOfService < 5) baseQuota = 14;
  else if (yearsOfService < 10) baseQuota = 15;
  else {
    const extra = Math.floor(yearsOfService - 10) + 1;
    baseQuota = Math.min(30, 15 + extra);
  }

  // 🟢 兼職 (部分工時) 按比例換算
  if (staff?.employment_type === 'part_time') {
    const weeklyHours = Number(staff.part_time_weekly_hours) || 20; // 防呆預設 20
    return Number(((weeklyHours / 40) * baseQuota).toFixed(2));
  }

  return baseQuota;
}

// 輔助計算已休天數
function calculateUsed(requests: any[], start: Date, end: Date): number {
  let hours = 0;
  requests.forEach((req: any) => {
    if (!req.start_time) return;
    const d = new Date(req.start_time);
    if (isNaN(d.getTime())) return;
    if (d >= start && d <= end) hours += Number(req.hours || 0);
  });
  return hours / 8;
}

// 輔助計算已結算天數
function calculateSettled(settlements: any[], targetYear: number): number {
  let days = 0;
  settlements.forEach((s: any) => {
    if (s.target_year != null) {
       if (Number(s.target_year) === targetYear) days += Number(s.days || 0);
       return;
    }
    if (!s.target_year && s.notes && typeof s.notes === 'string') {
        if (s.notes.includes(`${targetYear}年`)) days += Number(s.days || 0);
    }
  });
  return days;
}

export async function GET(request: NextRequest) {
  try {
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. 抓取全院有效員工
    const { data: staffList } = await supabaseAdmin
      .from('staff')
      .select('id, name, start_date, is_active, base_salary, salary_mode, employment_type, part_time_weekly_hours') // 🟢 補上薪資欄位 + 勞基法兼職欄位
      .eq('clinic_id', clinicId)
      .eq('is_active', true);

    if (!staffList) return NextResponse.json({ data: [] });

    // 2. 抓取全院請假與結算紀錄
    const { data: allRequests } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('type', '特休')
      .eq('status', 'approved');

    const { data: allSettlements } = await supabaseAdmin
      .from('leave_settlements')
      .select('*')
      .eq('clinic_id', clinicId)
      // 🟢 修正：大表也只承認已核准的結算/遞延紀錄
      .or('status.eq.approved,status.is.null');

    const now = new Date();
    const stats = [];

    // 3. 對每位員工進行週年制精算，確保與個人存摺 100% 同步
    for (const staff of staffList) {
      let totalQuota = 0;
      let totalUsed = 0;
      let totalSettled = 0;
      let totalRemaining = 0;

      if (staff.start_date) {
        const hireDate = new Date(staff.start_date);
        const diffTime = Math.abs(now.getTime() - hireDate.getTime());
        const yearsOfService = diffTime / (1000 * 60 * 60 * 24 * 365.25);
        
        const staffRequests = (allRequests || []).filter(r => String(r.staff_id) === String(staff.id));
        const staffSettlements = (allSettlements || []).filter(s => String(s.staff_id) === String(staff.id));

        // 計算滿半年 (0.5年)
        const halfYearStart = new Date(hireDate);
        halfYearStart.setMonth(hireDate.getMonth() + 6);
        const halfYearEnd = new Date(hireDate);
        halfYearEnd.setFullYear(hireDate.getFullYear() + 1);
        halfYearEnd.setDate(halfYearEnd.getDate() - 1);

        if (now >= halfYearStart) {
          const quota = getLeaveQuota(0.5, true, staff);
          const used = calculateUsed(staffRequests, halfYearStart, halfYearEnd);
          const settled = calculateSettled(staffSettlements, 0);
          const balance = quota - used - settled;
          // 🟢 修正：只加總尚未過期的額度
          if (now <= halfYearEnd) {
             totalQuota += quota; totalUsed += used; totalSettled += settled; totalRemaining += balance;
          }
        }

        // 計算滿 N 年
        const maxYear = Math.floor(yearsOfService);
        for (let y = 1; y <= maxYear; y++) {
          const cycleStart = new Date(hireDate);
          cycleStart.setFullYear(hireDate.getFullYear() + y);
          const cycleEnd = new Date(cycleStart);
          cycleEnd.setFullYear(cycleStart.getFullYear() + 1);
          cycleEnd.setDate(cycleEnd.getDate() - 1);

          const quota = getLeaveQuota(y, false, staff);
          const used = calculateUsed(staffRequests, cycleStart, cycleEnd);
          const settled = calculateSettled(staffSettlements, y);
          const balance = quota - used - settled;

          // 🟢 修正：只加總尚未過期的額度
          if (now >= cycleStart && now <= cycleEnd) {
             totalQuota += quota; totalUsed += used; totalSettled += settled; totalRemaining += balance;
          }
        }
      }

      stats.push({
        staff_id: staff.id,
        staff_name: staff.name,
        start_date: staff.start_date,
        base_salary: staff.base_salary, // 🟢 補上底薪
        salary_mode: staff.salary_mode, // 🟢 補上計薪模式
        quota: totalQuota,
        used: totalUsed,
        settled: totalSettled,
        remaining: totalRemaining
      });
    }

    return NextResponse.json({ data: stats });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
