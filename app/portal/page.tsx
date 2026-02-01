'use client';

import React, { useState, useEffect } from 'react';
import liff from '@line/liff';
import { Clock, Calendar, DollarSign, History, Coffee, User } from 'lucide-react';
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

interface LeaveFormState {
  type: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
}

export default function EmployeePortal() {
  const [view, setView] = useState<ViewType>('home');
  const [status, setStatus] = useState<'loading' | 'bind_needed' | 'ready' | 'error'>(
    'loading',
  );
  const [staffUser, setStaffUser] = useState<any>(null);
  const [unboundList, setUnboundList] = useState<any[]>([]);
  const [bindForm, setBindForm] = useState({ id: '', password: '' });

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

  // 🟢 首頁資料預先載入：用於剛綁定完成時馬上取得公告與個人資料
  async function prefetchHomeData(staffId: number) {
    try {
      const response = await fetch(
        `/api/portal/data?type=home&staffId=${staffId}`,
        {
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        window.location.href = '/login';
        return;
      }
      
      const json = await response.json();

      console.log('[Portal] 預先載入 API 回應:', json);

      // 🟢 強健的資料解析：兼容不同的 API 回傳結構
      // 1. 處理個人資料 (相容多種結構)
      const profileData = json.data?.profile || json.profile || null;
      if (profileData) {
        console.log('[Portal] ✅ 設定 Profile:', profileData);
        setProfile(profileData);
      } else {
        console.warn('[Portal] ⚠️ API 未回傳 profile 資料');
      }

      // 2. 處理公告 (相容多種結構)
      const announcementData = json.data?.announcements || json.announcements || [];
      if (Array.isArray(announcementData)) {
        console.log('[Portal] ✅ 設定公告:', announcementData.length, '則');
        setAnnouncements(announcementData);
      } else {
        console.warn('[Portal] ⚠️ 公告資料格式不正確:', announcementData);
        setAnnouncements([]);
      }
    } catch (error) {
      console.error('[Portal] 預先讀取首頁資料失敗:', error);
      setAnnouncements([]);
    }
  }

  // LIFF 初始化與綁定
  useEffect(() => {
    const initLiff = async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const liffProfile = await liff.getProfile();
        checkBinding(liffProfile.userId);
      } catch (e) {
        console.error(e);
        setStatus('error');
      }
    };
    setTimeout(initLiff, 100);
  }, []);

  const checkBinding = async (lineId: string) => {
    try {
      const response = await fetch(`/api/portal/auth?lineUserId=${lineId}`, {
        credentials: 'include', // 🔑 關鍵：帶上 Cookie
      });
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();

      if (result.status === 'bound' && result.staff) {
        setStaffUser(result.staff);
        setStatus('ready');
        fetchTodayLogs(result.staff.id);
        // 首次綁定成功後立即載入首頁資料（含公告）
        prefetchHomeData(result.staff.id);
      } else if (result.status === 'unbound' && result.unboundList) {
        setUnboundList(result.unboundList || []);
        setStatus('bind_needed');
      } else {
        console.error('Unknown binding status:', result);
        setStatus('error');
      }
    } catch (error) {
      console.error('Check binding error:', error);
      setStatus('error');
    }
  };

  const handleBind = async () => {
    if (!bindForm.id || !bindForm.password) {
      alert('請選擇姓名並輸入密碼');
      return;
    }

    try {
      const liffProfile = await liff.getProfile();
      const response = await fetch('/api/portal/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: Number(bindForm.id),
          password: bindForm.password,
          lineUserId: liffProfile.userId,
        }),
        credentials: 'include', // 🔑 關鍵：帶上 Cookie
      });

      const result = await response.json();

      if (result.success) {
        window.location.reload();
      } else {
        alert(result.message || '綁定失敗');
      }
    } catch (error) {
      console.error('Bind error:', error);
      alert('綁定失敗，請稍後再試');
    }
  };

  // 根據 view 抓資料
  useEffect(() => {
    if (!staffUser) return;
    if (view === 'history') fetchHistory();
    if (view === 'roster') fetchRoster();
    if (view === 'leave') fetchLeaveHistory();
    if (view === 'home') fetchHomeData();
    if (view === 'profile') fetchProfile();
  }, [view, selectedMonth, staffUser]);

  const fetchTodayLogs = async (staffId: number) => {
    try {
      const ym = new Date().toISOString().slice(0, 7);
      const response = await fetch(
        `/api/portal/data?type=history&staffId=${staffId}&month=${ym}`,
        {
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        window.location.href = '/login';
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
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        window.location.href = '/login';
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
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        window.location.href = '/login';
        return;
      }
      
      const result = await response.json();

      const sorted = (result.data || []).sort((a: any, b: any) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
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
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        window.location.href = '/login';
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

  // 🟢 強健的資料讀取：兼容不同的 API 回傳結構
  const fetchHomeData = async () => {
    if (!staffUser?.id) return;
    try {
      const response = await fetch(
        `/api/portal/data?type=home&staffId=${staffUser.id}`,
        {
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        window.location.href = '/login';
        return;
      }
      
      const json = await response.json();

      console.log('[Portal] 首頁資料 API 回應:', json);

      // 🟢 強健的資料解析：兼容不同的 API 回傳結構
      // 1. 處理個人資料 (相容多種結構)
      const profileData = json.data?.profile || json.profile || null;
      if (profileData) {
        console.log('[Portal] ✅ 設定 Profile:', profileData);
        setProfile(profileData);
      } else {
        console.warn('[Portal] ⚠️ API 未回傳 profile 資料');
      }

      // 2. 處理公告 (相容多種結構)
      const announcementData = json.data?.announcements || json.announcements || [];
      if (Array.isArray(announcementData)) {
        console.log('[Portal] ✅ 設定公告:', announcementData.length, '則');
        setAnnouncements(announcementData);
      } else {
        console.warn('[Portal] ⚠️ 公告資料格式不正確:', announcementData);
        setAnnouncements([]);
      }

      // 3. 處理打卡狀態
      const logsData = json.data?.todayLogs || json.todayLogs || [];
      if (Array.isArray(logsData)) {
        setLogs(logsData);
        const lastLog = logsData[0];
        if (lastLog && lastLog.clock_in && !lastLog.clock_out) {
          setIsWorking(true);
        } else {
          setIsWorking(false);
        }
      }
    } catch (error) {
      console.error('[Portal] 讀取首頁資料失敗:', error);
      setAnnouncements([]);
    }
  };

  // 🟢 強健的個人資料讀取
  const fetchProfile = async () => {
    if (!staffUser?.id) return;
    try {
      const response = await fetch(
        `/api/portal/data?type=home&staffId=${staffUser.id}`,
        {
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        }
      );
      
      if (response.status === 401) {
        console.error('[Portal] 401 Unauthorized - 請重新登入');
        window.location.href = '/login';
        return;
      }
      
      const json = await response.json();

      console.log('[Portal] 個人資料 API 回應:', json);

      // 🟢 強健的資料解析：兼容不同的 API 回傳結構
      const profileData = json.data?.profile || json.profile || null;
      if (profileData) {
        console.log('[Portal] ✅ 設定 Profile:', profileData);
        setProfile(profileData);
      } else {
        console.warn('[Portal] ⚠️ API 未回傳 profile 資料');
      }
    } catch (error) {
      console.error('[Portal] 讀取個人資料失敗:', error);
    }
  };

  // 🟢 實作更新個人資料（使用專用的 /api/staff/profile 端點）
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
        credentials: 'include', // 🔑 關鍵：帶上 Cookie
      });

      if (response.status === 401) {
        alert('❌ 請重新登入');
        window.location.href = '/login';
        return;
      }

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || '更新失敗');
      }

      alert('✅ 個人資料已更新');
      
      // 更新本地 state
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
      
      // 刷新資料
      await fetchProfile();
    } catch (error: any) {
      console.error('[Portal] 更新個人資料失敗:', error);
      alert(`❌ ${error.message || '更新失敗，請稍後再試'}`);
    }
  };

  // 取得加班設定
  useEffect(() => {
    if (!staffUser) return;
    fetch('/api/settings?type=clinic', {
      credentials: 'include', // 🔑 關鍵：帶上 Cookie
    })
      .then((res) => {
        if (res.status === 401) {
          console.error('[Portal] 401 Unauthorized - 請重新登入');
          window.location.href = '/login';
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
        credentials: 'include', // 🔑 關鍵：帶上 Cookie
      });
      
      if (response.status === 401) {
        alert('❌ 請重新登入');
        window.location.href = '/login';
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
        credentials: 'include', // 🔑 關鍵：帶上 Cookie
      });
      
      if (response.status === 401) {
        alert('❌ 請重新登入');
        window.location.href = '/login';
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
        credentials: 'include', // 🔑 關鍵：帶上 Cookie
      });
      
      if (response.status === 401) {
        alert('❌ 請重新登入');
        window.location.href = '/login';
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
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        });
        
        if (response.status === 401) {
          alert('❌ 請重新登入');
          window.location.href = '/login';
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
          credentials: 'include', // 🔑 關鍵：帶上 Cookie
        });
        
        if (response.status === 401) {
          alert('❌ 請重新登入');
          window.location.href = '/login';
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

  // 狀態頁
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-slate-400 font-bold">系統載入中...</p>
      </div>
    );
  }

  if (status === 'bind_needed') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
          <User className="w-16 h-16 text-teal-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">員工綁定 (V33.0)</h2>
          <p className="text-slate-500 mb-6 text-sm">
            請選擇姓名並輸入密碼
          </p>
          <div className="space-y-4 text-left">
            <select
              className="w-full p-3 border rounded-xl bg-slate-50 font-bold"
              value={bindForm.id}
              onChange={(e) =>
                setBindForm({ ...bindForm, id: e.target.value })
              }
            >
              <option value="">請選擇...</option>
              {unboundList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="password"
              value={bindForm.password}
              onChange={(e) =>
                setBindForm({ ...bindForm, password: e.target.value })
              }
              className="w-full p-3 border rounded-xl bg-slate-50 font-bold"
              placeholder="密碼 (預設為生日四碼)"
            />
            <button
              onClick={handleBind}
              className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold shadow-lg mt-4"
            >
              確認綁定
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!staffUser) {
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

