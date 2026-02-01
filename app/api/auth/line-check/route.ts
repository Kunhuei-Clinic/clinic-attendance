import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/auth/line-check
 * 檢查 LINE 帳號是否已綁定員工（多診所支援）
 * 
 * Request Body:
 *   { lineUserId: string, clinicId?: string }
 *   - lineUserId: 必填，LINE User ID
 *   - clinicId: 可選，診所 ID（目前假設一人一診所，直接查 lineUserId 即可）
 * 
 * Response:
 *   - 已綁定: { bound: true, staff: { id, name, role, clinic_id, ... } }
 *   - 未綁定: { bound: false }
 * 
 * 功能：
 * 1. 查詢 staff 表格，條件 line_user_id === lineUserId
 * 2. 若找到：建立 Session Cookie (包含 staff_id, clinic_id, role)，回傳員工資料
 * 3. 若沒找到：回傳 { bound: false } (前端將顯示綁定表單)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, clinicId } = body;

    // 驗證必要參數
    if (!lineUserId) {
      return NextResponse.json(
        { bound: false, error: '無 LINE ID' },
        { status: 400 }
      );
    }

    // 1. 查詢員工資料（包含 clinic_id, role）
    let query = supabaseAdmin
      .from('staff')
      .select('id, name, role, clinic_id, is_active, phone')
      .eq('line_user_id', lineUserId);

    // 如果提供了 clinicId，加上診所過濾（未來擴展用）
    if (clinicId) {
      query = query.eq('clinic_id', clinicId);
    }

    const { data: staff, error: staffError } = await query.single();

    // 如果找不到（錯誤碼 PGRST116 表示 not found）
    if (staffError && staffError.code === 'PGRST116') {
      return NextResponse.json({
        bound: false
      });
    }

    // 其他錯誤
    if (staffError || !staff) {
      console.error('[LINE Check] 查詢錯誤:', staffError);
      return NextResponse.json(
        { bound: false, error: '查詢失敗' },
        { status: 500 }
      );
    }

    // 檢查員工是否啟用
    if (!staff.is_active) {
      return NextResponse.json(
        { bound: false, error: '該員工帳號已停用' },
        { status: 403 }
      );
    }

    // 驗證 clinic_id 是否存在
    if (!staff.clinic_id) {
      return NextResponse.json(
        { bound: false, error: '員工未關聯到診所，請聯繫管理員' },
        { status: 400 }
      );
    }

    // 2. 建立 Response
    const response = NextResponse.json({
      bound: true,
      staff: {
        id: staff.id,
        name: staff.name,
        role: staff.role,
        clinic_id: staff.clinic_id,
        phone: staff.phone
      }
    });

    // 3. 設定 Session Cookie（包含 staff_id, clinic_id, role）
    // 設定 staff_id cookie（用於識別當前登入的員工）
    response.cookies.set('staff_id', String(staff.id), {
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

    // 設定 role cookie（用於權限識別）
    if (staff.role) {
      response.cookies.set('staff_role', staff.role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 天
        sameSite: 'lax'
      });
    }

    console.log('[LINE Check] ✅ 已綁定:', {
      staff_id: staff.id,
      name: staff.name,
      role: staff.role,
      clinic_id: staff.clinic_id
    });

    return response;
  } catch (error: any) {
    console.error('[LINE Check] Server Error:', error);
    return NextResponse.json(
      { bound: false, error: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
