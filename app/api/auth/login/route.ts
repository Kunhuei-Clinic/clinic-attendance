import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/login
 * 管理員登入驗證 API
 * 
 * Request Body:
 *   { passcode: string }
 * 
 * Response:
 *   { success: boolean, authLevel?: 'boss' | 'manager', message?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { passcode } = body;

    if (!passcode || typeof passcode !== 'string') {
      return NextResponse.json(
        { success: false, message: '請輸入密碼' },
        { status: 400 }
      );
    }

    // 從環境變數讀取密碼
    const bossPasscode = process.env.ADMIN_BOSS_PASSWORD;
    const managerPasscode = process.env.ADMIN_MANAGER_PASSWORD;

    let authLevel: 'boss' | 'manager' | null = null;

    // 驗證密碼
    if (passcode === bossPasscode) {
      authLevel = 'boss';
    } else if (passcode === managerPasscode) {
      authLevel = 'manager';
    } else {
      return NextResponse.json(
        { success: false, message: '密碼錯誤' },
        { status: 401 }
      );
    }

    // 設定 Cookie
    const cookieStore = await cookies();
    const maxAge = 60 * 60 * 24; // 1 天 (秒)
    
    cookieStore.set('clinic_token', authLevel, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: maxAge,
      sameSite: 'lax'
    });

    return NextResponse.json({
      success: true,
      authLevel: authLevel
    });
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
