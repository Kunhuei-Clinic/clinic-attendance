import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * GET /api/portal/data
 * 整合型資料讀取 API - 處理前台的所有資料請求
 * 
 * Query Parameters:
 *   - type: 'home' | 'history' | 'roster' | 'leave' | 'salary' (必填)
 *   - month: string (可選，格式: 'YYYY-MM')
 * 
 * 身份驗證：從 Cookie 讀取 clinic_id 和 staff_id
 * 
 * Response:
 *   { success: true, data: {...} }
 */
export async function GET(request: NextRequest) {
  try {
    // 🔒 步驟 1: 身份驗證 - 從 Cookie 取得 clinic_id 與 staff_id
    const staffIdCookie = request.cookies.get('staff_id');
    const clinicIdCookie = request.cookies.get('clinic_id');

    if (!staffIdCookie || !clinicIdCookie) {
      return NextResponse.json(
        { success: false, error: '未登入或 Session 已過期，請重新登入' },
        { status: 401 }
      );
    }

    const staffId = staffIdCookie.value;
    const clinicId = clinicIdCookie.value;

    if (!staffId || !clinicId) {
      return NextResponse.json(
        { success: false, error: '無效的 Session 資料' },
        { status: 401 }
      );
    }

    // 🔒 步驟 2: 驗證員工是否存在且屬於該診所
    const { data: staff, error: staffError } = await supabaseAdmin
      .from('staff')
      .select('id, name, role, clinic_id, is_active')
      .eq('id', staffId)
      .eq('clinic_id', clinicId)
      .single();

    if (staffError || !staff) {
      return NextResponse.json(
        { success: false, error: '找不到該員工或權限不足' },
        { status: 403 }
      );
    }

    if (!staff.is_active) {
      return NextResponse.json(
        { success: false, error: '該員工帳號已停用' },
        { status: 403 }
      );
    }

    // 🔒 步驟 3: 取得 Query Parameters
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as 'home' | 'history' | 'roster' | 'leave' | 'salary' | null;
    const month = searchParams.get('month');

    if (!type) {
      return NextResponse.json(
        { success: false, error: '缺少必要參數：type' },
        { status: 400 }
      );
    }

    if (!['home', 'history', 'roster', 'leave', 'salary'].includes(type)) {
      return NextResponse.json(
        { success: false, error: '無效的 type 參數，必須是 home, history, roster, leave 或 salary' },
        { status: 400 }
      );
    }

    // 🔒 步驟 4: 根據 type 執行對應查詢
    let queryResult: any;

    switch (type) {
      case 'home': {
        // 🟢 首頁資料：個人資料 + 公告 + 當日打卡紀錄

        // 1. 查詢個人資料 (Profile)
        const { data: staffProfile, error: profileError } = await supabaseAdmin
          .from('staff')
          .select('id, name, role, clinic_id, start_date, annual_leave_history, annual_leave_quota, phone, address, emergency_contact, bank_account, id_number')
          .eq('id', staffId)
          .eq('clinic_id', clinicId)
          .single();

        if (profileError || !staffProfile) {
          return NextResponse.json(
            { success: false, error: '無法讀取個人資料' },
            { status: 500 }
          );
        }

        // 2. 查詢公告 (Announcements) - 關鍵修正
        // 條件：clinic_id 相符、is_active 為 true、排序：created_at 倒序、限制：前 5 筆
        const { data: announcements, error: annError } = await supabaseAdmin
          .from('announcements')
          .select('title, content, created_at')
          .eq('clinic_id', clinicId)      // 🔒 鎖定診所
          .eq('is_active', true)          // 🔒 只看啟用中
          .order('created_at', { ascending: false })  // 🔒 最新的在上面
          .limit(5);                      // 🔒 限制前 5 筆

        if (annError) {
          console.error('[Portal Data] Error fetching announcements:', annError);
          // 即使公告查詢失敗，仍然回傳個人資料和打卡紀錄
        }

        // 3. 查詢當日打卡紀錄 (Logs)
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

        const { data: todayLogs, error: logsError } = await supabaseAdmin
          .from('attendance_logs')
          .select('*')
          .eq('staff_id', staffId)
          .eq('clinic_id', clinicId)
          .gte('clock_in_time', todayStart)
          .lt('clock_in_time', todayEnd)
          .order('clock_in_time', { ascending: false });

        if (logsError) {
          console.error('[Portal Data] Error fetching today logs:', logsError);
          // 即使打卡紀錄查詢失敗，仍然回傳個人資料和公告
        }

        // 4. 組合回傳資料
        queryResult = {
          profile: {
            name: staffProfile.name || '',
            role: staffProfile.role || '',
            start_date: staffProfile.start_date || null,
            phone: staffProfile.phone || null,
            address: staffProfile.address || null,
            emergency_contact: staffProfile.emergency_contact || null,
            bank_account: staffProfile.bank_account || null,
            id_number: staffProfile.id_number || null,
            annual_leave_quota: staffProfile.annual_leave_quota || null,
            annual_leave_history: staffProfile.annual_leave_history || null,
          },
          announcements: (announcements || []).map((ann: any) => ({
            title: ann.title,
            content: ann.content,
            created_at: ann.created_at,
          })),
          todayLogs: todayLogs || [],
        };
        break;
      }

      case 'history': {
        // 查詢 attendance_logs
        let query = supabaseAdmin
          .from('attendance_logs')
          .select('*')
          .eq('staff_id', staffId)
          .eq('clinic_id', clinicId);

        if (month) {
          // 計算月份範圍
          const [year, monthNum] = month.split('-').map(Number);
          const startDate = new Date(year, monthNum - 1, 1).toISOString();
          const endDate = new Date(year, monthNum, 1).toISOString();
          
          query = query
            .gte('clock_in_time', startDate)
            .lt('clock_in_time', endDate);
        }

        query = query.order('clock_in_time', { ascending: false });

        const { data, error } = await query;
        if (error) {
          console.error('[Portal Data] Error fetching attendance history:', error);
          return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
          );
        }
        queryResult = data || [];
        break;
      }

      case 'roster': {
        // 根據員工角色查詢不同的表
        if (staff.role === '醫師') {
          // 查詢 doctor_roster
          let query = supabaseAdmin
            .from('doctor_roster')
            .select('*')
            .eq('doctor_id', staffId)
            .eq('clinic_id', clinicId);

          // 如果沒有指定月份，預設查詢今天之後的資料
          if (!month) {
            const today = new Date().toISOString().slice(0, 10);
            query = query.gte('date', today);
          } else {
            // 如果指定月份，查詢該月份的所有資料
            const [year, monthNum] = month.split('-').map(Number);
            const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
            const endDate = new Date(year, monthNum, 1).toISOString().slice(0, 10);
            query = query.gte('date', startDate).lt('date', endDate);
          }

          query = query.order('date', { ascending: true }).limit(20);

          const { data, error } = await query;
          if (error) {
            console.error('[Portal Data] Error fetching doctor roster:', error);
            return NextResponse.json(
              { success: false, error: error.message },
              { status: 500 }
            );
          }
          queryResult = data || [];
        } else {
          // 查詢 roster (一般員工)
          let query = supabaseAdmin
            .from('roster')
            .select('*')
            .eq('staff_id', staffId)
            .eq('clinic_id', clinicId);

          // 如果沒有指定月份，預設查詢今天之後的資料
          if (!month) {
            const today = new Date().toISOString().slice(0, 10);
            query = query.gte('date', today);
          } else {
            // 如果指定月份，查詢該月份的所有資料
            const [year, monthNum] = month.split('-').map(Number);
            const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
            const endDate = new Date(year, monthNum, 1).toISOString().slice(0, 10);
            query = query.gte('date', startDate).lt('date', endDate);
          }

          query = query.order('date', { ascending: true }).limit(20);

          const { data, error } = await query;
          if (error) {
            console.error('[Portal Data] Error fetching roster:', error);
            return NextResponse.json(
              { success: false, error: error.message },
              { status: 500 }
            );
          }
          queryResult = data || [];
        }
        break;
      }

      case 'leave': {
        // 查詢 leave_requests
        let query = supabaseAdmin
          .from('leave_requests')
          .select('*')
          .eq('staff_id', staffId)
          .eq('clinic_id', clinicId);

        if (month) {
          // 查詢該月份的請假記錄
          const [year, monthNum] = month.split('-').map(Number);
          const startDate = new Date(year, monthNum - 1, 1).toISOString();
          const endDate = new Date(year, monthNum, 1).toISOString();
          
          query = query
            .gte('start_time', startDate)
            .lt('start_time', endDate);
        }

        query = query.order('created_at', { ascending: false });

        const { data: leaves, error } = await query;
        if (error) {
          console.error('[Portal Data] Error fetching leave requests:', error);
          return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
          );
        }

        // 🟢 計算年度請假統計
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1).toISOString();
        const yearEnd = new Date(currentYear + 1, 0, 1).toISOString();

        // 查詢今年度已核准的請假記錄
        const { data: approvedLeaves, error: statsError } = await supabaseAdmin
          .from('leave_requests')
          .select('type, hours')
          .eq('staff_id', staffId)
          .eq('clinic_id', clinicId)
          .eq('status', 'approved')
          .gte('start_time', yearStart)
          .lt('start_time', yearEnd);

        if (statsError) {
          console.error('[Portal Data] Error fetching leave stats:', statsError);
          // 如果統計查詢失敗，仍然回傳列表，但統計為空
          queryResult = {
            leaves: leaves || [],
            stats: {}
          };
          break;
        }

        // 計算各假別的已使用時數
        const stats: Record<string, { used: number; quota?: number; remaining?: number }> = {};
        
        if (approvedLeaves && approvedLeaves.length > 0) {
          approvedLeaves.forEach((leave: any) => {
            const leaveType = leave.type || '';
            const hours = Number(leave.hours || 0);
            
            // 將假別映射為英文 key（用於前端顯示）
            let typeKey = '';
            if (leaveType === '特休') {
              typeKey = 'annual';
            } else if (leaveType === '事假') {
              typeKey = 'personal';
            } else if (leaveType === '病假') {
              typeKey = 'sick';
            } else if (leaveType === '生理假') {
              typeKey = 'menstrual';
            } else if (leaveType === '喪假') {
              typeKey = 'bereavement';
            } else if (leaveType === '公假') {
              typeKey = 'official';
            } else if (leaveType === '婚假') {
              typeKey = 'marriage';
            } else if (leaveType === '產假') {
              typeKey = 'maternity';
            } else if (leaveType === '家庭照顧假') {
              typeKey = 'family';
            } else {
              // 其他假別使用原始名稱（轉為小寫並替換空格）
              typeKey = leaveType.toLowerCase().replace(/\s+/g, '_');
            }

            if (!stats[typeKey]) {
              stats[typeKey] = { used: 0 };
            }
            stats[typeKey].used += hours;
          });
        }

        // 查詢員工的特休額度（如果 staff 表有 annual_leave_quota 欄位）
        const { data: staffWithQuota, error: quotaError } = await supabaseAdmin
          .from('staff')
          .select('annual_leave_quota')
          .eq('id', staffId)
          .single();

        // 如果有特休額度欄位，計算剩餘額度
        if (!quotaError && staffWithQuota && staffWithQuota.annual_leave_quota !== null && staffWithQuota.annual_leave_quota !== undefined) {
          const quota = Number(staffWithQuota.annual_leave_quota);
          const used = stats.annual?.used || 0;
          stats.annual = {
            used: used,
            quota: quota,
            remaining: Math.max(0, quota - used)
          };
        } else if (stats.annual) {
          // 如果沒有額度欄位，只回傳已使用時數
          stats.annual = { used: stats.annual.used };
        }

        // 🟢 優化：取得員工的完整資料（用於年休儀表板）
        const { data: staffProfile } = await supabaseAdmin
          .from('staff')
          .select('start_date, annual_leave_history, annual_leave_quota')
          .eq('id', staffId)
          .single();

        // 回傳格式：包含列表、統計和員工資料
        queryResult = {
          leaves: leaves || [],
          stats: stats,
          staffInfo: {
            start_date: staffProfile?.start_date || null,
            annual_leave_history: staffProfile?.annual_leave_history || null,
            annual_leave_quota: staffProfile?.annual_leave_quota || null
          }
        };
        break;
      }

      case 'salary': {
        // 根據員工角色查詢不同的表
        if (staff.role === '醫師') {
          // 查詢 doctor_ppf
          let query = supabaseAdmin
            .from('doctor_ppf')
            .select('*')
            .eq('doctor_id', staffId)
            .eq('clinic_id', clinicId);

          if (month) {
            // 查詢該月份的薪資記錄
            query = query.eq('paid_in_month', month);
          }

          query = query.order('paid_in_month', { ascending: false });

          const { data, error } = await query;
          if (error) {
            console.error('[Portal Data] Error fetching doctor salary:', error);
            return NextResponse.json(
              { success: false, error: error.message },
              { status: 500 }
            );
          }
          queryResult = data || [];
        } else {
          // 查詢 salary_history
          let query = supabaseAdmin
            .from('salary_history')
            .select('*')
            .eq('staff_id', staffId)
            .eq('clinic_id', clinicId);

          if (month) {
            // 查詢該月份的薪資記錄
            query = query.eq('year_month', month);
          }

          query = query.order('year_month', { ascending: false });

          const { data, error } = await query;
          if (error) {
            console.error('[Portal Data] Error fetching salary history:', error);
            return NextResponse.json(
              { success: false, error: error.message },
              { status: 500 }
            );
          }
          queryResult = data || [];
        }
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: '無效的 type 參數' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: queryResult
    });
  } catch (error: any) {
    console.error('[Portal Data] API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || '伺服器錯誤' },
      { status: 500 }
    );
  }
}
