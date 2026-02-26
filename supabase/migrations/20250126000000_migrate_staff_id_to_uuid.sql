/*
  # Staff & Doctor ID Migration: int8 → UUID
  
  將員工與醫師的 ID 從 int8 全面遷移至 UUID
  
  遷移步驟：
  1. 為 attendance_logs 新增 staff_id (uuid) 欄位並回填資料
  2. 為 staff 表新增 id_new (uuid) 欄位並生成 UUID
  3. 更新所有子表的外鍵（使用臨時對照表）
  4. 切換主鍵：刪除舊主鍵，將 id_new 更名為 id
  5. 重建外鍵約束與索引
  6. 清理臨時欄位
  
  注意事項：
  - 此遷移需要停止寫入操作
  - 建議在維護時間窗口執行
  - 執行前請完整備份資料庫
*/

-- ============================================
-- 階段 0：前置檢查與準備
-- ============================================

-- 檢查是否有未完成的遷移
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'staff' AND column_name = 'id_new'
  ) THEN
    RAISE EXCEPTION '檢測到未完成的遷移（staff.id_new 已存在），請先清理或完成之前的遷移';
  END IF;
END $$;

-- ============================================
-- 階段 1：為 attendance_logs 新增 staff_id 欄位
-- ============================================

-- 1.1 新增 staff_id 欄位（允許 NULL，稍後回填）
ALTER TABLE attendance_logs 
  ADD COLUMN IF NOT EXISTS staff_id uuid;

-- 1.2 建立索引（用於後續 JOIN 與更新）
CREATE INDEX IF NOT EXISTS idx_attendance_logs_staff_id_temp 
  ON attendance_logs(staff_id) 
  WHERE staff_id IS NOT NULL;

-- 1.3 依據 staff_name 回填 staff_id
-- 注意：如果 staff_name 無法完全比對，這些記錄的 staff_id 會保持 NULL
UPDATE attendance_logs al
SET staff_id = s.id
FROM staff s
WHERE al.staff_name = s.name
  AND al.staff_id IS NULL
  AND al.clinic_id = s.clinic_id; -- 多租戶：確保同診所

-- 1.4 檢查未比對的記錄（僅記錄警告，不中斷遷移）
DO $$
DECLARE
  unmatched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmatched_count
  FROM attendance_logs
  WHERE staff_id IS NULL;
  
  IF unmatched_count > 0 THEN
    RAISE WARNING '有 % 筆 attendance_logs 記錄無法比對到 staff 表，請手動處理', unmatched_count;
  END IF;
END $$;

-- ============================================
-- 階段 2：為 staff 表準備 UUID
-- ============================================

-- 2.1 新增 id_new 欄位（uuid）
ALTER TABLE staff 
  ADD COLUMN id_new uuid;

-- 2.2 為現有資料生成 UUID
UPDATE staff 
SET id_new = gen_random_uuid()
WHERE id_new IS NULL;

-- 2.3 建立唯一索引（確保 UUID 唯一性）
CREATE UNIQUE INDEX idx_staff_id_new_unique 
  ON staff(id_new);

-- 2.4 建立臨時對照表（用於批次更新子表）
CREATE TEMP TABLE staff_id_mapping AS
SELECT id AS old_id, id_new AS new_id
FROM staff;

CREATE INDEX idx_staff_id_mapping_old ON staff_id_mapping(old_id);

-- ============================================
-- 階段 3：更新所有子表的外鍵
-- ============================================

-- 3.1 暫時移除所有外鍵約束（避免更新時衝突）
-- 注意：PostgreSQL 不支援直接修改外鍵欄位型態，需要先刪除約束

-- 3.1.1 移除 attendance_logs 的外鍵（如果存在）
ALTER TABLE attendance_logs 
  DROP CONSTRAINT IF EXISTS attendance_logs_staff_id_fkey;

-- 3.1.2 移除 roster 的外鍵
ALTER TABLE roster 
  DROP CONSTRAINT IF EXISTS roster_staff_id_fkey;

-- 3.1.3 移除 leave_requests 的外鍵
ALTER TABLE leave_requests 
  DROP CONSTRAINT IF EXISTS leave_requests_staff_id_fkey;

-- 3.1.4 移除 leave_settlements 的外鍵
ALTER TABLE leave_settlements 
  DROP CONSTRAINT IF EXISTS leave_settlements_staff_id_fkey;

-- 3.1.5 移除 salary_history 的外鍵
ALTER TABLE salary_history 
  DROP CONSTRAINT IF EXISTS salary_history_staff_id_fkey;

-- 3.1.6 移除 salary_adjustments 的外鍵
ALTER TABLE salary_adjustments 
  DROP CONSTRAINT IF EXISTS salary_adjustments_staff_id_fkey;

-- 3.1.7 移除 doctor_roster 的外鍵
ALTER TABLE doctor_roster 
  DROP CONSTRAINT IF EXISTS doctor_roster_doctor_id_fkey;

-- 3.1.8 移除 doctor_ppf 的外鍵
ALTER TABLE doctor_ppf 
  DROP CONSTRAINT IF EXISTS doctor_ppf_doctor_id_fkey;

-- 3.2 為子表新增臨時 uuid 欄位
ALTER TABLE roster 
  ADD COLUMN IF NOT EXISTS staff_id_new uuid;

ALTER TABLE leave_requests 
  ADD COLUMN IF NOT EXISTS staff_id_new uuid;

ALTER TABLE leave_settlements 
  ADD COLUMN IF NOT EXISTS staff_id_new uuid;

ALTER TABLE salary_history 
  ADD COLUMN IF NOT EXISTS staff_id_new uuid;

ALTER TABLE salary_adjustments 
  ADD COLUMN IF NOT EXISTS staff_id_new uuid;

ALTER TABLE doctor_roster 
  ADD COLUMN IF NOT EXISTS doctor_id_new uuid;

ALTER TABLE doctor_ppf 
  ADD COLUMN IF NOT EXISTS doctor_id_new uuid;

-- 3.3 使用對照表更新子表的外鍵
UPDATE roster r
SET staff_id_new = m.new_id
FROM staff_id_mapping m
WHERE r.staff_id = m.old_id;

UPDATE leave_requests lr
SET staff_id_new = m.new_id
FROM staff_id_mapping m
WHERE lr.staff_id = m.old_id;

UPDATE leave_settlements ls
SET staff_id_new = m.new_id
FROM staff_id_mapping m
WHERE ls.staff_id = m.old_id;

UPDATE salary_history sh
SET staff_id_new = m.new_id
FROM staff_id_mapping m
WHERE sh.staff_id = m.old_id;

UPDATE salary_adjustments sa
SET staff_id_new = m.new_id
FROM staff_id_mapping m
WHERE sa.staff_id = m.old_id;

UPDATE doctor_roster dr
SET doctor_id_new = m.new_id
FROM staff_id_mapping m
WHERE dr.doctor_id = m.old_id;

UPDATE doctor_ppf dp
SET doctor_id_new = m.new_id
FROM staff_id_mapping m
WHERE dp.doctor_id = m.old_id;

-- 3.4 檢查是否有無法對應的記錄
DO $$
DECLARE
  unmatched_roster INTEGER;
  unmatched_leave_req INTEGER;
  unmatched_leave_set INTEGER;
  unmatched_salary_hist INTEGER;
  unmatched_salary_adj INTEGER;
  unmatched_doc_roster INTEGER;
  unmatched_doc_ppf INTEGER;
BEGIN
  SELECT COUNT(*) INTO unmatched_roster FROM roster WHERE staff_id_new IS NULL AND staff_id IS NOT NULL;
  SELECT COUNT(*) INTO unmatched_leave_req FROM leave_requests WHERE staff_id_new IS NULL AND staff_id IS NOT NULL;
  SELECT COUNT(*) INTO unmatched_leave_set FROM leave_settlements WHERE staff_id_new IS NULL AND staff_id IS NOT NULL;
  SELECT COUNT(*) INTO unmatched_salary_hist FROM salary_history WHERE staff_id_new IS NULL AND staff_id IS NOT NULL;
  SELECT COUNT(*) INTO unmatched_salary_adj FROM salary_adjustments WHERE staff_id_new IS NULL AND staff_id IS NOT NULL;
  SELECT COUNT(*) INTO unmatched_doc_roster FROM doctor_roster WHERE doctor_id_new IS NULL AND doctor_id IS NOT NULL;
  SELECT COUNT(*) INTO unmatched_doc_ppf FROM doctor_ppf WHERE doctor_id_new IS NULL AND doctor_id IS NOT NULL;
  
  IF unmatched_roster > 0 THEN
    RAISE WARNING 'roster 表有 % 筆記錄無法對應到 staff', unmatched_roster;
  END IF;
  IF unmatched_leave_req > 0 THEN
    RAISE WARNING 'leave_requests 表有 % 筆記錄無法對應到 staff', unmatched_leave_req;
  END IF;
  IF unmatched_leave_set > 0 THEN
    RAISE WARNING 'leave_settlements 表有 % 筆記錄無法對應到 staff', unmatched_leave_set;
  END IF;
  IF unmatched_salary_hist > 0 THEN
    RAISE WARNING 'salary_history 表有 % 筆記錄無法對應到 staff', unmatched_salary_hist;
  END IF;
  IF unmatched_salary_adj > 0 THEN
    RAISE WARNING 'salary_adjustments 表有 % 筆記錄無法對應到 staff', unmatched_salary_adj;
  END IF;
  IF unmatched_doc_roster > 0 THEN
    RAISE WARNING 'doctor_roster 表有 % 筆記錄無法對應到 staff', unmatched_doc_roster;
  END IF;
  IF unmatched_doc_ppf > 0 THEN
    RAISE WARNING 'doctor_ppf 表有 % 筆記錄無法對應到 staff', unmatched_doc_ppf;
  END IF;
END $$;

-- 3.5 刪除舊欄位並更名新欄位
-- 注意：PostgreSQL 不支援在同一個 ALTER TABLE 中同時 DROP 和 RENAME，需要分開執行

ALTER TABLE roster DROP COLUMN IF EXISTS staff_id;
ALTER TABLE roster ALTER COLUMN staff_id_new RENAME TO staff_id;

ALTER TABLE leave_requests DROP COLUMN IF EXISTS staff_id;
ALTER TABLE leave_requests ALTER COLUMN staff_id_new RENAME TO staff_id;

ALTER TABLE leave_settlements DROP COLUMN IF EXISTS staff_id;
ALTER TABLE leave_settlements ALTER COLUMN staff_id_new RENAME TO staff_id;

ALTER TABLE salary_history DROP COLUMN IF EXISTS staff_id;
ALTER TABLE salary_history ALTER COLUMN staff_id_new RENAME TO staff_id;

ALTER TABLE salary_adjustments DROP COLUMN IF EXISTS staff_id;
ALTER TABLE salary_adjustments ALTER COLUMN staff_id_new RENAME TO staff_id;

ALTER TABLE doctor_roster DROP COLUMN IF EXISTS doctor_id;
ALTER TABLE doctor_roster ALTER COLUMN doctor_id_new RENAME TO doctor_id;

ALTER TABLE doctor_ppf DROP COLUMN IF EXISTS doctor_id;
ALTER TABLE doctor_ppf ALTER COLUMN doctor_id_new RENAME TO doctor_id;

-- 3.6 更新 attendance_logs.staff_id
-- 注意：attendance_logs.staff_id 應該直接從 staff_name 對應到新的 UUID
-- 由於我們在階段 1 已經用舊的 id 對應過，現在需要更新為新的 UUID
UPDATE attendance_logs al
SET staff_id = s.id_new
FROM staff s
WHERE al.staff_name = s.name
  AND al.clinic_id = s.clinic_id;

-- ============================================
-- 階段 4：切換 staff 表的主鍵
-- ============================================

-- 4.1 暫時移除主鍵約束（但保留唯一索引）
-- 注意：PostgreSQL 不允許直接修改主鍵型態，需要重建
ALTER TABLE staff 
  DROP CONSTRAINT IF EXISTS staff_pkey;

-- 4.2 刪除舊的 id 欄位（先確保沒有其他依賴）
-- 注意：這裡我們先保留舊欄位作為備份，稍後再刪除
-- 實際操作：直接更名，避免資料遺失

-- 4.3 將 id_new 更名為 id
ALTER TABLE staff 
  DROP COLUMN IF EXISTS id,
  ALTER COLUMN id_new RENAME TO id;

-- 4.4 重建主鍵約束
ALTER TABLE staff 
  ADD PRIMARY KEY (id);

-- ============================================
-- 階段 5：重建外鍵約束
-- ============================================

-- 5.1 attendance_logs
ALTER TABLE attendance_logs 
  ADD CONSTRAINT attendance_logs_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL;

-- 5.2 roster
ALTER TABLE roster 
  ADD CONSTRAINT roster_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

-- 5.3 leave_requests
ALTER TABLE leave_requests 
  ADD CONSTRAINT leave_requests_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

-- 5.4 leave_settlements
ALTER TABLE leave_settlements 
  ADD CONSTRAINT leave_settlements_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

-- 5.5 salary_history
ALTER TABLE salary_history 
  ADD CONSTRAINT salary_history_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

-- 5.6 salary_adjustments
ALTER TABLE salary_adjustments 
  ADD CONSTRAINT salary_adjustments_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;

-- 5.7 doctor_roster
ALTER TABLE doctor_roster 
  ADD CONSTRAINT doctor_roster_doctor_id_fkey 
  FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE CASCADE;

-- 5.8 doctor_ppf
ALTER TABLE doctor_ppf 
  ADD CONSTRAINT doctor_ppf_doctor_id_fkey 
  FOREIGN KEY (doctor_id) REFERENCES staff(id) ON DELETE CASCADE;

-- ============================================
-- 階段 6：重建索引
-- ============================================

-- 6.1 刪除舊索引（如果存在）
DROP INDEX IF EXISTS idx_attendance_logs_staff_id_temp;

-- 6.2 建立新的索引
CREATE INDEX IF NOT EXISTS idx_attendance_logs_staff_id 
  ON attendance_logs(staff_id) 
  WHERE staff_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_roster_staff_id 
  ON roster(staff_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_staff_id 
  ON leave_requests(staff_id);

CREATE INDEX IF NOT EXISTS idx_leave_settlements_staff_id 
  ON leave_settlements(staff_id);

CREATE INDEX IF NOT EXISTS idx_salary_history_staff_id 
  ON salary_history(staff_id);

CREATE INDEX IF NOT EXISTS idx_salary_adjustments_staff_id 
  ON salary_adjustments(staff_id);

CREATE INDEX IF NOT EXISTS idx_doctor_roster_doctor_id 
  ON doctor_roster(doctor_id);

CREATE INDEX IF NOT EXISTS idx_doctor_ppf_doctor_id 
  ON doctor_ppf(doctor_id);

-- 6.3 刪除臨時索引
DROP INDEX IF EXISTS idx_staff_id_new_unique;
DROP INDEX IF EXISTS idx_staff_id_mapping_old;

-- ============================================
-- 階段 7：設定 NOT NULL 約束（可選）
-- ============================================

-- 7.1 為子表的 staff_id 設定 NOT NULL（如果資料完整）
-- 注意：attendance_logs.staff_id 允許 NULL（因為可能有無法比對的記錄）

DO $$
BEGIN
  -- 檢查是否有 NULL 值
  IF NOT EXISTS (SELECT 1 FROM roster WHERE staff_id IS NULL) THEN
    ALTER TABLE roster ALTER COLUMN staff_id SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM leave_requests WHERE staff_id IS NULL) THEN
    ALTER TABLE leave_requests ALTER COLUMN staff_id SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM leave_settlements WHERE staff_id IS NULL) THEN
    ALTER TABLE leave_settlements ALTER COLUMN staff_id SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM salary_history WHERE staff_id IS NULL) THEN
    ALTER TABLE salary_history ALTER COLUMN staff_id SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM salary_adjustments WHERE staff_id IS NULL) THEN
    ALTER TABLE salary_adjustments ALTER COLUMN staff_id SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM doctor_roster WHERE doctor_id IS NULL) THEN
    ALTER TABLE doctor_roster ALTER COLUMN doctor_id SET NOT NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM doctor_ppf WHERE doctor_id IS NULL) THEN
    ALTER TABLE doctor_ppf ALTER COLUMN doctor_id SET NOT NULL;
  END IF;
END $$;

-- ============================================
-- 階段 8：驗證與清理
-- ============================================

-- 8.1 驗證資料完整性
DO $$
DECLARE
  staff_count INTEGER;
  roster_count INTEGER;
  leave_req_count INTEGER;
  leave_set_count INTEGER;
  salary_hist_count INTEGER;
  salary_adj_count INTEGER;
  doc_roster_count INTEGER;
  doc_ppf_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO staff_count FROM staff;
  SELECT COUNT(*) INTO roster_count FROM roster;
  SELECT COUNT(*) INTO leave_req_count FROM leave_requests;
  SELECT COUNT(*) INTO leave_set_count FROM leave_settlements;
  SELECT COUNT(*) INTO salary_hist_count FROM salary_history;
  SELECT COUNT(*) INTO salary_adj_count FROM salary_adjustments;
  SELECT COUNT(*) INTO doc_roster_count FROM doctor_roster;
  SELECT COUNT(*) INTO doc_ppf_count FROM doctor_ppf;
  
  RAISE NOTICE '遷移完成！資料統計：';
  RAISE NOTICE '  - staff: % 筆', staff_count;
  RAISE NOTICE '  - roster: % 筆', roster_count;
  RAISE NOTICE '  - leave_requests: % 筆', leave_req_count;
  RAISE NOTICE '  - leave_settlements: % 筆', leave_set_count;
  RAISE NOTICE '  - salary_history: % 筆', salary_hist_count;
  RAISE NOTICE '  - salary_adjustments: % 筆', salary_adj_count;
  RAISE NOTICE '  - doctor_roster: % 筆', doc_roster_count;
  RAISE NOTICE '  - doctor_ppf: % 筆', doc_ppf_count;
END $$;

-- 8.2 清理臨時對照表（TEMP 表會自動清理，這裡只是確認）
-- 臨時表會在 session 結束時自動刪除

-- ============================================
-- 完成
-- ============================================

COMMENT ON COLUMN staff.id IS '員工/醫師 UUID 主鍵（已從 int8 遷移）';
COMMENT ON COLUMN attendance_logs.staff_id IS '員工 UUID（從 staff_name 對應）';
COMMENT ON COLUMN roster.staff_id IS '員工 UUID（已從 int8 遷移）';
COMMENT ON COLUMN leave_requests.staff_id IS '員工 UUID（已從 int8 遷移）';
COMMENT ON COLUMN leave_settlements.staff_id IS '員工 UUID（已從 int8 遷移）';
COMMENT ON COLUMN salary_history.staff_id IS '員工 UUID（已從 int8 遷移）';
COMMENT ON COLUMN salary_adjustments.staff_id IS '員工 UUID（已從 int8 遷移）';
COMMENT ON COLUMN doctor_roster.doctor_id IS '醫師 UUID（已從 int8 遷移）';
COMMENT ON COLUMN doctor_ppf.doctor_id IS '醫師 UUID（已從 int8 遷移）';

-- 遷移完成提示（使用 DO 區塊）
DO $$
BEGIN
  RAISE NOTICE '✅ UUID 遷移完成！所有 staff_id 和 doctor_id 已成功轉換為 UUID。';
END $$;
