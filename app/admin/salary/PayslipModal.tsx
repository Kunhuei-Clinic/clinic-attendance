'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer } from 'lucide-react';

export default function PayslipModal({ report, yearMonth, clinicName, onClose }: any) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => {
    if (!report || !yearMonth || !clinicName) return;
    const originalTitle = document.title;
    const safeName = (report.staff_name || '').replace(/\s+/g, '_');
    document.title = `${clinicName}_${safeName}_${yearMonth}_薪資單`;
    return () => { document.title = originalTitle; };
  }, [clinicName, report, yearMonth]);

  const handlePrint = () => window.print();

  if (!mounted) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 print:hidden">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
          <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-lg">薪資單預覽</h3>
            <div className="flex gap-3">
              <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold transition">
                <Printer size={18}/> 列印 / PDF
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full"><X size={20}/></button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 bg-gray-100 p-8">
            <div className="bg-white shadow-sm min-h-[200mm] w-full mx-auto p-8">
               <PrintContent report={report} yearMonth={yearMonth} clinicName={clinicName} />
            </div>
          </div>
        </div>
      </div>

      <PrintPortal>
        <div className="print-only">
          <PrintContent report={report} yearMonth={yearMonth} clinicName={clinicName} />
        </div>
      </PrintPortal>

      <style jsx global>{`
        @media print {
          body > *:not(#print-root) { display: none !important; }
          #print-root { display: block !important; }
          @page { size: A4; margin: 10mm; }
          body { margin: 0; background: white; font-size: 12pt; }
        }
        .print-only { display: none; }
        @media print { .print-only { display: block; } }
      `}</style>
    </>
  );
}

function PrintContent({ report, yearMonth, clinicName }: any) {
  const [year, month] = yearMonth.split('-');
  const fmt = (n: number) => Math.round(n).toLocaleString();

  // 🟢 計算加班時數分佈 (toFixed 避免浮點溢位)
  const total134 = Number((report.dailyRecords?.reduce((sum: number, r: any) => sum + (r.ot134 || 0), 0) || 0).toFixed(2));
  const total167 = Number((report.dailyRecords?.reduce((sum: number, r: any) => sum + (r.ot167 || 0), 0) || 0).toFixed(2));

  // 🟢 計算國定假日細節
  const holidayRecords = report.dailyRecords?.filter((r: any) => r.dayType === 'holiday' || r.dayType === 'regular') || [];
  const holidayDates = holidayRecords.map((r: any) => r.date.slice(5)).join(', ');
  const holidayHours = Number((report.dailyRecords?.filter((r: any) => r.dayType === 'holiday' || r.dayType === 'regular').reduce((sum: number, r: any) => sum + (r.totalHours || 0), 0) || 0).toFixed(2));

  // 🟢 產生「當月每一天」的完整陣列 (勞檢防禦)
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  const fullMonthRecords = Array.from({ length: daysInMonth }, (_, i) => {
    const dayStr = String(i + 1).padStart(2, '0');
    const dateStr = `${yearMonth}-${dayStr}`;
    const existing = report.dailyRecords?.find((r: any) => r.date === dateStr);
    return existing || {
      date: dateStr,
      dayType: 'empty',
      totalHours: 0,
      normalHours: 0,
      ot134: 0,
      ot167: 0,
      note: '',
      clockIn: '--:--'
    };
  });

  const getDayTypeLabel = (type: string) => {
    switch(type) {
      case 'holiday': return <span className="text-red-600 font-bold">國定</span>;
      case 'regular': return <span className="text-red-600 font-bold">例假</span>;
      case 'rest': return <span className="text-green-600 font-bold">休息</span>;
      default: return <span className="text-slate-400">平日</span>;
    }
  };

  const getWorkRuleLabel = (rule: string) => {
    switch(rule) {
        case '2week': return '二週變形';
        case '4week': return '四週變形';
        case '8week': return '八週變形';
        case 'none': return '責任制';
        default: return '正常工時';
    }
  };

  return (
    <div className="text-slate-900 font-sans w-full max-w-full">
      
      {/* PAGE 1 */}
      <div className="flex flex-col justify-between" style={{ minHeight: '260mm' }}>
        <div>
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
            <div>
              <div className="text-sm text-slate-500 mb-1">{clinicName || '診所名稱'}</div>
              <h1 className="text-3xl font-extrabold text-slate-900">薪 資 明 細 單</h1>
              <p className="text-slate-400 text-xs mt-1">Pay Slip</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">{year} 年 {month} 月</div>
              <div className="text-base font-bold mt-1">{report.staff_role}：{report.staff_name}</div>
              <div className="text-xs text-slate-500 mt-1 bg-slate-100 px-2 py-0.5 rounded inline-block">
                工時制: {getWorkRuleLabel(report.work_rule)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h4 className="font-bold text-slate-800 border-b-2 border-slate-200 pb-1 mb-3 flex justify-between">
                <span>應發項目</span><span className="text-xs bg-blue-100 text-blue-800 px-2 rounded">加項 +</span>
              </h4>
              <table className="w-full text-sm">
                <tbody>
                  {report.salary_mode === 'hourly' ? (
                    <>
                      <Row label="總計工時本薪" amount={report.base_pay} sub={`${report.total_work_hours ?? 0}hr (時薪 $${Math.round(report.base_pay / (report.total_work_hours || 1))})`} />
                      {(report.ot_pay > 0) && <Row label="加班費加成" amount={report.ot_pay} sub={`1.34 (${total134}hr) / 1.67 (${total167}hr)`} />}
                      {(report.holiday_pay > 0) && <Row label="國定假日加成" amount={report.holiday_pay} sub={`${holidayDates} (共 ${holidayHours}hr)`} />}
                    </>
                  ) : (
                    <>
                      <Row label="本薪 (月薪)" amount={report.base_pay} />
                      {(report.ot_pay > 0) && <Row label="加班費合計" amount={report.ot_pay} sub={`共 ${(report.normal_ot_hours ?? 0) + (report.rest_work_hours ?? 0)}hr`} />}
                      <Row label="假日加給" amount={report.holiday_pay} />
                    </>
                  )}
                  <Row label="固定津貼" amount={report.fixed_bonus_pay} />
                  <Row label="變動獎金" amount={report.temp_bonus_pay} highlight />
                  
                  {/* 🟢 新增：請假給薪 (Leave Addition) */}
                  <Row label="請假給薪" amount={report.leave_addition} sub="特休/公假/喪假" />

                  {report.bonus_details?.map((item: any, i: number) => (
                    <tr key={`b-${i}`} className="text-xs text-slate-500"><td className="pl-2 py-0.5">• {item.name}</td><td className="text-right py-0.5">${fmt(item.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-300"><td className="py-2 font-bold">應發總計</td><td className="py-2 font-bold text-right">${fmt(report.gross_pay)}</td></tr>
                </tfoot>
              </table>
            </div>

            <div>
              <h4 className="font-bold text-slate-800 border-b-2 border-slate-200 pb-1 mb-3 flex justify-between">
                <span>應扣項目</span><span className="text-xs bg-red-100 text-red-800 px-2 rounded">減項 -</span>
              </h4>
              <table className="w-full text-sm">
                <tbody>
                  <Row label="勞保自付" amount={report.insurance_labor} />
                  <Row label="健保自付" amount={report.insurance_health} />
                  <Row label="固定扣項" amount={report.fixed_deduction_pay} />
                  
                  {/* 🟢 新增：請假扣款 (Leave Deduction) */}
                  <Row label="請假扣款" amount={report.leave_deduction} sub="事假/病假" isDeduction />

                  <Row label="變動扣款" amount={report.temp_deduction_pay} isDeduction />
                  {report.deduction_details?.map((item: any, i: number) => (
                    <tr key={`d-${i}`} className="text-xs text-slate-500"><td className="pl-2 py-0.5">• {item.name}</td><td className="text-right py-0.5 text-red-400">-${fmt(item.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-300"><td className="py-2 font-bold">應扣總計</td><td className="py-2 font-bold text-right text-red-600">-${fmt(report.total_deduction)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-slate-100 rounded-lg p-6 border border-slate-300 flex justify-between items-center print:bg-slate-50 print:border-slate-400">
            <div>
               <span className="block text-lg font-bold text-slate-700">實發金額 (Net Pay)</span>
               <span className="text-xs text-slate-400">請確認金額無誤後簽收</span>
            </div>
            <span className="text-4xl font-extrabold text-slate-900 border-b-4 border-double border-slate-400 pb-1">${fmt(report.net_pay)}</span>
          </div>
        </div>

        <div>
           <div className="grid grid-cols-2 gap-20 mt-8 pt-8 text-center text-sm text-slate-500">
              <div className="border-t border-slate-400 pt-2">單位主管簽章</div>
              <div className="border-t border-slate-400 pt-2">員工簽收</div>
           </div>
           <div className="text-center text-xs text-slate-300 mt-4">第 1 頁，共 2 頁</div>
        </div>
      </div>

      {/* PAGE 2 */}
      <div style={{ pageBreakBefore: 'always' }} className="pt-8">
        <div className="border-b-2 border-slate-800 pb-2 mb-2 flex justify-between items-end">
          <h1 className="text-lg font-bold text-slate-900">每日出勤與打卡明細</h1>
          <p className="text-slate-600 text-sm font-bold">{year}年{month}月 • {report.staff_role} {report.staff_name}</p>
        </div>

        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 print:bg-slate-50">
              <th className="p-1 text-left">日期</th>
              <th className="p-1 text-center">屬性</th>
              <th className="p-1 text-left">打卡時間</th>
              <th className="p-1 text-center">總計</th>
              <th className="p-1 text-center bg-blue-50 print:bg-white">正常</th>
              <th className="p-1 text-center bg-orange-50 text-orange-700 print:bg-white print:text-black">x1.34</th>
              <th className="p-1 text-center bg-orange-50 text-orange-700 print:bg-white print:text-black">x1.67</th>
              <th className="p-1 text-left">備註</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {fullMonthRecords.map((rec: any, idx: number) => (
              <tr key={idx} className="print:break-inside-avoid text-slate-600">
                <td className="p-1 font-mono text-slate-800">{rec.date.slice(5)}</td>
                <td className="p-1 text-center">{rec.dayType === 'empty' ? '-' : getDayTypeLabel(rec.dayType)}</td>
                <td className="p-1 font-mono text-[10px] text-slate-500 whitespace-nowrap">{rec.clockIn === '--:--' ? '-' : rec.clockIn}</td>
                <td className="p-1 text-center font-bold text-slate-800">{rec.totalHours > 0 ? rec.totalHours : '-'}</td>
                <td className="p-1 text-center text-slate-400">{rec.normalHours > 0 ? rec.normalHours : '-'}</td>
                <td className="p-1 text-center font-mono text-orange-600 print:text-black">{rec.ot134 > 0 ? rec.ot134.toFixed(1) : '-'}</td>
                <td className="p-1 text-center font-mono text-orange-600 print:text-black">{rec.ot167 > 0 ? rec.ot167.toFixed(1) : '-'}</td>
                <td className="p-1 text-slate-400 text-[10px] truncate max-w-[100px]">{rec.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white font-bold print:bg-slate-200 print:text-black print:border-t-2 print:border-black">
              <td colSpan={3} className="p-1 text-right">總計:</td>
              <td className="p-1 text-center">{report.total_work_hours.toFixed(1)}</td>
              <td className="p-1 text-center">{report.normal_hours.toFixed(1)}</td>
              <td className="p-1 text-center">-</td>
              <td className="p-1 text-center">-</td>
              <td className="p-1 text-[10px] font-normal opacity-70 print:opacity-100 print:text-slate-600">
                * 超時: {report.period_ot_hours.toFixed(1)} hr
              </td>
            </tr>
          </tfoot>
        </table>
        <div className="text-center text-xs text-slate-300 mt-8">第 2 頁，共 2 頁</div>
      </div>
    </div>
  );
}

function PrintPortal({ children }: { children: React.ReactNode }) {
  const [container] = useState(() => {
    if (typeof document === 'undefined') return null;
    const div = document.createElement('div');
    div.id = 'print-root';
    return div;
  });

  useEffect(() => {
    if (!container) return;
    document.body.appendChild(container);
    return () => document.body.removeChild(container);
  }, [container]);

  if (!container) return null;
  return createPortal(children, container);
}

function Row({ label, amount, sub, isDeduction, highlight }: any) {
  if (amount === 0 && !highlight) return null;
  return (
    <tr className="border-b border-dashed border-slate-200">
      <td className="py-1.5 pr-2">
        <div className="font-medium text-slate-700">{label}</div>
        {sub && <div className="text-[10px] text-slate-400">{sub}</div>}
      </td>
      <td className={`py-1.5 text-right font-mono font-bold ${isDeduction ? 'text-red-500' : 'text-slate-700'}`}>
        {isDeduction ? '-' : ''}{Math.round(amount).toLocaleString()}
      </td>
    </tr>
  );
}
