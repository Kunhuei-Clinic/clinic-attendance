import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkSalaryAccess, requireOwnerAuth, authErrorToResponse, UnauthorizedError, ForbiddenError } from '@/lib/authHelper';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const staffIdParam = searchParams.get('staff_id');
    const { clinicId, effectiveStaffId } = await checkSalaryAccess(request, staffIdParam ?? undefined);

    const yearMonth = searchParams.get('year_month');

    // 🟢 多租戶 + 權限：clinic_id 過濾；員工僅能看本人（effectiveStaffId 已由 checkSalaryAccess 強制）
    let query = supabaseAdmin
      .from('salary_history')
      .select('*')
      .eq('clinic_id', clinicId);

    if (yearMonth) {
      query = query.eq('year_month', yearMonth);
    }

    if (effectiveStaffId) {
      query = query.eq('staff_id', effectiveStaffId);
    }

    const { data, error } = await query.order('id', { ascending: true });

    if (error) {
      console.error('Error fetching salary history:', error);
      return NextResponse.json({ data: [], error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      const { status, message } = authErrorToResponse(error);
      return NextResponse.json({ data: [], error: message }, { status });
    }
    console.error('Salary History API GET Error:', error);
    return NextResponse.json({ data: [], error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { clinicId } = await requireOwnerAuth(request);

    const body = await request.json();
    const { records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: 'Missing or invalid records array' }, { status: 400 });
    }

    // 🟢 多租戶：為每筆記錄自動填入 clinic_id（不讓前端傳入）
    const recordsWithClinicId = records.map((record: any) => {
      const { clinic_id, ...rest } = record;
      return {
        ...rest,
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      };
    });

    const { data, error } = await supabaseAdmin
      .from('salary_history')
      .insert(recordsWithClinicId)
      .select();

    if (error) {
      console.error('Error creating salary history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      const { status, message } = authErrorToResponse(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error('Salary History API POST Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { clinicId } = await requireOwnerAuth(request);

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const yearMonth = searchParams.get('year_month');

    // ✅ 新增：支援單筆解除封存（依 id 刪除）
    if (id) {
      const { error } = await supabaseAdmin
        .from('salary_history')
        .delete()
        .eq('id', id)
        .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的紀錄

      if (error) {
        console.error('Error deleting single salary history record:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ✅ 保留原本依 year_month 全月刪除的備用邏輯
    if (!yearMonth) {
      return NextResponse.json({ error: 'Missing year_month or id parameter' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('salary_history')
      .delete()
      .eq('year_month', yearMonth)
      .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的紀錄

    if (error) {
      console.error('Error deleting salary history:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      const { status, message } = authErrorToResponse(error);
      return NextResponse.json({ error: message }, { status });
    }
    console.error('Salary History API DELETE Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
