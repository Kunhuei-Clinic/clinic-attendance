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
      .from('salary_adjustments')
      .select('*')
      .eq('clinic_id', clinicId); // 只查詢該診所的薪資調整紀錄

    if (yearMonth) {
      query = query.eq('year_month', yearMonth);
    }

    if (staffId) {
      query = query.eq('staff_id', staffId);
    }

    const { data, error } = await query.order('id', { ascending: true });

    if (error) {
      console.error('Error fetching salary adjustments:', error);
      return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Salary Adjustments API GET Error:', error);
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
    const { staff_id, year_month, type, name, amount } = body;

    if (!staff_id || !year_month || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id')
      .eq('id', staff_id)
      .eq('clinic_id', clinicId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { error: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
    const { data, error } = await supabaseAdmin
      .from('salary_adjustments')
      .insert([{ 
        staff_id, 
        year_month, 
        type, 
        name: name || (type === 'bonus' ? '本月獎金' : '本月扣款'), 
        amount: amount || 0,
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating salary adjustment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Salary Adjustments API POST Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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
    const { id, field, value } = body;

    if (!id || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 🟢 多租戶：更新時也要驗證該紀錄屬於當前診所
    const { data, error } = await supabaseAdmin
      .from('salary_adjustments')
      .update({ [field]: value })
      .eq('id', id)
      .eq('clinic_id', clinicId) // 🟢 確保只更新該診所的紀錄
      .select()
      .single();

    if (error) {
      console.error('Error updating salary adjustment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: '找不到該紀錄或無權限操作' },
        { status: 403 }
      );
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Salary Adjustments API PATCH Error:', error);
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    // 🟢 多租戶：刪除時也要驗證該紀錄屬於當前診所
    const { error } = await supabaseAdmin
      .from('salary_adjustments')
      .delete()
        .eq('id', id)
      .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的紀錄

    if (error) {
      console.error('Error deleting salary adjustment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Salary Adjustments API DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
