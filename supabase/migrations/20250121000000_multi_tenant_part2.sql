/*
  # Multi-Tenant Migration Part 2: 補漏表格
  
  針對以下遺漏的表格新增 clinic_id：
  1. clinic_closed_days (診所休診日)
  2. clinic_holidays (國定假日 - 注意表格名稱通常是複數，請確認是 holiday 還是 holidays)
  3. salary_adjustments (薪資調整紀錄)
*/

DO $$
DECLARE
  default_clinic_id uuid;
BEGIN
  -- 1. 先取得預設診所 ID (坤暉診所)
  SELECT id INTO default_clinic_id FROM clinics WHERE code = 'default' LIMIT 1;
  
  IF default_clinic_id IS NULL THEN
    RAISE EXCEPTION '找不到預設診所 (code=default)，請先執行第一波 Migration';
  END IF;

  -- ==================================================
  -- Table 1: clinic_closed_days
  -- ==================================================
  -- 新增欄位
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clinic_closed_days') THEN
    ALTER TABLE clinic_closed_days ADD COLUMN IF NOT EXISTS clinic_id uuid;
    
    -- 補填資料
    UPDATE clinic_closed_days SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
    
    -- 設定約束 (Not Null + FK)
    ALTER TABLE clinic_closed_days ALTER COLUMN clinic_id SET NOT NULL;
    ALTER TABLE clinic_closed_days DROP CONSTRAINT IF EXISTS fk_closed_days_clinic;
    ALTER TABLE clinic_closed_days ADD CONSTRAINT fk_closed_days_clinic 
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
      
    -- 建立索引
    CREATE INDEX IF NOT EXISTS idx_closed_days_clinic ON clinic_closed_days(clinic_id);
    
    -- 啟用 RLS
    ALTER TABLE clinic_closed_days ENABLE ROW LEVEL SECURITY;
  END IF;

  -- ==================================================
  -- Table 2: clinic_holidays (或 clinic_holiday)
  -- ==================================================
  -- 檢查表格名稱是單數還是複數，這裡假設兩個都檢查
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clinic_holidays') THEN
    ALTER TABLE clinic_holidays ADD COLUMN IF NOT EXISTS clinic_id uuid;
    UPDATE clinic_holidays SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
    ALTER TABLE clinic_holidays ALTER COLUMN clinic_id SET NOT NULL;
    ALTER TABLE clinic_holidays DROP CONSTRAINT IF EXISTS fk_holidays_clinic;
    ALTER TABLE clinic_holidays ADD CONSTRAINT fk_holidays_clinic 
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_holidays_clinic ON clinic_holidays(clinic_id);
    ALTER TABLE clinic_holidays ENABLE ROW LEVEL SECURITY;
  ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clinic_holiday') THEN
    -- 如果表名是單數
    ALTER TABLE clinic_holiday ADD COLUMN IF NOT EXISTS clinic_id uuid;
    UPDATE clinic_holiday SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
    ALTER TABLE clinic_holiday ALTER COLUMN clinic_id SET NOT NULL;
    ALTER TABLE clinic_holiday DROP CONSTRAINT IF EXISTS fk_holiday_clinic;
    ALTER TABLE clinic_holiday ADD CONSTRAINT fk_holiday_clinic 
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_holiday_clinic ON clinic_holiday(clinic_id);
    ALTER TABLE clinic_holiday ENABLE ROW LEVEL SECURITY;
  END IF;

  -- ==================================================
  -- Table 3: salary_adjustments
  -- ==================================================
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'salary_adjustments') THEN
    ALTER TABLE salary_adjustments ADD COLUMN IF NOT EXISTS clinic_id uuid;
    UPDATE salary_adjustments SET clinic_id = default_clinic_id WHERE clinic_id IS NULL;
    ALTER TABLE salary_adjustments ALTER COLUMN clinic_id SET NOT NULL;
    ALTER TABLE salary_adjustments DROP CONSTRAINT IF EXISTS fk_salary_adj_clinic;
    ALTER TABLE salary_adjustments ADD CONSTRAINT fk_salary_adj_clinic 
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_salary_adj_clinic ON salary_adjustments(clinic_id);
    ALTER TABLE salary_adjustments ENABLE ROW LEVEL SECURITY;
  END IF;

  RAISE NOTICE '補漏 Migration 完成！';
END $$;
