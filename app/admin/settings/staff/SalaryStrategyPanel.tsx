import React from 'react';
import { Briefcase, Clock, Stethoscope } from 'lucide-react';

export default function SalaryStrategyPanel({ data, onChange }: any) {
  // 自動判定薪資架構：如果沒有明確設定，且職稱是醫師，則預設為業績制
  const currentStructure = data.salary_structure_type || (data.role === '醫師' ? 'performance' : 'standard');

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 模版切換器 */}
      <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => onChange('salary_structure_type', 'standard')}
          className={`flex-1 py-2 text-sm font-bold rounded-md transition ${currentStructure === 'standard' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          標準工時制 (一般員工)
        </button>
        <button
          onClick={() => onChange('salary_structure_type', 'performance')}
          className={`flex-1 py-2 text-sm font-bold rounded-md transition ${currentStructure === 'performance' ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
        >
          底薪業績制 (醫師/抽成人員)
        </button>
      </div>

      {/* 模版 A: 標準工時制 */}
      {currentStructure === 'standard' && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1"><Briefcase size={12}/> 計薪模式</label>
              <select value={data.salary_mode || 'hourly'} onChange={e => onChange('salary_mode', e.target.value)} className="w-full border-blue-200 p-2 rounded bg-white font-bold text-slate-700">
                <option value="monthly">月薪制</option>
                <option value="hourly">時薪制</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-800 mb-1">
                基礎薪資 {data.salary_mode === 'monthly' ? '(月薪)' : '(時薪)'}
              </label>
              <div className="flex items-center bg-white border border-blue-200 rounded overflow-hidden">
                <span className="px-3 text-slate-400 font-bold">$</span>
                <input type="number" value={data.base_salary || 0} onChange={e => onChange('base_salary', Number(e.target.value))} className="w-full p-2 font-mono font-bold text-slate-800 outline-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-blue-100 pt-4">
            <div>
              <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1"><Clock size={12}/> 出勤計算基準</label>
              <select value={data.clock_in_calc_mode || 'actual'} onChange={e => onChange('clock_in_calc_mode', e.target.value)} className="w-full border-blue-200 p-2 rounded bg-white text-sm">
                <option value="actual">實支實付 (依打卡)</option>
                <option value="schedule">依班表 (遲到早退扣薪)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-blue-800 mb-1 flex items-center gap-1"><Clock size={12}/> 工時制度 (勞基法)</label>
              <select value={data.work_rule || 'normal'} onChange={e => onChange('work_rule', e.target.value)} className="w-full border-blue-200 p-2 rounded bg-white text-sm">
                <option value="normal">正常工時 (每日 8H)</option>
                <option value="2week">二週變形 (每日 10H)</option>
                <option value="4week">四週變形 (每日 10H)</option>
                <option value="8week">八週變形 (每日 8H)</option>
                <option value="none">責任制 (無超時加班)</option>
                <option value="online_consultation">責任制 (線上諮詢)</option>
              </select>
            </div>
          </div>
          {data.work_rule === 'online_consultation' && (
            <div className="pt-2">
              <label className="block text-xs font-bold text-indigo-600 mb-1">專屬線上諮詢時薪</label>
              <input type="number" value={data.online_hourly_rate ?? ''} onChange={e => onChange('online_hourly_rate', e.target.value === '' ? null : Number(e.target.value))} className="w-full border-indigo-200 p-2 rounded bg-white" placeholder="未設定則依本薪換算" />
            </div>
          )}
        </div>
      )}

      {/* 模版 B: 底薪業績制 (PPF) */}
      {currentStructure === 'performance' && (
        <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope size={16} className="text-teal-700"/>
            <h4 className="font-bold text-teal-800">業績與抽成設定</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 bg-white p-2 rounded border border-teal-100 flex gap-2">
              <button onClick={() => onChange('doctor_base_mode', 'guarantee')} className={`flex-1 py-1.5 text-sm font-bold rounded ${data.doctor_base_mode !== 'license' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>保底 +/- 時數</button>
              <button onClick={() => onChange('doctor_base_mode', 'license')} className={`flex-1 py-1.5 text-sm font-bold rounded ${data.doctor_base_mode === 'license' ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>掛牌費 + 時薪</button>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-teal-700 mb-1">{data.doctor_base_mode === 'license' ? '每月掛牌費' : '每月保障底薪'}</label>
              <div className="flex items-center bg-white border border-teal-200 rounded overflow-hidden">
                <span className="px-3 text-slate-400 font-bold">$</span>
                <input type="number" value={data.doctor_base_mode === 'license' ? (data.doctor_license_fee || 0) : (data.doctor_guarantee_salary || 0)} onChange={e => onChange(data.doctor_base_mode === 'license' ? 'doctor_license_fee' : 'doctor_guarantee_salary', Number(e.target.value))} className="w-full p-2 font-mono font-bold text-blue-700 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-teal-700 mb-1">換算時薪 (PPF抵扣用)</label>
              <input type="number" value={data.doctor_hourly_rate || 0} onChange={e => onChange('doctor_hourly_rate', Number(e.target.value))} className="w-full border-teal-200 p-2 rounded bg-white text-right font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-teal-700 mb-1">每診/班標準時數</label>
              <input type="number" step="0.5" value={data.doctor_hours_per_shift || 3.5} onChange={e => onChange('doctor_hours_per_shift', Number(e.target.value))} className="w-full border-teal-200 p-2 rounded bg-white text-right font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-teal-700 mb-1">預定每週診數/班數</label>
              <input type="number" step="0.5" value={data.doctor_shifts_per_week || 0} onChange={e => onChange('doctor_shifts_per_week', Number(e.target.value))} className="w-full border-teal-200 p-2 rounded bg-white text-right font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-teal-700 mb-1">健保/主項目抽成率</label>
              <div className="flex items-center gap-1">
                <input type="number" step="0.01" value={data.doctor_nhi_rate || 0} onChange={e => onChange('doctor_nhi_rate', Number(e.target.value))} className="w-full border-teal-200 p-2 rounded bg-white text-right font-mono" />
                <span className="text-xs text-teal-600">%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
