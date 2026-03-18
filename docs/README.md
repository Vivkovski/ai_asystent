# docs

Project documentation.

- **architecture-principles.md** — Non‑negotiable principles: no overengineering, no extra tools without justification, explicit/modular architecture, monorepo boundaries, no connector logic in orchestration, no search-all, routing-first and selective querying.

- **architecture-and-product-brief.md** — Product goal, system architecture, flow, multi-tenant, integrations.
- **recommended-next-steps.md** — Recommended order of work after foundation.
- **monorepo-structure.md** — Monorepo layout, directory responsibilities, boundaries, and folder creation order.
- **technical-blueprint.md** — Full technical specification: architecture, modules, E2E flow, data/tenant/user/integration/connector/routing/orchestration/chat/audit/live-vs-indexed/deployment models, risks, MVP simplifications, and out-of-scope.
- **mvp-backlog.md** — MVP backlog by phase (foundation → auth → admin → connector framework → routing → orchestration → first connectors → observability → QA), with title, description, why it matters, dependencies, priority, MVP/later, risk level, and recommended implementation order.
- **backend-architecture.md** — Backend (apps/api) breakdown: modules, responsibilities, directory structure, entities/DTOs, endpoints, domain services, connector contracts, orchestration services, env vars, and mocks for testability.
- **frontend-architecture.md** — Frontend (apps/web) breakdown: auth flow, tenant/workspace context, integrations list, integration setup, source roles, chat screen, chat history, answer with source provenance, audit view; for each: purpose, key screens, states, API dependencies, UX recommendations.
- **connector-framework.md** — Connector framework design: architecture, MVP connector types, common interfaces, per-tenant config, secret storage, data normalization, health checks, error handling, retries/timeout/rate limits, extensibility.
- **connector-bitrix-design.md** — Bitrix CRM connector design: responsibility, shared contract, MVP operations, normalization model, auth/secret storage, retry/timeout/pagination/rate limit, partial failures, admin setup flow, test strategy, file structure.
- **chat-orchestration-design.md** — Chat orchestration layer: intent classification, source selection, query planning, retrieval execution, answer composition, provenance/citations, fallback, audit, prompt architecture, LLM abstraction; end-to-end flow. Routing-first, no query-all.
- **qa-architecture-review.md** — QA/architecture review: top risks, likely failure modes, what is missing, what to test first, MVP acceptance checklist, recommendations before implementation. Critical and practical.
- **documentation-proposal.md** — Propozycja zestawu dokumentów wejściowych: README, architecture overview, ADR list, connector development guide, environment setup guide, MVP scope summary; spis, struktura każdego, kolejność lektury. Bez pełnej treści.
- **linear-backlog.md** — Backlog do Linear: 8 epików, issues z title, description, why it matters, acceptance criteria, dependencies, priority, team area; rekomendowana kolejność realizacji. Gotowe do importu.

**Linear (projekt FlixHome Asystent):** Taski z backlogu są zsynchronizowane z projektem w Linearze (epiki = milestone, issue’y HOU-5…). Po zaimplementowaniu taska status w Linearze można ustawić na Done (np. przez MCP `save_issue`). Kolejność realizacji: Foundation → Auth → Connector framework → Admin → Orchestration → Chat UI → First connectors → Observability & QA.
