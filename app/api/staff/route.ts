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
      .order('role', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

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
 *   - phone: string (必填，用於 LINE 綁定)
 *   - password: string (可選，若未提供則預設為 '0000')
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

    // 🟢 驗證手機號碼（必填）
    if (!body.phone || body.phone.trim() === '') {
      return NextResponse.json(
        { success: false, message: '手機號碼為綁定帳號，務必填寫' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：移除前端可能傳入的 clinic_id，由後端自動填入
    const { clinic_id, ...staffData } = body;

    // 🟢 處理密碼欄位：若前端沒傳 password，後端自動補上預設值 '0000'
    const password = staffData.password?.trim() || '0000';

    // 🟢 多租戶：將 clinic_id 合併到 payload 中（不讓前端傳入）
    // 同時確保 entity 欄位有預設值，並包含 phone 和 password
    const payload = {
      ...staffData,
      clinic_id: clinicId, // 自動填入，不讓前端傳入
      entity: staffData.entity || 'clinic', // 如果沒有提供 entity，預設為 'clinic'
      phone: staffData.phone.trim(), // 🟢 必填，去除空白
      password: password // 🟢 必填，若未提供則使用預設值 '0000'
    };

    const { error } = await supabaseAdmin
      .from('staff')
      .insert([payload]);

    if (error) {
      console.error('Add staff error:', error);
      console.error('Payload:', JSON.stringify(payload, null, 2));
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
 *   - password: string (可選，若提供且不為空字串則更新，否則保留原密碼)
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
    const { id, clinic_id, password, ...updateData } = body; // 🟢 移除前端可能傳入的 clinic_id，並分離 password

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
    // 同時確保 entity 欄位有預設值（如果提供）
    const payload: any = {
      ...updateData,
      clinic_id: clinicId // 確保 clinic_id 不會被修改
    };
    
    // 如果提供了 entity 欄位，確保它有值
    if (updateData.entity !== undefined) {
      payload.entity = updateData.entity || 'clinic';
    }

    // 🟢 處理密碼欄位：若 request body 有傳 password 且不為空字串，才更新密碼欄位
    // 若為空，則保留原密碼不變（不將 password 加入 payload）
    if (password !== undefined && password !== null && password.trim() !== '') {
      payload.password = password.trim();
    }
    // 若 password 為空字串或未提供，則不更新密碼（不加入 payload）

    // 處理 phone 欄位（如果提供）
    if (updateData.phone !== undefined) {
      payload.phone = updateData.phone.trim();
    }

    const { error } = await supabaseAdmin
      .from('staff')
      .update(payload)
      .eq('id', id)
      .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的員工

    if (error) {
      console.error('Update staff error:', error);
      console.error('Payload:', JSON.stringify(payload, null, 2));
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
