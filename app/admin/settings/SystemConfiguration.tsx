'use client';

import React, { useState, useEffect } from 'react';
import { Save, Clock, CalendarDays, LayoutGrid, Stethoscope, Trash2, Plus } from 'lucide-react';

type Entity = { id: string; name: string };
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function SystemConfiguration() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [specialClinics, setSpecialClinics] = useState<string[]>([]);
  const [businessHours, setBusinessHours] = useState({
    openDays: [1,2,3,4,5,6], 
    shifts: {
      AM: { start: '08:00', end: '12:30' },
      PM: { start: '14:00', end: '17:30' },
      NIGHT: { start: '18:00', end: '21:30' }
    }
  });
  const [leaveCalculationSystem, setLeaveCalculationSystem] = useState<'anniversary' | 'calendar'>('anniversary');
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [systemMessage, setSystemMessage] = useState('');
  const [overtimeThreshold, setOvertimeThreshold] = useState(9);
  const [overtimeApprovalRequired, setOvertimeApprovalRequired] = useState(true);

  useEffect(() => {
    fetchSystemSettings();
  }, []);

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
          if (item.key === 'special_clinic_types') {
            try { setSpecialClinics(JSON.parse(item.value)); } catch (e) { }
          }
          if (item.key === 'clinic_business_hours') {
            try { setBusinessHours(JSON.parse(item.value)); } catch (e) { }
          }
          if (item.key === 'leave_calculation_system') {
            setLeaveCalculationSystem(item.value === 'calendar' ? 'calendar' : 'anniversary');
          }
        });
      }

      // 取得診所設定（加班設定）
      const clinicResponse = await fetch('/api/settings?type=clinic');
      const clinicResult = await clinicResponse.json();
      if (clinicResult.data) {
        setOvertimeThreshold(clinicResult.data.overtime_threshold ?? 9);
        setOvertimeApprovalRequired(clinicResult.data.overtime_approval_required !== false);
      }
    } catch (error) {
      console.error('Fetch system settings error:', error);
    }
  };

  const handleSaveSystem = async () => {
    setLoadingSystem(true);
    try {
      // 系統設定
      const updates = [
        { key: 'org_entities', value: JSON.stringify(entities) },
        { key: 'special_clinic_types', value: JSON.stringify(specialClinics) },
        { key: 'clinic_business_hours', value: JSON.stringify(businessHours) },
        { key: 'leave_calculation_system', value: leaveCalculationSystem }
      ];
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const result = await response.json();
      
      // 儲存診所設定（加班設定）
      const clinicResponse = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clinic',
          settings: {
            overtime_threshold: overtimeThreshold,
            overtime_approval_required: overtimeApprovalRequired
          }
        })
      });
      const clinicResult = await clinicResponse.json();
      
      if (result.success && clinicResult.success) {
        setSystemMessage('✅ 設定已更新，排班表將套用新時間');
        setTimeout(() => setSystemMessage(''), 3000);
      } else {
        setSystemMessage('❌ 儲存失敗: ' + (result.message || clinicResult.message));
      }
    } catch (error) {
      console.error('Save system settings error:', error);
      setSystemMessage('❌ 儲存失敗');
    } finally {
      setLoadingSystem(false);
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

  const updateShiftTime = (shift: 'AM'|'PM'|'NIGHT', field: 'start'|'end', val: string) => {
    setBusinessHours({
      ...businessHours,
      shifts: {
        ...businessHours.shifts,
        [shift]: { ...businessHours.shifts[shift], [field]: val }
      }
    });
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 animate-fade-in">
      <div className="space-y-10">
        {/* 組織單位 */}
        <div>
          <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
            <LayoutGrid size={20}/> 組織單位管理
          </h3>
          <div className="space-y-3">
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
            <button 
              onClick={addEntity} 
              className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:bg-blue-50 font-bold flex items-center justify-center gap-2"
            >
              <Plus size={20}/> 新增單位
            </button>
          </div>
        </div>

        {/* 診所營業時間 */}
        <div>
          <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
            <Clock size={20}/> 診所營業時間設定 (全域預設值)
          </h3>
          <div className="bg-yellow-50 p-4 mb-4 rounded-lg text-sm text-yellow-800 border border-yellow-200">
            ⚠️ 注意：修改此處僅會影響「未來」排入的班表。已經排好的班表不會自動更新時間，以保障歷史工時計算的正確性。
          </div>
          <div className="space-y-6">
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {(['AM', 'PM', 'NIGHT'] as const).map(shift => (
                <div key={shift} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-700 mb-3 flex justify-between">
                    {shift === 'AM' ? '早診' : shift === 'PM' ? '午診' : '晚診'}
                    <span className="text-xs text-slate-400 bg-white px-2 py-0.5 rounded border">{shift}</span>
                  </h4>
                  <div className="flex gap-1 items-center">
                    <input 
                      type="time" 
                      value={businessHours.shifts[shift].start} 
                      onChange={(e) => updateShiftTime(shift, 'start', e.target.value)} 
                      className="w-full border p-1 rounded text-center font-mono text-sm"
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                      type="time" 
                      value={businessHours.shifts[shift].end} 
                      onChange={(e) => updateShiftTime(shift, 'end', e.target.value)} 
                      className="w-full border p-1 rounded text-center font-mono text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 特殊門診類型 */}
        <div>
          <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
            <Stethoscope size={20}/> 特殊門診類型
          </h3>
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
              onClick={addSpecial} 
              className="py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-xl hover:bg-purple-50 font-bold flex items-center justify-center gap-2"
            >
              <Plus size={18}/> 新增類型
            </button>
          </div>
        </div>

        {/* 特休計算制 */}
        <div>
          <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
            <CalendarDays size={20}/> 特休計算制 (Annual Leave Calculation System)
          </h3>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>週年制 (Anniversary)</strong>：以員工到職日為基準，每年週年日重新計算特休天數。
            </p>
            <p className="text-sm text-blue-800">
              <strong>曆年制 (Calendar)</strong>：以日曆年度為基準，每年1月1日重新計算特休天數，按比例分配。
            </p>
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
        </div>

        {/* 加班設定 */}
        <div>
          <h3 className="text-lg font-bold text-slate-700 border-b pb-2 mb-4 flex items-center gap-2">
            <Clock size={20}/> 加班設定 (Overtime Settings)
          </h3>
          <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 mb-4">
            <p className="text-sm text-orange-800">
              當員工每日工時超過設定門檻時，系統會自動提示員工確認是否申請加班。
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                加班門檻 (小時)
              </label>
              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                value={overtimeThreshold}
                onChange={(e) => setOvertimeThreshold(Number(e.target.value))}
                className="w-full border p-3 rounded-lg bg-white text-lg font-bold"
              />
              <p className="text-xs text-slate-400 mt-1">
                當日工時超過此門檻時，系統會提示員工確認是否申請加班
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="overtime_approval"
                checked={overtimeApprovalRequired}
                onChange={(e) => setOvertimeApprovalRequired(e.target.checked)}
                className="w-5 h-5"
              />
              <label htmlFor="overtime_approval" className="text-sm font-bold text-slate-700">
                需要主管審核
              </label>
            </div>
            <p className="text-xs text-slate-400">
              {overtimeApprovalRequired 
                ? '✓ 加班申請需要主管審核後才會生效' 
                : '✓ 加班申請將自動核准，無需審核'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t flex justify-between items-center">
        <span className="text-sm font-bold text-green-600">{systemMessage}</span>
        <button 
          onClick={handleSaveSystem} 
          disabled={loadingSystem} 
          className="flex items-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition disabled:opacity-50"
        >
          <Save size={20}/> {loadingSystem ? '儲存中...' : '儲存設定'}
        </button>
      </div>
    </div>
  );
}
