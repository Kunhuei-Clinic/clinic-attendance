'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, DollarSign, FileText, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import LeaveSettleModal from './LeaveSettleModal';

type LeaveHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  staff: any | null;
  onSaved?: () => void;
};

// API 回傳的年度資料結構
type YearSummary = {
  year: number;
  cycle_start: string;
  cycle_end: string;
  quota: number;
  used: number;
  settled: number;
  balance: number;
  status: 'active' | 'expired';
};

// API 回傳的完整資料結構
type LeaveSummaryResponse = {
  staff: {
    id: string; // 🟢 修正為 UUID (string)
    name: string;
    role: string | null;
    start_date: string | null;
  };
  years: YearSummary[];
};

export default function LeaveHistoryModal({
  isOpen,
  onClose,
  staff,
  onSaved,
}: LeaveHistoryModalProps) {
  // 🟢 強制轉換日期格式為 YYYY/MM/DD
  const formatSlashDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    return dateStr.split('T')[0].replace(/-/g, '/');
  };

  const [summaryData, setSummaryData] = useState<LeaveSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedYearForSettle, setSelectedYearForSettle] = useState<YearSummary | null>(null);
  const [leaveDetails, setLeaveDetails] = useState<Record<number, any[]>>({});

  // 🟢 處理特休遞延至次年 (留存稽核軌跡)
  const handleCarryOver = async (yearData: YearSummary) => {
    if (!confirm(`確定要將「滿 ${yearData.year} 年」的剩餘特休 ${yearData.balance} 天，遞延至次年度嗎？\n\n(系統將自動保留此額度，並留下勞資協議遞延的稽核紀錄)`)) return;

    try {
      const res = await fetch('/api/leave/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staff?.staff_id || staff?.id,
          days: 0, // 🟢 遞延不扣除天數，僅留存紀錄
          amount: 0,
          pay_month: new Date().toISOString().slice(0, 7),
          notes: `【法定遞延】滿 ${yearData.year} 年特休遞延至次年`,
          target_year: String(yearData.year)
        })
      });
      if (res.ok) {
        alert('✅ 已成功紀錄遞延！此額度將繼續保留於總餘額中。');
        fetchSummary();
        if (onSaved) onSaved();
      } else {
        alert('❌ 遞延紀錄失敗');
      }
    } catch (e) {
      alert('系統錯誤');
    }
  };

  // 🟢 處理手動微調額度 (期初開帳用)，加入自訂原因
  const handleManualAdjust = async (yearData: YearSummary) => {
    const input = prompt(
      `【期初開帳 / 手動微調】\n目前「滿 ${yearData.year} 年」額度為 ${yearData.quota} 天，已休 ${yearData.used} 天，已結算 ${yearData.settled} 天。\n\n請直接輸入「新的總結算天數」：`,
      String(yearData.settled)
    );

    if (input === null) return;
    const newSettled = parseFloat(input);
    if (isNaN(newSettled) || newSettled < 0) return alert('請輸入有效數字');

    const diff = newSettled - yearData.settled;
    if (diff === 0) return; // 沒有改變就不動作

    // 🟢 讓使用者輸入自訂微調原因
    const reason = prompt(
      '請輸入微調原因：\n(例如：前雇主已結算、系統導入期初開帳等)',
      '期初開帳 / 手動微調'
    );
    if (reason === null) return; // 按取消則中斷

    try {
      const res = await fetch('/api/leave/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staff?.staff_id || staff?.id,
          days: diff,
          pay_month: new Date().toISOString().slice(0, 7),
          notes: reason, // 🟢 寫入自訂原因
          target_year: String(yearData.year)
        })
      });
      if (res.ok) {
        alert('✅ 微調成功！額度已更新。');
        fetchSummary();
        if (onSaved) onSaved();
      } else {
        alert('❌ 微調失敗');
      }
    } catch (e) {
      alert('系統錯誤');
    }
  };

  // 計算目前可休總餘額（所有 active 年度的 balance 總和）
  const currentTotalBalance = useMemo(() => {
    if (!summaryData) return 0;
    return summaryData.years
      .filter((y) => y.status === 'active')
      .reduce((sum, y) => sum + y.balance, 0);
  }, [summaryData]);

  // 計算年資（從到職日到現在）
  const yearsOfService = useMemo(() => {
    if (!summaryData?.staff.start_date) return 0;
    const startDate = new Date(summaryData.staff.start_date);
    const now = new Date();
    const years = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.round(years * 100) / 100;
  }, [summaryData]);

  // 載入特休摘要資料
  const fetchSummary = async () => {
    // 支援 staff_id 或 id 欄位
    const staffId = staff?.staff_id || staff?.id;
    if (!staffId) {
      console.error('LeaveHistoryModal: staff 物件缺少 staff_id 或 id', staff);
      alert('無法取得員工 ID，請重新選擇員工');
      return;
    }
    
    setLoading(true);
    try {
      console.log('LeaveHistoryModal: 開始載入特休摘要，staff_id:', staffId);
      const response = await fetch(`/api/staff/leave-summary?staff_id=${staffId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('LeaveHistoryModal: API 回應錯誤', response.status, errorText);
        alert(`載入失敗 (HTTP ${response.status})`);
        return;
      }
      
      const result = await response.json();
      console.log('LeaveHistoryModal: API 回傳資料', result);

      if (result.error) {
        console.error('Leave summary error:', result.error);
        alert('載入特休摘要失敗: ' + result.error);
        return;
      }

      // 標準化 API 回傳的資料結構（支援 staff_id/staff_name 或 id/name）
      const normalizedResult: LeaveSummaryResponse = {
        staff: {
          id: result.staff?.id || result.staff?.staff_id || staffId,
          name: result.staff?.name || result.staff?.staff_name || staff?.staff_name || staff?.name || '未知',
          role: result.staff?.role || null,
          start_date: result.staff?.start_date || null,
        },
        years: result.years || [],
      };
      
      console.log('LeaveHistoryModal: 標準化後的資料', normalizedResult);
      setSummaryData(normalizedResult);
    } catch (error: any) {
      console.error('Fetch summary error:', error);
      alert('載入資料失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setLoading(false);
    }
  };

  // 載入特定年度的請假明細
  const fetchLeaveDetails = async (year: number, cycleStart: string, cycleEnd: string) => {
    const staffId = staff?.staff_id || staff?.id;
    if (!staffId) return;
    try {
      const response = await fetch(
        `/api/leave?selectedStaffId=${staffId}&statusFilter=approved&useDateFilter=true&startDate=${cycleStart}&endDate=${cycleEnd}`
      );
      const result = await response.json();

      if (result.data) {
        // 只篩選特休類型
        const annualLeaves = result.data.filter(
          (req: any) => req.type === '特休' && req.status === 'approved'
        );
        setLeaveDetails((prev) => ({
          ...prev,
          [year]: annualLeaves,
        }));
      }
    } catch (error) {
      console.error('Fetch leave details error:', error);
    }
  };

  // 當 Modal 開啟時載入資料
  useEffect(() => {
    if (isOpen && staff) {
      fetchSummary();
    }
  }, [isOpen, staff]);

  // 切換年度展開/收合
  const toggleYearExpansion = (year: number, cycleStart: string, cycleEnd: string) => {
    const newExpanded = new Set(expandedYears);
    if (newExpanded.has(year)) {
      newExpanded.delete(year);
    } else {
      newExpanded.add(year);
      // 如果還沒載入過，就載入請假明細
      if (!leaveDetails[year]) {
        fetchLeaveDetails(year, cycleStart, cycleEnd);
      }
    }
    setExpandedYears(newExpanded);
  };

  // 開啟結算模態框
  const handleOpenSettle = (yearData: YearSummary) => {
    if (yearData.balance <= 0) {
      alert('該年度已無剩餘特休可結算');
      return;
    }
    setSelectedYearForSettle(yearData);
    setShowSettleModal(true);
  };

  // 處理結算提交（包含目標年度資訊）
  const handleSettle = async (settleForm: {
    days: number;
    pay_month: string;
    notes: string;
    target_year?: string;
  }) => {
    const staffId = staff?.staff_id || staff?.id;
    if (!staffId || !selectedYearForSettle) return;

    try {
      const response = await fetch('/api/leave/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: staffId,
          days: Number(settleForm.days),
          pay_month: settleForm.pay_month,
          notes:
            settleForm.notes ||
            `${settleForm.target_year ?? selectedYearForSettle.year} 年度特休結算`,
          // 告知後端這筆結算是針對哪一年度的特休
          target_year: settleForm.target_year ?? String(selectedYearForSettle.year),
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert('結算紀錄已建立！');
        setShowSettleModal(false);
        setSelectedYearForSettle(null);
        // 重新載入摘要資料
        await fetchSummary();
        // 如果有 onSaved callback，也觸發它（讓父層更新統計列表）
        if (onSaved) onSaved();
      } else {
        alert('結算失敗: ' + result.message);
      }
    } catch (error) {
      console.error('Settle error:', error);
      alert('結算失敗');
    }
  };

  if (!isOpen || !staff) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-2xl font-bold flex items-center gap-2">
              <FileText size={24} /> 特休自動結算儀表板
            </h3>
            <p className="text-blue-100 mt-1">{staff.staff_name || staff.name || '未知員工'}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchSummary}
              className="p-2 hover:bg-white/20 rounded-full transition"
              title="重新整理"
            >
              <RefreshCw size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-slate-400">載入中...</div>
          ) : !summaryData ? (
            <div className="text-center py-12 text-slate-400">無法載入資料</div>
          ) : (
            <>
              {/* 頂部資訊卡片 */}
              <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-teal-200 shadow-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white/90 p-4 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 font-bold mb-1">到職日期</div>
                    <div className="text-lg font-black text-slate-800">
                      {summaryData.staff.start_date
                        ? new Date(summaryData.staff.start_date).toLocaleDateString('zh-TW', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })
                        : '未設定'}
                    </div>
                  </div>
                  <div className="bg-white/90 p-4 rounded-lg border border-slate-200">
                    <div className="text-xs text-slate-500 font-bold mb-1">年資</div>
                    <div className="text-lg font-black text-slate-800">
                      {yearsOfService.toFixed(1)} 年
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-teal-100 to-blue-100 p-4 rounded-lg border-2 border-teal-300">
                    <div className="text-xs text-teal-700 font-bold mb-1">目前可休總餘額</div>
                    <div className="text-3xl font-black text-teal-700">
                      {currentTotalBalance.toFixed(1)} 天
                    </div>
                  </div>
                </div>
              </div>

              {/* 年度清單表格 */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200">
                  <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="text-teal-600" /> 年度週期清單
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    系統自動計算的週年制特休額度與使用狀況
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-teal-100 text-teal-900 font-bold">
                      <tr>
                        <th className="p-3 text-left">年度/週期</th>
                        <th className="p-3 text-right">法定額度</th>
                        <th className="p-3 text-right">實際已休</th>
                        <th className="p-3 text-right">已結算</th>
                        <th className="p-3 text-right">剩餘</th>
                        <th className="p-3 text-center">狀態</th>
                        <th className="p-3 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summaryData.years.length > 0 ? (
                        summaryData.years.map((y) => {
                          return (
                            <React.Fragment key={y.year}>
                              <tr className="hover:bg-slate-50 transition">
                                {/* 🟢 修正：清楚顯示是滿幾年的特休，以及日期週期 */}
                                <td className="p-4 align-top">
                                  <div className="font-bold text-slate-800 text-sm mb-1">
                                    滿 {y.year} 年特休
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono bg-slate-100 inline-block px-1.5 py-0.5 rounded">
                                    {formatSlashDate(y.cycle_start)} - {formatSlashDate(y.cycle_end)}
                                  </div>
                                </td>
                                <td className="p-4 font-bold text-slate-700 text-center align-top">
                                  {y.quota.toFixed(1)}
                                </td>
                                <td className="p-4 text-orange-600 font-bold text-center align-top">
                                  {y.used.toFixed(1)}
                                </td>
                                <td className="p-4 text-blue-600 font-bold text-center align-top">
                                  {y.settled.toFixed(1)}
                                </td>
                                <td className="p-4 font-black text-emerald-600 text-lg text-center align-top">
                                  {y.balance.toFixed(1)}
                                </td>
                                <td className="p-4 text-center align-top">
                                  <span
                                    className={`px-2 py-1 rounded text-[10px] font-bold ${
                                      y.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-slate-100 text-slate-500'
                                    }`}
                                  >
                                    {y.status === 'active' ? '使用中' : '已到期'}
                                  </span>
                                </td>
                                {/* 🟢 修正：按鈕放大、移除圖示、排版優化 */}
                                <td className="p-4 text-right align-top">
                                  <div className="flex flex-col gap-2 items-end">
                                    {y.balance > 0 && (
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => {
                                            setSelectedYearForSettle(y);
                                            setShowSettleModal(true);
                                          }}
                                          className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold shadow-sm hover:bg-emerald-700 transition-colors"
                                        >
                                          結算
                                        </button>
                                        <button
                                          onClick={() => handleCarryOver(y)}
                                          className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-bold shadow-sm hover:bg-blue-700 transition-colors"
                                        >
                                          遞延
                                        </button>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => handleManualAdjust(y)}
                                      className="text-xs text-slate-500 hover:text-slate-800 underline mt-1 font-bold transition-colors"
                                    >
                                      微調開帳
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 text-sm">
                            {summaryData.staff.start_date
                              ? '尚無特休週期資料'
                              : '請先設定員工到職日期'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 結算模態框 */}
      {showSettleModal && selectedYearForSettle && (
        <LeaveSettleModal
          isOpen={showSettleModal}
          onClose={() => {
            setShowSettleModal(false);
            setSelectedYearForSettle(null);
          }}
          staff={{
            ...staff,
            remaining: selectedYearForSettle.balance,
          }}
          onSubmit={handleSettle}
          defaultDays={selectedYearForSettle.balance}
          defaultPayMonth={`${selectedYearForSettle.year}-${new Date().toISOString().slice(5, 7)}`}
          targetYear={String(selectedYearForSettle.year)}
          maxDays={selectedYearForSettle.balance}
        />
      )}
    </div>
  );
}
