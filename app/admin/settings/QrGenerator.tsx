'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Download, Copy, Check, Users, TabletSmartphone, MapPin } from 'lucide-react';
import { saveAs } from 'file-saver';

export default function QrGenerator() {
  const [clinicId, setClinicId] = useState<string>('');
  const [staticToken, setStaticToken] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'bind' | 'static' | 'dynamic'>('bind');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // 動態條碼專用 Timestamp
  const [dynamicTime, setDynamicTime] = useState(Date.now());

  useEffect(() => {
    fetchClinicId();
  }, []);

  // 動態條碼計時器：每 30 秒更新一次
  useEffect(() => {
    if (activeTab === 'dynamic') {
      const interval = setInterval(() => setDynamicTime(Date.now()), 30000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const fetchClinicId = async () => {
    try {
      const response = await fetch('/api/staff?is_active=true', {
        credentials: 'include',
      });
      const result = await response.json();
      if (result.data && result.data.length > 0 && result.data[0].clinic_id) {
        setClinicId(result.data[0].clinic_id);
      }

      const settingsRes = await fetch('/api/settings?type=clinic', {
        credentials: 'include',
      });
      const settingsJson = await settingsRes.json();
      let currentToken = settingsJson.data?.static_qr_token;
      if (!currentToken) {
        currentToken = Math.random().toString(36).substring(2, 10);
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'clinic',
            settings: { static_qr_token: currentToken },
          }),
          credentials: 'include',
        });
      }
      setStaticToken(currentToken || '');
    } catch (error) {
      console.error('取得診所 ID 失敗', error);
    } finally {
      setLoading(false);
    }
  };

  const getQrContent = () => {
    if (activeTab === 'bind') {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2008669814-8OqQmkaL';
      return `https://liff.line.me/${liffId}?clinic_id=${clinicId}`;
    }
    if (activeTab === 'static') {
      return `clockin_static_${clinicId}_${staticToken}`;
    }
    if (activeTab === 'dynamic') {
      return `clockin_dynamic_${clinicId}_${dynamicTime}`;
    }
    return '';
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getQrContent());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      alert('複製失敗');
    }
  };

  const handleDownloadQr = async () => {
    try {
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getQrContent())}`;
      const res = await fetch(qrImageUrl);
      const blob = await res.blob();
      saveAs(blob, `clinic_${activeTab}_qr.png`);
    } catch (error) {
      alert('下載失敗');
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-slate-500">載入中...</div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('bind')}
          className={`flex-1 py-4 font-bold flex justify-center items-center gap-2 transition ${
            activeTab === 'bind'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <Users size={18} /> 1. 員工綁定連結
        </button>
        <button
          onClick={() => setActiveTab('static')}
          className={`flex-1 py-4 font-bold flex justify-center items-center gap-2 transition ${
            activeTab === 'static'
              ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <MapPin size={18} /> 2. 靜態打卡條碼
        </button>
        <button
          onClick={() => setActiveTab('dynamic')}
          className={`flex-1 py-4 font-bold flex justify-center items-center gap-2 transition ${
            activeTab === 'dynamic'
              ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <TabletSmartphone size={18} /> 3. 動態打卡條碼
        </button>
      </div>

      <div className="p-8 flex flex-col items-center">
        {/* 說明區塊 */}
        <div className="mb-8 w-full max-w-lg text-center">
          {activeTab === 'bind' && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm font-bold border border-red-200">
              ⚠️ 注意：此條碼僅供「新進員工」掃描綁定 LINE 帳號使用。<br />
              請勿隨意公開，以免非本診所人員嘗試登入。
            </div>
          )}
          {activeTab === 'static' && (
            <div className="bg-teal-50 text-teal-800 p-4 rounded-xl text-sm border border-teal-200">
              💡 這是固定不變的打卡條碼。<br />
              適合印成貼紙貼在診所門口，員工需透過 Portal 內的掃碼器掃描。<br />
              (系統將搭配 GPS 確保員工人在現場)
            </div>
          )}
          {activeTab === 'dynamic' && (
            <div className="flex flex-col items-center space-y-6 w-full">
              <div className="bg-purple-50 text-purple-800 p-4 rounded-xl text-sm border border-purple-200 text-center w-full">
                ⏱️ 動態條碼每 30 秒更新一次，具備最高防偽能力。<br />
                請將下方「Kiosk 專屬網址」傳送至櫃台的平板或電腦開啟。<br />
                員工掃描此動態碼將
                <span className="font-bold text-red-600 underline ml-1">自動免除 GPS 驗證</span>！
              </div>

              <div className="w-full space-y-2">
                <label className="block text-sm font-bold text-slate-700">
                  平板 Kiosk 專屬網址 (免登入)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      typeof window !== 'undefined'
                        ? `${window.location.origin}/kiosk?c=${clinicId}`
                        : ''
                    }
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 font-mono truncate"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/kiosk?c=${clinicId}`
                        );
                        alert('已複製 Kiosk 網址，請在平板的瀏覽器貼上開啟');
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition"
                  >
                    複製網址
                  </button>
                </div>
              </div>

              <a
                href={`/kiosk?c=${clinicId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-4 bg-purple-600 text-white rounded-xl font-bold shadow-lg hover:bg-purple-700 transition text-lg"
              >
                <TabletSmartphone size={24} /> 立即開啟 Kiosk 平板模式
              </a>
            </div>
          )}
        </div>

        {/* QR Code 顯示區塊（僅 bind / static 顯示） */}
        {activeTab !== 'dynamic' && (
          <div className="p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-inner relative w-full flex flex-col items-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(getQrContent())}`}
              alt="QR Code"
              className="w-56 h-56"
            />
          </div>
        )}

        {(activeTab === 'bind' || activeTab === 'static') && (
          <>
            <div className="flex gap-3 mt-8 w-full max-w-sm">
              {activeTab === 'bind' && (
                <button
                  onClick={handleCopyUrl}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />} 複製連結
                </button>
              )}
              <button
                onClick={handleDownloadQr}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-slate-800 text-white hover:bg-black rounded-xl font-bold transition shadow-lg"
              >
                <Download size={18} /> 下載圖片
              </button>
            </div>
            {activeTab === 'static' && (
              <div className="mt-6 pt-6 border-t border-teal-100 w-full flex flex-col items-center">
                <p className="text-xs text-slate-500 mb-2">
                  懷疑條碼外流？您可以重置條碼，舊條碼將立即失效。
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      !confirm(
                        '確定要更換靜態條碼嗎？\n更換後，舊的紙本條碼將無法打卡，您必須重新下載並列印新的條碼！'
                      )
                    )
                      return;
                    const newToken = Math.random().toString(36).substring(2, 10);
                    await fetch('/api/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        type: 'clinic',
                        settings: { static_qr_token: newToken },
                      }),
                      credentials: 'include',
                    });
                    setStaticToken(newToken);
                    alert('✅ 條碼已更新！請下載並列印最新條碼。');
                  }}
                  className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-bold hover:bg-red-50 transition"
                >
                  🔄 重置並產生新條碼
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
