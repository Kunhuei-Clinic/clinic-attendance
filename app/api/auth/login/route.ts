import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/auth/login
 * 一般網頁登入 API（使用手機號碼和密碼）
 * 
 * Request Body:
 *   { phone: string, password: string }
 * 
 * Response:
 *   { success: boolean, staff?: { id, name, role, clinic_id, ... }, message?: string }
 * 
 * 功能：
 * 1. 在 staff 表格搜尋 phone 與 password
 * 2. 必須 is_active = true
 * 3. 驗證成功後，建立 Session Cookie (包含 staff_id, clinic_id, role)
 * 4. Cookie 設定與 LIFF 綁定時一模一樣，確保權限通用
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, password } = body;

    // 驗證必要參數
    if (!phone || !password) {
      return NextResponse.json(
        { success: false, message: '請輸入手機號碼和密碼' },
        { status: 400 }
      );
    }

    // 1. 查詢員工資料（使用 phone 和 password 查詢）
    // 注意：若允許手機號碼重複，則優先回傳第一筆符合的
    const { data: staffList, error: fetchError } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, password, clinic_id, is_active, phone')
      .eq('phone', phone.trim())
      .eq('is_active', true);

    if (fetchError) {
      console.error('[Login] 查詢錯誤:', fetchError);
      return NextResponse.json(
        { success: false, message: '查詢失敗' },
        { status: 500 }
      );
    }

    // 2. 驗證：若找不到員工
    if (!staffList || staffList.length === 0) {
      console.error('[Login] 找不到員工:', { phone });
      return NextResponse.json(
        { success: false, message: '手機號碼或密碼錯誤' },
        { status: 401 }
      );
    }

    // 3. 比對密碼（若有多筆，逐一比對）
    let matchedStaff = null;
    for (const staff of staffList) {
      const dbPassword = staff.password || '0000';
      if (dbPassword === password) {
        matchedStaff = staff;
        break;
      }
    }

    // 4. 驗證：若密碼錯誤
    if (!matchedStaff) {
      console.error('[Login] 密碼錯誤:', { phone });
      return NextResponse.json(
        { success: false, message: '手機號碼或密碼錯誤' },
        { status: 401 }
      );
    }

    // 5. 驗證 clinic_id 是否存在
    if (!matchedStaff.clinic_id) {
      return NextResponse.json(
        { success: false, message: '員工未關聯到診所，請聯繫管理員' },
        { status: 400 }
      );
    }

    // 6. 建立 Response
    const response = NextResponse.json({
      success: true,
      staff: {
        id: matchedStaff.id,
        name: matchedStaff.name,
        role: matchedStaff.role,
        clinic_id: matchedStaff.clinic_id,
        phone: matchedStaff.phone
      }
    });

    // 7. Session：建立 Cookie（與 LIFF 綁定時一模一樣）
    // 設定 staff_id cookie（用於識別當前登入的員工）
    response.cookies.set('staff_id', matchedStaff.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 天
      sameSite: 'lax'
    });

    // 設定 clinic_id cookie（用於多租戶識別）
    response.cookies.set('clinic_id', matchedStaff.clinic_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 天
      sameSite: 'lax'
    });

    // 設定 role cookie（用於權限識別）
    if (matchedStaff.role) {
      response.cookies.set('staff_role', matchedStaff.role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 天
        sameSite: 'lax'
      });
    }

    console.log('[Login] ✅ 登入成功:', {
      staff_id: matchedStaff.id,
      name: matchedStaff.name,
      role: matchedStaff.role,
      clinic_id: matchedStaff.clinic_id
    });

    return response;
  } catch (error: any) {
    console.error('[Login] Server Error:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
