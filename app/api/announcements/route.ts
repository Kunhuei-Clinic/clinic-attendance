import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/announcements
 * 取得公告列表
 * 
 * Query Parameters:
 *   - isActive: boolean (可選，預設 true，只回傳啟用的公告)
 * 
 * Response: { data: [...] }
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
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam === null ? true : isActiveParam === 'true';

    let query = supabaseAdmin
      .from('announcements')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (isActive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching announcements:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Announcements API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements
 * 新增公告
 * 
 * Request Body:
 *   {
 *     title: string,
 *     content: string,
 *     is_active?: boolean (預設 true)
 *   }
 * 
 * Response: { success: boolean, data?: any, error?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, content, is_active = true } = body;

    if (!title || !content) {
      return NextResponse.json(
        { success: false, error: '標題和內容為必填欄位' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        clinic_id: clinicId,
        title,
        content,
        is_active: is_active !== undefined ? is_active : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating announcement:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Announcements POST API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/announcements
 * 更新公告
 * 
 * Request Body:
 *   {
 *     id: number,
 *     title?: string,
 *     content?: string,
 *     is_active?: boolean
 *   }
 * 
 * Response: { success: boolean, data?: any, error?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少公告 ID' },
        { status: 400 }
      );
    }

    // 驗證該公告屬於當前診所
    const { data: existing } = await supabaseAdmin
      .from('announcements')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '找不到該公告或無權限修改' },
        { status: 404 }
      );
    }

    // 更新資料
    const { data, error } = await supabaseAdmin
      .from('announcements')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select()
      .single();

    if (error) {
      console.error('Error updating announcement:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Announcements PATCH API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/announcements
 * 刪除公告
 * 
 * Query Parameters:
 *   - id: number (必填)
 * 
 * Response: { success: boolean, error?: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    // 🟢 多租戶：取得當前使用者的 clinic_id
    const clinicId = await getClinicIdFromRequest(request);
    if (!clinicId) {
      return NextResponse.json(
        { success: false, error: '無法識別診所，請重新登入' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少公告 ID' },
        { status: 400 }
      );
    }

    // 驗證該公告屬於當前診所
    const { data: existing } = await supabaseAdmin
      .from('announcements')
      .select('id, clinic_id')
      .eq('id', Number(id))
      .eq('clinic_id', clinicId)
      .single();

    if (!existing) {
      return NextResponse.json(
        { success: false, error: '找不到該公告或無權限刪除' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('announcements')
      .delete()
      .eq('id', Number(id))
      .eq('clinic_id', clinicId);

    if (error) {
      console.error('Error deleting announcement:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Announcements DELETE API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
