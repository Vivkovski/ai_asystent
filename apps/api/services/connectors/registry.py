"""Adapter registry: source_id -> adapter instance. No connector-specific logic here."""

from typing import Protocol

from .contract import ConnectorInput, ConnectorOutput


class ConnectorAdapter(Protocol):
    """Adapter interface: fetch(input) -> output. Optional test_connection for admin."""

    async def fetch(self, input: ConnectorInput) -> ConnectorOutput:
        ...

    def test_connection(self, config: dict) -> tuple[bool, str | None]:
        """Return (success, error_message). Used by admin before save."""
        ...


_adapters: dict[str, ConnectorAdapter] = {}


def register(source_id: str, adapter: ConnectorAdapter) -> None:
    _adapters[source_id] = adapter


def get_adapter(source_id: str) -> ConnectorAdapter | None:
    return _adapters.get(source_id)


def register_adapters() -> None:
    """Register all adapters (call at app startup)."""
    from services.connectors.mock_bitrix import MockBitrixAdapter
    from services.connectors.google_drive import GoogleDriveAdapter

    register("bitrix", MockBitrixAdapter())
    register("google_drive", GoogleDriveAdapter())
