import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/roster/staff
 * 查詢員工排班表
 * 
 * Query Parameters:
 *   - year: number (required)
 *   - month: number (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));

    if (!year || !month) {
      return NextResponse.json(
        { data: [], error: '缺少年份或月份參數' },
        { status: 400 }
      );
    }

    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonthDate = new Date(year, month, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabaseAdmin
      .from('roster')
      .select('*')
      .gte('date', start)
      .lt('date', nextMonth);

    if (error) {
      console.error('Fetch staff roster error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Staff roster API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/staff
 * 新增或更新員工排班
 * 
 * Request Body:
 *   {
 *     staff_id: number,
 *     date: string (YYYY-MM-DD),
 *     shifts: string[],
 *     day_type: 'normal' | 'rest' | 'regular',
 *     shift_details?: Record<string, { start: string, end: string }>
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      staff_id,
      date,
      shifts,
      day_type,
      shift_details
    } = body;

    if (!staff_id || !date) {
      return NextResponse.json(
        { success: false, message: '缺少必要欄位' },
        { status: 400 }
      );
    }

    // 計算當日整體的 Start/End
    let minStart: string | null = "23:59";
    let maxEnd: string | null = "00:00";

    if (shifts && shifts.length > 0 && shift_details) {
      Object.values(shift_details).forEach((d: any) => {
        if (d.start && d.start < minStart) minStart = d.start;
        if (d.end && d.end > maxEnd) maxEnd = d.end;
      });
    } else {
      minStart = null;
      maxEnd = null;
    }

    const payload: any = {
      staff_id: Number(staff_id),
      date,
      shifts: shifts || [],
      day_type: day_type || 'normal',
      shift_details: shift_details || {}
    };

    if (minStart && maxEnd) {
      payload.start_time = minStart;
      payload.end_time = maxEnd;
    }

    // 檢查是否已存在
    const { data: existing } = await supabaseAdmin
      .from('roster')
      .select('id')
      .eq('staff_id', staff_id)
      .eq('date', date)
      .single();

    let error;
    if (existing) {
      // 如果沒有班次且是正常日，刪除
      if ((!shifts || shifts.length === 0) && day_type === 'normal') {
        const { error: deleteError } = await supabaseAdmin
          .from('roster')
          .delete()
          .eq('id', existing.id);
        error = deleteError;
      } else {
        // 更新
        const { error: updateError } = await supabaseAdmin
          .from('roster')
          .update(payload)
          .eq('id', existing.id);
        error = updateError;
      }
    } else {
      // 新增（僅在有班次或非正常日時）
      if ((shifts && shifts.length > 0) || day_type !== 'normal') {
        const { error: insertError } = await supabaseAdmin
          .from('roster')
          .insert([payload]);
        error = insertError;
      }
    }

    if (error) {
      console.error('Save staff roster error:', error);
      return NextResponse.json(
        { success: false, message: `儲存失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '儲存成功'
    });
  } catch (error: any) {
    console.error('Staff roster POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
