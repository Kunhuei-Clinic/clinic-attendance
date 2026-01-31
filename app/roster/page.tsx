'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

// 定義班別代號映射 (SettingsView 用 AM/PM/NIGHT，這裡用 M/A/N)
const SHIFT_MAPPING: Record<string, 'AM' | 'PM' | 'NIGHT'> = {
    'M': 'AM',
    'A': 'PM',
    'N': 'NIGHT'
};

type Staff = { id: number; name: string; role: string; display_order: number; entity?: string; };
type Shift = 'M' | 'A' | 'N';
type DayType = 'normal' | 'rest' | 'regular';
type RosterData = { shifts: Shift[]; day_type: DayType; shift_details?: Record<string, { start: string, end: string }> };

type Entity = { id: string; name: string };
type JobTitleConfig = { name: string; in_roster: boolean };

const FALLBACK_ENTITIES: Entity[] = [
    { id: 'clinic', name: '診所' },
    { id: 'pharmacy', name: '藥局' }
];

type ErrorState = {
    type: 'unauthorized' | 'other' | null;
    message: string;
};

export default function PublicRosterPage() {
    const router = useRouter();
    const [isMounted, setIsMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [errorState, setErrorState] = useState<ErrorState>({ type: null, message: '' });
    const [currentDate, setCurrentDate] = useState<Date | null>(null);
    const [todayStr, setTodayStr] = useState('');
    const [staffList, setStaffList] = useState<Staff[]>([]);
    const [rosterMap, setRosterMap] = useState<Record<string, RosterData>>({});
    const [holidays, setHolidays] = useState<string[]>([]);
    const [entities, setEntities] = useState<Entity[]>([]);
    const [jobTitleConfigs, setJobTitleConfigs] = useState<JobTitleConfig[]>([]);
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
        setCurrentDate(new Date());
        console.log('[PublicRoster] 初始化完成');
    }, []);

    // 載入所有資料（設定 + 資料）
    useEffect(() => {
        if (isMounted && currentDate) {
            loadAllData();
        }
    }, [isMounted, currentDate]);

    // 🟢 載入所有資料：使用 Promise.all 同時載入
    const loadAllData = async () => {
        if (!currentDate) return;
        
        try {
            setIsLoading(true);
            setErrorState({ type: null, message: '' });
            console.log('[PublicRoster] 開始載入資料...');

            // 🟢 使用 Promise.all 同時載入設定和資料
            await Promise.all([
                loadSettings(),
                loadData()
            ]);

            console.log('[PublicRoster] 資料載入完成', {
                entities: entities.length,
                staffCount: staffList.length,
                rosterCount: Object.keys(rosterMap).length
            });
        } catch (error: any) {
            console.error('[PublicRoster] 載入資料失敗:', error);
            setErrorState({
                type: 'other',
                message: error.message || '載入資料時發生錯誤'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // 🟢 載入系統設定（失敗時使用 fallback）
    const loadSettings = async () => {
        try {
            console.log('[PublicRoster] 載入系統設定...');
            
            await Promise.all([
                fetchGlobalSettings(),
                fetchRosterSettings()
            ]);

            // 🟢 確保即使設定載入失敗，也有 fallback 值
            if (entities.length === 0) {
                console.log('[PublicRoster] 使用 fallback entities');
                setEntities(FALLBACK_ENTITIES);
            }
            if (jobTitleConfigs.length === 0) {
                console.log('[PublicRoster] 使用 fallback job titles');
                setJobTitleConfigs([
                    { name: '醫師', in_roster: false },
                    { name: '護理師', in_roster: true },
                    { name: '行政', in_roster: true },
                    { name: '藥師', in_roster: true }
                ]);
            }
        } catch (error) {
            console.error('[PublicRoster] 載入設定失敗，使用 fallback:', error);
            // 🟢 設定失敗時使用 fallback
            setEntities(FALLBACK_ENTITIES);
            setJobTitleConfigs([
                { name: '醫師', in_roster: false },
                { name: '護理師', in_roster: true },
                { name: '行政', in_roster: true },
                { name: '藥師', in_roster: true }
            ]);
        }
    };

    // 🟢 載入資料（員工、班表、假日）
    const loadData = async () => {
        if (!currentDate) return;
        
        try {
            console.log('[PublicRoster] 載入員工、班表、假日資料...');
            
            await Promise.all([
                fetchStaff(),
                fetchRoster(),
                fetchHolidays()
            ]);
        } catch (error) {
            console.error('[PublicRoster] 載入資料失敗:', error);
            throw error;
        }
    };

    // 🟢 API 呼叫：檢查 401 錯誤
    const handleApiError = (response: Response, apiName: string) => {
        if (response.status === 401) {
            console.error(`[PublicRoster] ${apiName} 401 Unauthorized`);
            setErrorState({
                type: 'unauthorized',
                message: '請先登入系統'
            });
            return true;
        } else if (!response.ok) {
            console.error(`[PublicRoster] ${apiName} 錯誤:`, response.status, response.statusText);
            setErrorState({
                type: 'other',
                message: `載入失敗 (${response.status})`
            });
            return true;
        }
        return false;
    };

    // 🟢 功能：讀取系統設定 (營業時間)
    const fetchGlobalSettings = async () => {
        try {
            const response = await fetch('/api/settings?key=clinic_business_hours');
            if (handleApiError(response, 'fetchGlobalSettings')) return;

            const result = await response.json();
            if (result.data && result.data.length > 0 && result.data[0].value) {
                try {
                    const settings = JSON.parse(result.data[0].value);
                    setBusinessHours(settings);
                    console.log('[PublicRoster] 營業時間設定載入成功');
                } catch (e) {
                    console.error('[PublicRoster] 解析營業時間失敗', e);
                }
            }
        } catch (error) {
            console.error('[PublicRoster] Fetch global settings error:', error);
            // 不拋出錯誤，使用預設值
        }
    };

    // 🟢 功能：讀取系統設定 (職稱 & 組織單位)
    const fetchRosterSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            if (handleApiError(response, 'fetchRosterSettings')) return;

            const result = await response.json();
            console.log('[PublicRoster] Settings API 回應:', result);

            // job_titles
            const jobTitlesItem = result.data?.find((item: any) => item.key === 'job_titles');
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
                    console.error('[PublicRoster] Parse job_titles error:', e);
                }
            }
            
            // 🟢 如果職稱設定讀取失敗，預設顯示所有職稱（除了醫師）
            if (!loadedJobTitles || loadedJobTitles.length === 0) {
                console.log('[PublicRoster] 使用預設職稱設定（顯示所有職稱，醫師除外）');
                loadedJobTitles = [
                    { name: '醫師', in_roster: false },
                    { name: '護理師', in_roster: true },
                    { name: '行政', in_roster: true },
                    { name: '藥師', in_roster: true },
                    { name: '櫃台', in_roster: true },
                    { name: '診所助理', in_roster: true },
                    { name: '藥局助理', in_roster: true }
                ];
            }
            setJobTitleConfigs(loadedJobTitles);
            console.log('[PublicRoster] 職稱設定:', loadedJobTitles);

            // org_entities
            const entItem = result.data?.find((item: any) => item.key === 'org_entities');
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
                    console.error('[PublicRoster] Parse org_entities error:', e);
                }
            }
            
            // 🟢 如果組織單位讀取失敗，使用 fallback
            if (!loadedEntities || loadedEntities.length === 0) {
                console.log('[PublicRoster] 使用 fallback entities');
                loadedEntities = FALLBACK_ENTITIES;
            }
            setEntities(loadedEntities);
            console.log('[PublicRoster] 組織單位:', loadedEntities);
        } catch (error) {
            console.error('[PublicRoster] Fetch roster settings error:', error);
            // 🟢 設定失敗時使用 fallback
            setJobTitleConfigs([
                { name: '醫師', in_roster: false },
                { name: '護理師', in_roster: true },
                { name: '行政', in_roster: true },
                { name: '藥師', in_roster: true }
            ]);
            setEntities(FALLBACK_ENTITIES);
        }
    };

    const fetchStaff = async () => {
        try {
            const response = await fetch('/api/staff');
            if (handleApiError(response, 'fetchStaff')) return;

            const result = await response.json();
            if (result.data) {
                setStaffList(result.data);
                console.log('[PublicRoster] 員工列表載入成功:', result.data.length, '人');
            } else {
                setStaffList([]);
                console.log('[PublicRoster] 員工列表為空');
            }
        } catch (error) {
            console.error('[PublicRoster] Fetch staff error:', error);
            setStaffList([]);
        }
    };

    const fetchHolidays = async () => {
        if (!currentDate) return;
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const response = await fetch(`/api/roster/holidays?year=${year}&month=${month}`);
            if (handleApiError(response, 'fetchHolidays')) return;

            const result = await response.json();
            if (result.data) {
                setHolidays(result.data);
                console.log('[PublicRoster] 假日列表載入成功:', result.data.length, '天');
            } else {
                setHolidays([]);
            }
        } catch (error) {
            console.error('[PublicRoster] Fetch holidays error:', error);
            setHolidays([]);
        }
    };

    const fetchRoster = async () => {
        if (!currentDate) return;
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const response = await fetch(`/api/roster/staff?year=${year}&month=${month}`);
            if (handleApiError(response, 'fetchRoster')) return;

            const result = await response.json();
            const map: Record<string, RosterData> = {};
            if (result.data) {
                result.data.forEach((r: any) => {
                    let shifts: Shift[] = [];
                    if (Array.isArray(r.shifts)) {
                        shifts = r.shifts.filter((s: any) => typeof s === 'string' && ['M', 'A', 'N'].includes(s));
                    }
                    let day_type: DayType = 'normal';
                    if (r.day_type === 'rest') day_type = 'rest';
                    if (r.day_type === 'regular') day_type = 'regular';

                    const shift_details = r.shift_details || {};
                    map[`${r.staff_id}_${r.date}`] = { shifts, day_type, shift_details };
                });
                setRosterMap(map);
                console.log('[PublicRoster] 班表資料載入成功:', Object.keys(map).length, '筆');
            } else {
                setRosterMap({});
                console.log('[PublicRoster] 班表資料為空');
            }
        } catch (error) {
            console.error('[PublicRoster] Fetch roster error:', error);
            setRosterMap({});
        }
    };

    const getDaysInMonth = () => {
        if (!currentDate) return [];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysCount = new Date(year, month + 1, 0).getDate();
        return Array.from({ length: daysCount }, (_, i) => {
            const d = new Date(year, month, i + 1);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
            return { dateObj: d, dateStr: dateStr, dayOfWeek: d.getDay() };
        });
    };

    // 🟢 錯誤顯示 UI
    if (errorState.type === 'unauthorized') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">需要登入</h2>
                    <p className="text-gray-600 mb-6">請先登入系統以查看班表</p>
                    <button
                        onClick={() => router.push('/login')}
                        className="bg-blue-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 transition"
                    >
                        前往登入
                    </button>
                </div>
            </div>
        );
    }

    if (errorState.type === 'other') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
                    <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-800 mb-2">載入失敗</h2>
                    <p className="text-gray-600 mb-6">{errorState.message}</p>
                    <button
                        onClick={loadAllData}
                        className="bg-blue-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 transition flex items-center gap-2 mx-auto"
                    >
                        <RefreshCw className="w-4 h-4" />
                        重試
                    </button>
                </div>
            </div>
        );
    }

    // Loading 狀態
    if (!isMounted || isLoading || !currentDate) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <div>載入中...</div>
                </div>
            </div>
        );
    }

    const days = getDaysInMonth();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // 取得班別時間顯示（優先使用 snapshot，否則使用預設值）
    const getShiftTimeDisplay = (shift: Shift, shiftDetails?: Record<string, { start: string, end: string }>) => {
        if (shiftDetails && shiftDetails[shift]) {
            return `${shiftDetails[shift].start}-${shiftDetails[shift].end}`;
        }
        const settingKey = SHIFT_MAPPING[shift];
        const timeSetting = businessHours.shifts[settingKey];
        return `${timeSetting.start}-${timeSetting.end}`;
    };

    // 🟢 寬容的職稱過濾邏輯
    const configuredRoleSet = new Set(jobTitleConfigs.map(j => j.name));
    const allowedRoleSet = new Set(
        jobTitleConfigs.filter(j => j.in_roster === true).map(j => j.name)
    );

    // 🟢 判斷員工是否應該顯示（寬容邏輯）
    const shouldShowStaff = (staff: Staff): boolean => {
        const role = staff.role || '';
        
        // 如果沒有設定職稱，預設顯示所有職稱（除了醫師）
        if (configuredRoleSet.size === 0) {
            return role !== '醫師';
        }
        
        // 若職稱未在設定中出現，為避免遺漏，預設顯示（除了醫師）
        if (!configuredRoleSet.has(role)) {
            return role !== '醫師';
        }
        
        // 其餘依 in_roster 決定是否顯示
        return allowedRoleSet.has(role);
    };

    // 🟢 取得所有已使用的 entity ID
    const usedEntityIds = new Set(entities.map(e => e.id));

    // 🟢 取得「其他人員」（entity 不符合上述 ID 的員工）
    const otherStaff = staffList.filter((s: Staff) => {
        if (!shouldShowStaff(s)) return false;
        // 不屬於任何已設定的組織單位
        return !s.entity || !usedEntityIds.has(s.entity);
    });

    // UI Render Helper：根據給定的員工清單渲染一張表
    const renderTable = (title: string, staffForEntity: Staff[], colorClass: string) => {
        const groupStaff = staffForEntity
            .slice()
            .sort((a, b) => a.role.localeCompare(b.role) || a.display_order - b.display_order);

        if (groupStaff.length === 0) return null;

        return (
            <div className="mb-6 md:mb-8 overflow-hidden rounded-lg shadow-sm border border-slate-200">
                <h3 className={`font-bold text-sm md:text-md p-2 md:p-3 border-b bg-white border-l-4 ${colorClass}`}>
                    {title}
                </h3>
                <div className="overflow-x-auto -mx-2 md:mx-0">
                    <table className="w-full border-collapse bg-white text-xs md:text-sm">
                        <thead>
                            <tr>
                                <th className="p-1.5 md:p-2 border bg-slate-50 sticky left-0 z-30 min-w-[70px] md:min-w-[100px] text-left text-slate-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    員工
                                </th>
                                {days.map(d => {
                                    const isToday = d.dateStr === todayStr;
                                    const isHoliday = holidays.includes(d.dateStr);

                                    let headerBg = 'bg-slate-50';
                                    let textColor = 'text-slate-800';
                                    if (isHoliday) {
                                        headerBg = 'bg-red-100';
                                        textColor = 'text-red-700';
                                    } else if (isToday) {
                                        headerBg = 'bg-yellow-100';
                                    } else if (d.dayOfWeek === 0 || d.dayOfWeek === 6) {
                                        headerBg = 'bg-red-50';
                                        textColor = 'text-red-600';
                                    }

                                    return (
                                        <th
                                            key={d.dateStr}
                                            className={`p-0.5 md:p-1 border text-center min-w-[50px] ${headerBg} ${textColor} ${isToday ? 'border-b-2 md:border-b-4 border-yellow-400' : ''}`}
                                        >
                                            <div className="text-[10px] md:text-xs font-bold">
                                                {d.dateObj.getDate()}
                                            </div>
                                            <div className="text-[8px] md:text-[10px] flex items-center justify-center gap-0.5">
                                                {isHoliday && <Lock size={7} className="md:w-2 md:h-2" />}
                                                {isHoliday ? '國' : weekDays[d.dayOfWeek]}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {groupStaff.map(staff => (
                                <tr key={staff.id}>
                                    <td className="p-1.5 md:p-2 border font-bold text-slate-700 sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                                        <div className="text-xs md:text-sm">{staff.name}</div>
                                        <div className="text-[9px] md:text-[10px] text-slate-400">{staff.role}</div>
                                    </td>
                                    {days.map(d => {
                                        const key = `${staff.id}_${d.dateStr}`;
                                        const data = rosterMap[key] || { shifts: [], day_type: 'normal' };
                                        const isToday = d.dateStr === todayStr;
                                        const isHoliday = holidays.includes(d.dateStr);

                                        let cellBg = isToday ? 'bg-yellow-50' : '';
                                        if (isHoliday) cellBg = 'bg-red-50/30';

                                        let badge = null;
                                        if (data.day_type === 'rest') {
                                            if (!isToday) cellBg = 'bg-emerald-50';
                                            badge = (
                                                <span className="block text-[7px] md:text-[8px] text-emerald-600 font-bold mb-0.5">
                                                    休
                                                </span>
                                            );
                                        } else if (data.day_type === 'regular') {
                                            cellBg =
                                                'bg-red-50 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:8px_8px] md:bg-[length:10px_10px]';
                                            badge = (
                                                <span className="block text-[7px] md:text-[8px] text-red-500 font-bold mb-0.5">
                                                    例
                                                </span>
                                            );
                                        }

                                        return (
                                            <td
                                                key={d.dateStr}
                                                className={`border p-0.5 text-center align-top h-10 md:h-12 min-w-[50px] ${cellBg} ${isToday ? 'border-x-2 border-yellow-300' : ''}`}
                                            >
                                                {badge}
                                                <div className="flex flex-col gap-[1px] h-full justify-center">
                                                    {(['M', 'A', 'N'] as Shift[]).map(s => {
                                                        if (!data.shifts.includes(s)) return null;
                                                        const colorClass =
                                                            s === 'M' ? 'bg-orange-400' : s === 'A' ? 'bg-blue-400' : 'bg-purple-400';
                                                        const timeDisplay = getShiftTimeDisplay(s, data.shift_details);
                                                        const shiftLabel = s === 'M' ? '早' : s === 'A' ? '午' : '晚';
                                                        return (
                                                            <div
                                                                key={s}
                                                                className={`h-2 md:h-2.5 w-full rounded-[1px] ${colorClass}`}
                                                                title={`${shiftLabel}班 ${timeDisplay}`}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 p-2 md:p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header Area - 優化手機端顯示 */}
                <div className="flex flex-col md:flex-row items-center justify-between mb-4 md:mb-6 bg-white p-3 md:p-4 rounded-xl shadow-sm gap-3">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Calendar className="text-blue-500 w-5 h-5 md:w-6 md:h-6" />
                        <h1 className="text-lg md:text-xl font-bold">診所班表查詢</h1>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full text-xs md:text-sm">
                        <button
                            onClick={() => setCurrentDate(new Date(currentDate!.getFullYear(), currentDate!.getMonth() - 1, 1))}
                            className="p-1 hover:bg-white rounded-full transition"
                            aria-label="上一個月"
                        >
                            <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <span className="font-bold min-w-[70px] md:min-w-[80px] text-center">
                            {currentDate!.getFullYear()}/{currentDate!.getMonth() + 1}
                        </span>
                        <button
                            onClick={() => setCurrentDate(new Date(currentDate!.getFullYear(), currentDate!.getMonth() + 1, 1))}
                            className="p-1 hover:bg-white rounded-full transition"
                            aria-label="下一個月"
                        >
                            <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    </div>
                </div>

                {/* 班別圖例 - 手機端隱藏，平板以上顯示 */}
                <div className="hidden md:flex flex-wrap gap-2 text-xs items-center bg-white p-2 rounded-lg border shadow-sm mb-4">
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-orange-400"></span>
                        <span>早班</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-blue-400"></span>
                        <span>午班</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm bg-purple-400"></span>
                        <span>晚班</span>
                    </div>
                </div>

                {/* 🟢 根據系統設定的組織單位與職稱，動態產生排班表 */}
                <div className="pb-8">
                    {/* 先顯示設定好的組織 */}
                    {entities.map((ent, idx) => {
                        const staffForEntity = staffList.filter((s: Staff) => {
                            if (s.entity !== ent.id) return false;
                            return shouldShowStaff(s);
                        });

                        const colorClass =
                            idx % 3 === 0
                                ? 'border-blue-500 text-blue-700'
                                : idx % 3 === 1
                                ? 'border-green-500 text-green-700'
                                : 'border-purple-500 text-purple-700';

                        return renderTable(`👥 ${ent.name}人員`, staffForEntity, colorClass);
                    })}

                    {/* 🟢 最後加一個「其他人員」群組 */}
                    {otherStaff.length > 0 && (
                        renderTable('👥 其他人員', otherStaff, 'border-gray-500 text-gray-700')
                    )}
                </div>

                {/* 說明文字 */}
                <div className="text-center text-[10px] md:text-xs text-slate-400 mt-6 md:mt-8 px-2">
                    <div>僅供內部查詢使用 • 黃底標示為今日</div>
                    <div className="mt-1">點擊班別色塊可查看詳細時間</div>
                </div>
            </div>
        </div>
    );
}
