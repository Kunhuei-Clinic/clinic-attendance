import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/auth/line-bind
 * 執行 LINE 帳號綁定（多診所 SaaS 支援）
 * 
 * Request Body:
 *   { lineUserId: string, phone: string, password: string, clinicId: string }
 * 
 * Response:
 *   { success: boolean, staff?: { id, name, role, clinic_id, ... }, error?: string }
 * 
 * 功能：
 * 1. 查詢 staff 表格：
 *    - phone === phone
 *    - clinic_id === clinicId (🔒 關鍵：確保沒跑錯診所)
 *    - password === password
 * 2. 更新：將 line_user_id 更新為 lineUserId
 * 3. Session：綁定成功後直接建立 Cookie (含 staff_id, clinic_id)
 * 4. 回傳：成功或錯誤訊息 (401/404)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, phone, password, clinicId } = body;

    // 驗證必要參數
    if (!lineUserId || !phone || !password || !clinicId) {
      return NextResponse.json(
        { success: false, error: '缺少必要參數：lineUserId, phone, password, clinicId' },
        { status: 400 }
      );
    }

    // 1. 查詢員工資料（使用 phone 和 clinicId 查詢）
    const { data: staff, error: fetchError } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, password, line_user_id, clinic_id, is_active, phone')
      .eq('phone', phone)
      .eq('clinic_id', clinicId) // 🔒 關鍵：確保沒跑錯診所
      .eq('is_active', true)
      .single();

    // 比對：若找不到人 -> 回傳 404
    if (fetchError || !staff) {
      console.error('[LINE Bind] 找不到員工:', fetchError);
      return NextResponse.json(
        { success: false, error: '找不到員工資料' },
        { status: 404 }
      );
    }

    // 檢查員工是否已啟用
    if (!staff.is_active) {
      return NextResponse.json(
        { success: false, error: '該員工帳號已停用' },
        { status: 403 }
      );
    }

    // 比對：驗證密碼（預設密碼為 '0000'）
    const dbPassword = staff.password || '0000';
    if (dbPassword !== password) {
      console.error('[LINE Bind] 密碼錯誤:', { phone, clinicId });
      return NextResponse.json(
        { success: false, error: '密碼錯誤' },
        { status: 401 }
      );
    }

    // 檢查是否已經綁定其他 LINE 帳號
    if (staff.line_user_id && staff.line_user_id !== lineUserId) {
      return NextResponse.json(
        { success: false, error: '此帳號已被其他 LINE 綁定' },
        { status: 409 }
      );
    }

    // 2. 更新：將 line_user_id 更新為 lineUserId
    const { error: updateError } = await supabaseAdmin
      .from('staff')
      .update({ line_user_id: lineUserId })
      .eq('id', staff.id)
      .eq('clinic_id', clinicId); // 🔒 確保只更新該診所的員工

    if (updateError) {
      console.error('[LINE Bind] 更新 line_user_id 失敗:', updateError);
      return NextResponse.json(
        { success: false, error: `綁定失敗: ${updateError.message}` },
        { status: 500 }
      );
    }

    // 驗證 clinic_id 是否存在
    if (!staff.clinic_id) {
      return NextResponse.json(
        { success: false, error: '員工未關聯到診所，請聯繫管理員' },
        { status: 400 }
      );
    }

    // 3. 建立 Response
    const response = NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        clinic_id: staff.clinic_id,
        phone: staff.phone
      }
    });

    // 4. Session：綁定成功後直接建立 Cookie (含 staff_id, clinic_id)
    // 設定 staff_id cookie（用於識別當前登入的員工）
    response.cookies.set('staff_id', staff.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 天
      sameSite: 'lax'
    });

    // 設定 clinic_id cookie（用於多租戶識別）
    response.cookies.set('clinic_id', staff.clinic_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 天
      sameSite: 'lax'
    });

    console.log('[LINE Bind] ✅ 綁定成功:', {
      staff_id: staff.id,
      name: staff.name,
      role: staff.role,
      clinic_id: staff.clinic_id,
      lineUserId
    });

    return response;
  } catch (error: any) {
    console.error('[LINE Bind] Server Error:', error);
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
