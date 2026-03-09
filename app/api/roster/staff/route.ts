import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';
import { requireManagerOrOwnerAuth, authErrorToResponse, UnauthorizedError, ForbiddenError } from '@/lib/authHelper';

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
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { data: [], error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

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

    // 🟢 多租戶：強制加上 clinic_id 過濾
    const { data, error } = await supabaseAdmin
      .from('roster')
      .select('*')
      .eq('clinic_id', clinicId) // 只查詢該診所的班表
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
    // 🟢 僅允許負責人或排班主管操作班表
    const { clinicId } = await requireManagerOrOwnerAuth(request);

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

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id')
      .eq('id', staff_id)
      .eq('clinic_id', clinicId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
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

    // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
    const payload: any = {
      staff_id: staff_id,
      date,
      shifts: shifts || [],
      day_type: day_type || 'normal',
      shift_details: shift_details || {},
      clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
    };

    if (minStart && maxEnd) {
      payload.start_time = minStart;
      payload.end_time = maxEnd;
    }

    // 檢查是否已存在（加上 clinic_id 驗證）
    const { data: existing } = await supabaseAdmin
      .from('roster')
      .select('id')
      .eq('staff_id', staff_id)
      .eq('date', date)
      .eq('clinic_id', clinicId) // 🟢 確保只查詢該診所的班表
      .single();

    let error;
    if (existing) {
      // 如果沒有班次且是正常日，刪除
      if ((!shifts || shifts.length === 0) && day_type === 'normal') {
        const { error: deleteError } = await supabaseAdmin
          .from('roster')
          .delete()
          .eq('id', existing.id)
          .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的班表
        error = deleteError;
      } else {
        // 更新
        const { error: updateError } = await supabaseAdmin
          .from('roster')
          .update(payload)
          .eq('id', existing.id)
          .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的班表
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
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      const { status, message } = authErrorToResponse(error);
      return NextResponse.json({ success: false, message }, { status });
    }
    console.error('Staff roster POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
