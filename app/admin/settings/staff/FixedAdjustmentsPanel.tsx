import React from 'react';
import { ShieldCheck, Plus, X } from 'lucide-react';

export default function FixedAdjustmentsPanel({ data, onChange }: any) {
  const bonuses = data.bonuses || [];
  const deductions = data.default_deductions || [];

  // 處理動態陣列的變更
  const updateArray = (field: string, array: any[]) => onChange(field, array);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 勞健保設定 */}
      <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
        <label className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-3">
          <ShieldCheck size={16}/> 法定勞健保 (每月固定自付額)
        </label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-bold text-orange-700 block mb-1">勞保自付</span>
            <input type="number" value={data.insurance_labor || 0} onChange={e => onChange('insurance_labor', Number(e.target.value))} className="border border-orange-200 p-2 rounded w-full bg-white text-right font-mono text-red-600 font-bold"/>
          </div>
          <div>
            <span className="text-xs font-bold text-orange-700 block mb-1">健保自付</span>
            <input type="number" value={data.insurance_health || 0} onChange={e => onChange('insurance_health', Number(e.target.value))} className="border border-orange-200 p-2 rounded w-full bg-white text-right font-mono text-red-600 font-bold"/>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 固定津貼 */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <label className="text-sm font-bold text-blue-800 mb-3 block">➕ 每月固定津貼/獎金</label>
          <div className="space-y-2 mb-3">
            {bonuses.map((b: any, i: number) => (
              <div key={i} className="flex gap-2">
                <input value={b.name} onChange={e => { const newArr = [...bonuses]; newArr[i].name = e.target.value; updateArray('bonuses', newArr); }} className="w-1/2 p-2 text-xs rounded border bg-white" placeholder="項目"/>
                <input type="number" value={b.amount} onChange={e => { const newArr = [...bonuses]; newArr[i].amount = Number(e.target.value); updateArray('bonuses', newArr); }} className="w-1/3 p-2 text-xs rounded border text-right font-mono bg-white" placeholder="金額"/>
                <button onClick={() => updateArray('bonuses', bonuses.filter((_:any, idx:number) => idx !== i))} className="text-red-400 hover:text-red-600"><X size={16}/></button>
              </div>
            ))}
          </div>
          <button onClick={() => updateArray('bonuses', [...bonuses, {name:'', amount:0}])} className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-2 rounded font-bold w-full hover:bg-blue-100 flex justify-center items-center gap-1"><Plus size={14}/> 新增津貼</button>
        </div>

        {/* 固定扣款 */}
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="flex justify-between items-center mb-3">
            <label className="text-sm font-bold text-red-800 block">➖ 每月固定扣除額</label>
          </div>
          <div className="space-y-2 mb-3">
            {deductions.map((d: any, i: number) => (
              <div key={i} className="flex gap-2">
                <input value={d.name} onChange={e => { const newArr = [...deductions]; newArr[i].name = e.target.value; updateArray('default_deductions', newArr); }} className="w-1/2 p-2 text-xs rounded border bg-white" placeholder="項目"/>
                <input type="number" value={d.amount} onChange={e => { const newArr = [...deductions]; newArr[i].amount = Number(e.target.value); updateArray('default_deductions', newArr); }} className="w-1/3 p-2 text-xs rounded border text-right font-mono bg-white" placeholder="金額"/>
                <button onClick={() => updateArray('default_deductions', deductions.filter((_:any, idx:number) => idx !== i))} className="text-red-400 hover:text-red-600"><X size={16}/></button>
              </div>
            ))}
          </div>
          <button onClick={() => updateArray('default_deductions', [...deductions, {name:'', amount:0}])} className="text-xs bg-white border border-red-200 text-red-600 px-3 py-2 rounded font-bold w-full hover:bg-red-100 flex justify-center items-center gap-1"><Plus size={14}/> 新增其他扣款</button>
        </div>
      </div>

      {/* 🟢 稅務與二代健保身分設定 (系統自動結算) */}
      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
        <label className="text-sm font-bold text-blue-800 flex items-center gap-2 mb-3">
          <ShieldCheck size={16}/> 法定稅務與二代健保 (系統自動計算)
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-xs font-bold text-blue-700 block mb-1">申報所得類別</span>
            <select
              value={data.income_type || 'salary'}
              onChange={e => onChange('income_type', e.target.value)}
              className="w-full p-2 text-xs rounded border border-blue-200 bg-white text-slate-700 outline-none"
            >
              <option value="salary">薪資所得 (代號 50 - 一般員工)</option>
              <option value="professional">執行業務所得 (代號 9A - 駐診醫師)</option>
            </select>
          </div>
          <div className="flex flex-col gap-2 justify-center mt-1 md:mt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.enable_nhi_2nd || false}
                onChange={e => onChange('enable_nhi_2nd', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <span className="text-xs font-bold text-slate-700">啟用二代健保自動扣繳 (費率 2.11%)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={data.enable_tax_withhold || false}
                onChange={e => onChange('enable_tax_withhold', e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300"
              />
              <span className="text-xs font-bold text-slate-700">啟用預扣所得稅自動扣繳 (費率 5%)</span>
            </label>
          </div>
        </div>
        <p className="text-[10px] text-blue-600 mt-3 leading-relaxed">
          * 系統將於月底結算時，自動偵測該員工之應發總額是否達法定扣繳門檻（如二代健保達基本工資、薪資所得達4萬等），若達標則自動產生扣繳明細。
        </p>
      </div>
    </div>
  );
}
