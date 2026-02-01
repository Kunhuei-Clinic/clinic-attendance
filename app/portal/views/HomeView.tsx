import React from 'react';
import { Clock, MapPin, Bell, AlertTriangle, Info } from 'lucide-react';
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

  // 🟢 除錯：確認資料有沒有進來
  console.log('HomeView 接收到的公告資料:', announcements);

  const isVip = staffUser?.role === '醫師' || staffUser?.role === '主管';

  const renderGpsLabel = () => {
    if (gpsStatus === 'locating') return <span className="text-slate-400">定位中...</span>;
    if (gpsStatus === 'ok') return <span className="text-green-600 flex items-center gap-1"><MapPin size={12}/> 定位良好</span>;
    if (gpsStatus === 'out_of_range') return <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={12}/> 超出範圍</span>;
    if (gpsStatus === 'error') return <span className="text-red-500">定位失敗</span>;
    return <span className="text-slate-300">GPS 待命</span>;
  };

  return (
    <div className="animate-fade-in space-y-4 px-4 pt-4 pb-20">
      <PortalTopHeader 
         name={staffUser?.name} 
         role={staffUser?.role} 
         isVip={isVip}
      >
         {/* 把 GPS 狀態放在 Header 裡面顯示 */}
         <div className="mt-2 flex justify-end">
            <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold shadow-sm">
               {renderGpsLabel()}
            </div>
         </div>
      </PortalTopHeader>

      {/* 🟢 公告區塊 (關鍵修正) */}
      {announcements && announcements.length > 0 ? (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
              <Bell size={64} className="text-orange-500" />
          </div>
          <div className="flex items-center gap-2 mb-3 relative z-10">
             <div className="bg-orange-100 p-1.5 rounded-full">
                <Bell size={16} className="text-orange-600 fill-orange-600 animate-pulse" />
             </div>
             <h3 className="text-sm font-black text-orange-800">最新公告</h3>
          </div>
          <div className="space-y-2 relative z-10">
            {announcements.map((news, idx) => (
              <div key={idx} className="bg-white p-3 rounded-xl border border-orange-100 shadow-sm">
                <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-800 text-sm">{news.title}</span>
                    {news.created_at && (
                        <span className="text-[10px] text-slate-400">
                            {new Date(news.created_at).toLocaleDateString()}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{news.content}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // 若無公告，顯示佔位符 (可選)
         <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center text-xs text-slate-400">
            <Info size={16} className="mx-auto mb-1 opacity-50"/>
            目前沒有新公告
         </div>
      )}

      {/* 打卡按鈕區塊 */}
      <div className="flex flex-col items-center justify-center py-4">
          <button
            onClick={isWorking ? onClockOut : onClockIn}
            disabled={gpsStatus === 'locating'}
            className={`w-48 h-48 rounded-full shadow-2xl flex flex-col items-center justify-center text-white transition-all active:scale-95 relative overflow-hidden ${
              isWorking
                ? 'bg-gradient-to-b from-orange-400 to-orange-600 shadow-orange-200 ring-4 ring-orange-100'
                : 'bg-gradient-to-b from-teal-400 to-teal-600 shadow-teal-200 ring-4 ring-teal-100'
            }`}
          >
            {/* 動畫波紋效果 */}
            <div className="absolute inset-0 bg-white/10 rounded-full animate-ping opacity-20"></div>
            
            <Clock size={56} className="mb-2 opacity-90 relative z-10" />
            <span className="text-3xl font-black tracking-widest relative z-10">
              {isWorking ? '下班' : '上班'}
            </span>
            <span className="text-sm opacity-80 mt-2 font-mono relative z-10">
              {isWorking && latestLog?.clock_in_time
                ? `已工作: ${((Date.now() - new Date(latestLog.clock_in_time).getTime()) / 3600000).toFixed(1)} hr`
                : new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </button>
      </div>

      {/* 救援模式開關 */}
      {!isVip && (
        <div className="text-center pb-4">
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
            <div className="inline-flex items-center gap-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-xs font-bold border border-red-100 animate-pulse">
              <AlertTriangle size={12} /> 救援模式已啟用 (異常標記)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
