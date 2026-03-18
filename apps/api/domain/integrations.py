"""Integrations: load config for runner; list/create/update for admin. Never return raw credentials."""

import json
from datetime import datetime, timezone
from typing import Any

from config import settings
from core.secrets import decrypt, encrypt
from supabase import create_client
from services.connectors.registry import get_adapter


def _client():
    if not settings.supabase_url or not settings.supabase_key:
        raise ValueError("Supabase not configured")
    return create_client(settings.supabase_url, settings.supabase_key)


def load_config(tenant_id: str, source_id: str) -> dict | None:
    """
    Load integration row for tenant + source_id. Decrypt credentials, return config dict.
    Return None if not found or disabled. Never log or return raw credentials.
    """
    if not settings.supabase_url or not settings.supabase_key:
        return None
    client = _client()
    r = (
        client.table("integrations")
        .select("credentials_encrypted, config, enabled")
        .eq("tenant_id", tenant_id)
        .eq("type", source_id)
        .maybe_single()
        .execute()
    )
    if not r.data or not r.data.get("enabled", True):
        return None
    creds_enc = r.data.get("credentials_encrypted")
    config = dict(r.data.get("config") or {})
    if creds_enc:
        try:
            from json import loads
            config["_credentials"] = loads(decrypt(creds_enc))
        except (ValueError, Exception):
            return None
    return config


# --- Admin: list, create, update (tenant-scoped) ---

def list_integrations(tenant_id: str) -> list[dict[str, Any]]:
    """List integrations for tenant. No credentials in response."""
    client = _client()
    r = (
        client.table("integrations")
        .select("id, type, display_name, enabled, last_tested_at, last_error, created_at, updated_at")
        .eq("tenant_id", tenant_id)
        .order("type")
        .execute()
    )
    def _serialize(row: dict) -> dict:
        d = dict(row)
        for k, v in list(d.items()):
            if hasattr(v, "isoformat"):
                d[k] = v.isoformat() if v else None
            elif hasattr(v, "hex"):
                d[k] = str(v)
        return d
    return [_serialize(row) for row in (r.data or [])]


def create_integration(
    tenant_id: str,
    type: str,
    credentials: dict[str, Any],
    display_name: str | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Test connection, encrypt credentials, insert. Return (row, None) on success or (None, error_message).
    """
    if type not in ("bitrix", "google_drive", "google_sheets"):
        return None, "Invalid type"
    adapter = get_adapter(type)
    if not adapter:
        return None, "Connector not available"
    config = {"_credentials": credentials}
    ok, err = adapter.test_connection(config)
    if not ok:
        return None, err or "Test failed"
    try:
        credentials_encrypted = encrypt(json.dumps(credentials))
    except Exception as e:
        return None, "Encryption failed"
    client = _client()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    row = {
        "tenant_id": tenant_id,
        "type": type,
        "display_name": display_name or type,
        "enabled": True,
        "credentials_encrypted": credentials_encrypted,
        "config": {},
        "last_tested_at": now,
        "last_error": None,
        "updated_at": now,
    }
    r = client.table("integrations").insert(row).execute()
    if not r.data or len(r.data) != 1:
        return None, "Insert failed"
    out = dict(r.data[0])
    out.pop("credentials_encrypted", None)
    out.pop("config", None)
    for k, v in list(out.items()):
        if hasattr(v, "isoformat"):
            out[k] = v.isoformat() if v else None
        elif hasattr(v, "hex"):
            out[k] = str(v)
    return out, None


def update_integration(
    tenant_id: str,
    integration_id: str,
    *,
    credentials: dict[str, Any] | None = None,
    enabled: bool | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Update credentials (re-auth) and/or enabled. If credentials provided, test first then save.
    Return (updated_row, None) or (None, error_message).
    """
    client = _client()
    r = (
        client.table("integrations")
        .select("id, type")
        .eq("id", integration_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    if not r.data:
        return None, "Not found"
    row_type = r.data["type"]
    updates: dict[str, Any] = {}

    if credentials is not None:
        adapter = get_adapter(row_type)
        if not adapter:
            return None, "Connector not available"
        config = {"_credentials": credentials}
        ok, err = adapter.test_connection(config)
        if not ok:
            return None, err or "Test failed"
        try:
            updates["credentials_encrypted"] = encrypt(json.dumps(credentials))
        except Exception:
            return None, "Encryption failed"
        updates["last_tested_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        updates["last_error"] = None

    if enabled is not None:
        updates["enabled"] = enabled

    if not updates:
        return None, "Nothing to update"
    updates["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    r2 = (
        client.table("integrations")
        .update(updates)
        .eq("id", integration_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not r2.data or len(r2.data) != 1:
        return None, "Update failed"
    out = dict(r2.data[0])
    out.pop("credentials_encrypted", None)
    out.pop("config", None)
    return out, None


def get_integration(tenant_id: str, integration_id: str) -> dict[str, Any] | None:
    """Get one integration (no credentials)."""
    client = _client()
    r = (
        client.table("integrations")
        .select("id, type, display_name, enabled, last_tested_at, last_error, created_at, updated_at")
        .eq("id", integration_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    return dict(r.data) if r.data else None
