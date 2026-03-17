'use client';

import React, { useState, useEffect, useRef } from 'react';
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

  // 登入權限相關
  const [enableLogin, setEnableLogin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('0000'); // 預設密碼
  const [newPassword, setNewPassword] = useState(''); // 既有帳號重設密碼

  // Sudo 二次驗證相關
  const [showSudoModal, setShowSudoModal] = useState(false);
  const [sudoPassword, setSudoPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const sudoVerifiedRef = useRef(false); // 驗證通過後接續儲存時跳過再次彈窗

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

          // 🟢 初始化 editData（密碼邏輯）與登入權限
          if (initialData) {
            // 編輯模式：密碼預設空白，避免誤改
            const defaultRole = loadedJobTitles[0]?.name || '護理師';
            const defaultEntity = loadedEntities[0]?.id || 'clinic';

            // 🟢 嘗試從既有資料還原銀行資訊（bank_info 優先，其次為舊的單一 bank_account）
            let bankInfo: any = {};
            if (initialData.bank_info) {
              try {
                bankInfo =
                  typeof initialData.bank_info === 'string'
                    ? JSON.parse(initialData.bank_info)
                    : initialData.bank_info;
              } catch {
                bankInfo = {};
              }
            }

            setEditData({
              ...initialData,
              role: initialData.role || defaultRole,
              entity: initialData.entity || defaultEntity,
              email: initialData.email || '', // 🟢 獨立的聯絡信箱
              password: '', // 🟢 編輯模式：密碼預設空白
              system_role: initialData.system_role || 'staff',
              admin_role: initialData.admin_role ?? 'none',
              bank_code: bankInfo.bank_code || '',
              branch_code: bankInfo.branch_code || '',
              account_number: bankInfo.account_number || ''
            });
            // 登入權限：已有 auth_user_id 表示已開通
            if (initialData.auth_user_id) {
              setEnableLogin(true);
              setLoginEmail(initialData.email || initialData.login_email || '');
            } else {
              setEnableLogin(false);
              setLoginEmail(initialData.email || '');
            }
            setLoginPassword('0000');
            setNewPassword('');
          } else {
            // 新增模式：給予預設值
            const defaultRole = loadedJobTitles[0]?.name || '護理師';
            const defaultEntity = loadedEntities[0]?.id || 'clinic';
            setEditData({
              name: '',
              email: '', // 🟢 獨立的聯絡信箱
              role: defaultRole,
              entity: defaultEntity,
              is_active: true,
              start_date: new Date().toISOString().slice(0, 10),
              salary_mode: 'hourly',
              base_salary: 0,
              insurance_labor: 0,
              insurance_health: 0,
              phone: '',
              password: '0000', // 🟢 新增模式：預設密碼為 0000
              address: '',
              emergency_contact: '',
              bank_account: '',
              bank_code: '',
              branch_code: '',
              account_number: '',
              id_number: '',
              system_role: 'staff',
              admin_role: 'none'
            });
            setEnableLogin(false);
            setLoginEmail('');
            setLoginPassword('0000');
            setNewPassword('');
          }
          setExpandedSection('basic'); // 每次打開重置為展開基本資料
        } catch (error) {
          console.error('Fetch staff edit settings error:', error);
          setJobTitles(DEFAULT_JOB_TITLES);
          setEntities(FALLBACK_ENTITIES);
          if (initialData) {
            let bankInfo: any = {};
            if (initialData.bank_info) {
              try {
                bankInfo =
                  typeof initialData.bank_info === 'string'
                    ? JSON.parse(initialData.bank_info)
                    : initialData.bank_info;
              } catch {
                bankInfo = {};
              }
            }
            setEditData({
              ...initialData,
              email: initialData.email || '', // 🟢 獨立的聯絡信箱
              password: '',
              system_role: initialData.system_role || 'staff',
              admin_role: initialData.admin_role ?? 'none',
              bank_code: bankInfo.bank_code || '',
              branch_code: bankInfo.branch_code || '',
              account_number: bankInfo.account_number || ''
            });
            if (initialData.auth_user_id) {
              setEnableLogin(true);
              setLoginEmail(initialData.email || initialData.login_email || '');
            } else {
              setEnableLogin(false);
              setLoginEmail(initialData.email || '');
            }
            setLoginPassword('0000');
            setNewPassword('');
          } else {
            setEditData({
              name: '',
              email: '', // 🟢 獨立的聯絡信箱
              role: DEFAULT_JOB_TITLES[0].name,
              entity: FALLBACK_ENTITIES[0].id,
              is_active: true,
              start_date: new Date().toISOString().slice(0, 10),
              salary_mode: 'hourly',
              base_salary: 0,
              insurance_labor: 0,
              insurance_health: 0,
              phone: '',
              password: '0000', // 🟢 新增模式：預設密碼為 0000
              address: '',
              emergency_contact: '',
              bank_account: '',
              bank_code: '',
              branch_code: '',
              account_number: '',
              id_number: '',
              system_role: 'staff',
              admin_role: 'none'
            });
            setEnableLogin(false);
            setLoginEmail('');
            setLoginPassword('0000');
            setNewPassword('');
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

  const confirmSudo = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: sudoPassword })
      });
      if (res.ok) {
        setShowSudoModal(false);
        setSudoPassword('');
        sudoVerifiedRef.current = true;
        setTimeout(() => handleSave(), 100); // 驗證成功後自動接續儲存
      } else {
        alert('密碼驗證失敗，權限開通遭拒。');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!editData?.name) {
      alert("請輸入姓名");
      return;
    }

    // 🟢 驗證手機號碼（必填）
    if (!editData.phone || editData.phone.trim() === '') {
      setPhoneError('手機號碼為綁定帳號，務必填寫');
      setExpandedSection('basic');
      return;
    }
    setPhoneError('');

    // 🔒 安全攔截：若要「新開通權限」或「設定為負責人」，須經二次驗證
    const isGrantingNewLogin = enableLogin && !initialData?.auth_user_id;
    const isGrantingOwner = editData.system_role === 'owner';

    if ((isGrantingNewLogin || isGrantingOwner) && !sudoVerifiedRef.current) {
      setShowSudoModal(true);
      return;
    }
    // 接續儲存時清除 ref，避免下次儲存誤跳過
    sudoVerifiedRef.current = false;

    // 🟢 若有輸入結構化銀行資料，順便組出傳統 bank_account 字串（維持相容）
    const structuredBankParts = [
      editData.bank_code?.trim() || '',
      editData.branch_code?.trim() || '',
      editData.account_number?.trim() || ''
    ].filter(Boolean);
    const combinedBankAccount =
      editData.bank_account?.trim() ||
      (structuredBankParts.length > 0 ? structuredBankParts.join('-') : null);

    const payload: any = {
      name: editData.name,
      email: editData.email?.trim() || null, // 🟢 儲存一般聯絡信箱
      role: editData.role,
      entity: editData.entity || 'clinic',
      is_active: editData.is_active,
      start_date: editData.start_date || null,
      salary_mode: editData.salary_mode || 'hourly',
      base_salary: Number(editData.base_salary) || 0,
      insurance_labor: Number(editData.insurance_labor) || 0,
      insurance_health: Number(editData.insurance_health) || 0,
      phone: editData.phone.trim(),
      address: editData.address || null,
      emergency_contact: editData.emergency_contact || null,
      bank_account: combinedBankAccount,
      bank_info: {
        bank_code: editData.bank_code?.trim() || null,
        branch_code: editData.branch_code?.trim() || null,
        account_number: editData.account_number?.trim() || null
      },
      id_number: editData.id_number || null,
      enable_login: enableLogin,
      new_password: newPassword,
      login_email: loginEmail,
      login_password: loginPassword,
      system_role: editData.system_role || 'staff',
      admin_role: editData.admin_role ?? 'none'
    };

    // 🟢 處理密碼欄位
    if (editData.id) {
      if (editData.password && editData.password.trim() !== '') {
        payload.password = editData.password.trim();
      }
    } else {
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
                {/* LINE 系統管理權限（進階設定） */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    LINE 系統管理權限 <span className="text-slate-400 font-normal">(admin_role)</span>
                  </label>
                  <select
                    value={editData.admin_role ?? 'none'}
                    onChange={e => setEditData({ ...editData, admin_role: e.target.value })}
                    className="w-full border border-blue-200 bg-white p-2 rounded-lg text-sm text-slate-700"
                  >
                    <option value="none">無管理權限（預設）</option>
                    <option value="manager">主管</option>
                    <option value="owner">診所負責人</option>
                  </select>
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
                {/* 🟢 獨立的聯絡信箱欄位 (用於接收薪資單等通知) */}
                <div className="col-span-2 mt-2">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    電子信箱 (Email)
                  </label>
                  <input 
                    type="email" 
                    value={editData.email || ''} 
                    onChange={e => setEditData({...editData, email: e.target.value})} 
                    className="w-full border p-2 rounded bg-white"
                    placeholder="用於接收薪資單通知或系統信件"
                  />
                </div>
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
                {/* 開通系統登入權限 */}
                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-3 cursor-pointer mb-4">
                    <input
                      type="checkbox"
                      checked={enableLogin}
                      onChange={(e) => setEnableLogin(e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="font-bold text-slate-700">開通系統登入權限</span>
                  </label>

                  {enableLogin && (
                    <div className="space-y-4 pl-8 border-l-2 border-blue-200 ml-2 animate-fade-in">
                      {!initialData?.auth_user_id ? (
                        <>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">登入 Email 帳號</label>
                            <input
                              type="email"
                              value={loginEmail}
                              onChange={e => setLoginEmail(e.target.value)}
                              className="w-full border p-2 rounded-lg bg-white"
                              placeholder="例如：staff@clinic.com"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">預設登入密碼</label>
                            <input
                              type="text"
                              value={loginPassword}
                              onChange={e => setLoginPassword(e.target.value)}
                              className="w-full border p-2 rounded-lg bg-white"
                            />
                            <p className="text-xs text-slate-400 mt-1">員工首次登入後可自行修改密碼</p>
                          </div>
                        </>
                      ) : (
                        <div className="bg-orange-50 p-3 rounded-lg border border-orange-100">
                          <label className="block text-xs font-bold text-orange-800 mb-1">強制重設密碼 (若不修改請留空)</label>
                          <input
                            type="text"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="w-full border p-2 rounded-lg"
                            placeholder="輸入新密碼..."
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">系統權限</label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, system_role: 'staff' })}
                            className={`px-3 py-2 rounded-lg border text-sm font-bold transition ${
                              (editData.system_role || 'staff') === 'staff'
                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            一般員工
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, system_role: 'manager' })}
                            className={`px-3 py-2 rounded-lg border text-sm font-bold transition ${
                              editData.system_role === 'manager'
                                ? 'bg-blue-50 border-blue-500 text-blue-700'
                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            排班主管
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditData({ ...editData, system_role: 'owner' })}
                            className={`px-3 py-2 rounded-lg border text-sm font-bold transition ${
                              editData.system_role === 'owner'
                                ? 'bg-amber-50 border-amber-500 text-amber-700'
                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            負責人
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-xs text-yellow-700">
                  <p className="font-bold mb-1">💡 提示</p>
                  <p>員工可透過 LINE 綁定自動登入。若需手動登入，請使用手機號碼與此密碼。</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">LINE系統登入密碼</label>
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
                      <label className="block text-xs font-bold text-slate-500 mb-1">銀行代碼</label>
                      <input
                        type="text"
                        value={editData.bank_code || ''}
                        onChange={e => setEditData({ ...editData, bank_code: e.target.value })}
                        className="w-full border p-2 rounded bg-white"
                        placeholder="例：808"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">分行代碼</label>
                      <input
                        type="text"
                        value={editData.branch_code || ''}
                        onChange={e => setEditData({ ...editData, branch_code: e.target.value })}
                        className="w-full border p-2 rounded bg-white"
                        placeholder="例：0123"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1">銀行帳號</label>
                      <input
                        type="text"
                        value={editData.account_number || ''}
                        onChange={e => setEditData({ ...editData, account_number: e.target.value })}
                        className="w-full border p-2 rounded bg-white"
                        placeholder="例：1234567890123"
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

      {/* Sudo 二次驗證視窗 */}
      {showSudoModal && (
        <div className="fixed inset-0 bg-slate-900/90 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl border-4 border-red-500 animate-fade-in">
            <h3 className="text-xl font-bold text-center mb-2 text-red-600">⚠️ 系統權限開通確認</h3>
            <p className="text-sm text-slate-600 text-center mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
              此動作將會建立登入帳號，並正式開通對方登入本系統後台的權限。<br/><br/>
              為保護診所資訊安全，請輸入<strong className="text-red-600">「您本人的登入密碼」</strong>以驗證身分：
            </p>
            <input
              type="password"
              value={sudoPassword}
              onChange={e => setSudoPassword(e.target.value)}
              className="w-full border-2 border-slate-300 p-3 rounded-xl mb-4 text-center text-lg focus:border-red-500 outline-none"
              placeholder="請輸入您的密碼"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => setShowSudoModal(false)} className="flex-1 py-3 font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200">取消</button>
              <button onClick={confirmSudo} disabled={isVerifying} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 disabled:opacity-50">
                {isVerifying ? '驗證中...' : '確認開通'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
