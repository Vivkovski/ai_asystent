# packages/shared

Shared types, constants, and small utilities used by **apps/web**, **apps/api**, and optionally **packages/connectors**.

**Contains:** API request/response shapes, intent keys, error types, and pure helpers. No app-specific logic, no DB/auth, no connector or LLM code.

**Must not:** Depend on any app or on `packages/connectors` / `packages/prompts`.

See **docs/monorepo-structure.md** for boundaries and dependency rules.
