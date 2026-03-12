'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clock } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function KioskPage() {
  const searchParams = useSearchParams();
  const clinicId = searchParams.get('c');
  const kioskToken = searchParams.get('k');
  const [time, setTime] = useState(new Date());
  const [qrTimestamp, setQrTimestamp] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const qrTimer = setInterval(() => setQrTimestamp(Date.now()), 30000);
    return () => clearInterval(qrTimer);
  }, []);

  if (!clinicId || !kioskToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-red-500 font-bold">
        無效或已作廢的端點機連結
      </div>
    );
  }

  const qrContent = `clockin_dynamic_${clinicId}_${qrTimestamp}_${kioskToken}`;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white select-none">
      <div className="absolute top-6 left-8 flex items-center gap-3 opacity-50">
        <Clock size={24} />
        <span className="text-xl font-bold tracking-widest">打卡端點機 (Kiosk)</span>
      </div>

      <div className="flex flex-col items-center space-y-12">
        <div className="text-center space-y-2">
          <div className="text-2xl text-teal-400 font-bold tracking-widest">
            {time.toLocaleDateString('zh-TW', {
              month: '2-digit',
              day: '2-digit',
              weekday: 'long',
            })}
          </div>
          <div className="text-8xl md:text-9xl font-black font-mono tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            {time.toLocaleTimeString('zh-TW', {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_0_40px_rgba(20,184,166,0.3)] relative">
          <div className="absolute -top-3 -right-3 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse shadow-lg flex items-center gap-1.5">
            <span className="w-2 h-2 bg-white rounded-full" />
            安全碼即時更新中
          </div>
          <QRCodeSVG value={qrContent} size={250} level="H" />
        </div>

        <div className="text-slate-400 text-lg font-bold tracking-widest">
          請使用員工 Portal 點選「掃描打卡」
        </div>
      </div>
    </div>
  );
}
