'use client';

import React from 'react';
import { TrendingUp, DollarSign, FileText } from 'lucide-react';

type LeaveStatsTableProps = {
  stats: any[];
  loading: boolean;
  onOpenHistory: (stat: any) => void;
  onOpenSettle: (stat: any) => void;
  onRefresh?: () => void;
};

// 由 start_date 計算年資（與 stats API 週年制一致）
function yearsFromStartDate(startDate: string | null | undefined): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  const years = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.round(years * 100) / 100;
}

export default function LeaveStatsTable({
  stats,
  loading,
  onOpenHistory,
  onOpenSettle,
  onRefresh,
}: LeaveStatsTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <TrendingUp size={18} /> 特休統計與結算
        </h3>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
          >
            重新整理
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-600 text-sm font-bold">
            <tr>
              <th className="p-4">員工</th>
              <th className="p-4">到職日</th>
              <th className="p-4 text-center">年資</th>
              <th className="p-4 text-center">制度</th>
              <th className="p-4 text-right">法定天數</th>
              <th className="p-4 text-right">已休</th>
              <th className="p-4 text-right">已結算</th>
              <th className="p-4 text-right font-bold text-green-600">剩餘</th>
              <th className="p-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  載入中...
                </td>
              </tr>
            ) : stats.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  無資料
                </td>
              </tr>
            ) : (
              stats.map((stat: any) => {
                const years = stat.years_of_service ?? yearsFromStartDate(stat.start_date);
                const quota = stat.quota ?? stat.entitlement ?? 0;
                const used = Number(stat.used) ?? 0;
                const settled = Number(stat.settled) ?? 0;
                const remaining = Number(stat.remaining) ?? 0;
                return (
                  <tr key={stat.staff_id} className="hover:bg-slate-50 transition">
                    <td className="p-4 font-bold text-slate-800">{stat.staff_name}</td>
                    <td className="p-4 font-mono text-slate-600">{stat.start_date || '-'}</td>
                    <td className="p-4 text-center font-mono">
                      {years != null ? `${Number(years).toFixed(1)} 年` : '-'}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700">
                        週年制
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold">
                      {Number(quota).toFixed(1)}
                    </td>
                    <td className="p-4 text-right font-mono">{Number(used).toFixed(1)}</td>
                    <td className="p-4 text-right font-mono text-orange-600">
                      {Number(settled).toFixed(1)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-green-600 text-lg">
                      {Number(remaining).toFixed(1)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onOpenHistory(stat)}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1"
                          title="查看歷年詳情與設定"
                        >
                          <FileText size={14} /> 歷年詳情
                        </button>
                        {remaining > 0 && (
                          <button
                            // 🟢 核心改變：不再呼叫外層的 onOpenSettle，而是統一打開歷年詳情 (存摺)
                            // 目前做法：彈出提示，並自動帶入員工存摺畫面，讓老闆在存摺中選擇要結算哪一年度
                            onClick={() => {
                              alert('為確保資料正確性，請在「歷年詳情」存摺中點擊對應年度進行結算。');
                              onOpenHistory(stat);
                            }}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition flex items-center gap-1"
                          >
                            <DollarSign size={14} /> 結算兌現
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

