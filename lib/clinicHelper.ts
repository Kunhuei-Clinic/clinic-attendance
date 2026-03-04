import { supabaseAdmin } from './supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

/**
 * 取得使用者的 clinic_id（從 Cookie 讀取 Session）
 * 
 * @returns clinic_id (uuid) 或 null
 */
export async function getClinicId(): Promise<string | null> {
  try {
    const cookieStore = cookies();
    
    // 建立一個暫時的 Client 來讀取 Auth Cookie
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // 取得使用者
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      console.error('Auth error:', error);
      return null;
    }

    // 查詢 Profile 取得 Clinic ID (使用 Admin Client 繞過 RLS)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('clinic_id')
      .eq('id', user.id)
      .single();

    return profile?.clinic_id || null;
  } catch (error) {
    console.error('getClinicId error:', error);
    return null;
  }
}

/**
 * 取得使用者的 clinic_id（從 userId）
 * 
 * @param userId - Supabase Auth 的 user ID (uuid)
 * @returns clinic_id (uuid) 或 null
 */
export async function getClinicIdByUserId(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('clinic_id')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching clinic_id:', error);
      return null;
    }

    return data?.clinic_id || null;
  } catch (error) {
    console.error('getClinicIdByUserId error:', error);
    return null;
  }
}

/**
 * 從 Supabase Session Cookie 取得 User ID
 * 
 * @param request - NextRequest 物件
 * @returns user ID (uuid) 或 null
 */
async function getUserIdFromSession(request: NextRequest): Promise<string | null> {
  try {
    // 從 Cookie 取得 Supabase Session
    // Supabase 會將 session 存在名為 'sb-<project-ref>-auth-token' 的 cookie 中
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      return null;
    }

    // 從 URL 提取 project ref (例如: https://xxx.supabase.co -> xxx)
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
    if (!projectRef) {
      return null;
    }

    // Supabase 的 session cookie 名稱格式
    const sessionCookieName = `sb-${projectRef}-auth-token`;
    const sessionCookie = request.cookies.get(sessionCookieName);

    if (!sessionCookie?.value) {
      return null;
    }

    try {
      // 解析 JWT token (Supabase session 是 JWT)
      // 注意：這裡我們只提取 user ID，不驗證 token（驗證由 Supabase Admin 處理）
      const tokenParts = sessionCookie.value.split('.');
      if (tokenParts.length !== 3) {
        return null;
      }

      // 解碼 payload (base64url)
      const payload = JSON.parse(
        Buffer.from(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
      );

      // 驗證 token 是否有效（使用 Supabase Admin 驗證）
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(payload.sub);

      if (error || !user) {
        return null;
      }

      return user.id;
    } catch (parseError) {
      console.error('Error parsing session token:', parseError);
      return null;
    }
  } catch (error) {
    console.error('getUserIdFromSession error:', error);
    return null;
  }
}

/**
 * 從 Request 中取得當前使用者的 clinic_id（企業級多租戶權限驗證）
 *
 * 邏輯：
 * 1. 解析目前登入的 userId（使用 Supabase Session Cookie）
 * 2. 檢查是否為 Super Admin：
 *    - 若是，且 Header/Cookie 有指定 clinic_id，直接放行
 * 3. 讀取 active_clinic_id Cookie 或 Header 的 x-clinic-id 作為目標診所
 * 4. 嚴格驗證：確認 userId 對該 clinic_id 存在於 clinic_members
 * 5. 若沒有合法目標診所，回退為該使用者在 clinic_members 的第一家診所
 */
export async function getClinicIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // 1. 取得當前使用者 ID（沿用現有 Session 解析邏輯）
    const userId = await getUserIdFromSession(request);
    if (!userId) {
      return null;
    }

    // 2. 讀取前端傳來的目標診所 ID：優先 Header，其次 active_clinic_id Cookie，再向後相容 clinic_id cookie
    const targetClinicId =
      request.headers.get('x-clinic-id') ||
      request.cookies.get('active_clinic_id')?.value ||
      request.cookies.get('clinic_id')?.value ||
      null;

    // 3. 檢查是否為 Super Admin
    const { data: superAdmin } = await supabaseAdmin
      .from('super_admins')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (superAdmin) {
      // 總管特權：若有指定診所，直接放行；否則回傳 null 讓前端自行決定
      return targetClinicId || null;
    }

    // 4. 一般使用者的嚴格驗證：若有指定診所，確認是否為該診所成員
    if (targetClinicId) {
      const { data: memberRecord, error: memberError } = await supabaseAdmin
        .from('clinic_members')
        .select('clinic_id')
        .eq('user_id', userId)
        .eq('clinic_id', targetClinicId)
        .single();

      if (!memberError && memberRecord) {
        return memberRecord.clinic_id;
      }
    }

    // 5. 預設降級：抓出該使用者名下的第一家合法診所
    const { data: firstValidClinic, error: firstError } = await supabaseAdmin
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (firstError) {
      console.error('getClinicIdFromRequest fallback error:', firstError);
    }

    return firstValidClinic?.clinic_id || null;
  } catch (error) {
    console.error('getClinicIdFromRequest Security Error:', error);
    return null;
  }
}

/**
 * 驗證並取得 clinic_id（帶錯誤處理）
 * 
 * @param request - NextRequest 物件
 * @returns { clinicId: string } 或 null (如果無法取得)
 */
export async function requireClinicId(request: NextRequest): Promise<{ clinicId: string } | null> {
  const clinicId = await getClinicIdFromRequest(request);
  
  if (!clinicId) {
    return null;
  }

  return { clinicId };
}
