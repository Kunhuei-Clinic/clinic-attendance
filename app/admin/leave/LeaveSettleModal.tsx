'use client';

import React, { useEffect, useState } from 'react';
import { DollarSign, X } from 'lucide-react';

type LeaveSettleForm = {
  days: number;
  pay_month: string;
  notes: string;
  target_year?: string;
};

type LeaveSettleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  staff: any | null;
  onSubmit: (form: LeaveSettleForm) => Promise<void> | void;
  defaultDays?: number;
  defaultPayMonth?: string;
  // 新增：針對特定年度結算
  targetYear?: string; // 例如 "2024"
  maxDays?: number; // 該年度剩餘天數
};

export default function LeaveSettleModal({
  isOpen,
  onClose,
  staff,
  onSubmit,
  defaultDays,
  defaultPayMonth,
  targetYear,
  maxDays,
}: LeaveSettleModalProps) {
  const [form, setForm] = useState<LeaveSettleForm>({
    days: 0,
    pay_month: new Date().toISOString().slice(0, 7),
    notes: '',
  });

  // 根據選定員工、年度與預設值初始化表單
  useEffect(() => {
    if (isOpen && staff) {
      const effectiveMax = maxDays ?? staff.remaining ?? 0;
      const initialDays =
        targetYear != null
          ? (maxDays ?? effectiveMax)
          : ((defaultDays ?? Math.min(effectiveMax, 1)) || 0); // 🟢 已修復括號
      const initialNotes =
        targetYear != null ? `${targetYear}年度特休結算` : '';

      setForm({
        days: initialDays,
        pay_month: defaultPayMonth ?? new Date().toISOString().slice(0, 7),
        notes: initialNotes,
      });
    }
  }, [isOpen, staff, defaultDays, defaultPayMonth, targetYear, maxDays]);

  if (!isOpen || !staff) return null;

  const calculateAmount = () => {
    const baseSalary = staff.base_salary || 0;
    const salaryMode = staff.salary_mode || 'hourly';

    if (salaryMode === 'monthly') {
      // 月薪制：底薪 / 30 * 天數
      return Math.round((baseSalary / 30) * form.days * 100) / 100;
    }
    // 時薪制：時薪 * 8小時 * 天數
    return Math.round(baseSalary * 8 * form.days * 100) / 100;
  };

  const handleSubmitClick = async () => {
    if (form.days <= 0) {
      alert('結算天數必須大於0');
      return;
    }

    const allowedMax = maxDays ?? staff.remaining ?? 0;

    if (form.days > allowedMax) {
      alert(`剩餘特休不足 (剩餘: ${Number(allowedMax).toFixed(1)} 天)`);
      return;
    }

    await onSubmit({
      ...form,
      target_year: targetYear,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="text-green-600" /> 特休結算兌現
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="bg-slate-50 p-4 rounded-lg border">
            <div className="text-sm text-slate-600 mb-2">員工</div>
            <div className="text-lg font-bold text-slate-800">{staff.staff_name}</div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="text-sm text-green-700 mb-1">剩餘特休</div>
            <div className="text-2xl font-bold text-green-700">
              {staff.remaining?.toFixed(1)} 天
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">欲結算天數</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max={maxDays ?? staff.remaining}
              className="w-full p-3 border rounded-lg font-bold text-lg text-center"
              value={form.days}
              onChange={(e) =>
                setForm({
                  ...form,
                  days: Number(e.target.value) || 0,
                })
              }
            />
            <p className="text-xs text-slate-400 mt-1">
              最多可結算 {Number(maxDays ?? staff.remaining ?? 0).toFixed(1)} 天
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">發放月份</label>
            <input
              type="month"
              className="w-full p-3 border rounded-lg font-bold"
              value={form.pay_month}
              onChange={(e) => setForm({ ...form, pay_month: e.target.value })}
            />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-700 mb-1">試算金額</div>
            <div className="text-2xl font-bold text-blue-700">
              ${calculateAmount().toLocaleString()}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {staff.salary_mode === 'monthly' ? (
                <>
                  計算公式: (月薪 {staff.base_salary?.toLocaleString() || 0} ÷ 30) ×{' '}
                  {form.days} 天
                </>
              ) : (
                <>
                  計算公式: (時薪 {staff.base_salary?.toLocaleString() || 0} × 8小時) ×{' '}
                  {form.days} 天
                </>
              )}
            </div>
            <div className="text-[10px] text-blue-500 mt-1 opacity-80">
              薪資模式: {staff.salary_mode === 'monthly' ? '月薪制' : '時薪制'}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">
              備註 (選填)
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              placeholder="例如：員工申請結算"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded"
          >
            取消
          </button>
          <button
            onClick={handleSubmitClick}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold flex items-center gap-2"
          >
            <DollarSign size={18} /> 確認結算
          </button>
        </div>
      </div>
    </div>
  );
}

