import React from 'react';
import { User, Building2, Calendar } from 'lucide-react';

export default function BasicInfoPanel({ data, onChange, jobTitles, entities }: any) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">姓名 <span className="text-red-500">*</span></label>
          <input type="text" value={data.name || ''} onChange={e => onChange('name', e.target.value)} className="w-full border p-2 rounded bg-white" placeholder="真實姓名" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">職稱 / 職務</label>
          <select value={data.role || ''} onChange={e => onChange('role', e.target.value)} className="w-full border p-2 rounded bg-white">
            {jobTitles?.map((t: any) => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        {/* 🟢 新增：聘僱類別 (正職/兼職) */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">聘僱類別 (勞基法)</label>
          <select
            value={data.employment_type || 'full_time'}
            onChange={e => onChange('employment_type', e.target.value)}
            className="w-full border p-2 rounded bg-white text-blue-700 font-bold"
          >
            <option value="full_time">正職 (全時勞工)</option>
            <option value="part_time">兼職 (部分工時)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Building2 size={12}/> 歸屬單位</label>
          <select value={data.entity || ''} onChange={e => onChange('entity', e.target.value)} className="w-full border p-2 rounded bg-white">
            {entities?.map((ent: any) => <option key={ent.id} value={ent.id}>{ent.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center gap-1"><Calendar size={12}/> 到職日期</label>
          <input type="date" value={data.start_date || ''} onChange={e => onChange('start_date', e.target.value)} className="w-full border p-2 rounded bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">手機 (登入帳號) <span className="text-red-500">*</span></label>
          <input type="tel" value={data.phone || ''} onChange={e => onChange('phone', e.target.value)} className="w-full border p-2 rounded bg-white" placeholder="0912345678" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">聯絡信箱 (Email)</label>
          <input type="email" value={data.email || ''} onChange={e => onChange('email', e.target.value)} className="w-full border p-2 rounded bg-white" placeholder="接收薪資單用" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">身分證字號</label>
          <input type="text" value={data.id_number || ''} onChange={e => onChange('id_number', e.target.value)} className="w-full border p-2 rounded bg-white" maxLength={10} />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">緊急聯絡人</label>
          <input type="text" value={data.emergency_contact || ''} onChange={e => onChange('emergency_contact', e.target.value)} className="w-full border p-2 rounded bg-white" placeholder="姓名與電話" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-500 mb-1">通訊地址</label>
          <input type="text" value={data.address || ''} onChange={e => onChange('address', e.target.value)} className="w-full border p-2 rounded bg-white" />
        </div>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4">
        <h4 className="text-xs font-bold text-slate-700 mb-3 border-b pb-1">銀行匯款帳號設定</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-1">
            <label className="block text-xs text-slate-500 mb-1">銀行代碼</label>
            <input type="text" value={data.bank_code || ''} onChange={e => onChange('bank_code', e.target.value)} className="w-full border p-2 rounded bg-white font-mono" placeholder="808" />
          </div>
          <div className="col-span-1">
            <label className="block text-xs text-slate-500 mb-1">分行代碼</label>
            <input type="text" value={data.branch_code || ''} onChange={e => onChange('branch_code', e.target.value)} className="w-full border p-2 rounded bg-white font-mono" placeholder="0123" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">帳號</label>
            <input type="text" value={data.account_number || ''} onChange={e => onChange('account_number', e.target.value)} className="w-full border p-2 rounded bg-white font-mono" placeholder="1234567890123" />
          </div>
        </div>
      </div>
    </div>
  );
}
