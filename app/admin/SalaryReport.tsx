'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { FileSpreadsheet, Filter, User, ToggleLeft, ToggleRight, Calendar } from 'lucide-react';

const supabaseUrl = 'https://ucpkvptnhgbtmghqgbof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcGt2cHRuaGdidG1naHFnYm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNDg5MTAsImV4cCI6MjA4MDkyNDkxMH0.zdLx86ey-QywuGD-S20JJa7ZD6xHFRalAMRN659bbuo';
const supabase = createClient(supabaseUrl, supabaseKey);

const getInitialMonth = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
};

export default function SalaryReportView() {
    const initialMonth = getInitialMonth();
    const [useDateFilter, setUseDateFilter] = useState(false);
    const [startMonth, setStartMonth] = useState(initialMonth);
    const [endMonth, setEndMonth] = useState(initialMonth);
    const [month, setMonth] = useState(initialMonth);
    
    const [roleFilter, setRoleFilter] = useState('all'); 
    const [staffList, setStaffList] = useState<any[]>([]);
    const [selectedStaffId, setSelectedStaffId] = useState('all'); 

    const [reportData, setReportData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { fetchStaffList(); }, []);
    useEffect(() => { fetchReport(); }, [useDateFilter, startMonth, endMonth, month, roleFilter, selectedStaffId]);

    const fetchStaffList = async () => {
        const { data } = await supabase.from('staff').select('id, name, role').order('role');
        setStaffList(data || []);
    };

    const fetchReport = async () => {
        setLoading(true);
        const data: any[] = [];

        // 1. 抓醫師資料 (doctor_ppf)
        if (roleFilter === 'all' || roleFilter === 'doctor') {
            let query = supabase.from('doctor_ppf')
                .select(`*, staff:doctor_id (name, role, insurance_labor, insurance_health)`)
                .eq('status', 'locked'); 

            if (useDateFilter) {
                query = query.gte('paid_in_month', startMonth).lte('paid_in_month', endMonth);
            } else {
                query = query.eq('paid_in_month', month);
            }

            if (selectedStaffId !== 'all') {
                query = query.eq('doctor_id', selectedStaffId);
            }

            const { data: docs } = await query;

            docs?.forEach((d: any) => {
                const extraTotal = Array.isArray(d.extra_items) 
                    ? d.extra_items.reduce((sum:number, item:any) => sum + Number(item.amount), 0) 
                    : 0;
                const insuranceDeduction = (d.staff?.insurance_labor || 0) + (d.staff?.insurance_health || 0);
                const basePay = d.actual_base_pay || 0; 
                const bonus = (d.final_ppf_bonus || 0) + extraTotal; 
                const netTotal = basePay + bonus - insuranceDeduction; 

                data.push({
                    type: 'doctor', // 用於排序
                    displayType: '醫師', // 顯示用
                    name: d.staff?.name,
                    month: d.paid_in_month,
                    total: netTotal,
                    details: `PPF:${d.target_month}`
                });
            });
        }

        // 2. 抓員工資料 (salary_history)
        if (roleFilter === 'all' || roleFilter === 'staff') {
            let query = supabase.from('salary_history').select('year_month, staff_name, snapshot');

            if (useDateFilter) {
                query = query.gte('year_month', startMonth).lte('year_month', endMonth);
            } else {
                query = query.eq('year_month', month);
            }

            if (selectedStaffId !== 'all') {
                const staff = staffList.find(s => String(s.id) === selectedStaffId);
                if (staff) query = query.eq('staff_name', staff.name);
            }

            const { data: histories } = await query;

            histories?.forEach((h: any) => {
                const snap = h.snapshot || {}; 
                data.push({
                    type: 'staff', // 用於排序
                    displayType: '員工',
                    name: h.staff_name,
                    month: h.year_month,
                    total: snap.net_pay || 0,
                    details: `工時:${snap.total_hours?.toFixed(1) || 0}hr`
                });
            });
        }

        // 🟢 排序邏輯優化：
        // 1. 月份 (新 -> 舊)
        // 2. 職類 (醫師 -> 員工)  *利用字串比較 'doctor' < 'staff'
        // 3. 姓名 (筆畫 A -> Z)
        data.sort((a, b) => 
            b.month.localeCompare(a.month) || 
            a.type.localeCompare(b.type) || 
            a.name.localeCompare(b.name)
        );
        
        setReportData(data);
        setLoading(false);
    };

    const handleExport = () => {
        if (reportData.length === 0) return alert("無資料可匯出");
        const headers = ["職稱", "姓名", "月份", "實領總額", "備註"];
        const rows = reportData.map(r => [r.displayType, r.name, r.month, r.total, r.details]);
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `人事支出報表_${useDateFilter ? startMonth+'_'+endMonth : month}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalAmount = reportData.reduce((sum, r) => sum + r.total, 0);

    return (
        <div className="w-full animate-fade-in p-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-4 mb-6">
                <div className="flex items-center gap-4 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><FileSpreadsheet className="text-blue-600"/> 人事支出統計</h2>
                    <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                    
                    <button onClick={() => setUseDateFilter(!useDateFilter)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-bold transition ${useDateFilter ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                        {useDateFilter ? <ToggleRight size={20} className="text-blue-600"/> : <ToggleLeft size={20} className="text-slate-400"/>} 月份篩選
                    </button>

                    {useDateFilter ? (
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm animate-fade-in">
                            <span className="text-slate-500 pl-1">區間:</span>
                            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none"/>
                            <span className="text-slate-400">~</span>
                            <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none"/>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm animate-fade-in">
                            <span className="text-slate-500 pl-1">月份:</span>
                            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none"/>
                        </div>
                    )}

                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border text-sm">
                        <Filter size={16} className="text-slate-400 ml-2"/>
                        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none pr-2 border-r mr-2"><option value="all">所有職類</option><option value="doctor">醫師</option><option value="staff">員工</option></select>
                        <User size={16} className="text-slate-400"/>
                        <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none pr-2"><option value="all">所有人員</option>{staffList.filter(s => roleFilter === 'all' || (roleFilter === 'doctor' ? s.role === '醫師' : s.role !== '醫師')).map(s => (<option key={s.id} value={s.id}>{s.name} ({s.role})</option>))}</select>
                    </div>
                </div>
                <div className="flex items-center gap-4"><div className="text-right"><span className="block text-xs text-slate-400">期間總支出</span><span className="text-2xl font-black text-slate-800">${totalAmount.toLocaleString()}</span></div><button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition shadow text-sm"><FileSpreadsheet size={18}/> 匯出報表</button></div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-500 font-bold text-sm border-b">
                        <tr>
                            <th className="p-4 w-24">類別</th>
                            <th className="p-4">姓名</th>
                            <th className="p-4">月份</th>
                            <th className="p-4 text-right">實領總額 (Net Pay)</th>
                            <th className="p-4 text-slate-400">詳細資訊</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                        {loading ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">載入中...</td></tr> : 
                        reportData.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-400">無資料 (醫師需先執行「結算封存」)</td></tr> :
                        reportData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                                <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${row.type === 'doctor' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>{row.displayType}</span></td>
                                <td className="p-4 font-bold text-slate-700 flex items-center gap-2"><div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500">{row.name?.slice(0,1)}</div>{row.name}</td>
                                <td className="p-4 font-mono text-slate-600">{row.month}</td>
                                <td className="p-4 text-right font-bold text-slate-900 text-lg">${row.total.toLocaleString()}</td>
                                <td className="p-4 text-xs text-slate-400 font-mono">{row.details}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
