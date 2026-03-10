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
    const [titleSuffix, setTitleSuffix] = useState("門診時間表");
    const [defaultSubtitle, setDefaultSubtitle] = useState("常規門診表");
    const [footerText, setFooterText] = useState("※ 請於門診結束前 15 分鐘完成掛號手續");
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [duration, setDuration] = useState<7 | 14>(7); // 1週或2週
    const [showSpecialTags, setShowSpecialTags] = useState(true);
    const [showSubstitution, setShowSubstitution] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

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
        setIsLoading(true);
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

            // 讀取門診表列印文字設定
            try {
                const settingsRes = await fetch('/api/settings');
                const settingsJson = await settingsRes.json();
                if (settingsJson.data) {
                    const printSettingsItem = settingsJson.data.find((item: any) => item.key === 'doctor_print_settings');
                    if (printSettingsItem && printSettingsItem.value) {
                        const parsed = JSON.parse(printSettingsItem.value);
                        if (parsed.titleSuffix) setTitleSuffix(parsed.titleSuffix);
                        if (parsed.defaultSubtitle) setDefaultSubtitle(parsed.defaultSubtitle);
                        if (parsed.footerText) setFooterText(parsed.footerText);
                        if (parsed.clinicName) setClinicName(parsed.clinicName);
                    }
                }
            } catch (e) {
                console.error("讀取列印設定失敗", e);
            }
        } catch (error) {
            console.error('Fetch data error:', error);
            alert('載入資料失敗');
        } finally {
            setIsLoading(false);
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
                useCORS: true 
            });
            
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // 核心修正：同時考慮寬高比，確保不超出邊界
            // 將 canvas 的像素尺寸轉換為 mm（假設 96 DPI，1 inch = 25.4mm）
            const mmPerPixel = 25.4 / 96;
            const imgWidth = canvas.width * mmPerPixel;
            const imgHeight = canvas.height * mmPerPixel;
            
            // 計算縮放比例，確保圖片能完整塞進單一頁面
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const scaledWidth = imgWidth * ratio;
            const scaledHeight = imgHeight * ratio;
            
            // 居中計算：讓縮放後的門診表在 A4 橫向頁面中水平與垂直置中
            const imgX = (pdfWidth - scaledWidth) / 2;
            const imgY = (pdfHeight - scaledHeight) / 2;
            
            // 單頁輸出，避免切割問題
            pdf.addImage(imgData, 'PNG', imgX, imgY, scaledWidth, scaledHeight);
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

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'doctor_print_settings',
                    value: JSON.stringify({ clinicName, titleSuffix, defaultSubtitle, footerText })
                })
            });
            alert('已將目前的文字設定儲存為本院區預設值！');
        } catch (error) {
            alert('儲存失敗');
        } finally {
            setIsSavingSettings(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-[1200px] p-4 rounded-t-xl border-b flex flex-col gap-4 relative">
                {/* 獨立的關閉按鈕，絕對不會被擠下去 */}
                <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-full transition" title="關閉">
                    <X size={26}/>
                </button>

                {/* 上排：主控制列 (加入 pr-12 避開關閉按鈕) */}
                <div className="flex flex-wrap justify-between items-center gap-4 pr-12">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-bold text-lg flex items-center gap-2"><Settings size={20}/> 門診表設定</h3>
                        
                        {/* 🟢 日期選擇器：可以直接點擊挑選日期 */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-1 ml-2 border border-slate-200">
                            <button onClick={handlePrevPeriod} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronLeft size={16}/></button>
                            <input 
                                type="date" 
                                value={getLocalDateString(targetDate)}
                                onChange={(e) => {
                                    if(e.target.value) setTargetDate(new Date(e.target.value));
                                }}
                                className="px-2 font-mono text-sm font-bold bg-transparent outline-none cursor-pointer text-slate-700"
                            />
                            <button onClick={handleNextPeriod} className="p-1 hover:bg-white rounded shadow-sm transition"><ChevronRight size={16}/></button>
                        </div>
                        
                        <select 
                            value={duration} 
                            onChange={(e) => setDuration(Number(e.target.value) as 7 | 14)}
                            className="border border-slate-300 rounded px-2 py-1.5 text-sm font-bold bg-white focus:border-teal-500 outline-none"
                        >
                            <option value={7}>1 週 (7 天)</option>
                            <option value={14}>2 週 (14 天)</option>
                        </select>
                        
                        <div className="flex items-center gap-4 ml-2 border-l-2 border-slate-200 pl-4">
                            <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer text-slate-700 hover:text-teal-700 transition">
                                <input type="checkbox" checked={showDate} onChange={e => setShowDate(e.target.checked)} className="w-4 h-4 accent-teal-600"/> 顯示日期
                            </label>
                            <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer text-slate-700 hover:text-teal-700 transition">
                                <input type="checkbox" checked={showSpecialTags} onChange={e => setShowSpecialTags(e.target.checked)} className="w-4 h-4 accent-teal-600"/> 特殊門診
                            </label>
                            <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer text-slate-700 hover:text-teal-700 transition">
                                <input type="checkbox" checked={showSubstitution} onChange={e => setShowSubstitution(e.target.checked)} className="w-4 h-4 accent-teal-600"/> 異動
                            </label>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button onClick={handleDownload} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition shadow-sm">
                            <Download size={16}/> 圖片
                        </button>
                        <button onClick={handleDownloadPDF} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1.5 transition shadow-sm">
                            <FileText size={16}/> PDF
                        </button>
                    </div>
                </div>

                {/* 下排：文字客製化設定區 */}
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500">主標題:</span>
                        <input value={clinicName} onChange={e => setClinicName(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm w-28 outline-none focus:border-teal-500 shadow-inner"/>
                        <input value={titleSuffix} onChange={e => setTitleSuffix(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm w-32 outline-none focus:border-teal-500 shadow-inner"/>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-500">副標題:</span>
                        <input value={defaultSubtitle} onChange={e => setDefaultSubtitle(e.target.value)} disabled={showDate} className="border border-slate-300 rounded px-2 py-1 text-sm w-32 outline-none disabled:bg-slate-200 disabled:text-slate-400 shadow-inner"/>
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                        <span className="text-xs font-bold text-slate-500">頁尾:</span>
                        <input value={footerText} onChange={e => setFooterText(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-sm w-full outline-none focus:border-teal-500 shadow-inner"/>
                    </div>
                    <button 
                        onClick={handleSaveSettings} 
                        disabled={isSavingSettings} 
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-1.5 rounded-md text-sm font-bold transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm ml-auto"
                    >
                        {isSavingSettings ? '儲存中...' : '儲存為預設'}
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-500/50 w-full max-w-[1200px] p-8 flex justify-center items-start relative">
                {/* 🟢 Loading 毛玻璃遮罩 */}
                {isLoading && (
                    <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-2xl shadow-xl">
                            <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin"></div>
                            <span className="text-teal-700 font-bold">載入班表資料中...</span>
                        </div>
                    </div>
                )}
                
                <div ref={printRef} className={`bg-white p-10 shadow-2xl min-w-[1000px] transition-opacity duration-300 ${isLoading ? 'opacity-30' : 'opacity-100'}`}>
                    <div className="text-center mb-8 border-b-4 border-teal-600 pb-4">
                        <h1 className="text-5xl font-black text-slate-800 tracking-widest mb-2">{clinicName} {titleSuffix}</h1>
                        <p className="text-xl text-slate-500 font-bold tracking-widest mt-2">
                            {showDate ? `${startDateStr.replace(/-/g,'.')} - ${endDateStr.replace(/-/g,'.')}` : defaultSubtitle}
                        </p>
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
                                                        .sort((a,b) => (a?.start_time || '').localeCompare(b?.start_time || ''));

                                                    return (
                                                        <td key={idx} className="border border-slate-400 align-middle p-2 hover:bg-slate-50/10">
                                                            {/* 🟢 拉大不同醫師的間距 (gap-6)，並加上下 padding */}
                                                            <div className="flex flex-col gap-6 h-full justify-center py-2">
                                                                {workers.map(w => {
                                                                    const doc = doctors.find(d => d.id === w.doctor_id);
                                                                    return (
                                                                        // 🟢 縮減醫師內部姓名、時間、標籤的間距，讓資訊更緊湊
                                                                        <div key={w.id} className="flex flex-col items-center leading-tight">
                                                                            <span className={`text-xl font-bold ${w.is_dedicated ? 'text-purple-700' : 'text-slate-800'}`}>
                                                                                {doc?.name}
                                                                            </span>
                                                                            <span className="text-xs font-mono text-slate-500 px-1.5 mt-0.5 whitespace-nowrap">
                                                                                {fmtTime(w.start_time)}-{fmtTime(w.end_time)}
                                                                            </span>
                                                                            {/* 特殊門診標籤 */}
                                                                            {showSpecialTags && w.special_tags && w.special_tags.length > 0 && (
                                                                                <div className="flex flex-col items-center gap-[1px] mt-0.5 w-full overflow-visible">
                                                                                    {w.special_tags.map((tag: string, tagIdx: number) => {
                                                                                        const fullText = w.is_dedicated ? `${tag}專診` : `暨 ${tag}`;
                                                                                        const isLong = fullText.length > 6; 
                                                                                        return (
                                                                                            // 🟢 移除 bg-orange-50 與 bg-pink-50，保留顏色字體
                                                                                            <span 
                                                                                                key={tagIdx} 
                                                                                                className={`whitespace-nowrap font-bold px-0.5 rounded ${
                                                                                                    isLong ? 'tracking-tighter text-[10.5px]' : 'text-[11px]'
                                                                                                } ${w.is_dedicated ? 'text-pink-600' : 'text-orange-600'}`}
                                                                                            >
                                                                                                {fullText}
                                                                                            </span>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            )}
                                                                            {/* 異動資訊 */}
                                                                            {showSubstitution && w.is_substitution && (
                                                                                <span className="text-[11px] font-bold text-purple-600 mt-1">
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
                    <div className="mt-6 text-center font-bold text-slate-500">{footerText}</div>
                </div>
            </div>
        </div>
    );
}
