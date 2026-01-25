import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 建立 Response 物件（必須先建立，因為 Supabase 會修改它）
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 建立 Supabase Client（使用 SSR 方式）
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // 在 middleware 中設定 cookie
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // **重要**：執行 getSession() 來刷新 Cookie
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = request.nextUrl;

  // 處理 /admin 路徑：需要認證
  if (pathname.startsWith('/admin')) {
    if (!session) {
      // 沒有 Session，重定向到登入頁
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // 有 Session，放行（回傳包含刷新後 Cookie 的 response）
    return response;
  }

  // 處理 /login 路徑：如果已登入，重定向到 /admin（防止重複登入）
  if (pathname.startsWith('/login')) {
    if (session) {
      // 已經有 Session，重定向到管理後台
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    // 沒有 Session，允許訪問登入頁（回傳包含刷新後 Cookie 的 response）
    return response;
  }

  // 其他路徑直接放行（回傳包含刷新後 Cookie 的 response）
  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有路徑，除了：
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
