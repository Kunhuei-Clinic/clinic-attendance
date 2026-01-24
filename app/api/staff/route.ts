import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * GET /api/staff
 * 取得員工列表
 * 
 * Query Parameters:
 *   - role: string (optional, 篩選職稱)
 *   - is_active: boolean (optional, 篩選在職狀態)
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
    const role = searchParams.get('role');
    const isActive = searchParams.get('is_active');

    // 🟢 多租戶：強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('staff')
      .select('*')
      .eq('clinic_id', clinicId) // 只查詢該診所的員工
      .order('id');

    if (role) {
      query = query.eq('role', role);
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Fetch staff error:', error);
      return NextResponse.json(
        { data: [], error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    console.error('Staff API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/staff
 * 新增員工
 * 
 * Request Body: Staff 物件 (不包含 clinic_id，由後端自動填入)
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

    if (!body.name) {
      return NextResponse.json(
        { success: false, message: '請輸入姓名' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：移除前端可能傳入的 clinic_id，由後端自動填入
    const { clinic_id, ...staffData } = body;

    // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
    const payload = {
      ...staffData,
      clinic_id: clinicId // 自動填入，不讓前端傳入
    };

    const { error } = await supabaseAdmin
      .from('staff')
      .insert([payload]);

    if (error) {
      console.error('Add staff error:', error);
      return NextResponse.json(
        { success: false, message: `儲存失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '儲存成功'
    });
  } catch (error: any) {
    console.error('Staff POST API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/staff
 * 更新員工資料
 * 
 * Request Body:
 *   { id: number, ...otherFields } (不包含 clinic_id，由後端自動填入)
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
    const { id, clinic_id, ...updateData } = body; // 🟢 移除前端可能傳入的 clinic_id

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少員工 ID' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    // 🟢 多租戶：確保更新時不會改變 clinic_id
    const payload = {
      ...updateData,
      clinic_id: clinicId // 確保 clinic_id 不會被修改
    };

    const { error } = await supabaseAdmin
      .from('staff')
      .update(payload)
      .eq('id', id)
      .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的員工

    if (error) {
      console.error('Update staff error:', error);
      return NextResponse.json(
        { success: false, message: `更新失敗: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '更新成功'
    });
  } catch (error: any) {
    console.error('Staff PATCH API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
