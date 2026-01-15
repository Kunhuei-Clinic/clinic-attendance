import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
    const body = await request.json();
    const { type, staff_name, date, start_time, end_time, action, target_id, anomaly_reason } = body;

    if (!type || !staff_name || !date || !start_time || !action) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    if (action === 'insert') {
      // 新增考勤記錄
      const startTime = new Date(start_time);
      const endTimeObj = end_time ? new Date(end_time) : null;
      const hours = endTimeObj 
        ? (endTimeObj.getTime() - startTime.getTime()) / 3600000 
        : 0;

      const payload: any = {
        staff_name,
        clock_in_time: start_time,
        clock_out_time: end_time || null,
        work_hours: hours > 0 ? hours.toFixed(2) : 0,
        status: endTimeObj ? 'completed' : 'working',
        work_type: 'work',
        gps_lat: 0,
        gps_lng: 0,
        is_bypass: true,
        anomaly_reason: anomaly_reason || ''
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
      // 更新考勤記錄
      // 先取得現有記錄
      const { data: existing } = await supabaseAdmin
        .from('attendance_logs')
        .select('*')
        .eq('id', target_id)
        .single();

      if (!existing) {
        return NextResponse.json(
          { success: false, message: '找不到要更新的記錄' },
          { status: 404 }
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

      const { error } = await supabaseAdmin
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', target_id);

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

    let query = supabaseAdmin
      .from('attendance_logs')
      .select('*')
      .eq('staff_name', staff_name);

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
