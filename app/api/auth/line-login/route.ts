import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/auth/line-login
 * LINE LIFF 自動登入 API
 * 
 * Request Body:
 *   { lineUserId: string }
 * 
 * Response:
 *   { success: boolean, staff?: { id: number, name: string, role: string, clinic_id: string }, error?: string }
 * 
 * 功能：
 * 1. 查詢 staff 資料表中 line_user_id 等於此 ID 的員工
 * 2. 確認診所 ID (clinic_id)
 * 3. 建立 Session Cookie (包含 staff_id 和 clinic_id)
 * 4. 回傳員工資料
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId } = body;

    // 驗證必要參數
    if (!lineUserId) {
      return NextResponse.json(
        { success: false, error: '無 LINE ID' },
        { status: 400 }
      );
    }

    // 1. 查詢員工資料（包含 clinic_id）
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, clinic_id, is_active')
      .eq('line_user_id', lineUserId)
      .single();

    if (staffError || !staff) {
      console.error('[LINE Login] 找不到綁定的員工:', staffError);
      return NextResponse.json(
        { success: false, error: '此 LINE 帳號尚未綁定員工' },
        { status: 404 }
      );
    }

    // 檢查員工是否啟用
    if (!staff.is_active) {
      return NextResponse.json(
        { success: false, error: '該員工帳號已停用' },
        { status: 403 }
      );
    }

    // 驗證 clinic_id 是否存在
    if (!staff.clinic_id) {
      return NextResponse.json(
        { success: false, error: '員工未關聯到診所，請聯繫管理員' },
        { status: 400 }
      );
    }

    // 2. 建立 Response
    const response = NextResponse.json({
      success: true,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        clinic_id: staff.clinic_id
      }
    });

    // 3. 設定 Session Cookie
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

    console.log('[LINE Login] ✅ 登入成功:', {
      staff_id: staff.id,
      name: staff.name,
      clinic_id: staff.clinic_id
    });

    return response;
  } catch (error: any) {
    console.error('[LINE Login] Server Error:', error);
    return NextResponse.json(
      { success: false, error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
