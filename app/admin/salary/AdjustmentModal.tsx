'use client';

import React from 'react';

type AdjustmentModalProps = {
  staff: any;
  adjustments: Record<string, any[]>;
  selectedMonth: string;
  modifyAdjustment: (
    staffId: string,
    type: 'bonus' | 'deduction',
    action: 'add' | 'update' | 'remove',
    id?: number,
    field?: string,
    value?: any
  ) => void;
  onClose: () => void;
};

// 簡易版 X icon（沿用原 CalculatorView 內的樣式）
const XIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export default function AdjustmentModal({
  staff,
  adjustments,
  selectedMonth,
  modifyAdjustment,
  onClose,
}: AdjustmentModalProps) {
  if (!staff) return null;

  const staffId = String(staff.staff_id);

  const bonusItems = (adjustments[staffId] || []).filter(
    (a: any) => a.type === 'bonus'
  );
  const deductionItems = (adjustments[staffId] || []).filter(
    (a: any) => a.type === 'deduction'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="font-bold text-lg text-slate-800">
            {staff.staff_name} - 本月獎懲調整
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:bg-slate-100 p-1 rounded"
          >
            <XIcon />
          </button>
        </div>

        {/* 獎金區 */}
        <div className="mb-6 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-emerald-800 text-sm">獎金加項 (+)</h4>
            <button
              onClick={() => modifyAdjustment(staffId, 'bonus', 'add')}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded shadow-sm hover:bg-emerald-700 font-bold"
            >
              + 新增獎金
            </button>
          </div>
          <div className="space-y-2">
            {bonusItems.map((adj: any) => (
              <div key={adj.id} className="flex gap-2 items-center">
                <input
                  value={adj.name}
                  onChange={(e) =>
                    modifyAdjustment(
                      staffId,
                      'bonus',
                      'update',
                      adj.id,
                      'name',
                      e.target.value
                    )
                  }
                  className="border p-2 rounded w-1/2 text-sm bg-white"
                  placeholder="獎金名稱"
                />
                <input
                  type="number"
                  value={adj.amount}
                  onChange={(e) =>
                    modifyAdjustment(
                      staffId,
                      'bonus',
                      'update',
                      adj.id,
                      'amount',
                      Number(e.target.value)
                    )
                  }
                  className="border p-2 rounded w-1/3 text-sm text-right font-mono bg-white"
                  placeholder="金額"
                />
                <button
                  onClick={() =>
                    modifyAdjustment(staffId, 'bonus', 'remove', adj.id)
                  }
                  className="text-red-400 hover:text-red-600 p-2"
                >
                  <XIcon />
                </button>
              </div>
            ))}
            {bonusItems.length === 0 && (
              <div className="text-xs text-emerald-600/60">目前無本月獎金項目</div>
            )}
          </div>
        </div>

        {/* 扣款區 */}
        <div className="mb-6 bg-red-50/50 p-4 rounded-lg border border-red-100">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-red-800 text-sm">扣款減項 (-)</h4>
            <button
              onClick={() => modifyAdjustment(staffId, 'deduction', 'add')}
              className="text-xs bg-red-600 text-white px-3 py-1.5 rounded shadow-sm hover:bg-red-700 font-bold"
            >
              + 新增扣款
            </button>
          </div>
          <div className="space-y-2">
            {deductionItems.map((adj: any) => (
              <div key={adj.id} className="flex gap-2 items-center">
                <input
                  value={adj.name}
                  onChange={(e) =>
                    modifyAdjustment(
                      staffId,
                      'deduction',
                      'update',
                      adj.id,
                      'name',
                      e.target.value
                    )
                  }
                  className="border p-2 rounded w-1/2 text-sm bg-white"
                  placeholder="扣款名稱"
                />
                <input
                  type="number"
                  value={adj.amount}
                  onChange={(e) =>
                    modifyAdjustment(
                      staffId,
                      'deduction',
                      'update',
                      adj.id,
                      'amount',
                      Number(e.target.value)
                    )
                  }
                  className="border p-2 rounded w-1/3 text-sm text-right font-mono bg-white"
                  placeholder="金額"
                />
                <button
                  onClick={() =>
                    modifyAdjustment(staffId, 'deduction', 'remove', adj.id)
                  }
                  className="text-red-400 hover:text-red-600 p-2"
                >
                  <XIcon />
                </button>
              </div>
            ))}
            {deductionItems.length === 0 && (
              <div className="text-xs text-red-600/60">目前無本月扣款項目</div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="bg-slate-900 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-black transition"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}

