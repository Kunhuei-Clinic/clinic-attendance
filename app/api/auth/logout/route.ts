import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * POST /api/auth/logout
 * 登出 API - 清除認證 Cookie
 * 
 * Response:
 *   { success: boolean, message?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // 刪除 Cookie
    cookieStore.delete('clinic_token');

    return NextResponse.json({
      success: true,
      message: '已登出'
    });
  } catch (error: any) {
    console.error('Logout API Error:', error);
    return NextResponse.json(
      { success: false, message: '登出失敗' },
      { status: 500 }
    );
  }
}
