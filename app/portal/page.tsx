'use client';

import React, { useState, useEffect } from 'react';
import liff from '@line/liff';
import { Clock, Calendar, DollarSign, History, Coffee, User, Lock } from 'lucide-react';
import PortalSalaryView from './components/SalaryView';
import HomeView from './views/HomeView';
import HistoryView, { MissedPunchForm } from './views/HistoryView';
import RosterView from './views/RosterView';
import LeaveView from './views/LeaveView';
import ProfileView from './views/ProfileView';

const LIFF_ID = '2008669814-8OqQmkaL';
const CLINIC_LAT = 25.00606566310205;
const CLINIC_LNG = 121.47745903743363;
const ALLOWED_RADIUS = 150;

const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const deg2rad = (deg: number) => deg * (Math.PI / 180);
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
};

type ViewType = 'home' | 'history' | 'roster' | 'leave' | 'payslip' | 'profile';
type GpsStatus = 'idle' | 'locating' | 'ok' | 'out_of_range' | 'error';
type StepType = 'loading' | 'binding' | 'login' | 'portal';

interface LeaveFormState {
  type: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
}

export default function EmployeePortal() {
  // 🟢 狀態管理
  const [step, setStep] = useState<StepType>('loading');
  const [lineUserId, setLineUserId] = useState<string>('');
  const [clinicId, setClinicId] = useState<string>(''); // 🔑 SaaS：從 URL 讀取的診所 ID
  const [bindForm, setBindForm] = useState({ phone: '', password: '' }); // LINE 綁定用
  const [bindError, setBindError] = useState('');
  const [loginForm, setLoginForm] = useState({ phone: '', password: '' }); // 🟢 手動登入用
  const [loginError, setLoginError] = useState('');

  const [view, setView] = useState<ViewType>('home');
  const [staffUser, setStaffUser] = useState<any>(null);

  const [logs, setLogs] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);

  const [gpsStatus, setGpsStatus] = useState<GpsStatus>('idle');
  const [dist, setDist] = useState(0);
  const [bypassMode, setBypassMode] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );

  const [leaveForm, setLeaveForm] = useState<LeaveFormState>({
    type: '事假',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '18:00',
    reason: '',
  });

  const [leaveStats, setLeaveStats] = useState<any>(null);
  const [staffLeaveInfo, setStaffLeaveInfo] = useState<{
    start_date: string | null;
    annual_leave_history: any;
    annual_leave_quota: number | null;
  } | null>(null);
  const [showAnnualHistory, setShowAnnualHistory] = useState(false);

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [managerStats, setManagerStats] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  const [overtimeSettings, setOvertimeSettings] = useState<{
    threshold: number;
    approvalRequired: boolean;
  } | null>(null);
  const [showOvertimeConfirm, setShowOvertimeConfirm] = useState(false);
  const [pendingClockOut, setPendingClockOut] = useState<{
    lat: number | null;
    lng: number | null;
    isBypass: boolean;
  } | null>(null);

  // 🟢 讀取 Clinic ID：從 URL 參數讀取
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const clinicIdParam = searchParams.get('clinic_id');
      if (clinicIdParam) {
        console.log('[Portal] 從 URL 讀取 clinic_id:', clinicIdParam);
        setClinicId(clinicIdParam);
      } else {
        console.warn('[Portal] ⚠️ URL 中沒有 clinic_id 參數');
      }
    }
  }, []);

  // 🟢 初始化流程：雙軌並行（LIFF 自動登入 / 網頁手動登入）
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. 嘗試初始化 LIFF
        let isInLine = false;
        try {
          await liff.init({ liffId: LIFF_ID });
          isInLine = liff.isInClient() && liff.isLoggedIn();
          
          if (isInLine && !liff.isLoggedIn()) {
            liff.login(); // 在 LINE 內但未登入，觸發登入
            return;
          }
        } catch (liffError) {
          // LIFF 初始化失敗（不在 LINE 內或瀏覽器環境）
          console.log('[Portal] 不在 LINE 環境，使用網頁登入模式');
          isInLine = false;
        }

        // 2. 分支判斷
        if (isInLine) {
          // 🟢 情境 A：在 LINE 內，執行 LINE Check/Bind 流程
          console.log('[Portal] 在 LINE 環境，執行 LINE 綁定流程');
          
          const profile = await liff.getProfile();
          const userId = profile.userId;
          setLineUserId(userId);

          console.log('[Portal] 取得 LINE ID:', userId);

          // 檢查綁定狀態
          const checkRes = await fetch('/api/auth/line-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineUserId: userId }),
            credentials: 'include',
          });

          if (!checkRes.ok) {
            console.error('[Portal] line-check 失敗:', checkRes.status);
            setStep('binding');
            return;
          }

          const checkResult = await checkRes.json();

          if (checkResult.bound && checkResult.staff) {
            // 已綁定：進入系統
            console.log('[Portal] ✅ 已綁定:', checkResult.staff);
            setStaffUser(checkResult.staff);
            setStep('portal');
            
            // 載入資料
            await fetchTodayLogs(checkResult.staff.id);
            await fetchHomeDataWithStaffId(checkResult.staff.id);
          } else {
            // 未綁定：進入綁定模式
            console.log('[Portal] ⚠️ 未綁定，進入綁定模式');
            setStep('binding');
    }
        } else {
          // 🟢 情境 B：在瀏覽器/電腦，使用網頁登入模式
          console.log('[Portal] 在瀏覽器環境，檢查 Cookie');
          
          // 檢查是否已有有效 Cookie
          try {
            const testRes = await fetch('/api/portal/data?type=home', {
              credentials: 'include',
            });
            
            if (testRes.ok) {
              const testResult = await testRes.json();
              if (testResult.data && testResult.data.profile) {
                // 已有有效 Cookie，直接進入系統
                console.log('[Portal] ✅ 已有有效 Cookie，直接進入系統');
                setStaffUser(testResult.data.profile);
                setStep('portal');
                await fetchTodayLogs(testResult.data.profile.id);
                await fetchHomeDataWithStaffId(testResult.data.profile.id);
          return;
        }
            }
      } catch (e) {
            console.log('[Portal] Cookie 檢查失敗，顯示登入頁面');
          }
          
          // 若無有效 Cookie，顯示手動登入介面
          setStep('login');
        }
      } catch (e) {
        console.error('[Portal] 初始化錯誤:', e);
        // 發生錯誤時，顯示手動登入介面
        setStep('login');
      }
    };

    initAuth();
  }, []);

  // 🟢 手動登入動作
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
        body: JSON.stringify({
          phone: loginForm.phone,
          password: loginForm.password,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
      const result = await response.json();
        setLoginError(result.message || '帳號或密碼錯誤');
        return;
      }

      const result = await response.json();

      if (result.success && result.staff) {
        // 登入成功：進入系統
        console.log('[Portal] ✅ 登入成功:', result.staff);
        setStaffUser(result.staff);
        setStep('portal');

        // 載入資料
        await fetchTodayLogs(result.staff.id);
        await fetchHomeDataWithStaffId(result.staff.id);
      } else {
        setLoginError('登入失敗，請稍後再試');
      }
    } catch (error: any) {
      console.error('[Portal] 登入錯誤:', error);
      setLoginError('登入失敗，請稍後再試');
    }
  };

  // 🟢 綁定動作
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
          clinicId, // 🔑 SaaS：帶上診所 ID
        }),
        credentials: 'include', // 🔑 關鍵：帶上 Cookie
      });

      if (!response.ok) {
      const result = await response.json();
        if (response.status === 404) {
          setBindError('找不到員工資料');
        } else if (response.status === 401) {
          setBindError('密碼錯誤');
        } else if (response.status === 409) {
          setBindError('此帳號已被其他 LINE 綁定');
        } else {
          setBindError(result.error || '綁定失敗，請稍後再試');
        }
        return;
      }

      const result = await response.json();

      if (result.success && result.staff) {
        // 綁定成功：進入系統
        console.log('[Portal] ✅ 綁定成功:', result.staff);
        setStaffUser(result.staff);
        setStep('portal');

        // 載入資料
        await fetchTodayLogs(result.staff.id);
        await fetchHomeDataWithStaffId(result.staff.id);
      } else {
        setBindError('綁定失敗，請稍後再試');
      }
    } catch (error: any) {
      console.error('[Portal] 綁定錯誤:', error);
      setBindError('綁定失敗，請稍後再試');
    }
  };

  // 根據 view 抓資料
  useEffect(() => {
    if (!staffUser || step !== 'portal') return;
    if (view === 'history') fetchHistory();
    if (view === 'roster') fetchRoster();
    if (view === 'leave') fetchLeaveHistory();
    if (view === 'home') fetchHomeData();
    if (view === 'profile') fetchProfile();
  }, [view, selectedMonth, staffUser, step]);

  const fetchTodayLogs = async (staffId: number) => {
    try {
      const ym = new Date().toISOString().slice(0, 7);
      const response = await fetch(
        `/api/portal/data?type=history&staffId=${staffId}&month=${ym}`,
        {
          credentials: 'include',
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        return;
      }
      
      const result = await response.json();

      if (result.data) {
        const today = new Date().toISOString().slice(0, 10);
        const todayLogs = result.data.filter(
          (log: any) =>
            log.clock_in_time && log.clock_in_time.startsWith(today),
        );
        setLogs(todayLogs || []);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('讀取打卡記錄失敗:', error);
      setLogs([]);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(
        `/api/portal/data?type=history&staffId=${staffUser.id}&month=${selectedMonth}`,
        {
          credentials: 'include',
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        return;
      }
      
      const result = await response.json();
      setHistoryLogs(result.data || []);
    } catch (error) {
      console.error('讀取歷史記錄失敗:', error);
      setHistoryLogs([]);
    }
  };

  const fetchRoster = async () => {
    try {
      const response = await fetch(
        `/api/portal/data?type=roster&staffId=${staffUser.id}`,
        {
          credentials: 'include',
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        return;
      }
      
      const result = await response.json();

      const sorted = (result.data || []).sort((a: any, b: any) => {
        if (a.date !== b.date) return (a?.date || '').localeCompare(b?.date || '');
        const order: Record<string, number> = { AM: 1, PM: 2, NIGHT: 3 };
        const aOrder = order[a.shift_code] || 999;
        const bOrder = order[b.shift_code] || 999;
        return aOrder - bOrder;
      });

      setRosterData(sorted);
    } catch (error) {
      console.error('讀取班表失敗:', error);
      setRosterData([]);
    }
  };

  const fetchLeaveHistory = async () => {
    try {
      const response = await fetch(
        `/api/portal/data?type=leave&staffId=${staffUser.id}`,
        {
          credentials: 'include',
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        return;
      }
      
      const result = await response.json();

      if (result.data && typeof result.data === 'object' && 'leaves' in result.data) {
        setLeaveHistory(result.data.leaves || []);
        setLeaveStats(result.data.stats || {});
        setStaffLeaveInfo(result.data.staffInfo || null);
      } else {
        setLeaveHistory(result.data || []);
        setLeaveStats({});
        setStaffLeaveInfo(null);
      }
    } catch (error) {
      console.error('讀取請假記錄失敗:', error);
      setLeaveHistory([]);
      setLeaveStats({});
    }
  };

  const fetchHomeDataWithStaffId = async (staffId: number) => {
    try {
      const response = await fetch(
        `/api/portal/data?type=home&staffId=${staffId}`,
        {
          credentials: 'include',
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        return;
      }
      
      const json = await response.json();

      console.log('[Portal] 首頁資料 API 回應:', json);

      const profileData = json.data?.profile || json.profile || null;
      if (profileData) {
        console.log('[Portal] ✅ 設定 Profile:', profileData);
        setProfile(profileData);
        setStaffUser((prev) => (prev ? { ...prev, admin_role: profileData.admin_role } : prev));
      }

      const statsData = json.data?.managerStats ?? json.managerStats ?? null;
      if (statsData) setManagerStats(statsData);
      else setManagerStats(null);

      const announcementData = json.data?.announcements || json.announcements || [];
      if (Array.isArray(announcementData)) {
        console.log('[Portal] ✅ 設定公告:', announcementData.length, '則');
        setAnnouncements(announcementData);
      } else {
        setAnnouncements([]);
      }

      const logsData = json.data?.todayLogs || json.todayLogs || [];
      if (Array.isArray(logsData)) {
        setLogs(logsData);
      }
    } catch (error) {
      console.error('[Portal] 讀取首頁資料失敗:', error);
      setAnnouncements([]);
    }
  };

  const fetchHomeData = async () => {
    if (!staffUser?.id) return;
    await fetchHomeDataWithStaffId(staffUser.id);
  };

  const fetchProfile = async () => {
    if (!staffUser?.id) return;
    try {
      const response = await fetch(
        `/api/portal/data?type=home&staffId=${staffUser.id}`,
        {
          credentials: 'include',
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        return;
      }
      
      const json = await response.json();

      const profileData = json.data?.profile || json.profile || null;
      if (profileData) {
        setProfile(profileData);
      }
    } catch (error) {
      console.error('[Portal] 讀取個人資料失敗:', error);
    }
  };

  const updateProfile = async (payload: {
    phone: string;
    address: string;
    emergency_contact: string;
  }) => {
    try {
      const response = await fetch('/api/staff/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffUser.id,
          phone: payload.phone,
          address: payload.address,
          emergency_contact: payload.emergency_contact,
        }),
        credentials: 'include',
      });

      if (response.status === 401) {
        alert('❌ 請重新登入');
        return;
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || '更新失敗');
      }

      alert('✅ 個人資料已更新');
      
        setProfile((prev: any) =>
          prev
            ? {
                ...prev,
                phone: payload.phone,
                address: payload.address,
                emergency_contact: payload.emergency_contact,
              }
            : prev,
        );
      
      await fetchProfile();
    } catch (error: any) {
      console.error('[Portal] 更新個人資料失敗:', error);
      alert(`❌ ${error.message || '更新失敗，請稍後再試'}`);
    }
  };

  useEffect(() => {
    if (!staffUser) return;
    fetch('/api/settings?type=clinic', {
      credentials: 'include',
    })
      .then((res) => {
        if (res.status === 401) {
          console.error('[Portal] 401 Unauthorized - 請重新登入');
          return { data: null };
        }
        return res.json();
      })
      .then((result) => {
        if (result.data) {
          setOvertimeSettings({
            threshold: result.data.overtime_threshold || 9,
            approvalRequired:
              result.data.overtime_approval_required !== false,
          });
        }
      })
      .catch((err) =>
        console.error('Error fetching overtime settings:', err),
      );
  }, [staffUser]);

  const submitMissedPunch = async (form: MissedPunchForm) => {
    if (!form.date || !form.reason) {
      alert('請填寫日期和原因');
      return;
    }
    if (form.correctionType === 'check_in' && !form.startTime) {
      alert('請填寫上班時間');
      return;
    }
    if (form.correctionType === 'check_out' && !form.endTime) {
      alert('請填寫下班時間');
      return;
    }
    if (
      form.correctionType === 'full' &&
      (!form.startTime || !form.endTime)
    ) {
      alert('補全天請填寫上班和下班時間');
      return;
    }

    let startFull: string | null = null;
    let endFull: string | null = null;
    let leaveType = '';

    if (form.correctionType === 'check_in') {
      startFull = new Date(
        `${form.date}T${form.startTime}`,
      ).toISOString();
      endFull = startFull;
      leaveType = '上班';
    } else if (form.correctionType === 'check_out') {
      startFull = new Date(`${form.date}T09:00`).toISOString();
      endFull = new Date(
        `${form.date}T${form.endTime}`,
      ).toISOString();
      leaveType = '下班';
    } else if (form.correctionType === 'full') {
      startFull = new Date(
        `${form.date}T${form.startTime}`,
      ).toISOString();
      endFull = new Date(
        `${form.date}T${form.endTime}`,
      ).toISOString();
      leaveType = '全天';
    }

    try {
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffUser.id,
          staff_name: staffUser.name,
          type: '補打卡',
          leave_type: leaveType,
          start_time: startFull,
          end_time: endFull,
          hours: 0,
          reason: form.reason,
          status: 'pending',
        }),
        credentials: 'include',
      });
      
      if (response.status === 401) {
        alert('❌ 請重新登入');
        return;
      }

      const result = await response.json();

      if (result.success) {
        alert('✅ 補打卡申請已送出，待主管審核。');
        fetchLeaveHistory();
      } else {
        alert('申請失敗: ' + (result.message || result.error));
      }
    } catch (error: any) {
      console.error('Submit missed punch error:', error);
      alert('申請失敗: ' + error.message);
    }
  };

  const reportAnomaly = async (logId: number) => {
    const reason = prompt('請輸入異常原因 (例如: 忘記打卡)');
    if (!reason) return;

    try {
      const response = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: logId,
          anomaly_reason: reason,
        }),
        credentials: 'include',
      });
      
      if (response.status === 401) {
        alert('❌ 請重新登入');
        return;
      }

      const result = await response.json();
      if (result.success) {
        alert('已送出');
        fetchHistory();
      } else {
        alert('更新失敗: ' + (result.message || result.error));
      }
    } catch (error: any) {
      console.error('Report anomaly error:', error);
      alert('更新失敗: ' + error.message);
    }
  };

  const submitLeave = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate) {
      alert('請填寫完整日期');
      return;
    }
    const startT = new Date(
      `${leaveForm.startDate}T${leaveForm.startTime}`,
    ).toISOString();
    const endT = new Date(
      `${leaveForm.endDate}T${leaveForm.endTime}`,
    ).toISOString();
    const diff =
      (new Date(endT).getTime() - new Date(startT).getTime()) /
      3600000;

    try {
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffUser.id,
          staff_name: staffUser.name,
          type: leaveForm.type,
          start_time: startT,
          end_time: endT,
          hours: diff.toFixed(1),
          reason: leaveForm.reason,
          status: 'pending',
        }),
        credentials: 'include',
      });
      
      if (response.status === 401) {
        alert('❌ 請重新登入');
        return;
      }

      const result = await response.json();

      if (result.success) {
        alert('假單已送出');
        setLeaveForm({ ...leaveForm, reason: '' });
        fetchLeaveHistory();
      } else {
        alert('申請失敗: ' + (result.message || result.error));
      }
    } catch (error: any) {
      console.error('Submit leave error:', error);
      alert('申請失敗: ' + error.message);
    }
  };

  const executeClock = async (action: 'in' | 'out') => {
    const isVip =
      staffUser.role === '醫師' || staffUser.role === '主管';

    if (action === 'out' && logs.length > 0 && logs[0].clock_in_time) {
      const clockInTime = new Date(logs[0].clock_in_time);
      const now = new Date();
      const workHours =
        (now.getTime() - clockInTime.getTime()) /
        (1000 * 60 * 60);
      const threshold = overtimeSettings?.threshold || 9;

      if (workHours > threshold) {
        setPendingClockOut({
          lat: null,
          lng: null,
          isBypass: false,
        });
        setShowOvertimeConfirm(true);
        return;
      }
    }

    if (isVip || bypassMode) {
      await submitLog(action, null, null, bypassMode, false);
      return;
    }
    setGpsStatus('locating');
    if (!navigator.geolocation) {
      alert('GPS 未開');
      setGpsStatus('error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const d = getDist(latitude, longitude, CLINIC_LAT, CLINIC_LNG);
        setDist(Math.round(d));
        if (d <= ALLOWED_RADIUS) {
          setGpsStatus('ok');
          if (
            action === 'out' &&
            logs.length > 0 &&
            logs[0].clock_in_time
          ) {
            const clockInTime = new Date(logs[0].clock_in_time);
            const now = new Date();
            const workHours =
              (now.getTime() - clockInTime.getTime()) /
              (1000 * 60 * 60);
            const threshold = overtimeSettings?.threshold || 9;
            if (workHours > threshold) {
              setPendingClockOut({
                lat: latitude,
                lng: longitude,
                isBypass: false,
              });
              setShowOvertimeConfirm(true);
              return;
            }
          }
          await submitLog(action, latitude, longitude, false, false);
        } else {
          setGpsStatus('out_of_range');
          alert(`距離太遠 (${Math.round(d)}m)`);
        }
      },
      (err) => {
        console.error(err);
        setGpsStatus('error');
        alert('定位失敗');
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  };

  const submitLog = async (
    action: 'in' | 'out',
    lat: number | null,
    lng: number | null,
    isBypass: boolean,
    applyOvertime: boolean = false,
  ) => {
    try {
      if (action === 'in') {
        const response = await fetch('/api/attendance/clock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'in',
            staffId: staffUser.id,
            staffName: staffUser.name,
            gpsLat: lat,
            gpsLng: lng,
            isBypass: isBypass,
          }),
          credentials: 'include',
        });
        
        if (response.status === 401) {
          alert('❌ 請重新登入');
          return;
        }
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '打卡失敗');
        alert('上班打卡成功！');
      } else {
        const lastLog = logs.find((l) => !l.clock_out_time);
        if (!lastLog) {
          alert('無上班紀錄');
          return;
        }

        const response = await fetch('/api/attendance/clock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'out',
            staffId: staffUser.id,
            staffName: staffUser.name,
            logId: lastLog.id,
            gpsLat: lat,
            gpsLng: lng,
            isBypass: isBypass,
            applyOvertime,
          }),
          credentials: 'include',
        });
        
        if (response.status === 401) {
          alert('❌ 請重新登入');
          return;
        }
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '打卡失敗');
        alert('下班打卡成功！');
      }
      await fetchTodayLogs(staffUser.id);
      setGpsStatus('idle');
      setBypassMode(false);
    } catch (err: any) {
      console.error('打卡錯誤:', err);
      alert('錯誤：' + (err.message || '打卡失敗，請重試'));
    }
  };

  const handleOvertimeConfirm = async (apply: boolean) => {
    setShowOvertimeConfirm(false);
    if (pendingClockOut) {
      await submitLog(
        'out',
        pendingClockOut.lat,
        pendingClockOut.lng,
        pendingClockOut.isBypass,
        apply,
      );
      setPendingClockOut(null);
    }
  };

  // 🟢 UI 呈現：Loading
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-bold">系統識別中...</p>
      </div>
    );
  }

  // 🟢 UI 呈現：手動登入 (網頁登入)
  if (step === 'login') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-800">員工系統登入</h2>
          <p className="text-slate-500 mb-6 text-sm">
            請輸入手機號碼和密碼進行登入
          </p>
          
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
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleLogin();
                }}
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
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleLogin();
                }}
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

  // 🟢 UI 呈現：Binding (首次使用 - SaaS 模式)
  if (step === 'binding') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-slate-800">歡迎使用員工系統</h2>
          
          {/* 🔑 SaaS：顯示診所資訊 */}
          {clinicId ? (
            <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-xl">
              <p className="text-sm text-teal-700 font-bold">
                正在綁定至診所代碼：<span className="text-teal-900">{clinicId}</span>
              </p>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 font-bold">
                ⚠️ 無效的連結，請從診所官方帳號選單進入
              </p>
            </div>
          )}

          <p className="text-slate-500 mb-6 text-sm">
            初次使用請輸入手機與預設密碼進行身份綁定
          </p>
          
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
                disabled={!clinicId} // 若無 clinicId，禁用輸入
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
                disabled={!clinicId} // 若無 clinicId，禁用輸入
            />
            </div>
            <button
              onClick={handleBind}
              disabled={!clinicId} // 若無 clinicId，禁用按鈕
              className={`w-full py-4 rounded-xl font-bold shadow-lg mt-4 transition ${
                clinicId
                  ? 'bg-teal-600 text-white hover:bg-teal-700'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              驗證並綁定
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🟢 UI 呈現：Portal (主系統)
  if (step !== 'portal' || !staffUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-400">
        無法取得員工資料
      </div>
    );
  }

  const isWorking = logs.length > 0 && !logs[0].clock_out_time;

  // 加班確認 Modal
  if (showOvertimeConfirm && logs.length > 0 && logs[0].clock_in_time) {
    const clockInTime = new Date(logs[0].clock_in_time);
    const now = new Date();
    const workHours =
      (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
    const threshold = overtimeSettings?.threshold || 9;

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock size={32} className="text-orange-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              加班確認
            </h3>
            <p className="text-sm text-slate-600">
              今日工時已達{' '}
              <span className="font-bold text-orange-600">
                {workHours.toFixed(1)}
              </span>{' '}
              小時。
            </p>
            <p className="text-sm text-slate-700 font-bold mt-2">
              是否申請加班？
            </p>
            <p className="text-xs text-slate-400 mt-1">
              (加班門檻: {threshold} 小時)
            </p>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => handleOvertimeConfirm(true)}
              className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold hover:bg-orange-700 transition"
            >
              是，申請加班
            </button>
            <button
              onClick={() => handleOvertimeConfirm(false)}
              className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300 transition"
            >
              否，正常下班
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 主畫面：各 View + 底部導航
  return (
    <div className="relative">
      {/* Home */}
      {view === 'home' && (
        <HomeView
          staffUser={staffUser}
          isWorking={isWorking}
          logs={logs}
          gpsStatus={gpsStatus}
          announcements={announcements}
          managerStats={managerStats}
          onClockIn={() => executeClock('in')}
          onClockOut={() => executeClock('out')}
          bypassMode={bypassMode}
          setBypassMode={setBypassMode}
        />
      )}

      {/* History */}
      {view === 'history' && (
        <HistoryView
          staffUser={staffUser}
          logs={historyLogs}
          selectedMonth={selectedMonth}
          setSelectedMonth={setSelectedMonth}
          onReportAnomaly={reportAnomaly}
          onSubmitMissedPunch={submitMissedPunch}
        />
      )}

      {/* Roster */}
      {view === 'roster' && (
        <RosterView rosterData={rosterData} staffUser={staffUser} />
      )}

      {/* Leave */}
      {view === 'leave' && (
        <LeaveView
          staffUser={staffUser}
          leaveForm={leaveForm}
          setLeaveForm={setLeaveForm}
          onSubmitLeave={submitLeave}
          leaveHistory={leaveHistory}
          leaveStats={leaveStats}
          staffLeaveInfo={staffLeaveInfo}
          showAnnualHistory={showAnnualHistory}
          setShowAnnualHistory={setShowAnnualHistory}
        />
      )}

      {/* Payslip */}
      {view === 'payslip' && (
        <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
          <div className="p-4">
            <PortalSalaryView user={staffUser} />
          </div>
        </div>
      )}

      {/* Profile */}
      {view === 'profile' && (
        <ProfileView
          user={profile || staffUser}
          staffUser={staffUser}
          onUpdateProfile={updateProfile}
        />
      )}

      {/* 底部 Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-2 pb-6 pb-[env(safe-area-inset-bottom)] flex justify-around items-center text-[10px] font-bold text-slate-400 z-50 max-w-md mx-auto">
        <button
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${
            view === 'home' ? 'text-teal-600 bg-teal-50' : ''
          }`}
        >
          <Clock size={20} />
          打卡
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${
            view === 'history' ? 'text-teal-600 bg-teal-50' : ''
          }`}
        >
          <History size={20} />
          紀錄
        </button>
        <button
          onClick={() => setView('roster')}
          className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${
            view === 'roster' ? 'text-teal-600 bg-teal-50' : ''
          }`}
        >
          <Calendar size={20} />
          班表
        </button>
        <button
          onClick={() => setView('leave')}
          className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${
            view === 'leave' ? 'text-teal-600 bg-teal-50' : ''
          }`}
        >
          <Coffee size={20} />
          請假
        </button>
        <button
          onClick={() => setView('payslip')}
          className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${
            view === 'payslip' ? 'text-teal-600 bg-teal-50' : ''
          }`}
        >
          <DollarSign size={20} />
          薪資
        </button>
        <button
          onClick={() => setView('profile')}
          className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${
            view === 'profile' ? 'text-teal-600 bg-teal-50' : ''
          }`}
        >
          <User size={20} />
          個人
        </button>
      </div>
    </div>
  );
}
