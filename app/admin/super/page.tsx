'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Plus, ArrowRight, ShieldAlert, X, Save, Landmark } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SuperAdminPortal() {
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  // 🟢 全域法規參數狀態
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [globalSettings, setGlobalSettings] = useState({
    nhi_2nd_rate: 0.0211,
    nhi_2nd_threshold: 27470,
    tax_rate: 0.05,
    tax_threshold_salary: 40000,
    tax_threshold_professional: 20000,
  });

  const fetchGlobalSettings = async () => {
    try {
      const res = await fetch('/api/super/settings');
      if (res.ok) {
        const result = await res.json();
        if (result.data) setGlobalSettings(result.data);
      }
    } catch (e) {
      console.error('Fetch global settings error', e);
    }
  };

  const saveGlobalSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/super/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalSettings),
      });
      const result = await res.json();
      if (!res.ok) {
        alert('儲存失敗：' + (result.error || '未知錯誤'));
        return;
      }
      if (result.data) setGlobalSettings(result.data);
      alert('全域法規參數更新成功！將自動套用於所有診所的下一次薪資結算。');
      setShowGlobalSettings(false);
    } catch (e) {
      alert('儲存失敗');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchClinics = async () => {
    try {
      const res = await fetch('/api/super/clinics');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '讀取失敗');
      setClinics(result.data || []);
    } catch (err: any) {
      setError(err.message || '未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  const handleCreateClinic = async () => {
    const name = prompt('請輸入新診所 (客戶) 名稱：');
    if (!name) return;

    try {
      const res = await fetch('/api/super/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const result = await res.json();
      if (result.success) {
        alert('✅ 新診所建立成功！');
        fetchClinics();
      } else {
        alert('❌ 建立失敗: ' + (result.error || result.message || '未知錯誤'));
      }
    } catch (err) {
      alert('發生錯誤');
    }
  };

  // 🟢 核心切換邏輯：種下 Cookie 並跳轉
  const handleEnterClinic = (clinicId: string, clinicName: string) => {
    document.cookie = `clinic_id=${clinicId}; path=/; max-age=2592000;`;
    alert(`切換至：${clinicName}`);
    router.push('/admin');
  };

  if (loading) {
    return <div className="p-10 text-center">載入總管視角中...</div>;
  }

  if (error) {
    return (
      <div className="p-10 text-center text-red-600 flex flex-col items-center gap-4">
        <ShieldAlert size={48} />
        <h2 className="text-2xl font-bold">存取被拒</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="bg-slate-900 rounded-2xl p-8 text-white flex justify-between items-center shadow-xl">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3">
              <Building2 size={32} className="text-blue-400" />
              平台總管控制台 (Super Admin)
            </h1>
            <p className="text-slate-400 mt-2">
              在這裡管理所有購買系統的診所租戶與分院資料，以及全域法規參數。
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                fetchGlobalSettings();
                setShowGlobalSettings(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-md"
            >
              <Landmark size={20} /> 全域法規參數
            </button>
            <button
              type="button"
              onClick={handleCreateClinic}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg"
            >
              <Plus size={20} /> 新增診所
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clinics.map((clinic) => (
            <div
              key={clinic.id}
              className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition"
            >
              <h3 className="text-xl font-bold text-slate-800 mb-2">
                {clinic.name}
              </h3>
              <p className="text-xs text-slate-400 font-mono mb-6">
                ID: {clinic.id}
              </p>
              <button
                type="button"
                onClick={() => handleEnterClinic(clinic.id, clinic.name)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition"
              >
                進入此診所後台 <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 🟢 全域法規參數設定 Modal */}
      {showGlobalSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Landmark size={20} className="text-yellow-400" />
                全域法定稅率與門檻設定
              </h3>
              <button
                type="button"
                onClick={() => setShowGlobalSettings(false)}
                className="p-2 hover:bg-slate-700 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 bg-slate-50 overflow-y-auto max-h-[70vh]">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl text-sm leading-relaxed">
                <strong>⚠️ 系統核心警告：</strong>
                <br />
                此處為系統層級之法定常數，修改後將<strong>立刻套用於全平台所有診所</strong>
                的下一次薪資結算。請確認法規宣佈調漲後再行修改。
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4 border-b pb-2">二代健保 (補充保費)</h4>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      扣繳費率 (例如 2.11% = 0.0211)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={globalSettings.nhi_2nd_rate}
                      onChange={(e) =>
                        setGlobalSettings({
                          ...globalSettings,
                          nhi_2nd_rate: Number(e.target.value),
                        })
                      }
                      className="w-full border p-2 rounded bg-slate-50 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      單次給付扣繳門檻 (現行基本工資)
                    </label>
                    <input
                      type="number"
                      value={globalSettings.nhi_2nd_threshold}
                      onChange={(e) =>
                        setGlobalSettings({
                          ...globalSettings,
                          nhi_2nd_threshold: Number(e.target.value),
                        })
                      }
                      className="w-full border p-2 rounded bg-slate-50 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4 border-b pb-2">預扣所得稅</h4>
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      預扣稅率 (例如 5% = 0.05)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={globalSettings.tax_rate}
                      onChange={(e) =>
                        setGlobalSettings({
                          ...globalSettings,
                          tax_rate: Number(e.target.value),
                        })
                      }
                      className="w-full border p-2 rounded bg-slate-50 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      一般薪資所得 (代號 50) 扣繳門檻
                    </label>
                    <input
                      type="number"
                      value={globalSettings.tax_threshold_salary}
                      onChange={(e) =>
                        setGlobalSettings({
                          ...globalSettings,
                          tax_threshold_salary: Number(e.target.value),
                        })
                      }
                      className="w-full border p-2 rounded bg-slate-50 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      執行業務所得 (代號 9A) 扣繳門檻
                    </label>
                    <input
                      type="number"
                      value={globalSettings.tax_threshold_professional}
                      onChange={(e) =>
                        setGlobalSettings({
                          ...globalSettings,
                          tax_threshold_professional: Number(e.target.value),
                        })
                      }
                      className="w-full border p-2 rounded bg-slate-50 font-mono outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowGlobalSettings(false)}
                className="px-6 py-2 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveGlobalSettings}
                disabled={isSavingSettings}
                className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={18} /> {isSavingSettings ? '儲存中...' : '確認發布套用'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
