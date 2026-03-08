// SettingsModal.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { Settings, X, Building2, Calendar, Stethoscope, Clock, ShieldCheck } from 'lucide-react';

export default function SettingsModal({ staff, updateStaff, entityList, onClose, onSaveSuccess }: any) {
  const [localStaff, setLocalStaff] = useState<any>(staff ? { ...staff } : null);
  const [localBonuses, setLocalBonuses] = useState<any[]>(staff?.bonuses || []);
  const [localDeductions, setLocalDeductions] = useState<any[]>(staff?.default_deductions || []);

  useEffect(() => {
    if (staff) {
      setLocalStaff({ ...staff });
      setLocalBonuses(staff.bonuses || []);
      setLocalDeductions(staff.default_deductions || []);
    }
  }, [staff]);

  if (!staff || !localStaff) return null;

  // 年資與特休計算
  const calculateAnnualLeave = (startDateStr: string) => {
    if (!startDateStr) return 0;
    const start = new Date(startDateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - start.getTime());
    const years = diffTime / (1000 * 60 * 60 * 24 * 365);
    
    // 依據勞基法規則
    if (years < 0.5) return 0;
    if (years < 1) return 3;
    if (years < 2) return 7;
    if (years < 3) return 10;
    if (years < 5) return 14;
    if (years < 10) return 15;
    return 15 + Math.floor(years - 10);
  };

  const annualDays = calculateAnnualLeave(localStaff.start_date);
  const yearsWorked = localStaff.start_date ? (new Date().getFullYear() - new Date(localStaff.start_date).getFullYear()) : 0;
  const isDoctor = localStaff.role === '醫師';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-blue-600"/> {localStaff.name} 薪資設定
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20}/></button>
        </div>

        <div className="space-y-6">
          
          {/* 基本資料區 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Building2 size={12}/> 歸屬單位</label>
                   <select 
                     value={localStaff.entity || ''} 
                     onChange={(e) => setLocalStaff({ ...localStaff, entity: e.target.value })} 
                     className="w-full border border-slate-300 p-2 rounded-lg bg-white text-sm font-bold"
                   >
                      <option value="" disabled>請選擇單位...</option>
                      {entityList && entityList.map((ent: any) => (
                          <option key={ent.id} value={ent.id}>{ent.name}</option>
                      ))}
                   </select>
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Clock size={12}/> 工時計算基準</label>
                   <select 
                     value={localStaff.clock_in_calc_mode || 'actual'} 
                     onChange={(e) => setLocalStaff({ ...localStaff, clock_in_calc_mode: e.target.value })} 
                     className="w-full border border-slate-300 p-2 rounded-lg bg-white text-sm font-bold text-blue-700"
                   >
                      <option value="actual">實支實付 (依打卡)</option>
                      <option value="schedule">依班表 (遲到早退扣薪)</option>
                   </select>
                </div>
                {/* 🟢 加回遺失的變形工時選項 */}
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Clock size={12}/> 工時制度 (勞基法)</label>
                   <select 
                     value={localStaff.work_rule || 'normal'} 
                     onChange={(e) => setLocalStaff({ ...localStaff, work_rule: e.target.value })} 
                     className="w-full border border-slate-300 p-2 rounded-lg bg-white text-sm font-bold text-indigo-700"
                   >
                      <option value="normal">正常工時 (每日 8H)</option>
                      <option value="2week">二週變形 (每日 10H)</option>
                      <option value="4week">四週變形 (每日 10H)</option>
                      <option value="8week">八週變形 (每日 8H)</option>
                      <option value="none">責任制 (無超時加班)</option>
                      <option value="online_consultation">責任制 (線上諮詢)</option>
                   </select>
                </div>
             </div>

             <div>
                <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12}/> 到職日期 (年資: {yearsWorked} 年)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="date" 
                    value={localStaff.start_date || ''}
                    onChange={(e) => setLocalStaff({ ...localStaff, start_date: e.target.value })}
                    className="flex-1 border p-2 rounded-lg bg-white text-sm font-bold"
                  />
                  <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 font-bold whitespace-nowrap">
                    法定特休: {annualDays} 天
                  </div>
                </div>
             </div>

             {/* 🟢 新增：歷年特休紀錄 */}
             <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">歷年特休紀錄 (JSON 格式)</label>
                <textarea
                  value={typeof localStaff.annual_leave_history === 'string' 
                    ? localStaff.annual_leave_history 
                    : JSON.stringify(localStaff.annual_leave_history || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setLocalStaff({ ...localStaff, annual_leave_history: parsed });
                    } catch {
                      setLocalStaff({ ...localStaff, annual_leave_history: e.target.value });
                    }
                  }}
                  className="w-full border p-2 rounded-lg bg-white text-xs font-mono min-h-[100px]"
                  placeholder='例如: {"2023": 7, "2024": 10} 或直接輸入文字'
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  可輸入 JSON 物件 (例如: {"{"}"2023": 7, "2024": 10{"}"}) 或純文字
                </p>
             </div>
          </div>

          {/* 醫師專屬設定 (簡化顯示) */}
          {isDoctor && (
            <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
                <h4 className="font-bold text-teal-800 flex items-center gap-2 text-sm mb-3">
                    <Stethoscope size={16}/> 醫師參數
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                   <div>
                     <label className="block text-xs text-teal-700 mb-1">保底薪資</label>
                     <input type="number" value={localStaff.doctor_guarantee_salary} onChange={(e)=>setLocalStaff({ ...localStaff, doctor_guarantee_salary: Number(e.target.value) })} className="w-full border p-1.5 rounded"/>
                   </div>
                   <div>
                     <label className="block text-xs text-teal-700 mb-1">PPF 時薪</label>
                     <input type="number" value={localStaff.doctor_hourly_rate} onChange={(e)=>setLocalStaff({ ...localStaff, doctor_hourly_rate: Number(e.target.value) })} className="w-full border p-1.5 rounded"/>
                   </div>
                </div>
            </div>
          )}

          {/* 一般員工薪資模式 */}
          {!isDoctor && (
            <div className="space-y-3">
               <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-slate-700">計薪設定</label>
                  <div className="flex gap-2 text-xs">
                    <button 
                      onClick={()=>setLocalStaff({ ...localStaff, salary_mode: 'monthly' })}
                      className={`px-3 py-1 rounded border ${localStaff.salary_mode==='monthly'?'bg-slate-800 text-white':'bg-white text-slate-500'}`}>
                      月薪制
                    </button>
                    <button 
                      onClick={()=>setLocalStaff({ ...localStaff, salary_mode: 'hourly' })}
                      className={`px-3 py-1 rounded border ${localStaff.salary_mode==='hourly'?'bg-slate-800 text-white':'bg-white text-slate-500'}`}>
                      時薪制
                    </button>
                  </div>
               </div>
               <div className="flex items-center gap-2 border p-3 rounded-lg bg-white shadow-sm">
                  <span className="text-slate-500 font-bold">$</span>
                  <input 
                    type="number"
                    value={localStaff.base_salary} 
                    onChange={(e)=>setLocalStaff({ ...localStaff, base_salary: Number(e.target.value) })}
                    className="bg-transparent font-bold w-full outline-none text-lg text-slate-800"
                    placeholder="輸入金額..."
                  />
                  <span className="text-xs text-slate-400">
                    {localStaff.salary_mode === 'monthly' ? '元 / 月' : '元 / 時'}
                  </span>
               </div>
               {/* 🟢 只有在工時制度選擇「線上諮詢」時，才顯示專屬時薪設定 */}
               {localStaff.work_rule === 'online_consultation' && (
                 <div className="flex items-center gap-2 border p-3 rounded-lg bg-white shadow-sm border-indigo-200 animate-fade-in">
                    <span className="text-indigo-600 font-bold text-sm">線上諮詢時薪</span>
                    <input
                      type="number"
                      value={localStaff.online_hourly_rate ?? ''}
                      onChange={(e)=>setLocalStaff({ ...localStaff, online_hourly_rate: e.target.value === '' ? null : Number(e.target.value) })}
                      className="bg-transparent font-bold w-full outline-none text-slate-800"
                      placeholder={`未設定則依本薪 (${localStaff.salary_mode === 'monthly' ? Math.round((localStaff.base_salary || 0) / 240) : localStaff.base_salary})`}
                    />
                    <span className="text-xs text-slate-400">元/時</span>
                 </div>
               )}
            </div>
          )}

          {/* 固定津貼與扣款設定 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 固定津貼 */}
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <label className="text-sm font-bold text-blue-800 mb-3 block">➕ 每月固定津貼/獎金</label>
              <div className="space-y-2 mb-3">
                {localBonuses.map((b: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input value={b.name} onChange={(e) => setLocalBonuses(prev => prev.map((item, idx) => idx === i ? {...item, name: e.target.value} : item))} className="w-1/2 p-1.5 text-xs rounded border" placeholder="項目"/>
                    <input type="number" value={b.amount} onChange={(e) => setLocalBonuses(prev => prev.map((item, idx) => idx === i ? {...item, amount: Number(e.target.value)} : item))} className="w-1/3 p-1.5 text-xs rounded border text-right" placeholder="金額"/>
                    <button onClick={() => setLocalBonuses(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setLocalBonuses(prev => [...prev, {name:'', amount:0}])} className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded w-full hover:bg-blue-100">+ 新增津貼</button>
            </div>

            {/* 固定扣款 */}
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <label className="text-sm font-bold text-red-800 mb-3 block">➖ 每月固定扣除額</label>
              <div className="space-y-2 mb-3">
                {localDeductions.map((d: any, i: number) => (
                  <div key={i} className="flex gap-2">
                    <input value={d.name} onChange={(e) => setLocalDeductions(prev => prev.map((item, idx) => idx === i ? {...item, name: e.target.value} : item))} className="w-1/2 p-1.5 text-xs rounded border" placeholder="項目"/>
                    <input type="number" value={d.amount} onChange={(e) => setLocalDeductions(prev => prev.map((item, idx) => idx === i ? {...item, amount: Number(e.target.value)} : item))} className="w-1/3 p-1.5 text-xs rounded border text-right" placeholder="金額"/>
                    <button onClick={() => setLocalDeductions(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setLocalDeductions(prev => [...prev, {name:'', amount:0}])} className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded w-full hover:bg-red-100">+ 新增扣款</button>
            </div>
          </div>

          {/* 勞健保設定 */}
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
             <label className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-3">
               <ShieldCheck size={16}/> 每月固定扣繳
             </label>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <span className="text-xs text-orange-600 block mb-1">勞保自付</span>
                 <input type="number" value={localStaff.insurance_labor} onChange={(e)=>setLocalStaff({ ...localStaff, insurance_labor: Number(e.target.value) })} className="border border-orange-200 p-2 rounded w-full bg-white"/>
               </div>
               <div>
                 <span className="text-xs text-orange-600 block mb-1">健保自付</span>
                 <input type="number" value={localStaff.insurance_health} onChange={(e)=>setLocalStaff({ ...localStaff, insurance_health: Number(e.target.value) })} className="border border-orange-200 p-2 rounded w-full bg-white"/>
               </div>
             </div>
          </div>
          
          <div className="pt-4 border-t flex justify-end">
             <button
               onClick={async () => {
                 try {
                   const payload: any = {
                     id: localStaff.id,
                     entity: localStaff.entity,
                     clock_in_calc_mode: localStaff.clock_in_calc_mode,
                     work_rule: localStaff.work_rule,
                     start_date: localStaff.start_date,
                     annual_leave_history: localStaff.annual_leave_history,
                     salary_mode: localStaff.salary_mode,
                     base_salary: localStaff.base_salary,
                     online_hourly_rate: localStaff.online_hourly_rate,
                     insurance_labor: localStaff.insurance_labor,
                     insurance_health: localStaff.insurance_health,
                     bonuses: localBonuses,
                     default_deductions: localDeductions,
                   };
                   if (isDoctor) {
                     payload.doctor_guarantee_salary = localStaff.doctor_guarantee_salary;
                     payload.doctor_hourly_rate = localStaff.doctor_hourly_rate;
                   }
                   const res = await fetch('/api/staff', {
                     method: 'PATCH',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify(payload),
                   });
                   const json = await res.json();
                   if (json.success !== false) {
                     onSaveSuccess?.();
                     onClose();
                   } else {
                     alert('儲存失敗: ' + (json.message || json.error || '未知錯誤'));
                   }
                 } catch (error: any) {
                   console.error('Settings save error:', error);
                   alert('儲存失敗: ' + error.message);
                 }
               }}
               className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-black shadow-lg hover:shadow-xl transition transform active:scale-95"
             >
               完成設定
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
