import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/portal/auth
 * 檢查員工 LINE 綁定狀態
 * 
 * Query Parameters:
 *   - lineUserId: string (LINE User ID)
 * 
 * Response:
 *   - 已綁定: { status: 'bound', staff: { ...完整資料包含 clinic_id... } }
 *   - 未綁定: { status: 'unbound', unboundList: [{ id, name, clinic_id }] }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lineUserId = searchParams.get('lineUserId');

    if (!lineUserId) {
      return NextResponse.json(
        { status: 'error', message: '缺少 lineUserId 參數' },
        { status: 400 }
      );
    }

    // 查詢已綁定的員工
    const { data: boundStaff, error: boundError } = await supabaseAdmin
      .from('staff')
      .select('*')
      .eq('line_user_id', lineUserId)
      .single();

    if (boundError && boundError.code !== 'PGRST116') {
      // PGRST116 是 "not found" 錯誤，這是正常的
      console.error('Error checking bound staff:', boundError);
      return NextResponse.json(
        { status: 'error', message: '查詢失敗' },
        { status: 500 }
      );
    }

    // 如果找到已綁定的員工，回傳完整資料
    if (boundStaff) {
      return NextResponse.json({
        status: 'bound',
        staff: boundStaff
      });
    }

    // 如果沒找到，查詢所有未綁定且啟用中的員工列表
    const { data: unboundList, error: unboundError } = await supabaseAdmin
      .from('staff')
      .select('id, name, clinic_id')
      .is('line_user_id', null)
      .eq('is_active', true)
      .order('name');

    if (unboundError) {
      console.error('Error fetching unbound staff:', unboundError);
      return NextResponse.json(
        { status: 'error', message: '查詢未綁定員工失敗' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'unbound',
      unboundList: unboundList || []
    });
  } catch (error: any) {
    console.error('Portal Auth GET API Error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/auth
 * 執行員工 LINE 綁定
 * 
 * Request Body:
 *   { staffId: number, password: string, lineUserId: string }
 * 
 * Response:
 *   { success: boolean, message?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, password, lineUserId } = body;

    // 驗證必要參數
    if (!staffId || !password || !lineUserId) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數：staffId, password, lineUserId' },
        { status: 400 }
      );
    }

    // 查詢員工資料並驗證密碼
    const { data: staff, error: fetchError } = await supabaseAdmin
      .from('staff')
      .select('id, name, password, line_user_id, is_active')
      .eq('id', staffId)
      .single();

    if (fetchError || !staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工' },
        { status: 404 }
      );
    }

    // 檢查員工是否已啟用
    if (!staff.is_active) {
      return NextResponse.json(
        { success: false, message: '該員工帳號已停用' },
        { status: 403 }
      );
    }

    // 檢查是否已經綁定
    if (staff.line_user_id) {
      return NextResponse.json(
        { success: false, message: '該員工已經綁定其他 LINE 帳號' },
        { status: 409 }
      );
    }

    // 驗證密碼（預設密碼為 '0000'）
    const dbPassword = staff.password || '0000';
    if (dbPassword !== password) {
      return NextResponse.json(
        { success: false, message: '密碼錯誤' },
        { status: 401 }
      );
    }

    // 執行綁定：更新 line_user_id
    const { error: updateError } = await supabaseAdmin
      .from('staff')
      .update({ line_user_id: lineUserId })
      .eq('id', staffId);

    if (updateError) {
      console.error('Error binding LINE user:', updateError);
      return NextResponse.json(
        { success: false, message: `綁定失敗: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '綁定成功'
    });
  } catch (error: any) {
    console.error('Portal Auth POST API Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
