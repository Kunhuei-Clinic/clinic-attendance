'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Stethoscope, Clock, X, Trash2, Plus, Copy, Check, Image as ImageIcon, Settings, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import DoctorRosterPrint from './DoctorRosterPrint';

// 🟢 修改：週一排前面
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export default function DoctorRosterView() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [doctors, setDoctors] = useState<any[]>([]);
    const [rosterData, setRosterData] = useState<any[]>([]);
    const [closedDays, setClosedDays] = useState<string[]>([]);
    const [specialTypes, setSpecialTypes] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [focusedDocId, setFocusedDocId] = useState<number | null>(null);
    const [stats, setStats] = useState<Record<number, { total: number, weekly: number[] }>>({});

    const [businessHours, setBusinessHours] = useState({
        openDays: [1, 2, 3, 4, 5, 6],
        shifts: {
            AM: { start: '08:00', end: '12:30' },
            PM: { start: '14:00', end: '17:30' },
            NIGHT: { start: '18:00', end: '21:30' }
        }
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBatchOpen, setIsBatchOpen] = useState(false);
    const [isPrintOpen, setIsPrintOpen] = useState(false);

    const [selectedSlot, setSelectedSlot] = useState<{ date: string, shiftId: string, shiftName: string } | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);

    const [assignForm, setAssignForm] = useState({
        doctorId: '',
        startTime: '',
        endTime: '',
        specialTags: [] as string[],
        isDedicated: false,
        isSubstitution: false
    });

    const getLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const formatTimeDisplay = (time: string) => time ? (time.startsWith('0') ? time.slice(1) : time) : '';

    useEffect(() => { fetchDoctors(); fetchSettings(); }, []);
    useEffect(() => { fetchRoster(); fetchClosedDays(); }, [currentDate]);
    useEffect(() => { calculateStats(); }, [rosterData, currentDate]);

    const fetchDoctors = async () => {
        try {
            const response = await fetch('/api/staff?role=醫師');
            const result = await response.json();
            if (result.data) setDoctors(result.data.filter((s: any) => s.role === '醫師'));
        } catch (error) {
            console.error('Fetch doctors error:', error);
        }
    };
    
    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const result = await response.json();
            if (result.data) {
                result.data.forEach((item: any) => {
                    if (item.key === 'special_clinic_types') {
                        try { setSpecialTypes(JSON.parse(item.value)); } catch (e) { }
                    }
                    if (item.key === 'clinic_business_hours') {
                        try { setBusinessHours(JSON.parse(item.value)); } catch (e) { }
                    }
                });
            }
        } catch (error) {
            console.error('Fetch settings error:', error);
        }
    };
    
    const fetchRoster = async () => {
        setLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const response = await fetch(`/api/roster/doctor?year=${year}&month=${month}`);
            const result = await response.json();
            if (result.error) {
                console.error('Error:', result.error);
                setRosterData([]);
            } else {
                setRosterData(result.data || []);
            }
        } catch (error) {
            console.error('Fetch roster error:', error);
            setRosterData([]);
        } finally {
            setLoading(false);
        }
    };
    
    const fetchClosedDays = async () => {
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const response = await fetch(`/api/roster/closed-days?year=${year}&month=${month}`);
            const result = await response.json();
            if (result.error) {
                console.error('Error:', result.error);
                setClosedDays([]);
            } else {
                setClosedDays(result.data || []);
            }
        } catch (error) {
            console.error('Fetch closed days error:', error);
            setClosedDays([]);
        }
    };
    
    const toggleClosedDay = async (dateStr: string) => {
        const isClosed = closedDays.includes(dateStr);
        try {
            if (isClosed) {
                const response = await fetch(`/api/roster/closed-days?date=${dateStr}`, { method: 'DELETE' });
                const result = await response.json();
                if (result.success) {
                    setClosedDays(prev => prev.filter(d => d !== dateStr));
                } else {
                    alert('刪除失敗: ' + result.message);
                }
            } else {
                const reason = prompt("請輸入休診原因", "休診");
                if (reason === null) return;
                const response = await fetch('/api/roster/closed-days', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: dateStr, reason })
                });
                const result = await response.json();
                if (result.success) {
                    setClosedDays(prev => [...prev, dateStr]);
                } else {
                    alert('新增失敗: ' + result.message);
                }
            }
        } catch (error) {
            console.error('Toggle closed day error:', error);
            alert('操作失敗');
        }
    };
    const calculateStats = () => {
        const newStats: Record<number, { total: number, weekly: number[] }> = {};
        doctors.forEach(d => { newStats[d.id] = { total: 0, weekly: [0, 0, 0, 0, 0, 0] }; });
        rosterData.forEach(r => {
            if (r.start_time && r.end_time) {
                const [sh, sm] = r.start_time.split(':').map(Number); const [eh, em] = r.end_time.split(':').map(Number);
                const duration = Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60;
                if (!newStats[r.doctor_id]) newStats[r.doctor_id] = { total: 0, weekly: [0, 0, 0, 0, 0, 0] };
                newStats[r.doctor_id].total += duration;
                const date = parseLocalDate(r.date); const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
                const dayOffset = firstDayOfMonth.getDay(); const weekIndex = Math.floor((date.getDate() + dayOffset - 1) / 7);
                if (weekIndex >= 0 && weekIndex < 6) newStats[r.doctor_id].weekly[weekIndex] += duration;
            }
        });
        setStats(newStats);
    };
    const checkAnomaly = (r: any, shiftId: string) => {
        const settings = businessHours.shifts[shiftId as keyof typeof businessHours.shifts];
        if (!settings) return false;
        if (shiftId === 'AM') return r.start_time < settings.start || r.end_time > '13:30';
        if (shiftId === 'PM') return r.start_time < '13:00';
        if (shiftId === 'NIGHT') return r.end_time > '23:00';
        return false;
    };
    const handlePrevMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); };
    const handleNextMonth = () => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); };
    const openSlotModal = (dateStr: string, shiftId: string, shiftName: string, existingRoster: any = null) => {
        setSelectedSlot({ date: dateStr, shiftId, shiftName });
        const settings = businessHours.shifts[shiftId as keyof typeof businessHours.shifts];
        const defaultStart = settings?.start || '08:00'; const defaultEnd = settings?.end || '12:00';
        if (existingRoster) { setEditingId(existingRoster.id); setAssignForm({ doctorId: String(existingRoster.doctor_id), startTime: existingRoster.start_time, endTime: existingRoster.end_time, specialTags: existingRoster.special_tags || [], isDedicated: existingRoster.is_dedicated || false, isSubstitution: existingRoster.is_substitution || false }); }
        else { setEditingId(null); const defaultDocId = doctors.length > 0 ? String(doctors[0].id) : ''; setAssignForm({ doctorId: defaultDocId, startTime: defaultStart, endTime: defaultEnd, specialTags: [], isDedicated: false, isSubstitution: false }); }
        setIsModalOpen(true);
    };
    const toggleSpecialTag = (tag: string) => { if (assignForm.specialTags.includes(tag)) setAssignForm(prev => ({ ...prev, specialTags: prev.specialTags.filter(t => t !== tag) })); else setAssignForm(prev => ({ ...prev, specialTags: [...prev.specialTags, tag] })); };
    const handleSubmitAssign = async () => {
        if (!selectedSlot || !assignForm.doctorId) return;
        const doctorId = Number(assignForm.doctorId);
        const rosterPayload = {
            id: editingId || undefined,
            doctor_id: doctorId,
            date: selectedSlot.date,
            shift_code: selectedSlot.shiftId,
            start_time: assignForm.startTime,
            end_time: assignForm.endTime,
            special_tags: assignForm.specialTags,
            is_dedicated: assignForm.isDedicated,
            is_substitution: assignForm.isSubstitution
        };

        try {
            if (editingId) {
                const response = await fetch('/api/roster/doctor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rosterPayload)
                });
                const result = await response.json();
                if (result.success) {
                    setIsModalOpen(false);
                    fetchRoster();
                } else {
                    alert("更新失敗: " + result.message);
                }
            } else {
                const exists = rosterData.find(r => r.date === selectedSlot.date && r.shift_code === selectedSlot.shiftId && r.doctor_id === doctorId);
                if (exists) {
                    if (!confirm("覆蓋？")) return;
                }
                const response = await fetch('/api/roster/doctor', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(rosterPayload)
                });
                const result = await response.json();
                if (result.success) {
                    setIsModalOpen(false);
                    fetchRoster();
                } else {
                    alert("寫入失敗: " + result.message);
                }
            }
        } catch (error) {
            console.error('Submit assign error:', error);
            alert('操作失敗');
        }
    };
    
    const removeRoster = async (id: number) => {
        if (!confirm('確定刪除？')) return;
        try {
            setRosterData(prev => prev.filter(r => r.id !== id));
            const response = await fetch(`/api/roster/doctor?id=${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
                setIsModalOpen(false);
                fetchRoster();
            } else {
                alert('刪除失敗: ' + result.message);
            }
        } catch (error) {
            console.error('Remove roster error:', error);
            alert('刪除失敗');
        }
    };
    
    const handleBatchDelete = async (start: string, end: string) => {
        if (!confirm(`刪除 ${start} 到 ${end} ?`)) return;
        setLoading(true);
        try {
            const response = await fetch(`/api/roster/doctor?start=${start}&end=${end}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
                setIsBatchOpen(false);
                fetchRoster();
            } else {
                alert('刪除失敗: ' + result.message);
            }
        } catch (error) {
            console.error('Batch delete error:', error);
            alert('刪除失敗');
        } finally {
            setLoading(false);
        }
    };
    
    const handleBatchCopy = async (sourceStart: string, targetStart: string, days: number) => {
        setLoading(true);
        try {
            const response = await fetch('/api/roster/doctor', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sourceStart, targetStart, days })
            });
            const result = await response.json();
            if (result.success) {
                setIsBatchOpen(false);
                fetchRoster();
                alert(result.message || '已複製');
            } else {
                alert('複製失敗: ' + result.message);
            }
        } catch (error) {
            console.error('Batch copy error:', error);
            alert('複製失敗');
        } finally {
            setLoading(false);
        }
    };
    
    // 🟢 修正日曆生成邏輯：週一排前面
    const generateCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        // 算出該月1號是星期幾 (0-6)
        const firstDayObj = new Date(year, month, 1);
        let startDay = firstDayObj.getDay(); 
        
        // 轉換：將週日(0)變成7，讓週一(1)變成1，方便計算
        // 目標：週一(1)排第0格，週二(2)排第1格...週日(0)排第6格
        // 公式：(Day + 6) % 7
        const firstDayIndex = (startDay + 6) % 7;

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const weeks = [];
        let day = 1;
        let grid = [];
        
        // 補前面的空白格
        for (let i = 0; i < firstDayIndex; i++) grid.push(null);
        
        // 填入日期
        while (day <= daysInMonth) { 
            grid.push(new Date(year, month, day)); 
            day++; 
        }
        
        // 切割成週
        while (grid.length > 0) weeks.push(grid.splice(0, 7));
        return weeks;
    };

    const weeks = generateCalendar();
    const DISPLAY_SHIFTS = [{ id: 'AM', label: '早診', color: 'text-blue-600 bg-blue-50 border-blue-100' }, { id: 'PM', label: '午診', color: 'text-orange-600 bg-orange-50 border-orange-100' }, { id: 'NIGHT', label: '晚診', color: 'text-purple-600 bg-purple-50 border-purple-100' }];

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-full animate-fade-in p-2 relative">
            <div className="flex-1 bg-white rounded-2xl shadow-sm border border-teal-200 flex flex-col overflow-hidden h-[88vh]">
                <div className="p-4 flex justify-between items-center bg-teal-50 border-b border-teal-100 shrink-0">
                    <h2 className="text-xl font-bold text-teal-800 flex items-center gap-2"><Stethoscope /> {currentDate.getFullYear()} 年 {currentDate.getMonth() + 1} 月 醫師總班表</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setIsBatchOpen(true)} className="flex items-center gap-1 text-xs bg-white border border-orange-300 text-orange-700 px-3 py-1.5 rounded hover:bg-orange-50 transition shadow-sm"><Settings size={14} /> 批次</button>
                        <button onClick={() => setIsPrintOpen(true)} className="flex items-center gap-1 text-xs bg-white border border-purple-300 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-50 transition shadow-sm"><ImageIcon size={14} /> 門診表</button>
                        <div className="w-px h-6 bg-teal-200 mx-1"></div>
                        <button onClick={handlePrevMonth} className="p-2 hover:bg-white rounded-full border border-teal-200 text-teal-600"><ChevronLeft /></button>
                        <button onClick={handleNextMonth} className="p-2 hover:bg-white rounded-full border border-teal-200 text-teal-600"><ChevronRight /></button>
                    </div>
                </div>
                <div className="grid grid-cols-7 bg-teal-50/50 border-b border-teal-100 text-center font-bold text-teal-600 py-2 text-sm shrink-0">
                    {WEEKDAYS.map(d => <div key={d} className={d === '日' || d === '六' ? 'text-orange-500' : ''}>{d}</div>)}
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50">
                    {weeks.map((week, wIdx) => (
                        <div key={wIdx} className="grid grid-cols-7 border-b border-slate-200 min-h-[160px] bg-white">
                            {week.map((date, dIdx) => {
                                if (!date) return <div key={dIdx} className="bg-slate-50/30 border-r border-slate-100 last:border-r-0"></div>;
                                const dateStr = getLocalDateString(date); const isToday = getLocalDateString(new Date()) === dateStr; const isClosed = closedDays.includes(dateStr);
                                return (
                                    <div key={dIdx} className={`border-r border-slate-100 last:border-r-0 p-1 flex flex-col group transition hover:bg-teal-50/5 ${isToday ? 'bg-yellow-50' : (isClosed ? 'bg-gray-100' : '')}`}>
                                        <div className="text-right mb-1 px-1 flex justify-between items-center"><button onClick={() => toggleClosedDay(dateStr)} className="text-[10px] text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50" title={isClosed ? "取消休診" : "設定休診"}><X size={12} /></button><span className={`text-xs font-bold ${isToday ? 'bg-red-500 text-white px-1.5 py-0.5 rounded-full' : 'text-slate-400'}`}>{date.getDate()}</span></div>
                                        {isClosed ? (<div className="flex-1 flex items-center justify-center"><span className="text-red-300 font-bold text-xl tracking-widest select-none rotate-[-15deg] border-2 border-red-200 p-2 rounded opacity-50">休診</span></div>) : (<div className="flex-1 flex flex-col gap-1">{DISPLAY_SHIFTS.map(shift => { const workers = rosterData.filter(r => r.date === dateStr && r.shift_code === shift.id).sort((a, b) => a.start_time.localeCompare(b.start_time)); return (<div key={shift.id} className="flex flex-col gap-1"><div className={`text-[10px] font-bold px-1 flex justify-between items-center rounded cursor-pointer transition ${shift.color} opacity-60 hover:opacity-100`} onClick={() => openSlotModal(dateStr, shift.id, shift.label)}>{shift.label} <Plus size={10} className="opacity-0 group-hover:opacity-100" /></div><div className="flex flex-col gap-1 pl-1">{workers.map(w => { const doc = doctors.find(d => d.id === w.doctor_id); const isSpecial = w.special_tags && w.special_tags.length > 0; const isDimmed = focusedDocId && focusedDocId !== w.doctor_id; const isAnomaly = checkAnomaly(w, shift.id); const cardStyle = w.is_dedicated ? 'bg-purple-100 border-purple-300' : (w.is_substitution ? 'bg-orange-100 border-orange-300' : (isSpecial ? 'bg-pink-50 border-pink-200' : 'bg-white border-slate-200')); const textStyle = w.is_dedicated ? 'text-purple-800' : (w.is_substitution ? 'text-orange-800' : 'text-slate-700'); return (<div key={w.id} onClick={(e) => { e.stopPropagation(); openSlotModal(dateStr, shift.id, shift.label, w); }} className={`relative px-2 py-1.5 rounded-md border shadow-sm text-xs group cursor-pointer hover:shadow-md transition ${cardStyle} ${isDimmed ? 'opacity-20 grayscale' : 'opacity-100'}`}><div className="flex justify-between items-start"><span className={`font-bold ${textStyle}`}>{doc?.name.slice(0, 3)}</span>{isAnomaly && <AlertTriangle size={12} className="text-red-500" />}<button onClick={(e) => { e.stopPropagation(); removeRoster(w.id); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition absolute top-1 right-1 bg-white/50 rounded-full p-0.5"><Trash2 size={12} /></button></div><div className={`text-[10px] font-mono mt-0.5 ${isAnomaly ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{formatTimeDisplay(w.start_time)}-{formatTimeDisplay(w.end_time)}</div><div className="flex flex-wrap gap-0.5 mt-1">{w.is_dedicated && <span className="bg-purple-600 text-white text-[9px] px-1 rounded-sm scale-90 origin-left">專診</span>}{w.is_substitution && <span className="bg-orange-500 text-white text-[9px] px-1 rounded-sm scale-90 origin-left">異動</span>}{w.special_tags?.map((t: string) => <span key={t} className="bg-pink-200 text-pink-800 text-[9px] px-1 rounded-sm scale-90 origin-left">{t}</span>)}</div></div>); })}</div></div>); })}</div>)}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-teal-200"><h3 className="font-bold text-teal-800 mb-4 flex items-center gap-2 border-b border-teal-100 pb-2"><Clock size={18} /> 本月工時統計</h3><div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">{doctors.map(doc => { const docStats = stats[doc.id] || { total: 0, weekly: [] }; const isFocused = focusedDocId === doc.id; return (<div key={doc.id} className={`rounded border transition overflow-hidden ${isFocused ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-100' : 'bg-white border-transparent hover:bg-slate-50'}`}><div className="flex justify-between items-center p-2 cursor-pointer" onClick={() => setFocusedDocId(isFocused ? null : doc.id)}><div className="flex items-center gap-2"><div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${isFocused ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{doc.name.slice(0, 1)}</div><span className={`font-bold text-sm ${isFocused ? 'text-teal-800' : 'text-slate-700'}`}>{doc.name}</span></div><div className="flex items-center gap-2"><div className="font-mono font-bold text-teal-600 text-sm">{docStats.total.toFixed(1)} <span className="text-[10px] text-slate-400">hr</span></div>{isFocused ? <ChevronUp size={14} className="text-teal-500" /> : <ChevronDown size={14} className="text-slate-300" />}</div></div>{isFocused && <div className="px-2 pb-2 bg-teal-50/50 border-t border-teal-100"><div className="grid grid-cols-3 gap-2 mt-2">{docStats.weekly.map((hrs, idx) => (hrs === 0 && idx > 4) ? null : <div key={idx} className="bg-white rounded p-1 text-center border border-teal-100"><div className="text-[10px] text-slate-400">第 {idx + 1} 週</div><div className="font-bold text-teal-700 text-xs">{hrs.toFixed(1)}</div></div>)}</div></div>}</div>); })}</div></div>
            </div>

            {isPrintOpen && <DoctorRosterPrint onClose={() => setIsPrintOpen(false)} />}

            {isBatchOpen && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"><div className="bg-orange-600 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Settings size={20} /> 批次管理中心</h3><button onClick={() => setIsBatchOpen(false)}><X size={20} /></button></div><div className="p-6 space-y-8"><div className="space-y-3"><h4 className="font-bold text-slate-700 flex items-center gap-2"><Copy size={16} /> 批次複製班表</h4><div className="bg-slate-50 p-4 rounded-lg border text-sm space-y-3"><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-bold text-slate-500">來源起始日</label><input type="date" id="copySrc" className="w-full border p-1 rounded" defaultValue={getLocalDateString(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))} /></div><div><label className="block text-xs font-bold text-slate-500">目標起始日</label><input type="date" id="copyTgt" className="w-full border p-1 rounded" defaultValue={getLocalDateString(new Date())} /></div></div><button onClick={() => { const src = (document.getElementById('copySrc') as HTMLInputElement).value; const tgt = (document.getElementById('copyTgt') as HTMLInputElement).value; handleBatchCopy(src, tgt, 7); }} className="w-full bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">複製一週 (7天)</button></div></div><div className="space-y-3"><h4 className="font-bold text-red-700 flex items-center gap-2"><Trash2 size={16} /> 批次刪除班表</h4><div className="bg-red-50 p-4 rounded-lg border border-red-100 text-sm space-y-3"><div className="grid grid-cols-2 gap-2"><div><label className="block text-xs font-bold text-slate-500">開始日期</label><input type="date" id="delStart" className="w-full border p-1 rounded" /></div><div><label className="block text-xs font-bold text-slate-500">結束日期</label><input type="date" id="delEnd" className="w-full border p-1 rounded" /></div></div><button onClick={() => { const s = (document.getElementById('delStart') as HTMLInputElement).value; const e = (document.getElementById('delEnd') as HTMLInputElement).value; handleBatchDelete(s, e); }} className="w-full bg-red-600 text-white py-2 rounded font-bold hover:bg-red-700">確認刪除區間</button></div></div></div></div></div>}

            {isModalOpen && selectedSlot && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border-2 border-teal-500">
                        <div className="bg-teal-700 text-white p-4 flex justify-between items-center"><h3 className="font-bold">{editingId ? '編輯' : '新增'} - {selectedSlot.date} {selectedSlot.shiftName}</h3><button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-1 rounded"><X size={20} /></button></div>
                        <div className="p-6 space-y-4">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">執業醫師</label><select className="w-full border p-2 rounded bg-slate-50 font-bold text-slate-700" value={assignForm.doctorId} onChange={(e) => setAssignForm({ ...assignForm, doctorId: e.target.value })}><option value="" disabled>請選擇...</option>{doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                            <div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">開始</label><input type="time" className="w-full border p-2 rounded font-mono text-center bg-slate-50" value={assignForm.startTime} onChange={(e) => setAssignForm({ ...assignForm, startTime: e.target.value })} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">結束</label><input type="time" className="w-full border p-2 rounded font-mono text-center bg-slate-50" value={assignForm.endTime} onChange={(e) => setAssignForm({ ...assignForm, endTime: e.target.value })} /></div></div>
                            <div className="flex gap-4 border-t border-b py-3"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={assignForm.isDedicated} onChange={e => setAssignForm({ ...assignForm, isDedicated: e.target.checked })} className="w-4 h-4 text-purple-600" /><span className="text-sm font-bold text-purple-700">專診</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={assignForm.isSubstitution} onChange={e => setAssignForm({ ...assignForm, isSubstitution: e.target.checked })} className="w-4 h-4 text-orange-600" /><span className="text-sm font-bold text-orange-700">異動/代診</span></label></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-2">特殊門診</label><div className="flex flex-wrap gap-2">{specialTypes.map(t => (<button key={t} onClick={() => toggleSpecialTag(t)} className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1 ${assignForm.specialTags.includes(t) ? 'bg-pink-100 border-pink-300 text-pink-700 font-bold' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{assignForm.specialTags.includes(t) && <Check size={12} />} {t}</button>))}</div></div>
                            <div className="pt-4 flex gap-2">
                                {editingId && (<button onClick={() => removeRoster(editingId)} className="bg-red-50 text-red-600 py-3 px-4 rounded-lg font-bold hover:bg-red-100 transition"><Trash2 size={20} /></button>)}
                                <button onClick={handleSubmitAssign} className="flex-1 bg-teal-600 text-white py-3 rounded-lg font-bold hover:bg-teal-700 transition shadow-md">{editingId ? '更新儲存' : '確認排班'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}