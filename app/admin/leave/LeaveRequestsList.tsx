'use client';

import React from 'react';
import { Plus, ToggleLeft, ToggleRight, User, Filter, Trash2 } from 'lucide-react';

type LeaveRequestsListProps = {
  requests: any[];
  staffList: any[];
  loading: boolean;
  onDelete: (id: number) => void;
  onAddClick: () => void;
  filters: {
    useDateFilter: boolean;
    startDate: string;
    endDate: string;
    selectedStaffId: string;
    statusFilter: string;
  };
  setFilters: (filters: {
    useDateFilter: boolean;
    startDate: string;
    endDate: string;
    selectedStaffId: string;
    statusFilter: string;
  }) => void;
};

export default function LeaveRequestsList({
  requests,
  staffList,
  loading,
  onDelete,
  onAddClick,
  filters,
  setFilters,
}: LeaveRequestsListProps) {
  const { useDateFilter, startDate, endDate, selectedStaffId, statusFilter } = filters;

  const updateFilters = (partial: Partial<LeaveRequestsListProps['filters']>) => {
    setFilters({
      useDateFilter,
      startDate,
      endDate,
      selectedStaffId,
      statusFilter,
      ...partial,
    });
  };

  return (
    <>
      {/* 工具列 */}
      <div className="flex flex-wrap justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => updateFilters({ useDateFilter: !useDateFilter })}
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
              <span className="text-slate-500 pl-1">區間:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => updateFilters({ startDate: e.target.value })}
                className="bg-transparent font-bold text-slate-700 outline-none"
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => updateFilters({ endDate: e.target.value })}
                className="bg-transparent font-bold text-slate-700 outline-none"
              />
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm">
            <User size={16} className="text-slate-400 ml-1" />
            <select
              value={selectedStaffId}
              onChange={(e) => updateFilters({ selectedStaffId: e.target.value })}
              className="bg-transparent font-bold text-slate-700 outline-none w-32"
            >
              <option value="all">所有員工</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* 狀態篩選 */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm">
            <Filter size={16} className="text-slate-400 ml-1" />
            <select
              value={statusFilter}
              onChange={(e) => updateFilters({ statusFilter: e.target.value })}
              className="bg-transparent font-bold text-slate-700 outline-none w-24"
            >
              <option value="all">不限狀態</option>
              <option value="pending">待審核</option>
              <option value="approved">已通過</option>
              <option value="rejected">已駁回</option>
            </select>
          </div>
        </div>

        <button
          onClick={onAddClick}
          className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-600 transition shrink-0"
        >
          <Plus size={18} /> 新增請假
        </button>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 text-sm">
              <tr>
                <th className="p-4">日期</th>
                <th className="p-4">員工</th>
                <th className="p-4">假別</th>
                <th className="p-4">時數</th>
                <th className="p-4">事由</th>
                <th className="p-4 text-center">狀態</th>
                <th className="p-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    載入中...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    無符合條件的紀錄
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const staff = staffList.find((s) => s.id === req.staff_id);
                  const staffName = staff?.name || req.staff_name || '未知';
                  const isPending = req.status === 'pending';
                  const isRejected = req.status === 'rejected';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition">
                      <td className="p-4 font-mono text-slate-600">
                        {req.start_time?.slice(0, 10)}
                        <br />
                        <span className="text-xs text-slate-400">
                          {req.start_time?.slice(11, 16)} ~ {req.end_time?.slice(11, 16)}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-800">{staffName}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-bold ${
                            req.type === '補打卡'
                              ? 'bg-blue-100 text-blue-600'
                              : req.type === '事假'
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-purple-100 text-purple-600'
                          }`}
                        >
                          {req.type} {req.leave_type && `(${req.leave_type})`}
                        </span>
                      </td>
                      <td className="p-4 font-mono font-bold">{req.hours} hr</td>
                      <td
                        className="p-4 text-slate-500 max-w-xs truncate"
                        title={req.reason}
                      >
                        {req.reason || '-'}
                      </td>
                      <td className="p-4 text-center">
                        {isPending ? (
                          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">
                            待審核
                          </span>
                        ) : isRejected ? (
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">
                            已駁回
                          </span>
                        ) : (
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">
                            已通過
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => onDelete(req.id)}
                          className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

