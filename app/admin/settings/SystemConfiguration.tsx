'use client';

import React, { useState, useEffect } from 'react';
import { Save, Building, Clock, MapPin } from 'lucide-react';

// 引入拆分後的積木面板
import OrganizationPanel from './system/OrganizationPanel';
import ShiftPanel from './system/ShiftPanel';
import AttendancePanel from './system/AttendancePanel';

type Entity = { id: string; name: string };

type JobTitleConfig = {
  name: string;
  in_roster: boolean;
};

type ShiftConfig = {
  id: string;      
  code: string;    
  name: string;    
  start: string;   
  end: string;     
};

type BusinessHoursConfig = {
  openDays: number[];
  shifts: ShiftConfig[];
};

type DbBusinessHours = {
  openDays?: number[];
  // DB 可能是：{ AM/PM/NIGHT: {start,end} } 或 shifts: ShiftConfig[]
  shifts?: any;
};

const DEFAULT_SHIFTS: ShiftConfig[] = [
  { id: '1', code: 'M', name: '早班', start: '08:00', end: '12:00' },
  { id: '2', code: 'A', name: '午班', start: '14:00', end: '18:00' },
  { id: '3', code: 'N', name: '晚班', start: '18:30', end: '21:30' },
];

const normalizeBusinessHoursForUi = (bh: DbBusinessHours | null | undefined): BusinessHoursConfig => {
  const openDays = Array.isArray(bh?.openDays) ? bh!.openDays : [1, 2, 3, 4, 5, 6];
  const rawShifts = bh?.shifts;

  // shifts: ShiftConfig[]
  if (Array.isArray(rawShifts)) {
    const parsed: ShiftConfig[] = rawShifts
      .map((s: any, idx: number) => ({
        id: String(s?.id ?? idx),
        code: String(s?.code ?? ''),
        name: String(s?.name ?? ''),
        start: String(s?.start ?? ''),
        end: String(s?.end ?? ''),
      }))
      .filter((s: ShiftConfig) => s.code && s.start && s.end);

    return { openDays, shifts: parsed.length > 0 ? parsed : DEFAULT_SHIFTS };
  }

  // shifts: { AM|PM|NIGHT: { start, end } }
  if (rawShifts && typeof rawShifts === 'object') {
    const mapShiftKeyToUi = (shiftKey: string) => {
      if (shiftKey === 'AM') return { code: 'M', name: '早班' };
      if (shiftKey === 'PM') return { code: 'A', name: '午班' };
      if (shiftKey === 'NIGHT') return { code: 'N', name: '晚班' };
      return { code: shiftKey, name: shiftKey };
    };

    const entries = Object.entries(rawShifts as Record<string, any>);
    const parsed: ShiftConfig[] = entries
      .map(([shiftKey, val]: any, idx: number) => {
        const { code, name } = mapShiftKeyToUi(shiftKey);
        return {
          id: String(idx),
          code,
          name,
          start: String(val?.start ?? ''),
          end: String(val?.end ?? ''),
        };
      })
      .filter((s: ShiftConfig) => s.start && s.end);

    return { openDays, shifts: parsed.length > 0 ? parsed : DEFAULT_SHIFTS };
  }

  return { openDays, shifts: DEFAULT_SHIFTS };
};

const denormalizeBusinessHoursForDb = (bh: BusinessHoursConfig) => {
  // DoctorRoster 使用 AM/PM/NIGHT 結構；StaffRosterView 也支援這種 object 格式
  const shiftKeyByCode: Record<string, string> = {
    M: 'AM',
    A: 'PM',
    N: 'NIGHT',
  };

  const shiftsObj: Record<string, { start: string; end: string }> = {};
  bh.shifts.forEach((s) => {
    const shiftKey = shiftKeyByCode[s.code] ?? s.code;
    shiftsObj[shiftKey] = { start: s.start, end: s.end };
  });

  return {
    openDays: bh.openDays,
    shifts: shiftsObj,
  };
};

const FALLBACK_ENTITIES: Entity[] = [
  { id: 'default', name: '預設單位' }
];

const DEFAULT_JOB_TITLES: JobTitleConfig[] = [
  { name: '店長/主管', in_roster: false },
  { name: '正職員工', in_roster: true },
  { name: '兼職員工', in_roster: true }
];

export default function SystemConfiguration() {
  const [activeTab, setActiveTab] = useState<'org' | 'shifts' | 'attendance'>('org');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ==========================================
  // 🟢 狀態管理 (State)
  // ==========================================
  const [entities, setEntities] = useState<Entity[]>([]);
  const [jobTitles, setJobTitles] = useState<JobTitleConfig[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursConfig>({ openDays: [1, 2, 3, 4, 5, 6], shifts: DEFAULT_SHIFTS });
  const [specialClinics, setSpecialClinics] = useState<string[]>([]); // 對應特殊業務標籤

  // 加班與考勤相關
  const [overtimeThreshold, setOvertimeThreshold] = useState<number>(8);
  const [overtimeApprovalRequired, setOvertimeApprovalRequired] = useState<boolean>(true);
  const [clockIgnoreGps, setClockIgnoreGps] = useState<boolean>(false);
  const [clinicData, setClinicData] = useState<any>(null);

  // ==========================================
  // 🟢 載入資料 (Fetch)
  // ==========================================
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // 1. 取得全域系統設定
        const sysRes = await fetch('/api/settings');
        const sysResult = await sysRes.json();
        if (sysResult.data) {
          const ents = sysResult.data.find((item: any) => item.key === 'org_entities');
          if (ents && ents.value) setEntities(JSON.parse(ents.value));
          else setEntities(FALLBACK_ENTITIES);

          const titles = sysResult.data.find((item: any) => item.key === 'job_titles');
          if (titles && titles.value) setJobTitles(JSON.parse(titles.value));
          else setJobTitles(DEFAULT_JOB_TITLES);

          const special = sysResult.data.find((item: any) => item.key === 'special_clinic_types');
          if (special && special.value) setSpecialClinics(JSON.parse(special.value));
        }

        // 2. 取得租戶層級設定 (營業時間, 考勤設定等)
        const clinicRes = await fetch('/api/settings?type=clinic');
        const clinicResult = await clinicRes.json();
        if (clinicResult.data) {
          // 安全解析 settings
          let settingsObj: any = clinicResult.data.settings || {};
          if (typeof settingsObj === 'string') {
            try {
              settingsObj = JSON.parse(settingsObj);
            } catch (e) {}
          }
          // 若 API 回傳為攤平結構 (沒有 clinicResult.data.settings)，則以 clinicResult.data 當作 settings
          if (!clinicResult.data.settings) {
            settingsObj = clinicResult.data;
          }
          setClinicData({ ...clinicResult.data, settings: settingsObj });

          // 🟢 核心修復：班別資料格式轉換 (將舊版 Object 轉為新版 Array)
          const loadedBh =
            clinicResult.data?.settings?.business_hours ?? clinicResult.data.business_hours;

          if (process.env.NODE_ENV !== 'production') {
            console.log('[SystemConfiguration] clinicResult.data keys:', Object.keys(clinicResult.data || {}));
            console.log('[SystemConfiguration] settings.business_hours:', clinicResult.data?.settings?.business_hours);
            console.log('[SystemConfiguration] business_hours:', clinicResult.data?.business_hours);
            console.log('[SystemConfiguration] loadedBh typeof:', typeof loadedBh);
          }

          if (loadedBh) {
            let upgradeBh: any = loadedBh;
            if (typeof upgradeBh === 'string') {
              try {
                upgradeBh = JSON.parse(upgradeBh);
              } catch (e) {}
            }

            let parsedShifts: any[] = [];
            if (upgradeBh.shifts) {
              if (Array.isArray(upgradeBh.shifts)) {
                parsedShifts = upgradeBh.shifts;
              } else {
                // 發現舊版 { AM: {start, end}, PM: {...} }，自動轉換為陣列！
                parsedShifts = Object.entries(upgradeBh.shifts).map(([key, val]: any, idx) => ({
                  id: String(idx),
                  code: key === 'AM' ? 'M' : key === 'PM' ? 'A' : 'N',
                  name: key === 'AM' ? '早診' : key === 'PM' ? '午診' : '晚診',
                  start: val.start || '00:00',
                  end: val.end || '00:00'
                }));
              }
            } else {
              parsedShifts = DEFAULT_SHIFTS;
            }

            if (process.env.NODE_ENV !== 'production') {
              console.log('[SystemConfiguration] upgradeBh:', upgradeBh);
              console.log('[SystemConfiguration] parsedShifts:', parsedShifts);
            }

            setBusinessHours({
              openDays: upgradeBh.openDays || [1, 2, 3, 4, 5, 6],
              shifts: parsedShifts
            });
          } else {
            setBusinessHours({ openDays: [1, 2, 3, 4, 5, 6], shifts: DEFAULT_SHIFTS });
          }

          if (settingsObj.overtime_threshold !== undefined) setOvertimeThreshold(Number(settingsObj.overtime_threshold));
          if (settingsObj.overtime_approval_required !== undefined) setOvertimeApprovalRequired(settingsObj.overtime_approval_required);
          if (settingsObj.clock_ignore_gps !== undefined) setClockIgnoreGps(settingsObj.clock_ignore_gps);
        }
      } catch (error) {
        console.error('Fetch settings error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  // ==========================================
  // 🟢 儲存資料 (Save)
  // ==========================================
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // 1. 儲存全域系統設定
      const updates = [
        { key: 'org_entities', value: JSON.stringify(entities) },
        { key: 'job_titles', value: JSON.stringify(jobTitles) },
        { key: 'special_clinic_types', value: JSON.stringify(specialClinics) }
      ];
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates) // 🟢 修正：拔除多餘的 { updates }，直接傳陣列
      });

      // 2. 儲存租戶層級設定
      const clinicSettingsPayload = {
        type: 'clinic', // 🟢 修正：明確告知後端這是 clinic 設定
        settings: {
          ...(clinicData?.settings || {}),
          // 🟢 修正：把 business_hours 放進 settings，確保 POST/GET 路徑一致並能寫入 DB
          business_hours: businessHours,
          overtime_threshold: overtimeThreshold,
          overtime_approval_required: overtimeApprovalRequired,
          clock_ignore_gps: clockIgnoreGps,
          gps_lat: clinicData?.settings?.gps_lat,
          gps_lng: clinicData?.settings?.gps_lng,
          gps_radius: clinicData?.settings?.gps_radius
        }
      };

      await fetch('/api/settings?type=clinic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clinicSettingsPayload)
      });

      alert('✅ 系統設定儲存成功！');
    } catch (error) {
      console.error('Save settings error:', error);
      alert('儲存失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">設定資料載入中...</div>;
  }

  return (
    <div className="w-full animate-fade-in relative pb-20">
      
      {/* 次選單 Tab */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-4">
        <button onClick={() => setActiveTab('org')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'org' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          <Building size={16} /> 組織與職稱
        </button>
        <button onClick={() => setActiveTab('shifts')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'shifts' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          <Clock size={16} /> 班別與業務標籤
        </button>
        <button onClick={() => setActiveTab('attendance')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition ${activeTab === 'attendance' ? 'bg-orange-600 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
          <MapPin size={16} /> 考勤與加班規則
        </button>
      </div>

      {/* 內容區塊渲染 (動態派發 Props 給積木) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        {activeTab === 'org' && (
          <OrganizationPanel
            entities={entities}
            setEntities={setEntities}
            jobTitles={jobTitles}
            setJobTitles={setJobTitles}
          />
        )}
        {activeTab === 'shifts' && (
          <ShiftPanel
            businessHours={businessHours}
            setBusinessHours={setBusinessHours}
            specialShiftTypes={specialClinics}
            setSpecialShiftTypes={setSpecialClinics}
          />
        )}
        {activeTab === 'attendance' && (
          <AttendancePanel
            overtimeThreshold={overtimeThreshold}
            setOvertimeThreshold={setOvertimeThreshold}
            overtimeApprovalRequired={overtimeApprovalRequired}
            setOvertimeApprovalRequired={setOvertimeApprovalRequired}
            clockIgnoreGps={clockIgnoreGps}
            setClockIgnoreGps={setClockIgnoreGps}
            clinicData={clinicData}
            setClinicData={setClinicData}
          />
        )}
      </div>

      {/* 吸頂/浮動儲存按鈕 */}
      <div className="fixed bottom-6 right-8 z-50">
        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-full text-base font-bold hover:bg-black transition shadow-2xl hover:scale-105 transform disabled:opacity-50 disabled:hover:scale-100"
          type="button"
        >
          <Save size={20} /> {isSaving ? '儲存中...' : '儲存系統設定'}
        </button>
      </div>
    </div>
  );
}