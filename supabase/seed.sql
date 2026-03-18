-- Seed: one tenant and one profile (tenant_admin).
-- Run after: 1) Supabase Auth has at least one user, 2) Replace :user_id with that user's UUID.
-- Example: create user in Supabase Dashboard (Authentication → Users) then:
--   psql ... -v user_id='<uuid>' -f seed.sql
-- Or use scripts/seed_tenant.py with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_ID.

INSERT INTO public.tenants (id, name, slug, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Demo Tenant',
  'demo',
  '{}'
)
ON CONFLICT (id) DO NOTHING;

-- Uncomment and set user_id when you have a user in auth.users:
-- INSERT INTO public.profiles (id, tenant_id, role)
-- VALUES (
--   :'user_id',
--   '00000000-0000-0000-0000-000000000001',
--   'tenant_admin'
-- )
-- ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role;
