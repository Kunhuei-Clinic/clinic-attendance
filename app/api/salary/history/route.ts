import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const yearMonth = searchParams.get('year_month');
    const staffId = searchParams.get('staff_id');

    let query = supabaseAdmin.from('salary_history').select('*');

    if (yearMonth) {
      query = query.eq('year_month', yearMonth);
    }

    if (staffId) {
      query = query.eq('staff_id', Number(staffId));
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
    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid records array' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('salary_history')
      .insert(records)
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
    const searchParams = request.nextUrl.searchParams;
    const yearMonth = searchParams.get('year_month');

    if (!yearMonth) {
      return NextResponse.json({ error: 'Missing year_month parameter' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('salary_history').delete().eq('year_month', yearMonth);

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
