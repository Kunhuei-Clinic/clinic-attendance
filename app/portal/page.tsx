'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import liff from '@line/liff';
import { Clock, Calendar, DollarSign, MapPin, AlertTriangle, History, FileText, Coffee, ChevronRight, X, User, PlusCircle } from 'lucide-react';
import PortalSalaryView from './components/SalaryView';

const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

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
  const [view, setView] = useState<'home' | 'history' | 'roster' | 'leave' | 'payslip'>('home');
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
  
  // 🟢 修正：補打卡表單 (增加 endTime 支援補全天)
  const [showMissedPunch, setShowMissedPunch] = useState(false);
  const [missedForm, setMissedForm] = useState({ date: '', startTime: '', endTime: '', type: '上班', reason: '' });

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
      const { data } = await supabase.from('staff').select('*').eq('line_user_id', lineId).single();
      if (data) {
          setStaffUser(data);
          setStatus('ready');
          fetchTodayLogs(data.name);
      } else {
          const { data: list } = await supabase.from('staff').select('id, name').is('line_user_id', null).eq('is_active', true);
          setUnboundList(list || []);
          setStatus('bind_needed');
      }
  };

  const handleBind = async () => {
      if (!bindForm.id || !bindForm.password) return alert('請選擇姓名並輸入密碼');
      const { data: verify } = await supabase.from('staff').select('password').eq('id', bindForm.id).single();
      const dbPass = verify?.password || '0000';
      if (dbPass !== bindForm.password) return alert('❌ 密碼錯誤');
      const profile = await liff.getProfile();
      const { error } = await supabase.from('staff').update({ line_user_id: profile.userId }).eq('id', bindForm.id);
      if (error) alert('綁定失敗'); else window.location.reload();
  };

  useEffect(() => {
      if (!staffUser) return;
      if (view === 'history') fetchHistory();
      if (view === 'roster') fetchRoster();
      if (view === 'leave') fetchLeaveHistory();
      if (view === 'payslip') fetchSalaryHistory();
  }, [view, selectedMonth, staffUser]);

  const fetchTodayLogs = async (name: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from('attendance_logs').select('*').eq('staff_name', name).gte('clock_in_time', `${today}T00:00:00`).order('clock_in_time', { ascending: false });
      setLogs(data || []);
  };

  const fetchHistory = async () => {
      const start = `${selectedMonth}-01T00:00:00`;
      const [y, m] = selectedMonth.split('-').map(Number);
      const nextMonth = new Date(y, m+1, 1).toISOString(); 
      const { data } = await supabase.from('attendance_logs').select('*').eq('staff_name', staffUser.name).gte('clock_in_time', start).lt('clock_in_time', nextMonth).order('clock_in_time', { ascending: false });
      setHistoryLogs(data || []);
  };

  const fetchRoster = async () => {
      const start = new Date().toISOString().slice(0, 10);
      if (staffUser.role === '醫師') {
          const { data } = await supabase.from('doctor_roster').select('*').eq('doctor_id', staffUser.id).gte('date', start).order('date').limit(20);
          setRosterData(data || []);
      } else {
          const { data } = await supabase.from('roster').select('*').eq('staff_id', staffUser.id).gte('date', start).order('date').limit(20);
          setRosterData(data || []);
      }
  };

  const fetchSalaryHistory = async () => {
      if (staffUser.role === '醫師') {
          const { data } = await supabase.from('doctor_ppf').select('*').eq('doctor_id', staffUser.id).order('target_month', { ascending: false });
          const formatted = (data || []).map(item => ({ id: item.id, year_month: item.target_month, is_doctor_ppf: true, data: item }));
          setSalaryList(formatted);
      } else {
          const { data } = await supabase.from('salary_history').select('*').eq('staff_id', staffUser.id).order('year_month', { ascending: false });
          const formatted = (data || []).map(item => ({ id: item.id, year_month: item.year_month, is_doctor_ppf: false, snapshot: item.snapshot }));
          setSalaryList(formatted);
      }
  };

  const fetchLeaveHistory = async () => {
      const { data } = await supabase.from('leave_requests').select('*').eq('staff_id', staffUser.id).order('created_at', { ascending: false });
      setLeaveHistory(data || []);
  };

  // 🟢 修正：補打卡申請 (支援全天)
  const submitMissedPunch = async () => {
      if(!missedForm.date || !missedForm.startTime || !missedForm.reason) return alert("請填寫完整資訊");
      
      const startFull = new Date(`${missedForm.date}T${missedForm.startTime}`).toISOString();
      // 如果是全天或下班，endFull 使用 endTime，否則跟 startFull 一樣 (單點打卡)
      const endFull = (missedForm.type === '全天' || missedForm.type === '下班') && missedForm.endTime
          ? new Date(`${missedForm.date}T${missedForm.endTime}`).toISOString()
          : startFull;

      // 如果是全天，必須檢查有沒有填下班時間
      if (missedForm.type === '全天' && !missedForm.endTime) return alert("補全天請填寫下班時間");

      const { error } = await supabase.from('leave_requests').insert([{
          staff_id: staffUser.id,
          staff_name: staffUser.name,
          type: '補打卡',
          leave_type: missedForm.type, // '上班', '下班', '全天'
          start_time: startFull,
          end_time: endFull, 
          hours: 0,
          reason: missedForm.reason,
          status: 'pending'
      }]);

      if(error) alert("申請失敗: " + error.message);
      else { 
          alert("✅ 補打卡申請已送出，待主管審核。"); 
          setShowMissedPunch(false); 
          setMissedForm({ date: '', startTime: '', endTime: '', type: '上班', reason: '' });
          fetchLeaveHistory(); 
      }
  };

  const reportAnomaly = async (logId: number) => {
      const reason = prompt("請輸入異常原因 (例如: 忘記打卡)");
      if (!reason) return;
      await supabase.from('attendance_logs').update({ anomaly_reason: reason }).eq('id', logId);
      alert("已送出"); fetchHistory();
  };

  const submitLeave = async () => {
      if(!leaveForm.startDate || !leaveForm.endDate) return alert("請填寫完整日期");
      const startT = new Date(`${leaveForm.startDate}T${leaveForm.startTime}`).toISOString();
      const endT = new Date(`${leaveForm.endDate}T${leaveForm.endTime}`).toISOString();
      const diff = (new Date(endT).getTime() - new Date(startT).getTime()) / 3600000;

      const { error } = await supabase.from('leave_requests').insert([{
          staff_id: staffUser.id,
          staff_name: staffUser.name,
          type: leaveForm.type,
          start_time: startT,
          end_time: endT,
          hours: diff.toFixed(1),
          reason: leaveForm.reason,
          status: 'pending'
      }]);
      if(error) alert("申請失敗: " + error.message);
      else { alert("假單已送出"); setLeaveForm({ ...leaveForm, reason: '' }); fetchLeaveHistory(); }
  };

  const executeClock = async (action: 'in' | 'out') => {
      const isVip = staffUser.role === '醫師' || staffUser.role === '主管';
      if (isVip || bypassMode) { await submitLog(action, null, null, bypassMode); return; }
      setGpsStatus('locating');
      if (!navigator.geolocation) { alert("GPS 未開"); setGpsStatus('error'); return; }
      navigator.geolocation.getCurrentPosition(
          async (pos) => {
              const { latitude, longitude } = pos.coords;
              const d = getDist(latitude, longitude, CLINIC_LAT, CLINIC_LNG);
              setDist(Math.round(d));
              if (d <= ALLOWED_RADIUS) { setGpsStatus('ok'); await submitLog(action, latitude, longitude, false); }
              else { setGpsStatus('out_of_range'); alert(`距離太遠 (${Math.round(d)}m)`); }
          },
          (err) => { console.error(err); setGpsStatus('error'); alert("定位失敗"); },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
  };

  const submitLog = async (action: 'in' | 'out', lat: number|null, lng: number|null, isBypass: boolean) => {
      try {
        if (action === 'in') {
            const { error } = await supabase.from('attendance_logs').insert([{
                staff_name: staffUser.name, clock_in_time: new Date(), status: 'working', gps_lat: lat, gps_lng: lng, is_bypass: isBypass, work_type: 'work'
            }]);
            if (error) throw error;
            alert('上班打卡成功！'); 
        } else {
            const lastLog = logs.find(l => !l.clock_out_time);
            if (!lastLog) return alert("無上班紀錄");
            const now = new Date();
            const hours = (now.getTime() - new Date(lastLog.clock_in_time).getTime()) / 3600000;
            const { error } = await supabase.from('attendance_logs').update({
                clock_out_time: now.toISOString(), work_hours: hours.toFixed(2), status: 'completed', gps_lat: lat, gps_lng: lng, is_bypass: isBypass
            }).eq('id', lastLog.id);
            if (error) throw error;
            alert('下班打卡成功！'); 
        }
        fetchTodayLogs(staffUser.name);
        setGpsStatus('idle');
        setBypassMode(false);
      } catch (err: any) { alert("錯誤：" + err.message); }
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

  // 🟢 補打卡 Modal (新增全天選項)
  if (showMissedPunch) {
      return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center"><h3 className="text-xl font-bold text-slate-800">申請補登打卡</h3><button onClick={() => setShowMissedPunch(false)}><X/></button></div>
                  <div className="space-y-3">
                      <div className="flex gap-2">
                          {['上班','下班','全天'].map(t => (
                              <button key={t} onClick={() => setMissedForm({...missedForm, type: t})} className={`flex-1 py-2 rounded font-bold border text-sm ${missedForm.type===t ? 'bg-teal-600 text-white' : 'bg-white text-slate-500'}`}>{t}</button>
                          ))}
                      </div>
                      <div><label className="text-xs text-slate-400">日期</label><input type="date" value={missedForm.date} onChange={e => setMissedForm({...missedForm, date: e.target.value})} className="w-full border p-2 rounded bg-slate-50"/></div>
                      
                      <div className="grid grid-cols-2 gap-2">
                          <div>
                              <label className="text-xs text-slate-400">上班時間</label>
                              <input type="time" value={missedForm.startTime} onChange={e => setMissedForm({...missedForm, startTime: e.target.value})} className="w-full border p-2 rounded bg-slate-50" disabled={missedForm.type === '下班'}/>
                          </div>
                          <div>
                              <label className="text-xs text-slate-400">下班時間</label>
                              <input type="time" value={missedForm.endTime} onChange={e => setMissedForm({...missedForm, endTime: e.target.value})} className="w-full border p-2 rounded bg-slate-50" disabled={missedForm.type === '上班'} placeholder="僅全天/下班"/>
                          </div>
                      </div>

                      <div><label className="text-xs text-slate-400">原因</label><input type="text" placeholder="例: 忘記帶手機" value={missedForm.reason} onChange={e => setMissedForm({...missedForm, reason: e.target.value})} className="w-full border p-2 rounded bg-slate-50"/></div>
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
                    <div className="flex justify-between items-center"><h3 className="font-bold text-slate-700 flex items-center gap-2"><History size={18}/> 歷史紀錄</h3><input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-white border rounded px-2 py-1 text-sm font-bold text-slate-600"/></div>
                    <button onClick={() => setShowMissedPunch(true)} className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-400 transition"><PlusCircle size={18}/> 申請補登打卡 (忘記打卡)</button>
                    <div className="space-y-3">
                        {historyLogs.map(log => (
                            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden">
                                {log.anomaly_reason && <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-bl-lg">已回報</div>}
                                <div className="flex justify-between items-center mb-2">
                                    <div className="font-bold text-slate-800">{new Date(log.clock_in_time).getDate()}日</div>
                                    <div className="font-mono text-slate-600 text-sm">{formatTime(log.clock_in_time)} - {formatTime(log.clock_out_time)}</div>
                                </div>
                                <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                                    <div className="text-xs font-bold text-teal-600">工時 {Number(log.work_hours || 0).toFixed(1)} hr</div>
                                    <button onClick={() => reportAnomaly(log.id)} className="text-xs text-slate-400 hover:text-red-500 underline">回報異常</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'roster' && (
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18}/> 近期班表 ({staffUser.role})</h3>
                    <div className="space-y-2">
                        {rosterData.map((r, i) => (
                            <div key={i} className="bg-white p-3 rounded-xl border-l-4 border-teal-500 shadow-sm flex justify-between items-center">
                                <div className="font-bold text-slate-700">{r.date}</div>
                                {staffUser.role === '醫師' ? (
                                    <>
                                        <div className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">{r.start_time}-{r.end_time}</div>
                                        <div className="text-xs font-bold text-teal-600">{r.shift_code}</div>
                                    </>
                                ) : (
                                    <div className="text-xs text-slate-500">{r.start_time ? `${r.start_time}-${r.end_time}` : '詳見班表'}</div>
                                )}
                            </div>
                        ))}
                        {rosterData.length === 0 && <div className="text-center text-slate-400 py-4">近期無排班</div>}
                    </div>
                </div>
            )}

            {view === 'leave' && (
                <div className="space-y-4">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2"><Coffee size={18}/> 請假申請</h3>
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
                            <div key={i} className="bg-white p-3 rounded-lg border border-slate-100 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-sm text-slate-700">{l.type} <span className="text-xs font-normal text-slate-400">{l.leave_type && `(${l.leave_type}) `}{formatDateTime(l.start_time)}</span></div>
                                    <div className="text-xs text-slate-400">{l.reason}</div>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded font-bold ${l.status==='approved'?'bg-green-100 text-green-700':(l.status==='rejected'?'bg-red-100 text-red-700':'bg-yellow-100 text-yellow-700')}`}>{getStatusLabel(l.status)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 5. 薪資單 (改用獨立元件) */}
            {view === 'payslip' && (
                <div className="p-4">
                    <PortalSalaryView user={staffUser} />
                </div>
            )}
        </div>

        <div className="fixed bottom-0 left-0 w-full bg-white border-t p-2 pb-6 flex justify-around items-center text-[10px] font-bold text-slate-400 z-50 max-w-md mx-auto left-0 right-0">
            <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'home' ? 'text-teal-600 bg-teal-50' : ''}`}><Clock size={20}/>打卡</button>
            <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'history' ? 'text-teal-600 bg-teal-50' : ''}`}><History size={20}/>紀錄</button>
            <button onClick={() => setView('roster')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'roster' ? 'text-teal-600 bg-teal-50' : ''}`}><Calendar size={20}/>班表</button>
            <button onClick={() => setView('leave')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'leave' ? 'text-teal-600 bg-teal-50' : ''}`}><Coffee size={20}/>請假</button>
            <button onClick={() => setView('payslip')} className={`flex flex-col items-center gap-1 w-14 p-1.5 rounded-xl transition ${view === 'payslip' ? 'text-teal-600 bg-teal-50' : ''}`}><DollarSign size={20}/>薪資</button>
        </div>
    </div>
  );
}
