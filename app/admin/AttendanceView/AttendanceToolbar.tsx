'use client';

import React, { useState } from 'react';
import {
  Clock,
  User,
  Calendar as CalendarIcon,
  ToggleLeft,
  ToggleRight,
  FileSpreadsheet,
  Plus,
  Briefcase,
  ScanLine,
  Trash2,
  ChevronDown,
} from 'lucide-react';

type Staff = {
  id: string; // UUID
  name: string;
  role?: string | null;
};

type Props = {
  useDateFilter: boolean;
  setUseDateFilter: (value: boolean) => void;
  startDate: string;
  endDate: string;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  uniqueRoles: string[];
  selectedRole: string;
  setSelectedRole: (value: string) => void;
  selectedStaffId: string;
  setSelectedStaffId: (value: string) => void;
  filteredStaffList: Staff[];
  totalHours: number;
  writeTimeFilter: string;
  setWriteTimeFilter: (value: string) => void;
  selectedCount: number;
  onBatchDelete: () => void;
  isSubmitting?: boolean;
  onAddClick: () => void;
  onOpenOcr: () => void;
  onExportCSV: () => void;
  onExportTimecard: () => void;
  onExportFullMonth: () => void;
};

const AttendanceToolbar: React.FC<Props> = ({
  useDateFilter,
  setUseDateFilter,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  uniqueRoles,
  selectedRole,
  setSelectedRole,
  selectedStaffId,
  setSelectedStaffId,
  filteredStaffList,
  totalHours,
  writeTimeFilter,
  setWriteTimeFilter,
  selectedCount,
  onBatchDelete,
  isSubmitting,
  onAddClick,
  onOpenOcr,
  onExportCSV,
  onExportTimecard,
  onExportFullMonth,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 shrink-0">
          <Clock className="text-blue-600" /> 考勤紀錄
        </h2>
        <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>

        <button
          onClick={() => setUseDateFilter(!useDateFilter)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition ${
            useDateFilter
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          {useDateFilter ? (
            <ToggleRight size={20} className="text-blue-600" />
          ) : (
            <ToggleLeft size={20} className="text-slate-400" />
          )}
          日期篩選
        </button>

        {useDateFilter && (
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm animate-fade-in">
            <CalendarIcon size={16} className="text-slate-400 ml-1" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none"
            />
            <span className="text-slate-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none"
            />
          </div>
        )}

        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm w-40">
          <Briefcase size={16} className="text-slate-400 ml-1" />
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setSelectedStaffId('all');
            }}
            className="bg-transparent font-bold text-slate-700 outline-none w-full"
          >
            <option value="all">所有職位</option>
            {uniqueRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm w-40">
          <User size={16} className="text-slate-400 ml-1" />
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="bg-transparent font-bold text-slate-700 outline-none w-full"
          >
            <option value="all">所有員工</option>
            {filteredStaffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 🟢 新增：寫入時間篩選器 */}
        <div className="flex items-center gap-2 bg-orange-50 p-1.5 rounded-lg border border-orange-200 text-sm w-44">
          <Clock size={16} className="text-orange-500 ml-1" />
          <select
            value={writeTimeFilter}
            onChange={(e) => setWriteTimeFilter(e.target.value)}
            className="bg-transparent font-bold text-orange-800 outline-none w-full"
          >
            <option value="all">所有建檔時間</option>
            <option value="1h">剛匯入 (1小時內)</option>
            <option value="today">今日匯入/建檔</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        {/* 🟢 新增：當有選取項目時，浮現批次刪除按鈕 */}
        {selectedCount > 0 && (
          <button
            onClick={onBatchDelete}
            disabled={isSubmitting}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm animate-fade-in disabled:opacity-50"
          >
            <Trash2 size={18} /> 批次刪除 ({selectedCount})
          </button>
        )}

        <button
          onClick={onAddClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
        >
          <Plus size={18} /> 補登打卡
        </button>
        <button
          onClick={onOpenOcr}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
        >
          <ScanLine size={18} /> 實體卡 OCR 辨識
        </button>

        <div className="text-right hidden sm:block">
          <span className="block text-xs text-slate-400">總工時合計</span>
          <span className="text-xl font-bold text-blue-600 font-mono">
            {totalHours.toFixed(1)} <span className="text-sm">hr</span>
          </span>
        </div>

        {/* 🟢 匯出報表下拉選單（避免擠滿工具列） */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm shadow-sm"
          >
            <FileSpreadsheet size={18} /> 匯出報表 <ChevronDown size={16} />
          </button>

          {showExportMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowExportMenu(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-20 animate-fade-in">
                <button
                  onClick={() => {
                    onExportCSV();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 transition flex items-center gap-2"
                >
                  📄 匯出標準 CSV 總表
                </button>
                <button
                  onClick={() => {
                    onExportTimecard();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 transition flex items-center gap-2"
                >
                  📅 匯出打卡表 (排班格式)
                </button>
                <button
                  onClick={() => {
                    onExportFullMonth();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition flex items-center gap-2"
                >
                  👤 匯出單人全月表格
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceToolbar;

