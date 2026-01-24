import { supabaseAdmin } from './supabaseAdmin';
import { cookies } from 'next/headers';

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
 * 從 Request 中取得當前使用者的 clinic_id
 * 
 * 此函數會依序嘗試：
 * 1. 從 Authorization header 取得 Supabase token，解析 user ID
 * 2. 從 cookie 取得 user_id，查詢 profiles 表
 * 3. 從 cookie 直接取得 clinic_id (臨時方案，不建議長期使用)
 * 
 * @param request - NextRequest 物件
 * @returns clinic_id (uuid) 或 null
 */
export async function getClinicIdFromRequest(request: Request): Promise<string | null> {
  try {
    // 方法 1: 從 Authorization header 取得 Supabase token
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // 使用 Supabase Admin 驗證 token 並取得 user
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      
      if (!error && user) {
        return await getClinicId(user.id);
      }
    }

    // 方法 2: 從 cookie 取得 user ID (如果系統使用 cookie 儲存 user ID)
    const cookieStore = await cookies();
    const userIdCookie = cookieStore.get('user_id');
    
    if (userIdCookie?.value) {
      return await getClinicId(userIdCookie.value);
    }

    // 方法 3: 臨時方案 - 從 cookie 直接取得 clinic_id
    // ⚠️ 注意：這不是最安全的做法，建議改用 Supabase Auth
    // 如果現有系統使用簡單的 cookie 認證，可以暫時使用此方法
    const clinicIdCookie = cookieStore.get('clinic_id');
    if (clinicIdCookie?.value) {
      // 驗證 clinic_id 是否存在於 clinics 表
      const { data } = await supabaseAdmin
        .from('clinics')
        .select('id')
        .eq('id', clinicIdCookie.value)
        .single();
      
      if (data) {
        return clinicIdCookie.value;
      }
    }

    // 方法 4: 如果無法取得，回傳預設診所的 ID (僅用於向後兼容)
    // ⚠️ 這只是臨時方案，生產環境應該要求明確的認證
    const { data: defaultClinic } = await supabaseAdmin
      .from('clinics')
      .select('id')
      .eq('code', 'default')
      .single();

    return defaultClinic?.id || null;
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
export async function requireClinicId(request: Request): Promise<{ clinicId: string } | null> {
  const clinicId = await getClinicIdFromRequest(request);
  
  if (!clinicId) {
    return null;
  }

  return { clinicId };
}
