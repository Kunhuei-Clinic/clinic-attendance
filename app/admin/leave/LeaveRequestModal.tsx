'use client';

import React, { useEffect, useState } from 'react';

// 🟢 中文假別列表 (供新增時選單使用)
const LEAVE_OPTIONS = ['事假', '病假', '特休', '補休', '公假', '喪假', '婚假', '產假'];

type LeaveRequestForm = {
  staff_id: string;
  type: string;
  date: string;
  start_time: string;
  end_time: string;
  hours: number;
  reason: string;
};

type LeaveRequestModalProps = {
  isOpen: boolean;
  onClose: () => void;
  staffList: any[];
  onSubmit: (data: LeaveRequestForm) => Promise<void> | void;
};

export default function LeaveRequestModal({
  isOpen,
  onClose,
  staffList,
  onSubmit,
}: LeaveRequestModalProps) {
  const [formData, setFormData] = useState<LeaveRequestForm>({
    staff_id: '',
    type: '事假',
    date: new Date().toISOString().slice(0, 10),
    start_time: '09:00',
    end_time: '18:00',
    hours: 8,
    reason: '',
  });

  // 自動計算時數
  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      const s = new Date(`2000-01-01T${formData.start_time}`);
      const e = new Date(`2000-01-01T${formData.end_time}`);
      const diff = (e.getTime() - s.getTime()) / 3600000;
      if (diff > 0) {
        setFormData((prev) => ({ ...prev, hours: diff }));
      }
    }
  }, [formData.start_time, formData.end_time]);

  // 每次打開時重置表單
  useEffect(() => {
    if (isOpen) {
      setFormData({
        staff_id: '',
        type: '事假',
        date: new Date().toISOString().slice(0, 10),
        start_time: '09:00',
        end_time: '18:00',
        hours: 8,
        reason: '',
      });
    }
  }, [isOpen]);

  // 🟢 UUID 防呆：確保預設有合法的 UUID，否則後端會報錯
  useEffect(() => {
    if (isOpen && staffList && staffList.length > 0) {
      setFormData((prev) => ({
        ...prev,
        staff_id: prev.staff_id || staffList[0].id,
      }));
    }
  }, [isOpen, staffList]);

  if (!isOpen) return null;

  const handleSubmitClick = async () => {
    if (!formData.staff_id) {
      alert('請選擇員工！');
      return;
    }
    await onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold mb-4">新增請假單 (管理員代填)</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">員工</label>
            <select
              className="w-full p-2 border rounded"
              value={formData.staff_id}
              onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
            >
              <option value="">請選擇...</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.entity === 'pharmacy' ? '藥局' : '診所'})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">日期</label>
              <input
                type="date"
                className="w-full p-2 border rounded"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">假別</label>
              <select
                className="w-full p-2 border rounded"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                {LEAVE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">開始</label>
              <input
                type="time"
                className="w-full p-2 border rounded text-sm"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">結束</label>
              <input
                type="time"
                className="w-full p-2 border rounded text-sm"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">時數</label>
              <input
                type="number"
                step="0.5"
                className="w-full p-2 border rounded font-bold"
                value={formData.hours}
                onChange={(e) =>
                  setFormData({ ...formData, hours: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">事由</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              placeholder="選填"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded"
          >
            取消
          </button>
          <button
            onClick={handleSubmitClick}
            className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-black font-bold"
          >
            送出
          </button>
        </div>
      </div>
    </div>
  );
}

