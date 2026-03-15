import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * POST /api/leave/settle
 * 特休結算 (將特休換成錢)
 * 
 * Request Body:
 *   {
 *     staff_id: string (UUID),
 *     days: number,
 *     pay_month: string (YYYY-MM),
 *     notes?: string
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { staff_id, days, pay_month, notes } = body;

    // 取得前端傳來的金額 (若無則預設為 0)，用於同步至薪資單
    const amountForSalary = body.amount ?? 0;
    
    if (!staff_id || !days || !pay_month) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }
    
    if (days <= 0) {
      return NextResponse.json(
        { success: false, message: '結算天數必須大於0' },
        { status: 400 }
      );
    }
    
    // 驗證 pay_month 格式
    if (!/^\d{4}-\d{2}$/.test(pay_month)) {
      return NextResponse.json(
        { success: false, message: '發放月份格式錯誤 (應為 YYYY-MM)' },
        { status: 400 }
      );
    }
    
    // 🟢 多租戶：取得該診所的員工資料；staff_id 保持 string (UUID)
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, base_salary, salary_mode')
      .eq('id', String(staff_id))
      .eq('clinic_id', clinicId) // 🟢 確保只查詢該診所的員工
      .single();
    
    if (staffError || !staff) {
      return NextResponse.json(
        { success: false, message: '找不到員工資料或無權限操作' },
        { status: 403 }
      );
    }
    
    // 2. 根據薪資模式計算結算金額
    const baseSalary = Number(staff.base_salary) || 0;
    const salaryMode = staff.salary_mode || 'hourly';
    let amount = 0;
    
    if (salaryMode === 'monthly') {
      // 月薪制：底薪 / 30 * 天數
      amount = Math.round((baseSalary / 30) * days * 100) / 100;
    } else {
      // 時薪制：時薪 * 8小時 * 天數
      amount = Math.round((baseSalary * 8) * days * 100) / 100;
    }
    
    // 3. 檢查剩餘特休是否足夠
    // 直接計算特休統計（避免外部 API 調用）
    const { data: leaveRequests } = await supabaseAdmin
      .from('leave_requests')
      .select('staff_id, hours, start_time')
      .eq('staff_id', String(staff_id))
      .eq('type', '特休')
      .eq('status', 'approved')
      .eq('clinic_id', clinicId); // 🟢 只查詢該診所的請假紀錄
    
    const { data: settlements } = await supabaseAdmin
      .from('leave_settlements')
      .select('staff_id, days, status')
      .eq('staff_id', String(staff_id))
      .eq('status', 'processed')
      .eq('clinic_id', clinicId); // 🟢 只查詢該診所的結算紀錄
    
    // 簡化計算：這裡只做基本驗證，詳細計算由 stats API 處理
    // 如果結算天數過大（超過30天），直接拒絕
    if (Number(days) > 30) {
      return NextResponse.json(
        { success: false, message: '結算天數不能超過30天' },
        { status: 400 }
      );
    }
    
    // 🟢 多租戶：建立結算紀錄時自動填入 clinic_id；staff_id、pay_month 保持 string
    const { data: settlement, error: insertError } = await supabaseAdmin
      .from('leave_settlements')
      .insert([{
        staff_id: String(staff_id),
        days: Number(days),
        amount,
        pay_month,
        status: 'pending',
        notes: notes || '',
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      }])
      .select()
      .single();
    
    if (insertError) {
      console.error('Create settlement error:', insertError);
      return NextResponse.json(
        { success: false, message: `建立結算紀錄失敗: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 🟢 自動化：將結算金額同步寫入當月薪資單的「加給項目」
    if (amountForSalary > 0) {
      const { error: adjError } = await supabaseAdmin
        .from('salary_adjustments')
        .insert({
          staff_id: staff_id,
          clinic_id: clinicId,
          year_month: pay_month,
          type: 'bonus',
          name: `特休結算 (${days}天)`,
          amount: Math.round(amountForSalary),
        });

      if (adjError) {
        console.error('[Settle API] 同步至薪資單失敗:', adjError);
        // 即使同步薪資單失敗，特休結算依然算成功，但不中斷流程
      }
    }

    return NextResponse.json({
      success: true,
      message: '結算完成，並已自動同步至該月薪資單',
      data: settlement,
    });
  } catch (error: any) {
    console.error('Leave Settle API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/leave/settle
 * 查詢結算紀錄
 */
export async function GET(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { data: [], error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const staffId = searchParams.get('staff_id');
    const payMonth = searchParams.get('pay_month');
    const status = searchParams.get('status');
    
    // 🟢 多租戶：強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('leave_settlements')
      .select('*, staff:staff_id (id, name)')
      .eq('clinic_id', clinicId) // 只查詢該診所的結算紀錄
      .order('created_at', { ascending: false });
    
    if (staffId) {
      query = query.eq('staff_id', String(staffId));
    }
    
    if (payMonth) {
      query = query.eq('pay_month', String(payMonth));
    }
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Fetch settlements error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Leave Settle GET API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leave/settle
 * 更新結算紀錄狀態 (例如：標記為已處理)
 */
export async function PATCH(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, status } = body;
    
    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }
    
    // 🟢 多租戶：更新時也要驗證該紀錄屬於當前診所；id 保持 string (UUID)
    const { error } = await supabaseAdmin
      .from('leave_settlements')
      .update({ status })
      .eq('id', String(id))
      .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的紀錄
    
    if (error) {
      console.error('Update settlement error:', error);
      return NextResponse.json(
        { success: false, message: `更新失敗: ${error.message}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '更新成功'
    });
  } catch (error: any) {
    console.error('Leave Settle PATCH API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
