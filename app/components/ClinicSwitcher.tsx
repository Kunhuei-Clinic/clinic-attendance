'use client';

import React, { useEffect, useState } from 'react';
import { Building2, ChevronDown } from 'lucide-react';

type UserClinic = { id: string; name: string; role: string };

export default function ClinicSwitcher() {
  const [clinics, setClinics] = useState<UserClinic[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 讀取目前的 Cookie，知道現在是在哪家分院
    const cookies = document.cookie.split('; ');
    const activeCookie = cookies.find((row) =>
      row.startsWith('active_clinic_id=')
    );
    if (activeCookie) {
      setActiveId(activeCookie.split('=')[1]);
    }

    const fetchUserClinics = async () => {
      try {
        const res = await fetch('/api/user/clinics');
        const result = await res.json();
        if (result.success && result.data.length > 0) {
          setClinics(result.data);
          // 如果沒有 cookie，預設顯示第一家
          if (!activeCookie) setActiveId(result.data[0].id);
        }
      } catch (error) {
        console.error('Fetch clinics error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserClinics();
  }, []);

  const handleSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClinicId = e.target.value;
    if (!newClinicId) return;

    // 🟢 寫入 Cookie (有效期 30 天)，這是切換分院的靈魂！
    document.cookie = `active_clinic_id=${newClinicId}; path=/; max-age=2592000;`;

    // 強制重整畫面，讓所有 API 帶著新 Cookie 重新出發，撈取新診所的資料
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-slate-200 h-8 w-32 rounded-lg" />
    );
  }

  // 💡 如果只有一家診所權限，只顯示純文字，不顯示下拉選單
  if (clinics.length <= 1) {
    return (
      <div className="flex items-center gap-2 text-sm font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-lg border border-slate-200">
        <Building2 size={16} className="text-slate-400" />
        {clinics[0]?.name || '載入中...'}
      </div>
    );
  }

  // 💡 如果有多家診所權限，顯示下拉切換器
  return (
    <div className="relative flex items-center bg-white border border-slate-300 rounded-lg shadow-sm px-3 py-1.5 hover:border-blue-400 transition focus-within:ring-2 focus-within:ring-blue-100 cursor-pointer">
      <Building2 size={16} className="text-blue-600 mr-2 shrink-0" />
      <select
        value={activeId}
        onChange={handleSwitch}
        className="appearance-none bg-transparent text-sm font-bold text-slate-800 pr-6 outline-none cursor-pointer w-full max-w-[200px] truncate"
      >
        {clinics.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.role === 'owner' ? '(負責人)' : ''}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="text-slate-400 absolute right-2 pointer-events-none"
      />
    </div>
  );
}

