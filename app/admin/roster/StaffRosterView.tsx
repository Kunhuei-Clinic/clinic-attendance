'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react';

import {
    Staff,
    DayType,
    ShiftConfig,
    RosterData,
    Entity,
    JobTitleConfig,
    BusinessHours,
} from './types';
import RosterTable from './RosterTable';

const FALLBACK_ENTITIES: Entity[] = [
    { id: 'clinic', name: '診所' },
    { id: 'pharmacy', name: '藥局' },
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

    // 🆕 一鍵排整天模式：勾選後，點「第一個班別」可視為排整天
    const [fullDayFromMorning, setFullDayFromMorning] = useState(false);
    const [activeStamp, setActiveStamp] = useState<DayType>('rest');
    const [isLoading, setIsLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // 初始化
    useEffect(() => {
        setIsMounted(true);
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setTodayStr(`${y}-${m}-${day}`);
        fetchGlobalSettings();
        fetchRosterSettings();
    }, []);

    // 集中載入當月資料
    useEffect(() => {
        loadMonthData();
    }, [currentDate]);

    // 讀取系統設定 (營業時間/班別設定 - 唯一來源)
    const fetchGlobalSettings = async () => {
        try {
            const response = await fetch('/api/settings?type=clinic');
            const result = await response.json();
            if (result.data && result.data.business_hours) {
                const settings = result.data.business_hours as BusinessHours;
                try {
                    if ((settings as any)?.shifts) {
                        const rawShifts: any = (settings as any).shifts;
                        let parsedShifts: ShiftConfig[] = [];
                        if (Array.isArray(rawShifts)) {
                            parsedShifts = rawShifts;
                        } else {
                            // 舊版 Object 格式相容轉換
                            parsedShifts = Object.entries(rawShifts).map(([key, val]: any, idx) => ({
                                id: String(idx),
                                code: key === 'AM' ? 'M' : key === 'PM' ? 'A' : 'N',
                                name: key === 'AM' ? '早診' : key === 'PM' ? '午診' : '晚診',
                                start: val.start,
                                end: val.end,
                            }));
                        }
                        setShiftsConfig(parsedShifts);
                    } else {
                        const fallbackShifts: ShiftConfig[] = [
                            { id: '1', code: 'M', name: '早診', start: '08:00', end: '12:00' },
                            { id: '2', code: 'A', name: '午診', start: '14:00', end: '18:00' },
                            { id: '3', code: 'N', name: '晚診', start: '18:30', end: '21:30' },
                        ];
                        setShiftsConfig(fallbackShifts);
                    }
                } catch (e) {
                    console.error('解析營業時間失敗', e);
                }
            }
        } catch (error) {
            console.error('Fetch global settings error:', error);
        }
    };

    // 讀取系統設定 (職稱 & 組織單位)
    const fetchRosterSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const result = await response.json();
            if (!result.data) {
                setJobTitleConfigs([{ name: '醫師', in_roster: false }, { name: '護理師', in_roster: true }]);
                setEntities(FALLBACK_ENTITIES);
                return;
            }

            const jobTitlesItem = result.data.find((item: any) => item.key === 'job_titles');
            let loadedJobTitles: JobTitleConfig[] = [];
            if (jobTitlesItem) {
                try {
                    const raw = JSON.parse(jobTitlesItem.value);
                    if (Array.isArray(raw) && raw.length > 0) {
                        if (typeof raw[0] === 'string') {
                            loadedJobTitles = (raw as string[]).map(name => ({
                                name,
                                in_roster: name === '醫師' ? false : true,
                            }));
                        } else {
                            loadedJobTitles = raw
                                .map((jt: any) => ({
                                    name: jt.name ?? '',
                                    in_roster:
                                        typeof jt.in_roster === 'boolean'
                                            ? jt.in_roster
                                            : jt.name === '醫師'
                                              ? false
                                              : true,
                                }))
                                .filter((jt: JobTitleConfig) => jt.name);
                        }
                    }
                } catch (e) {}
            }
            if (!loadedJobTitles || loadedJobTitles.length === 0) {
                loadedJobTitles = [
                    { name: '醫師', in_roster: false },
                    { name: '護理師', in_roster: true },
                    { name: '行政', in_roster: true },
                    { name: '藥師', in_roster: true },
                    { name: '清潔', in_roster: false },
                ];
            }
            setJobTitleConfigs(loadedJobTitles);

            const entItem = result.data.find((item: any) => item.key === 'org_entities');
            let loadedEntities: Entity[] = [];
            if (entItem) {
                try {
                    const rawEnt = JSON.parse(entItem.value);
                    if (Array.isArray(rawEnt) && rawEnt.length > 0) {
                        loadedEntities = rawEnt
                            .map((e: any) => ({ id: e.id ?? '', name: e.name ?? '' }))
                            .filter((e: Entity) => e.id && e.name);
                    }
                } catch (e) {}
            }
            if (!loadedEntities || loadedEntities.length === 0) {
                loadedEntities = FALLBACK_ENTITIES;
            }
            setEntities(loadedEntities);
        } catch (error) {
            setJobTitleConfigs([{ name: '醫師', in_roster: false }, { name: '護理師', in_roster: true }]);
            setEntities(FALLBACK_ENTITIES);
        }
    };

    const loadMonthData = async () => {
        setIsLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;

            const [staffRes, rosterRes, holidaysRes] = await Promise.all([
                fetch('/api/staff'),
                fetch(`/api/roster/staff?year=${year}&month=${month}`),
                fetch(`/api/roster/holidays?year=${year}&month=${month}`),
            ]);

            const [staffResult, rosterResult, holidaysResult] = await Promise.all([
                staffRes.json(),
                rosterRes.json(),
                holidaysRes.json(),
            ]);

            if (staffResult.data) {
                const roleWeight: Record<string, number> = { 醫師: 1, 主管: 2, 櫃台: 3, 護理師: 4, 營養師: 5, 診助: 6, 藥師: 7, 藥局助理: 8 };
                const sorted = [...staffResult.data].sort((a, b) => {
                    const aWeight = roleWeight[a.role || ''] ?? 999;
                    const bWeight = roleWeight[b.role || ''] ?? 999;
                    if (aWeight !== bWeight) return aWeight - bWeight;
                    return (a.name || '').localeCompare(b.name || '');
                });
                setStaffList(sorted);
            }

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
                    const cleanDate = r.date ? String(r.date).split('T')[0] : '';
                    if (!cleanDate) return;
                    map[`${r.staff_id}_${cleanDate}`] = { shifts, day_type, shift_details };
                });
            }
            setRosterMap(map);

            if (holidaysResult.data) {
                setHolidays(holidaysResult.data);
            } else {
                setHolidays([]);
            }
        } catch (error) {
            setStaffList([]);
            setRosterMap({});
            setHolidays([]);
        } finally {
            setIsLoading(false);
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

    const calculateHours = (start: string, end: string) => {
        if (!start || !end) return 0;
        const [h1, m1] = start.split(':').map(Number);
        const [h2, m2] = end.split(':').map(Number);
        return ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60;
    };

    const validateCompliance = () => {
        const errors: Record<string, string[]> = {};
        const days = getDaysInMonth();
        staffList.forEach(staff => {
            const staffErrors: string[] = [];
            const rule = staff.work_rule || 'normal';
            if (rule === 'none') return;
            let consecutiveDays = 0;
            const maxConsecutive = rule === '4week' ? 12 : 6;
            days.forEach(day => {
                const key = `${staff.id}_${day.dateStr}`;
                const data = rosterMap[key] || { shifts: [], day_type: 'normal' };
                if (data.shifts.length > 0) {
                    consecutiveDays++;
                    if (data.day_type === 'regular') {
                        if (!staffErrors.includes('例假排班')) staffErrors.push('例假排班');
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

    useEffect(() => {
        validateCompliance();
    }, [rosterMap, staffList]);

    const toggleGlobalHoliday = async (dateStr: string) => {
        if (!isEditMode) { alert('請先開啟「編輯模式」！'); return; }
        if (authLevel !== 'boss') return;
        try {
            if (holidays.includes(dateStr)) {
                const res = await fetch(`/api/roster/holidays?date=${dateStr}`, { method: 'DELETE' });
                if ((await res.json()).success) setHolidays(prev => prev.filter(h => h !== dateStr));
            } else {
                const res = await fetch('/api/roster/holidays', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: dateStr, name: '國定假日' }),
                });
                if ((await res.json()).success) setHolidays(prev => [...prev, dateStr]);
            }
        } catch (error) {}
    };

    const applyDayTypeStamp = async (staffId: string, dateStr: string) => {
        if (!isEditMode) { alert('請先開啟「編輯模式」！'); return; }
        const key = `${staffId}_${dateStr}`;
        const currentData = rosterMap[key] || { shifts: [], day_type: 'normal' };
        const nextType: DayType = currentData.day_type === activeStamp ? 'normal' : activeStamp;
        const nextShifts = nextType === 'regular' ? [] : currentData.shifts;
        updateRoster(staffId, dateStr, nextShifts, nextType, currentData.shift_details);
    };

    const toggleShift = async (staffId: string, dateStr: string, shiftConfig: ShiftConfig) => {
        if (!isEditMode) { alert('請先開啟「編輯模式」！'); return; }
        const key = `${staffId}_${dateStr}`;
        const currentData = rosterMap[key] || { shifts: [], day_type: 'normal', shift_details: {} };

        let nextShifts = [...currentData.shifts];
        const nextDetails: Record<string, { start: string; end: string }> = { ...(currentData.shift_details || {}) };

        const isActive = nextShifts.includes(shiftConfig.code);
        const isFirstShift = shiftsConfig.length > 0 && shiftConfig.code === shiftsConfig[0].code;

        if (fullDayFromMorning && isFirstShift) {
            const allCodes = shiftsConfig.map(s => s.code);
            const isFullDayActive = allCodes.every(c => currentData.shifts.includes(c));

            if (isFullDayActive) {
                nextShifts = [];
                allCodes.forEach(code => delete nextDetails[code]);
            } else {
                nextShifts = [...allCodes];
                shiftsConfig.forEach(s => { nextDetails[s.code] = { start: s.start, end: s.end }; });
            }
        } else {
            if (isActive) {
                nextShifts = nextShifts.filter(s => s !== shiftConfig.code);
                delete nextDetails[shiftConfig.code];
            } else {
                nextShifts.push(shiftConfig.code);
                nextDetails[shiftConfig.code] = { start: shiftConfig.start, end: shiftConfig.end };
            }
        }

        updateRoster(staffId, dateStr, nextShifts, currentData.day_type, nextDetails);
    };

    const updateRoster = async (
        staffId: string, dateStr: string, shifts: string[], dayType: DayType,
        details: Record<string, { start: string; end: string }> = {},
    ) => {
        const key = `${staffId}_${dateStr}`;
        const previousData = rosterMap[key];

        setRosterMap(prev => ({ ...prev, [key]: { shifts, day_type: dayType, shift_details: details } }));

        try {
            const response = await fetch('/api/roster/staff', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: staffId, date: dateStr, shifts, day_type: dayType, shift_details: details }),
            });
            const result = await response.json();
            if (!result.success) {
                alert(`排班寫入失敗: ${result.message}`);
                setRosterMap(prev => ({ ...prev, [key]: previousData || { shifts: [], day_type: 'normal', shift_details: {} } }));
            }
        } catch (error) {
            alert('網路連線異常，排班未儲存');
            setRosterMap(prev => ({ ...prev, [key]: previousData || { shifts: [], day_type: 'normal', shift_details: {} } }));
        }
    };

    const calculateStats = (staffId: string) => {
        let totalDays = 0;
        let totalHours = 0;
        const days = getDaysInMonth();

        days.forEach(day => {
            const key = `${staffId}_${day.dateStr}`;
            const data = rosterMap[key];
            if (data && data.shifts.length > 0) {
                totalDays++;
                if (data.shift_details && Object.keys(data.shift_details).length > 0) {
                    data.shifts.forEach(s => {
                        const detail = data.shift_details?.[s];
                        if (detail) {
                            totalHours += calculateHours(detail.start, detail.end);
                        } else {
                            const conf = shiftsConfig.find(sc => sc.code === s);
                            if (conf) totalHours += calculateHours(conf.start, conf.end);
                        }
                    });
                } else {
                    data.shifts.forEach(s => {
                        const conf = shiftsConfig.find(sc => sc.code === s);
                        if (conf) totalHours += calculateHours(conf.start, conf.end);
                    });
                }
            }
        });
        return { totalDays, totalHours: Math.round(totalHours * 10) / 10 };
    };

    const days = getDaysInMonth();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const configuredRoleSet = new Set(jobTitleConfigs.map(j => j.name));
    const allowedRoleSet = new Set(jobTitleConfigs.filter(j => j.in_roster).map(j => j.name));

    if (!isMounted) return null;

    return (
        <div className="w-full p-4 animate-fade-in pb-20 relative min-h-[600px]">
            {isLoading && (
                <div className="absolute inset-0 z-50 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-2xl transition-all">
                    <div className="flex flex-col items-center gap-4 bg-white/95 p-8 rounded-2xl shadow-2xl border border-slate-100">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <span className="text-slate-700 font-bold animate-pulse text-lg">班表資料載入與規則檢查中...</span>
                    </div>
                </div>
            )}

            {/* 🟢 升級：吸頂浮動的工具列 (Sticky Header) */}
            <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md p-3 rounded-xl shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-col xl:flex-row justify-between mb-6 items-center gap-4 -mt-2 transition-all">
                
                {/* 左側月份切換 */}
                <div className="flex items-center gap-4 bg-white p-1 rounded-full shadow-sm border border-slate-200 shrink-0">
                    <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                        className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <h2 className="text-lg font-black min-w-[120px] text-center text-slate-700">
                        {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
                    </h2>
                    <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                        className="p-2 hover:bg-slate-100 rounded-full transition text-slate-500"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* 右側工具區 */}
                <div className="flex flex-wrap gap-3 items-center justify-end">
                    
                    <button
                        onClick={() => setFullDayFromMorning(!fullDayFromMorning)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition ${
                            fullDayFromMorning
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-400 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                        title="勾選後，點擊每日的第一個班次，系統會自動排滿整天"
                    >
                        <Settings size={14} /> 一鍵排整天
                    </button>

                    {/* 印章工具列 */}
                    <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-300 shadow-sm text-xs">
                        <span className="text-slate-400 font-bold px-2 flex items-center gap-1">
                            印章<ChevronRight size={12}/>
                        </span>
                        {(['normal', 'rest', 'regular', 'holiday', 'shifted'] as DayType[]).map(type => {
                            let label = '平日';
                            let color = 'text-slate-500 bg-slate-50 hover:bg-slate-200 border-slate-200';
                            if (type === 'rest') { label = '休'; color = 'text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border-emerald-200'; }
                            if (type === 'regular') { label = '例'; color = 'text-red-800 bg-red-100 hover:bg-red-200 border-red-200'; }
                            if (type === 'holiday') { label = '國'; color = 'text-pink-900 bg-pink-200 hover:bg-pink-300 border-pink-200'; }
                            if (type === 'shifted') { label = '調'; color = 'text-slate-700 bg-slate-300 hover:bg-slate-400 border-slate-300'; }

                            const isActive = activeStamp === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveStamp(type)}
                                    className={`px-3 py-1.5 rounded border font-bold transition-all ${
                                        isActive ? `ring-2 ring-blue-400 ring-offset-1 shadow-md ${color}` : `${color} opacity-60 hover:opacity-100`
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>

                    {/* 編輯模式切換 */}
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold shadow-sm transition-all transform ${
                            isEditMode
                                ? 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300 ring-offset-2'
                                : 'bg-slate-800 text-white hover:bg-black'
                        }`}
                    >
                        {isEditMode ? (
                            <><span>✏️</span> 編輯中 (點擊鎖定)</>
                        ) : (
                            <><span>🔒</span> 瀏覽模式 (點擊解鎖)</>
                        )}
                    </button>
                </div>
            </div>

            {/* 根據系統設定動態產生排班表 */}
            {entities.map((ent, idx) => {
                const staffForEntity = staffList.filter((s: Staff) => {
                    if (s.entity !== ent.id) return false;
                    const role = s.role || '';
                    if (configuredRoleSet.size === 0) return true;
                    if (!configuredRoleSet.has(role)) return true;
                    return allowedRoleSet.has(role);
                });

                const colorClass =
                    idx % 3 === 0 ? 'border-blue-500 text-blue-700'
                    : idx % 3 === 1 ? 'border-green-500 text-green-700'
                    : 'border-purple-500 text-purple-700';

                return (
                    <RosterTable
                        key={ent.id}
                        title={`👥 ${ent.name}人員`}
                        staffForEntity={staffForEntity}
                        colorClass={colorClass}
                        days={days}
                        todayStr={todayStr}
                        weekDays={weekDays}
                        rosterMap={rosterMap}
                        holidays={holidays}
                        isEditMode={isEditMode}
                        complianceErrors={complianceErrors}
                        shiftsConfig={shiftsConfig}
                        calculateStats={calculateStats}
                        applyDayTypeStamp={applyDayTypeStamp}
                        toggleShift={toggleShift}
                        toggleGlobalHoliday={toggleGlobalHoliday}
                    />
                );
            })}
        </div>
    );
}

