'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Download, X, ChevronLeft, ChevronRight, Settings, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';

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

    const getWeekChunks = (date: Date, totalDays: number): Date[][] => {
        const current = new Date(date);
        const day = current.getDay(); 
        const diff = day === 0 ? 6 : day - 1; 
        
        const monday = new Date(current);
        monday.setDate(current.getDate() - diff); 

        const weeks: Date[][] = [];
        const numWeeks = Math.ceil(totalDays / 7);
        
        for (let weekIdx = 0; weekIdx < numWeeks; weekIdx++) {
            const weekStart = new Date(monday);
            weekStart.setDate(monday.getDate() + (weekIdx * 7));
            
            const weekDays: Date[] = [];
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                weekDays.push(d);
            }
            weeks.push(weekDays);
        }
        
        return weeks;
    };

    const fetchData = async () => {
        try {
            const chunks = getWeekChunks(targetDate, duration);
            const allDates = chunks.flat();
            const startDateStr = getLocalDateString(allDates[0]);
            const endDateStr = getLocalDateString(allDates[allDates.length - 1]);

            // 取得醫師列表
            const docsResponse = await fetch('/api/staff?role=醫師');
            const docsResult = await docsResponse.json();
            if (docsResult.data) {
                setDoctors(docsResult.data.filter((s: any) => s.role === '醫師').map((s: any) => ({ id: s.id, name: s.name })));
            }

            // 取得排班資料（使用日期範圍查詢）
            const rosterResponse = await fetch(`/api/roster/doctor?startDate=${startDateStr}&endDate=${endDateStr}`);
            const rosterResult = await rosterResponse.json();
            if (rosterResult.error) {
                console.error('Error:', rosterResult.error);
                setRosterData([]);
            } else {
                setRosterData(rosterResult.data || []);
            }

            // 取得休診日（使用日期範圍查詢）
            const closedResponse = await fetch(`/api/roster/closed-days?startDate=${startDateStr}&endDate=${endDateStr}`);
            const closedResult = await closedResponse.json();
            if (closedResult.error) {
                console.error('Error:', closedResult.error);
                setClosedDays([]);
            } else {
                setClosedDays(closedResult.data || []);
            }
        } catch (error) {
            console.error('Fetch data error:', error);
            alert('載入資料失敗');
        }
    };

    useEffect(() => { fetchData(); }, [targetDate, duration]);

    const weekChunks = getWeekChunks(targetDate, duration);
    const allDates = weekChunks.flat();
    const startDateStr = getLocalDateString(allDates[0]);
    const endDateStr = getLocalDateString(allDates[allDates.length - 1]);

    const handleDownload = async () => {
        if (!printRef.current) return;
        try {
            const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            canvas.toBlob((blob) => { if (blob) saveAs(blob, `${clinicName}_門診表_${startDateStr}.png`); });
        } catch (e) { alert("圖片製作失敗"); }
    };

    const handleDownloadPDF = async () => {
        if (!printRef.current) return;
        try {
            const canvas = await html2canvas(printRef.current, { 
                scale: 2, 
                backgroundColor: '#ffffff', 
                useCORS: true,
                logging: false
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            // 計算縮放比例以適應頁面寬度
            const ratio = pdfWidth / imgWidth;
            const scaledHeight = imgHeight * ratio;
            
            // 如果內容高度超過一頁，需要分頁
            if (scaledHeight > pdfHeight) {
                let heightLeft = scaledHeight;
                let position = 0;
                
                // 添加第一頁
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
                heightLeft -= pdfHeight;
                
                // 如果還有剩餘內容，添加更多頁
                while (heightLeft > 0) {
                    position = heightLeft - scaledHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, scaledHeight);
                    heightLeft -= pdfHeight;
                }
            } else {
                // 內容適合單頁，居中顯示
                const imgX = 0;
                const imgY = (pdfHeight - scaledHeight) / 2;
                pdf.addImage(imgData, 'PNG', imgX, imgY, pdfWidth, scaledHeight);
            }
            
            pdf.save(`${clinicName}_門診表_${startDateStr}.pdf`);
        } catch (e) { 
            console.error(e);
            alert("PDF 製作失敗"); 
        }
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
                    <button onClick={handleDownloadPDF} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                        <FileText size={16}/> 下載 PDF
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

                    {weekChunks.map((weekDays, weekIdx) => {
                        const weekStartStr = getLocalDateString(weekDays[0]);
                        const weekEndStr = getLocalDateString(weekDays[6]);
                        
                        return (
                            <div key={weekIdx} className={weekIdx > 0 ? "mt-12" : ""}>
                                {weekChunks.length > 1 && (
                                    <div className="text-center mb-4">
                                        <h2 className="text-2xl font-bold text-teal-700">
                                            第 {weekIdx + 1} 週 ({weekStartStr.replace(/-/g,'.')} - {weekEndStr.replace(/-/g,'.')})
                                        </h2>
                                    </div>
                                )}
                                <table className="w-full border-collapse border-2 border-slate-800 text-center">
                                    <thead>
                                        <tr className="bg-teal-700 text-white h-16">
                                            <th className="border border-slate-400 w-32 text-xl font-bold">時段</th>
                                            {weekDays.map((d, i) => {
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
                                                <td className="border border-slate-400 align-middle">
                                                    <div className="text-2xl font-black text-teal-800 mb-2">{shift.label}</div>
                                                    <div className="text-sm font-bold text-slate-500">{shift.time}</div>
                                                </td>
                                                {weekDays.map((date, idx) => {
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
                                                                                            className={`text-[10px] font-bold whitespace-nowrap scale-90 origin-center ${
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
                            </div>
                        );
                    })}
                    <div className="mt-6 text-center font-bold text-slate-500">※ 請於門診結束前 15 分鐘完成掛號手續</div>
                </div>
            </div>
        </div>
    );
}
