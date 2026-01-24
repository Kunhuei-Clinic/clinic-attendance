import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/auth/check
 * 檢查認證狀態 API (Supabase Auth)
 * 
 * Response:
 *   { authenticated: boolean, user?: { id: string, email: string, clinic_id: string } }
 */
export async function GET(request: NextRequest) {
  try {
    // 從 Request 取得 clinic_id (會自動從 Session Cookie 解析)
    const clinicId = await getClinicIdFromRequest(request);

    if (!clinicId) {
      return NextResponse.json({
        authenticated: false
      });
    }

    // 嘗試從 Session Cookie 取得 user ID
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return NextResponse.json({ authenticated: false });
    }

    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
    if (!projectRef) {
      return NextResponse.json({ authenticated: false });
    }

    const sessionCookieName = `sb-${projectRef}-auth-token`;
    const sessionCookie = request.cookies.get(sessionCookieName);

    if (!sessionCookie?.value) {
      // 檢查是否有 user_id cookie (向後兼容)
      const userIdCookie = request.cookies.get('user_id');
      if (userIdCookie?.value) {
        return NextResponse.json({
          authenticated: true,
          user: {
            id: userIdCookie.value,
            clinic_id: clinicId
          }
        });
      }
      return NextResponse.json({ authenticated: false });
    }

    try {
      // 解析 session cookie 取得 user ID
      const sessionData = JSON.parse(sessionCookie.value);
      const userId = sessionData?.user?.id;

      if (!userId) {
        return NextResponse.json({ authenticated: false });
      }

      // 驗證 user 是否存在
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(sessionData.access_token);
      
      if (error || !user) {
        return NextResponse.json({ authenticated: false });
      }

      return NextResponse.json({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          clinic_id: clinicId
        }
      });
    } catch (parseError) {
      console.error('Error parsing session:', parseError);
      return NextResponse.json({ authenticated: false });
    }
  } catch (error: any) {
    console.error('Auth Check API Error:', error);
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}
