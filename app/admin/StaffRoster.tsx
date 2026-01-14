'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ChevronLeft, ChevronRight, ShieldAlert, Lock, Clock, Settings, Save, X } from 'lucide-react';

const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

// 定義班別代號映射 (SettingsView 用 AM/PM/NIGHT，這裡用 M/A/N)
const SHIFT_MAPPING: Record<string, 'AM' | 'PM' | 'NIGHT'> = {
    'M': 'AM',
    'A': 'PM',
    'N': 'NIGHT'
};

type Staff = { id: number; name: string; role: string; display_order: number; work_rule: 'normal' | '2week' | '4week' | '8week' | 'none'; };
type Shift = 'M' | 'A' | 'N';
type DayType = 'normal' | 'rest' | 'regular';
// 更新 RosterData 定義，加入 shift_details
type RosterData = { shifts: Shift[]; day_type: DayType; shift_details?: Record<string, { start: string, end: string }> };

const GROUP_CLINIC = ['護理師', '櫃台', '診所助理'];
const GROUP_PHARMACY = ['藥師', '藥局助理'];

export default function StaffRosterView({ authLevel }: { authLevel: 'boss' | 'manager' }) {
    const [isMounted, setIsMounted] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [todayStr, setTodayStr] = useState('');
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [rosterMap, setRosterMap] = useState<Record<string, RosterData>>({});
    const [holidays, setHolidays] = useState<string[]>([]);
    const [complianceErrors, setComplianceErrors] = useState<Record<number, string[]>>({});

    // --- 🕒 營業時間設定相關 State ---
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [businessHours, setBusinessHours] = useState({
        openDays: [1, 2, 3, 4, 5, 6],
        shifts: {
            AM: { start: '08:00', end: '12:30' },
            PM: { start: '14:00', end: '17:30' },
            NIGHT: { start: '18:00', end: '21:30' }
        }
    });

    // 初始化
    useEffect(() => {
        setIsMounted(true);
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setTodayStr(`${y}-${m}-${day}`);
        fetchGlobalSettings(); // 載入全域設定
    }, []);

    // 資料讀取
    useEffect(() => {
        fetchStaff();
        fetchRoster();
        fetchHolidays();
    }, [currentDate]);

    // 🟢 功能：讀取系統設定 (營業時間)
    const fetchGlobalSettings = async () => {
        const { data } = await supabase.from('system_settings').select('*').eq('key', 'clinic_business_hours').single();
        if (data && data.value) {
            try {
                const settings = JSON.parse(data.value);
                setBusinessHours(settings);
            } catch (e) {
                console.error("解析營業時間失敗", e);
            }
        }
    };

    // 🟢 功能：儲存臨時修改的營業時間 (更新全域設定)
    const handleSaveGlobalTime = async () => {
        const { error } = await supabase.from('system_settings').upsert({
            key: 'clinic_business_hours',
            value: JSON.stringify(businessHours)
        });
        if (error) alert("儲存失敗");
        else {
            alert("營業時間已更新，後續點擊排班將套用新時間。");
            setShowTimeModal(false);
        }
    };

    const fetchStaff = async () => {
        const { data } = await supabase.from('staff').select('*').order('role').order('display_order');
        if (data) {
            const validStaff = data.filter((s: any) => s.role !== '醫師' && s.role !== '主管' && s.role !== '營養師');
            // @ts-ignore
            setStaffList(validStaff);
        }
    };

    const fetchHolidays = async () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const nextMonthDate = new Date(year, month, 1);
        const endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
        const { data } = await supabase.from('clinic_holidays').select('date').gte('date', startStr).lt('date', endStr);
        if (data) setHolidays(data.map((h: any) => h.date));
    };

    const fetchRoster = async () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
        const nextMonthDate = new Date(year, month, 1);
        const endStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

        // 記得在 Select 加入 shift_details
        const { data } = await supabase.from('roster').select('*').gte('date', startStr).lt('date', endStr);
        const map: Record<string, RosterData> = {};
        data?.forEach((r: any) => {
            let shifts: Shift[] = [];
            if (Array.isArray(r.shifts)) shifts = r.shifts.filter((s: any) => typeof s === 'string' && ['M', 'A', 'N'].includes(s));
            let day_type: DayType = 'normal';
            if (r.day_type === 'rest') day_type = 'rest';
            if (r.day_type === 'regular') day_type = 'regular';
            
            // 讀取 Snapshot 的詳細時間
            const shift_details = r.shift_details || {};
            
            map[`${r.staff_id}_${r.date}`] = { shifts, day_type, shift_details };
        });
        setRosterMap(map);
    };

    const getDaysInMonth = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysCount = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: daysCount }, (_, i) => {
            const d = new Date(year, month, i + 1);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return { dateObj: d, dateStr: dateStr, dayOfWeek: d.getDay() };
        });
    };

    // 計算兩個時間 (HH:mm) 的工時長度
    const calculateHours = (start: string, end: string) => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    };

    const validateCompliance = () => {
        // ... (保持原有的勞基法檢查邏輯，暫略以節省篇幅) ...
         const errors: Record<number, string[]> = {};
        const days = getDaysInMonth();
        staffList.forEach(staff => {
            const staffErrors: string[] = [];
            const rule = staff.work_rule || 'normal';
            if (rule === 'none') return;
            let consecutiveDays = 0;
            let maxConsecutive = (rule === '4week') ? 12 : 6;
            days.forEach(day => {
                const key = `${staff.id}_${day.dateStr}`;
                const data = rosterMap[key] || { shifts: [], day_type: 'normal' };
                if (data.shifts.length > 0) {
                    consecutiveDays++;
                    if (data.day_type === 'regular') {
                        if (!staffErrors.includes(`例假排班`)) staffErrors.push(`例假排班`);
                    }
                } else {
                    consecutiveDays = 0;
                }
                if (consecutiveDays > maxConsecutive) {
                    if (!staffErrors.includes(`連上>${maxConsecutive}天`)) staffErrors.push(`連上>${maxConsecutive}天`);
                }
            });
            if (staffErrors.length > 0) errors[staff.id] = staffErrors;
        });
        setComplianceErrors(errors);
    };
    useEffect(() => { validateCompliance(); }, [rosterMap, staffList]);

    const updateWorkRule = async (staffId: number, rule: any) => {
        await supabase.from('staff').update({ work_rule: rule }).eq('id', staffId);
        setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, work_rule: rule } : s));
    };

    const toggleGlobalHoliday = async (dateStr: string) => {
        if (authLevel !== 'boss') return;
        if (holidays.includes(dateStr)) {
            setHolidays(prev => prev.filter(h => h !== dateStr));
            await supabase.from('clinic_holidays').delete().eq('date', dateStr);
        } else {
            setHolidays(prev => [...prev, dateStr]);
            await supabase.from('clinic_holidays').insert([{ date: dateStr, name: '國定假日' }]);
        }
    };

    const cycleDayType = async (staffId: number, dateStr: string) => {
        const key = `${staffId}_${dateStr}`;
        const currentData = rosterMap[key] || { shifts: [], day_type: 'normal' };
        let nextType: DayType = 'normal';
        if (currentData.day_type === 'normal') nextType = 'rest';
        else if (currentData.day_type === 'rest') nextType = 'regular';
        else nextType = 'normal';
        const nextShifts = (nextType === 'regular') ? [] : currentData.shifts;
        updateRoster(staffId, dateStr, nextShifts, nextType, currentData.shift_details);
    };

    const toggleShift = async (staffId: number, dateStr: string, shift: Shift) => {
        const key = `${staffId}_${dateStr}`;
        const currentData = rosterMap[key] || { shifts: [], day_type: 'normal', shift_details: {} };

        if (currentData.day_type === 'regular') {
            alert('「例假日」不可排班！');
            return;
        }

        const isActive = currentData.shifts.includes(shift);
        let newShifts = [];
        let newDetails = { ...currentData.shift_details };

        if (isActive) {
            // 移除班別
            newShifts = currentData.shifts.filter(s => s !== shift);
            delete newDetails[shift];
        } else {
            // 新增班別：Snapshot 當下的時間設定 📸
            newShifts = [...currentData.shifts, shift];
            const settingKey = SHIFT_MAPPING[shift]; // M -> AM
            const timeSetting = businessHours.shifts[settingKey];
            newDetails[shift] = { start: timeSetting.start, end: timeSetting.end };
        }

        updateRoster(staffId, dateStr, newShifts, currentData.day_type, newDetails);
    };

    // 🟢 核心功能更新：將 shift_details 寫入資料庫
    const updateRoster = async (staffId: number, dateStr: string, shifts: Shift[], dayType: DayType, details: any = {}) => {
        const key = `${staffId}_${dateStr}`;
        
        // 計算當日整體的 Start/End (取最小值與最大值，供列表顯示或簡易計算用)
        let minStart = "23:59";
        let maxEnd = "00:00";
        
        if (shifts.length > 0) {
             Object.values(details).forEach((d: any) => {
                 if (d.start < minStart) minStart = d.start;
                 if (d.end > maxEnd) maxEnd = d.end;
             });
        } else {
            minStart = null as any;
            maxEnd = null as any;
        }

        setRosterMap(prev => ({ ...prev, [key]: { shifts, day_type: dayType, shift_details: details } }));
        
        const { data: existing } = await supabase.from('roster').select('id').eq('staff_id', staffId).eq('date', dateStr).single();
        
        const payload = { 
            staff_id: staffId, 
            date: dateStr, 
            shifts, 
            day_type: dayType,
            shift_details: details, // 👈 關鍵：存入 JSON
            start_time: minStart,   // 👈 存入當天最早開始
            end_time: maxEnd        // 👈 存入當天最晚結束
        };

        if (existing) {
            if (shifts.length === 0 && dayType === 'normal') await supabase.from('roster').delete().eq('id', existing.id);
            else await supabase.from('roster').update(payload).eq('id', existing.id);
        } else if (shifts.length > 0 || dayType !== 'normal') {
            await supabase.from('roster').insert([payload]);
        }
    };

    // 🟢 統計功能更新：依據 Snapshot 的時間計算工時
    const calculateStats = (staffId: number) => {
        let totalDays = 0;
        let totalHours = 0;
        const days = getDaysInMonth();
        
        days.forEach(day => {
            const key = `${staffId}_${day.dateStr}`;
            const data = rosterMap[key];
            if (data && data.shifts.length > 0) {
                totalDays++;
                
                // 優先使用 snapshot 的時間計算
                if (data.shift_details && Object.keys(data.shift_details).length > 0) {
                    data.shifts.forEach(s => {
                        const detail = data.shift_details?.[s];
                        if (detail) {
                            totalHours += calculateHours(detail.start, detail.end);
                        } else {
                            // 若無 snapshot (舊資料)，回退到預設值
                            const settingKey = SHIFT_MAPPING[s];
                            const def = businessHours.shifts[settingKey];
                            totalHours += calculateHours(def.start, def.end);
                        }
                    });
                } else {
                    // 舊資料完全無 details 的情況
                    data.shifts.forEach(s => {
                         const settingKey = SHIFT_MAPPING[s];
                         const def = businessHours.shifts[settingKey];
                         totalHours += calculateHours(def.start, def.end);
                    });
                }
            }
        });
        return { totalDays, totalHours: Math.round(totalHours * 10) / 10 };
    };

    const days = getDaysInMonth();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // 取得當前設定的顯示字串
    const getTimeDisplay = (shiftKey: 'AM'|'PM'|'NIGHT') => {
        const s = businessHours.shifts[shiftKey];
        return `${s.start}-${s.end}`;
    };

    // UI Render Helper
    const renderTable = (title: string, groupRoles: string[], colorClass: string) => {
        const groupStaff = staffList
            .filter(s => groupRoles.includes(s.role || ''))
            .sort((a, b) => a.role.localeCompare(b.role) || a.display_order - b.display_order);

        if (groupStaff.length === 0) return null;

        return (
            <div className="mb-8 overflow-hidden rounded-lg shadow-sm border border-slate-200">
                <h3 className={`font-bold text-lg p-2 border-b bg-white border-l-4 ${colorClass}`}>{title}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse bg-white">
                        <thead>
                            <tr>
                                <th className="p-2 border bg-slate-50 sticky left-0 z-30 min-w-[150px] text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">員工</th>
                                {days.map(d => {
                                    const isToday = d.dateStr === todayStr;
                                    const isHoliday = holidays.includes(d.dateStr);
                                    let headerBg = 'bg-slate-50';
                                    let textColor = 'text-slate-800';
                                    if (isHoliday) { headerBg = 'bg-red-100'; textColor = 'text-red-700'; }
                                    else if (isToday) headerBg = 'bg-yellow-100';
                                    else if (d.dayOfWeek === 0 || d.dayOfWeek === 6) { headerBg = 'bg-red-50'; textColor = 'text-red-600'; }
                                    return (
                                        <th key={d.dateStr} onClick={() => toggleGlobalHoliday(d.dateStr)} className={`p-1 border text-center min-w-[40px] h-10 ${headerBg} ${textColor} ${isToday ? 'border-b-4 border-b-yellow-400' : ''} cursor-default select-none`}>
                                            <div className="text-xs font-bold">{d.dateObj.getDate()}</div>
                                            <div className="text-[10px] flex items-center justify-center gap-0.5">{isHoliday && <Lock size={8} />} {isHoliday ? '國定' : weekDays[d.dayOfWeek]}</div>
                                        </th>
                                    );
                                })}
                                <th className="p-2 border bg-slate-50 sticky right-0 z-30 min-w-[80px]">統計</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupStaff.map(staff => {
                                const stats = calculateStats(staff.id);
                                return (
                                    <tr key={staff.id}>
                                        <td className="p-2 border font-bold text-slate-700 sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                                            <div>{staff.name}<div className="text-[10px] text-slate-400">{staff.role}</div></div>
                                            {complianceErrors[staff.id] && <div className="text-[10px] text-red-600 bg-red-50 p-0.5 rounded flex items-center gap-1"><ShieldAlert size={10} /> 違規</div>}
                                        </td>
                                        {days.map(d => {
                                            const key = `${staff.id}_${d.dateStr}`;
                                            const data = rosterMap[key] || { shifts: [], day_type: 'normal' };
                                            const isToday = d.dateStr === todayStr;
                                            
                                            // UI 顯示邏輯
                                            let cellBg = isToday ? 'bg-yellow-50' : '';
                                            if (data.day_type === 'rest') cellBg = 'bg-emerald-50';
                                            else if (data.day_type === 'regular') cellBg = "bg-red-50 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:10px_10px]";

                                            return (
                                                <td key={d.dateStr} className={`border p-0.5 text-center align-top h-16 relative min-w-[45px] ${cellBg}`}>
                                                    <button onClick={() => cycleDayType(staff.id, d.dateStr)} className={`w-full h-5 rounded-sm text-[10px] font-bold mb-1 ${data.day_type === 'rest' ? 'bg-emerald-200 text-emerald-800' : data.day_type === 'regular' ? 'bg-red-200 text-red-800' : 'text-transparent hover:text-slate-300'}`}>
                                                        {data.day_type === 'rest' ? "休" : data.day_type === 'regular' ? "例" : "•"}
                                                    </button>
                                                    {data.day_type !== 'regular' && (
                                                        <div className="flex flex-col gap-[2px]">
                                                            {(['M', 'A', 'N'] as Shift[]).map(s => {
                                                                const isActive = data.shifts.includes(s);
                                                                const colorClass = s === 'M' ? 'bg-orange-400' : s === 'A' ? 'bg-blue-400' : 'bg-purple-400';
                                                                
                                                                // 若有 snapshot 時間，可以顯示 tooltip 或特殊標記，這裡先維持簡潔
                                                                return (
                                                                    <button key={s} onClick={() => toggleShift(staff.id, d.dateStr, s)} className={`h-2.5 w-full rounded-[2px] transition ${isActive ? colorClass : 'bg-slate-200/50 hover:bg-slate-300'}`} title={isActive ? `${s}班 (${data.shift_details?.[s]?.start}-${data.shift_details?.[s]?.end})` : `排${s}班`} />
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        <td className="p-2 border sticky right-0 z-20 bg-white text-center align-middle">
                                            <div className="flex flex-col gap-1"><div className="font-bold text-slate-800 text-xs">{stats.totalDays} 天</div><div className="text-slate-500 font-mono text-[10px]">{stats.totalHours} hr</div></div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    if (!isMounted) return null;

    return (
        <div className="w-full p-4 animate-fade-in pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between mb-4 items-center gap-4">
                <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-full shadow-inner">
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-white rounded-full transition"><ChevronLeft size={16} /></button>
                    <h2 className="text-lg font-bold min-w-[120px] text-center text-slate-700">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-white rounded-full transition"><ChevronRight size={16} /></button>
                </div>

                <div className="flex gap-2">
                    {/* 🟢 新增：營業時間設定按鈕 */}
                    <button onClick={() => setShowTimeModal(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-black transition">
                        <Clock size={16} /> 班別時間設定
                    </button>
                    
                    <div className="hidden md:flex flex-wrap gap-2 text-xs items-center bg-white p-2 rounded-lg border shadow-sm">
                         <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400"></span>早</div>
                         <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400"></span>午</div>
                         <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-400"></span>晚</div>
                    </div>
                </div>
            </div>

            {renderTable("🏥 診所人員 (護理/櫃台/診助)", GROUP_CLINIC, "border-blue-500 text-blue-700")}
            {renderTable("💊 藥局人員 (藥師/藥助)", GROUP_PHARMACY, "border-green-500 text-green-700")}

            {/* 🟢 Modal: 班別時間設定 */}
            {showTimeModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2"><Clock size={18}/> 設定班表預設時間</h3>
                            <button onClick={() => setShowTimeModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={18}/></button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 mb-4">
                                💡 修改此處會更新系統預設值。點擊排班格子時，將寫入當下設定的時間 (Snapshot)，避免日後修改設定影響舊班表。
                            </div>
                            {(['AM', 'PM', 'NIGHT'] as const).map(shift => (
                                <div key={shift} className="flex items-center gap-4">
                                    <div className={`w-12 text-center text-xs font-bold py-1 rounded text-white ${shift === 'AM' ? 'bg-orange-400' : shift === 'PM' ? 'bg-blue-400' : 'bg-purple-400'}`}>
                                        {shift === 'AM' ? '早班' : shift === 'PM' ? '午班' : '晚班'}
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                        <input type="time" value={businessHours.shifts[shift].start} 
                                            onChange={e => setBusinessHours({...businessHours, shifts: {...businessHours.shifts, [shift]: {...businessHours.shifts[shift], start: e.target.value}}})}
                                            className="border rounded p-2 text-sm font-mono flex-1 text-center bg-slate-50 focus:bg-white transition outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                        <span className="text-slate-400">-</span>
                                        <input type="time" value={businessHours.shifts[shift].end} 
                                            onChange={e => setBusinessHours({...businessHours, shifts: {...businessHours.shifts, [shift]: {...businessHours.shifts[shift], end: e.target.value}}})}
                                            className="border rounded p-2 text-sm font-mono flex-1 text-center bg-slate-50 focus:bg-white transition outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </div>
                                </div>
                            ))}
                            <button onClick={handleSaveGlobalTime} className="w-full bg-slate-800 text-white py-3 rounded-lg font-bold hover:bg-black transition flex justify-center items-center gap-2">
                                <Save size={18}/> 儲存並套用
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
