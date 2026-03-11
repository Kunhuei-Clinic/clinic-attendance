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
    let activeClinicId = cookieStore.get('clinic_id')?.value ?? null;

    // 2. 查詢該員工的權限（若無 Cookie 則取第一個診所）
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
        .select('role, clinic_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (member) {
        dbRole = member.role;
        activeClinicId = (member as { clinic_id?: string }).clinic_id ?? null;
      }
    }

    if (superAdmin) dbRole = 'owner';

    // 3. 轉換權限
    let frontendAuthLevel = null;
    if (dbRole === 'owner' || dbRole === 'boss') frontendAuthLevel = 'boss';
    else if (dbRole === 'manager') frontendAuthLevel = 'manager';

    // 4. 若有診所 ID 則一併回傳診所名稱，減少前端二次請求
    let clinicName: string | null = null;
    if (activeClinicId) {
      const { data: clinic } = await supabaseAdmin
        .from('clinics')
        .select('name')
        .eq('id', activeClinicId)
        .single();
      if (clinic?.name) clinicName = clinic.name;
    }

    const responseData = {
      authenticated: true,
      user: { id: user.id, email: user.email },
      authLevel: frontendAuthLevel,
      activeClinicId: activeClinicId ?? undefined,
      clinicName: clinicName ?? undefined
    };

    const response = NextResponse.json(responseData);

    if (activeClinicId) {
      response.cookies.set('clinic_id', activeClinicId, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      });
    }

    return response;
    
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ authenticated: false, reason: 'fatal_error' });
  }
}
