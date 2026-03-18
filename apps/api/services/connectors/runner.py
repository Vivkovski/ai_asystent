"""Parallel connector invocation with timeout and limits."""

import asyncio

from services.connectors.contract import (
    ConnectorInput,
    ConnectorOutput,
    ConnectorLimits,
    SourceMetadata,
)
from services.connectors.registry import get_adapter
from domain.integrations import load_config


def _error_metadata(source_id: str) -> SourceMetadata:
    return SourceMetadata(source_id=source_id, type="unknown", title=source_id, link=None)


async def fetch_one(
    source_id: str,
    tenant_id: str,
    query_text: str,
    limits: ConnectorLimits,
) -> ConnectorOutput:
    """Load config, get adapter, call fetch with timeout. Return output or error placeholder."""
    adapter = get_adapter(source_id)
    if not adapter:
        return ConnectorOutput(
            success=False,
            fragments=[],
            source_metadata=_error_metadata(source_id),
            error="Adapter not found",
        )
    config = load_config(tenant_id, source_id)
    if not config:
        return ConnectorOutput(
            success=False,
            fragments=[],
            source_metadata=_error_metadata(source_id),
            error="Integration not configured or disabled",
        )
    input_ = ConnectorInput(query_text=query_text, config=config, limits=limits)
    try:
        return await asyncio.wait_for(
            adapter.fetch(input_),
            timeout=float(limits.timeout_seconds),
        )
    except asyncio.TimeoutError:
        return ConnectorOutput(
            success=False,
            fragments=[],
            source_metadata=_error_metadata(source_id),
            error="Timeout",
        )
    except Exception as e:
        return ConnectorOutput(
            success=False,
            fragments=[],
            source_metadata=_error_metadata(source_id),
            error=str(e)[:200],
        )


async def fetch_all(
    source_ids: list[str],
    tenant_id: str,
    query_text: str,
    limits: ConnectorLimits | None = None,
) -> list[ConnectorOutput]:
    """Call all sources in parallel; return outputs in same order as source_ids."""
    limits = limits or ConnectorLimits()
    tasks = [fetch_one(sid, tenant_id, query_text, limits) for sid in source_ids]
    return list(await asyncio.gather(*tasks))
