/*
  # Add Portal / Admin Columns to Staff Table

  為 staff 表新增 Portal 與後台所需欄位，避免 /api/portal/data 查詢失敗：
  1. admin_role (text) - 主管權限：owner | manager | none
  2. start_date (date) - 到職日，用於年資與特休計算
  3. annual_leave_quota (numeric) - 特休額度（天數）
  4. annual_leave_history (jsonb) - 特休使用紀錄（陣列或物件）
*/

-- 1. 主管權限：用於 Portal 主管儀表板、權限判斷
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS admin_role text DEFAULT 'none';

COMMENT ON COLUMN staff.admin_role IS '主管權限：owner（負責人）、manager（主管）、none（一般員工）';

-- 2. 到職日：用於年資、特休計算與後台顯示
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS start_date date;

COMMENT ON COLUMN staff.start_date IS '到職日，格式 YYYY-MM-DD';

-- 3. 特休額度（天數）
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS annual_leave_quota numeric;

COMMENT ON COLUMN staff.annual_leave_quota IS '特休額度（天數），可為小數';

-- 4. 特休使用紀錄（JSON，可存陣列或物件）
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS annual_leave_history jsonb;

COMMENT ON COLUMN staff.annual_leave_history IS '特休使用紀錄，格式由前端/後端約定（陣列或物件）';

-- 索引：若常依 admin_role 篩選可加（可選）
CREATE INDEX IF NOT EXISTS idx_staff_admin_role
  ON staff(admin_role)
  WHERE admin_role IS NOT NULL AND admin_role != 'none';
