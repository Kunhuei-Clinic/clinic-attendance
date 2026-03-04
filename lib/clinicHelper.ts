import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getClinicIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    const cookieStore = cookies();
    // 🟢 使用最新 SSR 標準讀取 User
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          // 🟢 必須補上這兩段，SSR 登入才不會失效
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
    if (!user) return null; // 如果抓不到人，絕對是回傳 null

    const userId = user.id;
    // 優先讀取請求頭，其次讀取 Cookie
    const targetClinicId = request.headers.get('x-clinic-id') || cookieStore.get('active_clinic_id')?.value;

    // 1. 檢查是否為平台總管 (Super Admin)
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (superAdmin) {
      return targetClinicId || null; 
    }

    // 2. 一般連鎖老闆/員工的嚴格驗證
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

    // 3. 預設降級：抓取他名下的第一家合法診所
    const { data: firstValidClinic } = await supabaseAdmin
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    return firstValidClinic?.clinic_id || null;
  } catch (error) {
    console.error('getClinicIdFromRequest Security Error:', error);
    return null;
  }
}
