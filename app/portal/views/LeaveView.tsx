'use client';

import React from 'react';
import { Coffee, Calendar, ChevronRight } from 'lucide-react';
import PortalTopHeader from './PortalTopHeader';

interface LeaveFormState {
  type: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  reason: string;
}

interface StaffLeaveInfo {
  start_date: string | null;
  annual_leave_history: any;
  annual_leave_quota: number | null;
}

interface LeaveStats {
  [key: string]: {
    used: number;
    quota?: number;
    remaining?: number;
  };
}

interface LeaveViewProps {
  staffUser: { name?: string | null; role?: string | null } | any;
  leaveForm: LeaveFormState;
  setLeaveForm: (form: LeaveFormState) => void;
  onSubmitLeave: () => Promise<void> | void;
  leaveHistory: any[];
  leaveStats: LeaveStats | null;
  staffLeaveInfo: StaffLeaveInfo | null;
  showAnnualHistory: boolean;
  setShowAnnualHistory: (value: boolean) => void;
}

const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('zh-TW', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

export default function LeaveView({
  staffUser,
  leaveForm,
  setLeaveForm,
  onSubmitLeave,
  leaveHistory,
  leaveStats,
  staffLeaveInfo,
  showAnnualHistory,
  setShowAnnualHistory,
}: LeaveViewProps) {
  const typeTabs = ['事假', '病假', '特休', '補休'];

  const handleSubmit = async () => {
    await onSubmitLeave();
  };

  const annualStats = leaveStats?.annual;
  const quota =
    staffLeaveInfo?.annual_leave_quota ??
    (annualStats?.quota !== undefined ? annualStats.quota : null);
  const usedDays = annualStats ? (annualStats.used || 0) / 8 : 0;
  const remaining =
    annualStats?.remaining !== undefined
      ? annualStats.remaining
      : quota !== null
      ? quota
      : undefined;

  const renderOtherLeaveStats = () => {
    if (!leaveStats || Object.keys(leaveStats).length === 0) return null;

    return (
      <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-4 rounded-xl shadow-sm border border-slate-200 space-y-2">
        <h4 className="text-xs font-bold text-slate-600 mb-2">
          其他假別 (今年度)
        </h4>

        {leaveStats.personal && (
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600">事假</span>
              <span className="text-sm font-black text-slate-700">
                已用 {Number((leaveStats.personal.used || 0) / 8).toFixed(1)} 天
              </span>
            </div>
          </div>
        )}

        {leaveStats.sick && (
          <div className="bg-white/80 p-2 rounded-lg border border-slate-200">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-600">病假</span>
              <span className="text-sm font-black text-slate-700">
                已用 {Number((leaveStats.sick.used || 0) / 8).toFixed(1)} 天
              </span>
            </div>
          </div>
        )}

        {Object.entries(leaveStats).map(([key, value]: [string, any]) => {
          if (['annual', 'personal', 'sick'].includes(key)) return null;
          const typeLabels: Record<string, string> = {
            menstrual: '生理假',
            bereavement: '喪假',
            official: '公假',
            marriage: '婚假',
            maternity: '產假',
            family: '家庭照顧假',
          };
          return (
            <div
              key={key}
              className="bg-white/80 p-2 rounded-lg border border-slate-200"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600">
                  {typeLabels[key] || key}
                </span>
                <span className="text-sm font-black text-slate-700">
                  已用 {Number((value.used || 0) / 8).toFixed(1)} 天
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderHistoryList = () => (
    <div className="space-y-2 mt-4">
      <h4 className="text-xs font-bold text-slate-400">申請紀錄</h4>
      {leaveHistory.map((l, i) => (
        <div
          key={i}
          className="bg-white p-3 rounded-lg border border-slate-100 space-y-1"
        >
          <div className="flex justify-between items-start mb-1">
            <div className="flex-1">
              <div className="font-bold text-sm text-slate-700">
                {l.type}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  {l.leave_type && `(${l.leave_type}) `}
                  {formatDateTime(l.start_time)}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">{l.reason}</div>
            </div>
            <span
              className={`text-[10px] px-2.5 py-1 rounded font-bold whitespace-nowrap ml-2 border ${
                l.status === 'approved'
                  ? 'bg-green-100 text-green-700 border-green-300'
                  : l.status === 'rejected'
                  ? 'bg-red-100 text-red-700 border-red-300'
                  : 'bg-yellow-100 text-orange-700 border-orange-300'
              }`}
            >
              {l.status === 'approved'
                ? '✓ 已通過'
                : l.status === 'rejected'
                ? '✗ 已駁回'
                : '⏳ 請假簽核中'}
            </span>
          </div>
          {l.hours && (
            <div className="text-xs text-slate-500">
              時數：{Number(l.hours).toFixed(1)} 小時
            </div>
          )}
        </div>
      ))}

      {leaveHistory.length === 0 && (
        <div className="text-center text-slate-400 py-4 text-xs">
          尚無請假記錄
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
      {/* 共用頂部個人資訊區塊 */}
      <PortalTopHeader name={staffUser?.name} role={staffUser?.role} />

      <div className="p-4 space-y-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm mt-2">
          <Coffee size={18} />
          請假申請
        </h3>

        {/* 特休概況卡片（最上方） */}
        <div className="bg-gradient-to-br from-teal-50 via-blue-50 to-indigo-50 p-5 rounded-xl shadow-lg border-2 border-teal-200 space-y-3">
          <h4 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Calendar size={18} className="text-teal-600" />
            特休概況
          </h4>

          {/* 到職日期 */}
          {staffLeaveInfo?.start_date && (
            <div className="bg-white/90 p-3 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600">
                  到職日期
                </span>
                <span className="text-sm font-black text-slate-800">
                  {new Date(
                    staffLeaveInfo.start_date,
                  ).toLocaleDateString('zh-TW', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>
          )}

          {/* 今年特休 */}
          {(leaveStats?.annual || staffLeaveInfo?.annual_leave_quota) && (
            <div className="bg-white/90 p-3 rounded-lg border-2 border-teal-300">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-slate-700">
                  今年特休
                </span>
                <span className="text-lg font-black text-teal-700">
                  {staffLeaveInfo?.annual_leave_quota !== null &&
                  staffLeaveInfo?.annual_leave_quota !== undefined
                    ? `${Number(
                        staffLeaveInfo.annual_leave_quota,
                      ).toFixed(1)} 天`
                    : leaveStats?.annual?.quota !== undefined
                    ? `${Number(leaveStats.annual.quota).toFixed(1)} 天`
                    : '未設定額度'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded">
                  <div className="text-slate-500 mb-0.5">已用</div>
                  <div className="font-bold text-orange-600">
                    {leaveStats?.annual
                      ? `${Number(
                          (leaveStats.annual.used || 0) / 8,
                        ).toFixed(1)} 天`
                      : '0 天'}
                  </div>
                </div>
                <div className="bg-teal-50 p-2 rounded">
                  <div className="text-slate-500 mb-0.5">剩餘</div>
                  <div className="font-bold text-teal-700">
                    {leaveStats?.annual?.remaining !== undefined
                      ? `${Number(
                          leaveStats.annual.remaining,
                        ).toFixed(1)} 天`
                      : staffLeaveInfo?.annual_leave_quota !== null &&
                        staffLeaveInfo?.annual_leave_quota !== undefined
                      ? `${Number(
                          staffLeaveInfo.annual_leave_quota,
                        ).toFixed(1)} 天`
                      : '--'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 歷年紀錄（可展開） */}
          {staffLeaveInfo?.annual_leave_history && (
            <div className="bg-white/90 p-3 rounded-lg border border-slate-200">
              <button
                onClick={() => setShowAnnualHistory(!showAnnualHistory)}
                className="w-full flex justify-between items-center"
              >
                <span className="text-xs font-bold text-slate-600">
                  歷年特休紀錄
                </span>
                <ChevronRight
                  size={16}
                  className={`text-slate-400 transition-transform ${
                    showAnnualHistory ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {showAnnualHistory && (
                <div className="mt-3 space-y-2 pt-3 border-t border-slate-200 max-h-48 overflow-y-auto">
                  {typeof staffLeaveInfo.annual_leave_history === 'string' ? (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded">
                      {staffLeaveInfo.annual_leave_history}
                    </div>
                  ) : (
                    Object.entries(staffLeaveInfo.annual_leave_history)
                      .sort(([a], [b]) => (b || '').localeCompare(a || ''))
                      .map(([year, days]: [string, any]) => (
                        <div
                          key={year}
                          className="flex justify-between items-center bg-slate-50 p-2 rounded text-xs"
                        >
                          <span className="font-bold text-slate-700">
                            {year} 年
                          </span>
                          <span className="text-teal-600 font-bold">
                            {Number(days).toFixed(1)} 天
                          </span>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 其他假別統計 */}
        {renderOtherLeaveStats()}

        {/* 申請表單 */}
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-3">
          <div className="flex gap-2">
            {typeTabs.map((t) => (
              <button
                key={t}
                onClick={() => setLeaveForm({ ...leaveForm, type: t })}
                className={`flex-1 py-1.5 rounded text-xs font-bold border ${
                  leaveForm.type === t
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-400">開始日期</label>
              <input
                type="date"
                className="w-full border rounded p-1 text-sm bg-slate-50"
                value={leaveForm.startDate}
                onChange={(e) =>
                  setLeaveForm({
                    ...leaveForm,
                    startDate: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">時間</label>
              <input
                type="time"
                className="w-full border rounded p-1 text-sm"
                value={leaveForm.startTime}
                onChange={(e) =>
                  setLeaveForm({
                    ...leaveForm,
                    startTime: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">結束日期</label>
              <input
                type="date"
                className="w-full border rounded p-1 text-sm bg-slate-50"
                value={leaveForm.endDate}
                onChange={(e) =>
                  setLeaveForm({
                    ...leaveForm,
                    endDate: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">時間</label>
              <input
                type="time"
                className="w-full border rounded p-1 text-sm"
                value={leaveForm.endTime}
                onChange={(e) =>
                  setLeaveForm({
                    ...leaveForm,
                    endTime: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <input
            type="text"
            className="w-full border rounded p-2 text-sm"
            placeholder="請輸入事由..."
            value={leaveForm.reason}
            onChange={(e) =>
              setLeaveForm({
                ...leaveForm,
                reason: e.target.value,
              })
            }
          />
          <button
            onClick={handleSubmit}
            className="w-full bg-teal-600 text-white py-2 rounded-lg font-bold shadow-md text-sm"
          >
            送出申請
          </button>
        </div>

        {/* 申請紀錄列表 */}
        {renderHistoryList()}
      </div>
    </div>
  );
}

