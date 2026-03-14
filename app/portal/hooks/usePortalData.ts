'use client';

import { useState, useEffect } from 'react';
import type { MissedPunchForm } from '../views/HistoryView';

type ViewType = 'home' | 'history' | 'roster' | 'leave' | 'payslip' | 'profile';

interface LeaveFormState {
  type: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
}

export function usePortalData(
  staffUser: any,
  step: string,
  clinicId: string
) {
  const [view, setView] = useState<ViewType>('home');
  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [isViewLoading, setIsViewLoading] = useState(false);

  const [profile, setProfile] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [managerStats, setManagerStats] = useState<any>(null);
  const [clinicSettings, setClinicSettings] = useState<any>({});

  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [rosterData, setRosterData] = useState<any[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
  const [leaveStats, setLeaveStats] = useState<any>(null);
  const [staffLeaveInfo, setStaffLeaveInfo] = useState<any>(null);
  const [showAnnualHistory, setShowAnnualHistory] = useState(false);
  const [leaveForm, setLeaveForm] = useState<LeaveFormState>({
    type: '事假',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '18:00',
    reason: '',
  });

  const [overtimeSettings, setOvertimeSettings] = useState<{
    threshold: number;
    approvalRequired: boolean;
    clockIgnoreGps: boolean;
  } | null>(null);

  const cid = clinicId || staffUser?.clinic_id || '';
  const clinicQ = cid ? `&clinic_id=${encodeURIComponent(cid)}` : '';

  const fetchTodayLogs = async (staffId: string, clinicIdParam?: string) => {
    try {
      const ym = new Date().toISOString().slice(0, 7);
      const q = clinicIdParam ? `&clinic_id=${encodeURIComponent(clinicIdParam)}` : '';
      const response = await fetch(
        `/api/portal/data?type=history&staffId=${staffId}&month=${ym}${q}`,
        { credentials: 'include' }
      );
      if (response.status === 401) return;
      const result = await response.json();
      if (result.data) {
        const today = new Date().toISOString().slice(0, 10);
        const todayLogs = result.data.filter(
          (log: any) => log.clock_in_time && log.clock_in_time.startsWith(today)
        );
        setLogs(todayLogs || []);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('讀取打卡記錄失敗', error);
      setLogs([]);
    }
  };

  const fetchHomeDataWithStaffId = async (
    staffId: string,
    clinicIdParam?: string
  ) => {
    setIsViewLoading(true);
    try {
      const q = clinicIdParam ? `&clinic_id=${encodeURIComponent(clinicIdParam)}` : '';
      const response = await fetch(
        `/api/portal/data?type=home&staffId=${staffId}${q}`,
        { credentials: 'include' }
      );
      if (response.status === 401) return;
      const json = await response.json();
      const profileData = json.data?.profile || json.profile || null;
      if (profileData) {
        setProfile(profileData);
      }
      setManagerStats(json.data?.managerStats ?? json.managerStats ?? null);
      setAnnouncements(
        Array.isArray(json.data?.announcements || json.announcements)
          ? (json.data?.announcements || json.announcements)
          : []
      );
      const logsData = json.data?.todayLogs || json.todayLogs || [];
      if (Array.isArray(logsData)) setLogs(logsData);
      if (json.data?.clinicSettings) setClinicSettings(json.data.clinicSettings);
    } catch (error) {
      console.error('[Portal] 讀取首頁資料失敗', error);
      setAnnouncements([]);
    } finally {
      setIsViewLoading(false);
    }
  };

  const fetchHomeData = async () => {
    if (!staffUser?.id) return;
    await fetchHomeDataWithStaffId(staffUser.id, clinicId || staffUser?.clinic_id);
  };

  const fetchHistory = async () => {
    if (!staffUser?.id) return;
    setIsViewLoading(true);
    try {
      const response = await fetch(
        `/api/portal/data?type=history&staffId=${staffUser.id}&month=${selectedMonth}${clinicQ}`,
        { credentials: 'include' }
      );
      if (response.status === 401) return;
      const result = await response.json();
      setHistoryLogs(result.data || []);
    } catch (error) {
      console.error('讀取歷史記錄失敗', error);
      setHistoryLogs([]);
    } finally {
      setIsViewLoading(false);
    }
  };

  const fetchRoster = async () => {
    if (!staffUser?.id) return;
    try {
      const response = await fetch(
        `/api/portal/data?type=roster&staffId=${staffUser.id}${clinicQ}`,
        { credentials: 'include' }
      );
      if (response.status === 401) return;
      const result = await response.json();
      const sorted = (result.data || []).sort((a: any, b: any) => {
        if (a.date !== b.date) return (a?.date || '').localeCompare(b?.date || '');
        const order: Record<string, number> = { AM: 1, PM: 2, NIGHT: 3 };
        return (order[a.shift_code] || 999) - (order[b.shift_code] || 999);
      });
      setRosterData(sorted);
    } catch (error) {
      console.error('讀取班表失敗', error);
      setRosterData([]);
    }
  };

  const fetchLeaveHistory = async () => {
    if (!staffUser?.id) return;
    setIsViewLoading(true);
    try {
      const response = await fetch(
        `/api/portal/data?type=leave&staffId=${staffUser.id}${clinicQ}`,
        { credentials: 'include' }
      );
      if (response.status === 401) return;
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
      console.error('讀取請假記錄失敗', error);
      setLeaveHistory([]);
      setLeaveStats({});
    } finally {
      setIsViewLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!staffUser?.id) return;
    try {
      const response = await fetch(
        `/api/portal/data?type=home&staffId=${staffUser.id}${clinicQ}`,
        { credentials: 'include' }
      );
      if (response.status === 401) return;
      const json = await response.json();
      const profileData = json.data?.profile || json.profile || null;
      if (profileData) setProfile(profileData);
    } catch (error) {
      console.error('[Portal] 讀取個人資料失敗', error);
    }
  };

  useEffect(() => {
    if (!staffUser?.id || step !== 'portal') return;
    if (view === 'history') fetchHistory();
    if (view === 'roster') fetchRoster();
    if (view === 'leave') fetchLeaveHistory();
    if (view === 'home') fetchHomeData();
    if (view === 'profile') fetchProfile();
  }, [view, selectedMonth, step]);

  useEffect(() => {
    if (!staffUser) return;
    fetch('/api/settings?type=clinic', { credentials: 'include' })
      .then((res) => (res.status === 401 ? { data: null } : res.json()))
      .then((result: any) => {
        if (result?.data) {
          setOvertimeSettings({
            threshold: result.data.overtime_threshold || 9,
            approvalRequired: result.data.overtime_approval_required !== false,
            clockIgnoreGps: result.data.clock_ignore_gps === true,
          });
        }
      })
      .catch((err) => console.error('Error fetching overtime settings', err));
  }, [staffUser]);

  const updateProfile = async (payload: {
    phone: string;
    address: string;
    emergency_contact: string;
  }) => {
    if (!staffUser?.id) return;
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
          : prev
      );
      await fetchProfile();
    } catch (error: any) {
      console.error('[Portal] 更新個人資料失敗', error);
      alert(`❌ ${error.message || '更新失敗，請稍後再試'}`);
    }
  };

  const submitMissedPunch = async (form: MissedPunchForm) => {
    if (!staffUser?.id) return;
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
    if (form.correctionType === 'full' && (!form.startTime || !form.endTime)) {
      alert('補全天請填寫上班和下班時間');
      return;
    }
    // 轉換補打卡類型對應 DB leave_type：上班 / 下班 / 全天
    let leaveType: '上班' | '下班' | '全天' = '上班';
    let startTimeHHmm: string;
    let endTimeHHmm: string;
    if (form.correctionType === 'check_in') {
      leaveType = '上班';
      startTimeHHmm = form.startTime.includes(':') ? form.startTime.slice(0, 5) : form.startTime;
      endTimeHHmm = startTimeHHmm;
    } else if (form.correctionType === 'check_out') {
      leaveType = '下班';
      startTimeHHmm = '09:00';
      endTimeHHmm = form.endTime.includes(':') ? form.endTime.slice(0, 5) : form.endTime;
    } else {
      leaveType = '全天';
      startTimeHHmm = form.startTime.includes(':') ? form.startTime.slice(0, 5) : form.startTime;
      endTimeHHmm = form.endTime.includes(':') ? form.endTime.slice(0, 5) : form.endTime;
    }
    setIsViewLoading(true);
    try {
      const payload = {
        staff_id: staffUser.id,
        staff_name: profile?.name ?? staffUser.name,
        type: '補打卡',
        leave_type: leaveType,
        date: form.date,
        start_time: startTimeHHmm,
        end_time: endTimeHHmm,
        hours: 0,
        reason: form.reason,
        status: 'pending',
      };
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (response.status === 401) {
        alert('❌ 請重新登入');
        return;
      }
      const result = await response.json();
      if (result.success) {
        alert('✅ 補打卡申請已送出，請等待主管簽核。');
        fetchLeaveHistory();
      } else {
        alert('❌ 申請失敗: ' + (result.message || result.error));
      }
    } catch (error: any) {
      alert('❌ 系統錯誤');
    } finally {
      setIsViewLoading(false);
    }
  };

  const reportAnomaly = async (logId: number) => {
    const reason = prompt('請輸入異常原因 (例如: 忘記打卡)');
    if (!reason) return;
    try {
      const response = await fetch('/api/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: logId, anomaly_reason: reason }),
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
      alert('更新失敗: ' + error.message);
    }
  };

  const submitLeave = async () => {
    if (!staffUser?.id) return;
    if (!leaveForm.startDate || !leaveForm.endDate) {
      alert('請填寫完整日期');
      return;
    }
    const startT = new Date(
      `${leaveForm.startDate}T${leaveForm.startTime}`
    ).toISOString();
    const endT = new Date(
      `${leaveForm.endDate}T${leaveForm.endTime}`
    ).toISOString();
    const diff =
      (new Date(endT).getTime() - new Date(startT).getTime()) / 3600000;
    setIsViewLoading(true);
    try {
      const payload = {
        staff_id: staffUser.id,
        staff_name: profile?.name ?? staffUser.name,
        type: leaveForm.type,
        start_time: startT,
        end_time: endT,
        hours: Number(diff.toFixed(1)),
        reason: leaveForm.reason || '',
        status: 'pending',
      };
      const response = await fetch('/api/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      alert('申請失敗: ' + error.message);
    } finally {
      setIsViewLoading(false);
    }
  };

  return {
    view,
    setView,
    selectedMonth,
    setSelectedMonth,
    isViewLoading,
    profile,
    setProfile,
    announcements,
    logs,
    managerStats,
    clinicSettings,
    historyLogs,
    rosterData,
    leaveHistory,
    leaveStats,
    staffLeaveInfo,
    leaveForm,
    setLeaveForm,
    showAnnualHistory,
    setShowAnnualHistory,
    overtimeSettings,
    fetchTodayLogs,
    fetchHomeDataWithStaffId,
    fetchHistory,
    fetchRoster,
    fetchLeaveHistory,
    fetchProfile,
    updateProfile,
    submitMissedPunch,
    reportAnomaly,
    submitLeave,
  };
}
