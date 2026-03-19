-- Next.js API uses SUPABASE_KEY (service_role). Explicit grants so PostgREST can
-- INSERT/SELECT/UPDATE rows; without this, inserts can fail with empty/generic errors
-- depending on project defaults (profiles already had SELECT in 20260319000000).

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answer_sources TO service_role;
GRANT SELECT, INSERT ON public.audit_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integrations TO service_role;
GRANT SELECT ON public.tenants TO service_role;
