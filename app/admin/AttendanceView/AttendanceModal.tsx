'use client';

import React from 'react';
import { X, Save, Pencil, Plus, AlertCircle } from 'lucide-react';

type Staff = {
  id: string; // UUID
  name: string;
  role?: string | null;
};

type FormData = {
  staffId: string;
  workType: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  staffList: Staff[];
  editingLogId: number | null;
  handleManualSubmit: () => void;
  isSubmitting: boolean;
};

const AttendanceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  staffList,
  editingLogId,
  handleManualSubmit,
  isSubmitting,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            {editingLogId ? (
              <Pencil className="text-orange-600" size={20} />
            ) : (
              <Plus className="text-blue-600" size={20} />
            )}
            {editingLogId ? '修改打卡紀錄' : '補登打卡紀錄'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {editingLogId && (
            <div className="bg-orange-50 text-orange-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              若是忘記打卡下班，請填寫正確下班時間並儲存。
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">
              員工姓名
            </label>
            <select
              value={formData.staffId}
              onChange={(e) =>
                setFormData({ ...formData, staffId: e.target.value })
              }
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              disabled={!!editingLogId}
            >
              <option value="" disabled>
                請選擇員工
              </option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role || '無'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">
                日期
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">
                班別類型
              </label>
              <select
                value={formData.workType}
                onChange={(e) =>
                  setFormData({ ...formData, workType: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="正常班">正常班</option>
                <option value="加班">加班</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">
                上班時間
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-600 mb-1">
                下班時間
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) =>
                  setFormData({ ...formData, endTime: e.target.value })
                }
                className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-600 mb-1">
              備註 (Note)
            </label>
            <input
              type="text"
              value={formData.note}
              onChange={(e) =>
                setFormData({ ...formData, note: e.target.value })
              }
              placeholder="例：忘記帶手機補登、補休調整..."
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition"
          >
            取消
          </button>
          <button
            onClick={handleManualSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={18} />
            {isSubmitting ? '處理中...' : editingLogId ? '更新紀錄' : '確認新增'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceModal;

