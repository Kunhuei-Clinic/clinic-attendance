import { NextRequest, NextResponse } from 'next/server';

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

    // 驗證密碼
    if (passcode === bossPasscode) {
      return NextResponse.json({
        success: true,
        authLevel: 'boss'
      });
    } else if (passcode === managerPasscode) {
      return NextResponse.json({
        success: true,
        authLevel: 'manager'
      });
    } else {
      return NextResponse.json(
        { success: false, message: '密碼錯誤' },
        { status: 401 }
      );
    }
  } catch (error: any) {
    console.error('Login API Error:', error);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
