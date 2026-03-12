'use client';

import React from 'react';
import { Clock, Users, FileText, AlertCircle, MapPin, QrCode } from 'lucide-react';

interface HomeViewProps {
  staffUser: any;
  isWorking: boolean;
  logs: any[];
  gpsStatus: string;
  announcements: any[];
  managerStats?: any;
  isPunching?: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onScanClock?: () => void;
  bypassMode: boolean;
  setBypassMode: (val: boolean) => void;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '早安';
  if (hour < 18) return '午安';
  return '晚安';
}

function getGpsStatusText(status: string) {
  switch (status) {
    case 'locating':
      return 'GPS 定位中...';
    case 'ok':
      return '定位良好';
    case 'out_of_range':
      return '⚠️ 距離診所太遠';
    case 'error':
      return '定位失敗';
    default:
      return 'GPS 待命';
  }
}

export default function HomeView(props: HomeViewProps) {
  const {
    staffUser,
    isWorking,
    logs,
    gpsStatus,
    announcements,
    managerStats,
    isPunching = false,
    onClockIn,
    onClockOut,
    onScanClock,
    bypassMode,
    setBypassMode,
  } = props;

  const latestLog = logs?.[0];
  // 雙重身分驗證：讀取新的 admin_role 欄位
  const isManager =
    staffUser?.admin_role === 'owner' || staffUser?.admin_role === 'manager';
  const isVip = staffUser?.role === '醫師' || staffUser?.role === '主管';

  const greeting = getGreeting();
  const gpsStatusText = getGpsStatusText(gpsStatus);
  const displayAnnouncements = Array.isArray(announcements)
    ? announcements.slice(0, 3)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 p-4 space-y-4 pb-24 max-w-md mx-auto">
      {/* 區塊一：個人狀態與打卡卡片 */}
      <section className="rounded-2xl border border-slate-100 bg-white shadow-md overflow-hidden">
        <div className="p-5">
          <h1 className="text-xl font-bold text-slate-800 mb-1">
            {greeting}，{staffUser?.name ?? '—'}
          </h1>
          <p className="text-slate-600 text-sm mb-4">
            {isWorking ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                工作中
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                尚未打卡
              </span>
            )}
          </p>

          {/* 單一巨大打卡按鈕：依 isWorking 顯示上班或下班，防連點 */}
          <button
            type="button"
            onClick={isWorking ? onClockOut : onClockIn}
            disabled={gpsStatus === 'locating' || isPunching}
            className={`w-full h-14 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-md active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition ${
              isWorking
                ? 'bg-amber-500 hover:bg-amber-600 border border-amber-600/20'
                : 'bg-teal-500 hover:bg-teal-600 border border-teal-600/20'
            }`}
          >
            <Clock size={24} />
            <span>{isPunching ? '處理中...' : isWorking ? '下班打卡' : '上班打卡'}</span>
          </button>

          {/* 掃碼打卡按鈕（小一號，置於主按鈕下方） */}
          {onScanClock && (
            <button
              type="button"
              onClick={onScanClock}
              className="flex items-center justify-center gap-2 w-full h-12 mt-3 bg-slate-800 text-white rounded-xl font-bold shadow-lg hover:bg-slate-700 active:scale-[0.98] transition"
            >
              <QrCode size={20} /> 掃描診所 QR 打卡
            </button>
          )}

          {/* GPS 狀態文字（按鈕下方小字） */}
          <p className="text-xs text-slate-500 mt-3 text-center">
            {gpsStatusText}
          </p>

          {isWorking && latestLog?.clock_in_time && (
            <p className="text-center text-xs text-slate-400 mt-1">
              已工作{' '}
              {(
                (Date.now() - new Date(latestLog.clock_in_time).getTime()) /
                3600000
              ).toFixed(1)}{' '}
              小時
            </p>
          )}

          {/* 救援模式（非 VIP） */}
          {!isVip && (
            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
              {!bypassMode ? (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm('啟用救援模式？將標記為異常打卡')
                    ) {
                      setBypassMode(true);
                    }
                  }}
                  className="text-xs text-slate-500 underline hover:text-slate-700"
                >
                  GPS 定位不到？開啟救援模式
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-2 rounded-xl text-xs font-medium border border-red-100">
                  <AlertCircle size={12} /> 救援模式已啟用（異常標記）
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 區塊二：👑 主管專屬儀表板（僅 isManager 時顯示） */}
      {isManager && (
        <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-slate-50 shadow-md overflow-hidden">
          <div className="p-5">
            <h2 className="text-lg font-bold text-slate-800 mb-4">
              👑 診所管理中樞
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl border border-slate-200/80 bg-white/90 p-3 text-center shadow-sm">
                <p className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                  <Users size={14} /> 今日出勤
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {managerStats?.clockedInCount ?? 0} / {managerStats?.totalStaff ?? 0} 人
                </p>
              </div>
              <div className={`rounded-xl border p-3 text-center shadow-sm ${
                (managerStats?.pendingLeaves ?? 0) > 0
                  ? 'border-red-200 bg-red-50/90 animate-pulse'
                  : 'border-slate-200/80 bg-white/90'
              }`}>
                <p className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                  <FileText size={14} /> 待核假單
                </p>
                <p className="text-lg font-bold text-red-600">
                  {(managerStats?.pendingLeaves ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {managerStats.pendingLeaves} 筆
                      </span>
                    </span>
                  ) : (
                    <span>{managerStats?.pendingLeaves ?? 0} 筆</span>
                  )}
                </p>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-200/80 bg-white/90 p-3 text-center shadow-sm">
                <p className="text-xs text-slate-500 mb-1 flex items-center justify-center gap-1">
                  <AlertCircle size={14} /> 異常打卡
                </p>
                <p className="text-lg font-bold text-slate-800">
                  {managerStats?.anomalyCount ?? 0} 筆
                </p>
              </div>
            </div>
            <button
              type="button"
              className="w-full h-12 py-3 rounded-xl font-bold text-slate-600 bg-slate-200 border border-slate-300 hover:bg-slate-300 transition flex items-center justify-center gap-2"
            >
              <QrCode size={20} />
              <span>📱 產生打卡 QR Code（即將推出）</span>
            </button>
          </div>
        </section>
      )}

      {/* 區塊三：公告區塊 */}
      <section className="rounded-2xl border border-slate-100 bg-white shadow-md overflow-hidden">
        <div className="p-5">
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            📢 最新公告
          </h2>
          {displayAnnouncements.length > 0 ? (
            <ul className="space-y-3">
              {displayAnnouncements.map((ann: any, idx: number) => (
                <li
                  key={ann?.id ?? idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex justify-between items-start gap-2 mb-0.5">
                    <span className="font-semibold text-slate-800 text-sm truncate flex-1 min-w-0">
                      {ann?.title ?? '無標題'}
                    </span>
                    {ann?.created_at && (
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(ann.created_at).toLocaleDateString('zh-TW')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed truncate">
                    {ann?.content ?? ''}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 text-center py-6">
              目前無最新公告
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
