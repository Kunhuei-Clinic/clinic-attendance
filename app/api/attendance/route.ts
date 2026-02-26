import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

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
    const selectedRole = searchParams.get('selectedRole') || 'all';

    // 🟢 多租戶：先取得該診所的員工列表 (用於篩選)
    const { data: staffList } = await supabaseAdmin
      .from('staff')
      .select('id, name, role')
      .eq('clinic_id', clinicId); // 只查詢該診所的員工

    // 🟢 多租戶：建立查詢，強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('attendance_logs')
      .select('*')
      .eq('clinic_id', clinicId) // 只查詢該診所的考勤紀錄
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
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

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

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id')
      .eq('id', staffId)
      .eq('clinic_id', clinicId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    // 計算時間
    // 🟢 修正時區問題：強制指定為台灣時間 (UTC+8)
    // 使用 +08:00 時區後綴，確保無論伺服器在哪個時區，都能正確將台灣時間轉換為 UTC
    // 範例：2025-01-22T09:00:00+08:00 會被正確轉換為 UTC 時間 (01:00) 存入資料庫
    const startDateTime = new Date(`${date}T${startTime}:00+08:00`);
    let endDateTime = null;
    let workHours = 0;

    if (endTime) {
      endDateTime = new Date(`${date}T${endTime}:00+08:00`);
      workHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    }

    // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
    const payload = {
      staff_id: staffId,
      staff_name: staffName,
      clock_in_time: startDateTime.toISOString(),
      clock_out_time: endDateTime ? endDateTime.toISOString() : null,
      work_type: workType || '正常班',
      work_hours: workHours > 0 ? workHours : 0,
      note: note || null,
      status: endDateTime ? 'completed' : 'pending',
      clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
    };

    let error;
    if (id) {
      // 🟢 多租戶：更新時也要驗證該紀錄屬於當前診所
      const { data: existingLog } = await supabaseAdmin
        .from('attendance_logs')
        .select('id, clinic_id')
        .eq('id', id)
        .eq('clinic_id', clinicId)
        .single();

      if (!existingLog) {
        return NextResponse.json(
          { success: false, message: '找不到該紀錄或無權限操作' },
          { status: 403 }
        );
      }

      // 更新
      const { error: updateError } = await supabaseAdmin
        .from('attendance_logs')
        .update(payload)
        .eq('id', id)
        .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的紀錄
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
 * PATCH /api/attendance
 * 更新考勤紀錄（部分更新，例如加班審核）
 * 
 * Request Body:
 *   {
 *     id: number (required),
 *     overtime_status?: 'pending' | 'approved' | 'rejected',
 *     anomaly_reason?: string,
 *     ... (其他可更新欄位)
 *   }
 * 
 * Response: { success: boolean, message?: string }
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
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少紀錄 ID' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：驗證該紀錄屬於當前診所
    const { data: existingLog } = await supabaseAdmin
      .from('attendance_logs')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single();

    if (!existingLog) {
      return NextResponse.json(
        { success: false, message: '找不到該紀錄或無權限操作' },
        { status: 403 }
      );
    }

    // 更新欄位（移除 clinic_id，不允許前端修改）
    const { clinic_id, ...safeUpdateFields } = updateFields;

    const { error } = await supabaseAdmin
      .from('attendance_logs')
      .update(safeUpdateFields)
      .eq('id', id)
      .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的紀錄

    if (error) {
      console.error('Update attendance log error:', error);
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
    console.error('Attendance PATCH API Error:', error);
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

    // 🟢 多租戶：刪除時也要驗證該紀錄屬於當前診所
    const { error } = await supabaseAdmin
      .from('attendance_logs')
      .delete()
        .eq('id', id)
      .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的紀錄

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
