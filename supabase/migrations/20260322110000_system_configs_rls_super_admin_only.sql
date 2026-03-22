-- system_configs：RLS 僅允許 super_admins 帳號讀寫；anon 全拒絕。
-- 後端使用 service_role（supabaseAdmin）仍會繞過 RLS，不受影響。

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.super_admins
    WHERE user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_super_admin() IS 'RLS 輔助：目前登入者是否為平台 super_admins（以 SECURITY DEFINER 查表，不受 super_admins 上 RLS 影響）';

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO service_role;

ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_configs_deny_anon" ON public.system_configs;
CREATE POLICY "system_configs_deny_anon" ON public.system_configs
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "system_configs_super_select" ON public.system_configs;
CREATE POLICY "system_configs_super_select" ON public.system_configs
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "system_configs_super_insert" ON public.system_configs;
CREATE POLICY "system_configs_super_insert" ON public.system_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "system_configs_super_update" ON public.system_configs;
CREATE POLICY "system_configs_super_update" ON public.system_configs
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "system_configs_super_delete" ON public.system_configs;
CREATE POLICY "system_configs_super_delete" ON public.system_configs
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin());
