import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // 建立 Supabase Server Client 以取得目前登入使用者
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    // 🔒 查詢該使用者在 clinic_members 表格中擁有哪些診所的權限
    const { data, error } = await supabaseAdmin
      .from('clinic_members')
      .select(
        `
        role,
        clinics ( id, name )
      `
      )
      .eq('user_id', user.id);

    if (error) throw error;

    const userClinics =
      data?.map((item: any) => ({
        id: item.clinics.id,
        name: item.clinics.name,
        role: item.role,
      })) ?? [];

    return NextResponse.json({ success: true, data: userClinics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

