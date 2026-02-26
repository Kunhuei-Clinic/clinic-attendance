'use client';

import React from 'react';
import { Pencil, Trash2, CheckCircle, X } from 'lucide-react';

type Staff = {
  id: string; // UUID
  name: string;
  role?: string | null;
};

type AttendanceLog = {
  id: number;
  staff_name: string;
  clock_in_time?: string | null;
  clock_out_time?: string | null;
  work_type?: string;
  is_overtime?: boolean;
  overtime_status?: string | null;
  work_hours?: number | string;
  note?: string | null;
  anomaly_reason?: string | null;
};

type Props = {
  logs: AttendanceLog[];
  loading: boolean;
  staffList: Staff[];
  onOvertimeApproval: (logId: number, status: 'approved' | 'rejected') => void;
  onEdit: (log: AttendanceLog) => void;
  onDelete: (id: number) => void;
};

const formatLocalDate = (isoString?: string | null) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
};

const AttendanceTable: React.FC<Props> = ({
  logs,
  loading,
  staffList,
  onOvertimeApproval,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-500 font-bold text-sm border-b">
            <tr>
              <th className="p-4">員工姓名</th>
              <th className="p-4">日期</th>
              <th className="p-4">班別</th>
              <th className="p-4">上班時間</th>
              <th className="p-4">下班時間</th>
              <th className="p-4 text-right">工時 (hr)</th>
              <th className="p-4">狀態</th>
              <th className="p-4 text-center">備註</th>
              <th className="p-4 text-center">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  載入中...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-slate-400">
                  無符合資料
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition group">
                  <td className="p-4 font-bold text-slate-700 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs">
                      {log.staff_name?.slice(0, 1)}
                    </div>
                    <div>
                      <div>{log.staff_name}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        {staffList.find((s) => s.name === log.staff_name)?.role}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-500 font-mono">
                    {formatLocalDate(log.clock_in_time)}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          log.work_type === 'overtime'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {log.work_type === 'overtime' ? '加班' : '正常班'}
                      </span>
                      {log.is_overtime && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.overtime_status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : log.overtime_status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {log.overtime_status === 'approved'
                            ? '已核准'
                            : log.overtime_status === 'rejected'
                            ? '已駁回'
                            : '待審核'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-slate-700 font-bold">
                    {log.clock_in_time
                      ? new Date(log.clock_in_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </td>
                  <td className="p-4 font-mono text-slate-700 font-bold">
                    {log.clock_out_time
                      ? new Date(log.clock_out_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </td>
                  <td className="p-4 text-right font-bold font-mono text-blue-600">
                    {log.work_hours ? Number(log.work_hours).toFixed(1) : '-'}
                  </td>
                  <td className="p-4">
                    {log.clock_out_time ? (
                      <span className="text-green-600 flex items-center gap-1 text-xs">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>{' '}
                        完成
                      </span>
                    ) : (
                      <span className="text-red-500 flex items-center gap-1 text-xs animate-pulse">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>{' '}
                        工作中
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center text-xs text-slate-500 max-w-[150px] truncate">
                    {log.note || log.anomaly_reason || '-'}
                  </td>
                  <td className="p-4 text-center flex items-center justify-center gap-2">
                    {log.is_overtime && log.overtime_status === 'pending' && (
                      <>
                        <button
                          onClick={() => onOvertimeApproval(log.id, 'approved')}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="核准加班"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => onOvertimeApproval(log.id, 'rejected')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="駁回加班"
                        >
                          <X size={16} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => onEdit(log)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="修改"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => onDelete(log.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="刪除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceTable;

