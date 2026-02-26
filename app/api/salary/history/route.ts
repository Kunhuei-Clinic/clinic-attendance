import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

export async function GET(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { data: [], error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const yearMonth = searchParams.get('year_month');
    const staffId = searchParams.get('staff_id');

    // 🟢 多租戶：強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('salary_history')
      .select('*')
      .eq('clinic_id', clinicId); // 只查詢該診所的薪資歷史

    if (yearMonth) {
      query = query.eq('year_month', yearMonth);
    }

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    const { data, error } = await query.order('id', { ascending: true });

    if (error) {
      console.error('Error fetching salary history:', error);
      return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Salary History API GET Error:', error);
    return NextResponse.json({ data: [], error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid records array' }, { status: 400 });
    }

    // 🟢 多租戶：為每筆記錄自動填入 clinic_id（不讓前端傳入）
    const recordsWithClinicId = records.map((record: any) => {
      const { clinic_id, ...rest } = record;
      return {
        ...rest,
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      };
    });

    const { data, error } = await supabaseAdmin
      .from('salary_history')
      .insert(recordsWithClinicId)
      .select();

    if (error) {
      console.error('Error creating salary history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Salary History API POST Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
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
    const yearMonth = searchParams.get('year_month');

    if (!yearMonth) {
      return NextResponse.json({ error: 'Missing year_month parameter' }, { status: 400 });
    }

    // 🟢 多租戶：刪除時也要加上 clinic_id 過濾
    const { error } = await supabaseAdmin
      .from('salary_history')
      .delete()
      .eq('year_month', yearMonth)
      .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的紀錄

    if (error) {
      console.error('Error deleting salary history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Salary History API DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
