import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/attendance
 * 查詢考勤紀錄
 * 
 * Query Parameters:
 *   - useDateFilter: boolean (optional)
 *   - startDate: string (YYYY-MM-DD, optional)
 *   - endDate: string (YYYY-MM-DD, optional)
 *   - selectedStaffId: string | 'all' (optional)
 *   - selectedRole: string | 'all' (optional)
 * 
 * Response: { data: AttendanceLog[], error?: string }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const useDateFilter = searchParams.get('useDateFilter') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const selectedStaffId = searchParams.get('selectedStaffId') || 'all';
    const selectedRole = searchParams.get('selectedRole') || 'all';

    // 先取得員工列表 (用於篩選)
    const { data: staffList } = await supabaseAdmin
      .from('staff')
      .select('id, name, role')
      .order('id');

    // 建立查詢
    let query = supabaseAdmin
      .from('attendance_logs')
      .select('*')
      .order('clock_in_time', { ascending: false });

    // 日期篩選
    if (useDateFilter && startDate && endDate) {
      query = query
        .gte('clock_in_time', `${startDate}T00:00:00`)
        .lte('clock_in_time', `${endDate}T23:59:59`);
    } else {
      // 未使用日期篩選時，限制筆數
      query = query.limit(300);
    }

    // 姓名/職位篩選
    if (selectedStaffId !== 'all') {
      const target = staffList?.find(s => String(s.id) === selectedStaffId);
      if (target) {
        query = query.eq('staff_name', target.name);
      } else {
        query = query.eq('staff_name', 'NO_MATCH'); // 無結果
      }
    } else if (selectedRole !== 'all') {
      const targetNames = staffList
        ?.filter(s => (s.role || '未分類') === selectedRole)
        .map(s => s.name) || [];
      
      if (targetNames.length > 0) {
        query = query.in('staff_name', targetNames);
      } else {
        query = query.eq('staff_name', 'NO_MATCH'); // 無結果
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch attendance logs error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Attendance API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/attendance
 * 新增或更新考勤紀錄 (補打卡)
 * 
 * Request Body:
 *   {
 *     id?: number (編輯時提供),
 *     staffId: number,
 *     staffName: string,
 *     date: string (YYYY-MM-DD),
 *     startTime: string (HH:mm),
 *     endTime?: string (HH:mm),
 *     workType: string,
 *     note?: string
 *   }
 * 
 * Response: { success: boolean, message?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      staffId,
      staffName,
      date,
      startTime,
      endTime,
      workType,
      note
    } = body;

    // 驗證必要欄位
    if (!staffId || !staffName || !date || !startTime) {
      return NextResponse.json(
        { success: false, message: '請填寫完整資訊' },
        { status: 400 }
      );
    }

    // 計算時間
    const startDateTime = new Date(`${date}T${startTime}:00`);
    let endDateTime = null;
    let workHours = 0;

    if (endTime) {
      endDateTime = new Date(`${date}T${endTime}:00`);
      workHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    }

    const payload = {
      staff_id: Number(staffId),
      staff_name: staffName,
      clock_in_time: startDateTime.toISOString(),
      clock_out_time: endDateTime ? endDateTime.toISOString() : null,
      work_type: workType || '正常班',
      work_hours: workHours > 0 ? workHours : 0,
      note: note || null,
      status: endDateTime ? 'completed' : 'pending'
    };

    let error;
    if (id) {
      // 更新
      const { error: updateError } = await supabaseAdmin
        .from('attendance_logs')
        .update(payload)
        .eq('id', id);
      error = updateError;
    } else {
      // 新增
      const { error: insertError } = await supabaseAdmin
        .from('attendance_logs')
        .insert(payload);
      error = insertError;
    }

    if (error) {
      console.error('Save attendance log error:', error);
      return NextResponse.json(
        { success: false, message: `儲存失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: id ? '修改成功！' : '補打卡成功！'
    });
  } catch (error: any) {
    console.error('Attendance POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/attendance
 * 刪除考勤紀錄
 * 
 * Query Parameters:
 *   - id: number (required)
 * 
 * Response: { success: boolean, message?: string }
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
      .from('attendance_logs')
      .delete()
      .eq('id', Number(id));

    if (error) {
      console.error('Delete attendance log error:', error);
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
    console.error('Attendance DELETE API Error:', error);
    return NextResponse.json(
      { success: false, message: `刪除失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
