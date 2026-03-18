import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * POST /api/attendance/punch
 * 處理補打卡核准後的考勤記錄操作
 * 
 * Request Body:
 *   {
 *     type: 'full' | 'clock_in' | 'clock_out',
 *     staff_name: string,
 *     date: string (YYYY-MM-DD),
 *     start_time: string (ISO datetime),
 *     end_time?: string (ISO datetime),
 *     action: 'insert' | 'update',
 *     target_id?: number (update 時需要)
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
    const { type, staff_name, date, start_time, end_time, action, target_id, anomaly_reason } = body;

    if (!type || !staff_name || !date || !start_time || !action) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id')
      .eq('name', staff_name)
      .eq('clinic_id', clinicId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    if (action === 'insert') {
      // 新增考勤記錄
      const startTime = new Date(start_time);
      const endTimeObj = end_time ? new Date(end_time) : null;
      const hours = endTimeObj 
        ? (endTimeObj.getTime() - startTime.getTime()) / 3600000 
        : 0;

      // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
      const payload: any = {
        staff_id: staff.id,
        staff_name,
        clock_in_time: start_time,
        clock_out_time: end_time || null,
        work_hours: hours > 0 ? hours.toFixed(2) : 0,
        status: endTimeObj ? 'completed' : 'working',
        work_type: 'work',
        gps_lat: 0,
        gps_lng: 0,
        is_bypass: true,
        anomaly_reason: anomaly_reason || '',
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      };

      const { error } = await supabaseAdmin
        .from('attendance_logs')
        .insert([payload]);

      if (error) {
        console.error('Insert attendance log error:', error);
        return NextResponse.json(
          { success: false, message: `新增失敗: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '新增成功'
      });
    } else if (action === 'update' && target_id) {
      // 🟢 多租戶：更新考勤記錄時也要驗證該紀錄屬於當前診所
      const { data: existing } = await supabaseAdmin
        .from('attendance_logs')
        .select('*')
        .eq('id', target_id)
        .eq('clinic_id', clinicId) // 🟢 確保只查詢該診所的紀錄
        .is('deleted_at', null)
        .single();

      if (!existing) {
        return NextResponse.json(
          { success: false, message: '找不到要更新的記錄或無權限操作' },
          { status: 403 }
        );
      }

      const startTime = new Date(start_time);
      const finalEndTime = end_time || existing.clock_out_time;
      const endTimeObj = finalEndTime ? new Date(finalEndTime) : null;
      const hours = endTimeObj 
        ? (endTimeObj.getTime() - startTime.getTime()) / 3600000 
        : 0;

      const updatePayload: any = {
        clock_in_time: start_time,
        work_hours: hours > 0 ? hours.toFixed(2) : 0,
        anomaly_reason: anomaly_reason || existing.anomaly_reason || ''
      };

      if (end_time) {
        updatePayload.clock_out_time = end_time;
      } else if (existing.clock_out_time) {
        updatePayload.clock_out_time = existing.clock_out_time;
      }

      if (updatePayload.clock_out_time) {
        updatePayload.status = 'completed';
      } else {
        updatePayload.status = 'working';
      }

      // 🟢 多租戶：更新時也要驗證該紀錄屬於當前診所
      const { error } = await supabaseAdmin
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', target_id)
        .eq('clinic_id', clinicId) // 🟢 確保只更新該診所的紀錄
        .is('deleted_at', null);

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
    } else {
      return NextResponse.json(
        { success: false, message: '無效的操作類型' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Attendance Punch API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/attendance/punch
 * 查詢特定日期的考勤記錄（用於補打卡媒合）
 */
export async function GET(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { data: null, error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const staff_name = searchParams.get('staff_name');
    const date = searchParams.get('date');
    const type = searchParams.get('type'); // 'orphan' | 'working'

    if (!staff_name || !date || !type) {
      return NextResponse.json(
        { data: null, error: '缺少必要參數' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('attendance_logs')
      .select('*')
      .eq('staff_name', staff_name)
      .eq('clinic_id', clinicId) // 只查詢該診所的考勤紀錄
      .is('deleted_at', null);

    if (type === 'orphan') {
      // 查找孤兒記錄（只有下班，clock_in = clock_out）
      query = query
        .gte('clock_out_time', `${date}T00:00:00`)
        .lte('clock_out_time', `${date}T23:59:59`)
        .eq('status', 'completed')
        .like('anomaly_reason', '%補下班%');
    } else if (type === 'working') {
      // 查找 working 狀態的記錄
      query = query
        .gte('clock_in_time', `${date}T00:00:00`)
        .lte('clock_in_time', `${date}T23:59:59`)
        .eq('status', 'working')
        .is('clock_out_time', null);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Fetch attendance log error:', error);
      return NextResponse.json(
        { data: null, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || null });
  } catch (error: any) {
    console.error('Attendance Punch GET API Error:', error);
    return NextResponse.json(
      { data: null, error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
