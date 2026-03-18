import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/attendance/clock
 * 處理日常打卡（上班/下班）
 * 
 * Request Body:
 *   {
 *     action: 'in' | 'out',
 *     staffId: number,
 *     staffName: string,
 *     gpsLat?: number,
 *     gpsLng?: number,
 *     isBypass?: boolean,
 *     logId?: number (下班時需要，指定要更新的記錄 ID),
 *     applyOvertime?: boolean (下班時，是否申請加班)
 *   }
 * 
 * Response: { success: boolean, message?: string, data?: any }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      staffId,
      staffName,
      gpsLat,
      gpsLng,
      isBypass,
      logId,
      applyOvertime
    } = body;

    // 驗證必要欄位
    if (!action || !staffId || !staffName) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：從 staffId 查詢員工資料並取得 clinic_id
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, clinic_id, is_active')
      .eq('id', staffId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工' },
        { status: 404 }
      );
    }

    // 檢查員工是否啟用
    if (!staff.is_active) {
      return NextResponse.json(
        { success: false, message: '該員工帳號已停用' },
        { status: 403 }
      );
    }

    // 取得員工的 clinic_id
    const clinicId = staff.clinic_id;
    if (!clinicId) {
      return NextResponse.json(
        { success: false, message: '員工未關聯到診所' },
        { status: 400 }
      );
    }

    if (action === 'in') {
      // 上班打卡
      const now = new Date().toISOString();
      // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
      const payload: any = {
        staff_id: staffId,
        staff_name: staffName,
        clock_in_time: now,
        status: 'working',
        work_type: 'work',
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      };

      // 可選欄位
      if (gpsLat !== null && gpsLat !== undefined) payload.gps_lat = gpsLat;
      if (gpsLng !== null && gpsLng !== undefined) payload.gps_lng = gpsLng;
      if (isBypass !== undefined) payload.is_bypass = isBypass;

      const { data, error } = await supabaseAdmin
        .from('attendance_logs')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('Clock in error:', error);
        return NextResponse.json(
          { success: false, message: `打卡失敗: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '上班打卡成功！',
        data
      });

    } else if (action === 'out') {
      // 下班打卡
      if (!logId) {
        return NextResponse.json(
          { success: false, message: '缺少記錄 ID' },
          { status: 400 }
        );
      }

      // 🟢 多租戶：先取得現有記錄以計算工時，並驗證該紀錄屬於該員工的診所
      const { data: existing } = await supabaseAdmin
        .from('attendance_logs')
        .select('clock_in_time, clinic_id, staff_id')
        .eq('id', logId)
        .eq('clinic_id', clinicId) // 🟢 確保只查詢該診所的紀錄
        .eq('staff_id', staffId) // 🟢 確保是該員工的紀錄
        .is('deleted_at', null)
        .single();

      if (!existing) {
        return NextResponse.json(
          { success: false, message: '找不到上班紀錄或無權限操作' },
          { status: 403 }
        );
      }

      const now = new Date();
      const clockInTime = new Date(existing.clock_in_time);
      const workHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      // 🟢 修正：永遠優先寫入下班時間和工時
      const updatePayload: any = {
        clock_out_time: now.toISOString(),
        work_hours: workHours.toFixed(2),
        status: 'completed'
      };

      // 可選欄位
      if (gpsLat !== null && gpsLat !== undefined) updatePayload.gps_lat = gpsLat;
      if (gpsLng !== null && gpsLng !== undefined) updatePayload.gps_lng = gpsLng;
      if (isBypass !== undefined) updatePayload.is_bypass = isBypass;

      // 🟢 多租戶：先更新基本資料（永遠寫入）
      const { error: updateError } = await supabaseAdmin
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', logId)
        .eq('clinic_id', clinicId) // 🟢 確保只更新該診所的紀錄
        .is('deleted_at', null);

      if (updateError) {
        console.error('Clock out error:', updateError);
        return NextResponse.json(
          { success: false, message: `打卡失敗: ${updateError.message}` },
          { status: 500 }
        );
      }

      // 🟢 新增：處理加班標記（根據 applyOvertime）
      if (applyOvertime === true) {
        // 取得診所加班設定
        const { data: clinic } = await supabaseAdmin
          .from('clinics')
          .select('settings')
          .eq('id', clinicId)
          .single();

        const clinicSettings = clinic?.settings || {};
        const overtimeApprovalRequired = clinicSettings.overtime_approval_required ?? true;

        const overtimeUpdate: any = {
          is_overtime: true,
          overtime_status: overtimeApprovalRequired ? 'pending' : 'approved'
        };

        // 更新加班標記
        const { error: overtimeError } = await supabaseAdmin
          .from('attendance_logs')
          .update(overtimeUpdate)
          .eq('id', logId)
          .eq('clinic_id', clinicId)
          .is('deleted_at', null);

        if (overtimeError) {
          console.error('Update overtime status error:', overtimeError);
          // 不影響打卡成功，只記錄錯誤
        }
      } else if (applyOvertime === false) {
        // 明確標記為非加班
        const { error: overtimeError } = await supabaseAdmin
          .from('attendance_logs')
          .update({
            is_overtime: false,
            overtime_status: 'none'
          })
          .eq('id', logId)
          .eq('clinic_id', clinicId)
          .is('deleted_at', null);

        if (overtimeError) {
          console.error('Update overtime status error:', overtimeError);
        }
      }

      return NextResponse.json({
        success: true,
        message: applyOvertime ? '下班打卡成功！加班申請已送出。' : '下班打卡成功！',
        data: { workHours: workHours.toFixed(2) }
      });

    } else {
      return NextResponse.json(
        { success: false, message: '無效的操作類型' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Clock API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
