'use client';

import React, { useState, useEffect } from 'react';
import { Save, X, User, DollarSign, Shield } from 'lucide-react';

// 🟢 引入我們剛建好的 4 個積木 (請確認相對路徑是否正確，這裡假設是從 views 連到 settings/staff)
import BasicInfoPanel from '../settings/staff/BasicInfoPanel';
import SalaryStrategyPanel from '../settings/staff/SalaryStrategyPanel';
import FixedAdjustmentsPanel from '../settings/staff/FixedAdjustmentsPanel';
import SecurityPanel from '../settings/staff/SecurityPanel';

const DEFAULT_JOB_TITLES = [
  { name: '醫師' }, { name: '護理師' }, { name: '行政' }, { name: '藥師' }, { name: '清潔' }
];

const FALLBACK_ENTITIES = [
  { id: 'clinic', name: '診所' }, { id: 'pharmacy', name: '藥局' }
];

export default function StaffEditModal({ isOpen, onClose, initialData, onSave }: any) {
  const [editData, setEditData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'salary' | 'security'>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [systemJobTitles, setSystemJobTitles] = useState(DEFAULT_JOB_TITLES);
  const [systemEntities, setSystemEntities] = useState(FALLBACK_ENTITIES);

  // 初始化資料
  useEffect(() => {
    if (isOpen) {
      // 🟢 抓取系統設定的職稱與部門
      fetch('/api/settings').then(res => res.json()).then((json) => {
        if (json.data) {
          const titles = json.data.find((item: any) => item.key === 'job_titles');
          if (titles && titles.value) setSystemJobTitles(JSON.parse(titles.value));
          
          const ents = json.data.find((item: any) => item.key === 'org_entities');
          if (ents && ents.value) setSystemEntities(JSON.parse(ents.value));
        }
      });

      if (initialData) {
        setEditData({ 
          ...initialData,
          // 🟢 自動判斷：若資料庫有 auth_user_id，代表已開通權限，自動打勾
          enable_login: !!initialData.auth_user_id 
        });
      } else {
        setEditData({
          name: '', email: '', role: '護理師', entity: 'clinic',
          employment_type: 'full_time', // 預設為正職
          part_time_weekly_hours: 20,
          salary_structure_type: 'standard', salary_mode: 'hourly',
          bonuses: [], default_deductions: [],
          income_type: 'salary',
          enable_nhi_2nd: false,
          enable_tax_withhold: false,
        });
      }
      setActiveTab('basic'); // 預設打開基本資料
    }
  }, [isOpen, initialData]);

  if (!isOpen || !editData) return null;

  // 🟢 統一的資料更新函數，傳給所有積木使用
  const handleChange = (field: string, value: any) => {
    setEditData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!editData.name || !editData.phone) {
      alert('姓名與手機號碼為必填欄位！');
      return;
    }

    setIsSaving(true);
    try {
      const method = initialData ? 'PATCH' : 'POST';
      const res = await fetch('/api/staff', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });

      const json = await res.json();
      if (json.success !== false) {
        onSave();
        onClose();
      } else {
        alert('儲存失敗: ' + (json.message || json.error));
      }
    } catch (error: any) {
      alert('系統錯誤: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-50 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="bg-slate-800 text-white p-5 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2">
            {initialData ? '編輯員工資料' : '新增員工'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full transition"><X size={20} /></button>
        </div>

        {/* 🟢 Tabs 分頁導覽 */}
        <div className="flex px-6 pt-4 bg-white border-b border-slate-200 shrink-0 gap-6">
          <button onClick={() => setActiveTab('basic')} className={`pb-3 font-bold flex items-center gap-2 border-b-4 transition-colors ${activeTab === 'basic' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <User size={18} /> 基本資料
          </button>
          <button onClick={() => setActiveTab('salary')} className={`pb-3 font-bold flex items-center gap-2 border-b-4 transition-colors ${activeTab === 'salary' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <DollarSign size={18} /> 薪資與獎懲設定
          </button>
          <button onClick={() => setActiveTab('security')} className={`pb-3 font-bold flex items-center gap-2 border-b-4 transition-colors ${activeTab === 'security' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
            <Shield size={18} /> 帳號與權限
          </button>
        </div>

        {/* 內容區塊 (動態渲染積木) */}
        {/* 🟢 加入 min-h-[550px] 固定高度，防止切換 Tab 時忽大忽小 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 min-h-[550px]">
          {activeTab === 'basic' && (
            <BasicInfoPanel data={editData} onChange={handleChange} jobTitles={systemJobTitles} entities={systemEntities} />
          )}
          {activeTab === 'salary' && (
            <div className="space-y-6">
              <SalaryStrategyPanel data={editData} onChange={handleChange} />
              <FixedAdjustmentsPanel data={editData} onChange={handleChange} />
            </div>
          )}
          {activeTab === 'security' && (
            <SecurityPanel data={editData} onChange={handleChange} isNewData={!initialData} />
          )}
        </div>

        {/* Footer */}
        <div className="bg-white p-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition">取消</button>
          <button onClick={handleSave} disabled={isSaving} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-md disabled:opacity-50">
            <Save size={18} /> {isSaving ? '儲存中...' : '儲存資料'}
          </button>
        </div>
      </div>
    </div>
  );
}

