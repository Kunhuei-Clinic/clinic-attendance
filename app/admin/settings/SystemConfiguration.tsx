'use client';

import React, { useState, useEffect } from 'react';
import { Save, Clock, CalendarDays, LayoutGrid, Stethoscope, Trash2, Plus, User, ChevronDown, ChevronUp } from 'lucide-react';

type Entity = { id: string; name: string };

type JobTitleConfig = {
  name: string;
  in_roster: boolean;
};

type ShiftConfig = {
  id: string;      // 系統唯一識別碼 (例如 uuid 或時間戳)
  code: string;    // 短代號 (供排班表顯示，例如 M, A, N)
  name: string;    // 班別名稱 (例如 早診, 午診)
  start: string;   // 開始時間 (例如 08:00)
  end: string;     // 結束時間 (例如 12:00)
};

type BusinessHoursConfig = {
  openDays: number[];
  shifts: ShiftConfig[];
};

const DEFAULT_SHIFTS: ShiftConfig[] = [
  { id: '1', code: 'M', name: '早診', start: '08:00', end: '12:00' },
  { id: '2', code: 'A', name: '午診', start: '14:00', end: '18:00' },
  { id: '3', code: 'N', name: '晚診', start: '18:30', end: '21:30' }
];

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  openDays: [1, 2, 3, 4, 5, 6],
  shifts: DEFAULT_SHIFTS
};

const migrateBusinessHours = (raw: any): BusinessHoursConfig => {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_BUSINESS_HOURS;
  }

  const openDays = Array.isArray(raw.openDays) ? raw.openDays : DEFAULT_BUSINESS_HOURS.openDays;

  // 新版：shifts 已經是陣列格式
  if (Array.isArray(raw.shifts)) {
    const shifts: ShiftConfig[] = raw.shifts
      .map((s: any, index: number) => {
        if (!s) return null;
        const start = typeof s.start === 'string' ? s.start : '00:00';
        const end = typeof s.end === 'string' ? s.end : '00:00';
        const name = typeof s.name === 'string' && s.name ? s.name : `班別${index + 1}`;
        const code = typeof s.code === 'string' && s.code ? s.code.toUpperCase().slice(0, 2) : `S${index + 1}`;
        const id = typeof s.id === 'string' && s.id ? s.id : `${Date.now()}_${index}`;
        return { id, code, name, start, end };
      })
      .filter((s: ShiftConfig | null): s is ShiftConfig => !!s);

    return {
      openDays,
      shifts: shifts.length > 0 ? shifts : DEFAULT_SHIFTS
    };
  }

  // 舊版：shifts 為物件，例如 { AM: { start, end }, ... }
  if (raw.shifts && typeof raw.shifts === 'object') {
    const entries = Object.entries(raw.shifts as Record<string, any>);
    const shifts: ShiftConfig[] = entries.map(([key, value], index) => {
      const start = typeof value?.start === 'string' ? value.start : '00:00';
      const end = typeof value?.end === 'string' ? value.end : '00:00';

      let name = '';
      const upperKey = key.toUpperCase();
      if (upperKey === 'AM' || upperKey === 'M') name = '早診';
      else if (upperKey === 'PM' || upperKey === 'A') name = '午診';
      else if (upperKey === 'NIGHT' || upperKey === 'N') name = '晚診';
      else name = key;

      const code = upperKey.slice(0, 2);
      const id = `${Date.now()}_${index}`;

      return { id, code, name, start, end };
    });

    return {
      openDays,
      shifts: shifts.length > 0 ? shifts : DEFAULT_SHIFTS
    };
  }

  return DEFAULT_BUSINESS_HOURS;
};

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const DEFAULT_JOB_TITLES: JobTitleConfig[] = [
  { name: '醫師', in_roster: false }, // 醫師有獨立班表
  { name: '護理師', in_roster: true },
  { name: '行政', in_roster: true },
  { name: '藥師', in_roster: true },
  { name: '清潔', in_roster: false }
];

export default function SystemConfiguration() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleConfig[]>([]);
  const [specialClinics, setSpecialClinics] = useState<string[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursConfig>(DEFAULT_BUSINESS_HOURS);
  const [leaveCalculationSystem, setLeaveCalculationSystem] = useState<'anniversary' | 'calendar'>('anniversary');
  const [overtimeThreshold, setOvertimeThreshold] = useState(9);
  const [overtimeApprovalRequired, setOvertimeApprovalRequired] = useState(true);
  const [clockIgnoreGps, setClockIgnoreGps] = useState(false);
  const [clinicData, setClinicData] = useState<any | null>(null);
  const [expanded, setExpanded] = useState({
    entities: false,
    roles: false,
    shifts: false,
    special: false,
    leave: false,
    overtime: false,
  });

  const toggleSection = (section: keyof typeof expanded) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  const [clinicId, setClinicId] = useState<string>('');

  useEffect(() => {
    fetchSystemSettings();
    fetchClinicId();
    fetchClinicData();
  }, []);

  // 🟢 取得診所 ID 並組合綁定連結
  const fetchClinicId = async () => {
    try {
      // 從 staff API 取得第一個員工的 clinic_id（作為當前診所 ID）
      const response = await fetch('/api/staff?is_active=true', {
        credentials: 'include',
      });
      const result = await response.json();
      
      if (result.data && result.data.length > 0 && result.data[0].clinic_id) {
        setClinicId(result.data[0].clinic_id);
      }
    } catch (error) {
      console.error('Fetch clinic ID error:', error);
    }
  };

  // 🟢 讀取診所資料（JSONB settings.business_hours）
  const fetchClinicData = async () => {
    try {
      const response = await fetch('/api/clinics', {
        credentials: 'include',
      });
      const result = await response.json();

      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!data) return;

      setClinicData(data);
    } catch (error) {
      console.error('Fetch clinic data error:', error);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      // 取得系統設定
      const response = await fetch('/api/settings');
      const result = await response.json();
      if (result.data) {
        result.data.forEach((item: any) => {
          if (item.key === 'org_entities') {
            try { setEntities(JSON.parse(item.value)); } catch (e) { }
          }
          if (item.key === 'job_titles') {
            try { 
              const raw = JSON.parse(item.value);
              
              if (Array.isArray(raw) && raw.length > 0) {
                // 舊版：string[]
                if (typeof raw[0] === 'string') {
                  const converted: JobTitleConfig[] = (raw as string[]).map((name) => ({
                    name,
                    in_roster: name === '醫師' ? false : true
                  }));
                  setJobTitles(converted);
                } else {
                  // 新版：JobTitleConfig[] 或類似結構
                  const converted: JobTitleConfig[] = raw.map((jt: any) => ({
                    name: jt.name ?? '',
                    in_roster: typeof jt.in_roster === 'boolean'
                      ? jt.in_roster
                      : (jt.name === '醫師' ? false : true)
                  })).filter((jt: JobTitleConfig) => jt.name);
                  setJobTitles(converted.length > 0 ? converted : DEFAULT_JOB_TITLES);
                }
              } else {
                // 空陣列或非陣列時使用預設值
                setJobTitles(DEFAULT_JOB_TITLES);
              }
            } catch (e) { 
              // 解析失敗時使用預設值
              setJobTitles(DEFAULT_JOB_TITLES);
            }
          }
          if (item.key === 'special_clinic_types') {
            try { setSpecialClinics(JSON.parse(item.value)); } catch (e) { }
          }
          if (item.key === 'leave_calculation_system') {
            setLeaveCalculationSystem(item.value === 'calendar' ? 'calendar' : 'anniversary');
          }
        });
        
        // 🟢 如果沒有找到 job_titles 設定，使用預設值
        const hasJobTitles = result.data.some((item: any) => item.key === 'job_titles');
        if (!hasJobTitles) {
          setJobTitles(DEFAULT_JOB_TITLES);
        }
      } else {
        // 如果完全沒有資料，使用預設值
        setJobTitles(DEFAULT_JOB_TITLES);
      }

      // 取得診所設定（加班設定與班表）
      const clinicResponse = await fetch('/api/settings?type=clinic');
      const clinicResult = await clinicResponse.json();
      if (clinicResult.data) {
        setOvertimeThreshold(clinicResult.data.overtime_threshold ?? 9);
        setOvertimeApprovalRequired(clinicResult.data.overtime_approval_required !== false);
        setClockIgnoreGps(clinicResult.data.clock_ignore_gps === true);
        // 🟢 從 clinics.settings 讀取班表，完美相容舊資料
        if (clinicResult.data.business_hours) {
          setBusinessHours(migrateBusinessHours(clinicResult.data.business_hours));
        }
        // 🟢 合併診所設定至 clinicData.settings（供 GPS 表單使用）
        setClinicData((prev: any) => ({
          ...(prev || {}),
          settings: { ...(prev?.settings || {}), ...clinicResult.data },
        }));
      }
    } catch (error) {
      console.error('Fetch system settings error:', error);
    }
  };
  // 🟢 儲存至 system_settings (字典資料)
  const handleSaveSystemSetting = async (key: string, value: string) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ key, value }])
      });
      const result = await response.json();
      if (result.success) alert('✅ 儲存成功！');
      else alert('❌ 儲存失敗: ' + result.message);
    } catch (error) {
      alert('❌ 發生錯誤');
    }
  };

  // 🟢 儲存至 clinics.settings (核心設定)
  const handleSaveClinicSettings = async (settingsObj: any) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clinic', settings: settingsObj })
      });
      const result = await response.json();
      if (result.success) alert('✅ 儲存成功！');
      else alert('❌ 儲存失敗: ' + result.message);
    } catch (error) {
      alert('❌ 發生錯誤');
    }
  };

  const addEntity = () => setEntities([...entities, { id: 'unit_' + Date.now(), name: '' }]);
  const removeEntity = (idx: number) => {
    if (entities.length <= 1) return alert("至少保留一個單位");
    const newArr = [...entities]; newArr.splice(idx, 1); setEntities(newArr);
  };
  const updateEntityName = (idx: number, val: string) => {
    const newArr = [...entities]; newArr[idx].name = val; setEntities(newArr);
  };

  const addJobTitle = () => setJobTitles([...jobTitles, { name: '新職稱', in_roster: true }]);
  const removeJobTitle = (idx: number) => {
    if (jobTitles.length <= 1) return alert("至少保留一個職稱");
    const newArr = [...jobTitles]; newArr.splice(idx, 1); setJobTitles(newArr);
  };
  const updateJobTitleName = (idx: number, val: string) => {
    const newArr = [...jobTitles];
    newArr[idx] = { ...newArr[idx], name: val };
    setJobTitles(newArr);
  };
  const updateJobTitleInRoster = (idx: number, inRoster: boolean) => {
    const newArr = [...jobTitles];
    newArr[idx] = { ...newArr[idx], in_roster: inRoster };
    setJobTitles(newArr);
  };

  const addSpecial = () => setSpecialClinics([...specialClinics, '新門診']);
  const removeSpecial = (idx: number) => {
    const newArr = [...specialClinics]; newArr.splice(idx, 1); setSpecialClinics(newArr);
  };
  const updateSpecial = (idx: number, val: string) => {
    const newArr = [...specialClinics]; newArr[idx] = val; setSpecialClinics(newArr);
  };

  const toggleDay = (dayIndex: number) => {
    const newDays = businessHours.openDays.includes(dayIndex) 
      ? businessHours.openDays.filter(d => d !== dayIndex)
      : [...businessHours.openDays, dayIndex].sort();
    setBusinessHours({ ...businessHours, openDays: newDays });
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
      <div className="space-y-10">
        {/* 歸屬單位設定 (Entities) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all">
          <div 
            className="flex justify-between items-center cursor-pointer select-none"
            onClick={() => toggleSection('entities')}
          >
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <LayoutGrid size={16} /> 歸屬單位設定 (Entities)
            </label>
            <div className="flex items-center gap-3">
              {expanded.entities && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const name = prompt('請輸入新單位名稱 (例如：分院名稱)');
                    if (name) setEntities([...entities, { id: Date.now().toString(), name }]);
                  }}
                  className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 font-bold flex items-center gap-1 animate-fade-in"
                >
                  <Plus size={14} /> 新增單位
                </button>
              )}
              {expanded.entities ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
            </div>
          </div>

          {expanded.entities && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 animate-fade-in">
              {entities.map((ent, idx) => (
                <div key={ent.id} className="flex gap-3 items-center">
                  <div className="bg-slate-100 px-3 py-2 rounded text-xs font-mono text-slate-400 w-24 text-center">
                    ID: {ent.id}
                  </div>
                  <input 
                    type="text" 
                    value={ent.name} 
                    onChange={(e) => updateEntityName(idx, e.target.value)} 
                    className="flex-1 p-3 border rounded-lg text-lg font-bold outline-none focus:ring-2 focus:ring-blue-200" 
                    placeholder="單位名稱"
                  />
                  <button 
                    onClick={() => removeEntity(idx)} 
                    className="p-3 text-red-400 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={20}/>
                  </button>
                </div>
              ))}
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => handleSaveSystemSetting('org_entities', JSON.stringify(entities))} 
                  className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-black transition"
                >
                  <Save size={16}/> 儲存單位設定
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 職稱與排班權限 (Roles) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all">
          <div 
            className="flex justify-between items-center cursor-pointer select-none"
            onClick={() => toggleSection('roles')}
          >
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <User size={16} /> 職稱與排班權限
            </label>
            <div className="flex items-center gap-3">
              {expanded.roles && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const name = prompt('請輸入新職稱');
                    if (name) setJobTitles([...jobTitles, { name, in_roster: true }]);
                  }}
                  className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 font-bold flex items-center gap-1 animate-fade-in"
                >
                  <Plus size={14} /> 新職稱
                </button>
              )}
              {expanded.roles ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
            </div>
          </div>

          {expanded.roles && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3 animate-fade-in">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-2 space-y-1">
                <p className="text-sm text-blue-800">
                  設定系統中可用的職稱選項。這些職稱將出現在員工資料編輯表單的下拉選單中。
                </p>
                <p className="text-xs text-blue-700">
                  勾選「加入排班表」的職稱，會出現在員工排班畫面中；例如「醫師」通常使用獨立醫師班表，因此預設不加入一般員工排班。
                </p>
              </div>
              <div className="space-y-3">
                {jobTitles.map((title, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row md:items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs text-slate-400 px-2 py-1 bg-white rounded border">
                        #{idx + 1}
                      </span>
                      <input 
                        type="text" 
                        value={title.name} 
                        onChange={(e) => updateJobTitleName(idx, e.target.value)} 
                        className="flex-1 p-2 border rounded-lg font-bold outline-none focus:ring-2 focus:ring-blue-200" 
                        placeholder="職稱名稱，例如：護理師"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        id={`job-title-roster-${idx}`}
                        type="checkbox"
                        checked={title.in_roster}
                        onChange={(e) => updateJobTitleInRoster(idx, e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor={`job-title-roster-${idx}`}
                        className="text-xs md:text-sm text-slate-700 select-none"
                      >
                        加入排班表
                      </label>
                      <button 
                        onClick={() => removeJobTitle(idx)} 
                        className="ml-2 p-2 text-red-400 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 size={18}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => handleSaveSystemSetting('job_titles', JSON.stringify(jobTitles.length > 0 ? jobTitles : DEFAULT_JOB_TITLES))} 
                  className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-black transition"
                >
                  <Save size={16}/> 儲存職稱設定
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 班別與時間設定 (Shifts) */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all">
          <div 
            className="flex justify-between items-center cursor-pointer select-none"
            onClick={() => toggleSection('shifts')}
          >
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Clock size={16} /> 診所班別與時間設定 (支援多班制)
            </label>
            <div className="flex items-center gap-3">
              {expanded.shifts && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setBusinessHours(prev => ({
                      ...prev, 
                      shifts: [
                        ...prev.shifts, 
                        { id: Date.now().toString(), code: 'NEW', name: '新班別', start: '00:00', end: '00:00' }
                      ]
                    }));
                  }}
                  className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-50 font-bold flex items-center gap-1 animate-fade-in"
                >
                  <Plus size={14} /> 新增班別
                </button>
              )}
              {expanded.shifts ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
            </div>
          </div>

          {expanded.shifts && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-6 animate-fade-in">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-2 flex items-center gap-2">
                  <CalendarDays size={16}/> 每週營業日
                </label>
                <div className="flex gap-2">
                  {WEEKDAYS.map((day, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => toggleDay(idx)} 
                      className={`w-10 h-10 rounded-full font-bold transition ${
                        businessHours.openDays.includes(idx) 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {businessHours.shifts.map((shift, index) => (
                  <div key={shift.id} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <input 
                      type="text" 
                      value={shift.name}
                      onChange={e => {
                        const newShifts = [...businessHours.shifts];
                        newShifts[index] = { ...newShifts[index], name: e.target.value };
                        setBusinessHours({ ...businessHours, shifts: newShifts });
                      }}
                      className="w-24 border-b border-slate-300 p-1 text-sm font-bold focus:border-blue-500 outline-none"
                      placeholder="班別名稱"
                    />
                    <input 
                      type="text" 
                      value={shift.code}
                      onChange={e => {
                        const newShifts = [...businessHours.shifts];
                        newShifts[index] = { 
                          ...newShifts[index], 
                          code: e.target.value.toUpperCase().slice(0, 2) 
                        };
                        setBusinessHours({ ...businessHours, shifts: newShifts });
                      }}
                      className="w-12 border-b border-slate-300 p-1 text-sm font-mono text-center text-slate-500 focus:border-blue-500 outline-none"
                      placeholder="代號"
                      maxLength={2}
                    />
                    <div className="flex-1 flex items-center gap-2">
                      <input 
                        type="time" 
                        value={shift.start}
                        onChange={e => {
                          const newShifts = [...businessHours.shifts];
                          newShifts[index] = { ...newShifts[index], start: e.target.value };
                          setBusinessHours({ ...businessHours, shifts: newShifts });
                        }}
                        className="border p-1.5 rounded text-sm font-mono w-full"
                      />
                      <span className="text-slate-400">-</span>
                      <input 
                        type="time" 
                        value={shift.end}
                        onChange={e => {
                          const newShifts = [...businessHours.shifts];
                          newShifts[index] = { ...newShifts[index], end: e.target.value };
                          setBusinessHours({ ...businessHours, shifts: newShifts });
                        }}
                        className="border p-1.5 rounded text-sm font-mono w-full"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        if (window.confirm(`確定要刪除「${shift.name}」嗎？(不影響歷史排班紀錄)`)) {
                          setBusinessHours(prev => ({
                            ...prev,
                            shifts: prev.shifts.filter(s => s.id !== shift.id)
                          }));
                        }
                      }}
                      className="text-red-300 hover:text-red-500 p-1 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                💡 提示：代號 (如 M, A, N) 會顯示在排班表的小格子上。刪除或更改班別「不會」影響過去已經結算的薪資與排班紀錄。
              </p>
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => handleSaveClinicSettings({ business_hours: businessHours })} 
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm"
                >
                  <Save size={16}/> 儲存班別設定
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 特殊門診類型 */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all">
          <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => toggleSection('special')}>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Stethoscope size={16}/> 特殊門診類型</label>
            {expanded.special ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
          </div>
          {expanded.special && (
            <div className="mt-4 pt-4 border-t border-slate-200 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                {specialClinics.map((name, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input 
                      type="text" 
                      value={name} 
                      onChange={(e) => updateSpecial(idx, e.target.value)} 
                      className="flex-1 p-2 border rounded-lg font-bold outline-none focus:ring-2 focus:ring-purple-200" 
                      placeholder="門診名稱"
                    />
                    <button 
                      onClick={() => removeSpecial(idx)} 
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={18}/>
                    </button>
                  </div>
                ))}
                <button 
                  onClick={(e) => { e.stopPropagation(); addSpecial(); }} 
                  className="py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:bg-purple-50 font-bold flex items-center justify-center gap-2"
                >
                  <Plus size={18}/> 新增類型
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => handleSaveSystemSetting('special_clinic_types', JSON.stringify(specialClinics))} 
                  className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-black transition"
                >
                  <Save size={16}/> 儲存門診類型
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 特休計算制 */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all">
          <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => toggleSection('leave')}>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><CalendarDays size={16}/> 特休計算制</label>
            {expanded.leave ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
          </div>
          {expanded.leave && (
            <div className="mt-4 pt-4 border-t border-slate-200 animate-fade-in">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                <p className="text-sm text-blue-800 mb-2"><strong>週年制</strong>：以員工到職日為基準，每年週年日重新計算。</p>
                <p className="text-sm text-blue-800"><strong>曆年制</strong>：以日曆年度為基準，每年1月1日重新計算特休天數。</p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setLeaveCalculationSystem('anniversary')} 
                  className={`flex-1 p-4 rounded-xl border-2 transition ${
                    leaveCalculationSystem === 'anniversary' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  <div className="text-lg font-bold mb-1">週年制</div>
                  <div className="text-xs opacity-80">Anniversary System</div>
                </button>
                <button 
                  onClick={() => setLeaveCalculationSystem('calendar')} 
                  className={`flex-1 p-4 rounded-xl border-2 transition ${
                    leaveCalculationSystem === 'calendar' 
                      ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  <div className="text-lg font-bold mb-1">曆年制</div>
                  <div className="text-xs opacity-80">Calendar System</div>
                </button>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => handleSaveSystemSetting('leave_calculation_system', leaveCalculationSystem)} 
                  className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-black transition"
                >
                  <Save size={16}/> 儲存特休制度
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 加班設定 */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 transition-all">
          <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => toggleSection('overtime')}>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Clock size={16}/> 加班規則設定</label>
            {expanded.overtime ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
          </div>
          {expanded.overtime && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">加班門檻 (小時)</label>
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={overtimeThreshold}
                  onChange={(e) => setOvertimeThreshold(Number(e.target.value))}
                  className="w-full border p-3 rounded-lg bg-white text-lg font-bold"
                />
                <p className="text-xs text-slate-400 mt-1">當日工時超過此門檻時，系統會提示員工確認是否申請加班</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="overtime_approval"
                  checked={overtimeApprovalRequired}
                  onChange={(e) => setOvertimeApprovalRequired(e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="overtime_approval" className="text-sm font-bold text-slate-700">需要主管審核</label>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="clock_ignore_gps"
                  checked={clockIgnoreGps}
                  onChange={(e) => setClockIgnoreGps(e.target.checked)}
                  className="w-5 h-5"
                />
                <label htmlFor="clock_ignore_gps" className="text-sm font-bold text-slate-700">LINE 打卡不驗證 GPS（不讀取、不寫入定位）</label>
              </div>
              <p className="text-xs text-slate-400">啟用後，員工在 LINE Portal 打卡時將不要求定位，也不寫入 GPS 座標；適合僅用掃碼或室內訊號不佳的診所。</p>

              {/* 動態 GPS 設定 */}
              <div className="pt-4 mt-4 border-t border-slate-200">
                <label className="block text-sm font-bold text-slate-700 mb-2">診所 GPS 座標設定</label>
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="緯度 (Latitude)"
                    value={clinicData?.settings?.gps_lat ?? ''}
                    onChange={(e) =>
                      setClinicData({
                        ...clinicData,
                        settings: {
                          ...(clinicData?.settings || {}),
                          gps_lat: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        },
                      })
                    }
                    className="border p-2 rounded-lg text-sm bg-white"
                  />
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="經度 (Longitude)"
                    value={clinicData?.settings?.gps_lng ?? ''}
                    onChange={(e) =>
                      setClinicData({
                        ...clinicData,
                        settings: {
                          ...(clinicData?.settings || {}),
                          gps_lng: e.target.value === '' ? undefined : parseFloat(e.target.value),
                        },
                      })
                    }
                    className="border p-2 rounded-lg text-sm bg-white"
                  />
                </div>
                <div className="flex gap-3 items-center flex-wrap">
                  <input
                    type="number"
                    placeholder="容許半徑(公尺)"
                    value={clinicData?.settings?.gps_radius ?? 150}
                    onChange={(e) =>
                      setClinicData({
                        ...clinicData,
                        settings: {
                          ...(clinicData?.settings || {}),
                          gps_radius: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                        },
                      })
                    }
                    className="border p-2 rounded-lg text-sm bg-white w-32"
                  />
                  <span className="text-xs text-slate-500">公尺</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        alert('無法抓取目前位置');
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        (pos) =>
                          setClinicData({
                            ...clinicData,
                            settings: {
                              ...(clinicData?.settings || {}),
                              gps_lat: pos.coords.latitude,
                              gps_lng: pos.coords.longitude,
                            },
                          }),
                        () => alert('無法抓取目前位置')
                      );
                    }}
                    className="text-xs bg-teal-50 text-teal-600 px-3 py-1.5 rounded-lg font-bold hover:bg-teal-100"
                  >
                    📍 抓取我現在的位置
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() =>
                    handleSaveClinicSettings({
                      ...(clinicData?.settings || {}),
                      overtime_threshold: overtimeThreshold,
                      overtime_approval_required: overtimeApprovalRequired,
                      clock_ignore_gps: clockIgnoreGps,
                      gps_lat: clinicData?.settings?.gps_lat,
                      gps_lng: clinicData?.settings?.gps_lng,
                      gps_radius: clinicData?.settings?.gps_radius,
                    })
                  }
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition shadow-sm"
                >
                  <Save size={16} /> 儲存加班與打卡設定
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
