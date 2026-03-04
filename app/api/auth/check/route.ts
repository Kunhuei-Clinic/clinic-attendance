import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(request: Request) {
  try {
    const cookieStore = cookies();
    
    // 🟢 使用最新 SSR 標準寫法，避免 Next.js 在 GET 請求中修改 Cookie 而報錯
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('🔴 [Auth API] 無法取得使用者:', authError?.message);
      return NextResponse.json({ authenticated: false, reason: 'no_user' });
    }

    // 1. 檢查是否為平台總管
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    let dbRole = 'staff'; // 預設權限
    const activeClinicId = cookieStore.get('active_clinic_id')?.value;

    // 2. 查詢該員工的權限
    if (activeClinicId) {
        const { data: member, error: memberError } = await supabaseAdmin
            .from('clinic_members')
            .select('role')
            .eq('user_id', user.id)
            .eq('clinic_id', activeClinicId)
            .single();
            
        if (memberError && memberError.code !== 'PGRST116') {
            console.error('🔴 [Auth API] 查詢診所成員失敗:', memberError);
        }
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

    console.log(`🟢 [Auth API] 登入成功 - User: ${user.email}, Role: ${dbRole}, Level: ${frontendAuthLevel}`);

    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email },
      authLevel: frontendAuthLevel
    });
    
  } catch (error: any) {
    // 🔴 這裡會印出真正的致命錯誤！
    console.error('🔴 [Auth API] 系統崩潰:', error.message || error);
    return NextResponse.json({ authenticated: false, reason: 'fatal_error', error: error.message });
  }
}
