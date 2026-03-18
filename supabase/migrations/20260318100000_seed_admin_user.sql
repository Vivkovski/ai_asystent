-- Seed default admin user (admin@example.com / admin1234) + Demo Tenant + profile (tenant_admin).
-- Run in Supabase SQL Editor or: supabase db push (after this migration is applied).
-- Login in app: email = admin@example.com, password = admin1234.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_admin_id UUID := 'a0000001-0000-0000-0000-000000000001';
  v_encrypted_pw TEXT := crypt('admin1234', gen_salt('bf'));
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- 1. Insert admin into auth.users (skip if already exists)
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    v_admin_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@example.com',
    v_encrypted_pw,
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name": "Admin"}',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- GoTrue requires token columns to be '' not NULL (else "Database error querying schema" on login)
  UPDATE auth.users
  SET
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, '')
  WHERE id = v_admin_id;

  -- 2. Link identity so the user can log in (skip if already exists)
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    v_admin_id,
    v_admin_id,
    format('{"sub": "%s", "email": "admin@example.com"}', v_admin_id)::jsonb,
    'email',
    v_admin_id::text,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3. Tenant Demo
  INSERT INTO public.tenants (id, name, slug, settings)
  VALUES (v_tenant_id, 'Demo Tenant', 'demo', '{}')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Profile: admin user -> tenant_admin
  INSERT INTO public.profiles (id, tenant_id, role)
  VALUES (v_admin_id, v_tenant_id, 'tenant_admin')
  ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role;
END $$;
