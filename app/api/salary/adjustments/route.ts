import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearMonth = searchParams.get('year_month');
    const staffId = searchParams.get('staff_id');

    let query = supabaseAdmin.from('salary_adjustments').select('*');

    if (yearMonth) {
      query = query.eq('year_month', yearMonth);
    }

    if (staffId) {
      query = query.eq('staff_id', Number(staffId));
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
    const body = await request.json();
    const { staff_id, year_month, type, name, amount } = body;

    if (!staff_id || !year_month || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('salary_adjustments')
      .insert([{ staff_id, year_month, type, name: name || (type === 'bonus' ? '本月獎金' : '本月扣款'), amount: amount || 0 }])
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
    const body = await request.json();
    const { id, field, value } = body;

    if (!id || !field) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('salary_adjustments')
      .update({ [field]: value })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating salary adjustment:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Salary Adjustments API PATCH Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('salary_adjustments').delete().eq('id', Number(id));

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
