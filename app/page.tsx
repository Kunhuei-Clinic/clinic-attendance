'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// 建立 Supabase 客戶端（用於檢查 Session）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

/**
 * 根目錄頁面
 * 檢查是否有管理員登入：
 * - 有 Session -> 跳轉到 /admin
 * - 無 Session -> 跳轉到 /login
 * 
 * 注意：員工入口請使用 /portal 或 /checkin
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      try {
        // 檢查 Supabase Session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // 有 Session，跳轉到管理後台
          router.push('/admin');
        } else {
          // 無 Session，跳轉到登入頁
          router.push('/login');
        }
      } catch (error) {
        console.error('Session check error:', error);
        // 發生錯誤時，跳轉到登入頁
        router.push('/login');
      }
    };
    
    checkSession();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400">檢查登入狀態...</div>
    </div>
  );
}
