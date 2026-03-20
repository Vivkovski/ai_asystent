-- User-specific integration overrides (per tenant + per user + per type).
-- Tenant-level integrations are handled by public.integrations.

CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bitrix', 'google_drive', 'google_sheets')),
  display_name TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  credentials_encrypted TEXT,
  config JSONB DEFAULT '{}',
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_user_integrations_tenant_user ON public.user_integrations(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_type ON public.user_integrations(type);

ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;

-- User can CRUD only their own rows (and only for tenants they belong to).
CREATE POLICY user_integrations_select_own ON public.user_integrations
  FOR SELECT USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY user_integrations_insert_own ON public.user_integrations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY user_integrations_update_own ON public.user_integrations
  FOR UPDATE USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY user_integrations_delete_own ON public.user_integrations
  FOR DELETE USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Service role grants (Next.js API uses SUPABASE_KEY / service role).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_integrations TO service_role;

