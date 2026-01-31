'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Lock } from 'lucide-react';

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

export default function PublicRosterPage() {
    const [isMounted, setIsMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
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
    }, []);

    // 載入系統設定（只在初始化時執行一次）
    useEffect(() => {
        if (isMounted) {
            loadSettings();
        }
    }, [isMounted]);

    // 當設定載入完成且 currentDate 存在時，載入資料
    useEffect(() => {
        if (currentDate && entities.length > 0) {
            loadData();
        }
    }, [currentDate, entities.length]);

    // 載入系統設定
    const loadSettings = async () => {
        try {
            setIsLoading(true);
            await Promise.all([
                fetchGlobalSettings(),
                fetchRosterSettings()
            ]);
        } catch (error) {
            console.error('Load settings error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 載入資料（員工、班表、假日）
    const loadData = async () => {
        if (!currentDate) return;
        try {
            await Promise.all([
                fetchStaff(),
                fetchRoster(),
                fetchHolidays()
            ]);
        } catch (error) {
            console.error('Load data error:', error);
        }
    };

    // 🟢 功能：讀取系統設定 (營業時間)
    const fetchGlobalSettings = async () => {
        try {
            const response = await fetch('/api/settings?key=clinic_business_hours');
            const result = await response.json();
            if (result.data && result.data.length > 0 && result.data[0].value) {
                try {
                    const settings = JSON.parse(result.data[0].value);
                    setBusinessHours(settings);
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

    const fetchStaff = async () => {
        try {
            const response = await fetch('/api/staff');
            const result = await response.json();
            if (result.data) {
                setStaffList(result.data);
            }
        } catch (error) {
            console.error('Fetch staff error:', error);
            setStaffList([]);
        }
    };

    const fetchHolidays = async () => {
        if (!currentDate) return;
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const response = await fetch(`/api/roster/holidays?year=${year}&month=${month}`);
            const result = await response.json();
            if (result.data) {
                setHolidays(result.data);
            } else {
                setHolidays([]);
            }
        } catch (error) {
            console.error('Fetch holidays error:', error);
            setHolidays([]);
        }
    };

    const fetchRoster = async () => {
        if (!currentDate) return;
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const response = await fetch(`/api/roster/staff?year=${year}&month=${month}`);
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
            }
            setRosterMap(map);
        } catch (error) {
            console.error('Fetch roster error:', error);
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

    // Loading 狀態
    if (!isMounted || isLoading || !currentDate || entities.length === 0) {
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

    // 🟢 依 job_titles 設定取得允許排班的職稱（只顯示 in_roster === true）
    const configuredRoleSet = new Set(jobTitleConfigs.map(j => j.name));
    const allowedRoleSet = new Set(
        jobTitleConfigs.filter(j => j.in_roster === true).map(j => j.name)
    );

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
                                            className={`p-0.5 md:p-1 border text-center min-w-[28px] md:min-w-[35px] ${headerBg} ${textColor} ${isToday ? 'border-b-2 md:border-b-4 border-yellow-400' : ''}`}
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
                                                className={`border p-0.5 text-center align-top h-10 md:h-12 min-w-[28px] md:min-w-[35px] ${cellBg} ${isToday ? 'border-x-2 border-yellow-300' : ''}`}
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
                    {entities.map((ent, idx) => {
                        // 🟢 過濾邏輯：只顯示該組織單位且職稱在 allowedRoleSet 中的員工
                        const staffForEntity = staffList.filter((s: Staff) => {
                            // 必須屬於該組織單位
                            if (s.entity !== ent.id) return false;
                            
                            const role = s.role || '';
                            
                            // 如果沒有設定職稱，預設顯示（避免遺漏）
                            if (configuredRoleSet.size === 0) return true;
                            
                            // 若職稱未在設定中出現，為避免遺漏，預設顯示
                            if (!configuredRoleSet.has(role)) return true;
                            
                            // 🟢 只顯示 in_roster === true 的職稱
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
