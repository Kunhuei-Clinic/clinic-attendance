'use client';

import React, { useState } from 'react';
import {
  Clock,
  User,
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
  id: string;
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
    <div className="sticky top-2 z-40 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-wrap justify-between items-center gap-3 transition-all mb-4">
      {/* 🔴 左側篩選區 (縮小間距與欄位寬度) */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
          <Clock className="text-blue-600" size={18} /> 考勤紀錄
        </h2>
        <div className="h-5 w-px bg-slate-200 mx-1 hidden md:block"></div>

        <button
          onClick={() => setUseDateFilter(!useDateFilter)}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs font-bold transition ${
            useDateFilter
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}
        >
          {useDateFilter ? (
            <ToggleRight size={16} className="text-blue-600" />
          ) : (
            <ToggleLeft size={16} className="text-slate-400" />
          )}
          時間篩選
        </button>

        {useDateFilter && (
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-md border text-xs animate-fade-in">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none w-24"
            />
            <span className="text-slate-400">~</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none w-24"
            />
          </div>
        )}

        <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-md border text-xs w-28">
          <Briefcase size={14} className="text-slate-400 shrink-0" />
          <select
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setSelectedStaffId('all');
            }}
            className="bg-transparent font-bold text-slate-700 outline-none w-full truncate"
          >
            <option value="all">所有職位</option>
            {uniqueRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5 rounded-md border text-xs w-28">
          <User size={14} className="text-slate-400 shrink-0" />
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="bg-transparent font-bold text-slate-700 outline-none w-full truncate"
          >
            <option value="all">所有員工</option>
            {filteredStaffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-orange-50 px-2 py-1.5 rounded-md border border-orange-200 text-xs w-32">
          <Clock size={14} className="text-orange-500 shrink-0" />
          <select
            value={writeTimeFilter}
            onChange={(e) => setWriteTimeFilter(e.target.value)}
            className="bg-transparent font-bold text-orange-800 outline-none w-full truncate"
          >
            <option value="all">所有建檔時間</option>
            <option value="1h">剛匯入 (1h內)</option>
            <option value="today">今日匯入</option>
          </select>
        </div>
      </div>

      {/* 🔴 右側按鈕區 (縮小 Padding 與字體) */}
      <div className="flex gap-2 items-center">
        {selectedCount > 0 && (
          <button
            onClick={onBatchDelete}
            disabled={isSubmitting}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition text-xs shadow-sm animate-fade-in disabled:opacity-50"
          >
            <Trash2 size={14} /> 批次刪除 ({selectedCount})
          </button>
        )}

        <button
          onClick={onAddClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition text-xs shadow-sm"
        >
          <Plus size={14} /> 補登打卡
        </button>
        <button
          onClick={onOpenOcr}
          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition text-xs shadow-sm"
        >
          <ScanLine size={14} /> OCR 辨識
        </button>

        <div className="text-right hidden xl:block mx-1">
          <span className="block text-[10px] text-slate-400 leading-none mb-0.5">
            總工時合計
          </span>
          <span className="text-sm font-bold text-blue-600 font-mono leading-none">
            {totalHours.toFixed(1)} <span className="text-[10px]">hr</span>
          </span>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md font-bold flex items-center gap-1.5 transition text-xs shadow-sm"
          >
            <FileSpreadsheet size={14} /> 匯出報表 <ChevronDown size={14} />
          </button>

          {showExportMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowExportMenu(false)}
              ></div>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden z-20 animate-fade-in">
                <button
                  onClick={() => {
                    onExportCSV();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 transition"
                >
                  📄 標準 CSV 總表
                </button>
                <button
                  onClick={() => {
                    onExportTimecard();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 transition"
                >
                  📅 匯出打卡表 (排班)
                </button>
                <button
                  onClick={() => {
                    onExportFullMonth();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  👤 匯出單人全月表
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

