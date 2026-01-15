import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
    const searchParams = request.nextUrl.searchParams;
    const useDateFilter = searchParams.get('useDateFilter') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const selectedStaffId = searchParams.get('selectedStaffId') || 'all';
    const statusFilter = searchParams.get('statusFilter') || 'all';

    let query = supabaseAdmin
      .from('leave_requests')
      .select('*')
      .order('start_time', { ascending: false });

    if (useDateFilter && startDate && endDate) {
      query = query
        .lte('start_time', `${endDate}T23:59:59`)
        .gte('end_time', `${startDate}T00:00:00`);
    }

    if (selectedStaffId !== 'all') {
      query = query.eq('staff_id', Number(selectedStaffId));
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
 * Request Body:
 *   {
 *     staff_id: number,
 *     staff_name: string,
 *     type: string,
 *     date: string (YYYY-MM-DD),
 *     start_time: string (HH:mm),
 *     end_time: string (HH:mm),
 *     hours: number,
 *     reason?: string,
 *     status?: string
 *   }
 */
export async function POST(request: NextRequest) {
  try {
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
      status
    } = body;

    if (!staff_id || !staff_name || !type || !date || !start_time || !end_time) {
      return NextResponse.json(
        { success: false, message: '請填寫完整資訊' },
        { status: 400 }
      );
    }

    const startFull = `${date}T${start_time}:00`;
    const endFull = `${date}T${end_time}:00`;

    const { error } = await supabaseAdmin
      .from('leave_requests')
      .insert([{
        staff_id: Number(staff_id),
        staff_name,
        type,
        start_time: startFull,
        end_time: endFull,
        hours: Number(hours) || 0,
        reason: reason || '',
        status: status || 'approved'
      }]);

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
 *     id: number,
 *     status: 'pending' | 'approved' | 'rejected'
 *   }
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
      .from('leave_requests')
      .update({ status })
      .eq('id', Number(id));

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
 *   - id: number (required)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少紀錄 ID' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('leave_requests')
      .delete()
      .eq('id', Number(id));

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
