'use client';

import React, { useState, useEffect } from 'react';
import { Stethoscope, Settings, Printer, Save, X, Trash2, Lock, Unlock, FileEdit, Landmark, PenLine, Sparkles, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import PayslipModal from './PayslipModal';

type Item = { id: number; name: string; amount: number; rate?: number };

const DEFAULT_BASE_PAY = {
    mode: 'guarantee', licenseFee: 0, guarantee: 0, hourlyRate: 0,
    actualHours: 0, standardHours: 0, workPay: 0, adjustment: 0,
    insurance: 0, finalBase: 0, insurance_labor: 0, insurance_health: 0
};

const DEFAULT_PPF_DATA = {
    patient_count: 0, nhi_points: 0, reg_fee_deduction: 0,
    clinic_days: 0, transfer_amount: 0,
    self_pay_items: [] as Item[],
    extra_items: [] as Item[],
    past_base_salary: 0,
    status: 'draft' as 'draft' | 'locked'
};

    const DoctorSettingsModal = ({ doctor, onClose, onUpdate }: any) => {
    const [form, setForm] = useState({ ...doctor });
    const handleSave = async () => {
        try {
          await fetch('/api/staff', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: doctor.id,
              doctor_base_mode: form.doctor_base_mode,
              doctor_license_fee: form.doctor_license_fee,
              doctor_guarantee_salary: form.doctor_guarantee_salary,
              doctor_hourly_rate: form.doctor_hourly_rate,
              doctor_nhi_rate: form.doctor_nhi_rate,
              doctor_hours_per_shift: form.doctor_hours_per_shift,
              insurance_labor: form.insurance_labor,
              insurance_health: form.insurance_health
            })
          });
          onUpdate();
          onClose();
        } catch (error: any) {
          console.error('Error updating doctor settings:', error);
          alert('更新失敗: ' + error.message);
        }
    };
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="bg-teal-700 text-white p-4 flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><Settings size={18} /> 參數設定</h3><button onClick={onClose}><X size={20} /></button></div>
                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                    <div className="bg-slate-50 p-3 rounded border"><label className="text-xs font-bold text-slate-500 block mb-2">計算模式</label><div className="flex gap-2"><button onClick={() => setForm({ ...form, doctor_base_mode: 'guarantee' })} className={`flex-1 py-1.5 rounded text-sm font-bold border ${form.doctor_base_mode !== 'license' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500'}`}>保底 +/- 時數</button><button onClick={() => setForm({ ...form, doctor_base_mode: 'license' })} className={`flex-1 py-1.5 rounded text-sm font-bold border ${form.doctor_base_mode === 'license' ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-500'}`}>掛牌費 + 時薪</button></div></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2"><label className="text-xs font-bold text-slate-500">{form.doctor_base_mode === 'license' ? '每月掛牌費' : '每月保障薪'}</label><input type="number" value={form.doctor_base_mode === 'license' ? form.doctor_license_fee : form.doctor_guarantee_salary} onChange={e => setForm({ ...form, [form.doctor_base_mode === 'license' ? 'doctor_license_fee' : 'doctor_guarantee_salary']: Number(e.target.value) })} className="w-full border p-2 rounded text-right font-bold text-blue-700" /></div>
                        <div><label className="text-xs font-bold text-slate-500">計算時薪</label><input type="number" value={form.doctor_hourly_rate} onChange={e => setForm({ ...form, doctor_hourly_rate: Number(e.target.value) })} className="w-full border p-2 rounded text-right" /></div>
                        <div><label className="text-xs font-bold text-slate-500">每診標準時數</label><input type="number" value={form.doctor_hours_per_shift} onChange={e => setForm({ ...form, doctor_hours_per_shift: Number(e.target.value) })} className="w-full border p-2 rounded text-right" /></div>
                        <div><label className="text-xs font-bold text-slate-500">健保抽成率</label><input type="number" step="0.01" value={form.doctor_nhi_rate} onChange={e => setForm({ ...form, doctor_nhi_rate: Number(e.target.value) })} className="w-full border p-2 rounded text-right" /></div>
                    </div>
                    <div className="border-t pt-4 grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500">勞保自付</label><input type="number" value={form.insurance_labor} onChange={e => setForm({ ...form, insurance_labor: Number(e.target.value) })} className="w-full border p-2 rounded text-right text-red-500" /></div><div><label className="text-xs font-bold text-slate-500">健保自付</label><input type="number" value={form.insurance_health} onChange={e => setForm({ ...form, insurance_health: Number(e.target.value) })} className="w-full border p-2 rounded text-right text-red-500" /></div></div>
                    <button onClick={handleSave} className="w-full bg-teal-600 text-white py-3 rounded-xl font-bold hover:bg-teal-700 mt-4">儲存設定</button>
                </div>
            </div>
        </div>
    );
};

export default function DoctorSalaryPage() {
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));
    const [ppfTargetMonth, setPpfTargetMonth] = useState('');
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
    const [rosterList, setRosterList] = useState<any[]>([]);
    const [basePayData, setBasePayData] = useState<any>(DEFAULT_BASE_PAY);
    
    const [ppfData, setPpfData] = useState(() => ({ ...DEFAULT_PPF_DATA }));

    const [isSaving, setIsSaving] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showPayslip, setShowPayslip] = useState(false);

    useEffect(() => { const d = new Date(currentMonth); d.setMonth(d.getMonth() - 2); setPpfTargetMonth(d.toISOString().slice(0, 7)); }, [currentMonth]);
    useEffect(() => { fetchDoctors(); }, []);

    const resetForm = () => {
        setBasePayData({ ...DEFAULT_BASE_PAY });
        setPpfData({ ...DEFAULT_PPF_DATA });
        setRosterList([]);
    };

    useEffect(() => {
        resetForm();
        if (!selectedDoctorId || !currentMonth || !ppfTargetMonth) return;

        const doctor = doctors.find((d: any) => d.id === selectedDoctorId);
        if (!doctor) return;

        let cancelled = false;

        const run = async () => {
            try {
                const res = await fetch(`/api/doctor/ppf?doctor_id=${selectedDoctorId}&target_month=${ppfTargetMonth}`);
                const json = await res.json();
                if (cancelled) return;

                let historicalBasePay = 0;
                const historyRes = await fetch(`/api/doctor/ppf?doctor_id=${selectedDoctorId}&paid_in_month=${ppfTargetMonth}`);
                const historyJson = await historyRes.json();
                if (cancelled) return;
                if (historyJson.data && historyJson.data.length > 0) {
                    historicalBasePay = Number(historyJson.data[0].actual_base_pay) || 0;
                } else {
                    historicalBasePay = Number(doctor?.doctor_guarantee_salary) || 0;
                }

                const rec = json.data;
                const isLocked = rec && rec.status === 'locked';

                if (isLocked) {
                    const insLab = Number(doctor.insurance_labor) || 0;
                    const insHealth = Number(doctor.insurance_health) || 0;
                    const mode = rec.snapshot_mode || 'guarantee';
                    const guarantee = Number(rec.snapshot_guarantee) || 0;
                    const licenseFee = Number(rec.snapshot_license_fee) || 0;
                    const actualH = Number(rec.snapshot_actual_hours) || 0;
                    const standardH = Number(rec.snapshot_standard_hours) || 0;
                    const hourlyR = Number(rec.snapshot_hourly_rate) || 0;
                    const workP = mode === 'license' ? Math.round(actualH * hourlyR) : Math.round((actualH - standardH) * hourlyR);
                    const finalB = mode === 'license' ? licenseFee + workP : guarantee + workP;

                    setPpfData({
                        patient_count: Number(rec.patient_count) || 0,
                        nhi_points: Number(rec.nhi_points) || 0,
                        reg_fee_deduction: Number(rec.reg_fee_deduction) || 0,
                        clinic_days: Number(rec.clinic_days) || 0,
                        transfer_amount: Number(rec.transfer_amount) || 0,
                        self_pay_items: Array.isArray(rec.self_pay_items) ? rec.self_pay_items : [],
                        extra_items: Array.isArray(rec.extra_items) ? rec.extra_items : [],
                        past_base_salary: rec.base_salary_at_time != null ? Number(rec.base_salary_at_time) : historicalBasePay,
                        status: 'locked'
                    });
                    setBasePayData({
                        mode,
                        licenseFee,
                        guarantee,
                        hourlyRate: hourlyR,
                        actualHours: actualH,
                        standardHours: standardH,
                        workPay: mode === 'license' ? workP : 0,
                        adjustment: mode === 'guarantee' ? workP : 0,
                        finalBase: finalB,
                        insurance_labor: insLab,
                        insurance_health: insHealth
                    });
                    setRosterList(Array.isArray(rec.snapshot_roster) ? rec.snapshot_roster : []);
                    return;
                }

                const ensureId = (arr: any[], base: number) =>
                    (Array.isArray(arr) ? arr : []).map((x: any, i: number) => ({ ...x, id: x?.id ?? base + i + Math.random() }));
                if (rec) {
                    setPpfData({
                        patient_count: Number(rec.patient_count) || 0,
                        nhi_points: Number(rec.nhi_points) || 0,
                        reg_fee_deduction: Number(rec.reg_fee_deduction) || 0,
                        clinic_days: Number(rec.clinic_days) || 0,
                        transfer_amount: Number(rec.transfer_amount) || 0,
                        self_pay_items: ensureId(rec.self_pay_items || [], Date.now()),
                        extra_items: ensureId(rec.extra_items || [], Date.now() + 1e6),
                        past_base_salary: rec.base_salary_at_time != null ? Number(rec.base_salary_at_time) : historicalBasePay,
                        status: (rec.status as 'draft' | 'locked') || 'draft'
                    });
                } else {
                    let templateItems: Item[] = [];
                    if (doctor?.doctor_self_pay_template && Array.isArray(doctor.doctor_self_pay_template)) {
                        templateItems = doctor.doctor_self_pay_template.map((t: any, idx: number) => ({
                            id: Date.now() + idx + Math.random(),
                            name: t.name || '自費',
                            amount: 0,
                            rate: t.rate ?? 30
                        }));
                    }
                    setPpfData({
                        ...DEFAULT_PPF_DATA,
                        self_pay_items: templateItems,
                        past_base_salary: historicalBasePay
                    });
                }

                const [y, m] = currentMonth.split('-').map(Number);
                const rosterRes = await fetch(`/api/roster/doctor?doctor_id=${selectedDoctorId}&year=${y}&month=${m}`);
                const rosterJson = await rosterRes.json();
                if (cancelled) return;

                const roster = rosterJson.data || [];
                setRosterList(roster);

                let actualHours = 0;
                roster.forEach((r: any) => {
                    if (r.start_time && r.end_time) {
                        const [sh, sm] = r.start_time.split(':').map(Number);
                        const [eh, em] = r.end_time.split(':').map(Number);
                        actualHours += Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60;
                    } else {
                        actualHours += Number(doctor.doctor_hours_per_shift) || 3.5;
                    }
                });

                const insurance_labor = Number(doctor.insurance_labor) || 0;
                const insurance_health = Number(doctor.insurance_health) || 0;
                const hourlyRate = Number(doctor.doctor_hourly_rate) || 0;
                const mode = doctor.doctor_base_mode || 'guarantee';
                const newData: any = {
                    mode,
                    licenseFee: Number(doctor.doctor_license_fee) || 0,
                    guarantee: Number(doctor.doctor_guarantee_salary) || 0,
                    hourlyRate,
                    actualHours,
                    standardHours: 0,
                    workPay: 0,
                    adjustment: 0,
                    finalBase: 0,
                    insurance_labor,
                    insurance_health
                };

                if (mode === 'license') {
                    newData.workPay = Math.round(actualHours * hourlyRate);
                    newData.finalBase = newData.licenseFee + newData.workPay;
                } else {
                    const weeklyShifts = Number(doctor.doctor_shifts_per_week) || 0;
                    newData.standardHours = (weeklyShifts * (Number(doctor.doctor_hours_per_shift) || 3.5) / 7) * 30;
                    newData.adjustment = Math.round((actualHours - newData.standardHours) * hourlyRate);
                    newData.finalBase = newData.guarantee + newData.adjustment;
                }
                if (cancelled) return;
                setBasePayData(newData);
            } catch (e: any) {
                if (!cancelled) console.error('Doctor salary load error:', e);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [selectedDoctorId, currentMonth, ppfTargetMonth, doctors]);

    const fetchDoctors = async () => {
        try {
            const res = await fetch('/api/staff?role=醫師');
            const json = await res.json();
            if (json.data) {
                setDoctors(json.data);
                if (json.data.length > 0) setSelectedDoctorId((prev: number | null) => prev ?? json.data[0].id);
            }
        } catch (error: any) {
            console.error('Error fetching doctors:', error);
        }
    };

    const updateItem = (listName: 'self_pay_items'|'extra_items', i: number, f: string, v: any) => { const n = [...ppfData[listName]] as any[]; n[i] = { ...n[i], [f]: v }; setPpfData(p => ({ ...p, [listName]: n })); };
    const removeItem = (listName: 'self_pay_items'|'extra_items', i: number) => { setPpfData(p => ({ ...p, [listName]: p[listName].filter((_, x) => x !== i) })); };
    const addItem = (listName: 'self_pay_items'|'extra_items') => { setPpfData(p => ({ ...p, [listName]: [...p[listName], { id: Date.now(), name: listName==='extra_items'?'項目':'自費', amount: 0, rate: listName==='self_pay_items'?30:undefined }] })); };

    // 切換月份函數
    const changeMonth = (direction: 'prev' | 'next') => {
        const [year, month] = currentMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        if (direction === 'prev') {
            date.setMonth(date.getMonth() - 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        setCurrentMonth(newMonth);
    };

    const calculatePPF = () => {
        const doctor = doctors.find(d => d.id === selectedDoctorId);
        const nhiRate = Number(doctor?.doctor_nhi_rate) || 0.8;
        const nhiTotal = (ppfData.nhi_points * nhiRate) - ppfData.reg_fee_deduction;
        const selfPayTotal = ppfData.self_pay_items.reduce((s: number, i: any) => s + (Number(i.amount) * (Number(i.rate) / 100)), 0);
        const extraTotal = ppfData.extra_items.reduce((s: number, i: any) => s + Number(i.amount), 0);
        
        // 🟢 修正：totalPerformance 只包含健保 PPF，不包含自費項目
        const totalPerformance = Math.round(nhiTotal);
        // 🟢 修正：bonus 只比較健保 PPF 與保障薪
        const bonus = Math.max(0, totalPerformance - ppfData.past_base_salary);
        return { nhiTotal, selfPayTotal, extraTotal, totalPerformance, bonus, nhiRate };
    };

    const ppfResult = calculatePPF();
    const currentDoctor = doctors.find(d => d.id === selectedDoctorId);
    const isLocked = ppfData.status === 'locked';

    // 🟢 最終實領計算 (即時算出來供顯示與儲存)
    // 🟢 修正：自費項目 (selfPayTotal) 現在加在特殊費用中，不參與 PPF bonus 計算
    const finalNetPay = (basePayData.finalBase || 0) + ppfResult.bonus + ppfResult.selfPayTotal + ppfResult.extraTotal - (basePayData.insurance_labor || 0) - (basePayData.insurance_health || 0);
    const remainingCash = finalNetPay - ppfData.transfer_amount;

    const saveData = async (status: 'draft' | 'locked') => {
        if (!selectedDoctorId) return alert("請先選擇醫師");
        setIsSaving(true);
        try {
          const snapshot = {
            snapshot_actual_hours: basePayData.actualHours ?? 0,
            snapshot_standard_hours: basePayData.standardHours ?? 0,
            snapshot_hourly_rate: basePayData.hourlyRate ?? 0,
            snapshot_guarantee: basePayData.guarantee ?? 0,
            snapshot_license_fee: basePayData.licenseFee ?? 0,
            snapshot_mode: basePayData.mode ?? 'guarantee',
            snapshot_roster: Array.isArray(rosterList) ? rosterList : []
          };
          const res = await fetch('/api/doctor/ppf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              doctor_id: selectedDoctorId,
              target_month: ppfTargetMonth,
              patient_count: ppfData.patient_count,
              nhi_points: ppfData.nhi_points,
              reg_fee_deduction: ppfData.reg_fee_deduction,
              clinic_days: ppfData.clinic_days,
              transfer_amount: ppfData.transfer_amount,
              actual_base_pay: basePayData.finalBase,
              self_pay_items: ppfData.self_pay_items,
              extra_items: ppfData.extra_items,
              total_performance: ppfResult.totalPerformance,
              base_salary_at_time: ppfData.past_base_salary,
              final_ppf_bonus: ppfResult.bonus,
              paid_in_month: currentMonth,
              status: status,
              net_pay: finalNetPay,
              cash_amount: remainingCash,
              ...snapshot
            })
          });
          const json = await res.json();
          setIsSaving(false);
          if (!json.error) {
            if (status === 'locked') {
              const tmpl = ppfData.self_pay_items.map((i: any) => ({ name: i.name, rate: i.rate }));
              await fetch('/api/staff', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedDoctorId, doctor_self_pay_template: tmpl })
              });
            }
            setPpfData(prev => ({ ...prev, status }));
            alert(status === 'locked' ? '✅ 已結算並封存！' : '💾 草稿已暫存');
          } else {
            alert('儲存失敗: ' + json.error);
          }
        } catch (error: any) {
          setIsSaving(false);
          alert('儲存失敗: ' + error.message);
        }
    };

    return (
        <div className="w-full animate-fade-in p-4 pb-24">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border">
                <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800"><Stethoscope className="text-teal-600" /> 醫師薪資結算</h2>
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border">
                    <button 
                        onClick={() => changeMonth('prev')} 
                        className="p-1.5 hover:bg-slate-200 rounded transition-colors flex items-center justify-center"
                        title="上個月"
                    >
                        <ChevronLeft size={18} className="text-slate-600" />
                    </button>
                    <span className="text-sm font-bold text-slate-500">發薪月份:</span>
                    <input 
                        type="month" 
                        value={currentMonth} 
                        onChange={(e) => setCurrentMonth(e.target.value)} 
                        className="bg-transparent font-bold text-slate-700 outline-none min-w-[140px]" 
                    />
                    <button 
                        onClick={() => changeMonth('next')} 
                        className="p-1.5 hover:bg-slate-200 rounded transition-colors flex items-center justify-center"
                        title="下個月"
                    >
                        <ChevronRight size={18} className="text-slate-600" />
                    </button>
                </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-4 mb-2 items-center">{doctors.map(d => (<button key={d.id} onClick={() => setSelectedDoctorId(d.id)} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap transition ${selectedDoctorId === d.id ? 'bg-teal-600 text-white shadow-lg' : 'bg-white text-slate-500 border hover:bg-slate-50'}`}>{d.name}</button>))}{selectedDoctorId && (<><div className="w-px h-6 bg-slate-300 mx-2"></div><button onClick={() => setShowSettings(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-100"><Settings size={14} /> 參數</button><button onClick={() => setShowPayslip(true)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-bold ${basePayData ? 'border-blue-300 text-blue-600 hover:bg-blue-50' : 'border-gray-200 text-gray-300 cursor-not-allowed'}`}><Printer size={14} /> 薪資單</button></>)}</div>

            {showSettings && currentDoctor && <DoctorSettingsModal doctor={currentDoctor} onClose={() => setShowSettings(false)} onUpdate={() => fetchDoctors()} />}

            {showPayslip && currentDoctor && (
                <PayslipModal
                    data={{
                        doctorName: currentDoctor.name,
                        baseAmount: basePayData.mode === 'license' ? basePayData.licenseFee : basePayData.guarantee,
                        workAmount: basePayData.mode === 'license' ? basePayData.workPay : basePayData.adjustment,
                        ppfBonus: ppfResult.bonus,
                        extraTotal: ppfResult.extraTotal,
                        insLabor: basePayData.insurance_labor || 0, 
                        insHealth: basePayData.insurance_health || 0,
                        netPay: finalNetPay, // 即時計算的 Net Pay
                        hourlyRate: basePayData.hourlyRate,
                        actualHours: basePayData.actualHours,
                        standardHours: basePayData.standardHours,
                        grossBasePay: basePayData.finalBase,
                        transfer_amount: ppfData.transfer_amount,
                        cash_amount: remainingCash
                    }}
                    roster={rosterList}
                    ppfDetails={{
                        ...ppfData,
                        target_month: ppfTargetMonth,
                        selfPayTotal: ppfResult.selfPayTotal,
                        nhiRate: ppfResult.nhiRate,
                        base_salary_at_time: ppfData.past_base_salary,
                        totalPerformance: ppfResult.totalPerformance 
                    }}
                    month={currentMonth}
                    onClose={() => setShowPayslip(false)}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* 1. 左側：本月保障薪 */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                    <h3 className="font-bold text-lg text-slate-700 mb-4 border-b pb-2 flex justify-between"><span>1. 當月保障薪 ({currentMonth})</span><span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">{basePayData?.mode === 'license' ? '掛牌費模式' : '固定保障模式'}</span></h3>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between"><span className="text-slate-500">{basePayData.mode === 'license' ? '掛牌費' : '保障薪'}</span><span className="font-bold text-lg">${(basePayData.mode === 'license' ? basePayData.licenseFee : basePayData.guarantee).toLocaleString()}</span></div>
                        <div className="bg-slate-50 p-3 rounded space-y-2 border">
                            {basePayData.mode !== 'license' && <div className="flex justify-between text-xs text-slate-500"><span>標準工時</span><span>{basePayData.standardHours.toFixed(1)} hr</span></div>}
                            <div className="flex justify-between text-xs"><span>實際工時</span><span className="font-bold">{basePayData.actualHours.toFixed(1)} hr</span></div>
                            <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-500">工時調整/時薪</span><span className={`font-bold ${basePayData.mode === 'license' ? 'text-green-600' : (basePayData.adjustment < 0 ? 'text-red-500' : 'text-green-600')}`}>${(basePayData.mode === 'license' ? basePayData.workPay : basePayData.adjustment).toLocaleString()}</span></div>
                        </div>
                        <div className="border-t pt-3 flex justify-between items-center"><span className="font-bold text-slate-700">保障薪毛額 (A)</span><span className="text-2xl font-extrabold text-teal-700">${basePayData.finalBase.toLocaleString()}</span></div>
                        <div className="text-xs text-slate-400 text-center">*勞健保將於特殊費用欄位統一扣除</div>
                    </div>
                </div>

                {/* 右側 */}
                <div className="space-y-6">
                    
                    {/* 2. PPF */}
                    <div className={`bg-white rounded-xl shadow-sm border overflow-hidden ${isLocked ? 'border-gray-300' : 'border-slate-200'}`}>
                        <div className={`p-6 space-y-4 text-sm ${isLocked ? 'opacity-70 pointer-events-none grayscale bg-gray-50' : ''}`}>
                            <h3 className="font-bold text-lg text-slate-700 border-b pb-2 flex justify-between items-center">
                                <div className="flex items-center gap-2"><span>2. PPF 業績結算</span>{isLocked ? <span className="bg-gray-600 text-white text-[10px] px-2 py-0.5 rounded flex items-center gap-1"><Lock size={10}/> 已封存</span> : <span className="bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded flex items-center gap-1"><FileEdit size={10}/> 編輯中</span>}</div>
                                <div className="flex items-center gap-1 text-xs font-normal"><span>結算:</span><input type="month" value={ppfTargetMonth} onChange={(e) => setPpfTargetMonth(e.target.value)} className="border rounded p-1 bg-slate-50" /></div>
                            </h3>
                            <div className="grid grid-cols-2 gap-4 bg-teal-50/50 p-3 rounded border border-teal-100">
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">看診人數</label><input type="number" value={ppfData.patient_count} onChange={(e) => setPpfData(p => ({ ...p, patient_count: Number(e.target.value) }))} className="w-full border p-2 rounded text-right font-bold" /></div>
                                <div><label className="text-xs font-bold text-slate-500 block mb-1">健保點數</label><input type="number" value={ppfData.nhi_points} onChange={(e) => setPpfData(p => ({ ...p, nhi_points: Number(e.target.value) }))} className="w-full border p-2 rounded text-right font-bold text-blue-700" /></div>
                            </div>
                            <div className="flex items-center gap-2"><label className="text-xs font-bold text-slate-500">看診天數:</label><input type="number" value={ppfData.clinic_days} onChange={(e) => setPpfData(p => ({ ...p, clinic_days: Number(e.target.value) }))} className="w-20 border-b border-teal-200 text-right font-bold outline-none" /><span className="text-xs text-slate-400">天</span></div>
                            <div className="flex items-center justify-between text-xs text-slate-500 px-1"><span>健保診察費抽成率: {(ppfResult.nhiRate * 100).toFixed(0)}%</span><div className="flex items-center gap-1"><span className="text-red-400">掛號費減免扣除額:</span><input type="number" value={ppfData.reg_fee_deduction} onChange={(e) => setPpfData(p => ({ ...p, reg_fee_deduction: Number(e.target.value) }))} className="w-20 border-b border-red-200 text-right text-red-500 outline-none bg-transparent" /></div></div>
                        </div>
                        <div className="bg-slate-800 text-white p-4">
                            <div className="flex justify-between text-sm opacity-80"><span>健保總產值</span><span>${ppfResult.totalPerformance.toLocaleString()}</span></div>
                            <div className="flex justify-between text-sm opacity-80 items-center"><span className="flex items-center gap-1">扣除: {ppfTargetMonth} 實領保障薪</span><div className="relative"><input type="number" value={ppfData.past_base_salary} onChange={(e) => setPpfData(p => ({ ...p, past_base_salary: Number(e.target.value) }))} className="w-24 text-right border-b border-slate-500 bg-transparent rounded px-2 py-0.5 text-white outline-none focus:border-yellow-400 transition" /><PenLine size={12} className="absolute right-1 top-1.5 text-slate-400 pointer-events-none opacity-50"/></div></div>
                            <div className="flex justify-between pt-3 border-t border-slate-600 font-bold text-yellow-400 text-lg"><span>PPF 超額獎金 (B)</span><span>${ppfResult.bonus.toLocaleString()}</span></div>
                        </div>
                    </div>

                    {/* 3. 特殊費用 */}
                    <div className={`bg-white p-6 rounded-xl shadow-sm border border-slate-200 ${isLocked ? 'opacity-70 pointer-events-none grayscale' : ''}`}>
                        <h3 className="font-bold text-lg text-slate-700 mb-4 border-b pb-2 flex justify-between items-center"><span>3. 特殊費用 / 扣除額</span><span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">不參與 PPF 扣抵</span></h3>
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between items-center bg-red-50 p-2 rounded border border-red-100 text-xs">
                                <span className="font-bold text-red-800 flex items-center gap-1"><ShieldAlert size={12}/> 勞保自付 (固定)</span>
                                <span className="font-mono font-bold text-red-600">-${basePayData.insurance_labor.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center bg-red-50 p-2 rounded border border-red-100 text-xs">
                                <span className="font-bold text-red-800 flex items-center gap-1"><ShieldAlert size={12}/> 健保自付 (固定)</span>
                                <span className="font-mono font-bold text-red-600">-${basePayData.insurance_health.toLocaleString()}</span>
                            </div>
                        </div>
                        {/* 🟢 修正：自費項目移到特殊費用區塊 */}
                        <div className="border-t pt-4 mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="font-bold text-slate-600">自費項目 (另行計算)</label>
                                <span className="text-xs text-purple-600 font-bold">總計: ${ppfResult.selfPayTotal.toLocaleString()}</span>
                            </div>
                            {ppfData.self_pay_items.map((item: any, idx: number) => (
                                <div key={item.id} className="flex gap-2 mb-2 items-center">
                                    <input value={item.name} onChange={(e) => updateItem('self_pay_items', idx, 'name', e.target.value)} className="w-1/3 border p-1 rounded text-xs" placeholder="項目名稱"/>
                                    <input type="number" value={item.amount} onChange={(e) => updateItem('self_pay_items', idx, 'amount', Number(e.target.value))} className="w-1/4 border p-1 rounded text-xs text-right" placeholder="金額"/>
                                    <div className="flex items-center gap-1 w-1/4">
                                        <input type="number" value={item.rate} onChange={(e) => updateItem('self_pay_items', idx, 'rate', Number(e.target.value))} className="w-full border p-1 rounded text-xs text-center" placeholder="抽成"/>
                                        <span className="text-xs">%</span>
                                    </div>
                                    <button onClick={() => removeItem('self_pay_items', idx)} className="text-red-300 hover:text-red-500"><Trash2 size={16} /></button>
                                </div>
                            ))}
                            <button onClick={() => addItem('self_pay_items')} className="w-full border border-dashed border-purple-200 text-purple-600 p-1 rounded text-xs hover:bg-purple-50">+ 新增自費項目</button>
                        </div>
                        {ppfData.extra_items.map((item: any, idx: number) => (
                            <div key={item.id} className="flex gap-2 mb-2 items-center"><input value={item.name} onChange={(e) => updateItem('extra_items', idx, 'name', e.target.value)} className="w-2/3 border p-1 rounded text-xs" placeholder="例如：車馬費"/><input type="number" value={item.amount} onChange={(e) => updateItem('extra_items', idx, 'amount', Number(e.target.value))} className="w-1/3 border p-1 rounded text-xs text-right" placeholder="+/-"/><button onClick={() => removeItem('extra_items', idx)} className="text-red-300 hover:text-red-500"><Trash2 size={16} /></button></div>
                        ))}
                        <button onClick={() => addItem('extra_items')} className="w-full border border-dashed border-purple-200 text-purple-600 p-1 rounded text-xs hover:bg-purple-50">+ 新增特殊費用</button>
                    </div>

                </div>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-40">
                <div className="max-w-[1600px] mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-8">
                        <div><span className="block text-xs text-slate-400">本月實領總額 (Net Pay)</span><span className="text-3xl font-extrabold text-slate-800">${finalNetPay.toLocaleString()}</span></div>
                        <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-lg border border-slate-200">
                            <div className="flex items-center gap-1"><Landmark size={16} className="text-slate-500"/><span className="text-xs font-bold text-slate-600">匯款:</span><input type="number" value={ppfData.transfer_amount} onChange={(e) => setPpfData(p => ({...p, transfer_amount: Number(e.target.value)}))} className="w-24 border-b border-slate-300 bg-transparent text-right font-bold text-slate-800 focus:outline-none focus:border-blue-500" disabled={isLocked} /></div>
                            <div className="w-px h-4 bg-slate-300"></div>
                            <div className="flex items-center gap-1"><span className="text-xs font-bold text-slate-600">現金:</span><span className="font-bold text-green-600">${remainingCash.toLocaleString()}</span></div>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        {isLocked ? <button onClick={() => saveData('draft')} className="border border-red-200 text-red-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-red-50 transition" disabled={isSaving}><Unlock size={18}/> 解除封存</button> : <><button onClick={() => saveData('draft')} className="border border-blue-200 text-blue-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-50 transition" disabled={isSaving}><Save size={18}/> 暫存草稿</button><button onClick={() => saveData('locked')} className="bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition shadow-lg" disabled={isSaving}><Lock size={18}/> 結算並封存</button></>}
                    </div>
                </div>
            </div>
        </div>
    );
}
