import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/portal/salary-history?userId=...
 * 讀取封存薪資（salary_history 或醫師 doctor_ppf），需 Cookie 登入且 userId 必須為本人。
 */
export async function GET(request: NextRequest) {
  try {
    const staffIdCookie = request.cookies.get('staff_id')?.value?.trim();
    const clinicIdCookie = request.cookies.get('clinic_id')?.value?.trim();
    const searchParams = request.nextUrl.searchParams;
    const queryUserId = searchParams.get('userId')?.trim();
    const queryClinicId = searchParams.get('clinic_id')?.trim() || searchParams.get('clinicId')?.trim();

    if (!staffIdCookie) {
      return NextResponse.json(
        { success: false, error: '員工未登入或 Session 已過期', code: 'missing_staff' },
        { status: 401 }
      );
    }

    if (!queryUserId || queryUserId !== staffIdCookie) {
      return NextResponse.json(
        { success: false, error: '無權讀取他人薪資', code: 'forbidden' },
        { status: 403 }
      );
    }

    const staffId = staffIdCookie;
    let clinicId = clinicIdCookie || queryClinicId || null;

    const { data: staffCheck, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id, role, is_active')
      .eq('id', staffId)
      .single();

    if (staffError || !staffCheck) {
      return NextResponse.json(
        { success: false, error: '找不到員工' },
        { status: 403 }
      );
    }

    if (!staffCheck.is_active) {
      return NextResponse.json(
        { success: false, error: '該員工帳號已停用' },
        { status: 403 }
      );
    }

    if (!clinicId && staffCheck.clinic_id) {
      clinicId = staffCheck.clinic_id;
    }

    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: '缺少診所別', code: 'missing_clinic' },
        { status: 401 }
      );
    }

    if (staffCheck.clinic_id !== clinicId) {
      return NextResponse.json(
        { success: false, error: '診所不匹配' },
        { status: 403 }
      );
    }

    let rows: any[] = [];

    if (staffCheck.role === '醫師') {
      const { data, error } = await supabaseAdmin
        .from('doctor_ppf')
        .select('*')
        .eq('doctor_id', staffId)
        .eq('clinic_id', clinicId)
        .order('paid_in_month', { ascending: false });

      if (error) {
        console.error('[portal/salary-history] doctor_ppf:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      rows = (data || []).map((row: any) => ({
        ...row,
        year_month: row.paid_in_month,
        snapshot_data: null,
        snapshot: null,
        _doctor_row: true,
      }));
    } else {
      const { data, error } = await supabaseAdmin
        .from('salary_history')
        .select('*')
        .eq('staff_id', staffId)
        .eq('clinic_id', clinicId)
        .order('year_month', { ascending: false });

      if (error) {
        console.error('[portal/salary-history] salary_history:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
      rows = data || [];
    }

    return NextResponse.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    console.error('[portal/salary-history]', error);
    return NextResponse.json(
      { success: false, error: error?.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
