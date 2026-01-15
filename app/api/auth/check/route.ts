import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/check
 * 檢查認證狀態 API
 * 
 * Response:
 *   { authenticated: boolean, authLevel?: 'boss' | 'manager' }
 */
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('clinic_token');

    if (!token || !token.value) {
      return NextResponse.json({
        authenticated: false
      });
    }

    const authLevel = token.value as 'boss' | 'manager';

    return NextResponse.json({
      authenticated: true,
      authLevel: authLevel
    });
  } catch (error: any) {
    console.error('Auth Check API Error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}
