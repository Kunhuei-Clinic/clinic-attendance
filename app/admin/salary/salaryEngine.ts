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

// 時薪制用：僅計算加班「加成」部分 (前2hr *0.34, 之後 *0.67)，本薪已含在 total_work_hours 內
const calculateTieredOtPremium = (hours: number, hourlyRate: number): number => {
  if (hours <= 0) return 0;
  const ot134 = Math.min(hours, 2);
  const ot167 = Math.max(0, hours - 2);
  return Math.round(ot134 * hourlyRate * 0.34 + ot167 * hourlyRate * 0.67);
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
  leaves: any[],
  targetMonth: string // 🟢 新增參數 (格式: 'YYYY-MM')
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

  // --- 2. 每日工時計算 (每日正常工時上限判定) ---
  let dailyNormalLimit = 8;
  if (staff.work_rule === '2week' || staff.work_rule === '4week') {
    dailyNormalLimit = 10;
  } else if (staff.work_rule === 'online_consultation') {
    dailyNormalLimit = 24; // 責任制線上諮詢，不計算每日超時
  } else if (staff.work_rule === 'none') {
    dailyNormalLimit = 24;
  }
  let accumulatedNormalHours = 0;

  // 🟢 強制生成當月 1 號到月底的所有日期，確保例休假不會漏掉
  const [yearStr, monthStr] = targetMonth.split('-');
  const daysInMonth = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const allDates = Array.from({ length: daysInMonth }, (_, i) => {
    return `${targetMonth}-${String(i + 1).padStart(2, '0')}`;
  });

  allDates.forEach((dateStr) => {
    // 取得當日基本資料
    const rosterKey = `${staff.id}_${dateStr}`;
    const rosterInfo = rosterMap[rosterKey];
    const isHoliday = holidaySet.has(dateStr);

    let dayType = 'normal';
    let shiftNote = ''; // 🟢 記錄調移軌跡

    if (rosterInfo && rosterInfo.day_type) {
      if (rosterInfo.day_type === 'shifted') {
        dayType = 'normal'; // 國假調平日，以平日計薪 (不給加倍)
        if (isHoliday) shiftNote = '國定假日調移作平日';
      } else if (rosterInfo.day_type !== 'normal') {
        dayType = rosterInfo.day_type;
        // 如果全域不是國定假日，但個人被蓋了「國」的印章
        if (!isHoliday && dayType === 'holiday') shiftNote = '調移之國定假日';
      } else {
        dayType = isHoliday ? 'holiday' : 'normal';
      }
    } else {
      dayType = isHoliday ? 'holiday' : 'normal';
    }

    // 取得當日打卡紀錄（以本地日期比對）
    const dailyLogs = logs.filter(
      (l) => toLocalDateString(l.clock_in_time) === dateStr
    );
    // 🟢 確保同日打卡照時間順序排列 (早班在前，晚班在後)
    dailyLogs.sort((a, b) => new Date(a.clock_in_time).getTime() - new Date(b.clock_in_time).getTime());

    // 將上下班時間成對組合，例如: 08:00~12:33, 15:00~21:00
    const clockPairs = dailyLogs.map((l: any) => {
      const inStr = l.clock_in_time
        ? format(new Date(l.clock_in_time), 'HH:mm')
        : '--:--';
      const outStr = l.clock_out_time
        ? format(new Date(l.clock_out_time), 'HH:mm')
        : '--:--';
      return `${inStr}~${outStr}`;
    });
    const combinedClockStr = clockPairs.join(', ');

    let dailyWorkMinutes = 0;
    let shiftDisplayStr = "";
    let note = "";

    const calcMode = staff.clock_in_calc_mode || 'actual';

    if (calcMode === 'actual') {
      shiftDisplayStr = "實支實付";
      dailyLogs.forEach((log: any) => {
        if (log.clock_in_time && log.clock_out_time) {
          dailyWorkMinutes += Math.max(
            0,
            differenceInMinutes(
              new Date(log.clock_out_time),
              new Date(log.clock_in_time)
            )
          );
        } else if (log.clock_in_time && !log.clock_out_time) {
          note += "忘打下班卡 ";
        }
      });
    } else {
      // 依班表模式：比對多段班表與多段打卡
      const shiftDetails = rosterInfo?.shift_details || {};
      const shifts = Object.values(shiftDetails) as { start: string; end: string }[];
      shifts.sort((a, b) => (a?.start || '').localeCompare(b?.start || ''));

      // 🟢 1. 合併連續班表 (例如 15:00-18:00 與 18:00-21:00 無縫接軌，合併為 15:00-21:00)
      const mergedShifts: { start: Date; end: Date; label: string }[] = [];
      shifts.forEach((shift) => {
        const sStart = timeStringToDate(dateStr, shift.start);
        const sEnd = timeStringToDate(dateStr, shift.end);
        if (mergedShifts.length === 0) {
          mergedShifts.push({ start: sStart, end: sEnd, label: `${shift.start}-${shift.end}` });
        } else {
          const last = mergedShifts[mergedShifts.length - 1];
          if (sStart <= last.end) {
            if (sEnd > last.end) {
              last.end = sEnd;
              last.label = `${format(last.start, 'HH:mm')}-${format(last.end, 'HH:mm')}`;
            }
          } else {
            mergedShifts.push({ start: sStart, end: sEnd, label: `${shift.start}-${shift.end}` });
          }
        }
      });

      shiftDisplayStr = mergedShifts.map(ms => ms.label).join(' ');

      // 🟢 2. 計算工時 (上班依班表，下班依打卡)
      let shiftWorkedMinutes = 0;
      mergedShifts.forEach((mShift, index) => {
        let blockMinutes = 0;
        dailyLogs.forEach((log: any) => {
          if (!log.clock_in_time || !log.clock_out_time) return;
          const logIn = new Date(log.clock_in_time);
          const logOut = new Date(log.clock_out_time);

          if (logOut > mShift.start && logIn < mShift.end) {
            const effectiveStart = logIn > mShift.start ? logIn : mShift.start;
            let effectiveEnd = logOut;

            const nextShift = mergedShifts[index + 1];
            if (nextShift && effectiveEnd > nextShift.start) {
              effectiveEnd = nextShift.start;
            }

            if (effectiveEnd > effectiveStart) {
              blockMinutes += differenceInMinutes(effectiveEnd, effectiveStart);
            }
          }
        });
        shiftWorkedMinutes += blockMinutes;
      });

      dailyWorkMinutes += shiftWorkedMinutes;

      // 舊資料防呆 (保持原樣)
      if (shifts.length === 0) {
        dailyLogs.forEach((log: any) => {
          if (log.clock_in_time && log.clock_out_time) {
            dailyWorkMinutes += Math.max(
              0,
              differenceInMinutes(
                new Date(log.clock_out_time),
                new Date(log.clock_in_time)
              )
            );
          }
        });
        if (dailyLogs.length > 0) note += "舊班表(改實算) ";
      }
    }

    const dailyHours = Math.round((dailyWorkMinutes / 60) * 100) / 100;

    // 🟢 無條件建立每日紀錄 (勞檢防禦：即使工時為0也要記錄當天屬性)
    const dailyRecord: DailyRecord = {
      date: dateStr,
      dayType: dayType,
      shiftInfo: shiftDisplayStr.trim(),
      clockIn: combinedClockStr || '--:--',
      clockOut: '',
      totalHours: dailyHours,
      normalHours: 0,
      ot134: 0,
      ot167: 0,
      note: [shiftNote, note.trim()].filter(Boolean).join(' | '),
    };

    if (dailyHours > 0) {
      result.total_work_hours += dailyHours;

      if (dayType === 'holiday') { 
        const normalWork = Math.min(dailyHours, dailyNormalLimit);
        const otWork = Math.max(0, dailyHours - dailyNormalLimit);

        // 🟢 修正：累積時數只採計正常工時，避免將加班時數重複顯示
        result.holiday_work_hours += normalWork;

        // 🟢 勞基法修正：月薪制與時薪制的國定假日給薪差異
        if (staff.salary_mode === 'monthly') {
          // 月薪制：只要有出勤 (8小時內)，一律「加發 1 日工資」(8小時)
          result.holiday_pay += Math.round(8 * hourlyRate);
        } else {
          // 時薪制：依實際正常工時給予 1 倍加給 (本薪池已含另1倍)
          result.holiday_pay += Math.round(normalWork * hourlyRate);
        }

        dailyRecord.normalHours = normalWork;

        // 超過 8 小時的部分，落入 1.34 與 1.67 的一般加班費計算
        if (otWork > 0) {
          result.normal_ot_hours += otWork;
          result.ot_pay += staff.salary_mode === 'hourly'
            ? calculateTieredOtPremium(otWork, hourlyRate)
            : calculateTieredOt(otWork, hourlyRate);

          const { ot134, ot167 } = splitOtHours(otWork);
          dailyRecord.ot134 = ot134;
          dailyRecord.ot167 = ot167;
        }

        dailyRecord.note = (dailyRecord.note || "") + " 國定假日";

      } else if (dayType === 'regular') {
        // 🟢 順便補上例假日的正常工時紀錄
        const normalWork = Math.min(dailyHours, dailyNormalLimit);
        result.holiday_work_hours += normalWork;
        result.holiday_pay += Math.round(dailyHours * hourlyRate * 2);
        dailyRecord.normalHours = normalWork;
        result.warnings.push(`${dateStr} 例假出勤`);
        dailyRecord.note = (dailyRecord.note || "") + " 例假違規";

      } else if (dayType === 'rest') { 
        result.rest_work_hours += dailyHours;
        result.ot_pay += staff.salary_mode === 'hourly' ? calculateTieredOtPremium(dailyHours, hourlyRate) : calculateTieredOt(dailyHours, hourlyRate);
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
          result.ot_pay += staff.salary_mode === 'hourly' ? calculateTieredOtPremium(ot, hourlyRate) : calculateTieredOt(ot, hourlyRate);
          
          const { ot134, ot167 } = splitOtHours(ot);
          dailyRecord.ot134 = ot134;
          dailyRecord.ot167 = ot167;
        }
      }
    } else {
      // 沒上班日不寫入多餘備註，僅保留上方有出勤時的「例假違規」等
    }
    
    result.dailyRecords.push(dailyRecord);
  });

  const isExemptFromPeriodCap = staff.work_rule === 'none' || staff.work_rule === 'online_consultation';
  if (!isExemptFromPeriodCap && accumulatedNormalHours > monthlyStandardHours) {
    const periodExcess = accumulatedNormalHours - monthlyStandardHours;
    result.period_ot_hours = periodExcess;
    result.ot_pay += staff.salary_mode === 'hourly' ? calculateTieredOtPremium(periodExcess, hourlyRate) : calculateTieredOt(periodExcess, hourlyRate);
    result.warnings.push(`週期總量超標 ${periodExcess.toFixed(2)}hr`);
  }

  result.total_work_hours = Math.round(result.total_work_hours * 100) / 100;
  result.normal_hours = Math.round(result.normal_hours * 100) / 100;
  result.period_ot_hours = Math.round(result.period_ot_hours * 100) / 100;
  result.normal_ot_hours = Math.round(result.normal_ot_hours * 100) / 100;
  result.rest_work_hours = Math.round(result.rest_work_hours * 100) / 100;
  result.holiday_work_hours = Math.round(result.holiday_work_hours * 100) / 100;

  if (staff.salary_mode === 'hourly') {
    result.base_pay = Math.round(result.total_work_hours * hourlyRate);
  } else {
    result.base_pay = staff.base_salary;
  }

  return result;
};
