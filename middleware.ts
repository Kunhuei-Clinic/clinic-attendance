import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // 只保護 /admin 開頭的路徑
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    // 檢查是否有 Supabase Session Cookie 或 user_id Cookie
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let hasAuth = false;

    if (supabaseUrl) {
      const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
      if (projectRef) {
        const sessionCookieName = `sb-${projectRef}-auth-token`;
        const sessionCookie = request.cookies.get(sessionCookieName);
        if (sessionCookie?.value) {
          hasAuth = true;
        }
      }
    }

    // 向後兼容：檢查 user_id cookie
    if (!hasAuth) {
      const userIdCookie = request.cookies.get('user_id');
      if (userIdCookie?.value) {
        hasAuth = true;
      }
    }

    if (!hasAuth) {
      // 沒有認證，重定向到登入頁
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 有認證，放行
    return NextResponse.next();
  }

  // 其他路徑直接放行
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
