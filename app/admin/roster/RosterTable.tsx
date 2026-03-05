'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { Staff, ShiftConfig, RosterData } from './types';

type DayInfo = {
    dateObj: Date;
    dateStr: string;
    dayOfWeek: number;
};

type RosterTableProps = {
    title: string;
    staffForEntity: Staff[];
    colorClass: string;
    days: DayInfo[];
    todayStr: string;
    weekDays: string[];
    rosterMap: Record<string, RosterData>;
    complianceErrors: Record<string, string[]>;
    shiftsConfig: ShiftConfig[];
    calculateStats: (staffId: string) => { totalDays: number; totalHours: number };
    applyDayTypeStamp: (staffId: string, dateStr: string) => void;
    toggleShift: (staffId: string, dateStr: string, shiftConfig: ShiftConfig) => void;
    toggleGlobalHoliday: (dateStr: string) => void;
};

export default function RosterTable({
    title,
    staffForEntity,
    colorClass,
    days,
    todayStr,
    weekDays,
    rosterMap,
    complianceErrors,
    shiftsConfig,
    calculateStats,
    applyDayTypeStamp,
    toggleShift,
    toggleGlobalHoliday,
}: RosterTableProps) {
    const groupStaff = staffForEntity.slice();

    if (groupStaff.length === 0) return null;

    return (
        <div className="mb-8 overflow-hidden rounded-lg shadow-sm border border-slate-200">
            <h3 className={`font-bold text-lg p-2 border-b bg-white border-l-4 ${colorClass}`}>{title}</h3>
            <div className="overflow-x-auto">
                {/* 🟢 關鍵修正：加入 table-fixed 與 min-w-[1450px] 強制鎖定比例，防止按鈕擠壓變形 */}
                <table className="w-full border-collapse bg-white table-fixed min-w-[1450px]">
                    <thead>
                        <tr>
                            {/* 🟢 頭部縮小：寬度鎖定在 90px */}
                            <th className="p-2 border bg-slate-50 sticky left-0 z-30 w-[90px] text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-xs">
                                員工
                            </th>
                            {days.map(d => {
                                const isToday = d.dateStr === todayStr;
                                const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
                                return (
                                    <th
                                        key={d.dateStr}
                                        onClick={() => toggleGlobalHoliday(d.dateStr)}
                                        // 🟢 每日欄位恢復：寬度鎖定 42px
                                        className={`border p-1 text-center w-[42px] cursor-default select-none ${
                                            isToday ? 'bg-yellow-100 text-yellow-800' : isWeekend ? 'text-red-500' : ''
                                        }`}
                                    >
                                        <div className="text-[10px] leading-tight opacity-60">
                                            {weekDays[d.dayOfWeek]}
                                        </div>
                                        <div className="text-xs font-bold">
                                            {d.dateStr.slice(8)}
                                        </div>
                                    </th>
                                );
                            })}
                            {/* 🟢 尾部縮小：寬度鎖定在 65px */}
                            <th className="p-1 border bg-slate-50 sticky right-0 z-30 w-[65px] text-center text-xs">
                                統計
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {groupStaff.map(staff => {
                            const stats = calculateStats(staff.id);
                            return (
                                <tr key={staff.id}>
                                    <td className="p-2 border sticky left-0 z-20 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-top w-[90px] overflow-hidden">
                                        <div className="font-bold text-slate-700 text-xs truncate" title={staff.name}>
                                            {staff.name}
                                        </div>
                                        <div className="text-[10px] text-slate-400 truncate">{staff.role}</div>
                                        {complianceErrors[staff.id] && (
                                            <div className="text-[9px] text-red-600 bg-red-50 p-0.5 rounded flex items-center gap-0.5 mt-0.5">
                                                <ShieldAlert size={10} /> 違規
                                            </div>
                                        )}
                                    </td>
                                    {days.map(d => {
                                        const key = `${staff.id}_${d.dateStr}`;
                                        const data = rosterMap[key] || { shifts: [], day_type: 'normal' };
                                        const isToday = d.dateStr === todayStr;

                                        let cellBg = isToday ? 'bg-yellow-50' : '';
                                        if (data.day_type === 'rest') cellBg = 'bg-emerald-50';
                                        else if (data.day_type === 'regular')
                                            cellBg =
                                                'bg-red-50 bg-[linear-gradient(45deg,transparent_25%,rgba(255,0,0,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:10px_10px]';
                                        else if (data.day_type === 'holiday') cellBg = 'bg-pink-50';
                                        else if (data.day_type === 'shifted') cellBg = 'bg-slate-100';

                                        let btnClass = 'text-transparent hover:text-slate-300';
                                        let btnText = '•';
                                        if (data.day_type === 'rest') {
                                            btnClass = 'bg-emerald-200 text-emerald-800';
                                            btnText = '休';
                                        } else if (data.day_type === 'regular') {
                                            btnClass = 'bg-red-200 text-red-800';
                                            btnText = '例';
                                        } else if (data.day_type === 'holiday') {
                                            btnClass = 'bg-pink-300 text-pink-900';
                                            btnText = '國';
                                        } else if (data.day_type === 'shifted') {
                                            btnClass = 'bg-slate-300 text-slate-700';
                                            btnText = '調';
                                        }

                                        return (
                                            // 🟢 恢復安全高度 h-[76px] 並加上 overflow-hidden 防溢出
                                            <td
                                                key={d.dateStr}
                                                className={`border p-0.5 text-center align-top h-[76px] relative w-[42px] overflow-hidden ${cellBg}`}
                                            >
                                                <button
                                                    onClick={() => applyDayTypeStamp(staff.id, d.dateStr)}
                                                    className={`w-full h-5 shrink-0 rounded-sm text-[10px] font-bold mb-0.5 transition-colors ${btnClass}`}
                                                >
                                                    {btnText}
                                                </button>
                                                <div className="flex flex-col h-[calc(100%-22px)] w-full divide-y divide-slate-100 overflow-hidden">
                                                    {shiftsConfig.map(shift => {
                                                        const isSelected = data.shifts.includes(shift.code);
                                                        return (
                                                            <button
                                                                key={shift.id}
                                                                onClick={() => toggleShift(staff.id, d.dateStr, shift)}
                                                                className={`flex-1 w-full flex items-center justify-center transition-all min-h-[14px] text-[10px] leading-none ${
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
                                    <td className="p-1 border sticky right-0 z-20 bg-white text-center align-middle w-[65px]">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="font-bold text-slate-800 text-xs">{stats.totalDays} 天</div>
                                            <div className="text-slate-500 font-mono text-[10px]">{stats.totalHours} hr</div>
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
}

