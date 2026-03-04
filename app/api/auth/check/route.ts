import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// 🟢 終極解法：強制 Next.js 在每次請求時都重新執行此 API，絕對不快取！
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 🟢 將 cookies() 移到 try 外面，絕對不攔截 Next.js 的系統拋錯
  const cookieStore = cookies();

  try {
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
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set({ name, value, ...options });
              });
            } catch (error) {
              // 忽略 Server Component 的設定錯誤
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ authenticated: false, reason: 'no_user' });
    }

    // 1. 檢查是否為平台總管
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    let dbRole = 'staff';
    const activeClinicId = cookieStore.get('active_clinic_id')?.value;

    // 2. 查詢該員工的權限
    if (activeClinicId) {
        const { data: member } = await supabaseAdmin
            .from('clinic_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('clinic_id', activeClinicId)
            .single();
        if (member) dbRole = member.role;
    } else {
        const { data: member } = await supabaseAdmin
            .from('clinic_members')
            .select('role')
            .eq('user_id', user.id)
            .limit(1)
            .single();
        if (member) dbRole = member.role;
    }

    if (superAdmin) dbRole = 'owner';

    // 3. 轉換權限
    let frontendAuthLevel = null;
    if (dbRole === 'owner' || dbRole === 'boss') frontendAuthLevel = 'boss';
    else if (dbRole === 'manager') frontendAuthLevel = 'manager';

    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email },
      authLevel: frontendAuthLevel
    });
    
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ authenticated: false, reason: 'fatal_error' });
  }
}
