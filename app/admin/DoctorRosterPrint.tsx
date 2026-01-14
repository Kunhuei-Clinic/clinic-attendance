'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Download, X, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';

const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

const WEEKDAYS = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

const SHIFTS = [
    { id: 'AM', label: '早 診', time: '08:00 - 12:30' },
    { id: 'PM', label: '午 診', time: '15:00 - 18:00' },
    { id: 'NIGHT', label: '晚 診', time: '18:00 - 21:00' }
];

export default function DoctorRosterPrint({ onClose }: { onClose: () => void }) {
    const [targetDate, setTargetDate] = useState(new Date());
    const [rosterData, setRosterData] = useState<any[]>([]);
    const [doctors, setDoctors] = useState<any[]>([]);
    const [closedDays, setClosedDays] = useState<string[]>([]);
    
    const [showDate, setShowDate] = useState(true);
    const [clinicName, setClinicName] = useState("坤暉診所");
    const [duration, setDuration] = useState<7 | 14>(7); // 1週或2週
    const [showSpecialTags, setShowSpecialTags] = useState(true);
    const [showSubstitution, setShowSubstitution] = useState(true);

    const printRef = useRef<HTMLDivElement>(null);

    const getLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getDateRange = (date: Date, days: number) => {
        const current = new Date(date);
        const day = current.getDay(); 
        const diff = day === 0 ? 6 : day - 1; 
        
        const monday = new Date(current);
        monday.setDate(current.getDate() - diff); 

        const dateArray = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dateArray.push(d);
        }
        return dateArray;
    };

    const fetchData = async () => {
        const dateRange = getDateRange(targetDate, duration);
        const startDateStr = getLocalDateString(dateRange[0]);
        const endDateStr = getLocalDateString(dateRange[dateRange.length - 1]);

        const { data: docs } = await supabase.from('staff').select('id, name').eq('role', '醫師');
        setDoctors(docs || []);

        const { data: roster } = await supabase.from('doctor_roster')
            .select('*')
            .gte('date', startDateStr)
            .lte('date', endDateStr);
        setRosterData(roster || []);

        const { data: closed } = await supabase.from('clinic_closed_days')
            .select('date')
            .gte('date', startDateStr)
            .lte('date', endDateStr);
        setClosedDays(closed?.map(c => c.date) || []);
    };

    useEffect(() => { fetchData(); }, [targetDate, duration]);

    const dateRange = getDateRange(targetDate, duration);
    const startDateStr = getLocalDateString(dateRange[0]);
    const endDateStr = getLocalDateString(dateRange[dateRange.length - 1]);

    const handleDownload = async () => {
        if (!printRef.current) return;
        try {
            const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            canvas.toBlob((blob) => { if (blob) saveAs(blob, `${clinicName}_門診表_${startDateStr}.png`); });
        } catch (e) { alert("圖片製作失敗"); }
    };

    const fmtTime = (t: string) => t ? (t.startsWith('0') ? t.slice(1) : t) : '';

    const handlePrevPeriod = () => {
        const d = new Date(targetDate);
        d.setDate(d.getDate() - duration);
        setTargetDate(d);
    };

    const handleNextPeriod = () => {
        const d = new Date(targetDate);
        d.setDate(d.getDate() + duration);
        setTargetDate(d);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-5xl p-4 rounded-t-xl border-b flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Settings/> 門診表設定</h3>
                    <div className="flex items-center bg-slate-100 rounded-lg p-1">
                        <button onClick={handlePrevPeriod} className="p-1 hover:bg-white rounded shadow-sm"><ChevronLeft/></button>
                        <span className="px-3 font-mono text-sm font-bold">{startDateStr} ~ {endDateStr}</span>
                        <button onClick={handleNextPeriod} className="p-1 hover:bg-white rounded shadow-sm"><ChevronRight/></button>
                    </div>
                    <select 
                        value={duration} 
                        onChange={(e) => setDuration(Number(e.target.value) as 7 | 14)}
                        className="border rounded px-2 py-1 text-sm font-bold bg-white"
                    >
                        <option value={7}>1 週 (7 天)</option>
                        <option value={14}>2 週 (14 天)</option>
                    </select>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-1 text-sm cursor-pointer select-none">
                        <input type="checkbox" checked={showDate} onChange={e => setShowDate(e.target.checked)} className="w-4 h-4"/> 
                        顯示日期
                    </label>
                    <label className="flex items-center gap-1 text-sm cursor-pointer select-none">
                        <input type="checkbox" checked={showSpecialTags} onChange={e => setShowSpecialTags(e.target.checked)} className="w-4 h-4"/> 
                        顯示特殊門診
                    </label>
                    <label className="flex items-center gap-1 text-sm cursor-pointer select-none">
                        <input type="checkbox" checked={showSubstitution} onChange={e => setShowSubstitution(e.target.checked)} className="w-4 h-4"/> 
                        顯示異動資訊
                    </label>
                    <div className="flex items-center gap-1">
                        <span className="text-sm">標題:</span>
                        <input value={clinicName} onChange={e => setClinicName(e.target.value)} className="border rounded px-2 py-1 text-sm w-32"/>
                    </div>
                    <button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <Download size={16}/> 下載圖片
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X/></button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-500/50 w-full max-w-5xl p-8 flex justify-center items-start">
                <div ref={printRef} className="bg-white p-10 shadow-2xl min-w-[1000px]">
                    <div className="text-center mb-8 border-b-4 border-teal-600 pb-4">
                        <h1 className="text-5xl font-black text-slate-800 tracking-widest mb-2">{clinicName} 門診時間表</h1>
                        <p className="text-xl text-slate-500 font-bold tracking-widest mt-2">{showDate ? `${startDateStr.replace(/-/g,'.')} - ${endDateStr.replace(/-/g,'.')}` : '門診時刻表'}</p>
                    </div>

                    <table className="w-full border-collapse border-2 border-slate-800 text-center">
                        <thead>
                            <tr className="bg-teal-700 text-white h-16">
                                <th className="border border-slate-400 w-32 text-xl font-bold">時段</th>
                                {dateRange.map((d, i) => {
                                    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
                                    return (
                                        <th key={i} className="border border-slate-400 w-32">
                                            <div className="text-xl font-bold">{WEEKDAYS[dayIndex]}</div>
                                            {showDate && <div className="text-sm opacity-80 mt-1">{d.getMonth()+1}/{d.getDate()}</div>}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {SHIFTS.map(shift => (
                                <tr key={shift.id} className="h-40">
                                    <td className="border border-slate-400 bg-slate-50 align-middle">
                                        <div className="text-2xl font-black text-teal-800 mb-2">{shift.label}</div>
                                        <div className="text-sm font-bold text-slate-500 bg-white inline-block px-2 py-1 rounded border">{shift.time}</div>
                                    </td>
                                    {dateRange.map((date, idx) => {
                                        const dateStr = getLocalDateString(date);
                                        const isClosed = closedDays.includes(dateStr);
                                        
                                        if (isClosed) return <td key={idx} className="border border-slate-400 bg-gray-100 align-middle"><div className="text-3xl font-black text-gray-300 tracking-widest rotate-[-15deg] border-4 border-gray-300 inline-block p-2 rounded-xl">休診</div></td>;

                                        const workers = rosterData.filter(r => r.date === dateStr && r.shift_code === shift.id)
                                            .sort((a,b) => a.start_time.localeCompare(b.start_time));

                                        return (
                                            <td key={idx} className="border border-slate-400 align-middle p-2 hover:bg-slate-50/10">
                                                <div className="flex flex-col gap-3 h-full justify-center">
                                                    {workers.map(w => {
                                                        const doc = doctors.find(d => d.id === w.doctor_id);
                                                        return (
                                                            <div key={w.id} className="flex flex-col items-center">
                                                                <span className={`text-xl font-bold leading-tight ${w.is_dedicated ? 'text-purple-700' : 'text-slate-800'}`}>
                                                                    {doc?.name}
                                                                </span>
                                                                <span className="text-xs font-mono text-slate-500 px-1.5 py-0.5 mt-1 whitespace-nowrap">
                                                                    {fmtTime(w.start_time)}-{fmtTime(w.end_time)}
                                                                </span>
                                                                {/* 特殊門診標籤 */}
                                                                {showSpecialTags && w.special_tags && w.special_tags.length > 0 && (
                                                                    <div className="flex flex-col items-center gap-0.5 mt-1">
                                                                        {w.special_tags.map((tag: string, tagIdx: number) => (
                                                                            <span 
                                                                                key={tagIdx} 
                                                                                className={`text-xs font-bold ${
                                                                                    w.is_dedicated 
                                                                                        ? 'text-pink-600' 
                                                                                        : 'text-orange-600'
                                                                                }`}
                                                                            >
                                                                                {w.is_dedicated ? `${tag}專診` : `暨 ${tag}`}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {/* 異動資訊 */}
                                                                {showSubstitution && w.is_substitution && (
                                                                    <span className="text-xs font-bold text-purple-600 mt-0.5">
                                                                        門診異動
                                                                    </span>
                                                                )}
                                                            </div>
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
                    <div className="mt-6 text-center font-bold text-slate-500">※ 請於門診結束前 15 分鐘完成掛號手續</div>
                </div>
            </div>
        </div>
    );
}
