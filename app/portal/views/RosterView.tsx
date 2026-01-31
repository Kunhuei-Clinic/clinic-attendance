'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Lock, User, Stethoscope } from 'lucide-react';
import PortalTopHeader from './PortalTopHeader';

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

interface RosterViewProps {
    rosterData: any[];
    staffUser: { role?: string | null; name?: string | null } | any;
}

export default function RosterView({ rosterData, staffUser }: RosterViewProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'doctor'>('general');
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
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setTodayStr(`${y}-${m}-${day}`);
        setCurrentDate(new Date());
    }, []);

    // 載入所有資料
    useEffect(() => {
        if (currentDate) {
            loadAllData();
        }
    }, [currentDate]);

    // 🟢 載入所有資料：使用 Promise.all 同時載入
    const loadAllData = async () => {
        if (!currentDate) return;
        
        try {
            setIsLoading(true);
            await Promise.all([
                loadSettings(),
                loadData()
            ]);
            
            // 確保即使設定載入失敗，也有 fallback 值
            if (entities.length === 0) {
                setEntities(FALLBACK_ENTITIES);
            }
            if (jobTitleConfigs.length === 0) {
                setJobTitleConfigs([
                    { name: '醫師', in_roster: false },
                    { name: '護理師', in_roster: true },
                    { name: '行政', in_roster: true },
                    { name: '藥師', in_roster: true }
                ]);
            }
        } catch (error) {
            console.error('[RosterView] 載入資料失敗:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // 🟢 載入系統設定
    const loadSettings = async () => {
        try {
            await Promise.all([
                fetchGlobalSettings(),
                fetchRosterSettings()
            ]);
        } catch (error) {
            console.error('[RosterView] 載入設定失敗:', error);
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
            await Promise.all([
                fetchStaff(),
                fetchRoster(),
                fetchHolidays()
            ]);
        } catch (error) {
            console.error('[RosterView] 載入資料失敗:', error);
        }
    };

    const fetchGlobalSettings = async () => {
        try {
            const response = await fetch('/api/settings?key=clinic_business_hours');
            const result = await response.json();
            if (result.data && result.data.length > 0 && result.data[0].value) {
                try {
                    const settings = JSON.parse(result.data[0].value);
                    setBusinessHours(settings);
                } catch (e) {
                    console.error('[RosterView] 解析營業時間失敗', e);
                }
            }
        } catch (error) {
            console.error('[RosterView] Fetch global settings error:', error);
        }
    };

    const fetchRosterSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const result = await response.json();

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
                    console.error('[RosterView] Parse job_titles error:', e);
                }
            }
            if (!loadedJobTitles || loadedJobTitles.length === 0) {
                loadedJobTitles = [
                    { name: '醫師', in_roster: false },
                    { name: '護理師', in_roster: true },
                    { name: '行政', in_roster: true },
                    { name: '藥師', in_roster: true }
                ];
            }
            setJobTitleConfigs(loadedJobTitles);

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
                    console.error('[RosterView] Parse org_entities error:', e);
                }
            }
            if (!loadedEntities || loadedEntities.length === 0) {
                loadedEntities = FALLBACK_ENTITIES;
            }
            setEntities(loadedEntities);
        } catch (error) {
            console.error('[RosterView] Fetch roster settings error:', error);
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
            const result = await response.json();
            if (result.data) {
                setStaffList(result.data);
            }
        } catch (error) {
            console.error('[RosterView] Fetch staff error:', error);
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
            console.error('[RosterView] Fetch holidays error:', error);
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
                setRosterMap(map);
            } else {
                setRosterMap({});
            }
        } catch (error) {
            console.error('[RosterView] Fetch roster error:', error);
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

    // 🟢 資料分流邏輯
    const configuredRoleSet = new Set(jobTitleConfigs.map(j => j.name));
    const allowedRoleSet = new Set(
        jobTitleConfigs.filter(j => j.in_roster === true).map(j => j.name)
    );

    // 醫師：只顯示角色為「醫師」的人員
    const doctorStaff = staffList.filter((s: Staff) => {
        const role = s.role || '';
        return role.includes('醫師') || role === '醫師';
    });

    // 一般員工：排除醫師，只顯示設定中 in_roster: true 的職位
    const generalStaff = staffList.filter((s: Staff) => {
        const role = s.role || '';
        // 排除醫師
        if (role.includes('醫師') || role === '醫師') return false;
        
        // 如果沒有設定職稱，預設顯示
        if (configuredRoleSet.size === 0) return true;
        
        // 若職稱未在設定中出現，為避免遺漏，預設顯示
        if (!configuredRoleSet.has(role)) return true;
        
        // 其餘依 in_roster 決定是否顯示
        return allowedRoleSet.has(role);
    });

    // 取得班別時間顯示
    const getShiftTimeDisplay = (shift: Shift, shiftDetails?: Record<string, { start: string, end: string }>) => {
        if (shiftDetails && shiftDetails[shift]) {
            return `${shiftDetails[shift].start}-${shiftDetails[shift].end}`;
        }
        const settingKey = SHIFT_MAPPING[shift];
        const timeSetting = businessHours.shifts[settingKey];
        return `${timeSetting.start}-${timeSetting.end}`;
    };

    // 🟢 取得班別標籤與顏色（用於醫師門診表）
    const getShiftBadge = (shift: Shift) => {
        if (shift === 'M') {
            return { label: '早診', color: 'bg-orange-400 text-white' };
        } else if (shift === 'A') {
            return { label: '午診', color: 'bg-blue-400 text-white' };
        } else if (shift === 'N') {
            return { label: '晚診', color: 'bg-purple-400 text-white' };
        }
        return { label: shift, color: 'bg-slate-400 text-white' };
    };

    const days = getDaysInMonth();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // UI Render Helper：渲染表格
    const renderTable = (title: string, staffForTable: Staff[], colorClass: string, isDoctorTable: boolean = false) => {
        const groupStaff = staffForTable
            .slice()
            .sort((a, b) => a.role.localeCompare(b.role) || a.display_order - b.display_order);

        if (groupStaff.length === 0) return null;

        return (
            <div className="mb-6 overflow-hidden rounded-lg shadow-sm border border-slate-200 bg-white">
                <h3 className={`font-bold text-sm p-3 border-b border-l-4 ${colorClass}`}>
                    {title}
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr>
                                <th className="p-2 border bg-slate-50 sticky left-0 z-30 min-w-[80px] text-left text-slate-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
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
                                            className={`p-1 border text-center min-w-[50px] ${headerBg} ${textColor} ${isToday ? 'border-b-2 border-yellow-400' : ''}`}
                                        >
                                            <div className="text-[10px] font-bold">
                                                {d.dateObj.getDate()}
                                            </div>
                                            <div className="text-[8px] flex items-center justify-center gap-0.5">
                                                {isHoliday && <Lock size={7} />}
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
                                    <td className="p-2 border font-bold text-slate-700 sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top">
                                        <div className="text-xs">{staff.name}</div>
                                        <div className="text-[9px] text-slate-400">{staff.role}</div>
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
                                                <span className="block text-[7px] text-emerald-600 font-bold mb-0.5">
                                                    休
                                                </span>
                                            );
                                        } else if (data.day_type === 'regular') {
                                            cellBg =
                                                'bg-red-50 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:8px_8px]';
                                            badge = (
                                                <span className="block text-[7px] text-red-500 font-bold mb-0.5">
                                                    例
                                                </span>
                                            );
                                        }

                                        return (
                                            <td
                                                key={d.dateStr}
                                                className={`border p-0.5 text-center align-top h-12 min-w-[50px] ${cellBg} ${isToday ? 'border-x-2 border-yellow-300' : ''}`}
                                            >
                                                {badge}
                                                <div className="flex flex-col gap-1 h-full justify-center">
                                                    {isDoctorTable ? (
                                                        // 🟢 醫師門診表：顯示完整的 Badge (例如橘色「早診」、藍色「午診」)
                                                        data.shifts.map(s => {
                                                            const shiftBadge = getShiftBadge(s);
                                                            const timeDisplay = getShiftTimeDisplay(s, data.shift_details);
                                                            return (
                                                                <span
                                                                    key={s}
                                                                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${shiftBadge.color}`}
                                                                    title={`${shiftBadge.label} ${timeDisplay}`}
                                                                >
                                                                    {shiftBadge.label}
                                                                </span>
                                                            );
                                                        })
                                                    ) : (
                                                        // 一般員工：顯示簡寫 (早/午/晚) 或色塊
                                                        (['M', 'A', 'N'] as Shift[]).map(s => {
                                                            if (!data.shifts.includes(s)) return null;
                                                            const colorClass =
                                                                s === 'M' ? 'bg-orange-400' : s === 'A' ? 'bg-blue-400' : 'bg-purple-400';
                                                            const timeDisplay = getShiftTimeDisplay(s, data.shift_details);
                                                            const shiftLabel = s === 'M' ? '早' : s === 'A' ? '午' : '晚';
                                                            return (
                                                                <div
                                                                    key={s}
                                                                    className={`h-2 w-full rounded-[1px] ${colorClass}`}
                                                                    title={`${shiftLabel}班 ${timeDisplay}`}
                                                                />
                                                            );
                                                        })
                                                    )}
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

    if (isLoading || !currentDate) {
        return (
            <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
                <PortalTopHeader name={staffUser?.name} role={staffUser?.role} />
                <div className="p-4 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500 mx-auto mb-2"></div>
                        <div className="text-xs">載入中...</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
            {/* 1. 共用頂部個人資訊區塊 */}
            <PortalTopHeader name={staffUser?.name} role={staffUser?.role} />

            {/* 2. 月份切換器 */}
            <div className="bg-white p-4 shadow-sm flex justify-between items-center">
                <button
                    onClick={() => setCurrentDate(new Date(currentDate!.getFullYear(), currentDate!.getMonth() - 1, 1))}
                    className="p-2 hover:bg-slate-100 rounded-full transition"
                    aria-label="上一個月"
                >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-teal-600" />
                    <span className="font-bold text-slate-800">
                        {currentDate!.getFullYear()}年 {currentDate!.getMonth() + 1}月
                    </span>
                </div>
                <button
                    onClick={() => setCurrentDate(new Date(currentDate!.getFullYear(), currentDate!.getMonth() + 1, 1))}
                    className="p-2 hover:bg-slate-100 rounded-full transition"
                    aria-label="下一個月"
                >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                </button>
            </div>

            {/* 3. 模式切換 Tabs */}
            <div className="p-4 pb-0">
                <div className="bg-slate-200 p-1 rounded-xl flex">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
                            activeTab === 'general'
                                ? 'bg-white shadow text-teal-700'
                                : 'text-slate-500'
                        }`}
                    >
                        <User size={16} />
                        護理行政
                    </button>
                    <button
                        onClick={() => setActiveTab('doctor')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
                            activeTab === 'doctor'
                                ? 'bg-white shadow text-blue-700'
                                : 'text-slate-500'
                        }`}
                    >
                        <Stethoscope size={16} />
                        醫師門診
                    </button>
                </div>
            </div>

            {/* 4. 表格區域 (水平滾動) */}
            <div className="p-4 overflow-x-auto">
                {activeTab === 'general' ? (
                    // 護理行政模式：依照 org_entities 分組顯示
                    <>
                        {entities.map((ent, idx) => {
                            const staffForEntity = generalStaff.filter((s: Staff) => {
                                return s.entity === ent.id;
                            });

                            const colorClass =
                                idx % 3 === 0
                                    ? 'border-blue-500 text-blue-700'
                                    : idx % 3 === 1
                                    ? 'border-green-500 text-green-700'
                                    : 'border-purple-500 text-purple-700';

                            return renderTable(`👥 ${ent.name}人員`, staffForEntity, colorClass, false);
                        })}
                        {/* 其他人員 */}
                        {(() => {
                            const usedEntityIds = new Set(entities.map(e => e.id));
                            const otherStaff = generalStaff.filter((s: Staff) => {
                                return !s.entity || !usedEntityIds.has(s.entity);
                            });
                            if (otherStaff.length > 0) {
                                return renderTable('👥 其他人員', otherStaff, 'border-gray-500 text-gray-700', false);
                            }
                            return null;
                        })()}
                    </>
                ) : (
                    // 醫師門診模式：直接顯示一個大表格
                    renderTable('👨‍⚕️ 醫師門診表', doctorStaff, 'border-teal-500 text-teal-700', true)
                )}
            </div>
        </div>
    );
}
