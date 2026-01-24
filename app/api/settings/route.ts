import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/settings
 * 取得系統設定
 * 
 * Query Parameters:
 *   - key: string (optional, 取得特定設定)
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
    const key = searchParams.get('key');

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
    const rawUpdates = Array.isArray(body) ? body : [body];

    // 🟢 多租戶：移除前端可能傳入的 clinic_id，由後端自動填入
    const updates = rawUpdates.map((item: any) => {
      const { clinic_id, ...rest } = item;
      return {
        ...rest,
        clinic_id: clinicId // 🟢 自動填入，不讓前端傳入
      };
    });

    const { error } = await supabaseAdmin
      .from('system_settings')
      .upsert(updates);

    if (error) {
      console.error('Update settings error:', error);
      return NextResponse.json(
        { success: false, message: `儲存失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '設定已更新'
    });
  } catch (error: any) {
    console.error('Settings POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
