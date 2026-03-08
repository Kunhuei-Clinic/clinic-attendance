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
