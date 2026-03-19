'use client';
import React, { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function PayslipModal({ report, yearMonth, clinicName, onClose }: any) {
  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // 🟢 個別下載 PDF 功能 (強制抓取第1頁與第2頁並合併為 A4)
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const el = document.getElementById('single-payslip-capture');
      if (!el) return;

      const page1 = el.querySelector('.pdf-page-1') as HTMLElement;
      const page2 = el.querySelector('.pdf-page-2') as HTMLElement;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth(); // A4 寬度 210mm

      if (page1) {
        const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData1 = canvas1.toDataURL('image/png');
        pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, pdfWidth * (canvas1.height / canvas1.width));
      }

      if (page2) {
        pdf.addPage();
        const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData2 = canvas2.toDataURL('image/png');
        pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, pdfWidth * (canvas2.height / canvas2.width));
      }

      const safeName = (report.staff_name || '').replace(/\s+/g, '_');
      pdf.save(`${clinicName}_${safeName}_${yearMonth}_薪資單.pdf`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('PDF 下載失敗:', error);
      alert('產生 PDF 時發生錯誤');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4 print:hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh] overflow-hidden">
        {/* Modal 頂部控制列 */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
          <h3 className="font-bold tracking-widest">薪資單預覽與下載</h3>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex items-center gap-2 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition shadow-sm disabled:opacity-50"
            >
              <Download size={16} /> {isDownloading ? 'PDF 產生中...' : '下載 PDF'}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-full transition">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 預覽畫面區塊 */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-200">
          <div id="single-payslip-capture" className="mx-auto flex flex-col gap-8 items-center">
            <PrintContent report={report} yearMonth={yearMonth} clinicName={clinicName} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrintContent({ report, yearMonth, clinicName }: any) {
  // 工時制度翻譯
  const workRuleMap: Record<string, string> = {
    normal: '一般工時',
    '2week': '雙週變形工時',
    '4week': '四週變形工時',
    '8week': '八週變形工時',
    online_consultation: '線上諮詢時數制',
    none: '責任制 / 無限制',
  };
  const translatedWorkRule = workRuleMap[report.work_rule] || report.work_rule || '一般工時';
  const empTypeStr = report.employment_type === 'part_time' ? '兼職' : '正職';
  const salaryModeStr = report.salary_mode === 'monthly' ? '月薪制' : '時薪制';

  return (
    <>
      {/* 🟢 第 1 頁：基本資料、薪資明細、聲明與簽收 */}
      {/* 強制設定 minHeight 為 1131px (對應寬度 800px 的 A4 比例 1:1.414) */}
      <div className="pdf-page-1 bg-white p-12 w-[800px] shadow-md relative shrink-0" style={{ minHeight: '1131px' }}>
        {/* 質感抬頭 */}
        <div className="text-center mb-10 border-b-2 border-slate-800 pb-8">
          <h2 className="text-3xl font-black text-slate-900 tracking-widest mb-4">{clinicName}</h2>
          <div className="inline-block bg-slate-800 text-white px-8 py-2 rounded-full text-lg font-bold tracking-widest shadow-sm">
            {yearMonth.replace('-', '年')}月 薪資明細單
          </div>
        </div>

        {/* 員工基本資料 (乾淨的一條線分隔) */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <div className="text-4xl font-black text-slate-900 tracking-widest mb-3">{report.staff_name}</div>
            <div className="text-base font-bold text-slate-600 flex items-center gap-3">
              <span>[{empTypeStr}]</span>
              <span>{report.staff_role}</span>
              <span className="text-slate-300">|</span>
              <span>
                {translatedWorkRule}・{salaryModeStr}
              </span>
            </div>
          </div>
          <div className="text-right bg-slate-50 border border-slate-200 px-6 py-4 rounded-xl">
            <div className="text-sm text-slate-500 font-bold mb-1">本月實發薪資 (Net Pay)</div>
            <div className="text-3xl font-mono font-black text-emerald-600">${(report.net_pay ?? 0).toLocaleString()}</div>
          </div>
        </div>

        {/* 薪資明細 (左右兩欄式設計) */}
        <div className="grid grid-cols-2 gap-10 mb-8">
          {/* 左側：應發項目 */}
          <div>
            <h4 className="font-bold text-slate-800 border-b border-slate-300 pb-2 mb-4 flex justify-between">
              <span>應發項目</span> <span className="text-blue-600">(+)</span>
            </h4>
            <table className="w-full text-sm">
              <tbody>
                <Row label="本薪 / 底薪" amount={report.base_pay} />
                <Row label="特休/假別津貼" amount={report.leave_addition} />
                <Row label="加班費彙總" amount={report.ot_pay} />
                <Row label="國定假日出勤" amount={report.holiday_pay} />
                {report.bonuses?.map((b: any, i: number) => (
                  <Row key={`b-${i}`} label={`[獎金] ${b.name}`} amount={b.amount} />
                ))}
              </tbody>
            </table>
          </div>

          {/* 右側：應扣項目 */}
          <div>
            <h4 className="font-bold text-slate-800 border-b border-slate-300 pb-2 mb-4 flex justify-between">
              <span>應扣項目</span> <span className="text-red-600">(-)</span>
            </h4>
            <table className="w-full text-sm">
              <tbody>
                <Row label="勞保自付" amount={report.insurance_labor} isDeduction />
                <Row label="健保自付" amount={report.insurance_health} isDeduction />
                <Row label="請假扣薪" amount={report.leave_deduction} isDeduction />
                <Row label="固定扣款" amount={report.fixed_deduction_pay} isDeduction />
                {report.fixed_deduction_details?.map((b: any, i: number) => (
                  <Row key={`fd-${i}`} label={`[固定] ${b.name}`} amount={b.amount} isDeduction />
                ))}
                {report.temp_deduction_details?.map((b: any, i: number) => (
                  <Row key={`td-${i}`} label={`[變動] ${b.name}`} amount={b.amount} isDeduction />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 第一頁底部：聲明與簽收欄 (絕對定位於底部) */}
        <div className="absolute bottom-12 left-12 right-12">
          <div className="text-xs text-slate-500 mb-8 leading-relaxed text-justify bg-slate-50 p-4 rounded-lg border border-slate-100">
            <strong>【機密聲明】</strong> 本薪資明細單為個人機密文件，請妥善保管並切勿外流。如有任何計算疑義，請於發薪日起三日內向所屬主管或人資部門提出查核。如無異議，請於下方簽名後繳回存查。
          </div>
          <div className="flex justify-end items-end gap-4 mt-8 pr-4">
            <div className="text-sm font-bold text-slate-700">員工簽收：</div>
            <div className="w-48 border-b border-slate-800"></div>
            <div className="text-sm font-bold text-slate-700 ml-6">日期：</div>
            <div className="w-32 border-b border-slate-800"></div>
          </div>
        </div>
      </div>

      {/* 🟢 第 2 頁：考勤與工時明細 */}
      <div className="pdf-page-2 bg-white p-12 w-[800px] shadow-md shrink-0" style={{ minHeight: '1131px' }}>
        <div className="text-xl font-black text-slate-800 border-b-2 border-slate-800 pb-3 mb-6 flex items-center justify-between">
          <span>考勤與工時明細</span>
          <span className="text-sm text-slate-500 font-normal">
            {report.staff_name} - {yearMonth.replace('-', '年')}月
          </span>
        </div>

        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-300">
            <tr>
              <th className="p-2">日期</th>
              <th className="p-2">屬性</th>
              <th className="p-2">班別 / 備註</th>
              <th className="p-2 text-center">打卡時間</th>
              <th className="p-2 text-right">總時數</th>
              <th className="p-2 text-right">正常</th>
              <th className="p-2 text-right text-orange-600">x1.34</th>
              <th className="p-2 text-right text-red-600">x1.67</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(report.dailyRecords || []).map((r: any, idx: number) => {
              const isWeekend = new Date(r.date).getDay() === 0 || new Date(r.date).getDay() === 6;
              return (
                <tr key={idx} className={isWeekend ? 'bg-slate-50/50' : ''}>
                  <td className="p-2 font-mono text-slate-500">{r.date.slice(5)}</td>
                  <td className="p-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        r.dayType === 'rest'
                          ? 'bg-emerald-100 text-emerald-700'
                          : r.dayType === 'regular'
                            ? 'bg-red-100 text-red-700'
                            : r.dayType === 'holiday'
                              ? 'bg-pink-100 text-pink-700'
                              : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.dayType === 'rest' ? '休息' : r.dayType === 'regular' ? '例假' : r.dayType === 'holiday' ? '國假' : '平日'}
                    </span>
                  </td>
                  <td className="p-2 text-slate-700 max-w-[120px] truncate" title={r.shiftInfo}>
                    {r.shiftInfo || '-'}
                  </td>
                  <td className="p-2 text-center font-mono">
                    {r.clockIn || '--:--'} ~ {r.clockOut || '--:--'}
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-slate-700">{r.totalHours > 0 ? r.totalHours.toFixed(1) : '-'}</td>
                  <td className="p-2 text-right font-mono">{r.normalHours > 0 ? r.normalHours.toFixed(1) : '-'}</td>
                  <td className="p-2 text-right font-mono text-orange-600">{r.ot134 > 0 ? r.ot134.toFixed(1) : '-'}</td>
                  <td className="p-2 text-right font-mono text-red-600">{r.ot167 > 0 ? r.ot167.toFixed(1) : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ label, amount, sub, isDeduction }: any) {
  if (!amount && amount !== 0) return null;
  if (amount === 0) return null;
  return (
    <tr className="border-b border-dashed border-slate-200">
      <td className="py-2.5 pr-2 text-slate-600 font-bold tracking-wide">
        {label} {sub && <span className="text-xs text-slate-400 ml-1">{sub}</span>}
      </td>
      <td className={`py-2.5 text-right font-mono font-bold text-base ${isDeduction ? 'text-red-600' : 'text-slate-800'}`}>
        {isDeduction ? '-' : ''}
        {Math.abs(amount).toLocaleString()}
      </td>
    </tr>
  );
}
