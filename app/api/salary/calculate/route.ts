import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month'); // Format: yyyy-MM

    if (!month) {
      return NextResponse.json({ error: 'Missing month parameter' }, { status: 400 });
    }

    const startDate = `${month}-01T00:00:00`;
    const [y, m] = month.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();

    // 1. 撈取考勤 Log
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('attendance_logs')
      .select('*')
      .gte('clock_in_time', startDate)
      .lt('clock_in_time', nextMonth);

    if (logsError) {
      console.error('Error fetching attendance logs:', logsError);
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    // 2. 撈取班表 (包含 shift_details JSONB)
    const { data: rosterData, error: rosterError } = await supabaseAdmin
      .from('roster')
      .select('*')
      .gte('date', startDate)
      .lt('date', nextMonth);

    if (rosterError) {
      console.error('Error fetching roster:', rosterError);
      return NextResponse.json({ error: rosterError.message }, { status: 500 });
    }

    // 3. 撈取假日表
    const { data: holidayData, error: holidayError } = await supabaseAdmin
      .from('clinic_holidays')
      .select('date')
      .gte('date', startDate)
      .lt('date', nextMonth);

    if (holidayError) {
      console.error('Error fetching holidays:', holidayError);
      return NextResponse.json({ error: holidayError.message }, { status: 500 });
    }

    // 4. 撈取請假單
    const { data: leaveData, error: leaveError } = await supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('status', 'approved')
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
