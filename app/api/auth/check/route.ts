import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET() {
  // 1. 取得 Cookie Store
  const cookieStore = cookies()

  // 2. 建立 Server Client (只讀模式)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  // 3. 正規取得 User (這會自動處理 base64 格式)
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // 4. 查詢使用者的角色 (使用 supabaseAdmin 繞過 RLS)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    // 如果查不到 profile，預設為 'boss' (向後兼容)
    console.warn('Profile not found for user:', user.id, profileError)
    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email },
      authLevel: 'boss'
    }, { status: 200 })
  }

  // 5. 轉換角色為 authLevel
  // 'admin' -> 'boss', 'user' -> 'manager'
  const authLevel = profile.role === 'admin' ? 'boss' : 'manager'

  // 6. 回傳成功（包含 authLevel）
  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email },
    authLevel: authLevel
  }, { status: 200 })
}
