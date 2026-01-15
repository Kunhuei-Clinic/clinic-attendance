import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // 只保護 /admin 開頭的路徑
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    // 檢查是否有 clinic_token Cookie
    const token = request.cookies.get('clinic_token');

    if (!token || !token.value) {
      // 沒有 Token，重定向到登入頁
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // 有 Token，放行
    return NextResponse.next();
  }

  // 其他路徑直接放行
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};
