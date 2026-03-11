import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getClinicIdFromRequest } from '@/lib/clinicHelper';
import { requireManagerOrOwnerAuth, UnauthorizedError, ForbiddenError } from '@/lib/authHelper';

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

    // 🟢 嘗試判斷是否為 owner，但不阻擋（Portal 無 JWT 時會降級為一般成員）
    let isOwner = false;
    try {
      const { clinicId: authClinicId, userId } = await requireManagerOrOwnerAuth(request);

      // Super Admin 或在該診所為 owner/boss 視為 owner 權限（可看未遮罩資料）
      const { data: superAdmin } = await supabaseAdmin
        .from('super_admins')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (superAdmin) {
        isOwner = true;
      } else {
        const { data: member } = await supabaseAdmin
          .from('clinic_members')
          .select('role')
          .eq('user_id', userId)
          .eq('clinic_id', authClinicId)
          .single();

        const role = (member as { role?: string | null } | null)?.role ?? null;
        isOwner = role === 'owner' || role === 'boss';
      }
    } catch (e) {
      // 🟢 若無法取得登入身分（例如 Portal 訪客），視為非 owner，僅套用資料遮罩，不回傳 401
      if (e instanceof UnauthorizedError || e instanceof ForbiddenError) {
        isOwner = false;
      } else {
        // 其他錯誤也不阻擋 GET，只在 console 記錄
        console.error('Soft auth check for /api/staff failed:', e);
        isOwner = false;
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const role = searchParams.get('role');
    const isActive = searchParams.get('is_active');

    // 🟢 多租戶：強制加上 clinic_id 過濾
    let query = supabaseAdmin
      .from('staff')
      .select('*')
      .eq('clinic_id', clinicId); // 只查詢該診所的員工

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

    let safeData: any[] = data || [];

    // 🟢 若不是 owner，則剔除所有敏感欄位（僅回傳排班所需欄位）
    if (!isOwner) {
      safeData = safeData.map((staff: any) => ({
        id: staff.id,
        name: staff.name,
        role: staff.role,
        entity: staff.entity,
        display_order: staff.display_order,
        is_active: staff.is_active,
        start_date: staff.start_date,
      }));
    }

    return NextResponse.json({ data: safeData });
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
    const {
      clinic_id,
      enable_login,
      login_email,
      login_password,
      system_role,
      bank_info,
      id_number,
      ...staffData
    } = body;

    // 🟢 處理密碼欄位：若前端沒傳 password，後端自動補上預設值 '0000'
    const password = staffData.password?.trim() || '0000';

    let finalAuthUserId: string | null = null;

    // 🟢 1. 如果勾選「開通登入」，自動在 Supabase Auth 建立帳號
    if (enable_login && login_email && login_password) {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: login_email.trim(),
        password: String(login_password),
        email_confirm: true
      });

      if (authErr) {
        return NextResponse.json(
          { success: false, message: '建立登入帳號失敗：' + authErr.message },
          { status: 400 }
        );
      }
      finalAuthUserId = authData.user.id;

      // 🟢 2. 將新建立的帳號寫入多租戶權限表 (clinic_members)
      const { error: memberErr } = await supabaseAdmin.from('clinic_members').insert({
        user_id: finalAuthUserId,
        clinic_id: clinicId,
        role: system_role || 'staff'
      });

      if (memberErr) {
        console.error('Insert clinic_members error:', memberErr);
        return NextResponse.json(
          { success: false, message: '寫入權限失敗：' + memberErr.message },
          { status: 500 }
        );
      }
    }

    // 🟢 3. 儲存員工資料到 staff 表格（並綁定 auth_user_id）
    const payload: any = {
      ...staffData,
      clinic_id: clinicId,
      entity: staffData.entity || 'clinic',
      phone: staffData.phone.trim(),
      password,
      email: login_email?.trim() || staffData.email || null,
      auth_user_id: finalAuthUserId
    };

    if (bank_info !== undefined) {
      payload.bank_info = bank_info;
    }

    if (id_number !== undefined) {
      payload.id_number = id_number;
    }

    if (body.admin_role !== undefined) {
      payload.admin_role = body.admin_role;
    }

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
    const {
      id,
      clinic_id,
      password,
      enable_login,
      login_email,
      login_password,
      new_password,
      system_role,
      auth_user_id: bodyAuthUserId,
      bank_info,
      id_number,
      ...updateData
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: '缺少員工 ID' },
        { status: 400 }
      );
    }

    // 🟢 多租戶：驗證該員工是否屬於當前診所，並取得現有 auth_user_id
    const { data: staff } = await supabaseAdmin
      .from('staff')
      .select('id, clinic_id, auth_user_id')
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single();

    if (!staff) {
      return NextResponse.json(
        { success: false, message: '找不到該員工或無權限操作' },
        { status: 403 }
      );
    }

    const currentAuthUserId = bodyAuthUserId ?? staff.auth_user_id ?? null;
    const authUserIdForOps = staff.auth_user_id ?? bodyAuthUserId ?? null;

    // 🔒 防呆鎖：最後負責人檢查（降級或取消登入權限時）
    if (
      currentAuthUserId &&
      (system_role !== 'owner' || enable_login === false)
    ) {
      const { data: currentMember } = await supabaseAdmin
        .from('clinic_members')
        .select('role')
        .eq('user_id', currentAuthUserId)
        .eq('clinic_id', clinicId)
        .single();

      if (currentMember?.role === 'owner') {
        const { count } = await supabaseAdmin
          .from('clinic_members')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', clinicId)
          .eq('role', 'owner');

        if (count !== null && count <= 1) {
          return NextResponse.json(
            {
              success: false,
              message: '操作失敗：此為本診所最後一位負責人，請先指派其他負責人！'
            },
            { status: 400 }
          );
        }
      }
    }

    // 🟢 動作 A：強制重設密碼
    if (authUserIdForOps && new_password && String(new_password).trim() !== '') {
      const { error: updateAuthErr } = await supabaseAdmin.auth.admin.updateUserById(
        authUserIdForOps,
        { password: String(new_password).trim() }
      );
      if (updateAuthErr) {
        console.error('更新密碼失敗:', updateAuthErr);
      }
    }

    // 🟢 動作 B：撤銷登入權限 (沒收鑰匙)
    if (authUserIdForOps && enable_login === false) {
      await supabaseAdmin.from('clinic_members').delete().eq('user_id', authUserIdForOps).eq('clinic_id', clinicId);
      await supabaseAdmin.from('staff').update({ auth_user_id: null }).eq('id', id).eq('clinic_id', clinicId);
      return NextResponse.json({ success: true, message: '已成功撤銷該員工的系統登入權限' });
    }

    let finalAuthUserId: string | null = staff.auth_user_id;
    let didCreateAuth = false;

    // 🟢 PATCH 時新開通登入：既有員工尚未綁定 Auth 時，建立帳號並寫入 clinic_members
    if (!staff.auth_user_id && enable_login && login_email && login_password) {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: String(login_email).trim(),
        password: String(login_password),
        email_confirm: true
      });

      if (authErr) {
        return NextResponse.json(
          { success: false, message: '建立登入帳號失敗：' + authErr.message },
          { status: 400 }
        );
      }
      finalAuthUserId = authData.user.id;
      didCreateAuth = true;

      const { error: memberErr } = await supabaseAdmin.from('clinic_members').insert({
        user_id: finalAuthUserId,
        clinic_id: clinicId,
        role: system_role || 'staff'
      });

      if (memberErr) {
        console.error('Insert clinic_members error:', memberErr);
        return NextResponse.json(
          { success: false, message: '寫入權限失敗：' + memberErr.message },
          { status: 500 }
        );
      }
    }

    // 🟢 動作 C：既有帳號更新權限（clinic_members.role）
    if ((currentAuthUserId || finalAuthUserId) && system_role && enable_login !== false) {
      const userIdToUpdate = finalAuthUserId ?? currentAuthUserId;
      await supabaseAdmin
        .from('clinic_members')
        .update({ role: system_role })
        .eq('user_id', userIdToUpdate)
        .eq('clinic_id', clinicId);
    }

    // 🟢 多租戶：確保更新時不會改變 clinic_id，並排除權限專用欄位
    const payload: any = {
      ...updateData,
      clinic_id: clinicId
    };

    if (bank_info !== undefined) {
      payload.bank_info = bank_info;
    }

    if (id_number !== undefined) {
      payload.id_number = id_number;
    }

    if (updateData.entity !== undefined) {
      payload.entity = updateData.entity || 'clinic';
    }

    if (password !== undefined && password !== null && String(password).trim() !== '') {
      payload.password = String(password).trim();
    }

    if (updateData.phone !== undefined) {
      payload.phone = String(updateData.phone).trim();
    }

    if (body.admin_role !== undefined) {
      payload.admin_role = body.admin_role;
    }

    if (didCreateAuth && finalAuthUserId) {
      payload.auth_user_id = finalAuthUserId;
      payload.email = login_email?.trim() ?? updateData.email ?? null;
    }

    const { error } = await supabaseAdmin
      .from('staff')
      .update(payload)
      .eq('id', id)
      .eq('clinic_id', clinicId);

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
