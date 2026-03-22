import React from 'react';
import { Clock, MapPin, Smartphone } from 'lucide-react';

export default function AttendancePanel({
  overtimeThreshold,
  setOvertimeThreshold,
  overtimeApprovalRequired,
  setOvertimeApprovalRequired,
  clockIgnoreGps,
  setClockIgnoreGps,
  clinicData,
  setClinicData,
}: any) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 🟢 區塊 1：加班規則設定 */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Clock className="text-blue-600" size={18} /> 加班規則設定
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          設定員工單日正常工時的加班門檻，以及加班是否需要主管審核。
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">加班門檻 (小時)</label>
            <input
              type="number"
              min="1"
              max="24"
              step="0.5"
              value={overtimeThreshold}
              onChange={(e) => setOvertimeThreshold(Number(e.target.value))}
              className="border p-2 rounded-lg text-sm bg-white w-32 outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-500 ml-2">小時 (超過此時數即列入加班)</span>
          </div>

          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={overtimeApprovalRequired}
              onChange={(e) => setOvertimeApprovalRequired(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
            />
            <span className="text-sm font-bold text-slate-700">加班需主管審核 (打卡時需填寫原因)</span>
          </label>
        </div>
      </div>

      {/* 🟢 區塊 2：手機打卡與定位設定 */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Smartphone className="text-teal-600" size={18} /> 手機打卡與定位設定
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          控制員工是否能使用手機直接打卡，以及 GPS 定位範圍限制。
        </p>

        <div className="space-y-5">
          {/* 開放手機打卡開關 */}
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div>
              <div className="font-bold text-slate-700">開放手機定位 (直接) 打卡</div>
              <div className="text-xs text-slate-500 mt-1">
                若關閉，員工手機前台將隱藏打卡按鈕，僅能使用實體打卡機或掃描現場 QR Code。
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={clinicData?.settings?.allow_mobile_clockin !== false}
                onChange={(e) =>
                  setClinicData((prev: any) => ({
                    ...(prev || {}),
                    settings: { ...(prev?.settings || {}), allow_mobile_clockin: e.target.checked },
                  }))
                }
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600" />
            </label>
          </div>

          {/* 略過 GPS 驗證開關 */}
          <label className="flex items-center gap-2 cursor-pointer px-1">
            <input
              type="checkbox"
              checked={clockIgnoreGps}
              onChange={(e) => setClockIgnoreGps(e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded border-gray-300"
            />
            <span className="text-sm font-bold text-slate-700">略過 GPS 距離驗證 (允許遠端打卡)</span>
          </label>

          {/* GPS 座標與範圍設定 */}
          {!clockIgnoreGps && (
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
              <div className="text-sm font-bold text-slate-700 mb-1">診所中心座標與允許範圍</div>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="number"
                  step="0.000001"
                  placeholder="緯度 (Lat)"
                  value={clinicData?.settings?.gps_lat ?? ''}
                  onChange={(e) =>
                    setClinicData((prev: any) => ({
                      ...(prev || {}),
                      settings: {
                        ...(prev?.settings || {}),
                        gps_lat: e.target.value === '' ? undefined : parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="border p-2 rounded-lg text-sm bg-slate-50 w-32 outline-none focus:border-teal-500 font-mono"
                />
                <input
                  type="number"
                  step="0.000001"
                  placeholder="經度 (Lng)"
                  value={clinicData?.settings?.gps_lng ?? ''}
                  onChange={(e) =>
                    setClinicData((prev: any) => ({
                      ...(prev || {}),
                      settings: {
                        ...(prev?.settings || {}),
                        gps_lng: e.target.value === '' ? undefined : parseFloat(e.target.value),
                      },
                    }))
                  }
                  className="border p-2 rounded-lg text-sm bg-slate-50 w-32 outline-none focus:border-teal-500 font-mono"
                />
                <span className="text-slate-400">|</span>
                <span className="text-sm font-bold text-slate-600">允許半徑</span>
                <input
                  type="number"
                  placeholder="公尺"
                  value={clinicData?.settings?.gps_radius ?? 50}
                  onChange={(e) =>
                    setClinicData((prev: any) => ({
                      ...(prev || {}),
                      settings: {
                        ...(prev?.settings || {}),
                        gps_radius: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                      },
                    }))
                  }
                  className="border p-2 rounded-lg text-sm bg-white w-24 outline-none focus:border-teal-500 font-mono"
                />
                <span className="text-xs text-slate-500">公尺</span>

                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      alert('無法抓取目前位置');
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (pos) =>
                        setClinicData((prev: any) => ({
                          ...(prev || {}),
                          settings: {
                            ...(prev?.settings || {}),
                            gps_lat: pos.coords.latitude,
                            gps_lng: pos.coords.longitude,
                          },
                        })),
                      () => alert('無法抓取目前位置')
                    );
                  }}
                  className="ml-auto text-xs bg-teal-50 text-teal-700 px-3 py-2 rounded-lg font-bold hover:bg-teal-100 flex items-center gap-2 transition"
                >
                  <MapPin size={14} /> 抓取我現在的位置
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
