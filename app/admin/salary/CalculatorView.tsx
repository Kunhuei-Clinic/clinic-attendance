// CalculatorView.tsx
'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Settings, FileText, Clock, AlertCircle } from 'lucide-react';

const XIcon = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>;

export default function CalculatorView({ reports, adjustments, modifyAdjustment, staffList, onOpenSettings, isArchived, onPrint }: any) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 text-slate-500 text-sm font-bold uppercase tracking-wider border-b border-slate-200">
          <tr>
            <th className="p-4 pl-6">員工資訊</th>
            <th className="p-4">工時 / 應發項目</th>
            <th className="p-4">扣款項目</th>
            <th className="p-4">本月調整 (Adjustments)</th>
            <th className="p-4 text-right">實發金額 (Net)</th>
            <th className="p-4 text-center">功能</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {reports.map((rpt: any, idx: number) => {
             const staffId = staffList?.find((s:any) => s.name === rpt.staff_name)?.id;
             const myAdjustments = adjustments?.[staffId] || [];
             const myBonuses = myAdjustments.filter((a:any) => a.type === 'bonus');
             const myDeductions = myAdjustments.filter((a:any) => a.type === 'deduction');
             const hasWarning = rpt.warnings.length > 0;

             return (
              <React.Fragment key={idx}>
                <tr className={`hover:bg-slate-50 transition group ${expandedRow === idx ? 'bg-slate-50' : ''}`}>
                  <td className="p-4 pl-6 align-top min-w-[160px]">
                    <div className="flex items-center gap-2 mb-1">
                       <div className="font-bold text-slate-800 text-lg">{rpt.staff_name}</div>
                       {!isArchived && onOpenSettings && staffId && (
                         <button onClick={(e) => { e.stopPropagation(); onOpenSettings(staffId); }} className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600">
                           <Settings size={14}/>
                         </button>
                       )}
                    </div>
                    <div className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-bold mb-1">
                        {rpt.salary_mode === 'monthly' ? '月薪' : '時薪'} • {rpt.work_rule === 'normal' ? '正常工時' : rpt.work_rule}
                    </div>
                    {hasWarning && (
                        <div className="text-[10px] text-red-600 flex items-center gap-1 mt-1 font-bold animate-pulse">
                            <AlertTriangle size={10}/> 考勤異常
                        </div>
                    )}
                  </td>
                  <td className="p-4 align-top space-y-1.5 min-w-[180px]">
                    <div className="font-mono text-blue-700 font-bold text-base">應發: ${rpt.gross_pay.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div className="flex justify-between w-32"><span>本薪:</span> <span>${rpt.base_pay.toLocaleString()}</span></div>
                      <div className="flex justify-between w-32"><span>加班:</span> <span>${(rpt.ot_pay + rpt.holiday_pay).toLocaleString()}</span></div>
                      {rpt.leave_addition > 0 && <div className="flex justify-between w-32 text-blue-600"><span>請假給薪:</span> <span>${rpt.leave_addition}</span></div>}
                      <div className="flex justify-between w-32"><span>固定津貼:</span> <span>${rpt.fixed_bonus_pay.toLocaleString()}</span></div>
                    </div>
                  </td>
                  <td className="p-4 align-top space-y-1.5 min-w-[180px]">
                    <div className="font-mono text-red-700 font-bold text-base">應扣: ${rpt.total_deduction.toLocaleString()}</div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <div className="flex justify-between w-32"><span>勞健保:</span> <span>${(rpt.insurance_labor + rpt.insurance_health).toLocaleString()}</span></div>
                      <div className="flex justify-between w-32"><span>固定扣項:</span> <span>${rpt.fixed_deduction_pay.toLocaleString()}</span></div>
                      {rpt.leave_deduction > 0 && <div className="flex justify-between w-32 text-red-500"><span>請假扣款:</span> <span>-${rpt.leave_deduction}</span></div>}
                    </div>
                  </td>
                  <td className="p-4 align-top min-w-[240px]">
                    {!isArchived && modifyAdjustment && staffId ? (
                      <div className="flex flex-col gap-2">
                         {/* 獎金區 */}
                         <div className="bg-white p-1.5 rounded border border-green-100 shadow-sm">
                            {myBonuses.map((b:any)=>(
                               <div key={b.id} className="flex gap-1 mb-1 items-center">
                                  <input value={b.name} onChange={(e)=>modifyAdjustment(staffId, 'bonus', 'update', b.id, 'name', e.target.value)} className="w-20 text-[10px] border border-slate-200 rounded p-1 text-slate-600"/>
                                  <input type="number" value={b.amount} onChange={(e)=>modifyAdjustment(staffId, 'bonus', 'update', b.id, 'amount', Number(e.target.value))} className="w-16 text-[10px] border border-slate-200 rounded p-1 text-right font-mono"/>
                                  <button onClick={()=>modifyAdjustment(staffId, 'bonus', 'remove', b.id)} className="text-slate-300 hover:text-red-500"><XIcon/></button>
                               </div>
                            ))}
                            <button onClick={()=>modifyAdjustment(staffId, 'bonus', 'add')} className="text-[10px] text-green-600 w-full text-left hover:bg-green-50 p-1 rounded transition flex items-center gap-1 font-bold">+ 新增獎金</button>
                         </div>
                         {/* 扣款區 */}
                         <div className="bg-white p-1.5 rounded border border-red-100 shadow-sm">
                            {myDeductions.map((b:any)=>(
                               <div key={b.id} className="flex gap-1 mb-1 items-center">
                                  <input value={b.name} onChange={(e)=>modifyAdjustment(staffId, 'deduction', 'update', b.id, 'name', e.target.value)} className="w-20 text-[10px] border border-slate-200 rounded p-1 text-slate-600"/>
                                  <input type="number" value={b.amount} onChange={(e)=>modifyAdjustment(staffId, 'deduction', 'update', b.id, 'amount', Number(e.target.value))} className="w-16 text-[10px] border border-slate-200 rounded p-1 text-right font-mono text-red-600"/>
                                  <button onClick={()=>modifyAdjustment(staffId, 'deduction', 'remove', b.id)} className="text-slate-300 hover:text-red-500"><XIcon/></button>
                               </div>
                            ))}
                            <button onClick={()=>modifyAdjustment(staffId, 'deduction', 'add')} className="text-[10px] text-red-600 w-full text-left hover:bg-red-50 p-1 rounded transition flex items-center gap-1 font-bold">+ 新增扣款</button>
                         </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 py-2">
                        {rpt.temp_bonus_pay > 0 && <div className="text-green-600">+ 變動獎金: ${rpt.temp_bonus_pay}</div>}
                        {rpt.temp_deduction_pay > 0 && <div className="text-red-600">- 變動扣款: ${rpt.temp_deduction_pay}</div>}
                        {rpt.temp_bonus_pay === 0 && rpt.temp_deduction_pay === 0 && <span className="text-slate-300">無調整項目</span>}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-right align-top">
                    <span className="font-bold text-2xl text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-200 block whitespace-nowrap shadow-sm">
                      ${rpt.net_pay.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-4 text-center align-top">
                    <div className="flex flex-col gap-2 items-center">
                        <button 
                        onClick={() => onPrint(rpt)} 
                        className="w-full py-1.5 px-3 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition flex items-center justify-center gap-2 text-xs font-bold shadow-sm"
                        >
                        <FileText size={14}/> 薪資單
                        </button>
                        
                        <button 
                            onClick={() => setExpandedRow(expandedRow === idx ? null : idx)} 
                            className={`w-full py-1.5 px-3 rounded-lg transition text-xs font-bold flex items-center justify-center gap-1 ${expandedRow === idx ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
                        >
                            {expandedRow === idx ? <><ChevronUp size={14}/> 收起</> : <><ChevronDown size={14}/> 明細</>}
                        </button>
                    </div>
                  </td>
                </tr>
                {/* 展開明細區域 */}
                {expandedRow === idx && (
                   <tr className="bg-slate-50 shadow-inner">
                     <td colSpan={6} className="p-6">
                        {/* 1. 每日考勤表 */}
                        <div className="mb-6">
                            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Clock size={16}/> 每日考勤與工時計算</h4>
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-100 text-slate-500 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="p-2 text-left">日期</th>
                                            <th className="p-2 text-center">類型</th>
                                            <th className="p-2 text-left text-blue-600">班表時間</th>
                                            <th className="p-2 text-left text-slate-600">實際打卡</th>
                                            <th className="p-2 text-center font-bold">總時數</th>
                                            <th className="p-2 text-center text-slate-400">正常</th>
                                            <th className="p-2 text-center text-orange-600">x1.34</th>
                                            <th className="p-2 text-center text-orange-600">x1.67</th>
                                            <th className="p-2 text-left">異常/備註</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {(rpt.dailyRecords || []).map((d:any, i:number) => (
                                            <tr key={i} className="hover:bg-blue-50/50">
                                                <td className="p-2 font-mono text-slate-600">{d.date ? String(d.date).slice(5) : '-'}</td>
                                                <td className="p-2 text-center">
                                                    {d.dayType==='holiday' && <span className="text-red-500 font-bold">國定</span>}
                                                    {d.dayType==='rest' && <span className="text-green-600 font-bold">休息</span>}
                                                    {d.dayType==='regular' && <span className="text-red-600 font-bold">例假</span>}
                                                    {d.dayType==='normal' && <span className="text-slate-400">平日</span>}
                                                </td>
                                                <td className="p-2 font-mono text-blue-600">{d.shiftInfo || '-'}</td>
                                                <td className="p-2 font-mono text-slate-700">{d.clockIn} ~ {d.clockOut}</td>
                                                <td className="p-2 text-center font-bold text-slate-800">{d.totalHours}</td>
                                                <td className="p-2 text-center text-slate-400">{d.normalHours||'-'}</td>
                                                <td className="p-2 text-center text-orange-600 font-bold">{d.ot134>0?d.ot134.toFixed(1):'-'}</td>
                                                <td className="p-2 text-center text-orange-600 font-bold">{d.ot167>0?d.ot167.toFixed(1):'-'}</td>
                                                <td className="p-2 text-red-500 font-bold">{d.note}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 2. 彙總資訊 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-white p-4 border border-blue-100 rounded-xl shadow-sm">
                              <strong className="text-blue-700 block mb-3 border-b border-blue-100 pb-2 flex items-center gap-2"><AlertCircle size={14}/> 應發明細彙總 (+)</strong>
                              <ul className="space-y-2 text-sm text-slate-600">
                                 <li className="flex justify-between"><span>本薪 ({rpt.normal_hours}hr):</span> <span className="font-mono font-bold">${rpt.base_pay}</span></li>
                                 <li className="flex justify-between"><span>平日加班 ({rpt.normal_ot_hours}hr):</span> <span className="font-mono">${calculateTieredOt(rpt.normal_ot_hours, Math.round(rpt.base_pay/240))}</span></li>
                                 <li className="flex justify-between"><span>休息日/國定 ({rpt.rest_work_hours + rpt.holiday_work_hours}hr):</span> <span className="font-mono">${rpt.ot_pay + rpt.holiday_pay}</span></li>
                                 {rpt.period_ot_hours > 0 && <li className="flex justify-between text-orange-600 font-bold"><span>週期總量超時 ({rpt.period_ot_hours.toFixed(1)}hr):</span> <span>(已計入加班)</span></li>}
                                 {(rpt.bonus_details || []).map((b:any, i:number) => (
                                     <li key={i} className="flex justify-between text-green-700"><span>[津貼] {b.name}:</span> <span className="font-mono">${b.amount}</span></li>
                                 ))}
                              </ul>
                           </div>
                           <div className="bg-white p-4 border border-red-100 rounded-xl shadow-sm">
                              <strong className="text-red-700 block mb-3 border-b border-red-100 pb-2 flex items-center gap-2"><AlertCircle size={14}/> 應扣明細彙總 (-)</strong>
                              <ul className="space-y-2 text-sm text-slate-600">
                                 <li className="flex justify-between"><span>勞保自付:</span> <span className="font-mono">${rpt.insurance_labor}</span></li>
                                 <li className="flex justify-between"><span>健保自付:</span> <span className="font-mono">${rpt.insurance_health}</span></li>
                                 <li className="flex justify-between"><span>固定扣項:</span> <span className="font-mono">${rpt.fixed_deduction_pay}</span></li>
                                 {(rpt.deduction_details || []).map((b:any, i:number) => (
                                     <li key={i} className="flex justify-between text-red-600"><span>[扣款] {b.name}:</span> <span className="font-mono">${b.amount}</span></li>
                                 ))}
                              </ul>
                           </div>
                        </div>
                     </td>
                   </tr>
                )}
              </React.Fragment>
             );
          })}
        </tbody>
      </table>
    </div>
  );
}
