import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/verify-password
 * 企業級二次密碼驗證（Sudo Mode）
 * 透過 Supabase Auth 驗證目前登入者的密碼是否正確
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();

    // 1. 建立 SSR 客戶端
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {} // 僅驗證密碼，不需要寫入新 Cookie
        },
      }
    );

    // 2. 取得目前登入的最高權限者 (老闆) 的 Email
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user || !user.email) {
      return NextResponse.json(
        { success: false, message: '未登入或 Session 已過期' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const password = body?.password;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, message: '請輸入密碼' },
        { status: 400 }
      );
    }

    // 3. 🔐 核心防護：嘗試用老闆的 Email 和剛輸入的密碼「重新登入」一次
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: password,
    });

    // 如果登入報錯，代表密碼打錯了
    if (signInError) {
      return NextResponse.json(
        { success: false, message: '密碼錯誤' },
        { status: 401 }
      );
    }

    // 驗證完美通過！
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[verify-password] Error:', err);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
