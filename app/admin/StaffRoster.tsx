'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ShieldAlert, Lock, Clock, Settings, Save, X } from 'lucide-react';

type Staff = { id: string; name: string; role: string; display_order: number; work_rule: 'normal' | '2week' | '4week' | '8week' | 'none'; entity?: string; }; // UUID
type DayType = 'normal' | 'rest' | 'regular' | 'holiday' | 'shifted';
type ShiftConfig = { id: string; code: string; name: string; start: string; end: string; };
// 更新 RosterData 定義，將 shifts 改為字串陣列，並保留 shift_details
type RosterData = { shifts: string[]; day_type: DayType; shift_details?: Record<string, { start: string, end: string }> };

type Entity = { id: string; name: string };
type JobTitleConfig = { name: string; in_roster: boolean };

const FALLBACK_ENTITIES: Entity[] = [
    { id: 'clinic', name: '診所' },
    { id: 'pharmacy', name: '藥局' }
];

export default function StaffRosterView({ authLevel }: { authLevel: 'boss' | 'manager' }) {
    const [isMounted, setIsMounted] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [todayStr, setTodayStr] = useState('');
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [rosterMap, setRosterMap] = useState<Record<string, RosterData>>({});
    const [holidays, setHolidays] = useState<string[]>([]);
    const [complianceErrors, setComplianceErrors] = useState<Record<string, string[]>>({});
    const [entities, setEntities] = useState<Entity[]>([]);
    const [jobTitleConfigs, setJobTitleConfigs] = useState<JobTitleConfig[]>([]);
    const [shiftsConfig, setShiftsConfig] = useState<ShiftConfig[]>([]);

    // --- 🕒 營業時間設定相關 State ---
    const [showTimeModal, setShowTimeModal] = useState(false);
    const [businessHours, setBusinessHours] = useState({
        openDays: [1, 2, 3, 4, 5, 6],
        shifts: [] as ShiftConfig[]
    });
    // 🆕 一鍵排整天模式：勾選後，點「早班」可視為排整天 (早/午/晚)
    const [fullDayFromMorning, setFullDayFromMorning] = useState(false);
    const [activeStamp, setActiveStamp] = useState<DayType>('rest');

    // 初始化
    useEffect(() => {
        setIsMounted(true);
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setTodayStr(`${y}-${m}-${day}`);
        fetchGlobalSettings(); // 載入營業時間設定
        fetchRosterSettings(); // 載入職稱與組織單位設定
    }, []);

    // 🟢 優化：集中載入當月資料（員工列表、班表、國定假日），使用 Promise.all 減少重繪
    useEffect(() => {
        loadMonthData();
    }, [currentDate]);

  // 🟢 功能：讀取系統設定 (營業時間) - 從 clinic JSONB 讀取
  const fetchGlobalSettings = async () => {
        try {
            const response = await fetch('/api/settings?type=clinic');
            const result = await response.json();
            if (result.data && result.data.business_hours) {
                const settings = result.data.business_hours;
                try {
                    // 動態班別陣列轉換
                    if (settings?.shifts) {
                        const rawShifts = settings.shifts;
                        let parsedShifts: ShiftConfig[] = [];
                        if (Array.isArray(rawShifts)) {
                            parsedShifts = rawShifts;
                        } else {
                            // 舊版 Object 格式相容轉換
                            parsedShifts = Object.entries(rawShifts).map(([key, val]: any, idx) => ({
                                id: String(idx),
                                code: key === 'AM' ? 'M' : (key === 'PM' ? 'A' : 'N'),
                                name: key === 'AM' ? '早診' : (key === 'PM' ? '午診' : '晚診'),
                                start: val.start,
                                end: val.end
                            }));
                        }
                        setShiftsConfig(parsedShifts);
                        setBusinessHours({
                            openDays: Array.isArray(settings.openDays) ? settings.openDays : [1, 2, 3, 4, 5, 6],
                            shifts: parsedShifts
                        });
                    } else {
                        // 預設防呆
                        const fallbackShifts: ShiftConfig[] = [
                            { id: '1', code: 'M', name: '早診', start: '08:00', end: '12:00' },
                            { id: '2', code: 'A', name: '午診', start: '14:00', end: '18:00' },
                            { id: '3', code: 'N', name: '晚診', start: '18:30', end: '21:30' }
                        ];
                        setShiftsConfig(fallbackShifts);
                        setBusinessHours({
                            openDays: [1, 2, 3, 4, 5, 6],
                            shifts: fallbackShifts
                        });
                    }
                } catch (e) {
                    console.error("解析營業時間失敗", e);
                }
            }
        } catch (error) {
            console.error('Fetch global settings error:', error);
        }
    };

    // 🟢 功能：讀取系統設定 (職稱 & 組織單位)
    const fetchRosterSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const result = await response.json();
            if (!result.data) {
                setJobTitleConfigs([
                    { name: '醫師', in_roster: false },
                    { name: '護理師', in_roster: true }
                ]);
                setEntities(FALLBACK_ENTITIES);
                return;
            }

            // job_titles
            const jobTitlesItem = result.data.find((item: any) => item.key === 'job_titles');
            let loadedJobTitles: JobTitleConfig[] = [];
            if (jobTitlesItem) {
                try {
                    const raw = JSON.parse(jobTitlesItem.value);
                    if (Array.isArray(raw) && raw.length > 0) {
                        if (typeof raw[0] === 'string') {
                            loadedJobTitles = (raw as string[]).map((name) => ({
                                name,
                                in_roster: name === '醫師' ? false : true
                            }));
                        } else {
                            loadedJobTitles = raw
                                .map((jt: any) => ({
                                    name: jt.name ?? '',
                                    in_roster: typeof jt.in_roster === 'boolean'
                                        ? jt.in_roster
                                        : (jt.name === '醫師' ? false : true)
                                }))
                                .filter((jt: JobTitleConfig) => jt.name);
                        }
                    }
                } catch (e) {
                    console.error('Parse job_titles error:', e);
                }
            }
            if (!loadedJobTitles || loadedJobTitles.length === 0) {
                loadedJobTitles = [
                    { name: '醫師', in_roster: false },
                    { name: '護理師', in_roster: true },
                    { name: '行政', in_roster: true },
                    { name: '藥師', in_roster: true },
                    { name: '清潔', in_roster: false }
                ];
            }
            setJobTitleConfigs(loadedJobTitles);

            // org_entities
            const entItem = result.data.find((item: any) => item.key === 'org_entities');
            let loadedEntities: Entity[] = [];
            if (entItem) {
                try {
                    const rawEnt = JSON.parse(entItem.value);
                    if (Array.isArray(rawEnt) && rawEnt.length > 0) {
                        loadedEntities = rawEnt
                            .map((e: any) => ({
                                id: e.id ?? '',
                                name: e.name ?? ''
                            }))
                            .filter((e: Entity) => e.id && e.name);
                    }
                } catch (e) {
                    console.error('Parse org_entities error:', e);
                }
            }
            if (!loadedEntities || loadedEntities.length === 0) {
                loadedEntities = FALLBACK_ENTITIES;
            }
            setEntities(loadedEntities);
        } catch (error) {
            console.error('Fetch roster settings error:', error);
            setJobTitleConfigs([
                { name: '醫師', in_roster: false },
                { name: '護理師', in_roster: true }
            ]);
            setEntities(FALLBACK_ENTITIES);
        }
    };

    // 🟢 功能：儲存臨時修改的營業時間 (更新全域設定，寫入 clinic JSONB)
    const handleSaveGlobalTime = async () => {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'clinic',
                    settings: { business_hours: businessHours }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert("營業時間已更新，後續點擊排班將套用新時間。");
                setShowTimeModal(false);
            } else {
                alert("儲存失敗: " + result.message);
            }
        } catch (error) {
            console.error('Save global time error:', error);
            alert("儲存失敗");
        }
    };

    // 🟢 優化：集中載入當月資料（員工列表、班表、國定假日），使用 Promise.all 減少重繪
    const loadMonthData = async () => {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            
            const [staffRes, rosterRes, holidaysRes] = await Promise.all([
                fetch('/api/staff'),
                fetch(`/api/roster/staff?year=${year}&month=${month}`),
                fetch(`/api/roster/holidays?year=${year}&month=${month}`)
            ]);

            const [staffResult, rosterResult, holidaysResult] = await Promise.all([
                staffRes.json(),
                rosterRes.json(),
                holidaysRes.json()
            ]);

            // 處理員工列表（權重排序）
            if (staffResult.data) {
                const roleWeight: Record<string, number> = { 
                  '醫師': 1, 
                  '主管': 2, 
                  '櫃台': 3, 
                  '護理師': 4, 
                  '營養師': 5, 
                  '診助': 6, 
                  '藥師': 7, 
                  '藥局助理': 8 
                };
                const sorted = [...staffResult.data].sort((a, b) => {
                  const aWeight = roleWeight[a.role || ''] ?? 999;
                  const bWeight = roleWeight[b.role || ''] ?? 999;
                  if (aWeight !== bWeight) return aWeight - bWeight;
                  return (a.name || '').localeCompare(b.name || '');
                });
                setStaffList(sorted);
            }

            // 處理班表資料
            const map: Record<string, RosterData> = {};
            if (rosterResult.data) {
                rosterResult.data.forEach((r: any) => {
                    let shifts: string[] = [];
                    if (Array.isArray(r.shifts)) shifts = r.shifts.filter((s: any) => typeof s === 'string');
                    let day_type: DayType = 'normal';
                    if (r.day_type === 'rest') day_type = 'rest';
                    if (r.day_type === 'regular') day_type = 'regular';
                    if (r.day_type === 'holiday') day_type = 'holiday';
                    if (r.day_type === 'shifted') day_type = 'shifted';
                    
                    const shift_details = r.shift_details || {};
                    map[`${r.staff_id}_${r.date}`] = { shifts, day_type, shift_details };
                });
            }
            setRosterMap(map);

            // 處理國定假日
            if (holidaysResult.data) {
                setHolidays(holidaysResult.data);
            } else {
                setHolidays([]);
            }
        } catch (error) {
            console.error('Load month data error:', error);
            setStaffList([]);
            setRosterMap({});
            setHolidays([]);
        }
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
        const errors: Record<string, string[]> = {};
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

    const updateWorkRule = async (staffId: string, rule: any) => {
        try {
            const response = await fetch('/api/staff', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: staffId, work_rule: rule })
            });
            const result = await response.json();
            if (result.success) {
                setStaffList(prev => prev.map(s => s.id === staffId ? { ...s, work_rule: rule } : s));
            }
        } catch (error) {
            console.error('Update work rule error:', error);
        }
    };

    const toggleGlobalHoliday = async (dateStr: string) => {
        if (authLevel !== 'boss') return;
        
        try {
            if (holidays.includes(dateStr)) {
                const response = await fetch(`/api/roster/holidays?date=${dateStr}`, { method: 'DELETE' });
                const result = await response.json();
                if (result.success) {
                    setHolidays(prev => prev.filter(h => h !== dateStr));
                }
            } else {
                const response = await fetch('/api/roster/holidays', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: dateStr, name: '國定假日' })
                });
                const result = await response.json();
                if (result.success) {
                    setHolidays(prev => [...prev, dateStr]);
                }
            }
        } catch (error) {
            console.error('Toggle holiday error:', error);
        }
    };

    const applyDayTypeStamp = async (staffId: string, dateStr: string) => {
        const key = `${staffId}_${dateStr}`;
        const currentData = rosterMap[key] || { shifts: [], day_type: 'normal' };

        const nextType = currentData.day_type === activeStamp ? 'normal' : activeStamp;
        const nextShifts = (nextType === 'regular') ? [] : currentData.shifts;
        updateRoster(staffId, dateStr, nextShifts, nextType, currentData.shift_details);
    };

    const toggleShift = async (staffId: string, dateStr: string, shiftConfig: ShiftConfig) => {
        const key = `${staffId}_${dateStr}`;
        const currentData = rosterMap[key] || { shifts: [], day_type: 'normal', shift_details: {} };

        let nextShifts = [...currentData.shifts];
        let nextDetails: Record<string, { start: string; end: string }> = { ...(currentData.shift_details || {}) };

        const isActive = nextShifts.includes(shiftConfig.code);

        // 🆕 一鍵排整天：啟用時，點第一個班別視為整天
        const isFirstShift = shiftsConfig.length > 0 && shiftConfig.code === shiftsConfig[0].code;

        if (fullDayFromMorning && isFirstShift) {
            const allCodes = shiftsConfig.map(s => s.code);
            const isFullDayActive = allCodes.every(c => nextShifts.includes(c));

            if (isFullDayActive) {
                // 已是整天班，再點一次則全部清空
                nextShifts = [];
                nextDetails = {};
            } else {
                // 將當天所有班別都排上
                nextShifts = [...allCodes];
                nextDetails = {};
                shiftsConfig.forEach(s => {
                    nextDetails[s.code] = { start: s.start, end: s.end };
                });
            }
        } else {
            if (isActive) {
                // 移除班別
                nextShifts = nextShifts.filter(s => s !== shiftConfig.code);
                delete nextDetails[shiftConfig.code];
            } else {
                // 新增班別：Snapshot 當下的時間設定 📸
                nextShifts.push(shiftConfig.code);
                nextDetails[shiftConfig.code] = { start: shiftConfig.start, end: shiftConfig.end };
            }
        }

        updateRoster(staffId, dateStr, nextShifts, currentData.day_type, nextDetails);
    };

    // 🟢 核心功能更新：將 shift_details 寫入資料庫（支援動態班別代號）
    const updateRoster = async (staffId: string, dateStr: string, shifts: string[], dayType: DayType, details: any = {}) => {
        const key = `${staffId}_${dateStr}`;
        
        setRosterMap(prev => ({ ...prev, [key]: { shifts, day_type: dayType, shift_details: details } }));
        
        try {
            const response = await fetch('/api/roster/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_id: staffId,
                    date: dateStr,
                    shifts,
                    day_type: dayType,
                    shift_details: details
                })
            });
            const result = await response.json();
            if (!result.success) {
                console.error('Update roster error:', result.message);
            }
        } catch (error) {
            console.error('Update roster error:', error);
        }
    };

    // 🟢 統計功能更新：依據 Snapshot 的時間計算工時
    const calculateStats = (staffId: string) => {
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
                            // 若無 snapshot (舊資料)，回退到當前班別設定
                            const conf = shiftsConfig.find(sc => sc.code === s);
                            if (conf) {
                                totalHours += calculateHours(conf.start, conf.end);
                            }
                        }
                    });
                } else {
                    // 舊資料完全無 details 的情況
                    data.shifts.forEach(s => {
                        const conf = shiftsConfig.find(sc => sc.code === s);
                        if (conf) {
                            totalHours += calculateHours(conf.start, conf.end);
                        }
                    });
                }
            }
        });
        return { totalDays, totalHours: Math.round(totalHours * 10) / 10 };
    };

    const days = getDaysInMonth();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // 依 job_titles 設定取得允許排班的職稱
    const configuredRoleSet = new Set(jobTitleConfigs.map(j => j.name));
    const allowedRoleSet = new Set(
        jobTitleConfigs.filter(j => j.in_roster).map(j => j.name)
    );

    // UI Render Helper：根據給定的員工清單渲染一張表
    const renderTable = (title: string, staffForEntity: Staff[], colorClass: string) => {
        const groupStaff = staffForEntity.slice();

        if (groupStaff.length === 0) return null;

        return (
            <div className="mb-8 overflow-hidden rounded-lg shadow-sm border border-slate-200">
                <h3 className={`font-bold text-lg p-2 border-b bg-white border-l-4 ${colorClass}`}>{title}</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse bg-white">
                        <thead>
                            <tr>
                                <th className="p-1 border bg-slate-50 sticky left-0 z-30 min-w-[80px] max-w-[80px] text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs">
                                    員工
                                </th>
                                {days.map(d => {
                                    const isToday = d.dateStr === todayStr;
                                    const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
                                    return (
                                        <th
                                            key={d.dateStr}
                                            onClick={() => toggleGlobalHoliday(d.dateStr)}
                                            className={`border p-0.5 text-center min-w-[34px] w-[34px] h-8 cursor-default select-none ${
                                                isToday ? 'bg-yellow-100 text-yellow-800' : isWeekend ? 'text-red-500' : ''
                                            }`}
                                        >
                                            <div className="text-[8px] leading-tight opacity-60">{weekDays[d.dayOfWeek]}</div>
                                            <div className="text-[10px] font-bold">{d.dateStr.slice(8)}</div>
                                        </th>
                                    );
                                })}
                                <th className="p-1 border bg-slate-50 sticky right-0 z-30 min-w-[50px] text-center text-xs">統計</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupStaff.map(staff => {
                                const stats = calculateStats(staff.id);
                                return (
                                    <tr key={staff.id}>
                                        <td className="p-1 border font-bold text-slate-700 sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top min-w-[80px] max-w-[80px] overflow-hidden">
                                            <div className="truncate text-xs" title={staff.name}>{staff.name}</div>
                                            <div className="text-[9px] text-slate-400 truncate">{staff.role}</div>
                                            {complianceErrors[staff.id] && <div className="text-[8px] text-red-600 bg-red-50 p-0.5 rounded flex items-center gap-0.5 mt-0.5 truncate"><ShieldAlert size={8} /> 違規</div>}
                                        </td>
                                        {days.map(d => {
                                            const key = `${staff.id}_${d.dateStr}`;
                                            const data = rosterMap[key] || { shifts: [], day_type: 'normal' };
                                            const isToday = d.dateStr === todayStr;
                                            
                                            // UI 顯示邏輯
                                            let cellBg = isToday ? 'bg-yellow-50' : '';
                                            if (data.day_type === 'rest') cellBg = 'bg-emerald-50';
                                            else if (data.day_type === 'regular') cellBg = "bg-red-50 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:10px_10px]";
                                            else if (data.day_type === 'holiday') cellBg = 'bg-pink-50';
                                            else if (data.day_type === 'shifted') cellBg = 'bg-slate-100';

                                            let btnClass = 'text-transparent hover:text-slate-300';
                                            let btnText = '•';
                                            if (data.day_type === 'rest') { btnClass = 'bg-emerald-200 text-emerald-800'; btnText = '休'; }
                                            else if (data.day_type === 'regular') { btnClass = 'bg-red-200 text-red-800'; btnText = '例'; }
                                            else if (data.day_type === 'holiday') { btnClass = 'bg-pink-300 text-pink-900'; btnText = '國'; }
                                            else if (data.day_type === 'shifted') { btnClass = 'bg-slate-300 text-slate-700'; btnText = '調'; }

                                            return (
                                                <td key={d.dateStr} className={`border p-0 text-center align-top h-[64px] relative min-w-[34px] w-[34px] ${cellBg}`}>
                                                    <button
                                                        onClick={() => applyDayTypeStamp(staff.id, d.dateStr)}
                                                        className={`w-full h-4 shrink-0 rounded-none text-[9px] font-bold mb-0.5 transition-colors ${btnClass}`}
                                                    >
                                                        {btnText}
                                                    </button>
                                                    <div className="flex flex-col h-[calc(100%-18px)] w-full divide-y divide-slate-100 overflow-hidden">
                                                        {shiftsConfig.map(shift => {
                                                            const isSelected = data.shifts.includes(shift.code);
                                                            return (
                                                                <button
                                                                    key={shift.id}
                                                                    onClick={() => toggleShift(staff.id, d.dateStr, shift)}
                                                                    className={`flex-1 w-full flex items-center justify-center transition-all min-h-[12px] text-[9px] leading-none ${
                                                                        isSelected
                                                                            ? 'bg-blue-500 text-white shadow-inner font-bold'
                                                                            : 'bg-transparent text-slate-400 hover:bg-slate-200'
                                                                    }`}
                                                                    title={`${shift.name} (${shift.start}-${shift.end})`}
                                                                >
                                                                    {isSelected ? shift.code : ''}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        <td className="p-1 border sticky right-0 z-20 bg-white text-center align-middle min-w-[50px]">
                                            <div className="flex flex-col gap-0">
                                                <div className="font-bold text-slate-800 text-[10px]">{stats.totalDays} 天</div>
                                                <div className="text-slate-500 font-mono text-[9px]">{stats.totalHours} hr</div>
                                            </div>
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

                <div className="flex flex-wrap gap-2 items-center justify-end">
                    {/* 🆕 一鍵排整天設定 */}
                    <button
                        onClick={() => setFullDayFromMorning(!fullDayFromMorning)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border ${
                            fullDayFromMorning
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-400'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                    >
                        <Settings size={14} />
                        一鍵排整天 (早班)
                    </button>

                    {/* 🆕 假別印章工具列 */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-300 shadow-sm text-xs">
                        <span className="text-slate-500 font-bold px-2">假別印章:</span>
                        {(['normal', 'rest', 'regular', 'holiday', 'shifted'] as DayType[]).map(type => {
                            let label = '平日'; let color = 'text-slate-400 bg-slate-100 hover:bg-slate-200';
                            if (type === 'rest') { label = '休(休息日)'; color = 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200'; }
                            if (type === 'regular') { label = '例(例假日)'; color = 'text-red-800 bg-red-100 hover:bg-red-200'; }
                            if (type === 'holiday') { label = '國(排國定假)'; color = 'text-pink-900 bg-pink-200 hover:bg-pink-300'; }
                            if (type === 'shifted') { label = '調(調移作平日)'; color = 'text-slate-700 bg-slate-300 hover:bg-slate-400'; }

                            const isActive = activeStamp === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveStamp(type)}
                                    className={`px-3 py-1.5 rounded-md font-bold transition ${isActive ? 'ring-2 ring-blue-500 shadow-md ' + color : color + ' opacity-60'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* 🟢 營業時間設定按鈕 */}
                    <button onClick={() => setShowTimeModal(true)} className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow hover:bg-black transition">
                        <Clock size={16} /> 班別時間設定
                    </button>
                    
                    <div className="hidden md:flex flex-wrap gap-2 text-xs items-center bg白 p-2 rounded-lg border shadow-sm">
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400"></span>早</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400"></span>午</div>
                        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-purple-400"></span>晚</div>
                    </div>
                </div>
            </div>

            {/* 根據系統設定的組織單位與職稱，動態產生排班表 */}
            {entities.map((ent, idx) => {
                const staffForEntity = staffList.filter((s: Staff) => {
                    if (s.entity !== ent.id) return false;
                    const role = s.role || '';
                    if (configuredRoleSet.size === 0) return true;
                    // 若職稱未在設定中出現，為避免遺漏，預設顯示
                    if (!configuredRoleSet.has(role)) return true;
                    // 其餘依 in_roster 決定是否顯示
                    return allowedRoleSet.has(role);
                });

                const colorClass =
                    idx % 3 === 0
                        ? 'border-blue-500 text-blue-700'
                        : idx % 3 === 1
                        ? 'border-green-500 text-green-700'
                        : 'border-purple-500 text-purple-700';

                return renderTable(`👥 ${ent.name}人員`, staffForEntity, colorClass);
            })}

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
                            {businessHours.shifts.map((shift, index) => (
                                <div key={shift.id} className="flex items-center gap-4">
                                    <div className="w-16 text-center text-xs font-bold py-1 rounded text-white bg-slate-500">
                                        {shift.name} ({shift.code})
                                    </div>
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="time"
                                            value={shift.start}
                                            onChange={e => {
                                                const newShifts = businessHours.shifts.map((s, i) =>
                                                    i === index ? { ...s, start: e.target.value } : s
                                                );
                                                setBusinessHours({ ...businessHours, shifts: newShifts });
                                                setShiftsConfig(newShifts);
                                            }}
                                            className="border rounded p-2 text-sm font-mono flex-1 text-center bg-slate-50 focus:bg-white transition outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                        <span className="text-slate-400">-</span>
                                        <input
                                            type="time"
                                            value={shift.end}
                                            onChange={e => {
                                                const newShifts = businessHours.shifts.map((s, i) =>
                                                    i === index ? { ...s, end: e.target.value } : s
                                                );
                                                setBusinessHours({ ...businessHours, shifts: newShifts });
                                                setShiftsConfig(newShifts);
                                            }}
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
