import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const doctorId = searchParams.get('doctor_id');
    const targetMonth = searchParams.get('target_month');
    const paidInMonth = searchParams.get('paid_in_month');

    let query = supabaseAdmin.from('doctor_ppf').select('*');

    if (doctorId) {
      query = query.eq('doctor_id', Number(doctorId));
    }

    if (targetMonth) {
      query = query.eq('target_month', targetMonth);
    }

    if (paidInMonth) {
      query = query.eq('paid_in_month', paidInMonth);
    }

    const { data, error } = await query.order('id', { ascending: false });

    if (error) {
      console.error('Error fetching doctor PPF:', error);
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    // If single record requested, return single object; otherwise return array
    if (doctorId && targetMonth && data && data.length > 0) {
      return NextResponse.json({ data: data[0] });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Doctor PPF API GET Error:', error);
    return NextResponse.json({ data: null, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      doctor_id,
      target_month,
      patient_count,
      nhi_points,
      reg_fee_deduction,
      clinic_days,
      transfer_amount,
      actual_base_pay,
      self_pay_items,
      extra_items,
      total_performance,
      base_salary_at_time,
      final_ppf_bonus,
      paid_in_month,
      status,
      net_pay,
      cash_amount,
      snapshot_actual_hours,
      snapshot_standard_hours,
      snapshot_hourly_rate,
      snapshot_guarantee,
      snapshot_license_fee,
      snapshot_mode,
      snapshot_roster,
    } = body;

    if (!doctor_id || !target_month) {
      return NextResponse.json({ error: 'Missing required fields: doctor_id, target_month' }, { status: 400 });
    }

    const payload: Record<string, unknown> = {
      doctor_id,
      target_month,
      patient_count: patient_count || 0,
      nhi_points: nhi_points || 0,
      reg_fee_deduction: reg_fee_deduction || 0,
      clinic_days: clinic_days || 0,
      transfer_amount: transfer_amount || 0,
      actual_base_pay: actual_base_pay || 0,
      self_pay_items: self_pay_items || [],
      extra_items: extra_items || [],
      total_performance: total_performance || 0,
      base_salary_at_time: base_salary_at_time || 0,
      final_ppf_bonus: final_ppf_bonus || 0,
      paid_in_month: paid_in_month || null,
      status: status || 'draft',
      net_pay: net_pay || 0,
      cash_amount: cash_amount || 0,
    };

    if (snapshot_actual_hours != null) payload.snapshot_actual_hours = snapshot_actual_hours;
    if (snapshot_standard_hours != null) payload.snapshot_standard_hours = snapshot_standard_hours;
    if (snapshot_hourly_rate != null) payload.snapshot_hourly_rate = snapshot_hourly_rate;
    if (snapshot_guarantee != null) payload.snapshot_guarantee = snapshot_guarantee;
    if (snapshot_license_fee != null) payload.snapshot_license_fee = snapshot_license_fee;
    if (snapshot_mode != null) payload.snapshot_mode = snapshot_mode;
    if (Array.isArray(snapshot_roster)) payload.snapshot_roster = snapshot_roster;

    const { data, error } = await supabaseAdmin
      .from('doctor_ppf')
      .upsert(payload as Record<string, never>, { onConflict: 'doctor_id,target_month' })
      .select()
      .single();

    if (error) {
      console.error('Error upserting doctor PPF:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Doctor PPF API POST Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
