-- 建立特休結算表
CREATE TABLE IF NOT EXISTS leave_settlements (
    id BIGSERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    days DECIMAL(5, 2) NOT NULL DEFAULT 0, -- 結算天數 (支援小數點，例如 0.5 天)
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 結算金額
    pay_month VARCHAR(7) NOT NULL, -- 發放月份 (格式: YYYY-MM)
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processed, cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT -- 備註
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_leave_settlements_staff_id ON leave_settlements(staff_id);
CREATE INDEX IF NOT EXISTS idx_leave_settlements_pay_month ON leave_settlements(pay_month);
CREATE INDEX IF NOT EXISTS idx_leave_settlements_status ON leave_settlements(status);

-- 建立更新時間觸發器
CREATE OR REPLACE FUNCTION update_leave_settlements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_leave_settlements_updated_at
    BEFORE UPDATE ON leave_settlements
    FOR EACH ROW
    EXECUTE FUNCTION update_leave_settlements_updated_at();

-- 新增系統設定欄位 (如果 system_settings 表已存在，這個會自動忽略)
-- 注意：如果 system_settings 表不存在，需要先建立該表
-- 這裡假設表已存在，只插入預設值
INSERT INTO system_settings (key, value)
VALUES ('leave_calculation_system', 'anniversary')
ON CONFLICT (key) DO NOTHING;
