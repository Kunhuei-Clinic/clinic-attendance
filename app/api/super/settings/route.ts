import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const CONFIG_KEY = 'statutory_tax_rates';

const DEFAULT_STATUTORY = {
  nhi_2nd_rate: 0.0211,
  nhi_2nd_threshold: 27470,
  tax_rate: 0.05,
  tax_threshold_salary: 40000,
  tax_threshold_professional: 20000,
};

async function requireSuperAdmin() {
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
    return { error: NextResponse.json({ error: '未登入' }, { status: 401 }) };
  }

  const { data: superAdmin } = await supabaseAdmin
    .from('super_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .single();

  if (!superAdmin) {
    return { error: NextResponse.json({ error: '權限不足，非平台總管' }, { status: 403 }) };
  }

  return { user };
}

function mergeStatutory(raw: unknown): typeof DEFAULT_STATUTORY {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_STATUTORY };
  const o = raw as Record<string, unknown>;
  return {
    nhi_2nd_rate: Number(o.nhi_2nd_rate ?? DEFAULT_STATUTORY.nhi_2nd_rate),
    nhi_2nd_threshold: Number(o.nhi_2nd_threshold ?? DEFAULT_STATUTORY.nhi_2nd_threshold),
    tax_rate: Number(o.tax_rate ?? DEFAULT_STATUTORY.tax_rate),
    tax_threshold_salary: Number(o.tax_threshold_salary ?? DEFAULT_STATUTORY.tax_threshold_salary),
    tax_threshold_professional: Number(
      o.tax_threshold_professional ?? DEFAULT_STATUTORY.tax_threshold_professional
    ),
  };
}

/** GET：讀取全域法定稅率與門檻（僅 Super Admin） */
export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const { data: row, error } = await supabaseAdmin
      .from('system_configs')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle();

    if (error) throw error;

    const data = mergeStatutory(row?.value);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('GET /api/super/settings', e);
    return NextResponse.json({ error: e.message || '讀取失敗' }, { status: 500 });
  }
}

/** POST：更新全域法定稅率與門檻（僅 Super Admin） */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if ('error' in auth) return auth.error;

    const body = await request.json();
    const merged = mergeStatutory(body);

    const { error } = await supabaseAdmin.from('system_configs').upsert(
      {
        key: CONFIG_KEY,
        value: merged as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (error) throw error;

    return NextResponse.json({ success: true, data: merged });
  } catch (e: any) {
    console.error('POST /api/super/settings', e);
    return NextResponse.json({ error: e.message || '儲存失敗' }, { status: 500 });
  }
}
