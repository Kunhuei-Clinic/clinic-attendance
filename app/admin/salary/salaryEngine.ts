import { differenceInMinutes, format } from 'date-fns';

// 資料型別定義
export type DailyRecord = {
  date: string;
  dayType: string; // normal, rest, holiday, regular
  shiftInfo: string;
  clockIn: string;
  clockOut: string;
  totalHours: number;
  normalHours: number; 
  ot134: number; 
  ot167: number; 
  note?: string; 
};

export type SalaryResult = {
  staff_name: string;
  staff_role: string;
  salary_mode: string;
  work_rule: string;
  
  total_work_hours: number;
  normal_hours: number;
  period_ot_hours: number; 
  normal_ot_hours: number;
  rest_work_hours: number;
  holiday_work_hours: number;
  
  base_pay: number;
  ot_pay: number;
  holiday_pay: number;
  
  leave_deduction: number;
  leave_addition: number;
  
  warnings: string[];
  dailyRecords: DailyRecord[]; 
};

// 輔助：將 HH:mm 字串轉為當日 Date 物件
const timeStringToDate = (dateStr: string, timeStr: string) => {
  return new Date(`${dateStr}T${timeStr}:00`);
};

// 輔助：將 ISO 時間字串轉為本地日期 (YYYY-MM-DD)，避免 UTC 跨日偏移
const toLocalDateString = (isoString?: string | null): string => {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 輔助：加班費拆分 (前2小時 1.34, 之後 1.67)
const splitOtHours = (hours: number) => {
  if (hours <= 0) return { ot134: 0, ot167: 0 };
  if (hours <= 2) return { ot134: hours, ot167: 0 };
  return { ot134: 2, ot167: hours - 2 };
};

const calculateTieredOt = (hours: number, hourlyRate: number): number => {
  const { ot134, ot167 } = splitOtHours(hours);
  return Math.round((ot134 * hourlyRate * 1.34) + (ot167 * hourlyRate * 1.67));
};

export const calculateStaffSalary = (
  staff: any,
  logs: any[],
  rosterMap: Record<string, any>, // key: staffId_date, value: { day_type, shift_details }
  holidaySet: Set<string>,
  monthlyStandardHours: number,
  leaves: any[]
): SalaryResult => {
  
  const result: SalaryResult = {
    staff_name: staff.name,
    staff_role: staff.role || '員工',
    salary_mode: staff.salary_mode,
    work_rule: staff.work_rule,
    
    total_work_hours: 0,
    normal_hours: 0,
    period_ot_hours: 0,
    normal_ot_hours: 0,
    rest_work_hours: 0,
    holiday_work_hours: 0,
    base_pay: 0,
    ot_pay: 0,
    holiday_pay: 0,
    leave_deduction: 0, 
    leave_addition: 0,  
    warnings: [],
    dailyRecords: [], 
  };

  const hourlyRate = staff.salary_mode === 'monthly' ? Math.round(staff.base_salary / 240) : staff.base_salary;
  
  // --- 1. 請假計算 ---
  leaves.forEach(leave => {
    const hours = Number(leave.hours);
    const type = leave.type;
    if (staff.salary_mode === 'monthly') {
      if (type === '事假' || type === '家庭照顧假') result.leave_deduction += Math.round(hours * hourlyRate);
      else if (type === '病假' || type === '生理假') result.leave_deduction += Math.round(hours * hourlyRate * 0.5);
    } else {
      if (['特休', '喪假', '公假', '婚假', '產假'].includes(type)) result.leave_addition += Math.round(hours * hourlyRate);
    }
  });

  // --- 2. 每日工時計算 ---
  let dailyNormalLimit = 8;
  if (staff.work_rule === '2week' || staff.work_rule === '4week') dailyNormalLimit = 10;
  let accumulatedNormalHours = 0;

  // 整理所有涉及的日期（使用本地日期避免 UTC 跨日偏移）
  const logDates = logs
    .map((l) => toLocalDateString(l.clock_in_time))
    .filter(Boolean);
  const rosterDates = Object.keys(rosterMap).map((k) => k.split('_')[1]);
  const allDates = Array.from(new Set([...logDates, ...rosterDates])).sort();

  allDates.forEach((dateStr) => {
    // 取得當日基本資料
    const rosterKey = `${staff.id}_${dateStr}`;
    const rosterInfo = rosterMap[rosterKey];
    const isHoliday = holidaySet.has(dateStr);
    
    let dayType = 'normal'; 
    if (isHoliday) dayType = 'holiday';
    else if (rosterInfo) dayType = rosterInfo.day_type;

    // 取得當日打卡紀錄（以本地日期比對）
    const dailyLogs = logs.filter(
      (l) => toLocalDateString(l.clock_in_time) === dateStr
    );
    let actualIn: Date | null = null;
    let actualOut: Date | null = null;

    if (dailyLogs.length > 0) {
      // 修正：使用 getTime() 排序
      const sortedIn = dailyLogs.map((l:any) => new Date(l.clock_in_time)).sort((a:Date, b:Date) => a.getTime() - b.getTime());
      const sortedOut = dailyLogs
        .map((l:any) => l.clock_out_time ? new Date(l.clock_out_time) : null)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime());
      
      if (sortedIn.length > 0) actualIn = sortedIn[0];
      if (sortedOut.length > 0) actualOut = sortedOut[0];
    }

    let dailyWorkMinutes = 0;
    let shiftDisplayStr = "";
    let note = "";

    const calcMode = staff.clock_in_calc_mode || 'actual';

    if (calcMode === 'actual') {
      shiftDisplayStr = "實支實付";
      if (actualIn && actualOut) {
        dailyWorkMinutes = differenceInMinutes(actualOut, actualIn);
        if (dailyWorkMinutes < 0) dailyWorkMinutes = 0;
      } else if (actualIn && !actualOut) {
        note = "忘打下班卡";
      }

    } else {
      // --- Schedule Mode ---
      const shiftDetails = rosterInfo?.shift_details || {};
      const shifts = Object.values(shiftDetails) as { start: string; end: string }[];

      shifts.sort((a, b) => (a?.start || '').localeCompare(b?.start || ''));

      shifts.forEach((shift) => {
        const scheduleStart = timeStringToDate(dateStr, shift.start);
        const scheduleEnd = timeStringToDate(dateStr, shift.end);

        shiftDisplayStr += `${shift.start}-${shift.end} `;

        if (!actualIn || !actualOut) {
          return;
        }

        // 實際上班時間與表定上班時間，取「晚者」(避免提早到診所被溢算薪水)
        let effectiveStart =
          actualIn.getTime() > scheduleStart.getTime() ? actualIn : scheduleStart;

        // 實際下班時間與表定下班時間，取「早者」(將下班時間嚴格卡在表定時間，避免休息時間被計薪)
        let effectiveEnd =
          actualOut.getTime() < scheduleEnd.getTime() ? actualOut : scheduleEnd;

        // 完全移除原本判定 nextShift 的那段 if (nextShift) {...} 邏輯，那會造成時數錯誤延長

        if (effectiveEnd.getTime() > effectiveStart.getTime()) {
          const mins = differenceInMinutes(effectiveEnd, effectiveStart);
          dailyWorkMinutes += mins;
        }

        if (differenceInMinutes(actualIn, scheduleStart) > 1) note += "遲到 ";
        if (differenceInMinutes(scheduleEnd, actualOut) > 1) note += "早退 ";
      });

      // 🟢 舊資料防呆：如果班表沒有 shift_details (舊資料)，但員工有打卡，則自動退回「實支實付」計算，避免時數歸零
      if (shifts.length === 0) {
        if (actualIn && actualOut) {
          dailyWorkMinutes = differenceInMinutes(actualOut, actualIn);
          if (dailyWorkMinutes < 0) dailyWorkMinutes = 0;
          note += "舊班表(改實算) ";
        } else if (actualIn && !actualOut) {
          note += "未排班且忘打下班卡 ";
        }
      }
    }

    const dailyHours = Math.round((dailyWorkMinutes / 60) * 100) / 100;

    if (dailyHours > 0) {
      result.total_work_hours += dailyHours;
      
      const dailyRecord: DailyRecord = {
        date: dateStr,
        dayType: dayType,
        shiftInfo: shiftDisplayStr.trim(),
        clockIn: actualIn ? format(actualIn, 'HH:mm') : '--:--',
        clockOut: actualOut ? format(actualOut, 'HH:mm') : '--:--',
        totalHours: dailyHours,
        normalHours: 0,
        ot134: 0,
        ot167: 0,
        note: note.trim()
      };

      if (dayType === 'holiday') { 
        result.holiday_work_hours += dailyHours;
        const multiplier = staff.salary_mode === 'monthly' ? 1 : 2;
        result.holiday_pay += Math.round(dailyHours * hourlyRate * multiplier);
        dailyRecord.note = (dailyRecord.note || "") + " 國定假日";

      } else if (dayType === 'regular') { 
        result.holiday_work_hours += dailyHours;
        result.holiday_pay += Math.round(dailyHours * hourlyRate * 2);
        result.warnings.push(`${dateStr} 例假出勤`);
        dailyRecord.note = (dailyRecord.note || "") + " 例假違規";

      } else if (dayType === 'rest') { 
        result.rest_work_hours += dailyHours;
        result.ot_pay += calculateTieredOt(dailyHours, hourlyRate);
        const { ot134, ot167 } = splitOtHours(dailyHours);
        dailyRecord.ot134 = ot134;
        dailyRecord.ot167 = ot167;

      } else { 
        if (dailyHours <= dailyNormalLimit) {
          result.normal_hours += dailyHours;
          accumulatedNormalHours += dailyHours;
          dailyRecord.normalHours = dailyHours;
        } else {
          result.normal_hours += dailyNormalLimit;
          accumulatedNormalHours += dailyNormalLimit;
          dailyRecord.normalHours = dailyNormalLimit;
          
          const ot = dailyHours - dailyNormalLimit;
          result.normal_ot_hours += ot;
          result.ot_pay += calculateTieredOt(ot, hourlyRate);
          
          const { ot134, ot167 } = splitOtHours(ot);
          dailyRecord.ot134 = ot134;
          dailyRecord.ot167 = ot167;
        }
      }
      result.dailyRecords.push(dailyRecord);
    }
  });

  if (accumulatedNormalHours > monthlyStandardHours) {
    const periodExcess = accumulatedNormalHours - monthlyStandardHours;
    result.period_ot_hours = periodExcess;
    result.ot_pay += calculateTieredOt(periodExcess, hourlyRate);
    result.warnings.push(`週期總量超標 ${periodExcess.toFixed(1)}hr`);
  }

  if (staff.salary_mode === 'hourly') {
    const effectiveBaseHours = result.normal_hours - result.period_ot_hours;
    result.base_pay = Math.round(effectiveBaseHours * staff.base_salary);
  } else {
    result.base_pay = staff.base_salary;
  }

  return result;
};
