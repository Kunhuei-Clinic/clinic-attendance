import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/roster/closed-days
 * 查詢休診日
 * 
 * Query Parameters:
 *   - year: number (optional, 與 startDate/endDate 二選一)
 *   - month: number (optional, 與 startDate/endDate 二選一)
 *   - startDate: string (YYYY-MM-DD, optional, 日期範圍查詢起始)
 *   - endDate: string (YYYY-MM-DD, optional, 日期範圍查詢結束)
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
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // 🟢 多租戶：強制加上 clinic_id 過濾
    // ⚠️ 注意：如果 clinic_closed_days 表還沒有 clinic_id 欄位，需要先執行 migration
    let query = supabaseAdmin
      .from('clinic_closed_days')
      .select('date')
      .eq('clinic_id', clinicId); // 只查詢該診所的休診日

    // 支援日期範圍查詢
    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    }
    // 支援月份查詢（原有功能）
    else if (year && month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonthDate = new Date(Number(year), Number(month), 1);
      const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
      query = query.gte('date', start).lt('date', nextMonth);
    } else {
      return NextResponse.json(
        { data: [], error: '缺少必要參數（year/month 或 startDate/endDate）' },
        { status: 400 }
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch closed days error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: (data || []).map(d => d.date)
    });
  } catch (error: any) {
    console.error('Closed days API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/closed-days
 * 新增休診日
 * 
 * Request Body:
 *   { date: string (YYYY-MM-DD), reason?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { date, reason } = body;

    if (!date) {
      return NextResponse.json(
        { success: false, message: '缺少日期參數' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
    // ⚠️ 注意：如果 clinic_closed_days 表還沒有 clinic_id 欄位，需要先執行 migration
    const { error } = await supabaseAdmin
      .from('clinic_closed_days')
      .insert({ 
        date, 
        reason: reason || '休診',
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      });

    if (error) {
      console.error('Add closed day error:', error);
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
    console.error('Closed days POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roster/closed-days
 * 刪除休診日
 * 
 * Query Parameters:
 *   - date: string (YYYY-MM-DD, required)
 */
export async function DELETE(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { success: false, message: '缺少日期參數' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：刪除時也要驗證該紀錄屬於當前診所
    // ⚠️ 注意：如果 clinic_closed_days 表還沒有 clinic_id 欄位，需要先執行 migration
    const { error } = await supabaseAdmin
      .from('clinic_closed_days')
      .delete()
      .eq('date', date)
      .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的休診日

    if (error) {
      console.error('Delete closed day error:', error);
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
    console.error('Closed days DELETE API Error:', error);
    return NextResponse.json(
      { success: false, message: `刪除失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
