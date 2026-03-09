import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/** 僅限 owner 權限時拋出的錯誤，方便 API 回傳 403 */
export class ForbiddenError extends Error {
  constructor(message: string = '僅負責人可執行此操作') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** 未登入時拋出的錯誤，方便 API 回傳 401 */
export class UnauthorizedError extends Error {
  constructor(message: string = '請先登入') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export type RequireOwnerAuthResult = { clinicId: string; userId: string };
export type RequireManagerOrOwnerAuthResult = { clinicId: string; userId: string };

/**
 * 嚴格驗證：僅允許 system_role 為 owner（或平台 super_admin）的請求通過。
 * 從 Supabase 取得當前使用者，並從 clinic_members 取得該使用者在目標診所的 role；
 * 若非 owner（或 super_admin），拋錯並由呼叫端回傳 403。
 * 同時回傳該使用者的 clinic_id，確保後續操作僅能針對該院區。
 *
 * @param request NextRequest
 * @returns { clinicId, userId } 通過驗證時
 * @throws UnauthorizedError 未登入
 * @throws ForbiddenError 非 owner 權限
 */
export async function requireOwnerAuth(request: NextRequest): Promise<RequireOwnerAuthResult> {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new UnauthorizedError('無法識別診所，請重新登入');
  }

  const userId = user.id;
  const targetClinicId = request.headers.get('x-clinic-id') || cookieStore.get('active_clinic_id')?.value;

  // 1. 平台總管 (Super Admin) 視同 owner，允許操作任一院區
  const { data: superAdmin } = await supabaseAdmin
    .from('super_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  if (superAdmin) {
    if (targetClinicId) {
      return { clinicId: targetClinicId, userId };
    }
    const { data: first } = await supabaseAdmin
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (first?.clinic_id) {
      return { clinicId: first.clinic_id, userId };
    }
    throw new UnauthorizedError('無法識別診所，請重新登入');
  }

  // 2. 一般使用者：必須有目標診所且在該診所為 owner（或 boss，相容舊資料）
  if (!targetClinicId) {
    const { data: first } = await supabaseAdmin
      .from('clinic_members')
      .select('clinic_id, role')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (!first?.clinic_id) {
      throw new UnauthorizedError('無法識別診所，請重新登入');
    }
    const role = (first as { role?: string }).role;
    if (role !== 'owner' && role !== 'boss') {
      throw new ForbiddenError('僅負責人可執行此操作');
    }
    return { clinicId: first.clinic_id, userId };
  }

  const { data: member } = await supabaseAdmin
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_id', userId)
    .eq('clinic_id', targetClinicId)
    .single();

  if (!member) {
    throw new ForbiddenError('您沒有此院區的存取權限');
  }

  const role = (member as { role?: string }).role;
  if (role !== 'owner' && role !== 'boss') {
    throw new ForbiddenError('僅負責人可執行此操作');
  }

  return { clinicId: member.clinic_id, userId };
}

/**
 * 驗證：允許 owner / boss / manager（以及 super_admin）操作指定診所資料。
 * 回傳該使用者在當前診所的 clinic_id 與 userId。
 *
 * - Super Admin：視同最高權限，可操作任一院區。
 * - 一般使用者：必須在目標診所的 clinic_members 中，角色為 owner / boss / manager 才放行。
 */
export async function requireManagerOrOwnerAuth(
  request: NextRequest
): Promise<RequireManagerOrOwnerAuthResult> {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new UnauthorizedError('無法識別診所，請重新登入');
  }

  const userId = user.id;
  const targetClinicId = request.headers.get('x-clinic-id') || cookieStore.get('active_clinic_id')?.value;

  // 1. 平台總管 (Super Admin) 視同 owner/manager，允許操作任一院區
  const { data: superAdmin } = await supabaseAdmin
    .from('super_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  if (superAdmin) {
    if (targetClinicId) {
      return { clinicId: targetClinicId, userId };
    }
    const { data: first } = await supabaseAdmin
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (first?.clinic_id) {
      return { clinicId: first.clinic_id, userId };
    }
    throw new UnauthorizedError('無法識別診所，請重新登入');
  }

  const isManagerLevel = (role?: string | null) =>
    role === 'owner' || role === 'boss' || role === 'manager';

  // 2. 一般使用者：必須在診所中為 owner / boss / manager
  if (!targetClinicId) {
    const { data: first } = await supabaseAdmin
      .from('clinic_members')
      .select('clinic_id, role')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (!first?.clinic_id) {
      throw new UnauthorizedError('無法識別診所，請重新登入');
    }
    const role = (first as { role?: string }).role;
    if (!isManagerLevel(role)) {
      throw new ForbiddenError('僅負責人或排班主管可執行此操作');
    }
    return { clinicId: first.clinic_id, userId };
  }

  const { data: member } = await supabaseAdmin
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_id', userId)
    .eq('clinic_id', targetClinicId)
    .single();

  if (!member) {
    throw new ForbiddenError('您沒有此院區的存取權限');
  }

  const role = (member as { role?: string }).role;
  if (!isManagerLevel(role)) {
    throw new ForbiddenError('僅負責人或排班主管可執行此操作');
  }

  return { clinicId: member.clinic_id, userId };
}

/**
 * 供 API route 使用：捕捉 requireOwnerAuth 的錯誤並回傳對應的 NextResponse。
 * 若 e 為 UnauthorizedError 回傳 401，否則回傳 403。
 */
export function authErrorToResponse(e: unknown): { status: number; message: string } {
  if (e instanceof UnauthorizedError) {
    return { status: 401, message: e.message };
  }
  if (e instanceof ForbiddenError) {
    return { status: 403, message: e.message };
  }
  return { status: 403, message: '僅負責人可執行此操作' };
}

export type CheckSalaryAccessResult = {
  clinicId: string;
  /** owner 時可為 undefined（表示可查全部）；staff 時為本人 staff_id */
  effectiveStaffId?: string;
};

/**
 * 薪資存取檢查：老闆可查任意員工（須符合 clinic_id）；員工僅能查本人。
 * 先取得當前登入者的 userId 與 authLevel（由 clinic_members.role 判斷），
 * - 情境 1 (owner)：允許存取任何 targetStaffId 的資料（後續須以 clinic_id 過濾）。
 * - 情境 2 (staff)：僅當 targetStaffId 為該使用者本人的 staff_id 時放行（經 staff.auth_user_id 反查）。
 * 若不符合以上兩者，拋出 ForbiddenError（403）；未登入拋 UnauthorizedError（401）。
 *
 * @param request NextRequest
 * @param targetStaffId 欲查詢的員工 ID；若為 null/undefined，員工視為「查本人」，老闆視為「可查全部」
 * @returns { clinicId, effectiveStaffId? } 通過時；owner 查全部時 effectiveStaffId 為 undefined
 */
export async function checkSalaryAccess(
  request: NextRequest,
  targetStaffId?: string | null
): Promise<CheckSalaryAccessResult> {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new UnauthorizedError('無法識別診所，請重新登入');
  }

  const userId = user.id;
  const targetClinicId = request.headers.get('x-clinic-id') || cookieStore.get('active_clinic_id')?.value;

  // 1. Super Admin 視同 owner
  const { data: superAdmin } = await supabaseAdmin
    .from('super_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  if (superAdmin) {
    const clinicId = targetClinicId || (await (async () => {
      const { data: first } = await supabaseAdmin
        .from('clinic_members')
        .select('clinic_id')
        .eq('user_id', userId)
        .limit(1)
        .single();
      return first?.clinic_id ?? null;
    })());
    if (!clinicId) throw new UnauthorizedError('無法識別診所，請重新登入');
    return { clinicId, effectiveStaffId: targetStaffId || undefined };
  }

  // 2. 取得該使用者在目標診所的 role 與 clinic_id
  if (!targetClinicId) {
    const { data: first } = await supabaseAdmin
      .from('clinic_members')
      .select('clinic_id, role')
      .eq('user_id', userId)
      .limit(1)
      .single();
    if (!first?.clinic_id) throw new UnauthorizedError('無法識別診所，請重新登入');
    const role = (first as { role?: string }).role;
    const isOwner = role === 'owner' || role === 'boss';
    if (isOwner) {
      return { clinicId: first.clinic_id, effectiveStaffId: targetStaffId || undefined };
    }
    // staff：反查本人 staff_id
    const { data: staffRow } = await supabaseAdmin
      .from('staff')
      .select('id')
      .eq('auth_user_id', userId)
      .eq('clinic_id', first.clinic_id)
      .single();
    if (!staffRow) throw new ForbiddenError('找不到對應的員工資料，無法查詢薪資');
    const myStaffId = (staffRow as { id: string }).id;
    if (targetStaffId != null && targetStaffId !== myStaffId) {
      throw new ForbiddenError('僅能查詢本人薪資資料');
    }
    return { clinicId: first.clinic_id, effectiveStaffId: myStaffId };
  }

  const { data: member } = await supabaseAdmin
    .from('clinic_members')
    .select('clinic_id, role')
    .eq('user_id', userId)
    .eq('clinic_id', targetClinicId)
    .single();

  if (!member) {
    throw new ForbiddenError('您沒有此院區的存取權限');
  }

  const role = (member as { role?: string }).role;
  const isOwner = role === 'owner' || role === 'boss';

  if (isOwner) {
    return { clinicId: member.clinic_id, effectiveStaffId: targetStaffId || undefined };
  }

  // 員工：僅能查本人
  const { data: staffRow } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('auth_user_id', userId)
    .eq('clinic_id', member.clinic_id)
    .single();

  if (!staffRow) {
    throw new ForbiddenError('找不到對應的員工資料，無法查詢薪資');
  }

  const myStaffId = (staffRow as { id: string }).id;
  if (targetStaffId != null && targetStaffId !== myStaffId) {
    throw new ForbiddenError('僅能查詢本人薪資資料');
  }

  return { clinicId: member.clinic_id, effectiveStaffId: myStaffId };
}
