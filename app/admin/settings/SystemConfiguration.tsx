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

const DEFAULT_SHIFTS: ShiftConfig[] = [
  { id: '1', code: 'M', name: '早班', start: '08:00', end: '12:00' },
  { id: '2', code: 'A', name: '午班', start: '14:00', end: '18:00' },
  { id: '3', code: 'N', name: '晚班', start: '18:30', end: '21:30' },
];

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
        // 1. 取得全域系統設定 (組織、職稱、特殊標籤)
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
          setClinicData(clinicResult.data);
          if (clinicResult.data.business_hours) {
            setBusinessHours(clinicResult.data.business_hours);
          }
          const settings = clinicResult.data.settings || {};
          if (settings.overtime_threshold !== undefined) setOvertimeThreshold(Number(settings.overtime_threshold));
          if (settings.overtime_approval_required !== undefined) setOvertimeApprovalRequired(settings.overtime_approval_required);
          if (settings.clock_ignore_gps !== undefined) setClockIgnoreGps(settings.clock_ignore_gps);
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
        body: JSON.stringify({ updates })
      });

      // 2. 儲存租戶層級設定
      const clinicSettingsPayload = {
        business_hours: businessHours,
        settings: {
          ...(clinicData?.settings || {}),
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