import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 早期返回：排除靜態資源和 API routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$/.test(pathname)
  ) {
    return NextResponse.next()
  }

  // 1. 建立初始 Response (這很重要，因為我們要在它上面操作 Cookie)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. 建立 Supabase Client (使用 SSR 模式)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucpkvptnhgbtmghqgbof.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo',
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
  // 使用 getSession() 而不是 getUser()，因為我們需要完整的 session 資訊
  const { data: { session } } = await supabase.auth.getSession()

  // 4. 路由保護邏輯

  // 情況 A: 沒登入卻想去 /admin -> 踢回 /login
  if (!session && pathname.startsWith('/admin')) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 情況 B: 已經登入卻想去 /login -> 踢回 /admin (不用再登入了)
  if (session && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }

  // 5. 回傳處理過的 Response (帶著新的 Cookie)
  return response
}

export const config = {
  matcher: [
    /*
     * 排除所有靜態資源和 API routes，避免白畫面
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
