'use client';

import React, { useState, useEffect } from 'react';
import { Building2, Plus, ArrowRight, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SuperAdminPortal() {
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

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
    // 寫入 Cookie (有效期 30 天)，讓後端 getClinicIdFromRequest 讀取
    document.cookie = `active_clinic_id=${clinicId}; path=/; max-age=2592000;`;
    alert(`切換至：${clinicName}`);
    router.push('/admin'); // 跳轉回一般的診所後台
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
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="bg-slate-900 rounded-2xl p-8 text-white flex justify-between items-center shadow-xl">
        <div>
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Building2 size={32} className="text-blue-400" />
            平台總管控制台 (Super Admin)
          </h1>
          <p className="text-slate-400 mt-2">
            在這裡管理所有購買系統的診所租戶與分院資料。
          </p>
        </div>
        <button
          onClick={handleCreateClinic}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg"
        >
          <Plus size={20} /> 新增診所
        </button>
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
              onClick={() => handleEnterClinic(clinic.id, clinic.name)}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition"
            >
              進入此診所後台 <ArrowRight size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

