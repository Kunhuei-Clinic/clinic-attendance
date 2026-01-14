// page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { DollarSign, Calendar, Save, Archive, RefreshCw, CloudLightning, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';

import CalculatorView from './CalculatorView';
import SettingsModal from './SettingsModal';
import PayslipModal from './PayslipModal';
import { calculateStaffSalary } from './salaryEngine';

// 請替換為你的環境變數或確保環境已設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

type Entity = { id: string; name: string };

export default function SalaryPage() {
  const [viewMode, setViewMode] = useState<'calculator' | 'history'>('calculator');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [staffList, setStaffList] = useState<any[]>([]);
  const [liveReports, setLiveReports] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<Record<number, any[]>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [settingModalStaffId, setSettingModalStaffId] = useState<number | null>(null);
  const [printReport, setPrintReport] = useState<any | null>(null);
  const [entityList, setEntityList] = useState<Entity[]>([]);

  useEffect(() => { 
    fetchSystemSettings(); 
    fetchStaffSettings();
  }, []);
  
  useEffect(() => {
    if (selectedMonth) {
      fetchAdjustments();
      checkIfArchived();
      if (viewMode === 'calculator') performCalculation();
      else loadHistory();
    }
  }, [selectedMonth, viewMode]);

  // 當員工資料變動或手動調整變動時，重新試算
  useEffect(() => {
    if (viewMode === 'calculator' && staffList.length > 0 && selectedMonth) {
      performCalculation();
    }
  }, [staffList, adjustments]);

  const fetchSystemSettings = async () => {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'org_entities').single();
    if (data?.value) setEntityList(JSON.parse(data.value));
  };

  const fetchStaffSettings = async () => {
    const { data } = await supabase.from('staff').select('*').neq('role', '醫師').order('id');
    if (data) {
        const formatted = data.map((s: any) => ({
            ...s,
            entity: s.entity || 'clinic', 
            salary_mode: s.salary_mode || 'hourly',
            base_salary: s.base_salary || 183,
            work_rule: s.work_rule || 'normal',
            clock_in_calc_mode: s.clock_in_calc_mode || 'actual', // 預設實支實付
            bonuses: Array.isArray(s.bonuses) ? s.bonuses : [],
            default_deductions: Array.isArray(s.default_deductions) ? s.default_deductions : [],
            insurance_labor: s.insurance_labor || 0,
            insurance_health: s.insurance_health || 0,
        }));
        setStaffList(formatted);
    }
  };

  const fetchAdjustments = async () => {
    const { data } = await supabase.from('salary_adjustments').select('*').eq('year_month', selectedMonth);
    const map: Record<number, any[]> = {};
    data?.forEach((item: any) => {
      if (!map[item.staff_id]) map[item.staff_id] = [];
      map[item.staff_id].push(item);
    });
    setAdjustments(map);
  };

  const checkIfArchived = async () => {
    const { data } = await supabase.from('salary_history').select('id').eq('year_month', selectedMonth).limit(1);
    setIsSaved(!!data && data.length > 0);
  };

  // --- 核心計算流程 ---
  const performCalculation = async () => {
    if (!selectedMonth) return;
    const startDate = `${selectedMonth}-01T00:00:00`;
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextMonth = new Date(y, m, 1).toISOString();
    
    // 計算月標準工時
    const daysInMonth = new Date(y, m, 0).getDate();
    let standardWorkDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(y, m - 1, d).getDay();
        if (day !== 0 && day !== 6) standardWorkDays++;
    }
    const monthlyStandardHours = standardWorkDays * 8;

    // 1. 撈取考勤 Log
    const { data: logs } = await supabase.from('attendance_logs').select('*').gte('clock_in_time', startDate).lt('clock_in_time', nextMonth);
    
    // 2. 撈取班表 (包含 shift_details JSONB)
    const { data: rosterData } = await supabase.from('roster').select('*').gte('date', startDate).lt('date', nextMonth);
    
    // 3. 撈取假日表
    const { data: holidayData } = await supabase.from('clinic_holidays').select('date').gte('date', startDate).lt('date', nextMonth);
    
    // 4. 撈取請假單
    const { data: leaveData } = await supabase.from('leave_requests').select('*').eq('status', 'approved').gte('start_time', startDate).lt('start_time', nextMonth);
    
    const holidaySet = new Set(holidayData?.map((h:any) => h.date));
    
    // 建構 Roster Map，包含班表細節
    const rosterMap: Record<string, any> = {};
    rosterData?.forEach((r:any) => {
        rosterMap[`${r.staff_id}_${r.date}`] = {
            day_type: r.day_type,
            shift_details: r.shift_details // 傳入 Shift JSON
        };
    });

    const reports: any[] = [];

    staffList.forEach(staff => {
       const myLogs = logs?.filter((l:any) => l.staff_name === staff.name) || [];
       const myLeaves = leaveData?.filter((l:any) => l.staff_id === staff.id) || [];

       // 執行計算引擎
       const calc = calculateStaffSalary(staff, myLogs, rosterMap, holidaySet, monthlyStandardHours, myLeaves);

       // 金額彙總
       const fixedBonus = staff.bonuses.reduce((sum:number, b:any) => sum + Number(b.amount), 0);
       const fixedDeduction = staff.default_deductions.reduce((sum:number, b:any) => sum + Number(b.amount), 0);
       const myAdj = adjustments[staff.id] || [];
       const tempBonus = myAdj.filter((a:any)=>a.type==='bonus').reduce((sum:number, b:any)=>sum+Number(b.amount),0);
       const tempDeduction = myAdj.filter((a:any)=>a.type==='deduction').reduce((sum:number, b:any)=>sum+Number(b.amount),0);

       const gross = calc.base_pay + calc.ot_pay + calc.holiday_pay + fixedBonus + tempBonus + calc.leave_addition;
       const deduction = staff.insurance_labor + staff.insurance_health + fixedDeduction + tempDeduction + calc.leave_deduction;

       reports.push({
           ...calc,
           staff_entity: staff.entity,
           staff_name: staff.name,
           salary_mode: staff.salary_mode,
           work_rule: staff.work_rule,
           fixed_bonus_pay: fixedBonus,
           temp_bonus_pay: tempBonus,
           insurance_labor: staff.insurance_labor,
           insurance_health: staff.insurance_health,
           fixed_deduction_pay: fixedDeduction,
           temp_deduction_pay: tempDeduction,
           gross_pay: gross,
           total_deduction: deduction,
           net_pay: gross - deduction,
           bonus_details: [...staff.bonuses, ...myAdj.filter((a:any)=>a.type==='bonus')],
           deduction_details: [...staff.default_deductions, ...myAdj.filter((a:any)=>a.type==='deduction')]
       });
    });
    setLiveReports(reports);
  };

  // 手動調整增刪修
  const modifyAdjustment = async (staffId: number, type: 'bonus' | 'deduction', action: 'add' | 'update' | 'remove', id?: number, field?: string, value?: any) => {
    // (保持原有的實作邏輯，略過以節省篇幅)
    // 實作與原檔案相同...
    const currentList = adjustments[staffId] || [];
    let newList = [...currentList];
    if (action === 'add') {
      newList.push({ id: -1, staff_id: staffId, year_month: selectedMonth, type, name: type==='bonus'?'本月獎金':'本月扣款', amount: 0 });
    } else if (action === 'update' && id) {
      newList = newList.map(item => item.id === id ? { ...item, [field!]: value } : item);
    } else if (action === 'remove' && id) {
      newList = newList.filter(item => item.id !== id);
    }
    setAdjustments(prev => ({ ...prev, [staffId]: newList }));

    if (action === 'add') {
      await supabase.from('salary_adjustments').insert([{ staff_id: staffId, year_month: selectedMonth, type, name: type==='bonus'?'本月獎金':'本月扣款', amount: 0 }]);
    } else if (action === 'update' && id) {
      await supabase.from('salary_adjustments').update({ [field!]: value }).eq('id', id);
    } else if (action === 'remove' && id) {
      await supabase.from('salary_adjustments').delete().eq('id', id);
    }
    if (action === 'add') fetchAdjustments();
  };
  
  const updateStaff = async (id: number, field: string, value: any) => {
    const newList = staffList.map(s => s.id === id ? { ...s, [field]: value } : s);
    setStaffList(newList);
    await supabase.from('staff').update({ [field]: value }).eq('id', id);
  };

  const handleArchive = async () => {
    if (!confirm(`確定要封存 ${selectedMonth} 的薪資資料嗎？`)) return;
    const records = liveReports.map(rpt => ({
      year_month: selectedMonth,
      staff_id: staffList.find(s => s.name === rpt.staff_name)?.id,
      staff_name: rpt.staff_name,
      snapshot: rpt
    }));
    const { error } = await supabase.from('salary_history').insert(records);
    if (error) alert('封存失敗: ' + error.message);
    else { alert('封存成功！'); setIsSaved(true); }
  };

  const handleUnArchive = async () => {
    if (!confirm(`⚠️ 警告：解除封存將刪除 ${selectedMonth} 的歷史紀錄。\n\n確定要繼續嗎？`)) return;
    const { error } = await supabase.from('salary_history').delete().eq('year_month', selectedMonth);
    if (error) alert('解除失敗: ' + error.message);
    else { alert('已解除封存。'); setIsSaved(false); setViewMode('calculator'); fetchAdjustments(); }
  };

  const loadHistory = async () => {
    const { data } = await supabase.from('salary_history').select('snapshot, id').eq('year_month', selectedMonth);
    if (data && data.length > 0) {
      setLiveReports(data.map((d: any) => ({ ...d.snapshot, is_archived: true, history_id: d.id })));
      setIsSaved(true);
    } else {
      setLiveReports([]);
      setIsSaved(false);
    }
  };

  // 月份切換輔助
  const changeMonth = (delta: number) => {
      const current = new Date(`${selectedMonth}-01`);
      const newDate = delta > 0 ? addMonths(current, 1) : subMonths(current, 1);
      setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  return (
    <div className="w-full animate-fade-in relative space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <DollarSign className="text-green-600" size={28}/> 
            {viewMode === 'calculator' ? '薪資結算系統' : '歷史薪資查詢'}
          </h2>
          <div className="flex bg-slate-100 p-1.5 rounded-xl">
            <button onClick={() => setViewMode('calculator')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${viewMode==='calculator'?'bg-white shadow text-blue-600':'text-slate-500 hover:text-slate-700'}`}>本月試算</button>
            <button onClick={() => setViewMode('history')} className={`px-4 py-1.5 text-sm font-bold rounded-lg transition ${viewMode==='history'?'bg-white shadow text-purple-600':'text-slate-500 hover:text-slate-700'}`}>歷史紀錄</button>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {viewMode === 'calculator' && (
             <div className="flex items-center gap-1 text-xs text-slate-400 mr-2 animate-pulse">
                <CloudLightning size={12}/> 自動存檔中
             </div>
          )}
          
          {/* 月份選擇器 */}
          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1">
            <button onClick={()=>changeMonth(-1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500"><ChevronLeft size={16}/></button>
            <div className="flex items-center gap-2 px-2">
                <Calendar size={16} className="text-slate-400"/>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-transparent font-bold text-slate-700 outline-none w-32 text-center"/>
            </div>
            <button onClick={()=>changeMonth(1)} className="p-2 hover:bg-white hover:shadow-sm rounded-lg text-slate-500"><ChevronRight size={16}/></button>
          </div>
          
          {viewMode === 'calculator' && !isSaved && (
             <button onClick={handleArchive} className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-black transition shadow-lg hover:shadow-xl active:scale-95">
               <Save size={18}/> 結算並封存
             </button>
          )}
          {isSaved && (
            <div className="flex gap-2">
                 <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-xl font-bold border border-green-200">
                   <Archive size={16}/> {viewMode==='calculator'?'本月已封存':'已調閱封存檔'}
                 </div>
                 {viewMode === 'history' && (
                    <button onClick={handleUnArchive} className="flex items-center gap-2 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition border border-red-100">
                    <RefreshCw size={16}/> 解除封存
                    </button>
                 )}
            </div>
          )}
        </div>
      </div>

      <CalculatorView 
        reports={liveReports} 
        isArchived={viewMode === 'history' || isSaved} 
        adjustments={adjustments} 
        modifyAdjustment={modifyAdjustment} 
        staffList={staffList}
        onOpenSettings={(staffId: number) => setSettingModalStaffId(staffId)}
        onPrint={(rpt: any) => setPrintReport(rpt)}
      />

      {liveReports.length === 0 && (
         <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
           <History size={48} className="mx-auto mb-4 opacity-20"/>
           <p>此月份尚無資料或尚未結算</p>
         </div>
      )}

      {settingModalStaffId !== null && (
        <SettingsModal 
          staff={staffList.find(s => s.id === settingModalStaffId)}
          updateStaff={updateStaff}
          entityList={entityList}
          onClose={() => setSettingModalStaffId(null)}
        />
      )}

      {printReport && (
        <PayslipModal 
          report={printReport} 
          yearMonth={selectedMonth} 
          clinicName={entityList.find(e => e.id === printReport.staff_entity)?.name || '診所'}
          onClose={() => setPrintReport(null)} 
        />
      )}
    </div>
  );
}
