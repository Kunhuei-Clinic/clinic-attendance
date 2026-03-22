-- 全平台全域設定（非單一診所），例如法定稅率與扣繳門檻
CREATE TABLE IF NOT EXISTS system_configs (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE system_configs IS 'SaaS 全域鍵值設定；與依診所之 system_settings 分離';

INSERT INTO system_configs (key, value)
VALUES (
  'statutory_tax_rates',
  '{"nhi_2nd_rate": 0.0211, "nhi_2nd_threshold": 27470, "tax_rate": 0.05, "tax_threshold_salary": 40000, "tax_threshold_professional": 20000}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
