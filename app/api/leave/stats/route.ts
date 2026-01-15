import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * 計算勞基法特休天數 (週年制)
 * @param startDate 到職日
 * @param referenceDate 參考日期 (用於計算到職滿幾年)
 * @returns 特休天數
 */
function calculateAnniversaryLeave(startDate: Date, referenceDate: Date): number {
  const years = (referenceDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  
  if (years < 0.5) return 0; // 未滿半年
  if (years < 1) return 3;   // 滿半年未滿一年
  if (years < 2) return 7;  // 滿一年未滿二年
  if (years < 3) return 10;  // 滿二年未滿三年
  if (years < 5) return 14;  // 滿三年未滿五年
  if (years < 10) return 15; // 滿五年未滿十年
  return 15 + Math.floor((years - 10) / 2); // 每滿兩年加一天，最多30天
}

/**
 * 計算勞基法特休天數 (曆年制 - 按比例計算)
 * @param startDate 到職日
 * @param year 計算年份
 * @returns 特休天數
 */
function calculateCalendarLeave(startDate: Date, year: number): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);
  
  // 如果到職日在該年之後，返回0
  if (startDate > yearEnd) return 0;
  
  // 計算該年度的服務期間
  const periodStart = startDate > yearStart ? startDate : yearStart;
  const periodEnd = yearEnd;
  
  // 計算服務月數 (精確到天數)
  const daysInPeriod = Math.max(0, (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const monthsInPeriod = daysInPeriod / 30.44; // 平均每月天數
  
  // 計算到該年度結束時的總年資
  const totalYears = (yearEnd.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  
  // 根據總年資計算應享有的特休天數
  let fullYearEntitlement = 0;
  if (totalYears < 0.5) fullYearEntitlement = 0;
  else if (totalYears < 1) fullYearEntitlement = 3;
  else if (totalYears < 2) fullYearEntitlement = 7;
  else if (totalYears < 3) fullYearEntitlement = 10;
  else if (totalYears < 5) fullYearEntitlement = 14;
  else if (totalYears < 10) fullYearEntitlement = 15;
  else fullYearEntitlement = 15 + Math.floor((totalYears - 10) / 2);
  
  // 按比例計算 (第一年特殊處理)
  if (totalYears < 1) {
    // 第一年：按服務月數比例計算
    return Math.round((fullYearEntitlement * monthsInPeriod) / 12);
  } else {
    // 第二年以後：如果該年度服務滿12個月，給全額；否則按比例
    if (monthsInPeriod >= 12) {
      return fullYearEntitlement;
    } else {
      return Math.round((fullYearEntitlement * monthsInPeriod) / 12);
    }
  }
}

/**
 * GET /api/leave/stats
 * 取得特休統計資料
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 取得系統設定：特休計算制
    const { data: settingsData } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'leave_calculation_system')
      .single();
    
    const calculationSystem = settingsData?.value || 'anniversary'; // 預設週年制
    
    // 2. 取得所有在職員工
    const { data: staffList, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, start_date, base_salary')
      .eq('is_active', true)
      .order('name');
    
    if (staffError) {
      console.error('Fetch staff error:', staffError);
      return NextResponse.json({ data: [], error: staffError.message }, { status: 500 });
    }
    
    if (!staffList || staffList.length === 0) {
      return NextResponse.json({ data: [] });
    }
    
    // 3. 取得所有已通過的特休申請
    const { data: leaveRequests, error: leaveError } = await supabaseAdmin
      .from('leave_requests')
      .select('staff_id, hours, start_time')
      .eq('type', '特休')
      .eq('status', 'approved');
    
    if (leaveError) {
      console.error('Fetch leave requests error:', leaveError);
      return NextResponse.json({ data: [], error: leaveError.message }, { status: 500 });
    }
    
    // 4. 取得已結算的特休
    const { data: settlements, error: settleError } = await supabaseAdmin
      .from('leave_settlements')
      .select('staff_id, days, status')
      .eq('status', 'processed');
    
    if (settleError) {
      console.error('Fetch settlements error:', settleError);
    }
    
    // 5. 計算每位員工的統計
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const stats = staffList.map((staff: any) => {
      if (!staff.start_date) {
        return {
          staff_id: staff.id,
          staff_name: staff.name,
          start_date: null,
          years_of_service: 0,
          calculation_system: calculationSystem,
          entitlement: 0,
          used: 0,
          settled: 0,
          remaining: 0,
          period_start: null,
          period_end: null,
          base_salary: staff.base_salary || 0
        };
      }
      
      const startDate = new Date(staff.start_date);
      const yearsOfService = (currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      
      // 計算法定總天數
      let entitlement = 0;
      let periodStart: string | null = null;
      let periodEnd: string | null = null;
      
      if (calculationSystem === 'calendar') {
        // 曆年制：計算當前年度的特休
        entitlement = calculateCalendarLeave(startDate, currentYear);
        periodStart = `${currentYear}-01-01`;
        periodEnd = `${currentYear}-12-31`;
      } else {
        // 週年制：計算從到職日開始的週年區間
        const anniversaryDate = new Date(startDate);
        anniversaryDate.setFullYear(currentDate.getFullYear());
        
        // 如果今年的週年日還沒到，則區間是去年週年日到今年週年日
        if (anniversaryDate > currentDate) {
          anniversaryDate.setFullYear(currentDate.getFullYear() - 1);
        }
        
        const nextAnniversary = new Date(anniversaryDate);
        nextAnniversary.setFullYear(nextAnniversary.getFullYear() + 1);
        
        entitlement = calculateAnniversaryLeave(startDate, anniversaryDate);
        periodStart = anniversaryDate.toISOString().split('T')[0];
        periodEnd = nextAnniversary.toISOString().split('T')[0];
      }
      
      // 計算已休天數 (轉換時數為天數，8小時=1天)
      const staffLeaves = leaveRequests?.filter((l: any) => l.staff_id === staff.id) || [];
      const usedHours = staffLeaves.reduce((sum: number, l: any) => {
        // 只計算在當前區間內的請假
        if (periodStart && periodEnd) {
          const leaveDate = new Date(l.start_time);
          if (leaveDate >= new Date(periodStart) && leaveDate < new Date(periodEnd)) {
            return sum + Number(l.hours || 0);
          }
        }
        return sum;
      }, 0);
      const used = Math.round((usedHours / 8) * 100) / 100; // 保留兩位小數
      
      // 計算已結算天數
      const staffSettlements = settlements?.filter((s: any) => s.staff_id === staff.id) || [];
      const settled = staffSettlements.reduce((sum: number, s: any) => sum + Number(s.days || 0), 0);
      
      // 計算剩餘天數
      const remaining = Math.max(0, entitlement - used - settled);
      
      return {
        staff_id: staff.id,
        staff_name: staff.name,
        start_date: staff.start_date,
        years_of_service: Math.round(yearsOfService * 100) / 100,
        calculation_system: calculationSystem,
        entitlement,
        used,
        settled,
        remaining,
        period_start: periodStart,
        period_end: periodEnd,
        base_salary: staff.base_salary || 0
      };
    });
    
    return NextResponse.json({ data: stats });
  } catch (error: any) {
    console.error('Leave Stats API Error:', error);
    return NextResponse.json(
      { data: [], error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
