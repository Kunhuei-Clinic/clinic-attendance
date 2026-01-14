// SettingsModal.tsx
'use client';
import React from 'react';
import { Settings, X, Building2, Calendar, Stethoscope, Clock, ShieldCheck } from 'lucide-react';

export default function SettingsModal({ staff, updateStaff, entityList, onClose }: any) {
  if (!staff) return null;

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

  const annualDays = calculateAnnualLeave(staff.start_date);
  const yearsWorked = staff.start_date ? (new Date().getFullYear() - new Date(staff.start_date).getFullYear()) : 0;
  const isDoctor = staff.role === '醫師';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="text-blue-600"/> {staff.name} 薪資設定
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition"><X size={20}/></button>
        </div>

        <div className="space-y-6">
          
          {/* 基本資料區 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
             <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Building2 size={12}/> 歸屬單位</label>
                   <select 
                     value={staff.entity || ''} 
                     onChange={(e) => updateStaff(staff.id, 'entity', e.target.value)} 
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
                     value={staff.clock_in_calc_mode || 'actual'} 
                     onChange={(e) => updateStaff(staff.id, 'clock_in_calc_mode', e.target.value)} 
                     className="w-full border border-slate-300 p-2 rounded-lg bg-white text-sm font-bold text-blue-700"
                   >
                      <option value="actual">實支實付 (依打卡)</option>
                      <option value="schedule">依班表 (遲到早退扣薪)</option>
                   </select>
                </div>
             </div>

             <div>
                <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12}/> 到職日期 (年資: {yearsWorked} 年)</label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="date" 
                    value={staff.start_date || ''}
                    onChange={(e) => updateStaff(staff.id, 'start_date', e.target.value)}
                    className="flex-1 border p-2 rounded-lg bg-white text-sm font-bold"
                  />
                  <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100 font-bold whitespace-nowrap">
                    法定特休: {annualDays} 天
                  </div>
                </div>
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
                     <input type="number" value={staff.doctor_guarantee_salary} onChange={(e)=>updateStaff(staff.id, 'doctor_guarantee_salary', Number(e.target.value))} className="w-full border p-1.5 rounded"/>
                   </div>
                   <div>
                     <label className="block text-xs text-teal-700 mb-1">PPF 時薪</label>
                     <input type="number" value={staff.doctor_hourly_rate} onChange={(e)=>updateStaff(staff.id, 'doctor_hourly_rate', Number(e.target.value))} className="w-full border p-1.5 rounded"/>
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
                      onClick={()=>updateStaff(staff.id, 'salary_mode', 'monthly')}
                      className={`px-3 py-1 rounded border ${staff.salary_mode==='monthly'?'bg-slate-800 text-white':'bg-white text-slate-500'}`}>
                      月薪制
                    </button>
                    <button 
                      onClick={()=>updateStaff(staff.id, 'salary_mode', 'hourly')}
                      className={`px-3 py-1 rounded border ${staff.salary_mode==='hourly'?'bg-slate-800 text-white':'bg-white text-slate-500'}`}>
                      時薪制
                    </button>
                  </div>
               </div>
               <div className="flex items-center gap-2 border p-3 rounded-lg bg-white shadow-sm">
                  <span className="text-slate-500 font-bold">$</span>
                  <input 
                    type="number"
                    value={staff.base_salary} 
                    onChange={(e)=>updateStaff(staff.id, 'base_salary', Number(e.target.value))}
                    className="bg-transparent font-bold w-full outline-none text-lg text-slate-800"
                    placeholder="輸入金額..."
                  />
                  <span className="text-xs text-slate-400">
                    {staff.salary_mode === 'monthly' ? '元 / 月' : '元 / 時'}
                  </span>
               </div>
            </div>
          )}

          {/* 勞健保設定 */}
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
             <label className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-3">
               <ShieldCheck size={16}/> 每月固定扣繳
             </label>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <span className="text-xs text-orange-600 block mb-1">勞保自付</span>
                 <input type="number" value={staff.insurance_labor} onChange={(e)=>updateStaff(staff.id, 'insurance_labor', Number(e.target.value))} className="border border-orange-200 p-2 rounded w-full bg-white"/>
               </div>
               <div>
                 <span className="text-xs text-orange-600 block mb-1">健保自付</span>
                 <input type="number" value={staff.insurance_health} onChange={(e)=>updateStaff(staff.id, 'insurance_health', Number(e.target.value))} className="border border-orange-200 p-2 rounded w-full bg-white"/>
               </div>
             </div>
          </div>
          
          <div className="pt-4 border-t flex justify-end">
             <button onClick={onClose} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl font-bold hover:bg-black shadow-lg hover:shadow-xl transition transform active:scale-95">
               完成設定
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
