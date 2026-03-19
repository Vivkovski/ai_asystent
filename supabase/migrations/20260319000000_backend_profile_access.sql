-- Backend (Next.js API) uses service_role key to load profile by user id for JWT validation.
-- Without this, PostgREST can return 403 (42501) when RLS is enabled and role lacks explicit grant.
GRANT SELECT ON public.profiles TO service_role;
