'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Lock, Mail } from 'lucide-react';

// 建立 Supabase 客戶端（使用環境變數或直接設定）
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 檢查是否已經登入
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // 已經登入，重定向到 admin 或原本要去的頁面
          const redirect = searchParams.get('redirect') || '/admin';
          router.push(redirect);
        }
      } catch (err) {
        // 忽略錯誤，繼續顯示登入頁
        console.error('Session check error:', err);
      }
    };
    checkSession();
  }, [router, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!email || !password) {
      setError('請輸入帳號和密碼');
      setLoading(false);
      return;
    }

    try {
      // 使用 Supabase Auth 進行登入
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (signInError) {
        // 處理各種錯誤情況
        if (signInError.message.includes('Invalid login credentials')) {
          setError('帳號或密碼錯誤');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('請先驗證您的 Email');
        } else {
          setError(signInError.message || '登入失敗');
        }
        setPassword('');
        setLoading(false);
        return;
      }

      if (data.session) {
        // 登入成功，將 session 同步到後端 cookie
        // 這樣 middleware 才能識別認證狀態
        try {
          const syncResponse = await fetch('/api/auth/sync-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at
            }),
            credentials: 'include'
          });

          if (!syncResponse.ok) {
            console.warn('Session sync failed, but login succeeded');
          }
        } catch (syncError) {
          console.warn('Session sync error:', syncError);
          // 即使同步失敗，也繼續跳轉（因為客戶端 session 已建立）
        }

        // 刷新路由以更新認證狀態
        const redirect = searchParams.get('redirect') || '/admin';
        router.refresh();
        
        // 延遲一下確保 session 已寫入 cookie
        setTimeout(() => {
          router.push(redirect);
        }, 100);
      } else {
        setError('登入失敗，無法建立 Session');
        setPassword('');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setError('登入失敗，請稍後再試');
      setPassword('');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">後台登入</h2>
          <p className="text-slate-500 text-sm">請使用帳號和密碼登入</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              帳號 (Email)
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              密碼
            </label>
            <input
              id="password"
              type="password"
              placeholder="請輸入密碼"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>
          
          {error && (
            <div className="text-red-600 text-sm font-bold bg-red-50 p-3 rounded-lg border border-red-200">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-400">載入中...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
