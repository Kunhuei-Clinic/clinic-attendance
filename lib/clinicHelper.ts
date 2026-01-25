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
 * 從 Request 中取得當前使用者的 clinic_id
 * 
 * 此函數會依序嘗試：
 * 1. 從 Supabase Session Cookie 取得 user ID，查詢 profiles 表取得 clinic_id（使用 @supabase/ssr）
 * 2. 從 Authorization header 取得 Supabase token，解析 user ID
 * 3. 從 cookie 取得 user_id (向後兼容)
 * 
 * @param request - NextRequest 物件
 * @returns clinic_id (uuid) 或 null
 */
export async function getClinicIdFromRequest(request: NextRequest): Promise<string | null> {
  try {
    // 方法 1: 從 Supabase Session Cookie 取得 user ID (主要方法，使用 @supabase/ssr)
    const cookieStore = cookies();
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (!authError && user) {
      const clinicId = await getClinicIdByUserId(user.id);
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
        return await getClinicIdByUserId(user.id);
      }
    }

    // 方法 3: 向後兼容 - 從 cookie 取得 user_id (舊系統)
    const userIdCookie = cookieStore.get('user_id');
    
    if (userIdCookie?.value) {
      return await getClinicIdByUserId(userIdCookie.value);
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
