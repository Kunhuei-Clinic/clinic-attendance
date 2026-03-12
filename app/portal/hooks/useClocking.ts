'use client';

import { useState } from 'react';
import liff from '@line/liff';

const getDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const deg2rad = (deg: number) => deg * (Math.PI / 180);
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000;
};

export interface UseClockingParams {
  staffUser: any;
  profile: any;
  clinicSettings: any;
  logs: any[];
  overtimeSettings: { threshold: number; approvalRequired: boolean; clockIgnoreGps: boolean } | null;
  isWorking: boolean;
  clinicId: string;
  onSuccess: () => void | Promise<void>;
}

export function useClocking({
  staffUser,
  profile,
  clinicSettings,
  logs,
  overtimeSettings,
  isWorking,
  clinicId,
  onSuccess,
}: UseClockingParams) {
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'ok' | 'out_of_range' | 'error'>('idle');
  const [dist, setDist] = useState(0);
  const [isPunching, setIsPunching] = useState(false);
  const [bypassMode, setBypassMode] = useState(false);
  const [showOvertimeConfirm, setShowOvertimeConfirm] = useState(false);
  const [pendingClockOut, setPendingClockOut] = useState<{
    lat: number | null;
    lng: number | null;
    isBypass: boolean;
  } | null>(null);

  const submitLog = async (
    action: 'in' | 'out',
    lat: number | null,
    lng: number | null,
    isBypass: boolean,
    applyOvertime: boolean = false
  ) => {
    if (!staffUser?.id) return;
    try {
      if (action === 'in') {
        const response = await fetch('/api/attendance/clock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'in',
            staffId: staffUser.id,
            staffName: staffUser.name,
            gpsLat: lat,
            gpsLng: lng,
            isBypass,
          }),
          credentials: 'include',
        });
        if (response.status === 401) {
          alert('❌ 請重新登入');
          return;
        }
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '打卡失敗');
        alert('上班打卡成功！');
      } else {
        const lastLog = logs.find((l: any) => !l.clock_out_time);
        if (!lastLog) {
          alert('無上班紀錄');
          return;
        }
        const response = await fetch('/api/attendance/clock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'out',
            staffId: staffUser.id,
            staffName: staffUser.name,
            logId: lastLog.id,
            gpsLat: lat,
            gpsLng: lng,
            isBypass,
            applyOvertime,
          }),
          credentials: 'include',
        });
        if (response.status === 401) {
          alert('❌ 請重新登入');
          return;
        }
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '打卡失敗');
        alert('下班打卡成功！');
      }
      await onSuccess();
      setGpsStatus('idle');
      setBypassMode(false);
    } catch (err: any) {
      console.error('打卡錯誤:', err);
      alert('錯誤：' + (err.message || '打卡失敗，請重試'));
    }
  };

  const executeClock = async (action: 'in' | 'out', forceBypassFromScan?: boolean) => {
    if (isPunching) return;
    setIsPunching(true);
    try {
      if (action === 'out' && logs.length > 0 && logs[0].clock_in_time) {
        const clockInTime = new Date(logs[0].clock_in_time);
        const now = new Date();
        const workHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
        const threshold = overtimeSettings?.threshold || 9;
        if (workHours > threshold) {
          setPendingClockOut({ lat: null, lng: null, isBypass: false });
          setShowOvertimeConfirm(true);
          setIsPunching(false);
          return;
        }
      }

      const skipGps =
        bypassMode ||
        overtimeSettings?.clockIgnoreGps === true ||
        forceBypassFromScan === true;
      if (skipGps) {
        try {
          await submitLog(action, null, null, skipGps, false);
        } finally {
          setIsPunching(false);
        }
        return;
      }

      setGpsStatus('locating');
      if (!navigator.geolocation) {
        alert('GPS 未開');
        setGpsStatus('error');
        setIsPunching(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const clinicLat = clinicSettings?.gps_lat;
            const clinicLng = clinicSettings?.gps_lng;
            const allowedRadius = clinicSettings?.gps_radius ?? 150;
            if (clinicLat == null || clinicLng == null) {
              alert('系統尚未設定診所 GPS 座標，請聯繫管理員。');
              setGpsStatus('error');
              setIsPunching(false);
              return;
            }
            const d = getDist(latitude, longitude, clinicLat, clinicLng);
            setDist(Math.round(d));
            if (d <= allowedRadius) {
              setGpsStatus('ok');
              if (action === 'out' && logs.length > 0 && logs[0].clock_in_time) {
                const clockInTime = new Date(logs[0].clock_in_time);
                const now = new Date();
                const workHours =
                  (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
                const threshold = overtimeSettings?.threshold || 9;
                if (workHours > threshold) {
                  setPendingClockOut({
                    lat: latitude,
                    lng: longitude,
                    isBypass: false,
                  });
                  setShowOvertimeConfirm(true);
                  return;
                }
              }
              await submitLog(action, latitude, longitude, false, false);
            } else {
              setGpsStatus('out_of_range');
              alert(`距離太遠 (${Math.round(d)}m)`);
            }
          } finally {
            setIsPunching(false);
          }
        },
        (err) => {
          console.error(err);
          setGpsStatus('error');
          alert('定位失敗');
          setIsPunching(false);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } catch (e) {
      setIsPunching(false);
    }
  };

  const onScanClock = async () => {
    if (!liff.isInClient()) {
      alert('⚠️ 請在 LINE App 內開啟此頁面以使用掃碼功能');
      return;
    }
    try {
      const result = await liff.scanCodeV2();
      const scannedUrl = result.value;
      if (!scannedUrl) return;
      setTimeout(() => {
        const currentClinicId = profile?.clinic_id || staffUser?.clinic_id;
        if (
          scannedUrl.includes('liff.line.me') &&
          scannedUrl.includes(currentClinicId ?? '')
        ) {
          alert(
            'ℹ️ 這是員工綁定專用的 QR Code。\n您已登入系統，請掃描「打卡專用」的條碼。'
          );
          return;
        }
        if (!currentClinicId) {
          alert('❌ 無法取得診所資訊，請重新登入。');
          return;
        }
        if (scannedUrl.includes(currentClinicId)) {
          const isDynamic = scannedUrl.includes('clockin_dynamic_');
          const isStatic = scannedUrl.includes('clockin_static_');
          if (isDynamic) {
            const parts = scannedUrl.split('_');
            const token = parts[parts.length - 1];
            const timestamp = parseInt(parts[parts.length - 2], 10);
            if (!Number.isFinite(timestamp) || Date.now() - timestamp > 60000) {
              alert('❌ 條碼已過期！\n請掃描平板上最新的動態 QR Code。');
              return;
            }
            if (
              clinicSettings?.kiosk_token &&
              token !== clinicSettings.kiosk_token
            ) {
              alert(
                '❌ 來源無效！\n此端點機連結已作廢，請掃描現場最新條碼。'
              );
              return;
            }
            setBypassMode(true);
          }
          if (isStatic) {
            const parts = scannedUrl.split('_');
            const token = parts[parts.length - 1];
            if (
              clinicSettings?.static_qr_token &&
              token !== clinicSettings.static_qr_token
            ) {
              alert(
                '❌ 無效的條碼！\n此條碼已作廢，請掃描診所現場最新的打卡條碼。'
              );
              return;
            }
          }
          const action = isWorking ? 'out' : 'in';
          if (
            window.confirm(
              `✅ 掃描成功！\n請確認是否進行「${action === 'in' ? '上班' : '下班'}」打卡？`
            )
          ) {
            executeClock(action, isDynamic);
          }
        } else {
          alert('❌ 無效的 QR Code：此條碼不屬於本診所，或格式錯誤。');
        }
      }, 500);
    } catch (error: any) {
      console.error('[Portal] 掃描失敗:', error);
      if (error?.message && error.message.includes('permission')) {
        alert('❌ 掃描失敗：請檢查是否已授權 LINE 使用相機權限。');
      } else {
        alert('掃描功能暫時無法使用，請使用一般 GPS 打卡。');
      }
    }
  };

  const handleOvertimeConfirm = async (apply: boolean) => {
    setShowOvertimeConfirm(false);
    if (pendingClockOut) {
      await submitLog(
        'out',
        pendingClockOut.lat,
        pendingClockOut.lng,
        pendingClockOut.isBypass,
        apply
      );
      setPendingClockOut(null);
    }
  };

  return {
    gpsStatus,
    dist,
    isPunching,
    bypassMode,
    setBypassMode,
    executeClock,
    onScanClock,
    showOvertimeConfirm,
    pendingClockOut,
    handleOvertimeConfirm,
  };
}
