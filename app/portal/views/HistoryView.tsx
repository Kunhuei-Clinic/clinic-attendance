'use client';

import React, { useState } from 'react';
import { History, PlusCircle, X } from 'lucide-react';
import PortalTopHeader from './PortalTopHeader';

type MissedCorrectionType = 'check_in' | 'check_out' | 'full';

export interface MissedPunchForm {
  date: string;
  startTime: string;
  endTime: string;
  correctionType: MissedCorrectionType;
  reason: string;
}

interface HistoryViewProps {
  staffUser: any;
  logs: any[];
  selectedMonth: string;
  setSelectedMonth: (value: string) => void;
  onReportAnomaly: (logId: number) => void;
  onSubmitMissedPunch: (form: MissedPunchForm) => Promise<void> | void;
}

const formatTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

export default function HistoryView({
  staffUser,
  logs,
  selectedMonth,
  setSelectedMonth,
  onReportAnomaly,
  onSubmitMissedPunch,
}: HistoryViewProps) {
  const [showMissedPunch, setShowMissedPunch] = useState(false);
  const [missedForm, setMissedForm] = useState<MissedPunchForm>({
    date: '',
    startTime: '',
    endTime: '',
    correctionType: 'check_in',
    reason: '',
  });

  const handleSubmitMissedPunch = async () => {
    if (!missedForm.date || !missedForm.reason) {
      alert('請填寫日期和原因');
      return;
    }
    if (missedForm.correctionType === 'check_in' && !missedForm.startTime) {
      alert('請填寫上班時間');
      return;
    }
    if (missedForm.correctionType === 'check_out' && !missedForm.endTime) {
      alert('請填寫下班時間');
      return;
    }
    if (
      missedForm.correctionType === 'full' &&
      (!missedForm.startTime || !missedForm.endTime)
    ) {
      alert('補全天請填寫上班和下班時間');
      return;
    }

    await onSubmitMissedPunch(missedForm);
    setShowMissedPunch(false);
    setMissedForm({
      date: '',
      startTime: '',
      endTime: '',
      correctionType: 'check_in',
      reason: '',
    });
  };

  const renderStatusBadge = (log: any) => {
    if (log.is_overtime) {
      if (log.overtime_status === 'pending') {
        return {
          text: '加班審核中',
          color: 'bg-yellow-100 text-orange-700 border-orange-300',
        };
      }
      if (log.overtime_status === 'approved') {
        return {
          text: '加班已核准',
          color: 'bg-green-100 text-green-700 border-green-300',
        };
      }
      if (log.overtime_status === 'rejected') {
        return {
          text: '加班已駁回',
          color: 'bg-red-100 text-red-700 border-red-300',
        };
      }
    }
    if (log.anomaly_reason) {
      return {
        text: '已回報異常',
        color: 'bg-slate-100 text-slate-600 border-slate-300',
      };
    }
    return null;
  };

  const renderMissedPunchModal = () => {
    if (!showMissedPunch) return null;

    const isCheckIn = missedForm.correctionType === 'check_in';
    const isCheckOut = missedForm.correctionType === 'check_out';
    const isFull = missedForm.correctionType === 'full';

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-800">申請補登打卡</h3>
            <button onClick={() => setShowMissedPunch(false)}>
              <X />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-2 block">補登項目</label>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setMissedForm({
                      ...missedForm,
                      correctionType: 'check_in',
                    })
                  }
                  className={`flex-1 py-2 rounded font-bold border text-sm transition ${
                    isCheckIn
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-500 border-slate-300'
                  }`}
                >
                  補上班
                </button>
                <button
                  onClick={() =>
                    setMissedForm({
                      ...missedForm,
                      correctionType: 'check_out',
                    })
                  }
                  className={`flex-1 py-2 rounded font-bold border text-sm transition ${
                    isCheckOut
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-500 border-slate-300'
                  }`}
                >
                  補下班
                </button>
                <button
                  onClick={() =>
                    setMissedForm({
                      ...missedForm,
                      correctionType: 'full',
                    })
                  }
                  className={`flex-1 py-2 rounded font-bold border text-sm transition ${
                    isFull
                      ? 'bg-teal-600 text-white border-teal-600'
                      : 'bg-white text-slate-500 border-slate-300'
                  }`}
                >
                  補全天
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">日期</label>
              <input
                type="date"
                value={missedForm.date}
                onChange={(e) =>
                  setMissedForm({ ...missedForm, date: e.target.value })
                }
                className="w-full border p-2 rounded bg-slate-50 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400">上班時間</label>
                <input
                  type="time"
                  value={missedForm.startTime}
                  onChange={(e) =>
                    setMissedForm({
                      ...missedForm,
                      startTime: e.target.value,
                    })
                  }
                  className={`w-full border p-2 rounded text-sm ${
                    isCheckOut
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-50'
                  }`}
                  disabled={isCheckOut}
                  required={isCheckIn || isFull}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">下班時間</label>
                <input
                  type="time"
                  value={missedForm.endTime}
                  onChange={(e) =>
                    setMissedForm({
                      ...missedForm,
                      endTime: e.target.value,
                    })
                  }
                  className={`w-full border p-2 rounded text-sm ${
                    isCheckIn
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-slate-50'
                  }`}
                  disabled={isCheckIn}
                  required={isCheckOut || isFull}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">原因</label>
              <input
                type="text"
                placeholder="例: 忘記帶手機"
                value={missedForm.reason}
                onChange={(e) =>
                  setMissedForm({ ...missedForm, reason: e.target.value })
                }
                className="w-full border p-2 rounded bg-slate-50 text-sm"
              />
            </div>

            <button
              onClick={handleSubmitMissedPunch}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold text-sm"
            >
              送出申請
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
      {renderMissedPunchModal()}

      {/* 共用頂部個人資訊區塊 */}
      <PortalTopHeader name={staffUser?.name} role={staffUser?.role} />

      <div className="p-4 space-y-4">
        <div className="flex justify-between items-center mt-2">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm">
            <History size={18} />
            歷史紀錄
          </h3>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white border rounded px-2 py-1 text-xs font-bold text-slate-600"
          />
        </div>

        <button
          onClick={() => setShowMissedPunch(true)}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-400 transition text-xs"
        >
          <PlusCircle size={18} />
          申請補登打卡 (忘記打卡)
        </button>

        <div className="space-y-3">
          {logs.map((log: any) => {
            const badge = renderStatusBadge(log);

            return (
              <div
                key={log.id}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">
                      {new Date(log.clock_in_time).getDate()}日
                    </div>
                    <div className="font-mono text-slate-600 text-xs mt-1">
                      {formatTime(log.clock_in_time)} -{' '}
                      {formatTime(log.clock_out_time)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border ${badge.color}`}
                      >
                        {badge.text}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-2">
                  <div className="text-xs font-bold text-teal-600">
                    工時 {Number(log.work_hours || 0).toFixed(1)} hr
                  </div>
                  <button
                    onClick={() => onReportAnomaly(log.id)}
                    className="text-xs text-slate-400 hover:text-red-500 underline"
                  >
                    回報異常
                  </button>
                </div>
              </div>
            );
          })}

          {logs.length === 0 && (
            <div className="text-center text-slate-400 py-8 text-xs">
              尚無打卡記錄
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

