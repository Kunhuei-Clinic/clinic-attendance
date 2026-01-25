'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, User, Briefcase } from 'lucide-react';

interface StaffEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: any | null; // null 表示新增模式
  onSave: () => void; // 儲存成功後的回呼
}

const DEFAULT_JOB_TITLES = ['醫師', '護理師', '行政', '藥師', '清潔'];

export default function StaffEditModal({ isOpen, onClose, initialData, onSave }: StaffEditModalProps) {
  const [editData, setEditData] = useState<any>(null);
  const [jobTitles, setJobTitles] = useState<string[]>(DEFAULT_JOB_TITLES);

  // 🟢 新增：讀取職稱列表
  useEffect(() => {
    const fetchJobTitles = async () => {
      try {
        const response = await fetch('/api/settings');
        const result = await response.json();
        if (result.data) {
          const jobTitlesItem = result.data.find((item: any) => item.key === 'job_titles');
          if (jobTitlesItem) {
            try {
              const titles = JSON.parse(jobTitlesItem.value);
              if (Array.isArray(titles) && titles.length > 0) {
                setJobTitles(titles);
              } else {
                setJobTitles(DEFAULT_JOB_TITLES);
              }
            } catch (e) {
              console.error('Parse job_titles error:', e);
              setJobTitles(DEFAULT_JOB_TITLES);
            }
          } else {
            setJobTitles(DEFAULT_JOB_TITLES);
          }
        } else {
          setJobTitles(DEFAULT_JOB_TITLES);
        }
      } catch (error) {
        console.error('Fetch job titles error:', error);
        setJobTitles(DEFAULT_JOB_TITLES);
      }
    };

    if (isOpen) {
      fetchJobTitles();
    }
  }, [isOpen]);

  // 當 initialData 改變時，更新 editData
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // 編輯模式
        setEditData({
          ...initialData
        });
      } else {
        // 新增模式
        setEditData({
          name: '',
          role: jobTitles.length > 0 ? jobTitles[0] : '護理師',
          entity: 'clinic',
          is_active: true,
          start_date: new Date().toISOString().slice(0, 10),
          salary_mode: 'hourly',
          base_salary: 0,
          insurance_labor: 0,
          insurance_health: 0,
          phone: '',
          address: '',
          emergency_contact: '',
          bank_account: '',
          id_number: ''
        });
      }
    }
  }, [isOpen, initialData, jobTitles]);

  const handleSave = async () => {
    if (!editData?.name) {
      alert("請輸入姓名");
      return;
    }
    
    const payload = {
      name: editData.name,
      role: editData.role,
      entity: editData.entity,
      is_active: editData.is_active,
      start_date: editData.start_date || null,
      salary_mode: editData.salary_mode || 'hourly',
      base_salary: Number(editData.base_salary) || 0,
      insurance_labor: Number(editData.insurance_labor) || 0,
      insurance_health: Number(editData.insurance_health) || 0,
      phone: editData.phone || null,
      address: editData.address || null,
      emergency_contact: editData.emergency_contact || null,
      bank_account: editData.bank_account || null,
      id_number: editData.id_number || null
    };

    try {
      let response;
      if (editData.id) {
        response = await fetch('/api/staff', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editData.id, ...payload })
        });
      } else {
        response = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const result = await response.json();
      if (result.success) {
        alert("儲存成功！");
        onSave(); // 呼叫回呼函數
        onClose();
      } else {
        alert("儲存失敗: " + result.message);
      }
    } catch (error) {
      console.error('Save staff error:', error);
      alert("儲存失敗");
    }
  };

  if (!isOpen || !editData) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
          <h3 className="font-bold text-lg flex items-center gap-2">
            {editData.id ? <Settings size={18}/> : <Plus size={18}/>} 
            {editData.id ? '編輯人員資料' : '新增人員'}
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full">
            <Settings size={18} className="rotate-45"/>
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-1">姓名</label>
              <input 
                type="text" 
                value={editData.name} 
                onChange={e => setEditData({...editData, name: e.target.value})} 
                className="w-full border p-2 rounded focus:ring-2 ring-blue-200 outline-none" 
                placeholder="真實姓名"
              />
            </div>
            <div className="col-span-1">
              <label className="block text-xs font-bold text-slate-500 mb-1">職稱</label>
              <select 
                value={editData.role} 
                onChange={e => setEditData({...editData, role: e.target.value})} 
                className="w-full border p-2 rounded bg-white"
              >
                {jobTitles.map((title) => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">所屬單位</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditData({...editData, entity: 'clinic'})} 
                  className={`flex-1 py-2 rounded border text-sm font-bold ${
                    editData.entity === 'clinic' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  診所
                </button>
                <button 
                  onClick={() => setEditData({...editData, entity: 'pharmacy'})} 
                  className={`flex-1 py-2 rounded border text-sm font-bold ${
                    editData.entity === 'pharmacy' 
                      ? 'bg-green-50 border-green-500 text-green-700' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  藥局
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">到職日期</label>
              <input 
                type="date" 
                value={editData.start_date || ''} 
                onChange={e => setEditData({...editData, start_date: e.target.value})} 
                className="w-full border p-2 rounded"
              />
            </div>
          </div>
          
          {/* 基本個資區塊 */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
              <User size={14}/>
              基本個資
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">電話</label>
                <input 
                  type="text" 
                  value={editData.phone || ''} 
                  onChange={e => setEditData({...editData, phone: e.target.value})} 
                  className="w-full border p-2 rounded bg-white"
                  placeholder="例：0912-345-678"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">身分證字號</label>
                <input 
                  type="text" 
                  value={editData.id_number || ''} 
                  onChange={e => setEditData({...editData, id_number: e.target.value})} 
                  className="w-full border p-2 rounded bg-white"
                  placeholder="例：A123456789"
                  maxLength={10}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 mb-1">地址</label>
                <input 
                  type="text" 
                  value={editData.address || ''} 
                  onChange={e => setEditData({...editData, address: e.target.value})} 
                  className="w-full border p-2 rounded bg-white"
                  placeholder="例：台北市信義區..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">緊急聯絡人</label>
                <input 
                  type="text" 
                  value={editData.emergency_contact || ''} 
                  onChange={e => setEditData({...editData, emergency_contact: e.target.value})} 
                  className="w-full border p-2 rounded bg-white"
                  placeholder="姓名 + 電話"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">銀行帳號</label>
                <input 
                  type="text" 
                  value={editData.bank_account || ''} 
                  onChange={e => setEditData({...editData, bank_account: e.target.value})} 
                  className="w-full border p-2 rounded bg-white"
                  placeholder="例：123-456-7890123"
                />
              </div>
            </div>
          </div>

          {/* 薪資設定（非醫師） */}
          {editData.role !== '醫師' && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 space-y-3">
              <div>
                <label className="block text-xs font-bold text-yellow-800 mb-2 flex items-center gap-1">
                  <Briefcase size={12}/> 薪資計算模式
                </label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditData({...editData, salary_mode: 'monthly'})} 
                    className={`flex-1 py-2 rounded border text-sm font-bold transition ${
                      editData.salary_mode === 'monthly' 
                        ? 'bg-slate-800 text-white border-slate-800' 
                        : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    月薪制
                  </button>
                  <button 
                    onClick={() => setEditData({...editData, salary_mode: 'hourly'})} 
                    className={`flex-1 py-2 rounded border text-sm font-bold transition ${
                      editData.salary_mode === 'hourly' 
                        ? 'bg-slate-800 text-white border-slate-800' 
                        : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    時薪制
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-yellow-800 mb-1">
                  基礎薪資 {editData.salary_mode === 'monthly' ? '(月薪)' : '(時薪)'}
                </label>
                <input 
                  type="number" 
                  value={editData.base_salary} 
                  onChange={e => setEditData({...editData, base_salary: e.target.value})} 
                  className="w-full border p-2 rounded font-mono font-bold text-right"
                />
                <p className="text-[10px] text-yellow-600 mt-1">
                  * {editData.salary_mode === 'monthly' ? '月薪制：用於計算每日薪資 (月薪 ÷ 30)' : '時薪制：用於計算工時薪資'}
                </p>
              </div>
            </div>
          )}

          {/* 保險設定 */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="text-xs font-bold text-slate-500 mb-3 border-b pb-1">保險設定 (每月固定扣除)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">勞保自付額</label>
                <input 
                  type="number" 
                  value={editData.insurance_labor} 
                  onChange={e => setEditData({...editData, insurance_labor: e.target.value})} 
                  className="w-full border p-2 rounded text-right text-red-500 font-bold"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">健保自付額</label>
                <input 
                  type="number" 
                  value={editData.insurance_health} 
                  onChange={e => setEditData({...editData, insurance_health: e.target.value})} 
                  className="w-full border p-2 rounded text-right text-red-500 font-bold"
                />
              </div>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button 
              onClick={onClose} 
              className="px-5 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 font-bold text-sm"
            >
              取消
            </button>
            <button 
              onClick={handleSave} 
              className="px-6 py-2.5 rounded-lg bg-slate-900 text-white hover:bg-black font-bold text-sm shadow-lg flex items-center gap-2"
            >
              <Save size={16}/> 儲存資料
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
