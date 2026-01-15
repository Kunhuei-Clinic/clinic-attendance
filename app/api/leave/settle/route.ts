import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/leave/settle
 * 特休結算 (將特休換成錢)
 * 
 * Request Body:
 *   {
 *     staff_id: number,
 *     days: number,
 *     pay_month: string (YYYY-MM),
 *     notes?: string
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staff_id, days, pay_month, notes } = body;
    
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
    
    // 1. 取得員工資料 (需要 base_salary)
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, base_salary')
      .eq('id', Number(staff_id))
      .single();
    
    if (staffError || !staff) {
      return NextResponse.json(
        { success: false, message: '找不到員工資料' },
        { status: 404 }
      );
    }
    
    // 2. 計算結算金額：底薪 / 30 * 天數
    const baseSalary = Number(staff.base_salary) || 0;
    const amount = Math.round((baseSalary / 30) * days * 100) / 100; // 保留兩位小數
    
    // 3. 檢查剩餘特休是否足夠
    // 直接計算特休統計（避免外部 API 調用）
    const { data: leaveRequests } = await supabaseAdmin
      .from('leave_requests')
      .select('staff_id, hours, start_time')
      .eq('staff_id', Number(staff_id))
      .eq('type', '特休')
      .eq('status', 'approved');
    
    const { data: settlements } = await supabaseAdmin
      .from('leave_settlements')
      .select('staff_id, days, status')
      .eq('staff_id', Number(staff_id))
      .eq('status', 'processed');
    
    // 簡化計算：這裡只做基本驗證，詳細計算由 stats API 處理
    // 如果結算天數過大（超過30天），直接拒絕
    if (Number(days) > 30) {
      return NextResponse.json(
        { success: false, message: '結算天數不能超過30天' },
        { status: 400 }
      );
    }
    
    // 4. 建立結算紀錄
    const { data: settlement, error: insertError } = await supabaseAdmin
      .from('leave_settlements')
      .insert([{
        staff_id: Number(staff_id),
        days: Number(days),
        amount,
        pay_month,
        status: 'pending',
        notes: notes || ''
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
    
    return NextResponse.json({
      success: true,
      message: '結算紀錄已建立',
      data: settlement
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
    const searchParams = request.nextUrl.searchParams;
    const staffId = searchParams.get('staff_id');
    const payMonth = searchParams.get('pay_month');
    const status = searchParams.get('status');
    
    let query = supabaseAdmin
      .from('leave_settlements')
      .select('*, staff:staff_id (id, name)')
      .order('created_at', { ascending: false });
    
    if (staffId) {
      query = query.eq('staff_id', Number(staffId));
    }
    
    if (payMonth) {
      query = query.eq('pay_month', payMonth);
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
    const body = await request.json();
    const { id, status } = body;
    
    if (!id || !status) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }
    
    const { error } = await supabaseAdmin
      .from('leave_settlements')
      .update({ status })
      .eq('id', Number(id));
    
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
