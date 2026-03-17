'use client';
import React, { useState, useEffect } from 'react';
import { Settings, X, DollarSign } from 'lucide-react';

// 🟢 只引入薪資相關的 2 個積木
import SalaryStrategyPanel from '../settings/staff/SalaryStrategyPanel';
import FixedAdjustmentsPanel from '../settings/staff/FixedAdjustmentsPanel';

export default function SettingsModal({ staff, onClose, onSaveSuccess }: any) {
  const [localStaff, setLocalStaff] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (staff) {
      setLocalStaff({
        ...staff,
        bonuses: staff.bonuses || [],
        default_deductions: staff.default_deductions || []
      });
    }
  }, [staff]);

  if (!staff || !localStaff) return null;

  // 🟢 共用的資料更新函數
  const handleChange = (field: string, value: any) => {
    setLocalStaff((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localStaff),
      });
      const json = await res.json();
      if (json.success !== false) {
        onSaveSuccess?.();
        onClose();
      } else {
        alert('儲存失敗: ' + (json.message || json.error || '未知錯誤'));
      }
    } catch (error: any) {
      alert('儲存失敗: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-50 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

        <div className="bg-slate-800 text-white p-5 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Settings size={20} className="text-blue-400" />
            {localStaff.name} 的快速薪資設定
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition"><X size={20} /></button>
        </div>

        {/* 內容區塊 (直接渲染薪資積木) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50/50 p-3 rounded-lg text-sm text-blue-800 border border-blue-100 flex items-center gap-2">
            <DollarSign size={16} /> 這裡的修改會同步更新至該員工的人事基本檔中。
          </div>

          <SalaryStrategyPanel data={localStaff} onChange={handleChange} />
          <FixedAdjustmentsPanel data={localStaff} onChange={handleChange} />
        </div>

        <div className="bg-white p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">取消</button>
          <button onClick={handleSave} disabled={isSaving} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-black transition shadow-md disabled:opacity-50">
            {isSaving ? '處理中...' : '完成設定'}
          </button>
        </div>
      </div>
    </div>
  );
}

