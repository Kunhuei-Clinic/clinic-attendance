import { supabaseAdmin } from './supabaseAdmin';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

/**
 * 取得使用者的 clinic_id
 * 
 * @param userId - Supabase Auth 的 user ID (uuid)
 * @returns clinic_id (uuid) 或 null
 */
export async function getClinicId(userId: string): Promise<string | null> {
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
    console.error('getClinicId error:', error);
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
 * 從 Request 中取得當前使用者的 clinic_id
 * 
 * 此函數會依序嘗試：
 * 1. 從 Supabase Session Cookie 取得 user ID，查詢 profiles 表取得 clinic_id
 * 2. 從 Authorization header 取得 Supabase token，解析 user ID
 * 3. 從 cookie 取得 user_id (向後兼容)
 * 
 * @param request - NextRequest 物件
 * @returns clinic_id (uuid) 或 null
 */
export async function getClinicIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // 方法 1: 從 Supabase Session Cookie 取得 user ID (主要方法)
    const userId = await getUserIdFromSession(request);
    if (userId) {
      const clinicId = await getClinicId(userId);
      if (clinicId) {
        return clinicId;
      }
    }

    // 方法 2: 從 Authorization header 取得 Supabase token (API 呼叫時使用)
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // 使用 Supabase Admin 驗證 token 並取得 user
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      
      if (!error && user) {
        return await getClinicId(user.id);
      }
    }

    // 方法 3: 向後兼容 - 從 cookie 取得 user_id (舊系統)
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('user_id');
    
    if (userIdCookie?.value) {
      return await getClinicId(userIdCookie.value);
    }

    // 無法取得 clinic_id，回傳 null
    return null;
  } catch (error) {
    console.error('getClinicIdFromRequest error:', error);
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
