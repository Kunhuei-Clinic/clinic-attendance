'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { CheckCircle, Calendar, Stethoscope, BookOpen, DollarSign, Settings, FileText, Calculator, FileSpreadsheet, LogOut, Bell } from 'lucide-react';

// 建立 Supabase 客戶端（使用 @supabase/ssr 確保 Session 寫入 Cookie）
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ucpkvptnhgbtmghqgbof.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo'
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
  const [activeTab, setActiveTab] = useState<'tasks' | 'attendance' | 'staff_roster' | 'doctor_roster' | 'labor_rules' | 'salary' | 'settings' | 'leave' | 'doctor_salary' | 'salary_report' | 'announcements'>('tasks');
  
  // 🟢 新增：診所名稱 State
  const [clinicName, setClinicName] = useState('診所');

  // 檢查認證狀態
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.authLevel) {
            setAuthLevel(data.authLevel);
            setActiveTab(data.authLevel === 'boss' ? 'tasks' : 'staff_roster');
          } else {
            // 未登入，重定向到登入頁
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

  // 🟢 新增：讀取診所名稱
  useEffect(() => {
    if (!authLevel) return;

    const fetchClinicName = async () => {
      try {
        // 策略 A：嘗試直接從 clinics 資料表讀取 (依賴 RLS 自動過濾)
        const { data: clinicData, error: clinicError } = await supabase
          .from('clinics')
          .select('name')
          .single();
        
        if (!clinicError && clinicData && clinicData.name) {
          setClinicName(clinicData.name);
          return;
        }

        // 策略 B：如果讀不到 (例如權限問題)，嘗試從 Settings API 讀取
        const res = await fetch('/api/settings', {
          credentials: 'include',
        });
        const json = await res.json();
        if (json.data) {
          const setting = json.data.find((s: any) => s.key === 'clinic_name');
          if (setting && setting.value) {
            setClinicName(setting.value);
            return;
          }
        }

        // 如果都失敗，保持預設值「診所」
        console.warn('[AdminPage] 無法讀取診所名稱，使用預設值');
      } catch (e) {
        console.error('[AdminPage] Fetch clinic name error:', e);
        // 發生錯誤時保持預設值「診所」
      }
    };

    fetchClinicName();
  }, [authLevel]);

  // 登出處理（使用 @supabase/ssr 的 createBrowserClient）
  const handleLogout = async () => {
    if (!confirm('確定要登出嗎？')) return;

    try {
      // 使用 Supabase Auth 直接登出（createBrowserClient 會自動清除 Cookie）
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout error:', error);
        alert('登出失敗: ' + error.message);
        return;
      }

      // 登出成功，刷新路由以清除 Server 端的 Session
      router.refresh();
      
      // 跳轉到登入頁
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      alert('登出失敗');
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
          <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              {/* 🟢 修改：動態標題 */}
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight">
                {clinicName}管理系統
                <span className="text-sm font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">V30.0</span>
                {authLevel === 'manager' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">排班模式</span>}
              </h1>
              {authLevel === 'boss' && (
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    activeTab === 'tasks'
                      ? 'bg-teal-100 text-teal-700 border border-teal-300'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                  }`}
                  title="待審核案件"
                >
                  <CheckCircle size={14}/> 待審核
                </button>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-red-100 transition"
                title="登出"
              >
                <LogOut size={16}/> 登出
              </button>
            </div>
            
            <div className="flex bg-white p-1 rounded-xl border shadow-sm overflow-x-auto">
          {authLevel === 'boss' && (
            <>
              <button onClick={() => setActiveTab('attendance')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <CheckCircle size={16}/> 考勤
              </button>
              
              <button onClick={() => setActiveTab('staff_roster')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'staff_roster' ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Calendar size={16}/> 員工排班
              </button>

              <button onClick={() => setActiveTab('doctor_roster')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'doctor_roster' ? 'bg-teal-100 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Stethoscope size={16}/> 醫師排班
              </button>

              <button onClick={() => setActiveTab('leave')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'leave' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <FileText size={16}/> 請假
              </button>
              <button onClick={() => setActiveTab('salary')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'salary' ? 'bg-green-100 text-green-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <DollarSign size={16}/> 員工薪資
              </button>
              <button onClick={() => setActiveTab('doctor_salary')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'doctor_salary' ? 'bg-teal-100 text-teal-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Calculator size={16}/> 醫師薪資
              </button>
              
              <button onClick={() => setActiveTab('salary_report')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'salary_report' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <FileSpreadsheet size={16}/> 人事報表
              </button>

              <button onClick={() => setActiveTab('labor_rules')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'labor_rules' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                <BookOpen size={16}/> 法規
              </button>
              <button onClick={() => setActiveTab('announcements')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'announcements' ? 'bg-yellow-100 text-yellow-700' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Bell size={16}/> 公告
              </button>
              <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap ${activeTab === 'settings' ? 'bg-gray-200 text-gray-800' : 'text-slate-500 hover:bg-slate-50'}`}>
                <Settings size={16}/> 設定
              </button>
            </>
          )}
          
          {authLevel === 'manager' && (
            <button onClick={() => setActiveTab('staff_roster')} className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 whitespace-nowrap bg-purple-100 text-purple-700`}>
              <Calendar size={16}/> 員工排班
            </button>
          )}
        </div>
      </div>

          <div>
            {activeTab === 'tasks' && authLevel === 'boss' && <TasksView />}
            {activeTab === 'attendance' && authLevel === 'boss' && <AttendanceView />}
            {activeTab === 'staff_roster' && (authLevel === 'boss' || authLevel === 'manager') && <StaffRosterView authLevel={authLevel} />}
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
