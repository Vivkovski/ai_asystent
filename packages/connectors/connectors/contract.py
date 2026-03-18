"""Connector I/O types. Used by adapters and by apps/api runner."""

from typing import Any

from pydantic import BaseModel


class Fragment(BaseModel):
    content: str
    metadata: dict[str, Any] | None = None


class SourceMetadata(BaseModel):
    source_id: str
    type: str
    title: str
    link: str | None = None


class ConnectorOutput(BaseModel):
    success: bool
    fragments: list[Fragment]
    source_metadata: SourceMetadata
    error: str | None = None


class ConnectorLimits(BaseModel):
    max_fragments_per_source: int = 20
    max_total_fragments: int = 50
    timeout_seconds: int = 30


class ConnectorInput(BaseModel):
    query_text: str
    config: dict[str, Any]
    limits: ConnectorLimits = ConnectorLimits()
