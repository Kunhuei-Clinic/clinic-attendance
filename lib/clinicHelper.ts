import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * 依優先順序取得診所 ID（SaaS 統一識別碼）：
 * 1. Request Headers (x-clinic-id)
 * 2. Cookies (clinic_id)
 * 3. URL Query (clinic_id 或 clinicId)
 * 確保 Web / Mobile / Postman 等情境都能正確識別診所。
 */
export async function getClinicIdFromRequest(request: NextRequest): Promise<string | null> {
  const cookieStore = cookies();

  // 步驟 0：依優先順序取得「原始」診所 ID（不依賴 Session）
  const headerClinicId = request.headers.get('x-clinic-id')?.trim() || null;
  const cookieClinicId = cookieStore.get('clinic_id')?.value?.trim() || null;
  const searchParams = request.nextUrl.searchParams;
  const queryClinicId = searchParams.get('clinic_id') || searchParams.get('clinicId') || null;

  const rawClinicId = headerClinicId || cookieClinicId || queryClinicId || null;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const userId = user.id;
      const targetClinicId = rawClinicId;

      // 1. 平台總管 (Super Admin) 視同可操作任一院區
      const { data: superAdmin } = await supabaseAdmin
        .from('super_admins')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (superAdmin) {
        return targetClinicId || null;
      }

      // 2. 一般連鎖老闆/員工：若有目標診所則驗證是否為該診所成員
      if (targetClinicId) {
        const { data: memberRecord } = await supabaseAdmin
          .from('clinic_members')
          .select('clinic_id')
          .eq('user_id', userId)
          .eq('clinic_id', targetClinicId)
          .single();

        if (memberRecord) {
          return memberRecord.clinic_id;
        }
      }

      // 3. 預設降級：取該使用者名下第一家合法診所
      const { data: firstValidClinic } = await supabaseAdmin
        .from('clinic_members')
        .select('clinic_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (firstValidClinic?.clinic_id) return firstValidClinic.clinic_id;
    }

    // 4. 無 Supabase Session（例如 Portal 僅用 Cookie/Query）：直接回傳已取得的診所 ID
    if (rawClinicId) return rawClinicId;

    return null;
  } catch (error) {
    console.error('getClinicIdFromRequest Security Error:', error);
    return null;
  }
}
