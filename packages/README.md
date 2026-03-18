# packages

Shared packages used by the monorepo. See **docs/monorepo-structure.md** for full layout and boundaries.

| Package | Purpose |
|---------|---------|
| **shared** | Types, constants, small utilities for apps and connectors |
| **connectors** | Adapter implementations (Bitrix, Google Drive, Google Sheets) |
| **prompts** | Prompt templates and intent taxonomy (text/config) |

Dependency rule: **shared** has no internal package deps; **connectors** may use **shared**; **prompts** is standalone. Apps depend on these packages, not on each other.
