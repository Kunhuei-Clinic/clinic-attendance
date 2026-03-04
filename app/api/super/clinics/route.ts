import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
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
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    // 🔒 嚴格檢查：是否為 Super Admin
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (!superAdmin) {
      return NextResponse.json({ error: '權限不足，非平台總管' }, { status: 403 });
    }

    // 撈取所有診所名單
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    // 🔒 嚴格檢查
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    if (!superAdmin) {
      return NextResponse.json({ error: '無權限' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.name) {
      return NextResponse.json({ error: '診所名稱必填' }, { status: 400 });
    }

    // 建立新診所
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .insert({
        name: body.name,
        settings: {
          overtime_threshold: 9,
          overtime_approval_required: true,
          business_hours: { openDays: [1, 2, 3, 4, 5, 6], shifts: [] },
        },
      })
      .select()
      .single();

    if (error) throw error;

    // 🟢 自動將總管本人加入該診所的最高權限 (方便總管進去幫忙設定)
    await supabaseAdmin.from('clinic_members').insert({
      user_id: user.id,
      clinic_id: data.id,
      role: 'owner',
    });

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

