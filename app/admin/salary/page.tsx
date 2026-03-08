// page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  Calendar,
  History,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';

import SettingsModal from './SettingsModal';
import PayslipModal from './PayslipModal';
import { calculateStaffSalary } from './salaryEngine';
import SalaryTable from './SalaryTable';
import AdjustmentModal from './AdjustmentModal';

type Entity = { id: string; name: string };

const calculateAnnualLeave = (startDateStr: string) => {
  if (!startDateStr) return 0;
  const start = new Date(startDateStr);
  const diffTime = Math.abs(new Date().getTime() - start.getTime());
  const years = diffTime / (1000 * 60 * 60 * 24 * 365);
  if (years < 0.5) return 0;
  if (years < 1) return 3;
  if (years < 2) return 7;
  if (years < 3) return 10;
  if (years < 5) return 14;
  if (years < 10) return 15;
  return 15 + Math.floor(years - 10);
};

export default function SalaryPage() {
  const router = useRouter();
  const [selectedMonth, setSelectedMonth] = useState(
    format(new Date(), 'yyyy-MM')
  );
  const [staffList, setStaffList] = useState<any[]>([]);
  const [liveReports, setLiveReports] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, any[]>>({});
  const [lockedRecords, setLockedRecords] = useState<any[]>([]);
  const [settingModalStaffId, setSettingModalStaffId] = useState<string | null>(
    null
  );
  const [printReport, setPrintReport] = useState<any | null>(null);
  const [entityList, setEntityList] = useState<Entity[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMonthData, setIsFetchingMonthData] = useState(false);
  const [hasConfirmedMonth, setHasConfirmedMonth] = useState(false);
  const [lastMonthAdjustments, setLastMonthAdjustments] = useState<Record<string, any[]>>({});

  // 新增：篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | string>('all');

  // 新增：獎懲調整 Modal 狀態
  const [adjModalStaff, setAdjModalStaff] = useState<any | null>(null);

  // 認證檢查（雙重保護）
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
          if (!data.authenticated || data.authLevel !== 'boss') {
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

  // 載入系統設定與員工清單
  useEffect(() => {
    if (!authChecked) return;
    fetchSystemSettings();
    fetchStaffSettings();
  }, [authChecked]);

  // 每次月份變更時，載入調整與已封存紀錄
  useEffect(() => {
    setLiveReports([]);
    if (!authChecked || !selectedMonth || !hasConfirmedMonth) return;

    setIsLoading(true);
    setIsFetchingMonthData(true); // 🟢 上鎖：開始抓取 API 資料

    Promise.all([fetchAdjustments(), fetchLockedRecords()]).finally(() => {
      setIsFetchingMonthData(false); // 🟢 解鎖：所有 API 資料都確實回來了
    });
  }, [selectedMonth, authChecked, hasConfirmedMonth]);

  // 當員工資料 / 調整 / 鎖定紀錄變動時，重新試算
  useEffect(() => {
    if (!authChecked || !selectedMonth || !hasConfirmedMonth) return;
    if (staffList.length === 0) return;

    // 🟢 終極攔截：如果 API 還在跑，絕對不准提早開始算薪水！
    if (isFetchingMonthData) return;

    setIsLoading(true); // 確保計算時遮罩是蓋著的
    performCalculation().finally(() => {
      setIsLoading(false); // 🟢 真正試算完畢後，才把遮罩拿掉
    });
  }, [staffList, adjustments, lockedRecords, selectedMonth, authChecked, hasConfirmedMonth, isFetchingMonthData]);

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
        const formatted = json.data.map((s: any) => ({
          ...s,
          entity: s.entity || 'clinic',
          salary_mode: s.salary_mode || 'hourly',
          base_salary: s.base_salary || 183,
          work_rule: s.work_rule || 'normal',
          clock_in_calc_mode: s.clock_in_calc_mode || 'actual', // 預設實支實付
          bonuses: Array.isArray(s.bonuses) ? s.bonuses : [],
          default_deductions: Array.isArray(s.default_deductions)
            ? s.default_deductions
            : [],
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
      // 抓取當月
      const res = await fetch(`/api/salary/adjustments?year_month=${selectedMonth}`);
      const json = await res.json();
      const map: Record<string, any[]> = {};
      json.data?.forEach((item: any) => {
        if (!map[item.staff_id]) map[item.staff_id] = [];
        map[item.staff_id].push(item);
      });
      setAdjustments(map);

      // 抓取上個月 (供 0 元自動繼承使用)
      const prevMonth = format(subMonths(new Date(`${selectedMonth}-01`), 1), 'yyyy-MM');
      const prevRes = await fetch(`/api/salary/adjustments?year_month=${prevMonth}`);
      const prevJson = await prevRes.json();
      const prevMap: Record<string, any[]> = {};
      prevJson.data?.forEach((item: any) => {
        if (!prevMap[item.staff_id]) prevMap[item.staff_id] = [];
        prevMap[item.staff_id].push(item);
      });
      setLastMonthAdjustments(prevMap);
    } catch (error: any) {
      console.error('Error fetching adjustments:', error);
    }
  };

  const fetchLockedRecords = async () => {
    try {
      const res = await fetch(
        `/api/salary/history?year_month=${selectedMonth}`
      );
      const json = await res.json();
      setLockedRecords(json.data || []);
    } catch (error: any) {
      console.error('Error fetching locked salary records:', error);
    }
  };

  // --- 核心計算流程：草稿 + 快照 Merge ---
  const performCalculation = async () => {
    if (!selectedMonth) return;

    try {
      const res = await fetch(`/api/salary/calculate?month=${selectedMonth}`);
      const json = await res.json();

      if (json.error) {
        console.error('Error fetching calculation data:', json.error);
        return;
      }

      const { logs, roster, holidays, leaves, monthlyStandardHours } = json;

      const holidaySet = new Set<string>(
        (holidays || []).map((h: any) => String(h.date))
      );

      const rosterMap: Record<string, any> = {};
      roster?.forEach((r: any) => {
        const cleanDate = r.date ? String(r.date).split('T')[0] : '';
        let parsedShifts = r.shift_details;
        if (typeof parsedShifts === 'string') {
          try {
            parsedShifts = JSON.parse(parsedShifts);
          } catch {
            parsedShifts = {};
          }
        }
        rosterMap[`${r.staff_id}_${cleanDate}`] = {
          day_type: r.day_type,
          shift_details: parsedShifts,
        };
      });

      const reports: any[] = [];

      staffList.forEach((staff) => {
        const myLogs =
          logs?.filter(
            (l: any) => String(l.staff_id) === String(staff.id)
          ) || [];
        const myLeaves =
          leaves?.filter(
            (l: any) => String(l.staff_id) === String(staff.id)
          ) || [];

        const calc = calculateStaffSalary(
          staff,
          myLogs,
          rosterMap,
          holidaySet,
          monthlyStandardHours,
          myLeaves,
          selectedMonth
        );

        const fixedBonus = (staff.bonuses || []).reduce(
          (sum: number, b: any) => sum + Number(b.amount),
          0
        );
        const fixedDeduction = (staff.default_deductions || []).reduce(
          (sum: number, b: any) => sum + Number(b.amount),
          0
        );
        const myAdj = adjustments[staff.id] || [];
        const tempBonus = myAdj
          .filter((a: any) => a.type === 'bonus')
          .reduce((sum: number, b: any) => sum + Number(b.amount), 0);
        const tempDeduction = myAdj
          .filter((a: any) => a.type === 'deduction')
          .reduce((sum: number, b: any) => sum + Number(b.amount), 0);

        const gross =
          calc.base_pay +
          calc.ot_pay +
          calc.holiday_pay +
          fixedBonus +
          tempBonus +
          calc.leave_addition;
        const deduction =
          staff.insurance_labor +
          staff.insurance_health +
          fixedDeduction +
          tempDeduction +
          calc.leave_deduction;

        let mergedReport: any = {
          ...calc,
          staff_id: staff.id,
          staff_entity: staff.entity,
          staff_name: staff.name,
          salary_mode: staff.salary_mode,
          work_rule: staff.work_rule,
          base_salary: staff.base_salary,
          online_hourly_rate: staff.online_hourly_rate,
          hire_date: staff.start_date,
          annual_leave_days: calculateAnnualLeave(staff.start_date),
          fixed_bonus_pay: fixedBonus,
          temp_bonus_pay: tempBonus,
          insurance_labor: staff.insurance_labor,
          insurance_health: staff.insurance_health,
          fixed_deduction_pay: fixedDeduction,
          temp_deduction_pay: tempDeduction,
          gross_pay: gross,
          total_deduction: deduction,
          net_pay: gross - deduction,
          fixed_bonus_details: staff.bonuses || [],
          temp_bonus_details: myAdj.filter((a: any) => a.type === 'bonus' && Number(a.amount) !== 0),
          fixed_deduction_details: staff.default_deductions || [],
          temp_deduction_details: myAdj.filter((a: any) => a.type === 'deduction' && Number(a.amount) !== 0),
        };

        const locked = lockedRecords.find(
          (rec: any) => String(rec.staff_id) === String(staff.id)
        );

        if (locked) {
          const snap = locked.snapshot || {};
          const normalizedSnap = {
            total_work_hours: 0,
            normal_hours: 0,
            period_ot_hours: 0,
            dailyRecords: [],
            fixed_bonus_details: [],
            temp_bonus_details: [],
            fixed_deduction_details: [],
            temp_deduction_details: [],
            ...snap,
          };

          mergedReport = {
            ...mergedReport,
            ...normalizedSnap,
            is_locked: true,
            history_id: locked.id,
          };
        } else {
          mergedReport = {
            ...mergedReport,
            is_locked: false,
          };
        }

        reports.push(mergedReport);
      });

      // 排序改由 derived state 處理，這裡不再強制排序
      setLiveReports(reports);
    } catch (error: any) {
      console.error('Error performing calculation:', error);
    }
  };

  // 手動調整增刪修（給 AdjustmentModal 使用）
  const modifyAdjustment = async (
    staffId: string,
    type: 'bonus' | 'deduction',
    action: 'add' | 'update' | 'remove',
    id?: number,
    field?: string,
    value?: any
  ) => {
    const currentList = adjustments[staffId] || [];
    let newList = [...currentList];

    if (action === 'add') {
      newList.push({
        id: -1,
        staff_id: staffId,
        year_month: selectedMonth,
        type,
        name: type === 'bonus' ? '本月獎金' : '本月扣款',
        amount: 0,
      });
    } else if (action === 'update' && id) {
      newList = newList.map((item) =>
        item.id === id ? { ...item, [field!]: value } : item
      );
    } else if (action === 'remove' && id) {
      newList = newList.filter((item) => item.id !== id);
    }
    setAdjustments((prev) => ({ ...prev, [staffId]: newList }));

    try {
      if (action === 'add') {
        const res = await fetch('/api/salary/adjustments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: staffId,
            year_month: selectedMonth,
            type,
            name: type === 'bonus' ? '本月獎金' : '本月扣款',
            amount: 0,
          }),
        });
        if (res.ok) fetchAdjustments();
      } else if (action === 'update' && id) {
        await fetch('/api/salary/adjustments', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, field, value }),
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
    const newList = staffList.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    setStaffList(newList);
    try {
      await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      });
    } catch (error: any) {
      console.error('Error updating staff:', error);
      alert('更新失敗: ' + error.message);
    }
  };

  // 封存單一員工（鎖定）
  const lockEmployee = async (rpt: any) => {
    try {
      const records = [
        {
          year_month: selectedMonth,
          staff_id: rpt.staff_id,
          staff_name: rpt.staff_name,
          snapshot: rpt,
        },
      ];

      const res = await fetch('/api/salary/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records }),
      });
      const json = await res.json();
      if (json.error) {
        alert('封存失敗: ' + json.error);
        return;
      }

      await fetchLockedRecords();
    } catch (error: any) {
      alert('封存失敗: ' + error.message);
    }
  };

  // 解除單一員工封存
  const unlockEmployee = async (historyId: string | number) => {
    try {
      const res = await fetch(`/api/salary/history?id=${historyId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.error) {
        alert('解除封存失敗: ' + json.error);
        return;
      }

      await fetchLockedRecords();
    } catch (error: any) {
      alert('解除封存失敗: ' + error.message);
    }
  };

  // 月份切換輔助
  const changeMonth = (delta: number) => {
    const current = new Date(`${selectedMonth}-01`);
    const newDate =
      delta > 0 ? addMonths(current, 1) : subMonths(current, 1);
    setSelectedMonth(format(newDate, 'yyyy-MM'));
  };

  // Derived State：篩選 + 排序
  const filteredAndSortedReports = React.useMemo(() => {
    let result = [...liveReports];

    // 1. 篩選
    if (searchTerm) {
      const term = searchTerm.trim();
      result = result.filter((r) =>
        (r.staff_name || '').includes(term)
      );
    }
    if (filterRole !== 'all') {
      result = result.filter((r) => r.staff_role === filterRole);
    }

    // 2. 排序：依 entityList / 職類(模糊) / display_order / 姓名
    const getRoleWeight = (role: string) => {
      if (!role) return 99;
      if (role.includes('醫師')) return 1;
      if (role.includes('主管')) return 2;
      if (role.includes('護理')) return 3;
      if (role.includes('行政') || role.includes('櫃台')) return 4;
      if (role.includes('藥')) return 5;
      if (role.includes('助')) return 6;
      return 99;
    };

    result.sort((a, b) => {
      const aEntIdx = entityList.findIndex(
        (e) => e.id === a.staff_entity
      );
      const bEntIdx = entityList.findIndex(
        (e) => e.id === b.staff_entity
      );
      const aEntityW = aEntIdx >= 0 ? aEntIdx : 99;
      const bEntityW = bEntIdx >= 0 ? bEntIdx : 99;
      if (aEntityW !== bEntityW) return aEntityW - bEntityW;

      const aRoleW = getRoleWeight(a.staff_role);
      const bRoleW = getRoleWeight(b.staff_role);
      if (aRoleW !== bRoleW) return aRoleW - bRoleW;

      const aStaff = staffList.find((s) => s.id === a.staff_id);
      const bStaff = staffList.find((s) => s.id === b.staff_id);
      const aDisp = aStaff?.display_order ?? 99;
      const bDisp = bStaff?.display_order ?? 99;
      if (aDisp !== bDisp) return aDisp - bDisp;

      return (a.staff_name || '').localeCompare(b.staff_name || '');
    });

    return result;
  }, [liveReports, searchTerm, filterRole, entityList, staffList]);

  // 未認證時不顯示內容
  if (!authChecked) {
    return (
      <div className="w-full flex items-center justify-center py-20">
        <div className="text-slate-400">檢查權限中...</div>
      </div>
    );
  }

  // 🟢 入口選擇畫面
  if (authChecked && !hasConfirmedMonth) {
    return (
      <div className="w-full flex items-center justify-center py-20 animate-fade-in min-h-[600px] bg-slate-50/50 rounded-3xl">
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 max-w-md w-full flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <Calendar className="text-blue-600" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">請選擇薪資月份</h2>
          <p className="text-slate-500 text-sm mb-8">選擇您要檢視或結算薪資的月份，系統將自動載入考勤資料並進行試算。</p>

          {/* 🟢 帶有左右快速切換的月份選擇器（對稱版面） */}
          <div className="flex items-center justify-center gap-3 w-full mb-8">
            <button
              onClick={() => setSelectedMonth(prev => format(subMonths(new Date(`${prev}-01`), 1), 'yyyy-MM'))}
              className="w-14 h-14 flex items-center justify-center flex-shrink-0 bg-slate-50 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-200 text-slate-500 hover:text-blue-600 transition shadow-sm"
              title="上個月"
            >
              <ChevronLeft size={24} />
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-[200px] sm:w-[220px] text-center text-base sm:text-lg font-bold text-slate-700 bg-white border-2 border-slate-200 rounded-xl py-3 px-3 outline-none focus:border-blue-500 focus:shadow-md transition-all shadow-sm"
            />
            <button
              onClick={() => setSelectedMonth(prev => format(addMonths(new Date(`${prev}-01`), 1), 'yyyy-MM'))}
              className="w-14 h-14 flex items-center justify-center flex-shrink-0 bg-slate-50 hover:bg-blue-50 rounded-xl border border-slate-200 hover:border-blue-200 text-slate-500 hover:text-blue-600 transition shadow-sm"
              title="下個月"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <button
            onClick={() => setHasConfirmedMonth(true)}
            className="w-full bg-blue-600 text-white font-bold text-lg py-4 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition transform active:scale-95 flex items-center justify-center gap-2"
          >
            <DollarSign size={20} /> 開始載入與結算
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in relative space-y-6">
      {/* 🟢 全局載入遮罩 */}
      {isLoading && (
        <div className="absolute inset-0 z-40 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-2xl transition-all min-h-[500px]">
          <div className="flex flex-col items-center gap-4 bg-white/95 p-8 rounded-2xl shadow-2xl border border-slate-100">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="text-slate-700 font-bold animate-pulse text-lg">資料讀取與薪資試算中...</span>
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
            <DollarSign className="text-green-600" size={28} />
            薪資結算系統
          </h2>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* 月份切換器（對稱） */}
          <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 p-1.5">
            <button
              onClick={() => changeMonth(-1)}
              className="w-10 h-10 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-colors"
              title="上個月"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 px-3 min-w-[140px] justify-center">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent font-bold text-slate-700 outline-none w-32 text-center cursor-pointer"
              />
            </div>
            <button
              onClick={() => changeMonth(1)}
              className="w-10 h-10 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-lg text-slate-500 transition-colors"
              title="下個月"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* 搜尋與職位篩選 */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋姓名..."
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full md:w-40 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
            >
              <option value="all">全部職位</option>
              <option value="醫師">醫師</option>
              <option value="主管">主管</option>
              <option value="櫃台">櫃台</option>
              <option value="護理師">護理師</option>
              <option value="營養師">營養師</option>
              <option value="診助">診助</option>
              <option value="藥師">藥師</option>
              <option value="藥局助理">藥局助理</option>
            </select>
          </div>
        </div>
      </div>

      <SalaryTable
        reports={filteredAndSortedReports}
        staffList={staffList}
        lockEmployee={lockEmployee}
        unlockEmployee={unlockEmployee}
        onOpenSettings={(staffId: string) => setSettingModalStaffId(staffId)}
        onPrint={(rpt: any) => setPrintReport(rpt)}
        setAdjModalStaff={setAdjModalStaff}
      />

      {liveReports.length === 0 && (
        <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
          <History size={48} className="mx-auto mb-4 opacity-20" />
          <p>此月份尚無資料或尚未結算</p>
        </div>
      )}

      {settingModalStaffId !== null && (
        <SettingsModal
          staff={staffList.find((s) => s.id === settingModalStaffId)}
          updateStaff={updateStaff}
          entityList={entityList}
          onClose={() => setSettingModalStaffId(null)}
        />
      )}

      {printReport && (
        <PayslipModal
          report={printReport}
          yearMonth={selectedMonth}
          clinicName={
            entityList.find((e) => e.id === printReport.staff_entity)?.name ||
            '診所'
          }
          onClose={() => setPrintReport(null)}
        />
      )}

      {adjModalStaff && (
        <AdjustmentModal
          staff={adjModalStaff}
          adjustments={adjustments}
          lastMonthAdjustments={lastMonthAdjustments}
          selectedMonth={selectedMonth}
          onSaveComplete={() => {
            fetchAdjustments();
            setAdjModalStaff(null);
          }}
          onClose={() => setAdjModalStaff(null)}
        />
      )}
    </div>
  );
}
