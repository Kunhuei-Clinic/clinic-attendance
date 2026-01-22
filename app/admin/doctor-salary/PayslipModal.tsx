'use client';

import React, { useRef, useState } from 'react';
import { Printer, X, Calendar, Coins, Landmark, Banknote, Sparkles, FileText, Image as ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 輔助函式：數字格式化
const safeFmt = (val: any, decimals: number = 0) => {
    const num = Number(val);
    if (isNaN(num)) return "0";
    return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export default function PayslipModal({ data, roster, ppfDetails, month, onClose }: any) {
    const slipRef = useRef<HTMLDivElement>(null);
    const page1Ref = useRef<HTMLDivElement>(null);
    const page2Ref = useRef<HTMLDivElement>(null);
    
    const [isGenerating, setIsGenerating] = useState(false);

    // 🟢 1. 下載為圖片 (JPG)
    const handleDownloadImage = async () => {
        if (!slipRef.current) return;
        setIsGenerating(true);
        await new Promise(r => setTimeout(r, 100)); 
        try {
            const canvas = await html2canvas(slipRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `醫師薪資單_${data?.doctorName || '醫師'}_${month}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
        } catch (e) {
            alert("圖片產生失敗");
        } finally {
            setIsGenerating(false);
        }
    };

    // 🟢 2. 下載為 PDF (分頁模式：A4 兩頁)
    const handleDownloadPDF = async () => {
        if (!page1Ref.current || !page2Ref.current) return;
        setIsGenerating(true);
        await new Promise(r => setTimeout(r, 100));

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = 210;
            const pdfHeight = 297;

            // --- 第一頁 ---
            const canvas1 = await html2canvas(page1Ref.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
            const imgData1 = canvas1.toDataURL('image/jpeg', 1.0);
            const imgHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
            
            pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, Math.min(imgHeight1, pdfHeight));

            // --- 第二頁 (出勤明細) ---
            pdf.addPage();
            const canvas2 = await html2canvas(page2Ref.current, { scale: 3, useCORS: true, backgroundColor: '#ffffff' });
            const imgData2 = canvas2.toDataURL('image/jpeg', 1.0);
            const imgHeight2 = (canvas2.height * pdfWidth) / canvas2.width;

            pdf.addImage(imgData2, 'JPEG', 0, 0, pdfWidth, Math.min(imgHeight2, pdfHeight));
            
            pdf.save(`醫師薪資單_${data?.doctorName || '醫師'}_${month}.pdf`);

        } catch (e) {
            console.error(e);
            alert("PDF 產生失敗");
        } finally {
            setIsGenerating(false);
        }
    };

    const safeData = data || {};
    const safePPF = ppfDetails || {};
    // 依 date ASC -> start_time ASC 排序，讓報表依時間順序呈現
    const safeRoster = (Array.isArray(roster) ? [...roster] : [])
        .filter((r: any) => r?.date != null)
        .sort((a: any, b: any) => {
            const d = (a.date || '').localeCompare(b.date || '');
            if (d !== 0) return d;
            return (a.start_time || '').localeCompare(b.start_time || '');
        });
    const selfPayItems = Array.isArray(safePPF.self_pay_items) ? safePPF.self_pay_items : [];
    const extraItems = Array.isArray(safePPF.extra_items) ? safePPF.extra_items : [];

    const totalNet = safeData.netPay || 0;
    const transfer = safePPF.transfer_amount || 0;
    const cash = totalNet - transfer;

    const nhiIncomeRaw = (Number(safePPF.nhi_points || 0) * Number(safePPF.nhiRate || 0)) - Number(safePPF.reg_fee_deduction || 0);
    const nhiIncome = Math.round(nhiIncomeRaw);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 rounded-t-xl">
                    <h3 className="font-bold flex items-center gap-2"><Printer size={18}/> 薪資單預覽</h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleDownloadImage} 
                            disabled={isGenerating}
                            className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded text-xs font-bold flex gap-1 items-center transition disabled:opacity-50"
                        >
                            <ImageIcon size={14}/> 下載圖片
                        </button>
                        <button 
                            onClick={handleDownloadPDF} 
                            disabled={isGenerating}
                            className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold flex gap-1 items-center transition disabled:opacity-50"
                        >
                            <FileText size={14}/> 下載 PDF (A4分頁)
                        </button>
                        <button onClick={onClose} className="hover:bg-slate-700 p-1.5 rounded-full ml-2"><X size={20}/></button>
                    </div>
                </div>
                
                <div className="p-8 bg-gray-100 overflow-y-auto flex-1">
                    <div ref={slipRef} className="bg-white shadow-lg border border-gray-300 text-slate-800 min-h-[800px]">
                        
                        {/* ==================== 第一頁區域 ==================== */}
                        <div ref={page1Ref} className="p-10 bg-white space-y-8">
                            
                            {/* 標頭 */}
                            <div className="text-center border-b-2 border-slate-800 pb-6">
                                <h2 className="text-3xl font-black text-slate-900 tracking-widest">醫師薪資明細表</h2>
                                <div className="flex justify-between items-end mt-4 px-4">
                                    <div className="text-left"><p className="text-sm text-slate-500">醫師姓名</p><p className="text-xl font-bold">{safeData.doctorName || '---'} 醫師</p></div>
                                    <div className="text-right"><p className="text-sm text-slate-500">結算月份</p><p className="text-xl font-bold font-mono">{month}</p></div>
                                </div>
                            </div>

                            {/* 薪資結構 */}
                            <div className="grid grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-700 bg-slate-100 p-2 rounded border-l-4 border-teal-500">應發項目 (Earnings)</h4>
                                    <div className="bg-gray-50 border border-gray-200 rounded p-3 space-y-2">
                                        <div className="flex justify-between items-center text-xs text-slate-500"><span>原始保障薪/掛牌費</span><span className="font-mono">${safeFmt(safeData.baseAmount)}</span></div>
                                        <div className="flex justify-between items-center text-xs text-slate-500"><span>工時調整</span><span className="font-mono">${safeFmt(safeData.workAmount)}</span></div>
                                        <div className="border-t border-gray-300 my-1"></div>
                                        <div className="flex justify-between items-center text-sm font-bold text-slate-800"><span>本月實領保障薪</span><span className="font-mono">${safeFmt(safeData.grossBasePay)}</span></div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 pl-1">工時公式: (實際 {safeFmt(safeData.actualHours, 1)} - 標準 {safeFmt(safeData.standardHours, 1)}) × ${safeFmt(safeData.hourlyRate)}</div>
                                    <div className="flex justify-between items-center text-sm border-b border-dashed pb-1 pt-2"><span className="text-blue-700 font-bold">PPF 超額獎金</span><span className="font-mono font-bold text-blue-700">${safeFmt(safeData.ppfBonus)}</span></div>
                                    {/* 🟢 修正：自費項目移到特殊費用區塊 */}
                                    {selfPayItems.length > 0 && (
                                        <div className="bg-purple-50 p-2 rounded border border-purple-200 mt-2">
                                            <div className="text-xs font-bold text-purple-900 mb-1 flex items-center gap-1"><Coins size={10}/> 自費項目 (另行計算)</div>
                                            {selfPayItems.map((item:any, idx:number) => (
                                                <div key={idx} className="flex justify-between text-[10px] border-b border-purple-100 last:border-0 pb-1">
                                                    <span>{item.name} ({item.rate}%)</span>
                                                    <span className="font-bold text-green-600">+${safeFmt(Number(item.amount) * (Number(item.rate)/100))}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between text-[10px] font-bold text-purple-800 pt-1 mt-1 border-t border-purple-200">
                                                <span>自費總計</span>
                                                <span>+${safeFmt(safePPF.selfPayTotal)}</span>
                                            </div>
                                        </div>
                                    )}
                                    {extraItems.length > 0 && (
                                        <div className="bg-purple-50 p-2 rounded border border-purple-200 mt-2">
                                                <div className="text-xs font-bold text-purple-900 mb-1 flex items-center gap-1"><Sparkles size={10}/> 其他特殊費用</div>
                                                {extraItems.map((item:any, idx:number) => (
                                                    <div key={idx} className="flex justify-between text-[10px] border-b border-purple-100 last:border-0 pb-1"><span>{item.name}</span><span className={`font-bold ${item.amount < 0 ? 'text-red-500' : 'text-green-600'}`}>{item.amount > 0 ? '+' : ''}${safeFmt(item.amount)}</span></div>
                                                ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="space-y-4">
                                    <h4 className="font-bold text-slate-700 bg-slate-100 p-2 rounded border-l-4 border-red-500">應扣項目 (Deductions)</h4>
                                    {safeData.insLabor > 0 && <div className="flex justify-between items-center text-sm border-b border-dashed pb-1 text-red-600"><span>勞保自付額</span><span className="font-mono">-${safeFmt(safeData.insLabor)}</span></div>}
                                    {safeData.insHealth > 0 && <div className="flex justify-between items-center text-sm border-b border-dashed pb-1 text-red-600"><span>健保自付額</span><span className="font-mono">-${safeFmt(safeData.insHealth)}</span></div>}
                                    <div className="flex justify-between items-center text-sm border-b border-dashed pb-1 text-red-600"><span>代扣所得稅</span><span className="font-mono">-$0</span></div>
                                </div>
                            </div>

                            {/* PPF 詳細 */}
                            {ppfDetails && (
                                <div className="border rounded-lg p-4 bg-yellow-50/50 border-yellow-200 text-xs mt-4 space-y-4">
                                    <div>
                                        <h4 className="font-bold text-yellow-800 mb-3 border-b border-yellow-200 pb-1 text-sm">PPF 計算明細 ({safePPF.target_month || '---'})</h4>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-slate-600">
                                            <div className="flex justify-between border-b border-dotted border-yellow-200 pb-1"><span>看診人數</span> <span>{safeFmt(safePPF.patient_count)} 人</span></div>
                                            <div className="flex justify-between border-b border-dotted border-yellow-200 pb-1"><span>健保點數</span> <span>{safeFmt(safePPF.nhi_points)} 點</span></div>
                                            <div className="flex justify-between border-b border-dotted border-yellow-200 pb-1"><span>健保診察費抽成率</span> <span className="font-bold text-blue-600">{((safePPF.nhiRate ?? 0) * 100).toFixed(0)}%</span></div>
                                            <div className="flex justify-between border-b border-dotted border-yellow-200 pb-1"><span>掛號費減免扣除額</span> <span className="font-bold text-red-500">-${safeFmt(safePPF.reg_fee_deduction)}</span></div>
                                        </div>
                                    </div>

                                    {/* 🟢 修正：PPF 計算只包含健保，不包含自費項目 */}
                                    <div className="bg-white border-2 border-yellow-200 p-3 rounded-lg flex flex-wrap items-center justify-center gap-2 text-xs shadow-sm">
                                        <div className="flex flex-col items-center"><span className="text-[9px] text-slate-400 mb-0.5">健保淨值</span><span className="font-bold text-slate-700">${safeFmt(nhiIncome)}</span></div>
                                        <span className="text-slate-300 font-light text-lg">-</span>
                                        <div className="flex flex-col items-center"><span className="text-[9px] text-slate-400 mb-0.5">已領保障薪</span><span className="font-bold text-slate-600">${safeFmt(safePPF.base_salary_at_time)}</span></div>
                                        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200"><span className="text-slate-300 font-light text-lg">=</span><div className="flex flex-col items-center"><span className="text-[9px] text-blue-400 mb-0.5">超額獎金</span><span className="font-black text-blue-600 text-sm">${safeFmt(safeData.ppfBonus)}</span></div></div>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-800 text-white p-6 rounded-lg flex justify-between items-center shadow-lg mt-6">
                                <div className="text-sm opacity-80">本月實領金額 (Net Pay)</div>
                                <div className="text-4xl font-black tracking-widest">${safeFmt(safeData.netPay)}</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="bg-white border border-slate-200 p-3 rounded flex items-center justify-between"><div className="flex items-center gap-2 text-slate-500 font-bold"><Landmark size={18}/> 銀行匯款</div><div className="text-xl font-bold text-slate-800">${safeFmt(transfer)}</div></div>
                                <div className="bg-white border border-slate-200 p-3 rounded flex items-center justify-between"><div className="flex items-center gap-2 text-slate-500 font-bold"><Banknote size={18}/> 現金簽收</div><div className="text-xl font-bold text-slate-800">${safeFmt(cash)}</div></div>
                            </div>

                            <div className="flex justify-between pt-8 border-t border-slate-200 text-sm text-slate-500 mt-6">
                                <div className="text-center w-1/3 border-t border-slate-400 pt-2">製表人簽章</div>
                                <div className="text-center w-1/3 border-t border-slate-400 pt-2">醫師簽收</div>
                            </div>
                        </div>

                        <div className="h-4 bg-gray-100 border-y border-gray-300"></div>

                        {/* ==================== 第二頁區域 (極限壓縮版) ==================== */}
                        {/* 🟢 修改：外層 padding 縮小為 p-6 (原 p-10) */}
                        <div ref={page2Ref} className="p-6 bg-white min-h-[500px]">
                            <div className="pt-2">
                                <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2 text-xs"><Calendar size={14}/> 本月出勤明細 (附件)</h4>
                                {/* 🟢 修改：文字縮小為 text-[10px]，加入 leading-tight */}
                                <table className="w-full text-[10px] text-left border-collapse leading-tight">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-300 text-slate-600">
                                            {/* 🟢 修改：th padding 縮小 */}
                                            <th className="py-1 px-2 w-[15%]">日期</th>
                                            <th className="py-1 px-2 w-[15%]">班別</th>
                                            <th className="py-1 px-2 w-[20%]">時間</th>
                                            <th className="py-1 px-2 w-[10%] text-right">時數</th>
                                            <th className="py-1 px-2 w-[40%]">備註</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {safeRoster.length === 0 ? (<tr><td colSpan={5} className="p-4 text-center text-slate-400">無出勤資料</td></tr>) : (safeRoster.map((r:any, idx:number) => { if (!r.start_time || !r.end_time) return null; const [sh, sm] = r.start_time.split(':').map(Number); const [eh, em] = r.end_time.split(':').map(Number); const duration = Math.max(0, (eh*60+em) - (sh*60+sm)) / 60; return (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            {/* 🟢 修改：td padding 縮小為 py-0.5，極度壓縮垂直空間 */}
                                            <td className="py-0.5 px-2 font-mono">{r.date || ''}</td>
                                            <td className="py-0.5 px-2 font-bold text-slate-700">{r.shift_code==='AM'?'早診':r.shift_code==='PM'?'午診':'晚診'}</td>
                                            <td className="py-0.5 px-2 font-mono text-slate-500">{r.start_time}-{r.end_time}</td>
                                            <td className="py-0.5 px-2 text-right font-bold">{duration.toFixed(1)}</td>
                                            <td className="py-0.5 px-2 text-slate-400">{r.is_dedicated && '專診'} {r.is_substitution && '代診'}</td>
                                        </tr>); }))}
                                        <tr className="bg-slate-50 font-bold border-t border-slate-300">
                                            <td colSpan={3} className="p-2 text-right">本月總時數</td>
                                            <td className="p-2 text-right text-teal-600 text-sm">{safeFmt(safeData.actualHours, 1)}</td>
                                            <td>hr</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
