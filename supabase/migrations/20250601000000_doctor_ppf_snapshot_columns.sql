-- 新增 doctor_ppf 封存快照欄位 (Snapshot Strategy)
-- 當 status = 'locked' 時，保障薪等以快照顯示，不再依班表重新計算

ALTER TABLE doctor_ppf
  ADD COLUMN IF NOT EXISTS snapshot_actual_hours numeric,
  ADD COLUMN IF NOT EXISTS snapshot_standard_hours numeric,
  ADD COLUMN IF NOT EXISTS snapshot_hourly_rate numeric,
  ADD COLUMN IF NOT EXISTS snapshot_guarantee numeric,
  ADD COLUMN IF NOT EXISTS snapshot_license_fee numeric,
  ADD COLUMN IF NOT EXISTS snapshot_mode text;

-- 出勤明細快照 (封存時的 roster)，供薪資單第二頁顯示
ALTER TABLE doctor_ppf
  ADD COLUMN IF NOT EXISTS snapshot_roster jsonb DEFAULT '[]';
