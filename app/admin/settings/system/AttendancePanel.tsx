import React from 'react';
import { Clock, MapPin } from 'lucide-react';

export default function AttendancePanel({
  overtimeThreshold,
  setOvertimeThreshold,
  overtimeApprovalRequired,
  setOvertimeApprovalRequired,
  clockIgnoreGps,
  setClockIgnoreGps,
  clinicData,
  setClinicData
}: any) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 加班設定 */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-4">
          <Clock className="text-blue-600" size={18} /> 加班與打卡規則設定
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          設定加班門檻、是否需要主管審核，以及 LINE 打卡是否驗證 GPS。
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
              className="w-full border p-3 rounded-lg bg-white text-lg font-bold"
            />
            <p className="text-xs text-slate-400 mt-1">當日工時超過此門檻時，系統會提示員工確認是否申請加班。</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="overtime_approval"
              checked={overtimeApprovalRequired}
              onChange={(e) => setOvertimeApprovalRequired(e.target.checked)}
              className="w-5 h-5"
            />
            <label htmlFor="overtime_approval" className="text-sm font-bold text-slate-700">
              加班需要主管審核
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="clock_ignore_gps"
              checked={clockIgnoreGps}
              onChange={(e) => setClockIgnoreGps(e.target.checked)}
              className="w-5 h-5"
            />
            <label htmlFor="clock_ignore_gps" className="text-sm font-bold text-slate-700">
              LINE 打卡不驗證 GPS（不讀取、不寫入定位）
            </label>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-slate-200">
          <label className="block text-sm font-bold text-slate-700 mb-2">GPS 座標設定</label>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <input
              type="number"
              step="0.000001"
              placeholder="緯度 (Latitude)"
              value={clinicData?.settings?.gps_lat ?? ''}
              onChange={(e) =>
                setClinicData((prev: any) => ({
                  ...(prev || {}),
                  settings: {
                    ...(prev?.settings || {}),
                    gps_lat: e.target.value === '' ? undefined : parseFloat(e.target.value)
                  }
                }))
              }
              className="border p-2 rounded-lg text-sm bg-white"
            />
            <input
              type="number"
              step="0.000001"
              placeholder="經度 (Longitude)"
              value={clinicData?.settings?.gps_lng ?? ''}
              onChange={(e) =>
                setClinicData((prev: any) => ({
                  ...(prev || {}),
                  settings: {
                    ...(prev?.settings || {}),
                    gps_lng: e.target.value === '' ? undefined : parseFloat(e.target.value)
                  }
                }))
              }
              className="border p-2 rounded-lg text-sm bg-white"
            />
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <input
              type="number"
              placeholder="容許半徑(公尺)"
              value={clinicData?.settings?.gps_radius ?? 150}
              onChange={(e) =>
                setClinicData((prev: any) => ({
                  ...(prev || {}),
                  settings: {
                    ...(prev?.settings || {}),
                    gps_radius: e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                  }
                }))
              }
              className="border p-2 rounded-lg text-sm bg-white w-32"
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
                        gps_lng: pos.coords.longitude
                      }
                    })),
                  () => alert('無法抓取目前位置')
                );
              }}
              className="text-xs bg-teal-50 text-teal-600 px-3 py-1.5 rounded-lg font-bold hover:bg-teal-100 flex items-center gap-2"
            >
              <MapPin size={14} /> 抓取我現在的位置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

