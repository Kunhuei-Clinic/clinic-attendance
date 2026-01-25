import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. 建立初始 Response (這很重要，因為我們要在它上面操作 Cookie)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. 建立 Supabase Client (使用 SSR 模式)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // 3. 刷新 Session (這一步是關鍵，它會更新 Cookie 效期)
  const { data: { user } } = await supabase.auth.getUser()

  // 4. 路由保護邏輯
  const { pathname } = request.nextUrl // 這裡只宣告一次！

  // 情況 A: 沒登入卻想去 /admin -> 踢回 /login
  if (!user && pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 情況 B: 已經登入卻想去 /login -> 踢回 /admin (不用再登入了)
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // 5. 回傳處理過的 Response (帶著新的 Cookie)
  return response
}

export const config = {
  matcher: [
    /*
     * 排除所有靜態資源，避免白畫面
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
