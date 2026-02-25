'use client';

import React from 'react';
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
} from 'lucide-react';

type Staff = {
  id: number;
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
  onAddClick: () => void;
  onOpenOcr: () => void;
  onExportCSV: () => void;
  onExportTimecard: () => void;
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
  onAddClick,
  onOpenOcr,
  onExportCSV,
  onExportTimecard,
}) => {
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
      </div>

      <div className="flex gap-4 items-center">
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
        <div className="flex gap-2">
          <button
            onClick={onExportCSV}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm"
          >
            <FileSpreadsheet size={18} /> 匯出 CSV
          </button>
          <button
            onClick={onExportTimecard}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition text-sm"
          >
            <FileSpreadsheet size={18} /> 匯出打卡表 (排班格式)
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceToolbar;

