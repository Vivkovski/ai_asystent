# packages/prompts

Prompt templates and intent taxonomy as versioned assets (text or structured config).

**Contains:** System prompts for intent classification and answer synthesis; optional intent taxonomy (e.g. YAML/JSON). Loaded by **apps/api** at runtime.

**Must not:** Depend on apps or other packages; contain application code. This package is text/config only.

See **docs/monorepo-structure.md** for boundaries and dependency rules.
