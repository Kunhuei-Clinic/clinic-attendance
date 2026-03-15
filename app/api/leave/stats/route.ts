import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

export const dynamic = 'force-dynamic';

// 勞基法特休額度計算 (週年制)
function getLeaveQuota(yearsOfService: number, isHalfYear: boolean): number {
  if (isHalfYear) return 3;
  if (yearsOfService < 1) return 0;
  if (yearsOfService < 2) return 7;
  if (yearsOfService < 3) return 10;
  if (yearsOfService < 5) return 14;
  if (yearsOfService < 10) return 15;
  const extra = Math.floor(yearsOfService - 10) + 1;
  return Math.min(30, 15 + extra);
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
      .select('id, name, start_date, is_active')
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
      .eq('clinic_id', clinicId);

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
          const quota = getLeaveQuota(0.5, true);
          const used = calculateUsed(staffRequests, halfYearStart, halfYearEnd);
          const settled = calculateSettled(staffSettlements, 0);
          const balance = quota - used - settled;
          if (now <= halfYearEnd || balance > 0) { // 還在週期內，或是過期但還有餘額
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

          const quota = getLeaveQuota(y, false);
          const used = calculateUsed(staffRequests, cycleStart, cycleEnd);
          const settled = calculateSettled(staffSettlements, y);
          const balance = quota - used - settled;

          if ((now >= cycleStart && now <= cycleEnd) || balance > 0) {
             totalQuota += quota; totalUsed += used; totalSettled += settled; totalRemaining += balance;
          }
        }
      }

      stats.push({
        staff_id: staff.id,
        staff_name: staff.name,
        start_date: staff.start_date,
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
