'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, Plus, User, Shield, DollarSign, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';

interface StaffEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: any | null; // null 表示新增模式
  onSave: () => void; // 儲存成功後的回呼
}

type Entity = { id: string; name: string };

type JobTitleConfig = {
  name: string;
  in_roster: boolean;
};

const DEFAULT_JOB_TITLES: JobTitleConfig[] = [
  { name: '醫師', in_roster: false }, // 醫師有獨立班表
  { name: '護理師', in_roster: true },
  { name: '行政', in_roster: true },
  { name: '藥師', in_roster: true },
  { name: '清潔', in_roster: false }
];

const FALLBACK_ENTITIES: Entity[] = [
  { id: 'clinic', name: '診所' },
  { id: 'pharmacy', name: '藥局' }
];

export default function StaffEditModal({ isOpen, onClose, initialData, onSave }: StaffEditModalProps) {
  const [editData, setEditData] = useState<any>(null);
  const [jobTitles, setJobTitles] = useState<JobTitleConfig[]>(DEFAULT_JOB_TITLES);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [phoneError, setPhoneError] = useState('');
  const [expandedSection, setExpandedSection] = useState<string>('basic'); // 🟢 控制區塊展開

  // 讀取系統設定：職稱與組織單位
  useEffect(() => {
    if (isOpen) {
      const fetchSettingsAndInit = async () => {
        try {
          const response = await fetch('/api/settings');
          const result = await response.json();

          let loadedJobTitles: JobTitleConfig[] = DEFAULT_JOB_TITLES;
          let loadedEntities: Entity[] = [];

          if (result.data) {
            const jobTitlesItem = result.data.find((item: any) => item.key === 'job_titles');
            if (jobTitlesItem) {
              try {
                const raw = JSON.parse(jobTitlesItem.value);
                if (Array.isArray(raw) && raw.length > 0) {
                  if (typeof raw[0] === 'string') {
                    loadedJobTitles = (raw as string[]).map((name) => ({
                      name,
                      in_roster: name === '醫師' ? false : true
                    }));
                  } else {
                    loadedJobTitles = raw
                      .map((jt: any) => ({
                        name: jt.name ?? '',
                        in_roster: typeof jt.in_roster === 'boolean'
                          ? jt.in_roster
                          : (jt.name === '醫師' ? false : true)
                      }))
                      .filter((jt: JobTitleConfig) => jt.name);
                    if (loadedJobTitles.length === 0) {
                      loadedJobTitles = DEFAULT_JOB_TITLES;
                    }
                  }
                } else {
                  loadedJobTitles = DEFAULT_JOB_TITLES;
                }
              } catch (e) {
                console.error('Parse job_titles error:', e);
                loadedJobTitles = DEFAULT_JOB_TITLES;
              }
            } else {
              loadedJobTitles = DEFAULT_JOB_TITLES;
            }

            const entitiesItem = result.data.find((item: any) => item.key === 'org_entities');
            if (entitiesItem) {
              try {
                const rawEnt = JSON.parse(entitiesItem.value);
                if (Array.isArray(rawEnt) && rawEnt.length > 0) {
                  loadedEntities = rawEnt
                    .map((e: any) => ({
                      id: e.id ?? '',
                      name: e.name ?? ''
                    }))
                    .filter((e: Entity) => e.id && e.name);
                }
              } catch (e) {
                console.error('Parse org_entities error:', e);
              }
            }
          }

          if (!loadedEntities || loadedEntities.length === 0) {
            loadedEntities = FALLBACK_ENTITIES;
          }

          setJobTitles(loadedJobTitles);
          setEntities(loadedEntities);

          // 🟢 初始化 editData（密碼邏輯）
          if (initialData) {
            // 編輯模式：密碼預設空白，避免誤改
            const defaultRole = loadedJobTitles[0]?.name || '護理師';
            const defaultEntity = loadedEntities[0]?.id || 'clinic';
            setEditData({
              ...initialData,
              role: initialData.role || defaultRole,
              entity: initialData.entity || defaultEntity,
              system_role: initialData.system_role || 'staff', // 🟢 系統權限預設
              password: '' // 🟢 編輯模式：密碼預設空白
            });
          } else {
            // 新增模式：給予預設值
            const defaultRole = loadedJobTitles[0]?.name || '護理師';
            const defaultEntity = loadedEntities[0]?.id || 'clinic';
            setEditData({
              name: '',
              role: defaultRole,
              entity: defaultEntity,
              is_active: true,
              start_date: new Date().toISOString().slice(0, 10),
              salary_mode: 'hourly',
              base_salary: 0,
              insurance_labor: 0,
              insurance_health: 0,
              phone: '',
              system_role: 'staff', // 🟢 新增模式預設為一般員工
              password: '0000', // 🟢 新增模式：預設密碼為 0000
              address: '',
              emergency_contact: '',
              bank_account: '',
              id_number: ''
            });
          }
          setExpandedSection('basic'); // 每次打開重置為展開基本資料
        } catch (error) {
          console.error('Fetch staff edit settings error:', error);
          setJobTitles(DEFAULT_JOB_TITLES);
          setEntities(FALLBACK_ENTITIES);
          if (initialData) {
            setEditData({
              ...initialData,
              system_role: initialData.system_role || 'staff',
              password: '' // 🟢 編輯模式：密碼預設空白
            });
          } else {
            setEditData({
              name: '',
              role: DEFAULT_JOB_TITLES[0].name,
              entity: FALLBACK_ENTITIES[0].id,
              is_active: true,
              start_date: new Date().toISOString().slice(0, 10),
              salary_mode: 'hourly',
              base_salary: 0,
              insurance_labor: 0,
              insurance_health: 0,
              phone: '',
              system_role: 'staff', // 🟢 新增模式預設為一般員工
              password: '0000', // 🟢 新增模式：預設密碼為 0000
              address: '',
              emergency_contact: '',
              bank_account: '',
              id_number: ''
            });
          }
          setExpandedSection('basic');
        }
      };

      fetchSettingsAndInit();
    } else {
      setEditData(null);
    }
  }, [isOpen, initialData]);

  const toggleSection = (sec: string) => {
    setExpandedSection(expandedSection === sec ? '' : sec);
  };

  const handleSave = async () => {
    if (!editData?.name) {
      alert("請輸入姓名");
      return;
    }

    // 🟢 驗證手機號碼（必填）
    if (!editData.phone || editData.phone.trim() === '') {
      setPhoneError('手機號碼為綁定帳號，務必填寫');
      // 自動展開基本資料區塊
      setExpandedSection('basic');
      return;
    } else {
      setPhoneError('');
    }
    
    const payload: any = {
      name: editData.name,
      role: editData.role,
      entity: editData.entity || 'clinic',
      system_role: editData.system_role || 'staff', // 🟢 系統權限
      is_active: editData.is_active,
      start_date: editData.start_date || null,
      salary_mode: editData.salary_mode || 'hourly',
      base_salary: Number(editData.base_salary) || 0,
      insurance_labor: Number(editData.insurance_labor) || 0,
      insurance_health: Number(editData.insurance_health) || 0,
      phone: editData.phone.trim(),
      address: editData.address || null,
      emergency_contact: editData.emergency_contact || null,
      bank_account: editData.bank_account || null,
      id_number: editData.id_number || null
    };

    // 🟢 處理密碼欄位
    if (editData.id) {
      // 編輯模式：只有當密碼欄位有值時才更新
      if (editData.password && editData.password.trim() !== '') {
        payload.password = editData.password.trim();
      }
      // 若密碼為空，不傳送 password 欄位（保持原密碼）
    } else {
      // 新增模式：必須有密碼（預設為 0000）
      payload.password = editData.password?.trim() || '0000';
    }

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
        onSave();
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
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
          {/* 🟢 區塊 1: 基本資料 (預設展開) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button 
              onClick={() => toggleSection('basic')} 
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition font-bold text-slate-700"
            >
              <span className="flex items-center gap-2">
                <User size={18}/> 基本資料
              </span>
              {expandedSection === 'basic' ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
            </button>
            {expandedSection === 'basic' && (
              <div className="p-4 bg-white space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">姓名</label>
                    <input 
                      type="text" 
                      value={editData.name} 
                      onChange={e => setEditData({...editData, name: e.target.value})} 
                      className="w-full border p-2 rounded focus:ring-2 ring-blue-200 outline-none" 
                      placeholder="真實姓名"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">職稱</label>
                    <select 
                      value={editData.role} 
                      onChange={e => setEditData({...editData, role: e.target.value})} 
                      className="w-full border p-2 rounded bg-white"
                    >
                      {jobTitles.map((title) => (
                        <option key={title.name} value={title.name}>{title.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">所屬單位</label>
                    {entities.length === 0 ? (
                      <div className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded p-2">
                        尚未設定組織單位，請先至「系統設定 &gt; 組織單位管理」新增單位。
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {entities.map((ent) => (
                          <button
                            key={ent.id}
                            onClick={() => setEditData({ ...editData, entity: ent.id })}
                            className={`px-3 py-2 rounded border text-xs md:text-sm font-bold transition ${
                              editData.entity === ent.id
                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {ent.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">狀態</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditData({...editData, is_active: true})}
                        className={`flex-1 py-2 rounded border text-sm font-bold transition ${
                          editData.is_active
                            ? 'bg-green-50 border-green-500 text-green-700'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        在職
                      </button>
                      <button
                        onClick={() => setEditData({...editData, is_active: false})}
                        className={`flex-1 py-2 rounded border text-sm font-bold transition ${
                          !editData.is_active
                            ? 'bg-red-50 border-red-500 text-red-700'
                            : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        離職
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    電話 <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="tel" 
                    value={editData.phone || ''} 
                    onChange={e => {
                      setEditData({...editData, phone: e.target.value});
                      if (phoneError) setPhoneError('');
                    }} 
                    className={`w-full border p-2 rounded bg-white ${
                      phoneError ? 'border-red-300 focus:ring-red-200' : ''
                    }`}
                    placeholder="例：0912-345-678"
                    required
                  />
                  {phoneError && (
                    <p className="text-xs text-red-500 mt-1 font-bold">{phoneError}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    手機號碼為綁定帳號，務必填寫
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 🟢 區塊 2: 帳號與安全 (預設收合) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button 
              onClick={() => toggleSection('security')} 
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition font-bold text-slate-700"
            >
              <span className="flex items-center gap-2">
                <Shield size={18}/> 帳號與安全
              </span>
              {expandedSection === 'security' ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
            </button>
            {expandedSection === 'security' && (
              <div className="p-4 bg-white space-y-4 animate-fade-in">
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-700">
                  <p className="font-bold mb-1">💡 提示</p>
                  <p>員工可透過 LINE 綁定自動登入。若需手動登入，請使用手機號碼與此密碼。</p>
                </div>

                {/* 🟢 系統權限設定 */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
                    <Shield size={12}/> 後台系統權限
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditData({ ...editData, system_role: 'staff' })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-bold transition flex flex-col items-center gap-1 ${
                        editData.system_role === 'staff'
                          ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                          : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>一般員工</span>
                      <span className="text-[10px] font-normal opacity-80">僅看班表打卡</span>
                    </button>
                    <button
                      onClick={() => setEditData({ ...editData, system_role: 'manager' })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-bold transition flex flex-col items-center gap-1 ${
                        editData.system_role === 'manager'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                          : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>排班主管</span>
                      <span className="text-[10px] font-normal opacity-80">可管理排班表</span>
                    </button>

                    {/* 🟢 新增：負責人 (Owner) 按鈕 */}
                    <button
                      onClick={() => setEditData({ ...editData, system_role: 'owner' })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-bold transition flex flex-col items-center gap-1 ${
                        editData.system_role === 'owner'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                          : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <span>負責人</span>
                      <span className="text-[10px] font-normal opacity-80">最高權限(含薪資)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">登入密碼</label>
                  <input 
                    type="text" 
                    value={editData.password || ''} 
                    onChange={e => setEditData({...editData, password: e.target.value})}
                    className="w-full border p-2 rounded font-mono tracking-widest bg-white"
                    placeholder={initialData ? "若不修改請留空 (保持原密碼)" : "預設 0000"}
                  />
                  {!initialData && (
                    <p className="text-xs text-slate-400 mt-1">
                      預設密碼為 0000，員工綁定時使用
                    </p>
                  )}
                  {initialData && (
                    <p className="text-xs text-slate-400 mt-1">
                      留空則保持原密碼不變
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 🟢 區塊 3: 薪資與人資設定 (預設收合) */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button 
              onClick={() => toggleSection('hr')} 
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition font-bold text-slate-700"
            >
              <span className="flex items-center gap-2">
                <DollarSign size={18}/> 薪資與人資設定
              </span>
              {expandedSection === 'hr' ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
            </button>
            {expandedSection === 'hr' && (
              <div className="p-4 bg-white space-y-4 animate-fade-in">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">到職日期</label>
                  <input 
                    type="date" 
                    value={editData.start_date || ''} 
                    onChange={e => setEditData({...editData, start_date: e.target.value})} 
                    className="w-full border p-2 rounded bg-white"
                  />
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
                        className="w-full border p-2 rounded font-mono font-bold text-right bg-white"
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
                        className="w-full border p-2 rounded text-right text-red-500 font-bold bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">健保自付額</label>
                      <input 
                        type="number" 
                        value={editData.insurance_health} 
                        onChange={e => setEditData({...editData, insurance_health: e.target.value})} 
                        className="w-full border p-2 rounded text-right text-red-500 font-bold bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 個人資料 */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h4 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <User size={14}/>
                    個人資料
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
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
              </div>
            )}
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
