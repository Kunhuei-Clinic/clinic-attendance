import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/verify-password
 * 二次密碼驗證（Sudo）：用於開通員工登入權限等敏感操作前，確認操作者本人密碼。
 * Request Body: { password: string }
 * 依 Cookie 中的 staff_id 取得當前登入員工，比對 staff 表的 password 欄位。
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const staffId = cookieStore.get('staff_id')?.value;

    if (!staffId) {
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

    const { data: staff, error } = await supabaseAdmin
      .from('staff')
      .select('id, password')
      .eq('id', staffId)
      .single();

    if (error || !staff) {
      return NextResponse.json(
        { success: false, message: '找不到當前帳號' },
        { status: 401 }
      );
    }

    const dbPassword = staff.password ?? '0000';
    if (dbPassword !== password) {
      return NextResponse.json(
        { success: false, message: '密碼錯誤' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[verify-password] Error:', err);
    return NextResponse.json(
      { success: false, message: '伺服器錯誤' },
      { status: 500 }
    );
  }
}
