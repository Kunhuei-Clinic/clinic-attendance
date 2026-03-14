import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/leave
 * 查詢請假紀錄
 * 
 * Query Parameters:
 *   - useDateFilter: boolean (optional)
 *   - startDate: string (YYYY-MM-DD, optional)
 *   - endDate: string (YYYY-MM-DD, optional)
 *   - selectedStaffId: string | 'all' (optional)
 *   - statusFilter: string | 'all' (optional)
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
    const useDateFilter = searchParams.get('useDateFilter') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const selectedStaffId = searchParams.get('selectedStaffId') || 'all';
    const statusFilter = searchParams.get('statusFilter') || 'all';

    // 🟢 多租戶：強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('leave_requests')
      .select('*')
      .eq('clinic_id', clinicId) // 只查詢該診所的請假紀錄
      .order('start_time', { ascending: false });

    if (useDateFilter && startDate && endDate) {
      query = query
        .lte('start_time', `${endDate}T23:59:59`)
        .gte('end_time', `${startDate}T00:00:00`);
    }

    if (selectedStaffId !== 'all') {
      query = query.eq('staff_id', selectedStaffId);
    }

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (!useDateFilter && statusFilter === 'all' && selectedStaffId === 'all') {
      query = query.limit(200);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch leave requests error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Leave API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leave
 * 新增請假申請
 *
 * Request Body (格式一：同一天，用 date + HH:mm):
 *   { staff_id, staff_name, type, date (YYYY-MM-DD), start_time (HH:mm), end_time (HH:mm), hours?, reason?, status?, leave_type? }
 *
 * Request Body (格式二：跨日或已有完整時間，用 ISO):
 *   { staff_id, staff_name, type, start_time (ISO), end_time (ISO), hours?, reason?, status?, leave_type? }
 */
export async function POST(request: NextRequest) {
  try {
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      staff_id,
      staff_name,
      type,
      date,
      start_time,
      end_time,
      hours,
      reason,
      status,
      leave_type
    } = body;

    if (!staff_id || !staff_name || !type || !start_time || !end_time) {
      return NextResponse.json(
        { success: false, message: '請填寫完整資訊' },
        { status: 400 }
      );
    }

    const isIsoTime = typeof start_time === 'string' && start_time.includes('T');
    if (!isIsoTime && !date) {
      return NextResponse.json(
        { success: false, message: '請填寫日期或提供完整時間' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id')
      .eq('id', String(staff_id))
      .eq('clinic_id', clinicId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    // 同一天格式：date + HH:mm → 組合成 ISO 風格 YYYY-MM-DDTHH:mm:00
    const toFull = (d: string, t: string) =>
      `${d}T${String(t).slice(0, 5)}:00`;
    const startFull = isIsoTime ? start_time : toFull(date, start_time);
    const endFull = isIsoTime ? end_time : toFull(date, end_time);

    const insertPayload = {
      staff_id: String(staff_id),
      staff_name,
      type,
      start_time: startFull,
      end_time: endFull,
      hours: Number(hours) || 0,
      reason: reason || '',
      status: status || 'pending',
      clinic_id: clinicId,
      ...(leave_type != null && leave_type !== '' ? { leave_type: String(leave_type) } : {})
    };

    const { error } = await supabaseAdmin
      .from('leave_requests')
      .insert([insertPayload]);

    if (error) {
      console.error('Add leave request error:', error);
      return NextResponse.json(
        { success: false, message: `新增失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '新增成功'
    });
  } catch (error: any) {
    console.error('Leave POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leave
 * 更新請假紀錄狀態
 * 
 * Request Body:
 *   {
 *     id: string (UUID),
 *     status: 'pending' | 'approved' | 'rejected'
 *   }
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
      .from('leave_requests')
      .update({ status })
      .eq('id', String(id))
      .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的紀錄

    if (error) {
      console.error('Update leave request error:', error);
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
    console.error('Leave PATCH API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/leave
 * 刪除請假紀錄
 * 
 * Query Parameters:
 *   - id: string (UUID, required)
 */
export async function DELETE(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少紀錄 ID' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：刪除時也要驗證該紀錄屬於當前診所；id 保持 string (UUID)
    const { error } = await supabaseAdmin
      .from('leave_requests')
      .delete()
      .eq('id', String(id))
      .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的紀錄

    if (error) {
      console.error('Delete leave request error:', error);
      return NextResponse.json(
        { success: false, message: `刪除失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '刪除成功'
    });
  } catch (error: any) {
    console.error('Leave DELETE API Error:', error);
    return NextResponse.json(
      { success: false, message: `刪除失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
