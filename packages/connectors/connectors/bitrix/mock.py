"""Mock Bitrix adapter for development and tests. Returns fixed fragments."""

from connectors.contract import (
    ConnectorInput,
    ConnectorOutput,
    Fragment,
    SourceMetadata,
)


class MockBitrixAdapter:
    async def fetch(self, input: ConnectorInput) -> ConnectorOutput:
        n = min(3, input.limits.max_fragments_per_source)
        fragments = [
            Fragment(content=f"Mock Bitrix fragment {i+1} for: {input.query_text[:50]}...")
            for i in range(n)
        ]
        return ConnectorOutput(
            success=True,
            fragments=fragments,
            source_metadata=SourceMetadata(
                source_id="bitrix",
                type="crm",
                title="Bitrix (mock)",
                link=None,
            ),
            error=None,
        )

    def test_connection(self, config: dict) -> tuple[bool, str | None]:
        return True, None
