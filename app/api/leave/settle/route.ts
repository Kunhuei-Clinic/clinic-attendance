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

    // 🟢 關鍵修復：確實解構出前端傳來的 target_year 與 amount
    const { staff_id, days, pay_month, notes, target_year, amount } = body;

    if (!staff_id || days == null || !pay_month) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    // 1. 寫入特休結算紀錄 (leave_settlements)
    const { error: insertError } = await supabaseAdmin
      .from('leave_settlements')
      .insert({
        staff_id,
        clinic_id: clinicId,
        days,
        pay_month,
        notes: notes || '',
        // 🟢 修正：使用 parseFloat 保留「滿半年 (0.5)」的小數點
        target_year: target_year ? parseFloat(target_year) : null,
        status: 'approved' // 確保寫入時就是核准狀態
      });

    if (insertError) {
      console.error('[Settle API] 寫入結算紀錄失敗:', insertError);
      throw insertError;
    }

    // 2. 自動化：將結算金額同步寫入當月薪資單的「加給項目」(salary_adjustments)
    if (amount && amount > 0) {
      const { error: adjError } = await supabaseAdmin
        .from('salary_adjustments')
        .insert({
          staff_id: staff_id,
          clinic_id: clinicId,
          year_month: pay_month,
          type: 'bonus', // 標記為加項
          name: `特休結算 (${days}天)`,
          amount: Math.round(amount)
        });

      if (adjError) {
        console.error('[Settle API] 同步至薪資單失敗:', adjError);
        // 注意：這裡不 throw error，避免薪資單連動失敗導致結算流程中斷
      }
    }

    return NextResponse.json({
      success: true,
      message: '結算完成，並已同步至當月薪資單'
    });
  } catch (error: any) {
    console.error('[Settle API] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || '伺服器內部錯誤' },
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
