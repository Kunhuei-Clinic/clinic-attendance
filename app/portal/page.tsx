'use client';

import React, { useState, useEffect, useRef } from 'react';
import liff from '@line/liff';
import { Clock, User, Lock } from 'lucide-react';
import PortalSalaryView from './components/SalaryView';
import BottomNav from './components/BottomNav';
import PortalHomeView from './views/PortalHomeView';
import PortalHistoryView from './views/PortalHistoryView';
import PortalRosterView from './views/PortalRosterView';
import PortalLeaveView from './views/PortalLeaveView';
import PortalProfileView from './views/PortalProfileView';
import { usePortalData } from './hooks/usePortalData';
import { useClocking } from './hooks/useClocking';

const LIFF_ID = '2008669814-8OqQmkaL';

type StepType = 'loading' | 'binding' | 'login' | 'portal';

export default function EmployeePortal() {
  const [step, setStep] = useState<StepType>('loading');
  const [lineUserId, setLineUserId] = useState<string>('');
  const [clinicId, setClinicId] = useState<string>('');
  const [bindForm, setBindForm] = useState({ phone: '', password: '' });
  const [bindError, setBindError] = useState('');
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [staffUser, setStaffUser] = useState<any>(null);

  const portalData = usePortalData(staffUser, step, clinicId);
  const isWorking =
    portalData.logs.length > 0 && !portalData.logs[0].clock_out_time;

  const clocking = useClocking({
    staffUser: portalData.profile || staffUser,
    profile: portalData.profile,
    clinicSettings: portalData.clinicSettings,
    logs: portalData.logs,
    overtimeSettings: portalData.overtimeSettings,
    isWorking,
    clinicId,
    onSuccess: () => {
      if (staffUser?.id) {
        portalData.fetchTodayLogs(
          staffUser.id,
          staffUser.clinic_id || clinicId
        );
        portalData.fetchHomeDataWithStaffId(
          staffUser.id,
          staffUser.clinic_id || clinicId
        );
      }
    },
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const c = searchParams.get('clinic_id');
      if (c) setClinicId(c);
    }
  }, []);

  const hasInitialLoaded = useRef(false);
  useEffect(() => {
    if (step !== 'portal') hasInitialLoaded.current = false;
  }, [step]);
  useEffect(() => {
    if (
      step === 'portal' &&
      staffUser?.id &&
      !hasInitialLoaded.current
    ) {
      hasInitialLoaded.current = true;
      portalData.fetchTodayLogs(staffUser.id, staffUser.clinic_id || clinicId);
      portalData.fetchHomeDataWithStaffId(
        staffUser.id,
        staffUser.clinic_id || clinicId
      );
    }
  }, [step, staffUser?.id]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        let isInLine = false;
        try {
          await liff.init({ liffId: LIFF_ID });
          isInLine = liff.isInClient() && liff.isLoggedIn();
          if (isInLine && !liff.isLoggedIn()) {
            liff.login();
            return;
          }
        } catch {
          isInLine = false;
        }

        if (isInLine) {
          const profile = await liff.getProfile();
          setLineUserId(profile.userId);
          const checkRes = await fetch('/api/auth/line-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineUserId: profile.userId }),
            credentials: 'include',
          });
          if (!checkRes.ok) {
            setStep('binding');
            return;
          }
          const checkResult = await checkRes.json();
          if (checkResult.bound && checkResult.staff) {
            setStaffUser(checkResult.staff);
            if (checkResult.staff.clinic_id)
              setClinicId(checkResult.staff.clinic_id);
            setStep('portal');
          } else {
            setStep('binding');
          }
        } else {
          const urlClinicId =
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('clinic_id')
              : null;
          const homeQuery = urlClinicId
            ? `?type=home&clinic_id=${encodeURIComponent(urlClinicId)}`
            : '?type=home';
          try {
            const testRes = await fetch(`/api/portal/data${homeQuery}`, {
              credentials: 'include',
            });
            if (testRes.ok) {
              const testResult = await testRes.json();
              if (testResult.data?.profile) {
                const profile = testResult.data.profile;
                setStaffUser(profile);
                if (profile.clinic_id) setClinicId(profile.clinic_id);
                setStep('portal');
                return;
              }
            }
          } catch {}
          setStep('login');
        }
      } catch (e) {
        console.error('[Portal] 初始化錯誤', e);
        setStep('login');
      }
    };
    initAuth();
  }, []);

  const handleLogin = async () => {
    if (!loginForm.phone || !loginForm.password) {
      setLoginError('請輸入手機號碼和密碼');
      return;
    }
    setLoginError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        setLoginError(result.message || '帳號或密碼錯誤');
        return;
      }
      if (result.success && result.staff) {
        setStaffUser(result.staff);
        if (result.staff.clinic_id) setClinicId(result.staff.clinic_id);
        setStep('portal');
      } else {
        setLoginError('登入失敗，請稍後再試');
      }
    } catch {
      setLoginError('登入失敗，請稍後再試');
    }
  };

  const handleBind = async () => {
    if (!bindForm.phone || !bindForm.password) {
      setBindError('請輸入手機號碼和密碼');
      return;
    }
    if (!lineUserId) {
      setBindError('無法取得 LINE 帳號資訊，請重新整理頁面');
      return;
    }
    if (!clinicId) {
      setBindError('無效的連結，請從診所官方帳號選單進入');
      return;
    }
    setBindError('');
    try {
      const response = await fetch('/api/auth/line-bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineUserId,
          phone: bindForm.phone,
          password: bindForm.password,
          clinicId,
        }),
        credentials: 'include',
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 404) setBindError('找不到員工資料');
        else if (response.status === 401) setBindError('密碼錯誤');
        else if (response.status === 409)
          setBindError('此帳號已被其他 LINE 綁定');
        else setBindError(result.error || '綁定失敗，請稍後再試');
        return;
      }
      if (result.success && result.staff) {
        setStaffUser(result.staff);
        if (result.staff.clinic_id) setClinicId(result.staff.clinic_id);
        setStep('portal');
      } else {
        setBindError('綁定失敗，請稍後再試');
      }
    } catch {
      setBindError('綁定失敗，請稍後再試');
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-bold">系統識別中...</p>
      </div>
    );
  }

  if (step === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-800">員工系統登入</h2>
          <p className="text-slate-500 mb-6 text-sm">請輸入手機號碼和密碼進行登入</p>
          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {loginError}
            </div>
          )}
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">手機號碼</label>
              <input
                type="tel"
                value={loginForm.phone}
                onChange={(e) => {
                  setLoginForm({ ...loginForm, phone: e.target.value });
                  if (loginError) setLoginError('');
                }}
                className="w-full p-3 border rounded-xl bg-slate-50 font-bold"
                placeholder="例如：0912345678"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">密碼</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => {
                  setLoginForm({ ...loginForm, password: e.target.value });
                  if (loginError) setLoginError('');
                }}
                className="w-full p-3 border rounded-xl bg-slate-50 font-bold"
                placeholder="請輸入密碼"
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg mt-4 hover:bg-blue-700 transition"
            >
              登入
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'binding') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-800">歡迎使用員工系統</h2>
          {clinicId ? (
            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <p className="text-sm text-teal-700 font-bold">
                正在綁定至診所代碼：<span className="text-teal-900">{clinicId}</span>
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-bold">⚠️ 無效的連結，請從診所官方帳號選單進入</p>
            </div>
          )}
          <p className="text-slate-500 mb-6 text-sm">初次使用請輸入手機與預設密碼進行身份綁定</p>
          {bindError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {bindError}
            </div>
          )}
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">手機號碼</label>
              <input
                type="tel"
                value={bindForm.phone}
                onChange={(e) => setBindForm({ ...bindForm, phone: e.target.value })}
                className="w-full p-3 border rounded-xl bg-slate-50 font-bold"
                placeholder="例如：0912345678"
                disabled={!clinicId}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">預設密碼</label>
              <input
                type="password"
                value={bindForm.password}
                onChange={(e) => setBindForm({ ...bindForm, password: e.target.value })}
                className="w-full p-3 border rounded-xl bg-slate-50 font-bold"
                placeholder="預設為 0000"
                disabled={!clinicId}
              />
            </div>
            <button
              onClick={handleBind}
              disabled={!clinicId}
              className={`w-full py-4 rounded-xl font-bold shadow-lg mt-4 transition ${
                clinicId ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              驗證並綁定
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step !== 'portal' || !staffUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-400">
        無法取得員工資料
      </div>
    );
  }

  if (clocking.showOvertimeConfirm && portalData.logs.length > 0 && portalData.logs[0].clock_in_time) {
    const clockInTime = new Date(portalData.logs[0].clock_in_time);
    const workHours =
      (Date.now() - clockInTime.getTime()) / (1000 * 60 * 60);
    const threshold = portalData.overtimeSettings?.threshold || 9;
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={32} className="text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">加班確認</h3>
            <p className="text-sm text-slate-600">
              今日工時已達 <span className="font-bold text-orange-600">{workHours.toFixed(1)}</span> 小時。
            </p>
            <p className="text-sm text-slate-700 font-bold mt-2">是否申請加班？</p>
            <p className="text-xs text-slate-400 mt-1">(加班門檻: {threshold} 小時)</p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => clocking.handleOvertimeConfirm(true)}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition"
            >
              是，申請加班
            </button>
            <button
              onClick={() => clocking.handleOvertimeConfirm(false)}
              className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition"
            >
              否，正常下班
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {portalData.isViewLoading && (
        <div className="fixed inset-0 z-[100] bg-slate-50/60 backdrop-blur-[2px] flex flex-col items-center justify-center pb-20 transition-all duration-300">
          <div className="w-12 h-12 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin shadow-lg" />
          <span className="mt-4 text-teal-800 font-bold tracking-widest text-sm animate-pulse">資料同步中...</span>
        </div>
      )}

      {portalData.view === 'home' && (
        <PortalHomeView
          staffUser={portalData.profile || staffUser}
          isWorking={isWorking}
          logs={portalData.logs}
          gpsStatus={clocking.gpsStatus}
          announcements={portalData.announcements}
          managerStats={portalData.managerStats}
          isPunching={clocking.isPunching}
          onClockIn={() => clocking.executeClock('in')}
          onClockOut={() => clocking.executeClock('out')}
          onScanClock={clocking.onScanClock}
          bypassMode={clocking.bypassMode}
          setBypassMode={clocking.setBypassMode}
        />
      )}

      {portalData.view === 'history' && (
        <PortalHistoryView
          staffUser={staffUser}
          logs={portalData.historyLogs}
          selectedMonth={portalData.selectedMonth}
          setSelectedMonth={portalData.setSelectedMonth}
          onReportAnomaly={portalData.reportAnomaly}
          onSubmitMissedPunch={portalData.submitMissedPunch}
        />
      )}

      {portalData.view === 'roster' && (
        <PortalRosterView rosterData={portalData.rosterData} staffUser={staffUser} />
      )}

      {portalData.view === 'leave' && (
        <PortalLeaveView
          staffUser={staffUser}
          leaveForm={portalData.leaveForm}
          setLeaveForm={portalData.setLeaveForm}
          onSubmitLeave={portalData.submitLeave}
          leaveHistory={portalData.leaveHistory}
          leaveStats={portalData.leaveStats}
          staffLeaveInfo={portalData.staffLeaveInfo}
          showAnnualHistory={portalData.showAnnualHistory}
          setShowAnnualHistory={portalData.setShowAnnualHistory}
        />
      )}

      {portalData.view === 'payslip' && (
        <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
          <div className="p-4">
            <PortalSalaryView user={staffUser} />
          </div>
        </div>
      )}

      {portalData.view === 'profile' && (
        <PortalProfileView
          user={portalData.profile || staffUser}
          staffUser={staffUser}
          onUpdateProfile={portalData.updateProfile}
        />
      )}

      <BottomNav view={portalData.view} setView={portalData.setView} />
    </div>
  );
}
