# MVP Backlog — AI Assistant platform

Backlog grouped by phase. For each item: title, description, why it matters, dependencies, priority, MVP vs later, risk level. No implementation code here.

**Stack:** Next.js, FastAPI, Supabase, Claude. **Scope:** Multi-tenant core, admin panel for integrations, end-user chat, routing-first, selective querying, first connectors Bitrix / Google Drive / Google Sheets.

---

## Phase 1 — Foundation

### F1. Monorepo and workspace setup

**Title:** Monorepo and workspace setup  
**Description:** Initialize monorepo with apps/web (Next.js), apps/api (FastAPI), packages/shared, packages/connectors, packages/prompts. Configure workspace/package manager (e.g. pnpm workspaces or Turborepo), root scripts (install, build, dev), and path aliases so apps can depend on packages.  
**Why it matters:** All other work assumes a single codebase with clear app/package boundaries.  
**Dependencies:** None.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### F2. Shared types and constants package

**Title:** Shared types and constants package  
**Description:** Define packages/shared with API request/response shapes (e.g. AskRequest, AskResponse, SourceItem), intent keys, fragment and source metadata types, and error codes. No runtime logic beyond types; consumable by apps/web, apps/api, and packages/connectors.  
**Why it matters:** Single contract for API and connectors; avoids drift between frontend and backend.  
**Dependencies:** F1.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### F3. Prompts and intent taxonomy package

**Title:** Prompts and intent taxonomy package  
**Description:** Add packages/prompts with text/config only: intent taxonomy (e.g. crm, documents, spreadsheets, mixed), system prompt for intent classification, system prompt for answer synthesis. Format: plain text or YAML/JSON; loadable by API at runtime.  
**Why it matters:** Routing and orchestration depend on a fixed taxonomy and reusable prompts; versioned in repo.  
**Dependencies:** F1.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### F4. Supabase project and schema skeleton

**Title:** Supabase project and schema skeleton  
**Description:** Create Supabase project (or use existing). Add schema skeleton: tenants, profiles/tenant_members (user–tenant–role), integrations, conversations, messages, answer_sources, audit_logs. No RLS or triggers yet; schema only.  
**Why it matters:** Auth and tenant model, chat, and admin features need known tables and relationships.  
**Dependencies:** F1.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

## Phase 2 — Auth and tenant model

### A1. Supabase Auth and JWT validation in API

**Title:** Supabase Auth and JWT validation in API  
**Description:** Configure Supabase Auth (email/password). In FastAPI, add middleware or dependency that validates JWT, extracts user id, and loads tenant_id and role from profiles/tenant_members. Return 401 when invalid or missing.  
**Why it matters:** Every protected endpoint needs a resolved user and tenant; foundation for multi-tenant isolation.  
**Dependencies:** F4.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium (auth bugs can lock users out or leak context).

---

### A2. Tenant and profile seeding / creation path

**Title:** Tenant and profile seeding / creation path  
**Description:** Define how a tenant and first user (tenant_admin) are created: e.g. seed script, invite flow, or minimal admin-only API. Ensure every user has tenant_id and role (end_user | tenant_admin) in DB.  
**Why it matters:** Without tenants and profiles, multi-tenant app cannot resolve context; needed for local dev and first deployments.  
**Dependencies:** F4, A1.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### A3. RLS and tenant isolation

**Title:** RLS and tenant isolation  
**Description:** Implement Row Level Security (or equivalent tenant scoping) so that all reads/writes are filtered by tenant_id from the authenticated context. Apply to tenants, integrations, conversations, messages, answer_sources, audit_logs.  
**Why it matters:** Prevents cross-tenant data access and enforces multi-tenant security.  
**Dependencies:** A1, A2.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** High (missing RLS can leak data across tenants).

---

### A4. Next.js auth and session

**Title:** Next.js auth and session  
**Description:** In apps/web, integrate Supabase client for sign-in/sign-up/sign-out; store session; send JWT (or session token) on every API request (e.g. Authorization header). Protect routes so unauthenticated users are redirected to login.  
**Why it matters:** Users and admins must authenticate before using chat or admin panel; API expects valid token.  
**Dependencies:** A1.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium.

---

## Phase 3 — Admin panel

### B1. Admin layout and role guard

**Title:** Admin layout and role guard  
**Description:** Add admin area in Next.js (e.g. /admin) with layout and navigation. Guard so only users with role tenant_admin can access; others get 403 or redirect. Resolve tenant from session so admin sees only their tenant.  
**Why it matters:** Admin panel must be tenant-scoped and role-protected from day one.  
**Dependencies:** A4.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### B2. Integrations list and status API

**Title:** Integrations list and status API  
**Description:** Backend: GET /admin/integrations returning list of integrations for the tenant (id, type, display_name, enabled, last_tested_at, last_error). No credentials in response. Frontend: page listing integrations with status (connected / error / not configured).  
**Why it matters:** Tenant admin needs to see which connectors are connected and what’s broken before adding or re-authenticating.  
**Dependencies:** A3, F4 (integrations table).  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### B3. Add integration flow (OAuth or API key)

**Title:** Add integration flow (OAuth or API key)  
**Description:** Backend: POST /admin/integrations with type (bitrix | google_drive | google_sheets) and credentials (OAuth tokens or API key). Encrypt and store in DB; run “test connection” before saving; return error if test fails. Frontend: form per connector type (OAuth redirect + callback, or API key input), call API, show success or error.  
**Why it matters:** Tenants must be able to connect their Bitrix, Drive, and Sheets; encrypted storage and test-before-save reduce misconfiguration and risk.  
**Dependencies:** B1, B2, connector framework for “test” (C1).  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium (OAuth flows and credential handling).

---

### B4. Re-auth and disable integration

**Title:** Re-auth and disable integration  
**Description:** Backend: endpoint to trigger re-auth (e.g. return OAuth URL or accept new credentials) and endpoint to disable/delete integration. Frontend: “Reconnect” and “Disable” actions on integration row; re-auth opens OAuth flow and updates stored credentials after callback.  
**Why it matters:** Tokens expire; admins need to reconnect or turn off a connector without deleting the tenant.  
**Dependencies:** B3.  
**Priority:** P1.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

## Phase 4 — Connector framework

### C1. Connector contract and registry

**Title:** Connector contract and registry  
**Description:** Define unified connector interface in code: input (query_text, tenant_config, limits), output (fragments, source_metadata, error). Implement a registry in apps/api that, given source_id (e.g. bitrix), returns the adapter instance. Adapters live in packages/connectors and implement the same interface.  
**Why it matters:** Orchestration and admin “test connection” depend on a single contract and a way to resolve connector by type.  
**Dependencies:** F2.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### C2. Connector config resolution and secret loading

**Title:** Connector config resolution and secret loading  
**Description:** From tenant_id and integration type, load integration row (credentials_encrypted, config jsonb). Decrypt credentials using env key; pass config + credentials to connector adapter. Never log or return credentials. Handle “integration not found” or “disabled” cleanly.  
**Why it matters:** Connectors need tenant-specific credentials at runtime; secure loading is required for admin test and for orchestration.  
**Dependencies:** C1, F4 (integrations), secret storage strategy.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** High (secret handling).

---

### C3. Limits and timeout enforcement

**Title:** Limits and timeout enforcement  
**Description:** Apply limits in orchestration when calling connectors: max_fragments_per_source (e.g. 20), max_total_fragments (e.g. 50), timeout_seconds (e.g. 30) per connector. If adapter does not enforce timeout, wrap call in a timeout at orchestration layer.  
**Why it matters:** Prevents runaway latency and token overflow; aligns with connector contract.  
**Dependencies:** C1.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

## Phase 5 — Source routing

### R1. Intent classification with LLM

**Title:** Intent classification with LLM  
**Description:** Load intent prompt from packages/prompts. Call Claude with user question and prompt; parse response to get single intent label (crm | documents | spreadsheets | mixed). Handle API errors and malformed output (fallback to “mixed” or refuse).  
**Why it matters:** Routing-first behaviour depends on reliable intent; first step before source selection.  
**Dependencies:** F3, Claude API key, LLM client in API.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium (LLM availability and prompt stability).

---

### R2. Intent-to-source mapping and tenant filter

**Title:** Intent-to-source mapping and tenant filter  
**Description:** Maintain platform mapping: intent → list of source ids (e.g. crm → [bitrix], documents → [google_drive], mixed → [bitrix, google_drive, google_sheets]). Given intent, resolve source ids; then filter by tenant’s enabled integrations. Return ordered list of source ids to query. If empty, return “no sources” and do not call connectors.  
**Why it matters:** Selective querying: only chosen sources are called; tenant cannot get data from connectors they did not enable.  
**Dependencies:** F4 (integrations.enabled), R1.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### R3. Parallel connector invocation

**Title:** Parallel connector invocation  
**Description:** Given list of source ids, for each load connector config (C2), get adapter from registry (C1), call adapter with query and limits (C3) in parallel (e.g. asyncio.gather or equivalent). Collect results (fragments + metadata per source) and errors. Do not fail entire request if one connector fails; record which source failed for partial answer.  
**Why it matters:** Multi-source questions need parallel fetch; partial failure must not block the rest.  
**Dependencies:** C1, C2, C3.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium (concurrency and error handling).

---

## Phase 6 — Chat orchestration

### O1. LLM client and synthesis prompt

**Title:** LLM client and synthesis prompt  
**Description:** Implement Claude client in apps/api (or thin wrapper). Load synthesis prompt from packages/prompts. Given user question and concatenated fragments (with source labels [1], [2]), call Claude to produce answer text with citations. Parse response to extract source indices and build sources[] for response.  
**Why it matters:** Answer quality and source provenance depend on a clear prompt and parsing.  
**Dependencies:** F3, Claude API key.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium (prompt and parsing robustness).

---

### O2. Orchestration pipeline (ask endpoint)

**Title:** Orchestration pipeline (ask endpoint)  
**Description:** Single endpoint (e.g. POST /conversations/{id}/messages or POST /ask): auth → load/create conversation → intent (R1) → source selection (R2) → parallel fetch (R3) → synthesis (O1) → persist message and answer_sources → append audit → return answer + sources. Handle “no sources” and partial failure; set message status (completed | partial | failed).  
**Why it matters:** End-to-end flow that ties routing, connectors, and LLM into one user-facing request.  
**Dependencies:** A1, R1, R2, R3, O1, F4 (conversations, messages, answer_sources).  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** High (complex pipeline; failures must be clear).

---

### O3. Conversations and messages persistence

**Title:** Conversations and messages persistence  
**Description:** Create conversation (tenant_id, user_id); append messages (role, content, status). For assistant messages, persist answer_sources (message_id, source metadata, link). List conversations and messages for authenticated user; enforce tenant and ownership.  
**Why it matters:** Chat history and provenance require stable conversation and message model.  
**Dependencies:** F4, A3.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### O4. Chat UI (conversation + ask + display)

**Title:** Chat UI (conversation + ask + display)  
**Description:** In apps/web: conversation list or single thread view; input for question; submit to ask endpoint; show loading state; render answer text with inline citations [1],[2] and list of sources (title, link) at end. Show “no sources” or “source X unavailable” when applicable. No streaming in MVP.  
**Why it matters:** End users interact only through this UI; must reflect API contract and status.  
**Dependencies:** A4, O2, F2 (types for API client).  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

## Phase 7 — First connectors

### D1. Bitrix connector

**Title:** Bitrix connector  
**Description:** Implement Bitrix adapter in packages/connectors: auth (API key or OAuth per tenant config), call Bitrix API to search/fetch relevant entities (e.g. deals, contacts, activities) based on query; return fragments and source_metadata (title, link to Bitrix). Respect limits and timeout; return partial + error on failure.  
**Why it matters:** First CRM source; validates connector contract and admin flow.  
**Dependencies:** C1, C2, C3.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium (external API stability and auth).

---

### D2. Google Drive connector

**Title:** Google Drive connector  
**Description:** Implement Google Drive adapter: OAuth per tenant; search/list files and optionally extract text (e.g. for documents); return fragments and source_metadata (file name, link). Respect limits and timeout; return partial + error on failure.  
**Why it matters:** Covers “documents” intent; validates OAuth and Drive API usage.  
**Dependencies:** C1, C2, C3.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium (OAuth and Drive API).

---

### D3. Google Sheets connector

**Title:** Google Sheets connector  
**Description:** Implement Google Sheets adapter: OAuth per tenant; list spreadsheets or ranges, read cell data; return fragments and source_metadata (sheet name, link). Respect limits and timeout; return partial + error on failure.  
**Why it matters:** Covers “spreadsheets” intent; completes first set of connectors.  
**Dependencies:** C1, C2, C3.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium (OAuth and Sheets API).

---

## Phase 8 — Observability / audit / logs

### L1. Audit log write on key actions

**Title:** Audit log write on key actions  
**Description:** Append to audit_logs on: message_created (with message_id, sources_used in metadata), integration_connected, integration_disabled. Do not store full question/answer text; use resource_type and resource_id. Include tenant_id, user_id, timestamp.  
**Why it matters:** Traceability for support and compliance without storing PII in audit.  
**Dependencies:** F4 (audit_logs), O2, B3, B4.  
**Priority:** P1.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### L2. Structured logging and request id

**Title:** Structured logging and request id  
**Description:** Add request_id (or correlation_id) to each API request; log at entry and on errors with request_id, tenant_id, user_id (no secrets, no full bodies). Use structured format (e.g. JSON) for log aggregation.  
**Why it matters:** Debugging and incident response without leaking sensitive data.  
**Dependencies:** None (can be done early).  
**Priority:** P1.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### L3. Optional audit list in admin

**Title:** Optional audit list in admin  
**Description:** Simple admin page or section: list recent audit_logs for the tenant (action, user, resource, timestamp). No export or advanced filters in MVP.  
**Why it matters:** Tenant admin can see “who did what” for basic oversight.  
**Dependencies:** L1, B1.  
**Priority:** P2.  
**MVP or later:** MVP (optional).  
**Risk level:** Low.

---

## Phase 9 — Basic QA and hardening

### Q1. Error handling and user-facing messages

**Title:** Error handling and user-facing messages  
**Description:** Ensure all API errors return consistent shape (e.g. code, message); map internal errors to safe user-facing messages. Chat UI shows “Something went wrong” or “Source X unavailable” instead of raw errors. Log full context server-side.  
**Why it matters:** Security and UX; no stack traces or internal details in client.  
**Dependencies:** O2, O4, B3.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** Medium.

---

### Q2. Integration test: ask flow with mock connector

**Title:** Integration test: ask flow with mock connector  
**Description:** Add test that runs full ask pipeline with a mock connector (returns fixed fragments). Assert: intent resolved, mock called with correct limits, synthesis returns answer and sources, message and audit written. No real LLM or external API.  
**Why it matters:** Regressions in orchestration are caught before release.  
**Dependencies:** O2, C1 (mock adapter).  
**Priority:** P1.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

### Q3. Tenant isolation tests

**Title:** Tenant isolation tests  
**Description:** Tests that verify: user A in tenant 1 cannot read conversations or integrations of tenant 2; API returns 403 or empty when tenant_id does not match. Use test tenants and RLS.  
**Why it matters:** Critical for multi-tenant security; must be verified automatically.  
**Dependencies:** A3, O3, B2.  
**Priority:** P0.  
**MVP or later:** MVP.  
**Risk level:** High if missing.

---

### Q4. Documentation: runbook and env

**Title:** Documentation: runbook and env  
**Description:** Document required environment variables (Supabase URL/key, Claude key, encryption key, etc.). Short runbook: how to run locally, how to run migrations, how to create first tenant and user.  
**Why it matters:** Onboarding and deployments depend on clear setup and ops steps.  
**Dependencies:** All phases.  
**Priority:** P1.  
**MVP or later:** MVP.  
**Risk level:** Low.

---

## Recommended implementation order

Implement in the following order to respect dependencies and deliver a working flow as early as possible. Items in the same row can be parallelized where team capacity allows.

| Order | Phase / item | Notes |
|-------|----------------------|--------|
| 1 | **F1** Monorepo and workspace setup | First. |
| 2 | **F2** Shared types, **F3** Prompts package, **F4** Supabase schema skeleton | In parallel after F1. |
| 3 | **A1** Supabase Auth and JWT validation in API | Unblocks all protected endpoints. |
| 4 | **A2** Tenant and profile creation path, **A4** Next.js auth and session | So users can log in and have tenant context. |
| 5 | **A3** RLS and tenant isolation | Before any tenant-scoped data; do after A2. |
| 6 | **C1** Connector contract and registry, **C2** Config and secret loading, **C3** Limits and timeout | Connector framework before admin “test” and orchestration. |
| 7 | **B1** Admin layout and role guard, **B2** Integrations list and status API | Admin shell and list. |
| 8 | **B3** Add integration flow (OAuth/API key) | Depends on C1/C2 for test connection. |
| 9 | **R1** Intent classification with LLM, **R2** Intent-to-source mapping and tenant filter | Routing before orchestration. |
| 10 | **O1** LLM client and synthesis prompt | Needed for O2. |
| 11 | **O3** Conversations and messages persistence | Needed for O2. |
| 12 | **O2** Orchestration pipeline (ask endpoint) | Ties R1, R2, R3, O1, O3 together. |
| 13 | **R3** Parallel connector invocation | Used inside O2; can be implemented with O2 or just before. |
| 14 | **O4** Chat UI | After O2 is usable. |
| 15 | **D1** Bitrix, **D2** Google Drive, **D3** Google Sheets | Order by business priority; all depend on C1–C3 and B3. |
| 16 | **B4** Re-auth and disable integration | After B3 and first connectors. |
| 17 | **L1** Audit log write, **L2** Structured logging and request id | Observability baseline. |
| 18 | **Q1** Error handling and user-facing messages, **Q3** Tenant isolation tests | Hardening and security. |
| 19 | **Q2** Integration test (ask with mock), **Q4** Documentation runbook and env | QA and ops. |
| 20 | **L3** Optional audit list in admin | If scope allows. |

**Summary sequence:** Foundation (F1–F4) → Auth and tenant (A1–A4) → Connector framework (C1–C3) → Admin panel (B1–B4) → Source routing (R1–R3) → Orchestration and chat (O1–O4) → First connectors (D1–D3) → Observability (L1–L3) → QA and hardening (Q1–Q4). Adjust B3/B4 vs C1–C3 if you implement a stub “test connection” before full connector framework.

---

**Document control:** Aligned with docs/technical-blueprint.md and docs/monorepo-structure.md. Update this backlog when scope or phases change.
