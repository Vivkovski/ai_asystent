# Architecture principles

Short list of non‑negotiable principles. Use them to decide design and code changes.

---

- **Do not overengineer.** Prefer the simplest solution that fits. Avoid speculative abstraction and “we might need it later” features. Ship MVP first.

- **Do not introduce extra tools or frameworks unless clearly justified.** Every new dependency or service must have a stated reason. Prefer existing stack (Next.js, FastAPI, Supabase, Claude). No n8n or external workflow engines.

- **Keep the architecture explicit, modular, and practical.** Clear boundaries between modules; one concern per area. Orchestration, routing, connectors, and LLM are separate. Prefer testable units over monoliths.

- **Respect monorepo boundaries.** `apps/web` does not import from `apps/api` or from `packages/connectors` / `packages/prompts`. `apps/api` does not import from `apps/web`. Shared types live in `packages/shared`. Connectors live in `packages/connectors` and are used only by the backend.

- **Do not mix connector-specific logic into shared orchestration.** Orchestration knows only `source_id`, `ConnectorInput`, and `ConnectorOutput`. No Bitrix/Drive/Sheets branches or types in the orchestration layer. Adapter details stay inside each connector.

- **Do not search all sources by default.** Never fall back to “query every enabled integration” when intent is unclear or source selection is empty. Empty selection → refuse answer with a clear message.

- **Prefer routing-first and selective querying.** Flow is: classify intent → select sources for that intent → query only those sources → compose answer. Design and code must preserve this order. No path that skips intent or source selection.

---

**Reference:** Broader context in `.cursor/rules/` (product-context, engineering-principles, monorepo-boundaries, ai-orchestration-source-routing). Technical detail in docs/technical-blueprint.md and docs/connector-framework.md.
