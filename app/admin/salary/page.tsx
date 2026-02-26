// page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DollarSign, Calendar, Save, Archive, RefreshCw, CloudLightning, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';

import CalculatorView from './CalculatorView';
import SettingsModal from './SettingsModal';
import PayslipModal from './PayslipModal';
import { calculateStaffSalary } from './salaryEngine';

type Entity = { id: string; name: string };

export default function SalaryPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'calculator' | 'history'>('calculator');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [staffList, setStaffList] = useState<any[]>([]);
  const [liveReports, setLiveReports] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, any[]>>({});
  const [isSaved, setIsSaved] = useState(false);
  const [settingModalStaffId, setSettingModalStaffId] = useState<string | null>(null);
  const [printReport, setPrintReport] = useState<any | null>(null);
  const [entityList, setEntityList] = useState<Entity[]>([]);
  const [authChecked, setAuthChecked] = useState(false);

  // 認證檢查（雙重保護）
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          if (!data.authenticated || data.authLevel !== 'boss') {
            // 未登入或不是 boss 權限，重定向到登入頁
            router.push('/login?redirect=/admin/salary');
            return;
          }
        } else {
          router.push('/login?redirect=/admin/salary');
          return;
        }
        setAuthChecked(true);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login?redirect=/admin/salary');
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => { 
    if (!authChecked) return;
    fetchSystemSettings(); 
    fetchStaffSettings();
  }, [authChecked]);
  
  useEffect(() => {
    if (!authChecked || !selectedMonth) return;
    fetchAdjustments();
    checkIfArchived();
    if (viewMode === 'calculator') performCalculation();
    else loadHistory();
  }, [selectedMonth, viewMode, authChecked]);

  // 當員工資料變動或手動調整變動時，重新試算
  useEffect(() => {
    if (viewMode === 'calculator' && staffList.length > 0 && selectedMonth) {
      performCalculation();
    }
  }, [staffList, adjustments]);

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch('/api/settings?key=org_entities');
      const json = await res.json();
      if (json.data && json.data.length > 0 && json.data[0]?.value) {
        setEntityList(JSON.parse(json.data[0].value));
      }
    } catch (error: any) {
      console.error('Error fetching system settings:', error);
    }
  };

  const fetchStaffSettings = async () => {
    try {
      const res = await fetch('/api/staff');
      const json = await res.json();
      // 過濾掉醫師
      if (json.data) {
        json.data = json.data.filter((s: any) => s.role !== '醫師');
      }
      if (json.data) {
        // 權重排序：依照職類分組排序
        const roleWeight: Record<string, number> = { 
          '醫師': 1, 
          '主管': 2, 
          '櫃台': 3, 
          '護理師': 4, 
          '營養師': 5, 
          '診助': 6, 
          '藥師': 7, 
          '藥局助理': 8 
        };
        const sorted = [...json.data].sort((a, b) => {
          const aWeight = roleWeight[a.role || ''] ?? 999;
          const bWeight = roleWeight[b.role || ''] ?? 999;
          if (aWeight !== bWeight) return aWeight - bWeight;
          // 同職類內按姓名排序
          return (a.name || '').localeCompare(b.name || '');
        });
        const formatted = sorted.map((s: any) => ({
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
    } catch (error: any) {
      console.error('Error fetching staff settings:', error);
    }
  };

  const fetchAdjustments = async () => {
    try {
      const res = await fetch(`/api/salary/adjustments?year_month=${selectedMonth}`);
      const json = await res.json();
      const map: Record<string, any[]> = {};
      json.data?.forEach((item: any) => {
        if (!map[item.staff_id]) map[item.staff_id] = [];
        map[item.staff_id].push(item);
      });
      setAdjustments(map);
    } catch (error: any) {
      console.error('Error fetching adjustments:', error);
    }
  };

  const checkIfArchived = async () => {
    try {
      const res = await fetch(`/api/salary/history?year_month=${selectedMonth}`);
      const json = await res.json();
      setIsSaved(!!json.data && json.data.length > 0);
    } catch (error: any) {
      console.error('Error checking archive status:', error);
    }
  };

  // --- 核心計算流程 ---
  const performCalculation = async () => {
    if (!selectedMonth) return;
    
    try {
      // 從 API 獲取所有計算所需的數據
      const res = await fetch(`/api/salary/calculate?month=${selectedMonth}`);
      const json = await res.json();
      
      if (json.error) {
        console.error('Error fetching calculation data:', json.error);
        return;
      }

      const { logs, roster, holidays, leaves, monthlyStandardHours } = json;
      
      const holidaySet = new Set<string>((holidays || []).map((h: any) => String(h.date)));
      
      // 建構 Roster Map，包含班表細節（加入日期清理與 JSON 解析防呆）
      const rosterMap: Record<string, any> = {};
      roster?.forEach((r: any) => {
        const cleanDate = r.date ? String(r.date).split('T')[0] : '';
        let parsedShifts = r.shift_details;
        if (typeof parsedShifts === 'string') {
          try { 
            parsedShifts = JSON.parse(parsedShifts); 
          } catch (e) { 
            parsedShifts = {}; 
          }
        }
        rosterMap[`${r.staff_id}_${cleanDate}`] = {
          day_type: r.day_type,
          shift_details: parsedShifts
        };
      });

      const reports: any[] = [];

      staffList.forEach(staff => {
        const myLogs = logs?.filter((l: any) => String(l.staff_id) === String(staff.id)) || [];
        const myLeaves = leaves?.filter((l: any) => String(l.staff_id) === String(staff.id)) || [];

        // 執行計算引擎
        const calc = calculateStaffSalary(staff, myLogs, rosterMap, holidaySet, monthlyStandardHours, myLeaves);

        // 金額彙總
        const fixedBonus = staff.bonuses.reduce((sum: number, b: any) => sum + Number(b.amount), 0);
        const fixedDeduction = staff.default_deductions.reduce((sum: number, b: any) => sum + Number(b.amount), 0);
        const myAdj = adjustments[staff.id] || [];
        const tempBonus = myAdj.filter((a: any) => a.type === 'bonus').reduce((sum: number, b: any) => sum + Number(b.amount), 0);
        const tempDeduction = myAdj.filter((a: any) => a.type === 'deduction').reduce((sum: number, b: any) => sum + Number(b.amount), 0);

        const gross = calc.base_pay + calc.ot_pay + calc.holiday_pay + fixedBonus + tempBonus + calc.leave_addition;
        const deduction = staff.insurance_labor + staff.insurance_health + fixedDeduction + tempDeduction + calc.leave_deduction;

        reports.push({
          ...calc,
          staff_id: staff.id, // 新增 staff_id 欄位（UUID）
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
          bonus_details: [...staff.bonuses, ...myAdj.filter((a: any) => a.type === 'bonus')],
          deduction_details: [...staff.default_deductions, ...myAdj.filter((a: any) => a.type === 'deduction')]
        });
      });
      setLiveReports(reports);
    } catch (error: any) {
      console.error('Error performing calculation:', error);
    }
  };

  // 手動調整增刪修
  const modifyAdjustment = async (staffId: string, type: 'bonus' | 'deduction', action: 'add' | 'update' | 'remove', id?: number, field?: string, value?: any) => {
    const currentList = adjustments[staffId] || [];
    let newList = [...currentList];
    
    if (action === 'add') {
      newList.push({ id: -1, staff_id: staffId, year_month: selectedMonth, type, name: type === 'bonus' ? '本月獎金' : '本月扣款', amount: 0 });
    } else if (action === 'update' && id) {
      newList = newList.map(item => item.id === id ? { ...item, [field!]: value } : item);
    } else if (action === 'remove' && id) {
      newList = newList.filter(item => item.id !== id);
    }
    setAdjustments(prev => ({ ...prev, [staffId]: newList }));

    try {
      if (action === 'add') {
        const res = await fetch('/api/salary/adjustments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ staff_id: staffId, year_month: selectedMonth, type, name: type === 'bonus' ? '本月獎金' : '本月扣款', amount: 0 })
        });
        if (res.ok) fetchAdjustments();
      } else if (action === 'update' && id) {
        await fetch('/api/salary/adjustments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, field, value })
        });
      } else if (action === 'remove' && id) {
        await fetch(`/api/salary/adjustments?id=${id}`, { method: 'DELETE' });
      }
    } catch (error: any) {
      console.error('Error modifying adjustment:', error);
      alert('操作失敗: ' + error.message);
    }
  };
  
  const updateStaff = async (id: string, field: string, value: any) => {
    const newList = staffList.map(s => s.id === id ? { ...s, [field]: value } : s);
    setStaffList(newList);
    try {
      await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value })
      });
    } catch (error: any) {
      console.error('Error updating staff:', error);
      alert('更新失敗: ' + error.message);
    }
  };

  const handleArchive = async () => {
    if (!confirm(`確定要封存 ${selectedMonth} 的薪資資料嗎？`)) return;
    try {
      const records = liveReports.map(rpt => ({
        year_month: selectedMonth,
        staff_id: rpt.staff_id || staffList.find(s => s.name === rpt.staff_name)?.id,
        staff_name: rpt.staff_name,
        snapshot: rpt
      }));
      const res = await fetch('/api/salary/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records })
      });
      const json = await res.json();
      if (json.error) alert('封存失敗: ' + json.error);
      else { alert('封存成功！'); setIsSaved(true); }
    } catch (error: any) {
      alert('封存失敗: ' + error.message);
    }
  };

  const handleUnArchive = async () => {
    if (!confirm(`⚠️ 警告：解除封存將刪除 ${selectedMonth} 的歷史紀錄。\n\n確定要繼續嗎？`)) return;
    try {
      const res = await fetch(`/api/salary/history?year_month=${selectedMonth}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.error) alert('解除失敗: ' + json.error);
      else { alert('已解除封存。'); setIsSaved(false); setViewMode('calculator'); fetchAdjustments(); }
    } catch (error: any) {
      alert('解除失敗: ' + error.message);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/salary/history?year_month=${selectedMonth}`);
      const json = await res.json();
      if (json.data && json.data.length > 0) {
        // 🟢 對舊版封存資料做防呆：補上缺少的欄位與預設值，避免薪資單明細按鈕觸發時當機
        const normalized = json.data.map((d: any) => {
          const snap = d.snapshot || {};
          return {
            // 先給預設值，再讓 snapshot 蓋過去（有值的話就用原本的）
            total_work_hours: 0,
            normal_hours: 0,
            period_ot_hours: 0,
            dailyRecords: [],
            bonus_details: [],
            deduction_details: [],
            ...snap,
            is_archived: true,
            history_id: d.id,
          };
        });
        setLiveReports(normalized);
        setIsSaved(true);
      } else {
        setLiveReports([]);
        setIsSaved(false);
      }
    } catch (error: any) {
      console.error('Error loading history:', error);
    }
  };

  // 月份切換輔助
  const changeMonth = (delta: number) => {
      const current = new Date(`${selectedMonth}-01`);
      const newDate = delta > 0 ? addMonths(current, 1) : subMonths(current, 1);
      setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  // 未認證時不顯示內容
  if (!authChecked) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-slate-400">檢查權限中...</div>
      </div>
    );
  }

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
        onOpenSettings={(staffId: string) => setSettingModalStaffId(staffId)}
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
