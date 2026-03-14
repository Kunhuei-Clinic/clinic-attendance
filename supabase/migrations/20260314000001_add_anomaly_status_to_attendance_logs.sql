-- 異常打卡審核狀態：resolved / rejected，供統一審核中樞使用
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS anomaly_status text;

COMMENT ON COLUMN attendance_logs.anomaly_status IS '異常打卡處理狀態：resolved=已核准, rejected=已駁回';
