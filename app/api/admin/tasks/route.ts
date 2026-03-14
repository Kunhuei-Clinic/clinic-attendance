import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/admin/tasks
 * 聚合所有待審核事項
 * 
 * Response: { data: Task[] }
 * Task: { type: 'leave' | 'overtime' | 'anomaly', id, staff_name, date, description, ... }
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

    const tasks: any[] = [];

    // 1. 查詢待審核的請假申請
    const { data: leaveRequests, error: leaveError } = await supabaseAdmin
      .from('leave_requests')
      .select('id, staff_id, staff_name, type, leave_type, start_time, end_time, reason, status, created_at')
      .eq('clinic_id', clinicId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!leaveError && leaveRequests) {
      leaveRequests.forEach((req: any) => {
        const isMissedPunch = req.type === '補打卡';
        tasks.push({
          type: isMissedPunch ? 'missed_punch' : 'leave',
          id: req.id,
          staff_name: req.staff_name || '未知員工',
          date: req.start_time ? new Date(req.start_time).toISOString().split('T')[0] : '',
          description: isMissedPunch ? `補打卡 (${req.leave_type || '全天'})` : `${req.type} 申請`,
          start_time: req.start_time,
          end_time: req.end_time,
          reason: req.reason,
          status: req.status,
          leave_type: req.leave_type,
          created_at: req.created_at,
          _raw: req
        });
      });
    }

    // 2. 查詢待審核的異常打卡（有 anomaly_reason 且尚未處理的記錄）
    const { data: anomalyLogs, error: anomalyError } = await supabaseAdmin
      .from('attendance_logs')
      .select('id, staff_id, staff_name, clock_in_time, clock_out_time, work_hours, anomaly_reason, status')
      .eq('clinic_id', clinicId)
      .not('anomaly_reason', 'is', null)
      .neq('anomaly_reason', '')
      .order('clock_in_time', { ascending: false });

    if (!anomalyError && anomalyLogs) {
      anomalyLogs.forEach((log: any) => {
        const date = log.clock_in_time ? new Date(log.clock_in_time).toISOString().split('T')[0] : '';
        tasks.push({
          type: 'anomaly',
          id: log.id,
          staff_name: log.staff_name || '未知員工',
          date: date,
          description: `異常打卡：${log.anomaly_reason || '未說明原因'}`,
          clock_in_time: log.clock_in_time,
          clock_out_time: log.clock_out_time,
          work_hours: log.work_hours,
          anomaly_reason: log.anomaly_reason,
          status: log.status,
          // 保留原始資料供前端使用
          _raw: log
        });
      });
    }

    // 3. 🟢 新增：查詢待審核的加班申請
    const { data: overtimeLogs, error: overtimeError } = await supabaseAdmin
      .from('attendance_logs')
      .select('id, staff_id, staff_name, clock_in_time, clock_out_time, work_hours, is_overtime, overtime_status')
      .eq('clinic_id', clinicId)
      .eq('is_overtime', true)
      .eq('overtime_status', 'pending')
      .order('clock_in_time', { ascending: false });

    if (!overtimeError && overtimeLogs) {
      overtimeLogs.forEach((log: any) => {
        const date = log.clock_in_time ? new Date(log.clock_in_time).toISOString().split('T')[0] : '';
        const clockInTime = log.clock_in_time ? new Date(log.clock_in_time) : null;
        const clockOutTime = log.clock_out_time ? new Date(log.clock_out_time) : null;
        const workHours = log.work_hours ? Number(log.work_hours) : 0;
        
        // 計算加班時數（超過正常工時的部分）
        const normalHours = 8; // 假設正常工時為 8 小時
        const overtimeHours = Math.max(0, workHours - normalHours);

        tasks.push({
          type: 'overtime',
          id: log.id,
          staff_name: log.staff_name || '未知員工',
          date: date,
          description: `加班申請：工時 ${workHours.toFixed(1)} 小時`,
          clock_in_time: log.clock_in_time,
          clock_out_time: log.clock_out_time,
          work_hours: workHours,
          overtime_hours: overtimeHours,
          status: log.overtime_status,
          // 保留原始資料供前端使用
          _raw: log
        });
      });
    }

    // 按建立時間排序（最新的在前）
    tasks.sort((a, b) => {
      const dateA = new Date(a.created_at || a.clock_in_time || a.start_time || 0).getTime();
      const dateB = new Date(b.created_at || b.clock_in_time || b.start_time || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ data: tasks });
  } catch (error: any) {
    console.error('Tasks API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
