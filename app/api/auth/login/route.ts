import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getClinicId } from '@/lib/clinicHelper';

/**
 * POST /api/auth/login
 * Supabase Auth 登入 API (使用 @supabase/ssr 確保 Cookie 正確設定)
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

    // 建立 Server Client 來處理登入和 Cookie
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // 在 API Route 中，setAll 可能無法直接設定 Cookie
              // 我們會在 response 中手動設定
            }
          },
        },
      }
    );

    // 使用 Supabase Auth 進行登入
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user || !authData.session) {
      console.error('Login error:', authError);
      return NextResponse.json(
        { success: false, message: authError?.message || '帳號或密碼錯誤' },
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

    // 建立 Response
    const response = NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        clinic_id: clinicId
      }
    });

    // 手動設定 Supabase Session Cookie（因為在 API Route 中 setAll 可能無法直接設定）
    // Supabase 的 Cookie 名稱格式：sb-<project-ref>-auth-token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && authData.session) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
      if (projectRef) {
        const cookieName = `sb-${projectRef}-auth-token`;
        
        // 將完整的 session 資料存入 cookie (Supabase 格式)
        const sessionData = {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
          expires_in: authData.session.expires_in,
          token_type: authData.session.token_type || 'bearer',
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

    return response;
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
