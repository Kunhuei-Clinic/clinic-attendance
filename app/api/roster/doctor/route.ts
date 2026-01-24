import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/roster/doctor
 * 查詢醫師排班表
 * 
 * Query Parameters:
 *   - year: number (optional, 與 startDate/endDate 二選一)
 *   - month: number (optional, 與 startDate/endDate 二選一)
 *   - startDate: string (YYYY-MM-DD, optional, 日期範圍查詢起始)
 *   - endDate: string (YYYY-MM-DD, optional, 日期範圍查詢結束)
 * 
 * Response: { data: DoctorRoster[], error?: string }
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
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const doctorId = searchParams.get('doctor_id');

    // 🟢 多租戶：強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('doctor_roster')
      .select('*')
      .eq('clinic_id', clinicId); // 只查詢該診所的醫師班表

    // 支援 doctor_id 過濾
    if (doctorId) {
      query = query.eq('doctor_id', Number(doctorId));
    }

    // 支援日期範圍查詢（用於 DoctorRosterPrint）
    if (startDate && endDate) {
      query = query.gte('date', startDate).lte('date', endDate);
    } 
    // 支援月份查詢（原有功能）
    else if (year && month) {
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonthDate = new Date(Number(year), Number(month), 1);
      const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
      query = query.gte('date', start).lt('date', nextMonth);
    } else if (!doctorId) {
      // 如果沒有日期參數也沒有 doctor_id，返回錯誤
      return NextResponse.json(
        { data: [], error: '缺少必要參數（year/month 或 startDate/endDate 或 doctor_id）' },
        { status: 400 }
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch doctor roster error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Doctor roster API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/roster/doctor
 * 新增或更新醫師排班
 * 
 * Request Body:
 *   {
 *     id?: number (更新時提供),
 *     doctor_id: number,
 *     date: string (YYYY-MM-DD),
 *     shift_code: string,
 *     start_time: string (HH:mm),
 *     end_time: string (HH:mm),
 *     special_tags?: string[],
 *     is_dedicated?: boolean,
 *     is_substitution?: boolean
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
    const {
      id,
      doctor_id,
      date,
      shift_code,
      start_time,
      end_time,
      special_tags,
      is_dedicated,
      is_substitution
    } = body;

    if (!doctor_id || !date || !shift_code || !start_time || !end_time) {
      return NextResponse.json(
        { success: false, message: '缺少必要欄位' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：驗證該醫師是否屬於當前診所
    const { data: doctor } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id')
      .eq('id', Number(doctor_id))
      .eq('clinic_id', clinicId)
      .eq('role', '醫師')
      .single();

    if (!doctor) {
      return NextResponse.json(
        { success: false, message: '找不到該醫師或無權限操作' },
        { status: 403 }
      );
    }

    // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
    const payload = {
      doctor_id: Number(doctor_id),
      date,
      shift_code,
      start_time,
      end_time,
      special_tags: special_tags || [],
      is_dedicated: is_dedicated || false,
      is_substitution: is_substitution || false,
      clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
    };

    let error;
    if (id) {
      // 🟢 多租戶：更新時也要驗證該紀錄屬於當前診所
      const { data: existing } = await supabaseAdmin
        .from('doctor_roster')
        .select('id, clinic_id')
        .eq('id', id)
        .eq('clinic_id', clinicId)
        .single();

      if (!existing) {
        return NextResponse.json(
          { success: false, message: '找不到該紀錄或無權限操作' },
          { status: 403 }
        );
      }

      // 更新
      const { error: updateError } = await supabaseAdmin
        .from('doctor_roster')
        .update(payload)
        .eq('id', id)
        .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的紀錄
      error = updateError;
    } else {
      // 新增 (upsert)
      const { error: upsertError } = await supabaseAdmin
        .from('doctor_roster')
        .upsert(payload, { onConflict: 'doctor_id, date, shift_code' });
      error = upsertError;
    }

    if (error) {
      console.error('Save doctor roster error:', error);
      return NextResponse.json(
        { success: false, message: `儲存失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: id ? '更新成功' : '新增成功'
    });
  } catch (error: any) {
    console.error('Doctor roster POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/roster/doctor
 * 刪除醫師排班
 * 
 * Query Parameters:
 *   - id: number (單筆刪除)
 *   - start: string (批次刪除起始日期, YYYY-MM-DD)
 *   - end: string (批次刪除結束日期, YYYY-MM-DD)
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
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    let error;
    if (id) {
      // 🟢 多租戶：單筆刪除時也要驗證該紀錄屬於當前診所
      const { error: deleteError } = await supabaseAdmin
        .from('doctor_roster')
        .delete()
        .eq('id', Number(id))
        .eq('clinic_id', clinicId); // 🟢 確保只刪除該診所的紀錄
      error = deleteError;
    } else if (start && end) {
      // 🟢 多租戶：批次刪除時也要加上 clinic_id 過濾
      const { error: batchError } = await supabaseAdmin
        .from('doctor_roster')
        .delete()
        .eq('clinic_id', clinicId) // 🟢 確保只刪除該診所的紀錄
        .gte('date', start)
        .lte('date', end);
      error = batchError;
    } else {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    if (error) {
      console.error('Delete doctor roster error:', error);
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
    console.error('Doctor roster DELETE API Error:', error);
    return NextResponse.json(
      { success: false, message: `刪除失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/roster/doctor
 * 批次複製醫師排班
 * 
 * Request Body:
 *   {
 *     sourceStart: string (YYYY-MM-DD),
 *     targetStart: string (YYYY-MM-DD),
 *     days: number
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
    const { sourceStart, targetStart, days } = body;

    if (!sourceStart || !targetStart || !days) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    // 取得來源資料（加上 clinic_id 過濾）
    const sourceEnd = new Date(sourceStart);
    sourceEnd.setDate(sourceEnd.getDate() + days);
    const sourceEndStr = sourceEnd.toISOString().split('T')[0];

    // 🟢 多租戶：只查詢該診所的資料
    const { data: sourceData, error: fetchError } = await supabaseAdmin
      .from('doctor_roster')
      .select('*')
      .eq('clinic_id', clinicId) // 🟢 確保只查詢該診所的資料
      .gte('date', sourceStart)
      .lt('date', sourceEndStr);

    if (fetchError) {
      return NextResponse.json(
        { success: false, message: `讀取來源資料失敗: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!sourceData || sourceData.length === 0) {
      return NextResponse.json(
        { success: false, message: '無資料可複製' },
        { status: 400 }
      );
    }

    // 計算日期差
    const sDate = new Date(sourceStart);
    const tDate = new Date(targetStart);
    const diffDays = Math.round((tDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24));

    // 🟢 多租戶：產生新資料時也要包含 clinic_id
    const newEntries = sourceData.map(src => {
      const originalDate = new Date(src.date);
      const newDate = new Date(originalDate);
      newDate.setDate(newDate.getDate() + diffDays);
      const newDateStr = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;

      return {
        doctor_id: src.doctor_id,
        date: newDateStr,
        shift_code: src.shift_code,
        start_time: src.start_time,
        end_time: src.end_time,
        special_tags: src.special_tags,
        is_dedicated: src.is_dedicated,
        is_substitution: src.is_substitution,
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      };
    });

    // 批次寫入
    const { error: upsertError } = await supabaseAdmin
      .from('doctor_roster')
      .upsert(newEntries, { onConflict: 'doctor_id, date, shift_code' });

    if (upsertError) {
      console.error('Batch copy error:', upsertError);
      return NextResponse.json(
        { success: false, message: `複製失敗: ${upsertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `已複製 ${newEntries.length} 筆資料`
    });
  } catch (error: any) {
    console.error('Doctor roster PATCH API Error:', error);
    return NextResponse.json(
      { success: false, message: `複製失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
