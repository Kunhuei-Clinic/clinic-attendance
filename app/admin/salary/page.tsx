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
  ChevronDown,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { addMonths, format, subMonths } from 'date-fns';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import SettingsModal from './SettingsModal';
import PayslipModal, { PrintContent } from './PayslipModal';
import { calculateStaffSalary } from './salaryEngine';
import SalaryTable from './SalaryTable';
import AdjustmentModal from './AdjustmentModal';

type Entity = { id: string; name: string };

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
  const [isZipping, setIsZipping] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false); // 🟢 新增下拉選單狀態
  const [entityList, setEntityList] = useState<Entity[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMonthData, setIsFetchingMonthData] = useState(false);
  const [hasConfirmedMonth, setHasConfirmedMonth] = useState(false);
  const [showBatchLockModal, setShowBatchLockModal] = useState(false);
  const [selectedLockIds, setSelectedLockIds] = useState<Set<string>>(new Set());
  const [lastMonthAdjustments, setLastMonthAdjustments] = useState<Record<string, any[]>>({});

  // 新增：篩選狀態
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | string>('all');

  // 新增：獎懲調整 Modal 狀態
  const [adjModalStaff, setAdjModalStaff] = useState<any | null>(null);

  // 🟢 批次產生合併為「單一檔案」的 PDF (支援雙頁 A4)
  const handleBatchDownloadSinglePdf = async () => {
    setIsZipping(true);
    // 💡 截圖前：把隱形容器叫出來
    const renderContainer = document.getElementById('hidden-render-container');
    if (renderContainer) renderContainer.classList.remove('hidden');

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      let isFirstPage = true;

      for (let i = 0; i < filteredAndSortedReports.length; i++) {
        const el = document.getElementById(`zip-capture-${i}`);
        if (!el) continue;

        const page1 = el.querySelector('.pdf-page-1') as HTMLElement;
        const page2 = el.querySelector('.pdf-page-2') as HTMLElement;

        if (page1) {
          if (!isFirstPage) pdf.addPage();
          const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData1 = canvas1.toDataURL('image/png');
          pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, pdfWidth * (canvas1.height / canvas1.width));
          isFirstPage = false;
        }
        if (page2) {
          pdf.addPage();
          const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData2 = canvas2.toDataURL('image/png');
          pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, pdfWidth * (canvas2.height / canvas2.width));
        }
      }
      pdf.save(`${selectedMonth}_薪資單_合併列印.pdf`);
    } catch (error) {
      console.error('PDF 產生失敗:', error);
      alert('合併 PDF 時發生錯誤');
    } finally {
      // 💡 截圖後：立刻把容器隱藏回去，恢復乾淨的畫面
      if (renderContainer) renderContainer.classList.add('hidden');
      setIsZipping(false);
    }
  };

  // 🟢 批次產生獨立 PDF 並打包成 ZIP (支援雙頁 A4)
  const handleBatchDownloadZip = async () => {
    setIsZipping(true);
    // 💡 截圖前：把隱形容器叫出來
    const renderContainer = document.getElementById('hidden-render-container');
    if (renderContainer) renderContainer.classList.remove('hidden');

    try {
      const zip = new JSZip();
      for (let i = 0; i < filteredAndSortedReports.length; i++) {
        const rpt = filteredAndSortedReports[i];
        const el = document.getElementById(`zip-capture-${i}`);
        if (!el) continue;

        const page1 = el.querySelector('.pdf-page-1') as HTMLElement;
        const page2 = el.querySelector('.pdf-page-2') as HTMLElement;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();

        if (page1) {
          const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData1 = canvas1.toDataURL('image/png');
          pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, pdfWidth * (canvas1.height / canvas1.width));
        }
        if (page2) {
          pdf.addPage();
          const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData2 = canvas2.toDataURL('image/png');
          pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, pdfWidth * (canvas2.height / canvas2.width));
        }

        const pdfBlob = pdf.output('blob');
        const safeName = (rpt.staff_name || '').replace(/\s+/g, '_');
        zip.file(`${safeName}_${selectedMonth}_薪資單.pdf`, pdfBlob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${selectedMonth}_薪資單批次下載.zip`);
    } catch (error) {
      console.error('ZIP 產生失敗:', error);
      alert('打包 ZIP 時發生錯誤');
    } finally {
      // 💡 截圖後：立刻把容器隱藏回去
      if (renderContainer) renderContainer.classList.add('hidden');
      setIsZipping(false);
    }
  };

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
      // 🟢 同時抓員工與系統設定（用系統職稱順序排序）
      const [staffRes, settingsRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/settings'),
      ]);
      const staffResult = await staffRes.json();
      const settingsResult = await settingsRes.json();

      let jobTitles: any[] = [];
      if (settingsResult.data) {
        const titlesSetting = settingsResult.data.find(
          (item: any) => item.key === 'job_titles'
        );
        if (titlesSetting && titlesSetting.value) {
          try {
            jobTitles = JSON.parse(titlesSetting.value);
          } catch (e) {}
        }
      }

      // 過濾掉醫師
      if (staffResult.data) {
        staffResult.data = staffResult.data.filter(
          (s: any) => s.role !== '醫師'
        );
      }

      if (staffResult.data) {
        const getRoleWeight = (roleName: string) => {
          const index = jobTitles.findIndex(
            (j: any) => (typeof j === 'string' ? j : j.name) === roleName
          );
          return index === -1 ? 999 : index;
        };

        const sorted = [...staffResult.data].sort((a: any, b: any) => {
          const aWeight = getRoleWeight(a.role || '');
          const bWeight = getRoleWeight(b.role || '');
          if (aWeight !== bWeight) return aWeight - bWeight;
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
          default_deductions: Array.isArray(s.default_deductions)
            ? s.default_deductions
            : [],
          insurance_labor: s.insurance_labor || 0,
          insurance_health: s.insurance_health || 0,
        }));
        setStaffList(formatted);
      }
    } catch (error) {
      console.error('Fetch data error', error);
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

      // 🟢 新增：同步抓取全院特休精算大表的資料 (最精準的週年制引擎)
      const leaveRes = await fetch('/api/leave/stats');
      const leaveJson = await leaveRes.json();
      const leaveStatsData = leaveJson.data || [];

      if (json.error) {
        console.error('Error fetching calculation data:', json.error);
        return;
      }

      const {
        logs,
        roster,
        holidays,
        leaves,
        monthlyStandardHours,
        otApprovalRequired,
      } = json;

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
          selectedMonth,
          otApprovalRequired
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

        const net_pay = gross - deduction;

        // 🟢 抓取當月是否有手動設定的「匯款金額」
        const transferSetting = myAdj.find((a: any) => a.type === 'transfer_setting');

        let transfer_amount = net_pay; // 預設全額匯款
        let cash_amount = 0; // 預設無現金

        if (transferSetting && transferSetting.amount >= 0) {
          transfer_amount = Math.min(Number(transferSetting.amount), net_pay); // 匯款不能超過實發總額
          cash_amount = net_pay - transfer_amount;
        }

        // 🟢 抓取該員工精算後的特休資料
        const staffLeaveStat = leaveStatsData.find((s: any) => String(s.staff_id) === String(staff.id));

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
          // 🟢 替換為精準的後端大腦特休資料
          annual_leave_days: staffLeaveStat?.quota ?? 0,
          annual_leave_used: staffLeaveStat?.used ?? 0,
          annual_leave_remaining: staffLeaveStat?.remaining ?? 0,
          fixed_bonus_pay: fixedBonus,
          temp_bonus_pay: tempBonus,
          insurance_labor: staff.insurance_labor,
          insurance_health: staff.insurance_health,
          fixed_deduction_pay: fixedDeduction,
          temp_deduction_pay: tempDeduction,
          gross_pay: gross,
          total_deduction: deduction,
          net_pay,
          transfer_amount,
          cash_amount,
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
            transfer_amount: 0,
            cash_amount: 0,
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

  const lockMultipleEmployees = async () => {
    if (selectedLockIds.size === 0) return;
    setIsLoading(true);
    try {
      const recordsToLock = liveReports
        .filter((r) => selectedLockIds.has(String(r.staff_id)))
        .map((r) => ({
          year_month: selectedMonth,
          staff_id: r.staff_id,
          staff_name: r.staff_name,
          snapshot: r,
        }));

      const res = await fetch('/api/salary/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: recordsToLock }),
      });
      const json = await res.json();
      if (json.error) {
        alert('批次封存失敗: ' + json.error);
      } else {
        await fetchLockedRecords();
        setShowBatchLockModal(false);
        setSelectedLockIds(new Set());
        alert(`成功封存 ${recordsToLock.length} 筆資料！`);
      }
    } catch (error: any) {
      alert('批次封存發生錯誤: ' + error.message);
    } finally {
      setIsLoading(false);
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
      {/* 🟢 加上 print:hidden，讓列印時這塊完全消失 */}
      <div className="print:hidden">
        {/* 🟢 全局載入遮罩 */}
        {isLoading && (
          <div className="absolute inset-0 z-40 bg-white/50 backdrop-blur-sm flex items-center justify-center rounded-2xl transition-all min-h-[500px]">
            <div className="flex flex-col items-center gap-4 bg-white/95 p-8 rounded-2xl shadow-2xl border border-slate-100">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-slate-700 font-bold animate-pulse text-lg">
                資料讀取與薪資試算中...
              </span>
            </div>
          </div>
        )}
        <div className="w-full p-4 animate-fade-in space-y-6 pb-20 print:hidden">

          {/* 🟢 升級：吸頂浮動工具列 (Sticky Toolbar) */}
          <div className="sticky top-2 z-40 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] border border-slate-200 flex flex-col xl:flex-row justify-between items-center gap-3 transition-all mb-4">

            {/* 左側：標題與篩選器 */}
            <div className="flex items-center gap-4 flex-wrap w-full xl:w-auto">
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 shrink-0">
                <DollarSign className="text-emerald-600" /> 薪資結算
              </h2>
              <div className="h-6 w-px bg-slate-300 hidden xl:block"></div>

              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                <Calendar size={16} className="text-slate-500 ml-1" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 cursor-pointer"
                />
              </div>

              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="border p-2 rounded-lg text-sm bg-white font-bold text-slate-600 outline-none"
              >
                <option value="all">所有職類</option>
                {Array.from(new Set(staffList.map((s) => s.role).filter(Boolean))).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>

              <input
                type="text"
                placeholder="搜尋姓名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border p-2 rounded-lg text-sm w-32 focus:w-48 transition-all outline-none"
              />
            </div>

            {/* 右側：資料筆數與操作按鈕 */}
            <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
              <div className="text-sm font-bold text-slate-500 px-2">
                共 <span className="text-blue-600 text-base">{filteredAndSortedReports.length}</span> 筆
              </div>

              {/* 🟢 下拉式下載選單 (加上狀態回饋) */}
              <div className="relative">
                <button
                  onClick={() => !isZipping && setShowDownloadMenu(!showDownloadMenu)}
                  disabled={isZipping || filteredAndSortedReports.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-black transition shadow-sm disabled:opacity-50"
                >
                  {/* 根據 isZipping 狀態切換主按鈕文字 */}
                  {isZipping ? (
                    <>打包中，請稍候... <span className="animate-pulse">⏳</span></>
                  ) : (
                    <>薪資單批次下載 <ChevronDown size={16} /></>
                  )}
                </button>

                {showDownloadMenu && !isZipping && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <button
                      onClick={() => {
                        setShowDownloadMenu(false);
                        handleBatchDownloadSinglePdf();
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 transition"
                    >
                      <Printer size={16} className="text-slate-400" /> 合併單一檔案
                    </button>
                    <button
                      onClick={() => {
                        setShowDownloadMenu(false);
                        handleBatchDownloadZip();
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm font-bold text-slate-700 flex items-center gap-2 transition"
                    >
                      <FileSpreadsheet size={16} className="text-blue-500" /> 批次下載打包成ZIP
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowBatchLockModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-sm"
              >
                <History size={16} /> 批次結算封存
              </button>
            </div>
          </div>

          {/* 與 Toolbar 同一滾動區塊，sticky 才能相對整頁內容吸頂 */}
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
        </div>

        {settingModalStaffId !== null && (
          <SettingsModal
            staff={staffList.find((s) => s.id === settingModalStaffId)}
            updateStaff={updateStaff}
            entityList={entityList}
            onClose={() => setSettingModalStaffId(null)}
            onSaveSuccess={() => fetchStaffSettings()}
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
            netPay={adjModalStaff.net_pay}
            onSaveComplete={() => {
              fetchAdjustments();
              setAdjModalStaff(null);
            }}
            onClose={() => setAdjModalStaff(null)}
          />
        )}

        {/* 🟢 批次封存選擇器 Modal */}
        {showBatchLockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
              <div className="bg-emerald-700 text-white p-4 flex justify-between items-center shrink-0">
                <h3 className="font-bold flex items-center gap-2">
                  🔒 選擇要封存的薪資單
                </h3>
                <button
                  onClick={() => setShowBatchLockModal(false)}
                  className="hover:bg-white/20 p-1 rounded-full text-white"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center shrink-0">
                <span className="text-sm font-bold text-emerald-800">
                  已選擇:{' '}
                  <span className="text-emerald-600 text-lg">
                    {selectedLockIds.size}
                  </span>{' '}
                  人
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setSelectedLockIds(
                        new Set(
                          liveReports
                            .filter((r) => !r.is_locked)
                            .map((r) => String(r.staff_id))
                        )
                      )
                    }
                    className="text-xs font-bold text-emerald-700 bg-white border border-emerald-300 px-3 py-1.5 rounded hover:bg-emerald-100"
                  >
                    全選
                  </button>
                  <button
                    onClick={() => setSelectedLockIds(new Set())}
                    className="text-xs font-bold text-emerald-700 bg-white border border-emerald-300 px-3 py-1.5 rounded hover:bg-emerald-100"
                  >
                    取消全選
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-2 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {liveReports
                    .filter((r) => !r.is_locked)
                    .map((rpt, idx) => {
                      const sid = String(rpt.staff_id);
                      const isSelected = selectedLockIds.has(sid);
                      return (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-300 shadow-sm'
                              : 'bg-white border-slate-200 hover:bg-slate-50 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const newSet = new Set(selectedLockIds);
                              if (e.target.checked) newSet.add(sid);
                              else newSet.delete(sid);
                              setSelectedLockIds(newSet);
                            }}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-800 text-sm truncate">
                              {rpt.staff_name}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              實發: ${(rpt.net_pay ?? 0).toLocaleString()}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-white shrink-0 flex gap-3">
                <button
                  onClick={() => setShowBatchLockModal(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                >
                  取消
                </button>
                <button
                  onClick={lockMultipleEmployees}
                  disabled={selectedLockIds.size === 0}
                  className="flex-[2] py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                >
                  確認封存 {selectedLockIds.size} 筆資料
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🟢 隱藏渲染區：平時加上 hidden 徹底消失，解決白板無限下拉的問題 */}
      <div id="hidden-render-container" className="hidden absolute top-[0px] left-[-9999px] w-[800px] bg-white print:hidden">
        {filteredAndSortedReports.map((rpt, idx) => (
          <div key={`zip-${idx}`} id={`zip-capture-${idx}`} style={{ width: '100%', padding: '40px', backgroundColor: 'white' }}>
            <PrintContent report={rpt} yearMonth={selectedMonth} clinicName={entityList.find((e) => e.id === rpt.staff_entity)?.name || '診所'} />
          </div>
        ))}
      </div>

      {/* 🟢 全域 Loading 遮罩：極致的 UX 回饋 */}
      {isZipping && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center text-white animate-fade-in">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6 shadow-lg"></div>
          <h2 className="text-3xl font-black tracking-widest mb-2">圖檔轉換與打包中</h2>
          <p className="text-slate-300 font-bold">
            正在為您產生高畫質 PDF，請勿關閉或切換視窗...
          </p>
          <div className="mt-8 text-sm text-slate-400 font-mono bg-slate-800/50 px-4 py-2 rounded-full">
            處理時間依員工人數而定，請耐心等候
          </div>
        </div>
      )}
    </div>
  );
}
