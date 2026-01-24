import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicId } from '@/lib/clinicHelper';

/**
 * POST /api/auth/login
 * Supabase Auth 登入 API
 * 
 * Request Body:
 *   { email: string, password: string }
 * 
 * Response:
 *   { success: boolean, user?: { id: string, email: string, clinic_id: string }, message?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: '請輸入帳號和密碼' },
        { status: 400 }
      );
    }

    // 使用 Supabase Auth 進行登入
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      console.error('Login error:', authError);
      return NextResponse.json(
        { success: false, message: '帳號或密碼錯誤' },
        { status: 401 }
      );
    }

    // 取得使用者的 clinic_id
    const clinicId = await getClinicId(authData.user.id);
    
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '找不到該使用者所屬的診所，請聯繫管理員' },
        { status: 403 }
      );
    }

    // 取得 Session Token
    const sessionToken = authData.session?.access_token;
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, message: '登入失敗，無法建立 Session' },
        { status: 500 }
      );
    }

    // 設定 Response 並將 Session 寫入 Cookie
    // Supabase 會自動處理 Session Cookie，但我們也可以手動設定
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        clinic_id: clinicId
      }
    });

    // 設定 Supabase Session Cookie
    // Supabase 的 Cookie 名稱格式：sb-<project-ref>-auth-token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
      if (projectRef) {
        const cookieName = `sb-${projectRef}-auth-token`;
        
        // 將完整的 session 資料存入 cookie (Supabase 格式)
        const sessionData = {
          access_token: authData.session?.access_token,
          refresh_token: authData.session?.refresh_token,
          expires_at: authData.session?.expires_at,
          expires_in: authData.session?.expires_in,
          token_type: authData.session?.token_type,
          user: {
            id: authData.user.id,
            email: authData.user.email
          }
        };

        response.cookies.set(cookieName, JSON.stringify(sessionData), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 60 * 60 * 24 * 7, // 7 天
          sameSite: 'lax'
        });
      }
    }

    // 同時設定 user_id cookie (向後兼容)
    response.cookies.set('user_id', authData.user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      sameSite: 'lax'
    });

    return response;
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
