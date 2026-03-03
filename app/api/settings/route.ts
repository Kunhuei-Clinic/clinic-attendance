import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/settings
 * 取得系統設定
 * 
 * Query Parameters:
 *   - key: string (optional, 取得特定設定)
 *   - type: 'clinic' (optional, 取得診所設定 clinics.settings)
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
    const type = searchParams.get('type');
    const key = searchParams.get('key');

    // 🟢 新增：取得診所設定 (clinics.settings)
    if (type === 'clinic') {
      const { data: clinic, error: clinicError } = await supabaseAdmin
        .from('clinics')
        .select('settings')
        .eq('id', clinicId)
        .single();

      if (clinicError) {
        console.error('Fetch clinic settings error:', clinicError);
        return NextResponse.json(
          { data: {}, error: clinicError.message },
          { status: 500 }
        );
      }

      // 確保有預設值
      const settings = clinic?.settings || {};
      const defaultSettings = {
        overtime_threshold: settings.overtime_threshold ?? 9,
        overtime_approval_required: settings.overtime_approval_required ?? true
      };

      return NextResponse.json({ 
        data: { ...settings, ...defaultSettings }
      });
    }

    // 原有的 system_settings 查詢邏輯
    // 🟢 多租戶：強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('system_settings')
      .select('*')
      .eq('clinic_id', clinicId); // 只查詢該診所的設定
      
    if (key) {
      query = query.eq('key', key);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch settings error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Settings API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings
 * 更新系統設定
 * 
 * Request Body:
 *   [
 *     { key: string, value: string },
 *     ... 
 *   ]
 *   或單一物件 { key: string, value: string }
 *   (不包含 clinic_id，由後端自動填入)
 * 
 * 或更新診所設定 (clinics.settings):
 *   { type: 'clinic', settings: { overtime_threshold: 9, overtime_approval_required: true } }
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

    // 🟢 新增：處理診所設定 (clinics.settings)
    if (body.type === 'clinic' && body.settings) {
      // 取得現有設定
      const { data: clinic, error: fetchError } = await supabaseAdmin
        .from('clinics')
        .select('settings')
        .eq('id', clinicId)
        .single();

      if (fetchError) {
        console.error('Fetch clinic settings error:', fetchError);
        return NextResponse.json(
          { success: false, message: `讀取設定失敗: ${fetchError.message}` },
          { status: 500 }
        );
      }

      // 合併設定
      const currentSettings = clinic?.settings || {};
      const updatedSettings = {
        ...currentSettings,
        ...body.settings
      };

      // 更新診所設定
      const { error: updateError } = await supabaseAdmin
        .from('clinics')
        .update({ settings: updatedSettings })
        .eq('id', clinicId);

      if (updateError) {
        console.error('Update clinic settings error:', updateError);
        return NextResponse.json(
          { success: false, message: `儲存失敗: ${updateError.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '診所設定已更新'
      });
    }

    // 原有的 system_settings 更新邏輯
    const rawUpdates = Array.isArray(body) ? body : [body];

    // 🟢 多租戶：移除前端可能傳入的 clinic_id，由後端自動填入
    const updates = rawUpdates.map((item: any) => {
      const { clinic_id, ...rest } = item;
      return { ...rest, clinic_id: clinicId };
    });

    // 🟢 使用安全迴圈取代 upsert，避免 onConflict 報錯
    for (const update of updates) {
      const { data: existing } = await supabaseAdmin
        .from('system_settings')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('key', update.key)
        .single();

      if (existing) {
        const { error } = await supabaseAdmin
          .from('system_settings')
          .update({ value: update.value })
          .eq('id', existing.id);
        if (error) {
          console.error('Update settings error:', error);
          return NextResponse.json(
            { success: false, message: `儲存失敗: ${error.message}` },
            { status: 500 }
          );
        }
      } else {
        const { error } = await supabaseAdmin
          .from('system_settings')
          .insert(update);
        if (error) {
          console.error('Insert settings error:', error);
          return NextResponse.json(
            { success: false, message: `儲存失敗: ${error.message}` },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json({ success: true, message: '設定已更新' });
  } catch (error: any) {
    console.error('Settings POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
