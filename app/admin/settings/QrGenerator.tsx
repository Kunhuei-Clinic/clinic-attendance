'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Download, Copy, Check } from 'lucide-react';
import { saveAs } from 'file-saver';

/**
 * Admin 後台「QR 下載」頁面
 * 產出診所 Portal 靜態 QR Code，URL 格式：https://your-domain.com/portal?clinic_id={clinicId}
 */
export default function QrGenerator() {
  const [clinicId, setClinicId] = useState<string>('');
  const [portalUrl, setPortalUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchClinicId();
  }, []);

  const fetchClinicId = async () => {
    try {
      const response = await fetch('/api/staff?is_active=true', {
        credentials: 'include',
      });
      const result = await response.json();

      if (result.data && result.data.length > 0 && result.data[0].clinic_id) {
        const id = result.data[0].clinic_id;
        setClinicId(id);

        const baseUrl =
          typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || '';
        const url = `${baseUrl}/portal?clinic_id=${encodeURIComponent(id)}`;
        setPortalUrl(url);
      }
    } catch (error) {
      console.error('取得診所 ID 失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!portalUrl) return;
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('複製失敗', error);
      alert('複製失敗，請手動複製連結');
    }
  };

  const handleDownloadQr = async () => {
    if (!portalUrl) return;
    try {
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(portalUrl)}`;
      const res = await fetch(qrImageUrl);
      const blob = await res.blob();
      saveAs(blob, `clinic-portal-qr-${clinicId || 'clinic'}.png`);
    } catch (error) {
      console.error('下載 QR 失敗', error);
      alert('下載失敗，請稍後再試');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!clinicId || !portalUrl) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-800">
        <p className="font-medium">無法取得診所 ID，請確認已登入且該診所有員工資料。</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-teal-600" />
          診所打卡 QR Code 下載
        </h2>
        <p className="text-sm text-slate-600">
          員工在 LINE 內開啟此連結或掃描下方 QR Code，即可進入員工 Portal 進行綁定與打卡。
        </p>

        <div className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-inner">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(portalUrl)}`}
              alt="診所 Portal QR Code"
              className="w-60 h-60"
            />
          </div>
          <button
            type="button"
            onClick={handleDownloadQr}
            className="flex items-center justify-center gap-2 w-full max-w-xs h-12 bg-teal-600 text-white rounded-xl font-bold shadow-md hover:bg-teal-700 transition"
          >
            <Download size={20} />
            下載 QR Code 圖片
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700">Portal 連結</label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={portalUrl}
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono truncate"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition shrink-0"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? '已複製' : '複製'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
