import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

const CONFIG_KEY = 'statutory_tax_rates';

const DEFAULT_STATUTORY = {
  nhi_2nd_rate: 0.0211,
  nhi_2nd_threshold: 27470,
  tax_rate: 0.05,
  tax_threshold_salary: 40000,
  tax_threshold_professional: 20000,
};

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

/**
 * GET /api/settings/statutory
 * 讀取全平台法定稅率與扣繳門檻（需已登入且能識別診所；供薪資結算使用）
 */
export async function GET(request: NextRequest) {
  try {
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json({ error: '無法識別診所，請重新登入' }, { status: 401 });
    }

    const { data: row, error } = await supabaseAdmin
      .from('system_configs')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle();

    if (error) throw error;

    const data = mergeStatutory(row?.value);
    return NextResponse.json({ success: true, data });
  } catch (e: any) {
    console.error('GET /api/settings/statutory', e);
    return NextResponse.json({ error: e.message || '讀取失敗' }, { status: 500 });
  }
}
