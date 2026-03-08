import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireOwnerAuth, authErrorToResponse, UnauthorizedError, ForbiddenError } from '@/lib/authHelper';

/**
 * GET /api/roster/holidays
 * 查詢國定假日（僅 owner）
 * 
 * Query Parameters:
 *   - year: number (required)
 *   - month: number (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { clinicId } = await requireOwnerAuth(request);

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
    // ⚠️ 注意：如果 clinic_holidays 表還沒有 clinic_id 欄位，需要先執行 migration
    const { data, error } = await supabaseAdmin
      .from('clinic_holidays')
      .select('date')
      .eq('clinic_id', clinicId) // 只查詢該診所的國定假日
      .gte('date', start)
      .lt('date', nextMonth);

    if (error) {
      console.error('Fetch holidays error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: (data || []).map(h => h.date)
    });
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      const { status, message } = authErrorToResponse(error);
      return NextResponse.json({ data: [], error: message }, { status });
    }
    console.error('Holidays API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/holidays
 * 新增國定假日
 * 
 * Request Body:
 *   { date: string (YYYY-MM-DD), name?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { clinicId } = await requireOwnerAuth(request);

    const body = await request.json();
    const { date, name } = body;

    if (!date) {
      return NextResponse.json(
        { success: false, message: '缺少日期參數' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
    // ⚠️ 注意：如果 clinic_holidays 表還沒有 clinic_id 欄位，需要先執行 migration
    const { error } = await supabaseAdmin
      .from('clinic_holidays')
      .insert([{ 
        date, 
        name: name || '國定假日',
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      }]);

    if (error) {
      console.error('Add holiday error:', error);
      return NextResponse.json(
        { success: false, message: `新增失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '新增成功'
    });
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      const { status, message } = authErrorToResponse(error);
      return NextResponse.json({ success: false, message }, { status });
    }
    console.error('Holidays POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roster/holidays
 * 刪除國定假日
 * 
 * Query Parameters:
 *   - date: string (YYYY-MM-DD, required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { clinicId } = await requireOwnerAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { success: false, message: '缺少日期參數' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：刪除時也要驗證該紀錄屬於當前診所
    // ⚠️ 注意：如果 clinic_holidays 表還沒有 clinic_id 欄位，需要先執行 migration
    const { error } = await supabaseAdmin
      .from('clinic_holidays')
      .delete()
      .eq('date', date)
      .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的國定假日

    if (error) {
      console.error('Delete holiday error:', error);
      return NextResponse.json(
        { success: false, message: `刪除失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '刪除成功'
    });
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      const { status, message } = authErrorToResponse(error);
      return NextResponse.json({ success: false, message }, { status });
    }
    console.error('Holidays DELETE API Error:', error);
    return NextResponse.json(
      { success: false, message: `刪除失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
