'use client';

import React, { useState, useEffect } from 'react';
import liff from '@line/liff';
import { Clock, Calendar, DollarSign, MapPin, AlertTriangle, History, FileText, Coffee, ChevronRight, X, User, PlusCircle, Bell, Edit2, Save } from 'lucide-react';
import PortalSalaryView from './components/SalaryView';

const LIFF_ID = '2008669814-8OqQmkaL'; 
const CLINIC_LAT = 25.00606566310205; 
const CLINIC_LNG = 121.47745903743363;
const ALLOWED_RADIUS = 150; 

const getTodayStr = () => new Date().toLocaleDateString('zh-TW');
const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '--:--';
const formatDateTime = (iso: string) => iso ? new Date(iso).toLocaleString('zh-TW', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
const getStatusLabel = (status: string) => {
    if (status === 'pending') return '審核中';
    if (status === 'approved') return '已通過';
    if (status === 'rejected') return '已駁回';
    return status;
};
const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const deg2rad = (deg: number) => deg * (Math.PI/180);
    var R = 6371; var dLat = deg2rad(lat2-lat1); var dLon = deg2rad(lon2-lon1); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c * 1000;
};

export default function EmployeePortal() {
  const [view, setView] = useState<'home' | 'history' | 'roster' | 'leave' | 'payslip' | 'profile'>('home');
  const [status, setStatus] = useState<'loading' | 'bind_needed' | 'ready' | 'error'>('loading');
  const [staffUser, setStaffUser] = useState<any>(null);
  const [unboundList, setUnboundList] = useState<any[]>([]);
  const [bindForm, setBindForm] = useState({ id: '', password: '' });

  const [logs, setLogs] = useState<any[]>([]); 
  const [historyLogs, setHistoryLogs] = useState<any[]>([]); 
  const [rosterData, setRosterData] = useState<any[]>([]); 
  const [leaveHistory, setLeaveHistory] = useState<any[]>([]); 
  const [salaryList, setSalaryList] = useState<any[]>([]); 
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'out_of_range' | 'error'>('idle');
  const [dist, setDist] = useState(0);
  const [bypassMode, setBypassMode] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const [leaveForm, setLeaveForm] = useState({ type: '事假', startDate: '', startTime: '09:00', endDate: '', endTime: '18:00', reason: '' });
  
  // 🟢 修正：補打卡表單 (新增補登項目選擇器)
  const [showMissedPunch, setShowMissedPunch] = useState(false);
  const [missedForm, setMissedForm] = useState({ 
    date: '', 
    startTime: '', 
    endTime: '', 
    correctionType: 'check_in' as 'check_in' | 'check_out' | 'full', 
    reason: '' 
  });
  
  // 🟢 新增：請假統計資料
  const [leaveStats, setLeaveStats] = useState<any>(null);
  const [staffLeaveInfo, setStaffLeaveInfo] = useState<{ start_date: string | null; annual_leave_history: any; annual_leave_quota: number | null } | null>(null);
  const [showAnnualHistory, setShowAnnualHistory] = useState(false);
  
  // 🟢 新增：公告和個人資料
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ phone: '', address: '', emergency_contact: '' });

  useEffect(() => {
    const initLiff = async () => {
        try {
            await liff.init({ liffId: LIFF_ID });
            if (!liff.isLoggedIn()) { liff.login(); return; }
            const profile = await liff.getProfile();
            checkBinding(profile.userId);
        } catch (e) { console.error(e); setStatus('error'); }
    };
    setTimeout(initLiff, 100);
  }, []);

  const checkBinding = async (lineId: string) => {
      try {
          const response = await fetch(`/api/portal/auth?lineUserId=${lineId}`);
          const result = await response.json();
          
          if (result.status === 'bound' && result.staff) {
              // 已綁定，設定員工資料
              setStaffUser(result.staff);
              setStatus('ready');
              fetchTodayLogs(result.staff.id);
          } else if (result.status === 'unbound' && result.unboundList) {
              // 未綁定，顯示綁定選單
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
      if (!bindForm.id || !bindForm.password) return alert('請選擇姓名並輸入密碼');
      
      try {
          const profile = await liff.getProfile();
          const response = await fetch('/api/portal/auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  staffId: Number(bindForm.id),
                  password: bindForm.password,
                  lineUserId: profile.userId
              })
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

  useEffect(() => {
      if (!staffUser) return;
      if (view === 'history') fetchHistory();
      if (view === 'roster') fetchRoster();
      if (view === 'leave') fetchLeaveHistory();
      if (view === 'payslip') fetchSalaryHistory();
      if (view === 'home') fetchHomeData();
      if (view === 'profile') fetchProfile();
  }, [view, selectedMonth, staffUser]);

  const fetchTodayLogs = async (staffId: number) => {
      try {
          const today = new Date().toISOString().slice(0, 7); // YYYY-MM
          const response = await fetch(`/api/portal/data?type=history&staffId=${staffId}&month=${today}`);
          const result = await response.json();
          
          if (result.data) {
              // 過濾出今天的記錄
              const today = new Date().toISOString().slice(0, 10);
              const todayLogs = result.data.filter((log: any) => 
                  log.clock_in_time && log.clock_in_time.startsWith(today)
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
          const response = await fetch(`/api/portal/data?type=history&staffId=${staffUser.id}&month=${selectedMonth}`);
          const result = await response.json();
          setHistoryLogs(result.data || []);
      } catch (error) {
          console.error('讀取歷史記錄失敗:', error);
          setHistoryLogs([]);
      }
  };

  const fetchRoster = async () => {
      try {
          // 不傳 month 參數，會自動查詢今天之後的資料
          const response = await fetch(`/api/portal/data?type=roster&staffId=${staffUser.id}`);
          const result = await response.json();
          
          // 🟢 優化：排序班表資料（按日期，同日期內按 AM -> PM -> NIGHT）
          const sorted = (result.data || []).sort((a: any, b: any) => {
              // 先按日期排序
              if (a.date !== b.date) {
                  return a.date.localeCompare(b.date);
              }
              // 同日期內按診別排序
              const order: Record<string, number> = { 'AM': 1, 'PM': 2, 'NIGHT': 3 };
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

  const fetchSalaryHistory = async () => {
      try {
          const response = await fetch(`/api/portal/data?type=salary&staffId=${staffUser.id}`);
          const result = await response.json();
          
          // 格式化資料以符合現有的顯示邏輯
          const formatted = (result.data || []).map((item: any) => {
              if (staffUser.role === '醫師') {
                  return {
                      id: item.id,
                      year_month: item.paid_in_month,
                      is_doctor_ppf: true,
                      data: item
                  };
              } else {
                  return {
                      id: item.id,
                      year_month: item.year_month,
                      is_doctor_ppf: false,
                      snapshot: item.snapshot
                  };
              }
          });
          setSalaryList(formatted);
      } catch (error) {
          console.error('讀取薪資歷史失敗:', error);
          setSalaryList([]);
      }
  };

  const fetchLeaveHistory = async () => {
      try {
          const response = await fetch(`/api/portal/data?type=leave&staffId=${staffUser.id}`);
          const result = await response.json();
          
          // 🟢 新增：處理新的 API 回傳格式（包含 leaves、stats 和 staffInfo）
          if (result.data && typeof result.data === 'object' && 'leaves' in result.data) {
              setLeaveHistory(result.data.leaves || []);
              setLeaveStats(result.data.stats || {});
              setStaffLeaveInfo(result.data.staffInfo || null);
          } else {
              // 向後兼容：如果 API 回傳的是舊格式（直接是陣列）
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

  // 🟢 新增：取得首頁資料（公告 + 個人資料）
  const fetchHomeData = async () => {
      try {
          const response = await fetch(`/api/portal/data?type=home&staffId=${staffUser.id}`);
          const result = await response.json();
          
          if (result.data) {
              setAnnouncements(result.data.announcements || []);
              if (result.data.profile) {
                  setProfile(result.data.profile);
                  setProfileForm({
                      phone: result.data.profile.phone || '',
                      address: result.data.profile.address || '',
                      emergency_contact: result.data.profile.emergency_contact || ''
                  });
              }
          }
      } catch (error) {
          console.error('讀取首頁資料失敗:', error);
          setAnnouncements([]);
      }
  };

  // 🟢 新增：取得個人資料
  const fetchProfile = async () => {
      try {
          const response = await fetch(`/api/portal/data?type=home&staffId=${staffUser.id}`);
          const result = await response.json();
          
          if (result.data && result.data.profile) {
              setProfile(result.data.profile);
              setProfileForm({
                  phone: result.data.profile.phone || '',
                  address: result.data.profile.address || '',
                  emergency_contact: result.data.profile.emergency_contact || ''
              });
          }
      } catch (error) {
          console.error('讀取個人資料失敗:', error);
      }
  };

  // 🟢 新增：更新個人資料
  const updateProfile = async () => {
      try {
          const response = await fetch('/api/staff', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: staffUser.id,
                  phone: profileForm.phone,
                  address: profileForm.address,
                  emergency_contact: profileForm.emergency_contact
              })
          });
          
          const result = await response.json();
          
          if (result.success) {
              alert('個人資料已更新');
              setIsEditingProfile(false);
              fetchProfile();
          } else {
              alert('更新失敗: ' + (result.message || result.error));
          }
      } catch (error: any) {
          console.error('更新個人資料失敗:', error);
          alert('更新失敗: ' + error.message);
      }
  };

  // 🟢 新增：遮罩敏感資料
  const maskSensitiveData = (value: string | null | undefined, showLength: number = 3) => {
      if (!value) return '未設定';
      if (value.length <= showLength * 2) return value;
      const start = value.slice(0, showLength);
      const end = value.slice(-showLength);
      return `${start}${'*'.repeat(Math.max(4, value.length - showLength * 2))}${end}`;
  };

  // 🟢 新增：加班設定和確認 Modal
  const [overtimeSettings, setOvertimeSettings] = useState<{ threshold: number; approvalRequired: boolean } | null>(null);
  const [showOvertimeConfirm, setShowOvertimeConfirm] = useState(false);
  const [pendingClockOut, setPendingClockOut] = useState<{ lat: number | null; lng: number | null; isBypass: boolean } | null>(null);

  // 🟢 新增：取得加班設定
  useEffect(() => {
      if (staffUser) {
          fetch('/api/settings?type=clinic')
              .then(res => res.json())
              .then(result => {
                  if (result.data) {
                      setOvertimeSettings({
                          threshold: result.data.overtime_threshold || 9,
                          approvalRequired: result.data.overtime_approval_required !== false
                      });
                  }
              })
              .catch(err => console.error('Error fetching overtime settings:', err));
      }
  }, [staffUser]);

  // 🟢 修正：補打卡申請 (支援選擇補登項目)
  const submitMissedPunch = async () => {
      // 驗證邏輯：根據補登項目驗證對應欄位
      if (!missedForm.date || !missedForm.reason) {
          return alert("請填寫日期和原因");
      }
      
      if (missedForm.correctionType === 'check_in' && !missedForm.startTime) {
          return alert("請填寫上班時間");
      }
      
      if (missedForm.correctionType === 'check_out' && !missedForm.endTime) {
          return alert("請填寫下班時間");
      }
      
      if (missedForm.correctionType === 'full' && (!missedForm.startTime || !missedForm.endTime)) {
          return alert("補全天請填寫上班和下班時間");
      }

      // 根據補登項目構建時間
      let startFull: string | null = null;
      let endFull: string | null = null;
      let leaveType = '';

      if (missedForm.correctionType === 'check_in') {
          startFull = new Date(`${missedForm.date}T${missedForm.startTime}`).toISOString();
          endFull = startFull; // 只補上班，下班時間設為相同
          leaveType = '上班';
      } else if (missedForm.correctionType === 'check_out') {
          // 只補下班，需要找到當天的上班記錄或使用預設時間
          startFull = new Date(`${missedForm.date}T09:00`).toISOString(); // 預設上班時間
          endFull = new Date(`${missedForm.date}T${missedForm.endTime}`).toISOString();
          leaveType = '下班';
      } else if (missedForm.correctionType === 'full') {
          startFull = new Date(`${missedForm.date}T${missedForm.startTime}`).toISOString();
          endFull = new Date(`${missedForm.date}T${missedForm.endTime}`).toISOString();
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
                  reason: missedForm.reason,
                  status: 'pending'
              })
          });

          const result = await response.json();
          
          if (result.success) {
              alert("✅ 補打卡申請已送出，待主管審核。"); 
              setShowMissedPunch(false); 
              setMissedForm({ date: '', startTime: '', endTime: '', correctionType: 'check_in', reason: '' });
              fetchLeaveHistory();
          } else {
              alert("申請失敗: " + (result.message || result.error));
          }
      } catch (error: any) {
          console.error('Submit missed punch error:', error);
          alert("申請失敗: " + error.message);
      }
  };

  const reportAnomaly = async (logId: number) => {
      const reason = prompt("請輸入異常原因 (例如: 忘記打卡)");
      if (!reason) return;
      
      try {
          const response = await fetch('/api/attendance', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  id: logId,
                  anomaly_reason: reason
              })
          });
          
          const result = await response.json();
          if (result.success) {
              alert("已送出");
              fetchHistory();
          } else {
              alert("更新失敗: " + (result.message || result.error));
          }
      } catch (error: any) {
          console.error('Report anomaly error:', error);
          alert("更新失敗: " + error.message);
      }
  };

  const submitLeave = async () => {
      if(!leaveForm.startDate || !leaveForm.endDate) return alert("請填寫完整日期");
      const startT = new Date(`${leaveForm.startDate}T${leaveForm.startTime}`).toISOString();
      const endT = new Date(`${leaveForm.endDate}T${leaveForm.endTime}`).toISOString();
      const diff = (new Date(endT).getTime() - new Date(startT).getTime()) / 3600000;

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
                  status: 'pending'
              })
          });

          const result = await response.json();
          
          if (result.success) {
              alert("假單已送出");
              setLeaveForm({ ...leaveForm, reason: '' });
              fetchLeaveHistory();
          } else {
              alert("申請失敗: " + (result.message || result.error));
          }
      } catch (error: any) {
          console.error('Submit leave error:', error);
          alert("申請失敗: " + error.message);
      }
  };

  const executeClock = async (action: 'in' | 'out') => {
      const isVip = staffUser.role === '醫師' || staffUser.role === '主管';
      
      // 🟢 新增：下班時先檢查工時
      if (action === 'out' && logs.length > 0 && logs[0].clock_in_time) {
          const clockInTime = new Date(logs[0].clock_in_time);
          const now = new Date();
          const workHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
          const threshold = overtimeSettings?.threshold || 9;

          // 如果超過門檻，顯示確認 Modal
          if (workHours > threshold) {
              setPendingClockOut({ lat: null, lng: null, isBypass: false });
              setShowOvertimeConfirm(true);
              return; // 先不執行打卡，等待用戶確認
          }
      }

      // 原有的打卡邏輯
      if (isVip || bypassMode) { 
          await submitLog(action, null, null, bypassMode, false); 
          return; 
      }
      setGpsStatus('locating');
      if (!navigator.geolocation) { 
          alert("GPS 未開"); 
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
                  // 🟢 新增：如果是下班且超過門檻，先顯示確認 Modal
                  if (action === 'out' && logs.length > 0 && logs[0].clock_in_time) {
                      const clockInTime = new Date(logs[0].clock_in_time);
                      const now = new Date();
                      const workHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
                      const threshold = overtimeSettings?.threshold || 9;
                      if (workHours > threshold) {
                          setPendingClockOut({ lat: latitude, lng: longitude, isBypass: false });
                          setShowOvertimeConfirm(true);
                          return;
                      }
                  }
                  await submitLog(action, latitude, longitude, false, false); 
              }
              else { 
                  setGpsStatus('out_of_range'); 
                  alert(`距離太遠 (${Math.round(d)}m)`); 
              }
          },
          (err) => { 
              console.error(err); 
              setGpsStatus('error'); 
              alert("定位失敗"); 
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
  };

  // 🟢 修正：處理加班確認（參數名稱改為 applyOvertime）
  const handleOvertimeConfirm = async (apply: boolean) => {
      setShowOvertimeConfirm(false);
      if (pendingClockOut) {
          await submitLog('out', pendingClockOut.lat, pendingClockOut.lng, pendingClockOut.isBypass, apply);
          setPendingClockOut(null);
      }
  };

  const submitLog = async (action: 'in' | 'out', lat: number|null, lng: number|null, isBypass: boolean, applyOvertime: boolean = false) => {
      try {
        // 使用 API 路由來避免 RLS 政策限制
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
                    isBypass: isBypass
                })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || '打卡失敗');
            alert('上班打卡成功！'); 
        } else {
            const lastLog = logs.find(l => !l.clock_out_time);
            if (!lastLog) return alert("無上班紀錄");
            
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
                    applyOvertime: applyOvertime // 🟢 修正：傳遞加班申請
                })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message || '打卡失敗');
            alert('下班打卡成功！'); 
        }
        // 等待資料更新完成
        await fetchTodayLogs(staffUser.id);
        setGpsStatus('idle');
        setBypassMode(false);
      } catch (err: any) { 
        console.error('打卡錯誤:', err);
        alert("錯誤：" + (err.message || '打卡失敗，請重試')); 
      }
  };

  if (status === 'loading') return <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50"><div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div><p className="mt-4 text-slate-400 font-bold">系統載入中...</p></div>;
  if (status === 'bind_needed') return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
              <User className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">員工綁定 (V33.0)</h2>
              <p className="text-slate-500 mb-6 text-sm">請選擇姓名並輸入密碼</p>
              <div className="space-y-4 text-left">
                  <select className="w-full p-3 border rounded-xl bg-slate-50 font-bold" value={bindForm.id} onChange={(e) => setBindForm({...bindForm, id: e.target.value})}>
                      <option value="">請選擇...</option>
                      {unboundList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <input type="password" value={bindForm.password} onChange={(e) => setBindForm({...bindForm, password: e.target.value})} className="w-full p-3 border rounded-xl bg-slate-50 font-bold" placeholder="密碼 (預設為生日四碼)"/>
                  <button onClick={handleBind} className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold shadow-lg mt-4">確認綁定</button>
              </div>
          </div>
      </div>
  );

  const isWorking = logs.length > 0 && !logs[0].clock_out_time;
  const isVip = staffUser.role === '醫師' || staffUser.role === '主管';

  if (selectedPayslip) {
      const isPPF = selectedPayslip.is_doctor_ppf;
      const data = isPPF ? selectedPayslip.data : (selectedPayslip.snapshot || {});
      return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
                  <div className="bg-slate-800 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{selectedPayslip.year_month} 薪資單</h3><button onClick={() => setSelectedPayslip(null)}><X size={24}/></button></div>
                  <div className="p-6 overflow-y-auto space-y-4">
                      {isPPF ? (
                          <><div className="text-center border-b pb-4"><p className="text-sm text-slate-500">本月獎金 (PPF)</p><p className="text-4xl font-black text-slate-800">${Number(data.final_ppf_bonus || 0).toLocaleString()}</p></div><div className="space-y-2 text-sm"><div className="flex justify-between"><span>看診人數</span><span>{data.patient_count} 人</span></div><div className="flex justify-between"><span>健保點數</span><span>{data.nhi_points} 點</span></div><div className="flex justify-between"><span>總產值</span><span>${Number(data.total_performance).toLocaleString()}</span></div><div className="flex justify-between text-slate-400"><span>已領保障薪</span><span>-${Number(data.base_salary_at_time).toLocaleString()}</span></div></div></>
                      ) : (
                          <><div className="text-center border-b pb-4"><p className="text-sm text-slate-500">實領金額</p><p className="text-4xl font-black text-slate-800">${Number(data.netPay || 0).toLocaleString()}</p></div><div className="space-y-2 text-sm"><div className="flex justify-between"><span>底薪/保障薪</span><span>${Number(data.baseAmount || 0).toLocaleString()}</span></div><div className="flex justify-between"><span>加班/工時費</span><span>${Number(data.workAmount || 0).toLocaleString()}</span></div><div className="flex justify-between text-blue-600"><span>獎金</span><span>+${Number(data.bonusesTotal || 0).toLocaleString()}</span></div><div className="flex justify-between text-red-500"><span>勞健保自付</span><span>-${Number(data.insLabor + data.insHealth || 0).toLocaleString()}</span></div></div></>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  // 🟢 新增：加班確認 Modal
  if (showOvertimeConfirm && logs.length > 0 && logs[0].clock_in_time) {
      const clockInTime = new Date(logs[0].clock_in_time);
      const now = new Date();
      const workHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
      const threshold = overtimeSettings?.threshold || 9;

      return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
                  <div className="text-center">
                      <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Clock size={32} className="text-orange-600"/>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">加班確認</h3>
                      <p className="text-sm text-slate-600">
                          今日工時已達 <span className="font-bold text-orange-600">{workHours.toFixed(1)}</span> 小時。
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

  // 🟢 補打卡 Modal (新增補登項目選擇器)
  if (showMissedPunch) {
      return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-800">申請補登打卡</h3>
                      <button onClick={() => setShowMissedPunch(false)}><X/></button>
                  </div>
                  <div className="space-y-3">
                      {/* 🟢 新增：補登項目選擇器 */}
                      <div>
                          <label className="text-xs text-slate-400 mb-2 block">補登項目</label>
                          <div className="flex gap-2">
                              <button 
                                  onClick={() => setMissedForm({...missedForm, correctionType: 'check_in'})} 
                                  className={`flex-1 py-2 rounded font-bold border text-sm transition ${
                                      missedForm.correctionType === 'check_in' 
                                          ? 'bg-teal-600 text-white border-teal-600' 
                                          : 'bg-white text-slate-500 border-slate-300'
                                  }`}
                              >
                                  補上班
                              </button>
                              <button 
                                  onClick={() => setMissedForm({...missedForm, correctionType: 'check_out'})} 
                                  className={`flex-1 py-2 rounded font-bold border text-sm transition ${
                                      missedForm.correctionType === 'check_out' 
                                          ? 'bg-teal-600 text-white border-teal-600' 
                                          : 'bg-white text-slate-500 border-slate-300'
                                  }`}
                              >
                                  補下班
                              </button>
                              <button 
                                  onClick={() => setMissedForm({...missedForm, correctionType: 'full'})} 
                                  className={`flex-1 py-2 rounded font-bold border text-sm transition ${
                                      missedForm.correctionType === 'full' 
                                          ? 'bg-teal-600 text-white border-teal-600' 
                                          : 'bg-white text-slate-500 border-slate-300'
                                  }`}
                              >
                                  補全天
                              </button>
                          </div>
                      </div>
                      
                      <div>
                          <label className="text-xs text-slate-400">日期</label>
                          <input 
                              type="date" 
                              value={missedForm.date} 
                              onChange={e => setMissedForm({...missedForm, date: e.target.value})} 
                              className="w-full border p-2 rounded bg-slate-50"
                          />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                          <div>
                              <label className="text-xs text-slate-400">上班時間</label>
                              <input 
                                  type="time" 
                                  value={missedForm.startTime} 
                                  onChange={e => setMissedForm({...missedForm, startTime: e.target.value})} 
                                  className="w-full border p-2 rounded bg-slate-50" 
                                  disabled={missedForm.correctionType === 'check_out'}
                                  required={missedForm.correctionType === 'check_in' || missedForm.correctionType === 'full'}
                              />
                          </div>
                          <div>
                              <label className="text-xs text-slate-400">下班時間</label>
                              <input 
                                  type="time" 
                                  value={missedForm.endTime} 
                                  onChange={e => setMissedForm({...missedForm, endTime: e.target.value})} 
                                  className="w-full border p-2 rounded bg-slate-50" 
                                  disabled={missedForm.correctionType === 'check_in'}
                                  required={missedForm.correctionType === 'check_out' || missedForm.correctionType === 'full'}
                              />
                          </div>
                      </div>

                      <div>
                          <label className="text-xs text-slate-400">原因</label>
                          <input 
                              type="text" 
                              placeholder="例: 忘記帶手機" 
                              value={missedForm.reason} 
                              onChange={e => setMissedForm({...missedForm, reason: e.target.value})} 
                              className="w-full border p-2 rounded bg-slate-50"
                          />
                      </div>
                      <button onClick={submitMissedPunch} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">送出申請</button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
        <div className="bg-teal-600 p-6 pt-12 text-white rounded-b-[2rem] shadow-lg relative">
            <div className="flex justify-between items-start">
                <div><p className="text-teal-200 text-sm font-bold mb-1">{getTodayStr()}</p><h2 className="text-3xl font-black">{staffUser.name} <span className="text-base font-normal opacity-80">{staffUser.role}</span></h2></div>
                {isVip && <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-1 rounded-full shadow">VIP</span>}
            </div>
            {view === 'home' && (
                <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                    <div className="flex justify-between items-center text-sm mb-3">
                        <span className="text-teal-100 flex items-center gap-1"><MapPin size={12}/> {gpsStatus === 'locating' ? '...' : (gpsStatus === 'out_of_range' ? `太遠(${dist}m)` : '就緒')}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${isWorking ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-200 text-slate-600'}`}>{isWorking ? '工作中' : '未打卡'}</span>
                    </div>
                    <div className="flex justify-between text-center divide-x divide-white/20">
                        <div className="flex-1"><p className="text-xs text-teal-200 mb-1">上班時間</p><p className="text-xl font-mono font-bold">{formatTime(logs[0]?.clock_in_time)}</p></div>
                        <div className="flex-1"><p className="text-xs text-teal-200 mb-1">下班時間</p><p className="text-xl font-mono font-bold">{formatTime(logs[0]?.clock_out_time)}</p></div>
                    </div>
                </div>
            )}
        </div>

        <div className="p-6 space-y-6">
            {view === 'home' && (
                <>
                    {/* 🟢 新增：最新公告區塊 */}
                    {announcements.length > 0 && (
                        <div className="space-y-2 mb-4">
                            <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                <Bell size={16} className="text-orange-500"/>
                                最新公告
                            </h3>
                            {announcements.map((ann, i) => (
                                <div key={i} className="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500 p-3 rounded-lg shadow-sm">
                                    <div className="font-bold text-slate-800 text-sm mb-1">{ann.title}</div>
                                    <div className="text-xs text-slate-600 leading-relaxed">{ann.content}</div>
                                    {ann.created_at && (
                                        <div className="text-[10px] text-slate-400 mt-1">
                                            {new Date(ann.created_at).toLocaleDateString('zh-TW')}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {!isWorking ? (
                        <button onClick={() => executeClock('in')} className="w-full aspect-square rounded-full bg-gradient-to-b from-teal-400 to-teal-600 shadow-2xl flex flex-col items-center justify-center text-white active:scale-95 transition border-8 border-teal-100/50"><Clock size={56} className="mb-2 opacity-90"/><span className="text-3xl font-black tracking-widest">上班</span><span className="text-sm opacity-80 mt-2 font-mono">{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></button>
                    ) : (
                        <button onClick={() => executeClock('out')} className="w-full aspect-square rounded-full bg-gradient-to-b from-orange-400 to-orange-600 shadow-2xl flex flex-col items-center justify-center text-white active:scale-95 transition border-8 border-orange-100/50"><Clock size={56} className="mb-2 opacity-90"/><span className="text-3xl font-black tracking-widest">下班</span><span className="text-sm opacity-80 mt-2 font-mono">已工作: {((new Date().getTime() - new Date(logs[0].clock_in_time).getTime())/3600000).toFixed(1)} hr</span></button>
                    )}
                    {!isVip && !bypassMode && <div className="text-center"><button onClick={() => { if(confirm('啟用救援模式？')) setBypassMode(true); }} className="text-xs text-slate-400 underline">GPS 定位不到？使用救援模式</button></div>}
                    {bypassMode && <div className="bg-red-50 text-red-600 p-2 text-center rounded text-xs font-bold animate-pulse">救援模式已開啟</div>}
                </>
            )}

            {view === 'history' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <History size={18}/> 歷史紀錄
                        </h3>
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)} 
                            className="bg-white border rounded px-2 py-1 text-sm font-bold text-slate-600"
                        />
                    </div>
                    <button 
                        onClick={() => setShowMissedPunch(true)} 
                        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-400 transition"
                    >
                        <PlusCircle size={18}/> 申請補登打卡 (忘記打卡)
                    </button>
                    <div className="space-y-3">
                        {historyLogs.map(log => {
                            // 🟢 優化：狀態標籤函數
                            const getStatusBadge = (logItem: any) => {
                                // 加班狀態
                                if (logItem.is_overtime) {
                                    if (logItem.overtime_status === 'pending') {
                                        return { text: '加班審核中', color: 'bg-yellow-100 text-orange-700 border-orange-300' };
                                    } else if (logItem.overtime_status === 'approved') {
                                        return { text: '加班已核准', color: 'bg-green-100 text-green-700 border-green-300' };
                                    } else if (logItem.overtime_status === 'rejected') {
                                        return { text: '加班已駁回', color: 'bg-red-100 text-red-700 border-red-300' };
                                    }
                                }
                                // 異常回報
                                if (logItem.anomaly_reason) {
                                    return { text: '已回報異常', color: 'bg-slate-100 text-slate-600 border-slate-300' };
                                }
                                return null;
                            };

                            const statusBadge = getStatusBadge(log);

                            return (
                                <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold text-slate-800">
                                                {new Date(log.clock_in_time).getDate()}日
                                            </div>
                                            <div className="font-mono text-slate-600 text-sm mt-1">
                                                {formatTime(log.clock_in_time)} - {formatTime(log.clock_out_time)}
                                            </div>
                                        </div>
                                        {/* 🟢 優化：狀態標籤 */}
                                        <div className="flex flex-col items-end gap-1">
                                            {statusBadge && (
                                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${statusBadge.color}`}>
                                                    {statusBadge.text}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-2">
                                        <div className="text-xs font-bold text-teal-600">
                                            工時 {Number(log.work_hours || 0).toFixed(1)} hr
                                        </div>
                                        <button 
                                            onClick={() => reportAnomaly(log.id)} 
                                            className="text-xs text-slate-400 hover:text-red-500 underline"
                                        >
                                            回報異常
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {historyLogs.length === 0 && (
                            <div className="text-center text-slate-400 py-8 text-sm">尚無打卡記錄</div>
                        )}
                    </div>
                </div>
            )}

            {view === 'roster' && (
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18}/> 近期班表 ({staffUser.role})</h3>
                    <div className="space-y-2">
                        {rosterData.map((r, i) => {
                            // 🟢 優化：翻譯診別名稱並加上顏色
                            const getShiftLabel = (code: string) => {
                                if (code === 'AM') return { label: '早診', color: 'bg-orange-100 text-orange-700 border-orange-300' };
                                if (code === 'PM') return { label: '午診', color: 'bg-blue-100 text-blue-700 border-blue-300' };
                                if (code === 'NIGHT') return { label: '晚診', color: 'bg-purple-100 text-purple-700 border-purple-300' };
                                return { label: code, color: 'bg-slate-100 text-slate-700 border-slate-300' };
                            };
                            
                            const shiftInfo = getShiftLabel(r.shift_code || '');
                            
                            return (
                                <div key={i} className="bg-white p-3 rounded-xl border-l-4 border-teal-500 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="font-bold text-slate-700">{r.date}</div>
                                        {staffUser.role === '醫師' && r.shift_code && (
                                            <span className={`text-xs font-bold px-2 py-1 rounded border ${shiftInfo.color}`}>
                                                {shiftInfo.label}
                                            </span>
                                        )}
                                    </div>
                                    {staffUser.role === '醫師' ? (
                                        <div className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                                            {r.start_time}-{r.end_time}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-500">
                                            {r.start_time ? `${r.start_time}-${r.end_time}` : '詳見班表'}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {rosterData.length === 0 && <div className="text-center text-slate-400 py-4">近期無排班</div>}
                    </div>
                </div>
            )}

            {view === 'leave' && (
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Coffee size={18}/> 請假申請</h3>
                    
                    {/* 🟢 優化：年休儀表板 (特休概況卡片) */}
                    <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-50 p-5 rounded-xl shadow-lg border-2 border-teal-200">
                        <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar size={18} className="text-teal-600"/>
                            特休概況
                        </h4>
                        
                        <div className="space-y-3">
                            {/* 到職日期 */}
                            {staffLeaveInfo?.start_date && (
                                <div className="bg-white/90 p-3 rounded-lg border border-slate-200">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-600">到職日期</span>
                                        <span className="text-sm font-black text-slate-800">
                                            {new Date(staffLeaveInfo.start_date).toLocaleDateString('zh-TW', { 
                                                year: 'numeric', 
                                                month: 'long', 
                                                day: 'numeric' 
                                            })}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* 今年特休 */}
                            {(leaveStats?.annual || staffLeaveInfo?.annual_leave_quota) && (
                                <div className="bg-white/90 p-3 rounded-lg border-2 border-teal-300">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-bold text-slate-700">今年特休</span>
                                        <span className="text-lg font-black text-teal-700">
                                            {staffLeaveInfo?.annual_leave_quota !== null && staffLeaveInfo?.annual_leave_quota !== undefined
                                                ? `${Number(staffLeaveInfo.annual_leave_quota).toFixed(1)} 天`
                                                : leaveStats?.annual?.quota !== undefined
                                                ? `${Number(leaveStats.annual.quota).toFixed(1)} 天`
                                                : '未設定額度'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="bg-slate-50 p-2 rounded">
                                            <div className="text-slate-500 mb-0.5">已用</div>
                                            <div className="font-bold text-orange-600">
                                                {leaveStats?.annual 
                                                    ? `${Number((leaveStats.annual.used || 0) / 8).toFixed(1)} 天`
                                                    : '0 天'}
                                            </div>
                                        </div>
                                        <div className="bg-teal-50 p-2 rounded">
                                            <div className="text-slate-500 mb-0.5">剩餘</div>
                                            <div className="font-bold text-teal-700">
                                                {leaveStats?.annual?.remaining !== undefined 
                                                    ? `${Number(leaveStats.annual.remaining).toFixed(1)} 天`
                                                    : staffLeaveInfo?.annual_leave_quota !== null && staffLeaveInfo?.annual_leave_quota !== undefined
                                                    ? `${Number(staffLeaveInfo.annual_leave_quota).toFixed(1)} 天`
                                                    : '--'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 歷年紀錄（可展開） */}
                            {staffLeaveInfo?.annual_leave_history && (
                                <div className="bg-white/90 p-3 rounded-lg border border-slate-200">
                                    <button
                                        onClick={() => setShowAnnualHistory(!showAnnualHistory)}
                                        className="w-full flex justify-between items-center"
                                    >
                                        <span className="text-xs font-bold text-slate-600">歷年特休紀錄</span>
                                        <ChevronRight 
                                            size={16} 
                                            className={`text-slate-400 transition-transform ${showAnnualHistory ? 'rotate-90' : ''}`}
                                        />
                                    </button>
                                    {showAnnualHistory && (
                                        <div className="mt-3 space-y-2 pt-3 border-t border-slate-200">
                                            {typeof staffLeaveInfo.annual_leave_history === 'string' ? (
                                                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                                    {staffLeaveInfo.annual_leave_history}
                                                </div>
                                            ) : (
                                                Object.entries(staffLeaveInfo.annual_leave_history)
                                                    .sort(([a], [b]) => b.localeCompare(a)) // 由新到舊排序
                                                    .map(([year, days]: [string, any]) => (
                                                        <div key={year} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs">
                                                            <span className="font-bold text-slate-700">{year} 年</span>
                                                            <span className="text-teal-600 font-bold">{days} 天</span>
                                                        </div>
                                                    ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* 🟢 其他假別統計（保留原有設計） */}
                    {leaveStats && Object.keys(leaveStats).length > 0 && (
                        <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-4 rounded-xl shadow-sm border border-slate-200">
                            <h4 className="text-xs font-bold text-slate-600 mb-2">其他假別 (今年度)</h4>
                            <div className="space-y-2">
                                {leaveStats.personal && (
                                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-600">事假</span>
                                            <span className="text-sm font-black text-slate-700">
                                                已用 {Number((leaveStats.personal.used || 0) / 8).toFixed(1)} 天
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {leaveStats.sick && (
                                    <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-600">病假</span>
                                            <span className="text-sm font-black text-slate-700">
                                                已用 {Number((leaveStats.sick.used || 0) / 8).toFixed(1)} 天
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {/* 顯示其他假別 */}
                                {Object.entries(leaveStats).map(([key, value]: [string, any]) => {
                                    if (['annual', 'personal', 'sick'].includes(key)) return null;
                                    const typeLabels: Record<string, string> = {
                                        'menstrual': '生理假',
                                        'bereavement': '喪假',
                                        'official': '公假',
                                        'marriage': '婚假',
                                        'maternity': '產假',
                                        'family': '家庭照顧假'
                                    };
                                    return (
                                        <div key={key} className="bg-white/80 p-2 rounded-lg border border-slate-200">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-600">
                                                    {typeLabels[key] || key}
                                                </span>
                                                <span className="text-sm font-black text-slate-700">
                                                    已用 {Number((value.used || 0) / 8).toFixed(1)} 天
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
                        <div className="flex gap-2">
                            {['事假','病假','特休','補休'].map(t => (
                                <button key={t} onClick={() => setLeaveForm({...leaveForm, type: t})} className={`flex-1 py-1.5 rounded text-xs font-bold border ${leaveForm.type===t ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500'}`}>{t}</button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div><label className="text-[10px] text-slate-400">開始日期</label><input type="date" className="w-full border rounded p-1 text-sm bg-slate-50" value={leaveForm.startDate} onChange={e=>setLeaveForm({...leaveForm, startDate:e.target.value})}/></div>
                            <div><label className="text-[10px] text-slate-400">時間</label><input type="time" className="w-full border rounded p-1 text-sm" value={leaveForm.startTime} onChange={e=>setLeaveForm({...leaveForm, startTime:e.target.value})}/></div>
                            <div><label className="text-[10px] text-slate-400">結束日期</label><input type="date" className="w-full border rounded p-1 text-sm" value={leaveForm.endDate} onChange={e=>setLeaveForm({...leaveForm, endDate:e.target.value})}/></div>
                            <div><label className="text-[10px] text-slate-400">時間</label><input type="time" className="w-full border rounded p-1 text-sm" value={leaveForm.endTime} onChange={e=>setLeaveForm({...leaveForm, endTime:e.target.value})}/></div>
                        </div>
                        <input type="text" className="w-full border rounded p-2 text-sm" placeholder="請輸入事由..." value={leaveForm.reason} onChange={e=>setLeaveForm({...leaveForm, reason:e.target.value})}/>
                        <button onClick={submitLeave} className="w-full bg-teal-600 text-white py-2 rounded-lg font-bold shadow-md">送出申請</button>
                    </div>

                    <div className="space-y-2 mt-4">
                        <h4 className="text-xs font-bold text-slate-400">申請紀錄</h4>
                        {leaveHistory.map((l,i) => (
                            <div key={i} className="bg-white p-3 rounded-lg border border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <div className="font-bold text-sm text-slate-700">
                                            {l.type} 
                                            <span className="text-xs font-normal text-slate-400 ml-1">
                                                {l.leave_type && `(${l.leave_type}) `}
                                                {formatDateTime(l.start_time)}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1">{l.reason}</div>
                                    </div>
                                    {/* 🟢 優化：狀態標籤樣式（更醒目的設計） */}
                                    <span className={`text-[10px] px-2.5 py-1 rounded font-bold whitespace-nowrap ml-2 border ${
                                        l.status === 'approved' 
                                            ? 'bg-green-100 text-green-700 border-green-300' 
                                            : l.status === 'rejected' 
                                            ? 'bg-red-100 text-red-700 border-red-300' 
                                            : 'bg-yellow-100 text-orange-700 border-orange-300'
                                    }`}>
                                        {l.status === 'approved' 
                                            ? '✓ 已通過' 
                                            : l.status === 'rejected' 
                                            ? '✗ 已駁回' 
                                            : '⏳ 請假簽核中'}
                                    </span>
                                </div>
                                {l.hours && (
                                    <div className="text-xs text-slate-500 mt-1">
                                        時數：{Number(l.hours).toFixed(1)} 小時
                                    </div>
                                )}
                            </div>
                        ))}
                        {leaveHistory.length === 0 && (
                            <div className="text-center text-slate-400 py-4 text-sm">尚無請假記錄</div>
                        )}
                    </div>
                </div>
            )}

            {/* 5. 薪資單 (改用獨立元件) */}
            {view === 'payslip' && (
                <div className="p-4">
                    <PortalSalaryView user={staffUser} />
                </div>
            )}

            {/* 🟢 新增：個人資料頁面 */}
            {view === 'profile' && profile && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <User size={18}/>
                            個人資料
                        </h3>
                        {!isEditingProfile && (
                            <button 
                                onClick={() => setIsEditingProfile(true)}
                                className="text-sm text-teal-600 font-bold flex items-center gap-1"
                            >
                                <Edit2 size={14}/>
                                編輯
                            </button>
                        )}
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
                        {/* 唯讀欄位 */}
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">姓名</label>
                            <div className="text-sm font-bold text-slate-800">{profile.name}</div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">職稱</label>
                            <div className="text-sm font-bold text-slate-800">{profile.role}</div>
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">到職日</label>
                            <div className="text-sm font-bold text-slate-800">
                                {profile.start_date ? new Date(profile.start_date).toLocaleDateString('zh-TW') : '未設定'}
                            </div>
                        </div>

                        {/* 可編輯欄位 */}
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">電話</label>
                            {isEditingProfile ? (
                                <input 
                                    type="text" 
                                    value={profileForm.phone}
                                    onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                                    className="w-full border p-2 rounded bg-slate-50 text-sm"
                                    placeholder="請輸入電話"
                                />
                            ) : (
                                <div className="text-sm font-bold text-slate-800">{profile.phone || '未設定'}</div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">地址</label>
                            {isEditingProfile ? (
                                <input 
                                    type="text" 
                                    value={profileForm.address}
                                    onChange={e => setProfileForm({...profileForm, address: e.target.value})}
                                    className="w-full border p-2 rounded bg-slate-50 text-sm"
                                    placeholder="請輸入地址"
                                />
                            ) : (
                                <div className="text-sm font-bold text-slate-800">{profile.address || '未設定'}</div>
                            )}
                        </div>
                        <div>
                            <label className="text-xs text-slate-400 mb-1 block">緊急聯絡人</label>
                            {isEditingProfile ? (
                                <input 
                                    type="text" 
                                    value={profileForm.emergency_contact}
                                    onChange={e => setProfileForm({...profileForm, emergency_contact: e.target.value})}
                                    className="w-full border p-2 rounded bg-slate-50 text-sm"
                                    placeholder="請輸入緊急聯絡人"
                                />
                            ) : (
                                <div className="text-sm font-bold text-slate-800">{profile.emergency_contact || '未設定'}</div>
                            )}
                        </div>

                        {/* 敏感資料（唯讀 + 遮罩） */}
                        <div className="border-t border-slate-200 pt-4">
                            <div>
                                <label className="text-xs text-slate-400 mb-1 block">銀行帳號</label>
                                <div className="text-sm font-bold text-slate-800">
                                    {maskSensitiveData(profile.bank_account)}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">如需修改請洽管理員</p>
                            </div>
                            <div className="mt-3">
                                <label className="text-xs text-slate-400 mb-1 block">身分證字號</label>
                                <div className="text-sm font-bold text-slate-800">
                                    {maskSensitiveData(profile.id_number)}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">如需修改請洽管理員</p>
                            </div>
                        </div>

                        {/* 歷年特休紀錄 */}
                        {profile.annual_leave_history && (
                            <div className="border-t border-slate-200 pt-4">
                                <label className="text-xs text-slate-400 mb-2 block">歷年特休紀錄</label>
                                <div className="space-y-2">
                                    {typeof profile.annual_leave_history === 'string' ? (
                                        <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                                            {profile.annual_leave_history}
                                        </div>
                                    ) : (
                                        Object.entries(profile.annual_leave_history).map(([year, days]: [string, any]) => (
                                            <div key={year} className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs">
                                                <span className="font-bold text-slate-700">{year} 年</span>
                                                <span className="text-teal-600 font-bold">{days} 天</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 編輯按鈕 */}
                        {isEditingProfile && (
                            <div className="flex gap-2 pt-4 border-t border-slate-200">
                                <button 
                                    onClick={() => {
                                        setIsEditingProfile(false);
                                        setProfileForm({
                                            phone: profile.phone || '',
                                            address: profile.address || '',
                                            emergency_contact: profile.emergency_contact || ''
                                        });
                                    }}
                                    className="flex-1 py-2 border rounded-lg text-sm font-bold text-slate-600"
                                >
                                    取消
                                </button>
                                <button 
                                    onClick={updateProfile}
                                    className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                                >
                                    <Save size={14}/>
                                    儲存
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        <div className="fixed bottom-0 left-0 w-full bg-white border-t p-2 pb-6 flex justify-around items-center text-[10px] font-bold text-slate-400 z-50 max-w-md mx-auto left-0 right-0">
            <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'home' ? 'text-teal-600 bg-teal-50' : ''}`}><Clock size={20}/>打卡</button>
            <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'history' ? 'text-teal-600 bg-teal-50' : ''}`}><History size={20}/>紀錄</button>
            <button onClick={() => setView('roster')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'roster' ? 'text-teal-600 bg-teal-50' : ''}`}><Calendar size={20}/>班表</button>
            <button onClick={() => setView('leave')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'leave' ? 'text-teal-600 bg-teal-50' : ''}`}><Coffee size={20}/>請假</button>
            <button onClick={() => setView('payslip')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'payslip' ? 'text-teal-600 bg-teal-50' : ''}`}><DollarSign size={20}/>薪資</button>
            <button onClick={() => setView('profile')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'profile' ? 'text-teal-600 bg-teal-50' : ''}`}><User size={20}/>個人</button>
        </div>
    </div>
  );
}
