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
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  useEffect(() => {
    if (!report || !yearMonth || !clinicName) return;
    const originalTitle = document.title;
    const safeName = (report.staff_name || '').replace(/\s+/g, '_');
    document.title = `${clinicName}_${safeName}_${yearMonth}_薪資單`;
    return () => { document.title = originalTitle; };
  }, [clinicName, report, yearMonth]);

  // 🟢 替換掉原本的 window.print()，改用穩定的 A4 雙頁 PDF 截圖
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
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-lg">薪資單預覽</h3>
          <div className="flex gap-3">
            <button onClick={handleDownloadPdf} disabled={isDownloading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-bold transition disabled:opacity-50">
              <Download size={18}/> {isDownloading ? '處理中...' : '下載 PDF'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition"><X size={20}/></button>
          </div>
        </div>
        
        {/* 背景改為灰色，凸顯中央的白紙效果 */}
        <div className="overflow-y-auto flex-1 bg-gray-200 p-8">
          <div id="single-payslip-capture" className="flex flex-col gap-8 items-center mx-auto w-fit">
             <PrintContent report={report} yearMonth={yearMonth} clinicName={clinicName} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrintContent({ report, yearMonth, clinicName }: any) {
  const [year, month] = yearMonth.split('-');
  const fmt = (n: number) => Math.round(n).toLocaleString();

  const onlineBonus = report.temp_bonus_details?.find((b: any) => String(b.name).includes('線上諮詢'));
  let onlineHours = 0;
  if (onlineBonus) {
    const match = String(onlineBonus.name).match(/線上諮詢\s*\(([\d.]+)\s*小時\)/);
    if (match) onlineHours = parseFloat(match[1]);
  }

  const total134 = Number((report.dailyRecords?.reduce((sum: number, r: any) => sum + (r.ot134 || 0), 0) || 0).toFixed(2));
  const total167 = Number((report.dailyRecords?.reduce((sum: number, r: any) => sum + (r.ot167 || 0), 0) || 0).toFixed(2));

  const holidayRecords = report.dailyRecords?.filter((r: any) => (r.dayType === 'holiday' || r.dayType === 'regular') && r.totalHours > 0) || [];
  const holidayDates = holidayRecords.map((r: any) => r.date.slice(5)).join(', ');
  const holidayHours = Number((holidayRecords.reduce((sum: number, r: any) => sum + (r.normalHours || 0), 0) || 0).toFixed(2));

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
        case '2week': return '二週變形工時';
        case '4week': return '四週變形工時';
        case '8week': return '八週變形工時';
        case 'none': return '責任制';
        case 'online_consultation': return '責任制-線上諮詢';
        default: return '正常工時';
    }
  };

  return (
    <>
      {/* 🟢 第一頁：固定寬高鎖定 A4 比例 */}
      <div className="pdf-page-1 bg-white p-10 shadow-sm shrink-0 flex flex-col justify-between" style={{ width: '800px', minHeight: '1131px' }}>
        <div>
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
            <div>
              <div className="text-sm text-slate-500 mb-1">{clinicName || '診所名稱'}</div>
              <h1 className="text-3xl font-extrabold text-slate-900">薪 資 明 細 單</h1>
              <p className="text-slate-400 text-xs mt-1">Pay Slip</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-900">{year} 年 {month} 月</div>
              {/* 🟢 美化與精簡的狀態列 */}
              <div className="text-slate-600 font-bold mb-1 flex items-center justify-end gap-2 text-sm">
                <span>{report.employment_type === 'part_time' ? '兼職' : '正職'}</span>
                <span className="text-slate-300">|</span>
                <span>{report.staff_role}</span>
                <span className="text-slate-300">|</span>
                <span>{getWorkRuleLabel(report.work_rule)}</span>
                <span className="text-slate-300">|</span>
                <span>{report.salary_mode === 'monthly' ? '月薪制' : '時薪制'}</span>
              </div>
              <div className="text-base font-bold mt-1">{report.staff_role}：{report.staff_name}</div>
              <div className="text-xs text-slate-500 mt-1 flex flex-col items-end gap-0.5">
                {/* 🟢 已刪除重複的工時制標籤，僅保留特休資訊 */}
                <span className="text-slate-400">
                  到職日: {report.hire_date || '未設定'} | 
                  今年特休總額: {report.annual_leave_days ?? 0} 天 | 
                  已休: {report.annual_leave_used ?? 0} 天 | 
                  剩餘: {report.annual_leave_remaining ?? ((report.annual_leave_days ?? 0) - (report.annual_leave_used ?? 0))} 天
                </span>
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
                      {(report.ot_pay > 0) && (
                        <Row
                          label="加班費合計"
                          amount={report.ot_pay}
                          sub={`共 ${(report.normal_ot_hours ?? 0) + (report.rest_work_hours ?? 0)}hr (換算時薪 $${Math.round(report.base_pay / 240)})`}
                        />
                      )}
                      {(report.holiday_pay > 0) && (
                        <Row
                          label="國定假日加發"
                          amount={report.holiday_pay}
                          sub={`${holidayDates} (依法加發 ${holidayRecords.length} 日工資)`}
                        />
                      )}
                    </>
                  )}
                  <Row label="固定津貼" amount={report.fixed_bonus_pay} />
                  {report.fixed_bonus_details?.map((item: any, i: number) => (
                    <tr key={`fb-${i}`} className="text-xs text-slate-500"><td className="pl-2 py-0.5">• {item.name}</td><td className="text-right py-0.5">${fmt(item.amount)}</td></tr>
                  ))}
                  <Row label="變動獎金" amount={report.temp_bonus_pay} highlight />
                  {report.temp_bonus_details?.map((item: any, i: number) => {
                    const isOnlineConsult = String(item.name || '').includes('線上諮詢');
                    const hoursMatch = String(item.name || '').match(/線上諮詢\s*\(([\d.]+)\s*小時\)/);
                    const hoursNum = hoursMatch ? hoursMatch[1] : null;
                    return (
                      <React.Fragment key={`tb-${i}`}>
                        <tr className="text-xs text-blue-600">
                          <td className="pl-2 py-0.5">
                            ↳ {item.name}
                            {isOnlineConsult && hoursNum != null && (
                              <span className="block text-slate-600 font-medium mt-0.5">線上諮詢時數: {hoursNum} 小時（勞檢備查）</span>
                            )}
                          </td>
                          <td className="text-right py-0.5">${fmt(item.amount)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  <Row label="請假給薪" amount={report.leave_addition} sub="特休/公假/喪假" />
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
                  {report.fixed_deduction_details?.map((item: any, i: number) => (
                    <tr key={`fd-${i}`} className="text-xs text-slate-500"><td className="pl-2 py-0.5">• {item.name}</td><td className="text-right py-0.5 text-red-400">-${fmt(item.amount)}</td></tr>
                  ))}
                  <Row label="請假扣款" amount={report.leave_deduction} sub="事假/病假" isDeduction />
                  <Row label="變動扣款" amount={report.temp_deduction_pay} isDeduction />
                  {report.temp_deduction_details?.map((item: any, i: number) => (
                    <tr key={`td-${i}`} className="text-xs text-red-600"><td className="pl-2 py-0.5">↳ {item.name}</td><td className="text-right py-0.5 text-red-400">-${fmt(item.amount)}</td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-300"><td className="py-2 font-bold">應扣總計</td><td className="py-2 font-bold text-right text-red-600">-${fmt(report.total_deduction)}</td></tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-slate-100 rounded-lg p-6 border border-slate-300 flex justify-between items-center">
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
           <div className="mt-6 p-3 bg-slate-50 border border-slate-200 text-xs text-slate-500 text-justify leading-relaxed rounded">
             <strong>【勞資確認與免責聲明】</strong><br/>
             1. 勞資雙方應依勞動基準法及相關法令，誠實核對本薪資明細表之各項出勤紀錄與收支金額。<br/>
             2. 員工如對本期薪資計算、特休餘額、加班時數或扣款明細有任何疑義，請於薪資發放日起 <strong>三日內</strong> 向管理部提出複查。<br/>
             3. 逾期未提出異議者，視同確認本薪資明細表內容正確無誤。本表僅供薪資核對使用，不作其他用途。
           </div>
        </div>
      </div>

      {/* 🟢 第二頁：考勤表 */}
      <div className="pdf-page-2 bg-white p-10 shadow-sm shrink-0 flex flex-col justify-between" style={{ width: '800px', minHeight: '1131px' }}>
        <div>
          <div className="border-b-2 border-slate-800 pb-2 mb-4 flex justify-between items-end">
            <h1 className="text-lg font-bold text-slate-900">每日出勤與打卡明細</h1>
            <p className="text-slate-600 text-sm font-bold">{year}年{month}月 • {report.staff_role} {report.staff_name}</p>
          </div>

          {report.work_rule === 'online_consultation' && onlineHours > 0 && (
            <div className="mb-4 p-3 border border-slate-300 bg-slate-50 rounded">
              <h4 className="font-bold text-slate-800 text-sm mb-1">📝 遠端線上勤務工時申報證明 (Remote Work Hours Declaration)</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                此員工本月採「線上諮詢/彈性責任制」，因勤務性質屬遠端線上作業，無固定之每日上下班打卡時間。<br/>
                經勞資雙方確認，本月實際執行線上勤務之總工時為：<strong className="text-base underline">{onlineHours} 小時</strong>，並以此申報時數核發薪資。特此聲明備查。
              </p>
            </div>
          )}

          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                <th className="p-1.5 text-left">日期</th>
                <th className="p-1.5 text-center">屬性</th>
                <th className="p-1.5 text-left">打卡時間</th>
                <th className="p-1.5 text-center">總計</th>
                <th className="p-1.5 text-center bg-blue-50">正常</th>
                <th className="p-1.5 text-center bg-orange-50 text-orange-700">x1.34</th>
                <th className="p-1.5 text-center bg-orange-50 text-orange-700">x1.67</th>
                <th className="p-1.5 text-left">備註</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(report.dailyRecords || []).map((rec: any, idx: number) => (
                <tr key={idx} className="text-slate-600">
                  <td className="p-1.5 font-mono text-slate-800">{rec.date?.slice(5)}</td>
                  <td className="p-1.5 text-center">{rec.dayType === 'empty' ? '-' : getDayTypeLabel(rec.dayType)}</td>
                  <td className="p-1.5 font-mono text-[10px] text-slate-500 whitespace-nowrap">{rec.clockIn === '--:--' ? '-' : (rec.clockIn || '-')}</td>
                  <td className="p-1.5 text-center font-bold text-slate-800">{rec.totalHours > 0 ? rec.totalHours : '-'}</td>
                  <td className="p-1.5 text-center text-slate-400">{rec.normalHours > 0 ? rec.normalHours : '-'}</td>
                  <td className="p-1.5 text-center font-mono text-orange-600">{rec.ot134 > 0 ? rec.ot134.toFixed(2) : '-'}</td>
                  <td className="p-1.5 text-center font-mono text-orange-600">{rec.ot167 > 0 ? rec.ot167.toFixed(2) : '-'}</td>
                  <td className="p-1.5 text-[10px] truncate max-w-[120px]">
                    {rec.note && String(rec.note).includes('調移') ? (
                      <span className="text-indigo-600 font-bold">{rec.note}</span>
                    ) : (
                      <span className="text-slate-400">{rec.note}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-800 text-white font-bold">
                <td colSpan={3} className="p-1.5 text-right">總計:</td>
                <td className="p-1.5 text-center">{((report.total_work_hours ?? 0) + onlineHours).toFixed(2)}</td>
                <td className="p-1.5 text-center">{((report.normal_hours ?? 0) + onlineHours).toFixed(2)}</td>
                <td className="p-1.5 text-center text-orange-400">{total134 > 0 ? total134.toFixed(2) : '-'}</td>
                <td className="p-1.5 text-center text-orange-400">{total167 > 0 ? total167.toFixed(2) : '-'}</td>
                <td className="p-1.5 text-[10px] font-normal opacity-70">
                  * 超時: {(report.period_ot_hours ?? 0).toFixed(2)} hr
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
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