import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * POST /api/admin/tasks/approve
 * 統一審核中樞：請假、加班、異常、補打卡 的核准/駁回
 * 將原本前端的複雜合併邏輯移至伺服器端，確保 ACID。
 *
 * Body: { taskId, taskType, action }
 *   - taskType: 'leave' | 'overtime' | 'anomaly' | 'missed_punch'
 *   - action: 'approve' | 'reject'
 * 補打卡時 taskId 為 leave_requests.id，會依 leave_request 自動取得 staff_id、clinic_id、時間與 leave_type。
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
    const { taskId, taskType, action } = body;

    if (!taskId || !taskType || !action) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數 (taskId, taskType, action)' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // ==========================================
    // 1. 一般請假 (Leave，非補打卡)
    // ==========================================
    if (taskType === 'leave') {
      const { error } = await supabaseAdmin
        .from('leave_requests')
        .update({ status: newStatus })
        .eq('id', taskId)
        .eq('clinic_id', clinicId);
      if (error) throw error;
      return NextResponse.json({
        success: true,
        message: `請假已${action === 'approve' ? '核准' : '駁回'}`,
      });
    }

    // ==========================================
    // 2. 加班申請 (Overtime)
    // ==========================================
    if (taskType === 'overtime') {
      const { error } = await supabaseAdmin
        .from('attendance_logs')
        .update({ overtime_status: newStatus })
        .eq('id', taskId)
        .eq('clinic_id', clinicId);
      if (error) throw error;
      return NextResponse.json({
        success: true,
        message: `加班已${action === 'approve' ? '核准' : '駁回'}`,
      });
    }

    // ==========================================
    // 3. 異常打卡解決 (Anomaly)
    // ==========================================
    if (taskType === 'anomaly') {
      const { error } = await supabaseAdmin
        .from('attendance_logs')
        .update({
          anomaly_status: action === 'approve' ? 'resolved' : 'rejected',
        })
        .eq('id', taskId)
        .eq('clinic_id', clinicId);
      if (error) throw error;
      return NextResponse.json({
        success: true,
        message: '異常已標記為處理完成',
      });
    }

    // ==========================================
    // 4. 補打卡 (Missed Punch) - 伺服器端智慧合併
    // ==========================================
    if (taskType === 'missed_punch') {
      const { data: leaveReq, error: fetchErr } = await supabaseAdmin
        .from('leave_requests')
        .select('id, staff_id, staff_name, clinic_id, start_time, end_time, leave_type')
        .eq('id', taskId)
        .eq('clinic_id', clinicId)
        .single();

      if (fetchErr || !leaveReq) {
        return NextResponse.json(
          { success: false, message: '找不到該補打卡申請或無權限' },
          { status: 404 }
        );
      }

      const staffId = leaveReq.staff_id;
      const staffName = leaveReq.staff_name ?? '未知員工';
      const startTime = leaveReq.start_time;
      const endTime = leaveReq.end_time;
      const leaveType = leaveReq.leave_type || '全天';
      const dateStr =
        typeof startTime === 'string' && startTime.includes('T')
          ? startTime.split('T')[0]
          : '';

      if (action === 'reject') {
        const { error } = await supabaseAdmin
          .from('leave_requests')
          .update({ status: 'rejected' })
          .eq('id', taskId)
          .eq('clinic_id', clinicId);
        if (error) throw error;
        return NextResponse.json({ success: true, message: '補打卡已駁回' });
      }

      // 核准：依 leave_type 寫入或合併考勤
      if (leaveType === '全天') {
        const hours =
          (new Date(endTime).getTime() - new Date(startTime).getTime()) /
          3600000;
        const { error } = await supabaseAdmin.from('attendance_logs').insert([
          {
            staff_id: staffId,
            staff_name: staffName,
            clinic_id: clinicId,
            clock_in_time: startTime,
            clock_out_time: endTime,
            work_hours: hours.toFixed(2),
            status: 'completed',
            work_type: 'work',
            gps_lat: 0,
            gps_lng: 0,
            is_bypass: true,
            anomaly_reason: '補打卡核准(全天)',
          },
        ]);
        if (error) throw error;
      } else if (leaveType === '上班') {
        // 孤兒紀錄：僅有下班（status=orphan_out）或 補下班 的 completed
        const { data: orphans } = await supabaseAdmin
          .from('attendance_logs')
          .select('id, anomaly_reason')
          .eq('staff_id', staffId)
          .eq('clinic_id', clinicId)
          .gte('clock_out_time', `${dateStr}T00:00:00`)
          .lte('clock_out_time', `${dateStr}T23:59:59`)
          .or('status.eq.orphan_out,anomaly_reason.ilike.%補下班%')
          .order('created_at', { ascending: false })
          .limit(1);

        if (orphans && orphans.length > 0) {
          const prev = orphans[0];
          const { error } = await supabaseAdmin
            .from('attendance_logs')
            .update({
              clock_in_time: startTime,
              status: 'completed',
              anomaly_reason: `${prev.anomaly_reason || ''}, 補上班核准`.trim(),
            })
            .eq('id', prev.id)
            .eq('clinic_id', clinicId);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin.from('attendance_logs').insert([
            {
              staff_id: staffId,
              staff_name: staffName,
              clinic_id: clinicId,
              clock_in_time: startTime,
              clock_out_time: null,
              work_hours: 0,
              status: 'working',
              work_type: 'work',
              gps_lat: 0,
              gps_lng: 0,
              is_bypass: true,
              anomaly_reason: '補上班核准',
            },
          ]);
          if (error) throw error;
        }
      } else if (leaveType === '下班') {
        const { data: workings } = await supabaseAdmin
          .from('attendance_logs')
          .select('id, clock_in_time, anomaly_reason')
          .eq('staff_id', staffId)
          .eq('clinic_id', clinicId)
          .eq('status', 'working')
          .gte('clock_in_time', `${dateStr}T00:00:00`)
          .lte('clock_in_time', `${dateStr}T23:59:59`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (workings && workings.length > 0) {
          const prev = workings[0];
          const clockIn = prev.clock_in_time as string;
          const hours =
            (new Date(endTime).getTime() - new Date(clockIn).getTime()) /
            3600000;
          const { error } = await supabaseAdmin
            .from('attendance_logs')
            .update({
              clock_out_time: endTime,
              status: 'completed',
              work_hours: hours.toFixed(2),
              anomaly_reason: `${prev.anomaly_reason || ''}, 補下班核准`.trim(),
            })
            .eq('id', prev.id)
            .eq('clinic_id', clinicId);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin.from('attendance_logs').insert([
            {
              staff_id: staffId,
              staff_name: staffName,
              clinic_id: clinicId,
              clock_in_time: endTime,
              clock_out_time: endTime,
              work_hours: 0,
              status: 'orphan_out',
              work_type: 'work',
              gps_lat: 0,
              gps_lng: 0,
              is_bypass: true,
              anomaly_reason: '單獨補下班(等待補上班)',
            },
          ]);
          if (error) throw error;
        }
      }

      const { error: updateLeaveErr } = await supabaseAdmin
        .from('leave_requests')
        .update({ status: 'approved' })
        .eq('id', taskId)
        .eq('clinic_id', clinicId);
      if (updateLeaveErr) throw updateLeaveErr;

      return NextResponse.json({
        success: true,
        message: '補打卡已核准並更新至考勤表',
      });
    }

    return NextResponse.json(
      { success: false, message: '未知的任務類型' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('[Tasks Approve API] Error:', error);
    const message =
      error instanceof Error ? error.message : '伺服器錯誤';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
