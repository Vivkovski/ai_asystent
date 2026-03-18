"""Append-only audit log. No full PII (e.g. no question/answer text)."""

from datetime import datetime, timezone
from typing import Any

from domain.integrations import _client


def log(
    tenant_id: str,
    user_id: str | None,
    action: str,
    resource_type: str | None = None,
    resource_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Append one audit entry. Never log credentials or full request/response bodies."""
    client = _client()
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    row = {
        "tenant_id": tenant_id,
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "metadata": metadata or {},
    }
    client.table("audit_logs").insert(row).execute()
