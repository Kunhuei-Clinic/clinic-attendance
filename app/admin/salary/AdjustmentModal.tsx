'use client';

import React, { useState } from 'react';

type AdjustmentModalProps = {
  staff: any;
  adjustments: Record<string, any[]>;
  lastMonthAdjustments: Record<string, any[]>;
  selectedMonth: string;
  onSaveComplete: () => void;
  onClose: () => void;
};

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export default function AdjustmentModal({ staff, adjustments, lastMonthAdjustments, selectedMonth, onSaveComplete, onClose }: AdjustmentModalProps) {
  const staffId = String(staff.staff_id);
  // 🟢 將資料複製一份到本地狀態，並智能繼承上個月項目（同名 0 元）
  const [localItems, setLocalItems] = useState<any[]>(() => {
    const currentItems = (adjustments[staffId] || []).map(a => ({ ...a, isNew: false, isDeleted: false, isEdited: false }));
    const prevItems = lastMonthAdjustments[staffId] || [];

    const existingNames = new Set(currentItems.map(i => i.name));
    prevItems.forEach(p => {
      if (!existingNames.has(p.name)) {
        currentItems.push({
          id: Date.now() + Math.random(),
          staff_id: staffId,
          year_month: selectedMonth,
          type: p.type,
          name: p.name,
          amount: 0,
          isNew: true
        });
      }
    });
    return currentItems;
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = (type: 'bonus' | 'deduction') => {
    setLocalItems([...localItems, {
      id: Date.now() + Math.random(),
      staff_id: staffId,
      year_month: selectedMonth,
      type,
      name: type === 'bonus' ? '本月獎金' : '本月扣款',
      amount: 0,
      isNew: true
    }]);
  };

  const handleUpdate = (id: number, field: string, value: any) => {
    setLocalItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value, isEdited: true } : item));
  };

  const handleRemove = (id: number) => {
    setLocalItems(prev => prev.map(item => item.id === id ? { ...item, isDeleted: true } : item));
  };

  // 🟢 點擊「完成」時，才一次性將變更送往後端
  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const item of localItems) {
        if (item.isDeleted && !item.isNew) {
          await fetch(`/api/salary/adjustments?id=${item.id}`, { method: 'DELETE' });
        } else if (item.isNew && !item.isDeleted) {
          await fetch('/api/salary/adjustments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staff_id: staffId, year_month: selectedMonth, type: item.type, name: item.name, amount: item.amount }),
          });
        } else if (item.isEdited && !item.isDeleted) {
          await fetch('/api/salary/adjustments', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, field: 'name', value: item.name }),
          });
          await fetch('/api/salary/adjustments', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id, field: 'amount', value: item.amount }),
          });
        }
      }
      onSaveComplete();
    } catch (error) {
      alert('儲存失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const activeBonus = localItems.filter(a => a.type === 'bonus' && !a.isDeleted);
  const activeDeduction = localItems.filter(a => a.type === 'deduction' && !a.isDeleted);

  const handleQuickAddOnlineHours = () => {
    const input = window.prompt('請輸入本月線上諮詢總時數：');
    if (input === null || input.trim() === '') return;
    const hours = parseFloat(input.trim());
    if (isNaN(hours) || hours <= 0) {
      alert('請輸入有效的正數時數');
      return;
    }
    const hourlyRate = staff.online_hourly_rate ?? (staff.salary_mode === 'monthly'
      ? (staff.base_salary ?? 0) / 240
      : (staff.base_salary ?? 0));
    const rate = Number(hourlyRate) || 0;
    if (rate <= 0) {
      alert('請先在薪資設定中設定本薪或線上諮詢時薪');
      return;
    }
    const amount = Math.round(hours * rate);
    setLocalItems(prev => [...prev, {
      id: Date.now() + Math.random(),
      staff_id: staffId,
      year_month: selectedMonth,
      type: 'bonus',
      name: `線上諮詢 (${hours} 小時)`,
      amount,
      isNew: true,
    }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="font-bold text-lg text-slate-800">{staff.staff_name} - 本月獎懲調整</h3>
          <button onClick={onClose} className="text-slate-400 hover:bg-slate-100 p-1 rounded"><XIcon /></button>
        </div>

        {/* 獎金區 */}
        <div className="mb-6 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <h4 className="font-bold text-emerald-800 text-sm">獎金加項 (+)</h4>
            <div className="flex items-center gap-2">
              {/* 🟢 僅對線上諮詢人員顯示此按鈕 */}
              {staff.work_rule === 'online_consultation' && (
                <button
                  type="button"
                  onClick={handleQuickAddOnlineHours}
                  className="text-xs py-1.5 px-3 rounded border-2 border-indigo-300 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 transition"
                >
                  ⚡ 快速補登線上工時
                </button>
              )}
              <button onClick={() => handleAdd('bonus')} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded shadow-sm hover:bg-emerald-700 font-bold">+ 新增獎金</button>
            </div>
          </div>
          <div className="space-y-2">
            {activeBonus.map(adj => (
              <div key={adj.id} className="flex gap-2 items-center">
                <input value={adj.name} onChange={e => handleUpdate(adj.id, 'name', e.target.value)} className="border p-2 rounded w-1/2 text-sm bg-white" placeholder="獎金名稱"/>
                <input type="number" value={adj.amount} onChange={e => handleUpdate(adj.id, 'amount', Number(e.target.value))} className="border p-2 rounded w-1/3 text-sm text-right font-mono bg-white" placeholder="金額"/>
                <button onClick={() => handleRemove(adj.id)} className="text-red-400 hover:text-red-600 p-2"><XIcon /></button>
              </div>
            ))}
          </div>
        </div>

        {/* 扣款區 */}
        <div className="mb-6 bg-red-50/50 p-4 rounded-lg border border-red-100">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-red-800 text-sm">扣款減項 (-)</h4>
            <button onClick={() => handleAdd('deduction')} className="text-xs bg-red-600 text-white px-3 py-1.5 rounded shadow-sm hover:bg-red-700 font-bold">+ 新增扣款</button>
          </div>
          <div className="space-y-2">
            {activeDeduction.map(adj => (
              <div key={adj.id} className="flex gap-2 items-center">
                <input value={adj.name} onChange={e => handleUpdate(adj.id, 'name', e.target.value)} className="border p-2 rounded w-1/2 text-sm bg-white" placeholder="扣款名稱"/>
                <input type="number" value={adj.amount} onChange={e => handleUpdate(adj.id, 'amount', Number(e.target.value))} className="border p-2 rounded w-1/3 text-sm text-right font-mono bg-white" placeholder="金額"/>
                <button onClick={() => handleRemove(adj.id)} className="text-red-400 hover:text-red-600 p-2"><XIcon /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-black transition disabled:opacity-50">
            {isSaving ? '儲存中...' : '儲存並完成'}
          </button>
        </div>
      </div>
    </div>
  );
}
