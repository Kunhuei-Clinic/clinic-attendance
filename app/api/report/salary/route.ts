import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/report/salary
 * 取得薪資報表資料
 * 
 * Query Parameters:
 *   - useDateFilter: boolean (optional)
 *   - startMonth: string (YYYY-MM, optional)
 *   - endMonth: string (YYYY-MM, optional)
 *   - month: string (YYYY-MM, optional)
 *   - roleFilter: 'all' | 'doctor' | 'staff' (optional)
 *   - selectedStaffId: string | 'all' (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const useDateFilter = searchParams.get('useDateFilter') === 'true';
    const startMonth = searchParams.get('startMonth');
    const endMonth = searchParams.get('endMonth');
    const month = searchParams.get('month');
    const roleFilter = searchParams.get('roleFilter') || 'all';
    const selectedStaffId = searchParams.get('selectedStaffId') || 'all';

    const data: any[] = [];

    // 1. 抓醫師資料 (doctor_ppf)
    if (roleFilter === 'all' || roleFilter === 'doctor') {
      let query = supabaseAdmin
        .from('doctor_ppf')
        .select(`*, staff:doctor_id (name, role, insurance_labor, insurance_health)`)
        .eq('status', 'locked');

      if (useDateFilter && startMonth && endMonth) {
        query = query.gte('paid_in_month', startMonth).lte('paid_in_month', endMonth);
      } else if (month) {
        query = query.eq('paid_in_month', month);
      }

      if (selectedStaffId !== 'all') {
        query = query.eq('doctor_id', Number(selectedStaffId));
      }

      const { data: docs } = await query;

      docs?.forEach((d: any) => {
        const extraTotal = Array.isArray(d.extra_items)
          ? d.extra_items.reduce((sum: number, item: any) => sum + Number(item.amount), 0)
          : 0;
        const insuranceDeduction = (d.staff?.insurance_labor || 0) + (d.staff?.insurance_health || 0);
        const basePay = d.actual_base_pay || 0;
        const bonus = (d.final_ppf_bonus || 0) + extraTotal;
        const netTotal = basePay + bonus - insuranceDeduction;

        data.push({
          type: 'doctor',
          displayType: '醫師',
          name: d.staff?.name,
          month: d.paid_in_month,
          total: netTotal,
          details: `PPF:${d.target_month}`
        });
      });
    }

    // 2. 抓員工資料 (salary_history)
    if (roleFilter === 'all' || roleFilter === 'staff') {
      let query = supabaseAdmin
        .from('salary_history')
        .select('year_month, staff_name, snapshot');

      if (useDateFilter && startMonth && endMonth) {
        query = query.gte('year_month', startMonth).lte('year_month', endMonth);
      } else if (month) {
        query = query.eq('year_month', month);
      }

      if (selectedStaffId !== 'all') {
        // 需要先取得員工姓名
        const { data: staff } = await supabaseAdmin
          .from('staff')
          .select('name')
          .eq('id', Number(selectedStaffId))
          .single();
        
        if (staff) {
          query = query.eq('staff_name', staff.name);
        }
      }

      const { data: histories } = await query;

      histories?.forEach((h: any) => {
        const snap = h.snapshot || {};
        data.push({
          type: 'staff',
          displayType: '員工',
          name: h.staff_name,
          month: h.year_month,
          total: snap.net_pay || 0,
          details: `工時:${snap.total_hours?.toFixed(1) || 0}hr`
        });
      });
    }

    // 排序邏輯
    data.sort((a, b) =>
      b.month.localeCompare(a.month) ||
      a.type.localeCompare(b.type) ||
      a.name.localeCompare(b.name)
    );

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Salary report API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
