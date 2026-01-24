import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

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
 *     logId?: number (下班時需要，指定要更新的記錄 ID)
 *   }
 * 
 * Response: { success: boolean, message?: string, data?: any }
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
      action,
      staffId,
      staffName,
      gpsLat,
      gpsLng,
      isBypass,
      logId
    } = body;

    // 驗證必要欄位
    if (!action || !staffId || !staffName) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id')
      .eq('id', Number(staffId))
      .eq('clinic_id', clinicId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    if (action === 'in') {
      // 上班打卡
      const now = new Date().toISOString();
      // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
      const payload: any = {
        staff_id: Number(staffId),
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

      // 🟢 多租戶：先取得現有記錄以計算工時，並驗證該紀錄屬於當前診所
      const { data: existing } = await supabaseAdmin
        .from('attendance_logs')
        .select('clock_in_time, clinic_id')
        .eq('id', logId)
        .eq('clinic_id', clinicId) // 🟢 確保只查詢該診所的紀錄
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

      const updatePayload: any = {
        clock_out_time: now.toISOString(),
        work_hours: workHours.toFixed(2),
        status: 'completed'
      };

      // 可選欄位
      if (gpsLat !== null && gpsLat !== undefined) updatePayload.gps_lat = gpsLat;
      if (gpsLng !== null && gpsLng !== undefined) updatePayload.gps_lng = gpsLng;
      if (isBypass !== undefined) updatePayload.is_bypass = isBypass;

      // 🟢 多租戶：更新時也要驗證該紀錄屬於當前診所
      const { error } = await supabaseAdmin
        .from('attendance_logs')
        .update(updatePayload)
        .eq('id', logId)
        .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的紀錄

      if (error) {
        console.error('Clock out error:', error);
        return NextResponse.json(
          { success: false, message: `打卡失敗: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '下班打卡成功！',
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
