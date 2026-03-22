import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/portal/verify-password
 * 二次驗證登入密碼（與 staff.password 比對），僅允許 Cookie 中的本人 staff_id。
 */
export async function POST(request: NextRequest) {
  try {
    const staffIdCookie = request.cookies.get('staff_id')?.value?.trim();
    const body = await request.json();
    const userId = typeof body?.userId === 'string' ? body.userId.trim() : '';
    const password = body?.password;

    if (!staffIdCookie) {
      return NextResponse.json(
        { success: false, error: '未登入' },
        { status: 401 }
      );
    }

    if (!userId || userId !== staffIdCookie) {
      return NextResponse.json(
        { success: false, error: '身分不符' },
        { status: 403 }
      );
    }

    if (password === undefined || password === null || String(password) === '') {
      return NextResponse.json(
        { success: false, error: '請輸入密碼' },
        { status: 400 }
      );
    }

    const { data: staff, error } = await supabaseAdmin
      .from('staff')
      .select('id, password, is_active')
      .eq('id', userId)
      .single();

    if (error || !staff) {
      return NextResponse.json(
        { success: false, error: '找不到員工' },
        { status: 404 }
      );
    }

    if (!staff.is_active) {
      return NextResponse.json(
        { success: false, error: '帳號已停用' },
        { status: 403 }
      );
    }

    const dbPassword = staff.password || '0000';
    if (dbPassword === String(password)) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: '密碼錯誤' }, { status: 401 });
  } catch (e: any) {
    console.error('[portal/verify-password]', e);
    return NextResponse.json(
      { success: false, error: e?.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
