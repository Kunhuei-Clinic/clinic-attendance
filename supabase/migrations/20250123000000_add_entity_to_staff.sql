/*
  # Add entity column to staff table
  
  為 staff 表新增 entity 欄位，用於區分員工所屬的組織單位（診所/藥局）
*/

-- 新增 entity 欄位（如果不存在）
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS entity text DEFAULT 'clinic';

-- 為現有資料設定預設值
UPDATE staff 
SET entity = 'clinic' 
WHERE entity IS NULL;

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_staff_entity ON staff(entity);

-- 添加註解說明
COMMENT ON COLUMN staff.entity IS '組織單位識別碼：clinic (診所) 或 pharmacy (藥局)';
