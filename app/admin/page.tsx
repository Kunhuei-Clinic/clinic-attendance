'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle, Calendar, Stethoscope, BookOpen, DollarSign, Lock, Settings, FileText, Calculator, FileSpreadsheet } from 'lucide-react';

import StaffRosterView from './StaffRoster';
import DoctorRosterView from './DoctorRoster';
import LaborRulesView from './LaborRules';
import AttendanceView from './AttendanceView';
import SalaryPage from './salary/page'; 
import SettingsView from './SettingsView'; 
import LeaveView from './LeaveView';
import DoctorSalaryPage from './doctor-salary/page';
import SalaryReportView from './SalaryReport'; 

const BOSS_PASSCODE = "1007";    
const MANAGER_PASSCODE = "0000"; 

export default function AdminPage() {
  const [authLevel, setAuthLevel] = useState<'none' | 'boss' | 'manager'>('none');
  const [inputPasscode, setInputPasscode] = useState('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'staff_roster' | 'doctor_roster' | 'labor_rules' | 'salary' | 'settings' | 'leave' | 'doctor_salary' | 'salary_report'>('attendance');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const handleLogin = () => {
    if (inputPasscode === BOSS_PASSCODE) {
      setAuthLevel('boss');
      setActiveTab('attendance'); 
    } else if (inputPasscode === MANAGER_PASSCODE) {
      setAuthLevel('manager');
      setActiveTab('staff_roster'); 
    } else {
      alert('密碼錯誤');
      setInputPasscode('');
    }
  };

  if (!isClient) return null;

  if (authLevel === 'none') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8 text-slate-500" /></div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">後台登入</h2>
          <input type="password" placeholder="Passcode" className="w-full p-3 border rounded-xl text-center text-lg tracking-widest mb-4 outline-none" value={inputPasscode} onChange={(e) => setInputPasscode(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">解鎖</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="max-w-[1600px] mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          診所管理中樞 V29.5
          {authLevel === 'manager' && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">排班模式</span>}
        </h1>
        
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

      <div className="max-w-[1600px] mx-auto">
        {activeTab === 'attendance' && authLevel === 'boss' && <AttendanceView />}
        {activeTab === 'staff_roster' && (authLevel === 'boss' || authLevel === 'manager') && <StaffRosterView authLevel={authLevel} />}
        {activeTab === 'doctor_roster' && authLevel === 'boss' && <DoctorRosterView />}
        {activeTab === 'labor_rules' && authLevel === 'boss' && <LaborRulesView />}
        {activeTab === 'salary' && authLevel === 'boss' && <SalaryPage />}
        {activeTab === 'settings' && authLevel === 'boss' && <SettingsView />}
        {activeTab === 'leave' && authLevel === 'boss' && <LeaveView />}
        {activeTab === 'doctor_salary' && authLevel === 'boss' && <DoctorSalaryPage />}
        {activeTab === 'salary_report' && authLevel === 'boss' && <SalaryReportView />}
      </div>
    </div>
  );
}
