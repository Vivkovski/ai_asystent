-- RLS: tenant isolation. All access filtered by auth.uid() and profile.tenant_id.
-- Requires: auth.uid() returns the authenticated user id (Supabase Auth).

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: user can read own row only
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Tenants: user can read tenant they belong to
CREATE POLICY tenants_select_member ON public.tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Integrations: tenant members can CRUD their tenant's integrations
CREATE POLICY integrations_select_tenant ON public.integrations
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY integrations_insert_tenant ON public.integrations
  FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY integrations_update_tenant ON public.integrations
  FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY integrations_delete_tenant ON public.integrations
  FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Conversations: user sees own conversations in their tenant
CREATE POLICY conversations_select_own ON public.conversations
  FOR SELECT USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY conversations_insert_own ON public.conversations
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY conversations_update_own ON public.conversations
  FOR UPDATE USING (
    user_id = auth.uid()
    AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );

-- Messages: via conversation ownership
CREATE POLICY messages_select_via_conversation ON public.messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = auth.uid()
        AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );
CREATE POLICY messages_insert_via_conversation ON public.messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = auth.uid()
        AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );
CREATE POLICY messages_update_via_conversation ON public.messages
  FOR UPDATE USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE user_id = auth.uid()
        AND tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Answer sources: via message → conversation ownership
CREATE POLICY answer_sources_select_via_message ON public.answer_sources
  FOR SELECT USING (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.user_id = auth.uid()
        AND c.tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );
CREATE POLICY answer_sources_insert_via_message ON public.answer_sources
  FOR INSERT WITH CHECK (
    message_id IN (
      SELECT m.id FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE c.user_id = auth.uid()
        AND c.tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- Audit logs: tenant members can read their tenant's audit (for admin)
CREATE POLICY audit_logs_select_tenant ON public.audit_logs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  );
-- Insert: service role or backend only (no policy = no direct user insert from anon)
-- API uses service role to append audit entries.
