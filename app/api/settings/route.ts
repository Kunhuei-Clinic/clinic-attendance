import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/settings
 * 取得系統設定
 * 
 * Query Parameters:
 *   - key: string (optional, 取得特定設定)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');

    let query = supabaseAdmin.from('system_settings').select('*');
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
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updates = Array.isArray(body) ? body : [body];

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
