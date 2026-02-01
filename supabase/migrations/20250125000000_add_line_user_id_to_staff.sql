/*
  # Add LINE User ID Column to Staff Table
  
  為 staff 表新增 LINE 綁定相關欄位：
  1. line_user_id (text, nullable) - LINE User ID，用於 LINE LIFF 自動登入
  2. 為 line_user_id 建立 Unique Index (避免同一個 LINE 帳號綁定兩個員工)
  3. 確認 password 欄位存在 (若無則新增，預設值為 '0000')
*/

-- ============================================
-- 1. 確認 password 欄位存在
-- ============================================

-- 新增 password 欄位（如果不存在）
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS password text DEFAULT '0000';

-- 為現有資料設定預設密碼（如果 password 為 NULL）
UPDATE staff 
SET password = '0000' 
WHERE password IS NULL;

-- 添加註解說明
COMMENT ON COLUMN staff.password IS '員工登入密碼，預設為 0000';

-- ============================================
-- 2. 新增 line_user_id 欄位
-- ============================================

-- 新增 line_user_id 欄位（如果不存在）
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS line_user_id text;

-- 添加註解說明
COMMENT ON COLUMN staff.line_user_id IS 'LINE User ID，用於 LINE LIFF 自動登入與綁定';

-- ============================================
-- 3. 建立 Unique Index (避免重複綁定)
-- ============================================

-- 為 line_user_id 建立 Unique Index（只針對非 NULL 值）
-- 使用 WHERE 條件確保只有非 NULL 值才需要唯一性約束
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_line_user_id_unique 
ON staff(line_user_id) 
WHERE line_user_id IS NOT NULL;

-- 建立一般索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_staff_line_user_id 
ON staff(line_user_id) 
WHERE line_user_id IS NOT NULL;
