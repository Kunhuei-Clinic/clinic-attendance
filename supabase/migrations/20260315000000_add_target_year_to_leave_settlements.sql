-- 為 leave_settlements 新增 target_year，用於週年制特休歸屬「滿 N 年」
-- 結算／遞延／微調開帳時寫入，供 leave-summary 與 stats 精算使用
ALTER TABLE leave_settlements
  ADD COLUMN IF NOT EXISTS target_year VARCHAR(10);

COMMENT ON COLUMN leave_settlements.target_year IS '特休週年制歸屬年度，例如 1, 2, 0.5（滿半年）';
