'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Settings,
  FileText,
  Clock,
  AlertCircle,
} from 'lucide-react';

type SalaryRowProps = {
  rpt: any;
  staffList: any[];
  lockEmployee: (rpt: any) => void;
  unlockEmployee: (historyId: string | number) => void;
  onOpenSettings?: (staffId: string) => void;
  onPrint: (rpt: any) => void;
  setAdjModalStaff: (staff: any) => void;
};

export default function SalaryRow({
  rpt,
  staffList,
  lockEmployee,
  unlockEmployee,
  onOpenSettings,
  onPrint,
  setAdjModalStaff,
}: SalaryRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleLock = async () => {
    setIsProcessing(true);
    try {
      await lockEmployee(rpt);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleUnlock = async () => {
    setIsProcessing(true);
    try {
      await unlockEmployee(rpt.history_id);
    } finally {
      setIsProcessing(false);
    }
  };

  const staffId =
    rpt.staff_id ||
    staffList?.find((s: any) => s.name === rpt.staff_name)?.id;
  const isLocked = !!rpt.is_locked;
  const hasWarning = rpt.warnings?.length > 0;

  return (
    <>
      <tr
        className={`hover:bg-slate-50 transition group ${
          isExpanded ? 'bg-slate-50' : ''
        }`}
      >
        {/* 員工資訊 */}
        <td className="p-4 pl-6 align-top min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="font-bold text-slate-800 text-lg">
              {rpt.staff_name}
            </div>
            {isLocked ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                已核對/封存
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                草稿
              </span>
            )}
            {!isLocked && onOpenSettings && staffId && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSettings(String(staffId));
                }}
                className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-blue-600"
              >
                <Settings size={14} />
              </button>
            )}
          </div>
          <div className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-xs font-bold mb-1">
            {rpt.salary_mode === 'monthly' ? '月薪' : '時薪'} •{' '}
            {rpt.work_rule === 'normal' ? '正常工時' : rpt.work_rule}
          </div>
          {hasWarning && (
            <div className="text-[10px] text-red-600 flex items-center gap-1 mt-1 font-bold animate-pulse">
              <AlertTriangle size={10} /> 考勤異常
            </div>
          )}
        </td>

        {/* 應發項目 */}
        <td className="p-4 align-top space-y-1.5 min-w-[180px]">
          <div className="font-mono text-blue-700 font-bold text-base">
            應發: ${rpt.gross_pay.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 space-y-0.5">
            <div className="flex justify-between w-40">
              <span>本薪:</span>{' '}
              <span>${rpt.base_pay.toLocaleString()}</span>
            </div>
            <div className="flex justify-between w-40">
              <span>加班:</span>{' '}
              <span>${(rpt.ot_pay + rpt.holiday_pay).toLocaleString()}</span>
            </div>
            {rpt.leave_addition > 0 && (
              <div className="flex justify-between w-40 text-blue-600">
                <span>請假給薪:</span> <span>${rpt.leave_addition}</span>
              </div>
            )}
            <div className="flex justify-between w-40">
              <span>固定津貼:</span>{' '}
              <span>${rpt.fixed_bonus_pay.toLocaleString()}</span>
            </div>
          </div>
        </td>

        {/* 應扣項目 */}
        <td className="p-4 align-top space-y-1.5 min-w-[180px]">
          <div className="font-mono text-red-700 font-bold text-base">
            應扣: ${rpt.total_deduction.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 space-y-0.5">
            <div className="flex justify-between w-40">
              <span>勞保自付:</span>
              <span>${rpt.insurance_labor.toLocaleString()}</span>
            </div>
            <div className="flex justify-between w-40">
              <span>健保自付:</span>
              <span>${rpt.insurance_health.toLocaleString()}</span>
            </div>
            <div className="flex justify-between w-40">
              <span>固定扣項:</span>
              <span>${rpt.fixed_deduction_pay.toLocaleString()}</span>
            </div>
            {rpt.leave_deduction > 0 && (
              <div className="flex justify-between w-40 text-red-500">
                <span>請假扣款:</span>{' '}
                <span>-{rpt.leave_deduction}</span>
              </div>
            )}
          </div>
        </td>

        {/* 變動獎懲（僅顯示總額，不再 inline 編輯） */}
        <td className="p-4 align-top min-w-[200px]">
          <div className="space-y-1 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>本月變動獎金合計:</span>
              <span className="font-mono font-bold text-emerald-700">
                +${(rpt.temp_bonus_pay || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span>本月變動扣款合計:</span>
              <span className="font-mono font-bold text-red-600">
                -${(rpt.temp_deduction_pay || 0).toLocaleString()}
              </span>
            </div>
            {!rpt.temp_bonus_pay && !rpt.temp_deduction_pay && (
              <div className="text-slate-300">無變動獎懲項目</div>
            )}
          </div>
        </td>

        {/* 實發金額 */}
        <td className="p-4 text-right align-top">
          <span className="font-bold text-2xl text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-200 block whitespace-nowrap shadow-sm">
            ${rpt.net_pay.toLocaleString()}
          </span>
        </td>

        {/* 功能區 */}
        <td className="p-4 text-center align-top">
          <div className="flex flex-col gap-2 items-center">
            {/* 鎖定 / 解除封存 */}
            {isLocked ? (
              <button
                onClick={handleUnlock}
                disabled={isProcessing}
                className="w-full py-1.5 px-3 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? '處理中...' : '🔓 解除封存'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleLock}
                  disabled={isProcessing}
                  className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? '處理中...' : '🔒 封存此筆'}
                </button>
                <button
                  onClick={() => setAdjModalStaff(rpt)}
                  className="w-full py-1.5 px-3 rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 text-xs font-bold transition flex items-center justify-center gap-1"
                >
                  ✏️ 調整獎懲
                </button>
              </>
            )}

            {/* 薪資單 */}
            <button
              onClick={() => onPrint(rpt)}
              className="w-full py-1.5 px-3 bg-white border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition flex items-center justify-center gap-2 text-xs font-bold shadow-sm"
            >
              <FileText size={14} /> 薪資單
            </button>

            {/* 明細展開 */}
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className={`w-full py-1.5 px-3 rounded-lg transition text-xs font-bold flex items-center justify-center gap-1 ${
                isExpanded
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-100'
              }`}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={14} /> 收起
                </>
              ) : (
                <>
                  <ChevronDown size={14} /> 明細
                </>
              )}
            </button>
          </div>
        </td>
      </tr>

      {/* 展開明細區域 */}
      {isExpanded && (
        <tr className="bg-slate-50 shadow-inner">
          <td colSpan={6} className="p-6">
            {/* 1. 每日考勤表 */}
            <div className="mb-6">
              <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                <Clock size={16} /> 每日考勤與工時計算
              </h4>
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
                    {(rpt.dailyRecords || []).map((d: any, i: number) => (
                      <tr key={i} className="hover:bg-blue-50/50">
                        <td className="p-2 font-mono text-slate-600">
                          {d.date ? String(d.date).slice(5) : '-'}
                        </td>
                        <td className="p-2 text-center">
                          {d.dayType === 'holiday' && (
                            <span className="text-red-500 font-bold">國定</span>
                          )}
                          {d.dayType === 'rest' && (
                            <span className="text-green-600 font-bold">休息</span>
                          )}
                          {d.dayType === 'regular' && (
                            <span className="text-red-600 font-bold">例假</span>
                          )}
                          {d.dayType === 'normal' && (
                            <span className="text-slate-400">平日</span>
                          )}
                        </td>
                        <td className="p-2 font-mono text-blue-600">
                          {d.shiftInfo || '-'}
                        </td>
                        <td className="p-2 font-mono text-slate-700">
                          {d.clockIn} {d.clockOut ? `~ ${d.clockOut}` : ''}
                        </td>
                        <td className="p-2 text-center font-bold text-slate-800">
                          {d.totalHours}
                        </td>
                        <td className="p-2 text-center text-slate-400">
                          {d.normalHours || '-'}
                        </td>
                        <td className="p-2 text-center text-orange-600 font-bold">
                          {d.ot134 > 0 ? d.ot134.toFixed(2) : '-'}
                        </td>
                        <td className="p-2 text-center text-orange-600 font-bold">
                          {d.ot167 > 0 ? d.ot167.toFixed(2) : '-'}
                        </td>
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
                <strong className="text-blue-700 block mb-3 border-b border-blue-100 pb-2 flex items-center gap-2">
                  <AlertCircle size={14} /> 應發明細彙總 (+)
                </strong>
                <ul className="space-y-2 text-sm text-slate-600">
                  {rpt.salary_mode === 'hourly' ? (
                    <>
                      <li className="flex justify-between">
                        <span>總計工時 ({rpt.total_work_hours}hr):</span>
                        <span className="font-mono font-bold">${rpt.base_pay}</span>
                      </li>
                      <li className="flex justify-between">
                        <span>加班加成 ({(rpt.normal_ot_hours ?? 0) + (rpt.rest_work_hours ?? 0)}hr):</span>
                        <span className="font-mono">${rpt.ot_pay}</span>
                      </li>
                      {rpt.holiday_pay > 0 && (
                        <li className="flex justify-between text-blue-600">
                          <span>國定假日加成:</span>
                          <span className="font-mono">${rpt.holiday_pay}</span>
                        </li>
                      )}
                    </>
                  ) : (
                    <>
                      <li className="flex justify-between">
                        <span>本薪 (月薪):</span>
                        <span className="font-mono font-bold">${rpt.base_pay}</span>
                      </li>
                      <li className="flex justify-between text-slate-600">
                        <span>加班費 ({(rpt.normal_ot_hours ?? 0) + (rpt.rest_work_hours ?? 0)}hr @ ${Math.round(rpt.base_pay / 240)}):</span>
                        <span className="font-mono">${rpt.ot_pay}</span>
                      </li>
                      {rpt.holiday_pay > 0 && (
                        <li className="flex justify-between text-blue-600">
                          <span>國定假日出勤:</span>
                          <span className="font-mono">${rpt.holiday_pay}</span>
                        </li>
                      )}
                    </>
                  )}
                  {rpt.period_ot_hours > 0 && (
                    <li className="flex justify-between text-orange-600 font-bold">
                      <span>
                        週期總量超時 ({rpt.period_ot_hours.toFixed(2)}hr):
                      </span>
                      <span>(已計入加班)</span>
                    </li>
                  )}
                  {(rpt.fixed_bonus_details || []).map((b: any, i: number) => (
                    <li key={`f-${i}`} className="flex justify-between text-slate-600"><span>[固定] {b.name}:</span> <span className="font-mono">${b.amount}</span></li>
                  ))}
                  {(rpt.temp_bonus_details || []).map((b: any, i: number) => (
                    <li key={`t-${i}`} className="flex justify-between text-green-700">
                      <span>
                        [變動] {b.name}
                        {String(b.name || '').includes('線上諮詢') && (
                          <span className="block text-[10px] text-slate-500 font-normal">時數已載明於項目名稱，供勞檢備查</span>
                        )}
                      </span>
                      <span className="font-mono">${b.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white p-4 border border-red-100 rounded-xl shadow-sm">
                <strong className="text-red-700 block mb-3 border-b border-red-100 pb-2 flex items-center gap-2">
                  <AlertCircle size={14} /> 應扣明細彙總 (-)
                </strong>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex justify-between">
                    <span>勞保自付:</span>
                    <span className="font-mono">${rpt.insurance_labor}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>健保自付:</span>
                    <span className="font-mono">${rpt.insurance_health}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>固定扣項:</span>
                    <span className="font-mono">
                      ${rpt.fixed_deduction_pay}
                    </span>
                  </li>
                  {(rpt.fixed_deduction_details || []).map((b: any, i: number) => (
                    <li key={`fd-${i}`} className="flex justify-between text-slate-600"><span>[固定] {b.name}:</span> <span className="font-mono">${b.amount}</span></li>
                  ))}
                  {(rpt.temp_deduction_details || []).map((b: any, i: number) => (
                    <li key={`td-${i}`} className="flex justify-between text-red-600"><span>[變動] {b.name}:</span> <span className="font-mono">${b.amount}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

