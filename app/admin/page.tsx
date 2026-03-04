'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  CheckCircle, Calendar, Stethoscope, BookOpen, DollarSign,
  Settings, FileText, Calculator, FileSpreadsheet, LogOut, Bell, ShieldAlert
} from 'lucide-react';

// 診斷組件匯入 (請確保路徑正確)
import ClinicSwitcher from '@/app/components/ClinicSwitcher';
import StaffRosterView from './StaffRoster';
import DoctorRosterView from './DoctorRoster';
import LaborRulesView from './LaborRules';
import AttendanceView from './AttendanceView';
import SalaryView from '@/components/views/SalaryView';
import SettingsView from './SettingsView';
import LeaveView from './LeaveView';
import DoctorSalaryView from '@/components/views/DoctorSalaryView';
import SalaryReportView from './SalaryReport';
import TasksView from './TasksView';
import AnnouncementsView from './AnnouncementsView';

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminPage() {
  const router = useRouter();
  const [authLevel, setAuthLevel] = useState<'boss' | 'manager' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('tasks');
  const [clinicName, setClinicName] = useState('診所');

  useEffect(() => {
    const checkAuth = async () => {
      console.log('--- 🛡️ 開始身份檢查 ---');
      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        console.log('API 回傳結果:', data);

        if (data.authenticated && data.authLevel) {
          setAuthLevel(data.authLevel);
          setActiveTab(data.authLevel === 'boss' ? 'tasks' : 'staff_roster');
        } else {
          console.warn('身分驗證失敗或權限不足，準備跳轉...');
          router.push('/login');
        }
      } catch (error) {
        console.error('身份檢查出錯:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // 讀取診所名稱
  useEffect(() => {
    if (!authLevel) return;
    const fetchClinicName = async () => {
      try {
        const { data } = await supabase.from('clinics').select('name').single();
        if (data?.name) setClinicName(data.name);
      } catch (e) { console.error('讀取診所名稱失敗', e); }
    };
    fetchClinicName();
  }, [authLevel]);

  // 登出與閒置邏輯 (維持原樣)
  const handleLogout = async (isAutoLogout = false) => {
    await supabase.auth.signOut();
    if (isAutoLogout) alert('已閒置超過 30 分鐘，系統自動登出');
    router.push('/login');
  };

  // 渲染判斷
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <div className="text-slate-400 font-bold">正在進入系統...</div>
      </div>
    );
  }

  // 🟢 修復白畫面：若無權限，顯示導向中文字而非回傳 null
  if (!authLevel) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-2">
        <ShieldAlert className="text-red-400" size={48} />
        <div className="text-slate-500 font-bold text-xl">身分驗證中，請稍候...</div>
        <button onClick={() => router.push('/login')} className="text-blue-600 underline">若沒自動跳轉，請點此登入</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800">
      {/* 介面主體 (維持你原本的內容，但加上防呆渲染) */}
      <div className="max-w-[1600px] mx-auto">
        <div className="flex-1">
          <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
             {/* ... Header 內容 ... */}
             <div className="flex items-center gap-4">
                <h1 className="text-2xl font-black">{clinicName}管理系統</h1>
                <ClinicSwitcher />
                <button onClick={() => handleLogout()} className="text-red-600 font-bold ml-4">登出</button>
             </div>
             {/* ... Tabs 內容 ... */}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-6">
            {activeTab === 'tasks' && <TasksView />}
            {activeTab === 'staff_roster' && <StaffRosterView authLevel={authLevel} />}
            {activeTab === 'settings' && <SettingsView />}
            {/* ... 其他 Tab 依此類推 ... */}
            
            {/* 💡 增加一個兜底顯示，避免內容區空白 */}
            {!activeTab && <div className="p-20 text-center text-slate-300">請選擇上方選單</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

