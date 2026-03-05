'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import {
  CheckCircle,
  Calendar,
  Stethoscope,
  BookOpen,
  DollarSign,
  Settings,
  FileText,
  Calculator,
  FileSpreadsheet,
  LogOut,
  Bell,
} from 'lucide-react';
import ClinicSwitcher from '@/app/components/ClinicSwitcher';

// 建立 Supabase 客戶端（使用 @supabase/ssr 確保 Session 寫入 Cookie）
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucpkvptnhgbtmghqgbof.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo'
);

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

export default function AdminPage() {
  const router = useRouter();
  const [authLevel, setAuthLevel] = useState<'boss' | 'manager' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | 'tasks'
    | 'attendance'
    | 'staff_roster'
    | 'doctor_roster'
    | 'labor_rules'
    | 'salary'
    | 'settings'
    | 'leave'
    | 'doctor_salary'
    | 'salary_report'
    | 'announcements'
  >('tasks');

  // 診所名稱
  const [clinicName, setClinicName] = useState('診所');

  // 檢查認證狀態（後端已於 Response Header 設定 active_clinic_id Cookie）
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.authLevel) {
            setAuthLevel(data.authLevel);
            setActiveTab(data.authLevel === 'boss' ? 'tasks' : 'staff_roster');
            if (data.clinicName) setClinicName(data.clinicName);
          } else {
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // 🔒 資安防護：全時段閒置偵測 (含網頁關閉後重開)
  useEffect(() => {
    if (!authLevel) return; // 尚未登入則不執行

    const IDLE_TIME = 30 * 60 * 1000; // 30 分鐘 (毫秒)
    const ACTIVITY_KEY = 'last_system_activity';

    // 1. 初始化檢查：網頁載入時，先檢查上次活動時間
    const checkOnMount = () => {
      const lastActivity = localStorage.getItem(ACTIVITY_KEY);
      if (lastActivity) {
        const elapsed = Date.now() - parseInt(lastActivity, 10);
        if (elapsed > IDLE_TIME) {
          handleLogout(true); // 關掉網頁期間已經超時，直接踢出
          return true;
        }
      }
      return false;
    };

    if (checkOnMount()) return; // 如果已經超時，就不掛載後續監聽了

    // 2. 活動更新器：記錄最新活動時間到硬碟
    let timeoutId: NodeJS.Timeout;
    const updateActivity = () => {
      localStorage.setItem(ACTIVITY_KEY, Date.now().toString());

      // 重置計時器 (網頁開著的時候使用)
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLogout(true);
      }, IDLE_TIME);
    };

    // 3. 綁定監聽事件
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    // 初始呼叫一次
    updateActivity();

    // 清除監聽器
    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, updateActivity));
    };
  }, [authLevel]);

  // 讀取診所名稱（當 auth/check 未帶回 clinicName 時才二次請求）
  useEffect(() => {
    if (!authLevel) return;

    const fetchClinicName = async () => {
      try {
        const { data: clinicData, error: clinicError } = await supabase
          .from('clinics')
          .select('name')
          .single();

        if (!clinicError && clinicData?.name) {
          setClinicName(clinicData.name);
          return;
        }

        const res = await fetch('/api/settings', { credentials: 'include' });
        const json = await res.json();
        if (json.data) {
          const setting = json.data.find((s: any) => s.key === 'clinic_name');
          if (setting?.value) {
            setClinicName(setting.value);
            return;
          }
        }

        console.warn('[AdminPage] 無法讀取診所名稱，使用預設值');
      } catch (e) {
        console.error('[AdminPage] Fetch clinic name error:', e);
      }
    };

    fetchClinicName();
  }, [authLevel]);

  // 登出函式 (支援自動登出)
  const handleLogout = async (isAutoLogout = false) => {
    if (!isAutoLogout && !confirm('確定要登出嗎？')) return;
    try {
      await supabase.auth.signOut();
      if (isAutoLogout) {
        alert('為保護系統安全，您已閒置超過 30 分鐘，系統已自動登出。');
      }
      router.refresh();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400">載入中...</div>
      </div>
    );
  }

  if (!authLevel) {
    return null; // 會重定向到登入頁
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="max-w-[1600px] mx-auto">
        {/* 右側主要內容區 */}
        <div className="flex-1">
          {/* Header 區塊：單列橫向佈局 */}
          <div className="mb-6 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              {/* 左側：系統標題 */}
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                {clinicName}管理系統
                {authLevel === 'manager' && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">
                    排班模式
                  </span>
                )}
              </h1>

              {/* 右側：診所切換器 + 功能按鈕 (同一排) */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="flex-1 md:w-56">
                  <ClinicSwitcher />
                </div>
                {authLevel === 'boss' && (
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`p-2 rounded-lg transition border flex-shrink-0 ${
                      activeTab === 'tasks'
                        ? 'bg-teal-100 border-teal-300 text-teal-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    title="待審核案件"
                  >
                    <CheckCircle size={20} />
                  </button>
                )}
                <button
                  onClick={() => handleLogout()}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition flex-shrink-0"
                  title="登出"
                >
                  <LogOut size={16} /> <span className="hidden lg:inline">登出系統</span>
                </button>
              </div>
            </div>

            {/* 導航 Tabs：獨立一列 */}
            <div className="flex bg-white p-1 rounded-xl border shadow-sm overflow-x-auto no-scrollbar">
              {authLevel === 'boss' && (
                <>
                  <button
                    onClick={() => setActiveTab('attendance')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'attendance'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <CheckCircle size={16} /> 考勤
                  </button>
                  <button
                    onClick={() => setActiveTab('staff_roster')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'staff_roster'
                        ? 'bg-purple-100 text-purple-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar size={16} /> 員工排班
                  </button>
                  <button
                    onClick={() => setActiveTab('doctor_roster')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'doctor_roster'
                        ? 'bg-teal-100 text-teal-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Stethoscope size={16} /> 醫師排班
                  </button>
                  <button
                    onClick={() => setActiveTab('leave')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'leave'
                        ? 'bg-orange-100 text-orange-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <FileText size={16} /> 請假
                  </button>
                  <button
                    onClick={() => setActiveTab('salary')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'salary'
                        ? 'bg-green-100 text-green-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <DollarSign size={16} /> 員工薪資
                  </button>
                  <button
                    onClick={() => setActiveTab('doctor_salary')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'doctor_salary'
                        ? 'bg-teal-100 text-teal-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Calculator size={16} /> 醫師薪資
                  </button>
                  <button
                    onClick={() => setActiveTab('salary_report')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'salary_report'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <FileSpreadsheet size={16} /> 人事報表
                  </button>
                  <button
                    onClick={() => setActiveTab('labor_rules')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'labor_rules'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <BookOpen size={16} /> 法規
                  </button>
                  <button
                    onClick={() => setActiveTab('announcements')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'announcements'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Bell size={16} /> 公告
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${
                      activeTab === 'settings'
                        ? 'bg-gray-200 text-gray-800'
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Settings size={16} /> 設定
                  </button>
                </>
              )}
              {authLevel === 'manager' && (
                <button
                  onClick={() => setActiveTab('staff_roster')}
                  className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap bg-purple-100 text-purple-700"
                >
                  <Calendar size={16} /> 員工排班
                </button>
              )}
            </div>
          </div>

          {/* 主內容區：依 activeTab 顯示對應畫面 */}
          <div>
            {activeTab === 'tasks' && authLevel === 'boss' && <TasksView />}
            {activeTab === 'attendance' && authLevel === 'boss' && <AttendanceView />}
            {activeTab === 'staff_roster' && (authLevel === 'boss' || authLevel === 'manager') && (
              <StaffRosterView authLevel={authLevel} />
            )}
            {activeTab === 'doctor_roster' && authLevel === 'boss' && <DoctorRosterView />}
            {activeTab === 'labor_rules' && authLevel === 'boss' && <LaborRulesView />}
            {activeTab === 'salary' && authLevel === 'boss' && <SalaryView />}
            {activeTab === 'settings' && authLevel === 'boss' && <SettingsView />}
            {activeTab === 'leave' && authLevel === 'boss' && <LeaveView />}
            {activeTab === 'doctor_salary' && authLevel === 'boss' && <DoctorSalaryView />}
            {activeTab === 'salary_report' && authLevel === 'boss' && <SalaryReportView />}
            {activeTab === 'announcements' && authLevel === 'boss' && <AnnouncementsView />}
          </div>
        </div>
      </div>
    </div>
  );
}