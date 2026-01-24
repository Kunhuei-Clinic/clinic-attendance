/*
  # RLS (Row Level Security) 安全鎖定
  
  為所有資料表啟用 RLS 並設定安全策略：
  1. 禁止匿名使用者 (anon) 直接存取
  2. 允許已認證使用者 (authenticated) 讀取自己診所的資料
  3. 後端 API 使用 service_role 繞過 RLS（但前端直接存取會被阻擋）
*/

-- ============================================
-- 1. 啟用 RLS 於所有資料表
-- ============================================

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_ppf ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 如果這些表存在，也啟用 RLS
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clinic_closed_days') THEN
    ALTER TABLE clinic_closed_days ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clinic_holidays') THEN
    ALTER TABLE clinic_holidays ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- ============================================
-- 2. 建立輔助函數：取得當前使用者的 clinic_id
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_clinic_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
  DECLARE
    user_clinic_id uuid;
  BEGIN
    -- 從 profiles 表取得當前使用者的 clinic_id
    SELECT clinic_id INTO user_clinic_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN user_clinic_id;
  END;
$$;

-- ============================================
-- 3. 通用 RLS Policy：禁止匿名使用者
-- ============================================

-- Clinics 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.clinics;
CREATE POLICY "Deny all for anon" ON public.clinics
  FOR ALL
  TO anon
  USING (false);

-- Profiles 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.profiles;
CREATE POLICY "Deny all for anon" ON public.profiles
  FOR ALL
  TO anon
  USING (false);

-- Staff 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.staff;
CREATE POLICY "Deny all for anon" ON public.staff
  FOR ALL
  TO anon
  USING (false);

-- Attendance Logs 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.attendance_logs;
CREATE POLICY "Deny all for anon" ON public.attendance_logs
  FOR ALL
  TO anon
  USING (false);

-- Doctor Roster 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.doctor_roster;
CREATE POLICY "Deny all for anon" ON public.doctor_roster
  FOR ALL
  TO anon
  USING (false);

-- Roster 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.roster;
CREATE POLICY "Deny all for anon" ON public.roster
  FOR ALL
  TO anon
  USING (false);

-- Leave Requests 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.leave_requests;
CREATE POLICY "Deny all for anon" ON public.leave_requests
  FOR ALL
  TO anon
  USING (false);

-- Leave Settlements 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.leave_settlements;
CREATE POLICY "Deny all for anon" ON public.leave_settlements
  FOR ALL
  TO anon
  USING (false);

-- Doctor PPF 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.doctor_ppf;
CREATE POLICY "Deny all for anon" ON public.doctor_ppf
  FOR ALL
  TO anon
  USING (false);

-- Salary History 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.salary_history;
CREATE POLICY "Deny all for anon" ON public.salary_history
  FOR ALL
  TO anon
  USING (false);

-- Salary Adjustments 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.salary_adjustments;
CREATE POLICY "Deny all for anon" ON public.salary_adjustments
  FOR ALL
  TO anon
  USING (false);

-- System Settings 表
DROP POLICY IF EXISTS "Deny all for anon" ON public.system_settings;
CREATE POLICY "Deny all for anon" ON public.system_settings
  FOR ALL
  TO anon
  USING (false);

-- ============================================
-- 4. 通用 RLS Policy：允許已認證使用者讀取自己診所的資料
-- ============================================

-- Clinics 表：使用者只能讀取自己診所的資料
DROP POLICY IF EXISTS "Allow authenticated read own clinic" ON public.clinics;
CREATE POLICY "Allow authenticated read own clinic" ON public.clinics
  FOR SELECT
  TO authenticated
  USING (id = public.get_user_clinic_id());

-- Profiles 表：使用者只能讀取自己的 profile
DROP POLICY IF EXISTS "Allow authenticated read own profile" ON public.profiles;
CREATE POLICY "Allow authenticated read own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Staff 表：使用者只能讀取自己診所的員工
DROP POLICY IF EXISTS "Allow authenticated read own clinic staff" ON public.staff;
CREATE POLICY "Allow authenticated read own clinic staff" ON public.staff
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- Attendance Logs 表：使用者只能讀取自己診所的考勤紀錄
DROP POLICY IF EXISTS "Allow authenticated read own clinic attendance" ON public.attendance_logs;
CREATE POLICY "Allow authenticated read own clinic attendance" ON public.attendance_logs
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- Doctor Roster 表：使用者只能讀取自己診所的醫師班表
DROP POLICY IF EXISTS "Allow authenticated read own clinic doctor roster" ON public.doctor_roster;
CREATE POLICY "Allow authenticated read own clinic doctor roster" ON public.doctor_roster
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- Roster 表：使用者只能讀取自己診所的班表
DROP POLICY IF EXISTS "Allow authenticated read own clinic roster" ON public.roster;
CREATE POLICY "Allow authenticated read own clinic roster" ON public.roster
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- Leave Requests 表：使用者只能讀取自己診所的請假紀錄
DROP POLICY IF EXISTS "Allow authenticated read own clinic leave requests" ON public.leave_requests;
CREATE POLICY "Allow authenticated read own clinic leave requests" ON public.leave_requests
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- Leave Settlements 表：使用者只能讀取自己診所的結算紀錄
DROP POLICY IF EXISTS "Allow authenticated read own clinic leave settlements" ON public.leave_settlements;
CREATE POLICY "Allow authenticated read own clinic leave settlements" ON public.leave_settlements
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- Doctor PPF 表：使用者只能讀取自己診所的醫師 PPF
DROP POLICY IF EXISTS "Allow authenticated read own clinic doctor ppf" ON public.doctor_ppf;
CREATE POLICY "Allow authenticated read own clinic doctor ppf" ON public.doctor_ppf
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- Salary History 表：使用者只能讀取自己診所的薪資歷史
DROP POLICY IF EXISTS "Allow authenticated read own clinic salary history" ON public.salary_history;
CREATE POLICY "Allow authenticated read own clinic salary history" ON public.salary_history
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- Salary Adjustments 表：使用者只能讀取自己診所的薪資調整
DROP POLICY IF EXISTS "Allow authenticated read own clinic salary adjustments" ON public.salary_adjustments;
CREATE POLICY "Allow authenticated read own clinic salary adjustments" ON public.salary_adjustments
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- System Settings 表：使用者只能讀取自己診所的設定
DROP POLICY IF EXISTS "Allow authenticated read own clinic settings" ON public.system_settings;
CREATE POLICY "Allow authenticated read own clinic settings" ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (clinic_id = public.get_user_clinic_id());

-- ============================================
-- 5. 條件式啟用 RLS (針對可能不存在的表)
-- ============================================

DO $$
BEGIN
  -- Clinic Closed Days
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clinic_closed_days') THEN
    DROP POLICY IF EXISTS "Deny all for anon" ON public.clinic_closed_days;
    CREATE POLICY "Deny all for anon" ON public.clinic_closed_days
      FOR ALL
      TO anon
      USING (false);
    
    DROP POLICY IF EXISTS "Allow authenticated read own clinic closed days" ON public.clinic_closed_days;
    CREATE POLICY "Allow authenticated read own clinic closed days" ON public.clinic_closed_days
      FOR SELECT
      TO authenticated
      USING (clinic_id = public.get_user_clinic_id());
  END IF;

  -- Clinic Holidays
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clinic_holidays') THEN
    DROP POLICY IF EXISTS "Deny all for anon" ON public.clinic_holidays;
    CREATE POLICY "Deny all for anon" ON public.clinic_holidays
      FOR ALL
      TO anon
      USING (false);
    
    DROP POLICY IF EXISTS "Allow authenticated read own clinic holidays" ON public.clinic_holidays;
    CREATE POLICY "Allow authenticated read own clinic holidays" ON public.clinic_holidays
      FOR SELECT
      TO authenticated
      USING (clinic_id = public.get_user_clinic_id());
  END IF;
END $$;

-- ============================================
-- 6. 注意事項
-- ============================================
-- 
-- 此 RLS 策略設計為：
-- 1. 完全禁止匿名使用者 (anon) 直接存取資料
-- 2. 允許已認證使用者 (authenticated) 讀取自己診所的資料
-- 3. 後端 API 使用 service_role 會自動繞過 RLS（因為 service_role 不是 anon 也不是 authenticated）
-- 
-- 如果需要允許使用者寫入資料，可以新增 INSERT/UPDATE/DELETE 策略：
-- 
-- CREATE POLICY "Allow authenticated insert own clinic data" ON public.your_table
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (clinic_id = public.get_user_clinic_id());
-- 
-- CREATE POLICY "Allow authenticated update own clinic data" ON public.your_table
--   FOR UPDATE
--   TO authenticated
--   USING (clinic_id = public.get_user_clinic_id())
--   WITH CHECK (clinic_id = public.get_user_clinic_id());
-- 
-- CREATE POLICY "Allow authenticated delete own clinic data" ON public.your_table
--   FOR DELETE
--   TO authenticated
--   USING (clinic_id = public.get_user_clinic_id());
