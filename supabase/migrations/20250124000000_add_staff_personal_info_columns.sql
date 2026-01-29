/*
  # Add Personal Information Columns to Staff Table
  
  為 staff 表新增員工個人資料欄位：
  1. 身分證字號 (id_number)
  2. 電話 (phone)
  3. 地址 (address)
  4. 緊急連絡人 (emergency_contact) - 包含姓名和電話
  5. 銀行帳號 (bank_account)
*/

-- 新增身分證字號欄位
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS id_number text;

-- 新增電話欄位
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS phone text;

-- 新增地址欄位
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS address text;

-- 新增緊急連絡人欄位（包含姓名和電話）
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS emergency_contact text;

-- 新增銀行帳號欄位
ALTER TABLE staff 
  ADD COLUMN IF NOT EXISTS bank_account text;

-- 為欄位添加註解說明
COMMENT ON COLUMN staff.id_number IS '身分證字號，格式：A123456789';
COMMENT ON COLUMN staff.phone IS '聯絡電話，格式：0912-345-678';
COMMENT ON COLUMN staff.address IS '通訊地址';
COMMENT ON COLUMN staff.emergency_contact IS '緊急連絡人資訊，包含姓名和電話';
COMMENT ON COLUMN staff.bank_account IS '銀行帳號，用於薪資轉帳';

-- 建立索引以提升查詢效能（針對可能需要搜尋的欄位）
CREATE INDEX IF NOT EXISTS idx_staff_phone ON staff(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_staff_id_number ON staff(id_number) WHERE id_number IS NOT NULL;
