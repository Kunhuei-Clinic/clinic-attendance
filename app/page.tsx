import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * 根目錄頁面 (Server Component)
 * 檢查是否有管理員登入：
 * - 有 Session -> 跳轉到 /admin
 * - 無 Session -> 跳轉到 /login
 * 
 * 注意：員工入口請使用 /portal 或 /checkin
 */
export default async function RootPage() {
  const cookieStore = await cookies();

  // 建立 Supabase Client (Server Component 方式)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );

  // 檢查 Session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    // 有 Session，跳轉到管理後台
    redirect('/admin');
  } else {
    // 無 Session，跳轉到登入頁
    redirect('/login');
  }
}
