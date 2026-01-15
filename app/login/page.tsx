'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inputPasscode, setInputPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 檢查是否已經登入
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 嘗試讀取 Cookie（透過 API）
        const response = await fetch('/api/auth/check', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            // 已經登入，重定向到 admin 或原本要去的頁面
            const redirect = searchParams.get('redirect') || '/admin';
            router.push(redirect);
          }
        }
      } catch (err) {
        // 忽略錯誤，繼續顯示登入頁
      }
    };
    checkAuth();
  }, [router, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ passcode: inputPasscode }),
      });

      const data = await response.json();

      if (data.success && data.authLevel) {
        // 登入成功，重定向到 admin 或原本要去的頁面
        const redirect = searchParams.get('redirect') || '/admin';
        router.push(redirect);
      } else {
        setError(data.message || '密碼錯誤');
        setInputPasscode('');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('登入失敗，請稍後再試');
      setInputPasscode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
        <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">後台登入</h2>
        <p className="text-slate-500 text-sm mb-6">請輸入管理員密碼</p>
        
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Passcode"
            className="w-full p-3 border rounded-xl text-center text-lg tracking-widest mb-4 outline-none focus:ring-2 focus:ring-blue-500"
            value={inputPasscode}
            onChange={(e) => setInputPasscode(e.target.value)}
            disabled={loading}
            autoFocus
          />
          
          {error && (
            <div className="mb-4 text-red-600 text-sm font-bold bg-red-50 p-2 rounded-lg">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '登入中...' : '解鎖'}
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
