import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';

/**
 * PUT /api/staff/profile
 * 員工更新自己的個人資料
 * 
 * Request Body:
 *   {
 *     staff_id: number,  // 要更新的員工 ID（必須與當前登入者匹配）
 *     phone?: string,
 *     address?: string,
 *     emergency_contact?: string,
 *     bank_account?: string
 *   }
 * 
 * Response:
 *   { success: boolean, message?: string }
 * 
 * 安全限制：
 * - 只允許更新 phone, address, emergency_contact, bank_account
 * - 禁止更新 name, role, salary 等敏感欄位
 * - 驗證員工屬於當前診所
 */
export async function PUT(request: NextRequest) {
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
    const { staff_id, phone, address, emergency_contact, bank_account } = body;

    // 驗證必要參數
    if (!staff_id) {
      return NextResponse.json(
        { success: false, message: '缺少員工 ID (staff_id)' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id, is_active')
      .eq('id', staff_id)
      .eq('clinic_id', clinicId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    // 檢查員工是否啟用
    if (!staff.is_active) {
      return NextResponse.json(
        { success: false, message: '該員工帳號已停用' },
        { status: 403 }
      );
    }

    // 🟢 安全限制：只允許更新特定欄位
    // 建立更新 payload，只包含允許的欄位
    const updatePayload: any = {};
    
    if (phone !== undefined) {
      updatePayload.phone = phone;
    }
    if (address !== undefined) {
      updatePayload.address = address;
    }
    if (emergency_contact !== undefined) {
      updatePayload.emergency_contact = emergency_contact;
    }
    if (bank_account !== undefined) {
      updatePayload.bank_account = bank_account;
    }

    // 如果沒有任何欄位要更新
    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { success: false, message: '沒有提供要更新的欄位' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：確保更新時不會改變 clinic_id
    // 執行更新（確保只更新該診所的員工）
    const { error: updateError } = await supabaseAdmin
      .from('staff')
      .update(updatePayload)
      .eq('id', staff_id)
      .eq('clinic_id', clinicId); // 🟢 確保只更新該診所的員工

    if (updateError) {
      console.error('Update staff profile error:', updateError);
      console.error('Payload:', JSON.stringify(updatePayload, null, 2));
      return NextResponse.json(
        { success: false, message: `更新失敗: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '個人資料已更新'
    });
  } catch (error: any) {
    console.error('Staff Profile PUT API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/staff/profile
 * 取得員工個人資料（可選：用於驗證或預覽）
 * 
 * Query Parameters:
 *   - staff_id: number (optional, 預設為當前登入者)
 * 
 * Response:
 *   { success: boolean, data?: Staff, message?: string }
 */
export async function GET(request: NextRequest) {
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
    const staffIdParam = searchParams.get('staff_id');

    if (!staffIdParam) {
      return NextResponse.json(
        { success: false, message: '缺少員工 ID 參數' },
        { status: 400 }
      );
    }

    const staffId = staffIdParam;

    // 🟢 多租戶：驗證該員工是否屬於當前診所
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, phone, address, emergency_contact, bank_account, clinic_id')
      .eq('id', staffId)
      .eq('clinic_id', clinicId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    // 移除 clinic_id（不應該回傳給前端）
    const { clinic_id, ...staffData } = staff;

    return NextResponse.json({
      success: true,
      data: staffData
    });
  } catch (error: any) {
    console.error('Staff Profile GET API Error:', error);
    return NextResponse.json(
      { success: false, message: `處理失敗: ${error.message}` },
      { status: 500 }
    );
  }
}
