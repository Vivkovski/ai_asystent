#!/usr/bin/env python3
"""
Create default admin user in Supabase Auth and seed tenant + profile (tenant_admin).
User: admin@example.com / admin1234 (log in with this email and password).
Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
Usage: From repo root, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run:
  uv run python scripts/seed_admin_user.py
  (or: python scripts/seed_admin_user.py with a venv that has supabase)

Optional: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD to create a different admin (default: admin@example.com / admin1234).
"""
import os
import sys

ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "admin@example.com")
ADMIN_PASSWORD = os.environ.get("SEED_ADMIN_PASSWORD", "admin1234")
TENANT_ID = "00000000-0000-0000-0000-000000000001"


def main() -> None:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY")
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)", file=sys.stderr)
        sys.exit(1)

    from supabase import create_client
    client = create_client(url, key)

    user_id = None
    try:
        r = client.auth.admin.create_user({
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD,
            "email_confirm": True,
            "user_metadata": {"name": "Admin"},
        })
        if hasattr(r, "user") and r.user:
            user_id = getattr(r.user, "id", None)
        if not user_id and hasattr(r, "model_dump"):
            user_id = (r.model_dump().get("user") or {}).get("id")
        if user_id:
            print("Created admin user:", ADMIN_EMAIL, "id:", user_id)
    except Exception as e:
        err_str = str(e).lower()
        if "already" in err_str or "exists" in err_str or "duplicate" in err_str:
            ul = client.auth.admin.list_users()
            data = ul.model_dump() if hasattr(ul, "model_dump") else getattr(ul, "json", lambda: {})()
            for u in (data.get("users") or []):
                ud = u if isinstance(u, dict) else (getattr(u, "model_dump", lambda: {})() or {})
                if ud.get("email") == ADMIN_EMAIL:
                    user_id = ud.get("id") or getattr(u, "id", None)
                    break
            if user_id:
                print("User already exists, using existing user id:", user_id)
            else:
                print("User already exists but could not get id. Delete user in Supabase Dashboard (Auth → Users) and re-run, or set SEED_USER_ID and run scripts/seed_tenant.py", file=sys.stderr)
                sys.exit(1)
        else:
            raise

    if not user_id:
        print("Could not get user id from create_user response", file=sys.stderr)
        sys.exit(1)

    # Seed tenant
    client.table("tenants").upsert(
        {"id": TENANT_ID, "name": "Demo Tenant", "slug": "demo", "settings": {}},
        on_conflict="id",
    ).execute()
    print("Tenant upserted:", TENANT_ID)

    # Seed profile (tenant_admin)
    client.table("profiles").upsert(
        {"id": user_id, "tenant_id": TENANT_ID, "role": "tenant_admin"},
        on_conflict="id",
    ).execute()
    print("Profile upserted for user:", user_id, "role=tenant_admin")

    print("Done. Log in with email:", ADMIN_EMAIL, "password:", ADMIN_PASSWORD)


if __name__ == "__main__":
    main()
