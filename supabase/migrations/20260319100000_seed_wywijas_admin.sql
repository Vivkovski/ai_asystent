-- Seed admin user wywijas.p@gmail.com / admin1234 + profile (tenant_admin).
-- Demo Tenant must exist (from 20260318100000_seed_admin_user.sql or seed).
-- Log in: email = wywijas.p@gmail.com, password = admin1234.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id UUID := 'a0000002-0000-0000-0000-000000000002';
  v_encrypted_pw TEXT := crypt('admin1234', gen_salt('bf'));
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- 1. Insert user into auth.users (skip if already exists)
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
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'wywijas.p@gmail.com',
    v_encrypted_pw,
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name": "wywijas.p"}',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- GoTrue: token columns must be '' not NULL
  UPDATE auth.users
  SET
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, '')
  WHERE id = v_user_id;

  -- 2. Identity for email login
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
    v_user_id,
    v_user_id,
    format('{"sub": "%s", "email": "wywijas.p@gmail.com"}', v_user_id)::jsonb,
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3. Tenant (if not exists)
  INSERT INTO public.tenants (id, name, slug, settings)
  VALUES (v_tenant_id, 'Demo Tenant', 'demo', '{}')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Profile: tenant_admin
  INSERT INTO public.profiles (id, tenant_id, role)
  VALUES (v_user_id, v_tenant_id, 'tenant_admin')
  ON CONFLICT (id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, role = EXCLUDED.role;
END $$;
