'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, DollarSign, FileText, Save, Wand2, X } from 'lucide-react';

// 年度特休帳本資料結構
// days: 應休 (Quota)
// manual_*: 手動補登（系統上線前或特殊調整）
// system_*: 系統自動統計（請假紀錄與結算紀錄）
type AnnualLeaveItem = {
  year: string;
  days: number;              // 應休 (Quota)
  manual_used: number;       // 手動已休 (Manual Used)
  manual_settled: number;    // 手動結算 (Manual Settled)
  system_used?: number;      // 系統已休 (唯讀)
  system_settled?: number;   // 系統結算 (唯讀)
  note?: string;
};

type LeaveHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  staff: any | null;
  onSaved?: () => void;
};

// 依台灣勞基法（簡化版）計算特休天數（週年制）
// years: 已滿年資（整數年）
const calculateTaiwanLeaveByYears = (years: number): number => {
  if (years < 0.5) return 0;
  if (years < 1) return 3;        // 滿 0.5 年
  if (years < 2) return 7;        // 滿 1 年
  if (years < 3) return 10;       // 滿 2 年
  if (years < 5) return 14;       // 滿 3–4 年
  if (years < 10) return 15;      // 滿 5–9 年
  // 10 年以上：每一年加 1 天，上限 30 天
  const extra = Math.min(15, Math.floor(years) - 9); // 年資 10 年 => +1，最終上限 15+15=30
  return 15 + extra;
};

export default function LeaveHistoryModal({
  isOpen,
  onClose,
  staff,
  onSaved,
}: LeaveHistoryModalProps) {
  const [annualLeaveHistory, setAnnualLeaveHistory] = useState<AnnualLeaveItem[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newLeaveYear, setNewLeaveYear] = useState('');
  const [newLeaveDays, setNewLeaveDays] = useState('');
  const [newLeaveNote, setNewLeaveNote] = useState('');

  const totalBalance = useMemo(() => {
    return annualLeaveHistory.reduce((sum, item) => {
      const days = Number(item.days ?? 0);
      const used =
        Number(item.manual_used ?? 0) + Number(item.system_used ?? 0);
      const settled =
        Number(item.manual_settled ?? 0) + Number(item.system_settled ?? 0);
      const balance = days - used - settled;
      return sum + balance;
    }, 0);
  }, [annualLeaveHistory]);

  // 當 Modal 開啟且有員工資料時載入歷史資料
  useEffect(() => {
    const fetchDetails = async () => {
      if (!isOpen || !staff) return;
      setLoading(true);

      try {
        // 透過 leave stats 詳細模式取得完整帳本資料
        const res = await fetch(
          `/api/leave/stats?action=details&staff_id=${staff.staff_id}`,
        );
        const result = await res.json();

        if (result.error) {
          console.error('Leave history details error:', result.error);
          alert('載入特休帳本失敗');
          return;
        }

        const data = result.data || {};
        const historyArray: Array<{ year: number; days: number; note?: string | null }> =
          data.history_array || [];
        const usageByYear: Record<string, number> = data.usage_by_year || {};
        const settledByYear: Record<string, number> = data.settled_by_year || {};
        const settlementsList: any[] = data.settlements || [];

        // 整合所有出現過的年度
        const yearSet = new Set<string>();
        historyArray.forEach((h: any) => {
          if (h.year) yearSet.add(String(h.year));
        });
        Object.keys(usageByYear).forEach((y) => yearSet.add(String(y)));
        Object.keys(settledByYear).forEach((y) => yearSet.add(String(y)));
        settlementsList.forEach((s: any) => {
          // 若歷史與統計都沒有，但有結算紀錄，也加進年度
          let baseDate: Date | null = null;
          if (s.pay_month) {
            baseDate = new Date(`${s.pay_month}-01T00:00:00`);
          } else if (s.created_at) {
            baseDate = new Date(s.created_at);
          }
          if (baseDate && !Number.isNaN(baseDate.getTime())) {
            yearSet.add(baseDate.getFullYear().toString());
          }
        });

        const rows: AnnualLeaveItem[] = Array.from(yearSet)
          .map((year) => {
            const base = historyArray.find(
              (h: any) => String(h.year) === String(year),
            );
            const quota = Number(base?.days ?? 0);
            const systemUsed = Number(usageByYear[year] ?? 0);
            const systemSettled = Number(settledByYear[year] ?? 0);

            return {
              year: String(year),
              days: quota,
              manual_used: 0,
              manual_settled: 0,
              system_used: systemUsed,
              system_settled: systemSettled,
              note: base?.note ?? '',
            };
          })
          .sort((a, b) => b.year.localeCompare(a.year)); // 由新到舊

        setAnnualLeaveHistory(rows);
        setSettlements(settlementsList);
      } catch (error) {
        console.error('Fetch history error:', error);
        alert('載入資料失敗');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [isOpen, staff]);

  const resetStateAndClose = () => {
    setAnnualLeaveHistory([]);
    setSettlements([]);
    setNewLeaveYear('');
    setNewLeaveDays('');
    setNewLeaveNote('');
    onClose();
  };

  const handleSaveAnnualLeaveHistory = async () => {
    if (!staff) return;

    // 儲存為新版標準格式：[{ year, days, note }]
    const historyArrayToSave = annualLeaveHistory
      .filter((item) => item.year && item.days !== undefined && item.days !== null)
      .map((item) => ({
        year: Number(item.year),
        days: Number(item.days),
        note: item.note?.trim() || null,
      }));

    try {
      const response = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staff.staff_id,
          annual_leave_history:
            historyArrayToSave.length > 0 ? historyArrayToSave : null,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert('儲存成功！');
        if (onSaved) onSaved();
      } else {
        alert('儲存失敗: ' + result.message);
      }
    } catch (error) {
      console.error('Save annual leave history error:', error);
      alert('儲存失敗');
    }
  };

  const handleAddLeaveYear = () => {
    const year = newLeaveYear.trim();
    const days = Number(newLeaveDays);

    if (!year || !days || days <= 0) {
      alert('請輸入有效的年份和天數');
      return;
    }

    const existingIndex = annualLeaveHistory.findIndex(
      (item) => item.year === year,
    );

    if (existingIndex >= 0) {
      const newList = [...annualLeaveHistory];
      newList[existingIndex] = {
        ...newList[existingIndex],
        year,
        days,
        note: newLeaveNote,
      };
      setAnnualLeaveHistory(newList);
    } else {
      const newList: AnnualLeaveItem[] = [
        ...annualLeaveHistory,
        {
          year,
          days,
          manual_used: 0,
          manual_settled: 0,
          system_used: 0,
          system_settled: 0,
          note: newLeaveNote,
        },
      ];
      newList.sort((a, b) => b.year.localeCompare(a.year)); // 由新到舊排序
      setAnnualLeaveHistory(newList);
    }

    setNewLeaveYear('');
    setNewLeaveDays('');
    setNewLeaveNote('');
  };

  const handleRemoveLeaveYear = (index: number) => {
    const newList = [...annualLeaveHistory];
    newList.splice(index, 1);
    setAnnualLeaveHistory(newList);
  };

  // 依到職日自動試算年度特休額度（週年制）
  const handleAutoCalculateFromStartDate = () => {
    if (!staff?.start_date) {
      alert('此員工尚未設定到職日，無法自動試算特休。');
      return;
    }

    try {
      const startDate = new Date(staff.start_date);
      if (Number.isNaN(startDate.getTime())) {
        alert('到職日格式有誤，無法自動試算。');
        return;
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const lastYearToGenerate = currentYear + 1; // 終止條件：不產生超過「明年」的年度

      // 工具函式：安全加月份 / 年數（不改動原始 Date）
      const addMonths = (date: Date, months: number) => {
        const d = new Date(date.getTime());
        const targetMonth = d.getMonth() + months;
        d.setMonth(targetMonth);
        return d;
      };

      const addYears = (date: Date, years: number) => {
        const d = new Date(date.getTime());
        d.setFullYear(d.getFullYear() + years);
        return d;
      };

      // 計算週年制特休天數（僅依「滿 n 年」）
      const getQuotaByFullYears = (n: number): number => {
        if (n === 1) return 7;
        if (n === 2) return 10;
        if (n === 3 || n === 4) return 14;
        if (n >= 5 && n <= 9) return 15;
        if (n >= 10) {
          return Math.min(30, 15 + (n - 9));
        }
        return 0;
      };

      // 先複製一份，以便保留手動資料
      const newList: AnnualLeaveItem[] = [...annualLeaveHistory];

      // 工具函式：判斷同年度且同天數是否已存在（避免重複產生）
      const existsSameYearAndDays = (yearLabel: string, days: number) =>
        newList.some(
          (item) =>
            item.year === yearLabel && Number(item.days ?? 0) === Number(days),
        );

      // 1) 滿半年特休：3 天
      const halfYearDate = addMonths(startDate, 6);
      if (!Number.isNaN(halfYearDate.getTime())) {
        const halfYearYear = halfYearDate.getFullYear();
        // 若已發生且不超過「明年」，就產生一筆
        if (halfYearYear <= lastYearToGenerate) {
          const yearLabel = String(halfYearYear);
          const days = 3;

          if (!existsSameYearAndDays(yearLabel, days)) {
            newList.push({
              year: yearLabel,
              days,
              manual_used: 0,
              manual_settled: 0,
              system_used: 0,
              system_settled: 0,
              note: '滿半年特休 (週年制)',
            });
          }
        }
      }

      // 2) 滿 n 週年特休（n = 1 起算）
      for (let n = 1; n <= 50; n++) {
        const anniversaryDate = addYears(startDate, n);
        if (Number.isNaN(anniversaryDate.getTime())) break;

        const annivYear = anniversaryDate.getFullYear();
        if (annivYear > lastYearToGenerate) {
          // 超過明年就停止產生
          break;
        }

        const days = getQuotaByFullYears(n);
        if (days <= 0) continue;

        const yearLabel = String(annivYear);

        if (existsSameYearAndDays(yearLabel, days)) {
          // 已有同年度同天數資料（可能是手動或先前自動產生），不重複新增
          continue;
        }

        newList.push({
          year: yearLabel,
          days,
          manual_used: 0,
          manual_settled: 0,
          system_used: 0,
          system_settled: 0,
          note: `滿 ${n} 年特休 (週年制)`,
        });
      }

      newList.sort((a, b) => b.year.localeCompare(a.year));
      setAnnualLeaveHistory(newList);
    } catch (e) {
      console.error('Auto calculate error:', e);
      alert('自動試算時發生錯誤');
    }
  };

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <FileText size={24} /> 特休歷年詳情與設定
            </h3>
            <p className="text-blue-100 mt-1">{staff.staff_name}</p>
          </div>
          <button
            onClick={resetStateAndClose}
            className="p-2 hover:bg-white/20 rounded-full transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400">載入中...</div>
          ) : (
            <>
              {/* 上方：年度帳本 */}
              <div className="bg-teal-50 rounded-xl p-6 border border-teal-200">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                  <div className="flex flex-col gap-1">
                    <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <Calendar className="text-teal-600" /> 年度特休帳本
                    </h4>
                    <div className="text-xs text-teal-700">
                      計算依據：
                      <span className="font-bold">
                        {staff?.calculation_system === 'calendar' ? '曆年制 (目前僅展示，試算仍採週年制)' : '週年制'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-sm text-teal-800 font-bold">
                      帳本總剩餘：
                      <span className="text-xl ml-1">
                        {totalBalance.toFixed(1)} 天
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAutoCalculateFromStartDate}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white text-teal-700 border border-teal-300 hover:bg-teal-50 transition"
                    >
                      <Wand2 size={14} />
                      🪄 依照到職日自動試算
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm bg-white rounded-lg overflow-hidden border">
                    <thead className="bg-teal-100 text-teal-900 font-bold">
                      <tr>
                        <th className="p-2 text-left">年度</th>
                        <th className="p-2 text-right">應休天數</th>
                        <th className="p-2 text-right">實際已休</th>
                        <th className="p-2 text-right">已結算</th>
                        <th className="p-2 text-right">剩餘</th>
                        <th className="p-2 text-center">狀態</th>
                        <th className="p-2 text-left">備註</th>
                        <th className="p-2 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-100">
                      {annualLeaveHistory.length > 0 ? (
                        annualLeaveHistory.map((item, index) => {
                          const days = Number(item.days ?? 0);
                          const totalUsed =
                            Number(item.manual_used ?? 0) + Number(item.system_used ?? 0);
                          const totalSettled =
                            Number(item.manual_settled ?? 0) + Number(item.system_settled ?? 0);
                          const balance =
                            Math.round((days - totalUsed - totalSettled) * 100) / 100;
                          const isCleared = balance <= 0;

                          return (
                            <tr key={item.year} className="hover:bg-teal-50/60 transition">
                              <td className="p-2 font-bold text-slate-800">{item.year}</td>
                              <td className="p-2 text-right">
                                <input
                                  type="number"
                                  value={item.days}
                                  min={0}
                                  step={0.5}
                                  className="w-20 p-1.5 border rounded text-right font-mono"
                                  onChange={(e) => {
                                    const daysVal = Number(e.target.value) || 0;
                                    const newList = [...annualLeaveHistory];
                                    newList[index] = {
                                      ...item,
                                      days: daysVal,
                                    };
                                    setAnnualLeaveHistory(newList);
                                  }}
                                />
                              </td>
                              <td className="p-2 text-right font-mono">
                                {totalUsed.toFixed(1)}
                              </td>
                              <td className="p-2 text-right font-mono text-orange-700">
                                {totalSettled.toFixed(1)}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-green-700">
                                {balance.toFixed(1)}
                              </td>
                              <td className="p-2 text-center">
                                {isCleared ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                    ✅ 已結清
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                    ⚠️ 未結清
                                  </span>
                                )}
                              </td>
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={item.note ?? ''}
                                  onChange={(e) => {
                                    const newList = [...annualLeaveHistory];
                                    newList[index] = {
                                      ...item,
                                      note: e.target.value,
                                    };
                                    setAnnualLeaveHistory(newList);
                                  }}
                                  className="w-full p-1.5 border rounded text-xs"
                                  placeholder="備註 (選填)"
                                />
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => handleRemoveLeaveYear(index)}
                                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded flex items-center gap-1 mx-auto"
                                >
                                  <X size={14} /> 刪除
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-4 text-center text-slate-400 text-sm"
                          >
                            尚無特休紀錄，請先新增年度設定。
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 新增年度 */}
                <div className="border-t border-teal-200 pt-4 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        年度
                      </label>
                      <input
                        type="number"
                        value={newLeaveYear}
                        onChange={(e) => setNewLeaveYear(e.target.value)}
                        className="w-full p-2 border rounded bg-white"
                        placeholder="例：2024"
                        min="2000"
                        max="2100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        應休天數
                      </label>
                      <input
                        type="number"
                        value={newLeaveDays}
                        onChange={(e) => setNewLeaveDays(e.target.value)}
                        className="w-full p-2 border rounded bg-white"
                        placeholder="例：7"
                        min="0"
                        step="0.5"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-600 mb-1">
                        備註
                      </label>
                      <input
                        type="text"
                        value={newLeaveNote}
                        onChange={(e) => setNewLeaveNote(e.target.value)}
                        className="w-full p-2 border rounded bg-white"
                        placeholder="例如：依勞基法給予"
                      />
                    </div>
                    <div className="flex md:justify-end">
                      <button
                        onClick={handleAddLeaveYear}
                        className="w-full md:w-auto px-4 py-2 bg-teal-600 text-white rounded font-bold text-sm hover:bg-teal-700 transition whitespace-nowrap"
                      >
                        加入年度
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveAnnualLeaveHistory}
                    className="mt-4 w-full px-4 py-2.5 bg-slate-800 text-white rounded-lg font-bold hover:bg-black transition flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> 儲存年度設定
                  </button>
                </div>
              </div>

              {/* 下方：結算與調整紀錄 */}
              <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <DollarSign className="text-purple-600" /> 結算與調整紀錄
                </h4>

                <div className="overflow-x-auto">
                  {settlements.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-white text-slate-600 font-bold">
                        <tr>
                          <th className="p-2 text-left">結算日期</th>
                          <th className="p-2 text-right">天數</th>
                          <th className="p-2 text-right">金額</th>
                          <th className="p-2 text-center">發放月份</th>
                          <th className="p-2 text-center">狀態</th>
                          <th className="p-2 text-left">備註</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-100">
                        {settlements.map((settle: any) => (
                          <tr
                            key={settle.id}
                            className="bg-white hover:bg-purple-50 transition"
                          >
                            <td className="p-2 font-mono text-xs text-slate-600">
                              {settle.created_at
                                ? new Date(settle.created_at).toLocaleDateString('zh-TW')
                                : '-'}
                            </td>
                            <td className="p-2 text-right font-bold text-slate-800">
                              {settle.days} 天
                            </td>
                            <td className="p-2 text-right font-bold text-green-600">
                              ${settle.amount?.toLocaleString() || '0'}
                            </td>
                            <td className="p-2 text-center font-mono text-xs text-slate-600">
                              {settle.pay_month || '-'}
                            </td>
                            <td className="p-2 text-center">
                              <span
                                className={`px-2 py-1 rounded text-xs font-bold ${
                                  settle.status === 'processed'
                                    ? 'bg-green-100 text-green-700'
                                    : settle.status === 'pending'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {settle.status === 'processed'
                                  ? '已處理'
                                  : settle.status === 'pending'
                                  ? '待處理'
                                  : settle.status || '-'}
                              </span>
                            </td>
                            <td
                              className="p-2 text-xs text-slate-500 max-w-xs truncate"
                              title={settle.notes}
                            >
                              {settle.notes || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      尚無結算紀錄
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

