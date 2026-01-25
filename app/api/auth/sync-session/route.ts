import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/auth/sync-session
 * 將客戶端的 Supabase Session 同步到服務端 Cookie
 * 
 * Request Body:
 *   { access_token: string, refresh_token: string, expires_at: number }
 * 
 * Response:
 *   { success: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token, refresh_token, expires_at } = body;

    if (!access_token) {
      return NextResponse.json(
        { success: false, message: '缺少 access_token' },
        { status: 400 }
      );
    }

    // 驗證 token 並取得 user
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);

    if (error || !user) {
      return NextResponse.json(
        { success: false, message: '無效的 token' },
        { status: 401 }
      );
    }

    // 設定 Supabase Session Cookie
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json(
        { success: false, message: '缺少 Supabase URL' },
        { status: 500 }
      );
    }

    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
    if (!projectRef) {
      return NextResponse.json(
        { success: false, message: '無法解析 Supabase URL' },
        { status: 500 }
      );
    }

    const cookieName = `sb-${projectRef}-auth-token`;
    
    // 將完整的 session 資料存入 cookie
    const sessionData = {
      access_token,
      refresh_token,
      expires_at,
      expires_in: expires_at ? Math.floor((expires_at * 1000 - Date.now()) / 1000) : 3600,
      token_type: 'bearer',
      user: {
        id: user.id,
        email: user.email
      }
    };

    const response = NextResponse.json({ success: true });

    response.cookies.set(cookieName, JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      sameSite: 'lax'
    });

    // 同時設定 user_id cookie (向後兼容)
    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 天
      sameSite: 'lax'
    });

    return response;
  } catch (error: any) {
    console.error('Sync Session API Error:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
