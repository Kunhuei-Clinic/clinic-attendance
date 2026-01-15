'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 根目錄頁面
 * 檢查是否有管理員登入：
 * - 有登入 -> 跳轉到 /admin
 * - 無登入 -> 跳轉到 /login
 * 
 * 注意：員工入口請使用 /portal 或 /checkin
 */
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            router.push('/admin');
          } else {
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      } catch (error) {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-slate-400">檢查登入狀態...</div>
    </div>
  );
}
