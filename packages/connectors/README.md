# packages/connectors

Connector adapters for external systems: Bitrix, Google Drive, Google Sheets (and future connectors).

**Contains:** One adapter per system; each implements the same contract: `fetch(ConnectorInput) -> ConnectorOutput` (fragments + source metadata). Used only by **apps/api** via registry.

**May depend on:** `packages/shared` (e.g. for `Fragment`, `SourceMetadata`, `ConnectorInput`, `ConnectorOutput`).

**Must not:** Depend on apps or `packages/prompts`; contain orchestration or LLM logic.

**Design:** [docs/connector-framework.md](../docs/connector-framework.md) — architecture, contracts, config, secrets, normalization, errors, timeout, extensibility.  
**Bitrix:** [docs/connector-bitrix-design.md](../docs/connector-bitrix-design.md) — responsibility, operations, normalization, auth, setup flow, tests, file layout.  
**Boundaries:** docs/monorepo-structure.md.
