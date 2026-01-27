'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, DollarSign, FileText, Save, X } from 'lucide-react';

type AnnualLeaveItem = {
  year: string;
  days: number;
  used?: number;
  settled?: number;
  balance?: number;
  note?: string;
};

type LeaveHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  staff: any | null;
  onSaved?: () => void;
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

  const totalBalance = useMemo(
    () => annualLeaveHistory.reduce((sum, item) => sum + (item.balance ?? 0), 0),
    [annualLeaveHistory],
  );

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
            const used = Number(usageByYear[year] ?? 0);
            const settled = Number(settledByYear[year] ?? 0);
            const balance = Math.round((quota - used - settled) * 100) / 100;

            return {
              year: String(year),
              days: quota,
              used,
              settled,
              balance,
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

    const used = 0;
    const settled = 0;
    const balance = days - used - settled;

    if (existingIndex >= 0) {
      const newList = [...annualLeaveHistory];
      newList[existingIndex] = { ...newList[existingIndex], year, days, note: newLeaveNote, balance };
      setAnnualLeaveHistory(newList);
    } else {
      const newList = [
        ...annualLeaveHistory,
        { year, days, used, settled, balance, note: newLeaveNote },
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
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="text-teal-600" /> 年度特休帳本
                  </h4>
                  <div className="text-sm text-teal-800 font-bold">
                    帳本總剩餘：
                    <span className="text-xl ml-1">
                      {totalBalance.toFixed(1)} 天
                    </span>
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
                          const balance = item.balance ??
                            Math.round(
                              (Number(item.days ?? 0) - Number(item.used ?? 0) - Number(item.settled ?? 0)) *
                                100,
                            ) / 100;
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
                                    const days = Number(e.target.value);
                                    const newList = [...annualLeaveHistory];
                                    const used = Number(item.used ?? 0);
                                    const settled = Number(item.settled ?? 0);
                                    const newBalance =
                                      Math.round((days - used - settled) * 100) / 100;
                                    newList[index] = {
                                      ...item,
                                      days,
                                      balance: newBalance,
                                    };
                                    setAnnualLeaveHistory(newList);
                                  }}
                                />
                              </td>
                              <td className="p-2 text-right font-mono">
                                {Number(item.used ?? 0).toFixed(1)}
                              </td>
                              <td className="p-2 text-right font-mono text-orange-700">
                                {Number(item.settled ?? 0).toFixed(1)}
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

