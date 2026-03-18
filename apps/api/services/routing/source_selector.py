"""Intent -> source_ids, filtered by tenant enabled integrations."""

from supabase import create_client
from config import settings

INTENT_TO_SOURCES: dict[str, list[str]] = {
    "crm": ["bitrix"],
    "documents": ["google_drive"],
    "spreadsheets": ["google_sheets"],
    "mixed": ["bitrix", "google_drive", "google_sheets"],
}


def get_sources_for_intent(tenant_id: str, intent_label: str) -> list[str]:
    """
    Return ordered source_ids for this intent that the tenant has enabled.
    Empty if no enabled integration for any of the mapped sources.
    """
    source_ids = INTENT_TO_SOURCES.get(intent_label)
    if not source_ids:
        return []
    if not settings.supabase_url or not settings.supabase_key:
        return []
    client = create_client(settings.supabase_url, settings.supabase_key)
    r = (
        client.table("integrations")
        .select("type")
        .eq("tenant_id", tenant_id)
        .eq("enabled", True)
        .in_("type", source_ids)
        .execute()
    )
    enabled_types = {row["type"] for row in (r.data or [])}
    return [s for s in source_ids if s in enabled_types]
