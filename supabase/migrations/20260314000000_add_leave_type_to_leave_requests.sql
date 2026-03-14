-- 補打卡類型：補上班/補下班/補全天，寫入 leave_requests.leave_type
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS leave_type text;

COMMENT ON COLUMN leave_requests.leave_type IS '補打卡時為：上班 / 下班 / 全天；一般請假可為空';
