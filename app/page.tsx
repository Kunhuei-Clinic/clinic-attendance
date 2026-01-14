'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import liff from '@line/liff';
import { Clock, Calendar, DollarSign, User, LogOut, MapPin, AlertTriangle, RefreshCw, CheckCircle, FileText, Link as LinkIcon, History } from 'lucide-react';

// --- 設定區 ---
const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

// 請替換成您的 LIFF ID
const LIFF_ID = '2008669814-8OqQmkaL'; 

// 🛑 診所座標 (請修改為真實座標)
const CLINIC_LAT = 25.00606566310205; 
const CLINIC_LNG = 121.47745903743363;
const ALLOWED_RADIUS = 150; // 公尺

// 輔助函式
const getTodayStr = () => new Date().toLocaleDateString('zh-TW');
const formatTime = (iso: string) => iso ? new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) : '--:--';
const deg2rad = (deg: number) => deg * (Math.PI/180);
const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    var R = 6371; var dLat = deg2rad(lat2-lat1); var dLon = deg2rad(lon2-lon1); 
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c * 1000;
};

export default function EmployeePortal() {
  const [view, setView] = useState<'home' | 'history' | 'payslip'>('home');
  const [status, setStatus] = useState<'loading' | 'bind_needed' | 'ready' | 'error'>('loading');
  
  // User Data
  const [staffUser, setStaffUser] = useState<any>(null);
  const [unboundList, setUnboundList] = useState<any[]>([]);
  const [selectedBindId, setSelectedBindId] = useState('');

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]); // 歷史紀錄
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // GPS
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'out_of_range' | 'error'>('idle');
  const [dist, setDist] = useState(0);
  const [bypassMode, setBypassMode] = useState(false);

  // 初始化 LIFF
  useEffect(() => {
    const initLiff = async () => {
        try {
            await liff.init({ liffId: LIFF_ID });
            // 如果是在外部瀏覽器開啟，可能沒有登入
            if (!liff.isLoggedIn()) {
                liff.login();
                return;
            }
            const profile = await liff.getProfile();
            checkBinding(profile.userId);
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };
    initLiff();
  }, []);

  // 檢查綁定狀態
  const checkBinding = async (lineId: string) => {
      const { data } = await supabase.from('staff').select('*').eq('line_user_id', lineId).single();
      if (data) {
          setStaffUser(data);
          setStatus('ready');
          fetchTodayLogs(data.name);
      } else {
          // 尚未綁定，撈出未綁定名單
          const { data: list } = await supabase.from('staff').select('*').is('line_user_id', null);
          setUnboundList(list || []);
          setStatus('bind_needed');
      }
  };

  // 執行綁定
  const handleBind = async () => {
      if (!selectedBindId) return alert('請選擇姓名');
      const profile = await liff.getProfile();
      const { error } = await supabase.from('staff').update({ line_user_id: profile.userId }).eq('id', selectedBindId);
      if (error) alert('綁定失敗');
      else window.location.reload();
  };

  // 撈取今日紀錄
  const fetchTodayLogs = async (name: string) => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from('attendance_logs')
        .select('*')
        .eq('staff_name', name)
        .gte('clock_in_time', `${today}T00:00:00`)
        .order('clock_in_time', { ascending: false });
      setLogs(data || []);
  };

  // 撈取歷史紀錄 (當切換到 history tab 時)
  useEffect(() => {
      if (view === 'history' && staffUser) {
          const fetchHistory = async () => {
              const start = `${selectedMonth}-01T00:00:00`;
              const [y, m] = selectedMonth.split('-').map(Number);
              const nextMonth = new Date(y, m, 1).toISOString();
              const { data } = await supabase.from('attendance_logs')
                  .select('*')
                  .eq('staff_name', staffUser.name)
                  .gte('clock_in_time', start)
                  .lt('clock_in_time', nextMonth)
                  .order('clock_in_time', { ascending: false });
              setHistoryLogs(data || []);
          };
          fetchHistory();
      }
  }, [view, selectedMonth, staffUser]);

  // 打卡核心邏輯
  const executeClock = async (action: 'in' | 'out') => {
      const isVip = staffUser.role === '醫師' || staffUser.role === '主管';
      
      if (isVip || bypassMode) {
          await submitLog(action, null, null, bypassMode);
          return;
      }

      setGpsStatus('locating');
      if (!navigator.geolocation) {
          alert("不支援 GPS");
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
                  await submitLog(action, latitude, longitude, false);
              } else {
                  setGpsStatus('out_of_range');
                  alert(`距離太遠 (${Math.round(d)}m)！請靠近診所或使用救援模式。`);
              }
          },
          (err) => {
              console.error(err);
              setGpsStatus('error');
              alert("無法定位，請確認權限開啟。");
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
  };

  const submitLog = async (action: 'in' | 'out', lat: number|null, lng: number|null, isBypass: boolean) => {
      if (action === 'in') {
          const { error } = await supabase.from('attendance_logs').insert([{
              staff_name: staffUser.name, clock_in_time: new Date(), status: 'working', gps_lat: lat, gps_lng: lng, is_bypass: isBypass, work_type: 'work'
          }]);
          if (!error) { alert('上班打卡成功！'); fetchTodayLogs(staffUser.name); }
      } else {
          // 找最後一筆沒下班的
          const lastLog = logs.find(l => !l.clock_out_time);
          if (!lastLog) return alert("找不到上班紀錄");
          
          const now = new Date();
          const hours = (now.getTime() - new Date(lastLog.clock_in_time).getTime()) / 3600000;
          
          const { error } = await supabase.from('attendance_logs').update({
              clock_out_time: now.toISOString(), work_hours: hours.toFixed(2), duration_hours: hours.toFixed(2), status: 'completed', gps_lat: lat, gps_lng: lng, is_bypass: isBypass
          }).eq('id', lastLog.id);
          
          if (!error) { alert('下班打卡成功！'); fetchTodayLogs(staffUser.name); }
      }
      setGpsStatus('idle');
      setBypassMode(false);
  };

  // --- Render ---

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center font-bold text-slate-400 animate-pulse">系統載入中...</div>;
  if (status === 'error') return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold">系統錯誤，請用 LINE 開啟</div>;
  
  if (status === 'bind_needed') return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm text-center">
              <LinkIcon className="w-16 h-16 text-teal-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-slate-800">員工綁定 (V28.1)</h2>
              <p className="text-slate-500 mb-6 text-sm">初次使用，請選擇您的姓名進行綁定</p>
              <select className="w-full p-4 border rounded-xl mb-6 bg-slate-50 font-bold text-slate-700 outline-none" value={selectedBindId} onChange={(e) => setSelectedBindId(e.target.value)}>
                  <option value="">請選擇...</option>
                  {unboundList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={handleBind} className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition">確認綁定</button>
          </div>
      </div>
  );

  const isWorking = logs.length > 0 && !logs[0].clock_out_time;
  const isVip = staffUser.role === '醫師' || staffUser.role === '主管';

  return (
    <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="bg-teal-600 p-6 pt-12 text-white rounded-b-[2rem] shadow-lg relative">
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-teal-200 text-sm font-bold mb-1">{getTodayStr()}</p>
                    <h2 className="text-3xl font-black">{staffUser.name} <span className="text-base font-normal opacity-80">{staffUser.role}</span></h2>
                </div>
                {isVip && <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-1 rounded-full shadow">VIP</span>}
            </div>
            
            {/* 今日狀態小卡 */}
            <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="flex justify-between items-center text-sm mb-2">
                    <span className="text-teal-100 flex items-center gap-1"><MapPin size={12}/> {gpsStatus === 'locating' ? '定位中...' : (gpsStatus === 'out_of_range' ? `距離太遠 (${dist}m)` : '準備就緒')}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${isWorking ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-200 text-slate-600'}`}>
                        {isWorking ? '工作中' : '未打卡'}
                    </span>
                </div>
                <div className="flex justify-between text-center divide-x divide-white/20">
                    <div className="flex-1"><p className="text-xs text-teal-200 mb-1">上班</p><p className="text-xl font-mono font-bold">{formatTime(logs[0]?.clock_in_time)}</p></div>
                    <div className="flex-1"><p className="text-xs text-teal-200 mb-1">下班</p><p className="text-xl font-mono font-bold">{formatTime(logs[0]?.clock_out_time)}</p></div>
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-6">
            
            {view === 'home' && (
                <>
                    {/* 打卡大按鈕 */}
                    {!isWorking ? (
                        <button onClick={() => executeClock('in')} className="w-full aspect-square rounded-full bg-gradient-to-b from-teal-400 to-teal-600 shadow-2xl flex flex-col items-center justify-center text-white active:scale-95 transition border-8 border-teal-100/50">
                            <Clock size={56} className="mb-2 opacity-90"/><span className="text-3xl font-black tracking-widest">上班打卡</span>
                            <span className="text-sm opacity-80 mt-2 font-mono">{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </button>
                    ) : (
                        <button onClick={() => executeClock('out')} className="w-full aspect-square rounded-full bg-gradient-to-b from-orange-400 to-orange-600 shadow-2xl flex flex-col items-center justify-center text-white active:scale-95 transition border-8 border-orange-100/50">
                            <LogOut size={56} className="mb-2 opacity-90"/><span className="text-3xl font-black tracking-widest">下班打卡</span>
                            <span className="text-sm opacity-80 mt-2 font-mono">已工作: {((new Date().getTime() - new Date(logs[0].clock_in_time).getTime())/3600000).toFixed(1)} hr</span>
                        </button>
                    )}

                    {/* 救援模式 */}
                    {!isVip && (
                        <div className="text-center">
                            {!bypassMode ? (
                                <button onClick={() => { if(confirm('確定啟用救援模式？(將標記為異常)')) setBypassMode(true); }} className="text-xs text-slate-400 underline hover:text-red-500">GPS 定位不到？使用救援模式</button>
                            ) : (
                                <div className="bg-red-50 border border-red-200 p-2 rounded text-red-600 text-xs font-bold animate-pulse flex items-center justify-center gap-2">
                                    <AlertTriangle size={14}/> 救援模式開啟中 (請點擊上方按鈕) <button onClick={() => setBypassMode(false)} className="underline ml-2">取消</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 今日列表 */}
                    <div className="space-y-3 pt-4 border-t border-dashed">
                        <div className="flex justify-between items-center"><h3 className="font-bold text-slate-400 text-sm">今日紀錄</h3><button onClick={() => window.location.reload()}><RefreshCw size={14} className="text-slate-400"/></button></div>
                        {logs.map(log => (
                            <div key={log.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-700 text-lg font-mono">{formatTime(log.clock_in_time)} - {formatTime(log.clock_out_time)}</div>
                                    {log.is_bypass && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">異常打卡</span>}
                                </div>
                                {log.clock_out_time ? <CheckCircle size={18} className="text-teal-500"/> : <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"/>}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {view === 'history' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2"><History size={18}/> 歷史紀錄</h3>
                        <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-white border rounded px-2 py-1 text-sm font-bold text-slate-600"/>
                    </div>
                    <div className="space-y-3">
                        {historyLogs.length === 0 ? <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed">尚無紀錄</div> : historyLogs.map(log => (
                            <div key={log.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                                <div>
                                    <div className="font-bold text-slate-800">{new Date(log.clock_in_time).getDate()}日 <span className={`text-xs px-1.5 py-0.5 rounded ${log.work_type==='work'?'bg-blue-100 text-blue-700':'bg-orange-100 text-orange-700'}`}>{log.work_type==='work'?'正常班':'加班'}</span></div>
                                </div>
                                <div className="text-right">
                                    <div className="font-mono text-slate-600 text-sm">{formatTime(log.clock_in_time)} - {formatTime(log.clock_out_time)}</div>
                                    <div className="text-xs font-bold text-teal-600 mt-1">{Number(log.duration_hours).toFixed(1)} hr</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {view === 'payslip' && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center"><DollarSign size={32}/></div>
                    <p>薪資查詢功能開發中...</p>
                    <button onClick={() => setView('home')} className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg font-bold text-sm">返回首頁</button>
                </div>
            )}

        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t p-2 pb-6 flex justify-around items-center text-xs font-bold text-slate-400 z-50 max-w-md mx-auto left-0 right-0">
            <button onClick={() => setView('home')} className={`flex flex-col items-center gap-1 w-16 p-2 rounded-xl transition ${view === 'home' ? 'text-teal-600 bg-teal-50' : 'hover:bg-slate-50'}`}><Clock size={20}/> 打卡</button>
            <button onClick={() => setView('history')} className={`flex flex-col items-center gap-1 w-16 p-2 rounded-xl transition ${view === 'history' ? 'text-teal-600 bg-teal-50' : 'hover:bg-slate-50'}`}><Calendar size={20}/> 紀錄</button>
            <button onClick={() => setView('payslip')} className={`flex flex-col items-center gap-1 w-16 p-2 rounded-xl transition ${view === 'payslip' ? 'text-teal-600 bg-teal-50' : 'hover:bg-slate-50'}`}><DollarSign size={20}/> 薪資</button>
        </div>
    </div>
  );
}
