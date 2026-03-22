-- staff 表：稅務申報身分與自動扣繳開關（供月底結算／二代健保／預扣稅使用）
-- income_type: salary = 薪資所得(50)、professional = 執行業務所得(9A)

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS income_type text NOT NULL DEFAULT 'salary';

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS enable_nhi_2nd boolean NOT NULL DEFAULT false;

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS enable_tax_withhold boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  ALTER TABLE staff
    ADD CONSTRAINT staff_income_type_check
    CHECK (income_type IN ('salary', 'professional'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN staff.income_type IS '申報所得類別：salary=薪資所得(代號50)、professional=執行業務所得(代號9A)';
COMMENT ON COLUMN staff.enable_nhi_2nd IS '啟用二代健保自動扣繳（結算時依法定門檻與費率計算）';
COMMENT ON COLUMN staff.enable_tax_withhold IS '啟用預扣所得稅自動扣繳（結算時依法定門檻與費率計算）';
