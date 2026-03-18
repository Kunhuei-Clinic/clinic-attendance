'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, HelpCircle } from 'lucide-react';

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
    { id: 'default', name: '預設單位' }
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

            if (staffResult.data) {
                // 🟢 智能隱藏離職人員邏輯：若已離職，且本月完全沒排班，才從班表隱藏
                const activeAndScheduledStaff = staffResult.data.filter((s: any) => {
                    if (s.is_active !== false) return true;
                    const hasRosterThisMonth = Object.keys(map).some(key => 
                        key.startsWith(`${s.id}_`) && 
                        (map[key].shifts.length > 0 || map[key].day_type !== 'normal')
                    );
                    return hasRosterThisMonth;
                });

                // 🌟 通用化排序：依據「系統設定」中的職稱陣列順序來決定權重
                // 若客戶在設定裡把「店長」排第一，「護理師」排第二，這裡就會自動抓到那個順序
                const getRoleWeight = (roleName: string) => {
                    const index = jobTitleConfigs.findIndex(j => j.name === roleName);
                    return index === -1 ? 999 : index; // 找不到的排最後
                };

                const sorted = activeAndScheduledStaff.sort((a: any, b: any) => {
                    // 先比職稱權重
                    const aWeight = getRoleWeight(a.role || '');
                    const bWeight = getRoleWeight(b.role || '');
                    if (aWeight !== bWeight) return aWeight - bWeight;

                    // 職稱相同則比員工自訂的 display_order (若有)
                    const aOrder = a.display_order ?? 999;
                    const bOrder = b.display_order ?? 999;
                    if (aOrder !== bOrder) return aOrder - bOrder;

                    // 最後依姓名排序
                    return (a.name || '').localeCompare(b.name || '');
                });
                setStaffList(sorted);
            }

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

        let startMins = h1 * 60 + m1;
        let endMins = h2 * 60 + m2;

        // 🌟 跨夜班處理 (例如 22:00 ~ 06:00)
        // 如果結束時間小於開始時間，代表跨過了午夜 00:00，結束時間要加上 24 小時 (1440 分鐘)
        if (endMins < startMins) {
            endMins += 1440;
        }

        return (endMins - startMins) / 60;
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

                    {/* 🟢 升級：單日屬性標籤 (取代印章) */}
                    <div className="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-slate-300 shadow-sm text-xs">
                        <span className="text-slate-500 font-bold px-2 border-r border-slate-200 mr-1">
                            單日屬性
                        </span>

                        {/* 第一組：常規屬性 */}
                        {(['normal', 'rest', 'regular'] as DayType[]).map(type => {
                            let label = '平日';
                            let color = 'text-slate-500 hover:bg-slate-200 bg-slate-50 border-slate-200';
                            if (type === 'rest') { label = '休息日'; color = 'text-emerald-800 hover:bg-emerald-200 bg-emerald-50 border-emerald-200'; }
                            if (type === 'regular') { label = '例假日'; color = 'text-red-800 hover:bg-red-200 bg-red-50 border-red-200'; }

                            const isActive = activeStamp === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveStamp(type)}
                                    className={`px-3 py-1.5 rounded border font-bold transition-all ${
                                        isActive ? `ring-2 ring-blue-400 ring-offset-1 shadow-md ${color}` : `${color} opacity-70 hover:opacity-100`
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}

                        <div className="w-px h-4 bg-slate-300 mx-1"></div>

                        {/* 第二組：特殊屬性 */}
                        {(['holiday', 'shifted'] as DayType[]).map(type => {
                            let label = '國定假日';
                            let color = 'text-pink-900 hover:bg-pink-200 bg-pink-50 border-pink-200';
                            if (type === 'shifted') { label = '變形調移'; color = 'text-slate-700 hover:bg-slate-300 bg-slate-100 border-slate-300'; }

                            const isActive = activeStamp === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveStamp(type)}
                                    className={`px-3 py-1.5 rounded border font-bold transition-all ${
                                        isActive ? `ring-2 ring-blue-400 ring-offset-1 shadow-md ${color}` : `${color} opacity-70 hover:opacity-100`
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}

                        {/* 提示 Tooltip */}
                        <div className="group relative ml-1 flex items-center justify-center">
                            <HelpCircle size={16} className="text-slate-400 cursor-help hover:text-blue-500 transition" />
                            <div className="absolute top-full mt-2 right-0 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition z-50 leading-relaxed">
                                <strong>💡 屬性標籤使用說明：</strong><br/>
                                1. 點選上方標籤後，再點擊員工排班表上的格子，即可寫入該屬性。<br/>
                                2. <span className="text-pink-300">國定假日</span>：用於標記個別員工的國假出勤或調休補假。<br/>
                                3. <span className="text-slate-300">變形調移</span>：用於標記實施變形工時的調班日。<br/><br/>
                                <strong className="text-yellow-300">📅 全院休假快捷鍵：</strong><br/>
                                若遇到全診所休診（如颱風假、特定國假），請直接點擊 <strong className="text-white">表格頂部的「日期數字」</strong>，即可一鍵將該日設為全院國定假日！
                            </div>
                        </div>
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

