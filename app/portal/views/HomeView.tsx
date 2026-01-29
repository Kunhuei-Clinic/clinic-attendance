import React from 'react';
import { Clock, MapPin, Bell, AlertTriangle } from 'lucide-react';
import PortalTopHeader from './PortalTopHeader';

type GpsStatus = 'idle' | 'locating' | 'ok' | 'out_of_range' | 'error';

interface HomeViewProps {
  staffUser: any;
  isWorking: boolean;
  logs: any[];
  gpsStatus: GpsStatus;
  announcements: {
    title: string;
    content: string;
    created_at: string | null;
  }[];
  onClockIn: () => void;
  onClockOut: () => void;
  bypassMode: boolean;
  setBypassMode: (value: boolean) => void;
}

const formatTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';

export default function HomeView({
  staffUser,
  isWorking,
  logs,
  gpsStatus,
  announcements,
  onClockIn,
  onClockOut,
  bypassMode,
  setBypassMode,
}: HomeViewProps) {
  const latestLog = logs?.[0];

  const renderGpsLabel = () => {
    if (gpsStatus === 'locating') return '定位中...';
    if (gpsStatus === 'out_of_range') return '距離太遠';
    if (gpsStatus === 'error') return '定位失敗';
    if (gpsStatus === 'ok') return '定位就緒';
    return '待定位';
  };

  const isVip = staffUser?.role === '醫師' || staffUser?.role === '主管';

  return (
    <div className="min-h-screen bg-slate-50 pb-24 max-w-md mx-auto shadow-2xl relative">
      {/* 共用頂部個人資訊區塊 */}
      <PortalTopHeader
        name={staffUser?.name}
        role={staffUser?.role}
        isVip={isVip}
      >
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
          <div className="flex justify-between items-center text-sm mb-3">
            <span className="text-teal-100 flex items-center gap-1">
              <MapPin size={12} />
              {renderGpsLabel()}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                isWorking
                  ? 'bg-yellow-400 text-yellow-900'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {isWorking ? '工作中' : '未打卡'}
            </span>
          </div>
          <div className="flex justify-between text-center divide-x divide-white/20">
            <div className="flex-1">
              <p className="text-xs text-teal-200 mb-1">上班時間</p>
              <p className="text-xl font-mono font-bold">
                {formatTime(latestLog?.clock_in_time)}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-teal-200 mb-1">下班時間</p>
              <p className="text-xl font-mono font-bold">
                {formatTime(latestLog?.clock_out_time)}
              </p>
            </div>
          </div>
        </div>
      </PortalTopHeader>

      <div className="p-6 space-y-6">
        {/* 🟢 公告區塊：放在打卡按鈕上方、醒目顯示 */}
        {announcements && Array.isArray(announcements) && announcements.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Bell
                size={18}
                className="text-orange-600 fill-orange-600 animate-pulse"
              />
              <h3 className="text-sm font-bold text-orange-800">最新公告</h3>
              {announcements.length > 1 && (
                <span className="text-xs text-orange-600 font-bold">
                  ({announcements.length} 則)
                </span>
              )}
            </div>
            {announcements.map((ann, i) => (
              <div
                key={i}
                className="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500 p-4 rounded-xl shadow-md hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-bold text-slate-800 text-base flex-1">
                    {ann.title || '公告'}
                  </div>
                  {ann.created_at && (
                    <div className="text-[10px] text-slate-400 whitespace-nowrap">
                      {new Date(ann.created_at).toLocaleDateString('zh-TW', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {ann.content || ''}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 打卡大圓形按鈕 */}
        <div className="w-full flex flex-col items-center gap-3">
          <button
            onClick={isWorking ? onClockOut : onClockIn}
            className={`w-full max-w-xs aspect-square rounded-full shadow-2xl flex flex-col items-center justify-center text-white active:scale-95 transition border-8 ${
              isWorking
                ? 'bg-gradient-to-b from-orange-400 to-orange-600 border-orange-100/50'
                : 'bg-gradient-to-b from-teal-400 to-teal-600 border-teal-100/50'
            }`}
          >
            <Clock size={56} className="mb-2 opacity-90" />
            <span className="text-3xl font-black tracking-widest">
              {isWorking ? '下班' : '上班'}
            </span>
            <span className="text-sm opacity-80 mt-2 font-mono">
              {isWorking && latestLog?.clock_in_time
                ? `已工作: ${(
                    (Date.now() -
                      new Date(latestLog.clock_in_time).getTime()) /
                    3600000
                  ).toFixed(1)} hr`
                : new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
            </span>
          </button>

          {/* 救援模式開關 */}
          {!isVip && (
            <div className="text-center">
              {!bypassMode ? (
                <button
                  onClick={() => {
                    if (window.confirm('啟用救援模式？將標記為異常打卡')) {
                      setBypassMode(true);
                    }
                  }}
                  className="text-xs text-slate-400 underline hover:text-slate-600 transition"
                >
                  GPS 定位不到？開啟救援模式
                </button>
              ) : (
                <div className="text-xs text-red-600 font-bold flex items-center justify-center gap-1 bg-red-50 px-3 py-2 rounded-lg">
                  <AlertTriangle size={12} /> 救援模式已啟用 (將標記為異常)
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
