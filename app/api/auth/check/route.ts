import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
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
    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    // 1. 檢查是否為平台總管
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    let dbRole = 'staff'; // 預設權限
    const activeClinicId = cookieStore.get('active_clinic_id')?.value;

    // 2. 根據目前切換的診所，查詢該員工在那家診所的權限
    if (activeClinicId) {
        const { data: member } = await supabaseAdmin
            .from('clinic_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('clinic_id', activeClinicId)
            .single();
        if (member) dbRole = member.role;
    } else {
        // 若無選擇診所，抓取第一家
        const { data: member } = await supabaseAdmin
            .from('clinic_members')
            .select('role')
            .eq('user_id', user.id)
            .limit(1)
            .single();
        if (member) dbRole = member.role;
    }

    // 總管絕對擁有最高權限
    if (superAdmin) dbRole = 'owner';

    // 3. 轉換為前端認識的 authLevel ('boss' | 'manager' | null)
    let frontendAuthLevel = null;
    if (dbRole === 'owner' || dbRole === 'boss') frontendAuthLevel = 'boss';
    else if (dbRole === 'manager') frontendAuthLevel = 'manager';

    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email },
      authLevel: frontendAuthLevel
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false });
  }
}
