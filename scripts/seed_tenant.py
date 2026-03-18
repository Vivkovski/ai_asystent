#!/usr/bin/env python3
"""
Create one tenant and one profile (tenant_admin) for a given Supabase user.
Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_USER_ID (auth.users id).
Usage: cd apps/api && uv run python ../../scripts/seed_tenant.py
"""
import os
import sys

def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    user_id = os.environ.get("SEED_USER_ID")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)
    if not user_id:
        print("Set SEED_USER_ID (UUID of the user from Supabase Auth)", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    client = create_client(url, key)

    tenant_id = "00000000-0000-0000-0000-000000000001"
    r = client.table("tenants").upsert(
        {"id": tenant_id, "name": "Demo Tenant", "slug": "demo", "settings": {}},
        on_conflict="id",
    ).execute()
    print("Tenant upserted:", tenant_id)

    r = client.table("profiles").upsert(
        {"id": user_id, "tenant_id": tenant_id, "role": "tenant_admin"},
        on_conflict="id",
    ).execute()
    print("Profile upserted for user:", user_id, "role=tenant_admin")

if __name__ == "__main__":
    main()
