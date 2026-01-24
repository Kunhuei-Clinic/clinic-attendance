import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

export async function GET(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month'); // Format: yyyy-MM

    if (!month) {
      return NextResponse.json({ error: 'Missing month parameter' }, { status: 400 });
    }

    const startDate = `${month}-01T00:00:00`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    // 1. 撈取考勤 Log（加上 clinic_id 過濾）
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('attendance_logs')
      .select('*')
      .eq('clinic_id', clinicId) // 🟢 只查詢該診所的考勤紀錄
      .gte('clock_in_time', startDate)
      .lt('clock_in_time', nextMonth);

    if (logsError) {
      console.error('Error fetching attendance logs:', logsError);
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    // 2. 撈取班表（加上 clinic_id 過濾）
    const { data: rosterData, error: rosterError } = await supabaseAdmin
      .from('roster')
      .select('*')
      .eq('clinic_id', clinicId) // 🟢 只查詢該診所的班表
      .gte('date', startDate)
      .lt('date', nextMonth);

    if (rosterError) {
      console.error('Error fetching roster:', rosterError);
      return NextResponse.json({ error: rosterError.message }, { status: 500 });
    }

    // 3. 撈取假日表（加上 clinic_id 過濾）
    const { data: holidayData, error: holidayError } = await supabaseAdmin
      .from('clinic_holidays')
      .select('date')
      .eq('clinic_id', clinicId) // 🟢 只查詢該診所的國定假日
      .gte('date', startDate)
      .lt('date', nextMonth);

    if (holidayError) {
      console.error('Error fetching holidays:', holidayError);
      return NextResponse.json({ error: holidayError.message }, { status: 500 });
    }

    // 4. 撈取請假單（加上 clinic_id 過濾）
    const { data: leaveData, error: leaveError } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('status', 'approved')
      .eq('clinic_id', clinicId) // 🟢 只查詢該診所的請假紀錄
      .gte('start_time', startDate)
      .lt('start_time', nextMonth);

    if (leaveError) {
      console.error('Error fetching leave requests:', leaveError);
      return NextResponse.json({ error: leaveError.message }, { status: 500 });
    }

    // 計算月標準工時
    const daysInMonth = new Date(y, m, 0).getDate();
    let standardWorkDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(y, m - 1, d).getDay();
      if (day !== 0 && day !== 6) standardWorkDays++;
    }
    const monthlyStandardHours = standardWorkDays * 8;

    return NextResponse.json({
      logs: logs || [],
      roster: rosterData || [],
      holidays: holidayData || [],
      leaves: leaveData || [],
      monthlyStandardHours,
    });
  } catch (error: any) {
    console.error('Salary Calculate API GET Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
