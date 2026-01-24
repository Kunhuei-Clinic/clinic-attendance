/*
  # Multi-Tenant SaaS Architecture Migration
  
  將單一診所系統升級為多租戶 (Multi-Tenant) SaaS 架構
  
  1. 建立租戶主表 (clinics)
  2. 建立使用者關聯表 (profiles)
  3. 為現有資料表新增 clinic_id 欄位
  4. 資料初始化（建立第一家診所並關聯現有資料）
  5. RLS Policy 範例（註解）
*/

-- ============================================
-- 1. 建立租戶主表 (Clinics Table)
-- ============================================

CREATE TABLE IF NOT EXISTS clinics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_clinics_code ON clinics(code);

-- 啟用 RLS
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. 建立使用者關聯表 (Profiles Table)
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(id, clinic_id)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_profiles_clinic_id ON profiles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 啟用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. 為現有資料表新增 clinic_id 欄位
-- ============================================

-- 3.1 staff 表
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- 3.2 attendance_logs 表
ALTER TABLE attendance_logs 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- 3.3 doctor_roster 表
ALTER TABLE doctor_roster 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- 3.4 roster 表
ALTER TABLE roster 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- 3.5 leave_requests 表
ALTER TABLE leave_requests 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- 3.6 leave_settlements 表
ALTER TABLE leave_settlements 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- 3.7 doctor_ppf 表
ALTER TABLE doctor_ppf 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- 3.8 salary_history 表
ALTER TABLE salary_history 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- 3.9 system_settings 表
ALTER TABLE system_settings 
  ADD COLUMN IF NOT EXISTS clinic_id uuid;

-- ============================================
-- 4. 資料初始化
-- ============================================

-- 4.1 插入第一家診所（預設診所）
INSERT INTO clinics (name, code, settings)
VALUES (
  '坤暉診所',
  'default',
  '{
    "openDays": [1, 2, 3, 4, 5, 6],
    "shifts": {
      "AM": { "start": "08:00", "end": "12:30" },
      "PM": { "start": "15:00", "end": "18:00" },
      "NIGHT": { "start": "18:00", "end": "21:00" }
    }
  }'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- 取得預設診所的 ID（用於後續更新）
DO $$
DECLARE
  default_clinic_id uuid;
BEGIN
  -- 取得預設診所 ID
  SELECT id INTO default_clinic_id FROM clinics WHERE code = 'default' LIMIT 1;
  
  -- 如果找不到預設診所，建立一個
  IF default_clinic_id IS NULL THEN
    INSERT INTO clinics (name, code, settings)
    VALUES (
      '坤暉診所',
      'default',
      '{
        "openDays": [1, 2, 3, 4, 5, 6],
        "shifts": {
          "AM": { "start": "08:00", "end": "12:30" },
          "PM": { "start": "14:00", "end": "17:30" },
          "NIGHT": { "start": "18:00", "end": "21:30" }
        }
      }'::jsonb
    )
    RETURNING id INTO default_clinic_id;
  END IF;
  
  -- 4.2 將現有資料的 clinic_id 全部設為預設診所 ID
  UPDATE staff SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE attendance_logs SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE doctor_roster SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE roster SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE leave_requests SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE leave_settlements SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE doctor_ppf SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE salary_history SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
  UPDATE system_settings SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
END $$;

-- ============================================
-- 5. 設定 Foreign Key 約束和 NOT NULL
-- ============================================

-- 5.1 為所有資料表新增 Foreign Key 約束
ALTER TABLE staff 
  ADD CONSTRAINT fk_staff_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE attendance_logs 
  ADD CONSTRAINT fk_attendance_logs_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE doctor_roster 
  ADD CONSTRAINT fk_doctor_roster_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE roster 
  ADD CONSTRAINT fk_roster_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE leave_requests 
  ADD CONSTRAINT fk_leave_requests_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE leave_settlements 
  ADD CONSTRAINT fk_leave_settlements_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE doctor_ppf 
  ADD CONSTRAINT fk_doctor_ppf_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE salary_history 
  ADD CONSTRAINT fk_salary_history_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

ALTER TABLE system_settings 
  ADD CONSTRAINT fk_system_settings_clinic_id 
  FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;

-- 5.2 設定 clinic_id 為 NOT NULL（確保未來新增資料一定要有歸屬）
ALTER TABLE staff 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE attendance_logs 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE doctor_roster 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE roster 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE leave_requests 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE leave_settlements 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE doctor_ppf 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE salary_history 
  ALTER COLUMN clinic_id SET NOT NULL;

ALTER TABLE system_settings 
  ALTER COLUMN clinic_id SET NOT NULL;

-- ============================================
-- 6. 建立索引以提升查詢效能
-- ============================================

CREATE INDEX IF NOT EXISTS idx_staff_clinic_id ON staff(clinic_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_clinic_id ON attendance_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_roster_clinic_id ON doctor_roster(clinic_id);
CREATE INDEX IF NOT EXISTS idx_roster_clinic_id ON roster(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_clinic_id ON leave_requests(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leave_settlements_clinic_id ON leave_settlements(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctor_ppf_clinic_id ON doctor_ppf(clinic_id);
CREATE INDEX IF NOT EXISTS idx_salary_history_clinic_id ON salary_history(clinic_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_clinic_id ON system_settings(clinic_id);

-- ============================================
-- 7. RLS Policy 範例（註解）
-- ============================================

/*
  RLS Policy 範例：User 只能讀取 clinic_id 與自己 profiles.clinic_id 相同的資料
  
  以下是一個通用的 RLS Policy 範例，可以套用到所有需要租戶隔離的資料表。
  
  -- 範例：為 staff 表建立 RLS Policy
  
  -- SELECT Policy: 使用者只能讀取自己診所的資料
  CREATE POLICY "Users can only view their clinic's staff"
    ON staff
    FOR SELECT
    TO authenticated
    USING (
      clinic_id IN (
        SELECT clinic_id 
        FROM profiles 
        WHERE id = auth.uid()
      )
    );
  
  -- INSERT Policy: 使用者只能新增到自己診所的資料
  CREATE POLICY "Users can only insert into their clinic"
    ON staff
    FOR INSERT
    TO authenticated
    WITH CHECK (
      clinic_id IN (
        SELECT clinic_id 
        FROM profiles 
        WHERE id = auth.uid()
      )
    );
  
  -- UPDATE Policy: 使用者只能更新自己診所的資料
  CREATE POLICY "Users can only update their clinic's staff"
    ON staff
    FOR UPDATE
    TO authenticated
    USING (
      clinic_id IN (
        SELECT clinic_id 
        FROM profiles 
        WHERE id = auth.uid()
      )
    )
    WITH CHECK (
      clinic_id IN (
        SELECT clinic_id 
        FROM profiles 
        WHERE id = auth.uid()
      )
    );
  
  -- DELETE Policy: 使用者只能刪除自己診所的資料
  CREATE POLICY "Users can only delete their clinic's staff"
    ON staff
    FOR DELETE
    TO authenticated
    USING (
      clinic_id IN (
        SELECT clinic_id 
        FROM profiles 
        WHERE id = auth.uid()
      )
    );
  
  -- 通用 Helper Function（可選，簡化 Policy 寫法）
  CREATE OR REPLACE FUNCTION get_user_clinic_ids()
  RETURNS SETOF uuid AS $$
  BEGIN
    RETURN QUERY
    SELECT clinic_id 
    FROM profiles 
    WHERE id = auth.uid();
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  
  -- 使用 Helper Function 的簡化 Policy
  CREATE POLICY "Users can only view their clinic's staff (simplified)"
    ON staff
    FOR SELECT
    TO authenticated
    USING (clinic_id = ANY(SELECT get_user_clinic_ids()));
  
  -- 注意事項：
  -- 1. 以上 Policy 適用於 authenticated 使用者
  -- 2. 如果使用 Service Role Key (supabaseAdmin)，會繞過 RLS
  -- 3. 建議為每個需要租戶隔離的資料表建立類似的 Policy
  -- 4. admin 角色可能需要額外的 Policy 來管理多個診所
*/

-- ============================================
-- 8. 建立更新時間觸發器（可選）
-- ============================================

-- 為 clinics 表建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_clinics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_clinics_updated_at
  BEFORE UPDATE ON clinics
  FOR EACH ROW
  EXECUTE FUNCTION update_clinics_updated_at();

-- 為 profiles 表建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- ============================================
-- Migration 完成
-- ============================================

-- 驗證：檢查是否有資料遺漏
DO $$
DECLARE
  default_clinic_id uuid;
  missing_count integer;
BEGIN
  SELECT id INTO default_clinic_id FROM clinics WHERE code = 'default' LIMIT 1;
  
  -- 檢查各表是否有 NULL 的 clinic_id
  SELECT COUNT(*) INTO missing_count FROM staff WHERE clinic_id IS NULL;
  IF missing_count > 0 THEN
    RAISE WARNING 'staff 表仍有 % 筆資料的 clinic_id 為 NULL', missing_count;
  END IF;
  
  SELECT COUNT(*) INTO missing_count FROM attendance_logs WHERE clinic_id IS NULL;
  IF missing_count > 0 THEN
    RAISE WARNING 'attendance_logs 表仍有 % 筆資料的 clinic_id 為 NULL', missing_count;
  END IF;
  
  -- 可以繼續檢查其他表...
  
  RAISE NOTICE 'Migration 完成！預設診所 ID: %', default_clinic_id;
END $$;
