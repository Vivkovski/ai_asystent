# Linear-ready backlog — AI Assistant MVP

Copy each block into Linear. Epics first, then issues linked to epics.

---

# EPICS (create these first)

| Name | Description |
|------|-------------|
| **Foundation** | Monorepo, shared packages, Supabase schema. Base for all other work. |
| **Auth & tenant model** | JWT in API, tenant_id/role from profile, RLS, seed path, Next.js session. |
| **Admin — integrations** | /admin area, integrations list, add (credentials + test), re-auth, disable. |
| **Connector framework** | Connector contract, registry, config/secret loading, limits and timeout. |
| **Source routing & orchestration** | Intent classification, source selection, parallel fetch, synthesis, ask pipeline, persistence. |
| **Chat UI & provenance** | Chat screen, conversation list, answer with [1],[2] and sources list. |
| **First connectors** | Bitrix, Google Drive, Google Sheets adapters. |
| **Observability & QA** | Audit log, logging, error handling, tenant isolation tests, ask flow test, runbook. |

---

# ISSUES

## Epic: Foundation

---

**Title:** Monorepo and workspace setup  
**Description:** Set up monorepo with apps/web (Next.js), apps/api (FastAPI), packages/shared, packages/connectors, packages/prompts. Configure workspace (e.g. pnpm workspaces), root scripts (install, build, dev), path aliases for apps to depend on packages.  
**Acceptance criteria:**
- Root workspace config; `pnpm install` at root installs deps for apps and packages
- `apps/web` and `apps/api` run locally (e.g. pnpm --filter web dev, uvicorn for api)
- Import from shared package works from apps  
**Dependencies:** None  
**Labels:** architecture, foundation  
**Priority:** Urgent  

---

**Title:** Shared types and constants (packages/shared)  
**Description:** Define packages/shared: API shapes (AskRequest, AskResponse, SourceItem), intent keys, Fragment and SourceMetadata types, error codes. Types only; no runtime logic. Used by apps/web, apps/api, packages/connectors.  
**Acceptance criteria:**
- Exported types for ask request/response, sources, intent keys, fragment, source_metadata
- apps/web and apps/api import from shared without build errors  
**Dependencies:** Monorepo and workspace setup  
**Labels:** architecture, foundation  
**Priority:** Urgent  

---

**Title:** Prompts and intent taxonomy (packages/prompts)  
**Description:** Add packages/prompts: intent taxonomy (crm, documents, spreadsheets, mixed), intent classification prompt, answer synthesis prompt. Plain text or YAML; loadable at runtime by API.  
**Acceptance criteria:**
- Prompt files and label list in packages/prompts
- Loader or API can read prompts at runtime (path from env or default)  
**Dependencies:** Monorepo and workspace setup  
**Labels:** architecture, foundation  
**Priority:** Urgent  

---

**Title:** Supabase project and schema skeleton  
**Description:** Create Supabase project. Add schema: tenants, profiles/tenant_members, integrations, conversations, messages, answer_sources, audit_logs. No RLS yet; tables and relations only.  
**Acceptance criteria:**
- Migrations or SQL create all tables with key columns per technical blueprint
- FKs and indexes on tenant_id where needed  
**Dependencies:** Monorepo and workspace setup  
**Labels:** backend, foundation  
**Priority:** Urgent  

---

## Epic: Auth & tenant model

---

**Title:** Supabase Auth and JWT validation in API  
**Description:** Configure Supabase Auth (email/password). In FastAPI add dependency: validate JWT, get user id, load tenant_id and role from profiles/tenant_members. Return 401 when invalid or missing.  
**Acceptance criteria:**
- Invalid or missing token → 401
- Valid token → dependency returns CurrentContext (tenant_id, user_id, role)
- Dependency used on at least one protected route  
**Dependencies:** Supabase project and schema skeleton  
**Labels:** backend, auth  
**Priority:** Urgent  

---

**Title:** Tenant and profile seeding  
**Description:** Provide a way to create one tenant and one user (tenant_admin): seed script or minimal admin-only API. Every user has tenant_id and role (end_user | tenant_admin) in DB.  
**Acceptance criteria:**
- Can create one tenant and one user with tenant_id and role (e.g. seed or POST with service key)
- After Supabase Auth login, profile/tenant_member row exists with tenant_id and role  
**Dependencies:** Supabase schema, Supabase Auth and JWT validation in API  
**Labels:** backend, auth  
**Priority:** Urgent  

---

**Title:** RLS and tenant isolation  
**Description:** Enable RLS on tenants, integrations, conversations, messages, answer_sources, audit_logs. All reads/writes filtered by tenant_id from auth context.  
**Acceptance criteria:**
- RLS enabled on listed tables
- Policies: SELECT/INSERT/UPDATE only for rows where tenant_id matches auth context
- Manual or automated test: user A cannot read tenant B data  
**Dependencies:** Supabase Auth and JWT validation, Tenant and profile seeding  
**Labels:** backend, auth, security  
**Priority:** Urgent  

---

**Title:** Next.js auth and session  
**Description:** In apps/web: Supabase client for sign-in/sign-out, store session, send JWT in Authorization header on every API request. Protected routes: unauthenticated → redirect to login.  
**Acceptance criteria:**
- Login form (email/password) and sign-out
- API requests include Authorization: Bearer <token> when logged in
- Access to /chat and /admin without session → redirect to /login  
**Dependencies:** Supabase Auth and JWT validation in API  
**Labels:** frontend, auth  
**Priority:** Urgent  

---

## Epic: Admin — integrations

---

**Title:** Admin layout and role guard  
**Description:** Add /admin in Next.js with layout and nav. Guard: only tenant_admin can access; others get 403 or redirect. Tenant from session; admin sees only own tenant.  
**Acceptance criteria:**
- /admin only for tenant_admin
- end_user on /admin gets 403 or redirect
- Nav (e.g. Integrations) in admin layout  
**Dependencies:** Next.js auth and session  
**Labels:** frontend, admin  
**Priority:** Urgent  

---

**Title:** Integrations list API and UI  
**Description:** Backend: GET /api/v1/admin/integrations returning tenant integrations (id, type, display_name, enabled, last_tested_at, last_error). No credentials. Frontend: page with list and status (connected / error / not configured).  
**Acceptance criteria:**
- Endpoint returns only current tenant integrations; 401/403 when invalid token
- UI shows type, status, truncated last_error; no credentials in response  
**Dependencies:** RLS and tenant isolation, Supabase schema  
**Labels:** backend, frontend, admin  
**Priority:** Urgent  

---

**Title:** Add integration — backend (encrypt, test, save)  
**Description:** POST /api/v1/admin/integrations: type (bitrix | google_drive | google_sheets), credentials, optional display_name. Encrypt credentials (env key), call test connection via adapter, save only if test OK. Return error if test fails.  
**Acceptance criteria:**
- Credentials encrypted before save; never returned in response
- Before save: test connection via registry + adapter; on failure return 400, do not save
- On success: 201, row with last_tested_at set, last_error clear  
**Dependencies:** Admin layout, Integrations list API and UI, Connector contract and registry, Connector config resolution and secret loading  
**Labels:** backend, admin, security  
**Priority:** Urgent  

---

**Title:** Add integration — frontend (form, OAuth, test, save)  
**Description:** Add integration form: type selection, credentials (Bitrix: webhook URL; Google: OAuth button + callback). Test connection button; enable Save only after success. Submit via POST /admin/integrations.  
**Acceptance criteria:**
- Form per type (Bitrix: URL; Drive/Sheets: Connect with Google)
- Test connection calls backend; show success/error; Save enabled only after success
- After save: redirect to list or success toast  
**Dependencies:** Admin layout, Integrations list API and UI, Add integration — backend  
**Labels:** frontend, admin  
**Priority:** Urgent  

---

**Title:** Re-auth and disable integration  
**Description:** Backend: PATCH /admin/integrations/{id} (new credentials or enabled=false). Frontend: Reconnect and Disable on row; Reconnect runs OAuth or form and saves.  
**Acceptance criteria:**
- PATCH accepts optional credentials (re-auth) or enabled
- Reconnect in UI: new OAuth or form; list refreshes after save
- Disable: integration excluded from source selection (enabled=false)  
**Dependencies:** Add integration — backend, Add integration — frontend  
**Labels:** backend, frontend, admin  
**Priority:** High  

---

## Epic: Connector framework

---

**Title:** Connector contract and registry  
**Description:** Define connector interface: input (query_text, config, limits), output (success, fragments, source_metadata, error). Registry in apps/api: source_id → adapter instance. Adapters in packages/connectors implement same interface.  
**Acceptance criteria:**
- Types: ConnectorInput, ConnectorOutput, Fragment, SourceMetadata (in shared or connectors)
- Registry: get_adapter(source_id) returns adapter; register bitrix (can be mock initially)
- No Bitrix/Drive logic in orchestration; only source_id and contract  
**Dependencies:** Shared types and constants  
**Labels:** backend, integrations, architecture  
**Priority:** Urgent  

---

**Title:** Connector config resolution and secret loading  
**Description:** For tenant_id and source_id load integration row (credentials_encrypted, config). Decrypt with env key; build ConnectorConfig and pass to adapter. Never log or return credentials. Handle not found or disabled.  
**Acceptance criteria:**
- load_config(tenant_id, source_id) → ConnectorConfig or missing
- Decrypt only in backend; no credentials in logs or response
- Not found / disabled → clear error, no leak  
**Dependencies:** Connector contract and registry, Supabase schema  
**Labels:** backend, integrations, security  
**Priority:** Urgent  

---

**Title:** Limits and timeout enforcement  
**Description:** When calling adapters: max_fragments_per_source (e.g. 20), max_total_fragments (e.g. 50), timeout_seconds (e.g. 30). Wrap adapter call in timeout if adapter does not enforce it.  
**Acceptance criteria:**
- Limits in ConnectorInput; timeout enforced at call site
- On timeout return ConnectorOutput(success=false, error=timeout)  
**Dependencies:** Connector contract and registry  
**Labels:** backend, integrations  
**Priority:** Urgent  

---

## Epic: Source routing & orchestration

---

**Title:** Intent classification with LLM  
**Description:** Load intent prompt from packages/prompts. Call Claude with user question; parse response to single label (crm | documents | spreadsheets | mixed). On API or parse error use fallback (refuse or fixed label); never default to query-all.  
**Acceptance criteria:**
- classify_intent(question) → intent_label
- On LLM error do not assume query-all; return fallback
- Prompt and labels from packages/prompts  
**Dependencies:** Prompts and intent taxonomy, Claude API key  
**Labels:** backend, orchestration  
**Priority:** Urgent  

---

**Title:** Intent-to-source mapping and tenant filter  
**Description:** Platform map intent → source_ids (e.g. crm→[bitrix], documents→[google_drive], mixed→[bitrix, google_drive, google_sheets]). Filter by tenant enabled integrations. Return ordered source_ids or empty. Empty → do not call connectors.  
**Acceptance criteria:**
- For intent + tenant_id return list of source_ids (enabled only) or empty
- When empty orchestration does not call any adapter and returns fallback  
**Dependencies:** Supabase schema (integrations.enabled), Intent classification with LLM  
**Labels:** backend, orchestration  
**Priority:** Urgent  

---

**Title:** Parallel connector invocation (runner)  
**Description:** For each source_id: load config, get adapter from registry, call adapter.fetch(ConnectorInput) in parallel (e.g. asyncio.gather). Collect ConnectorOutput per source. One failure does not fail whole request; record which source failed.  
**Acceptance criteria:**
- All selected sources called in parallel
- Results in same order as source_ids; each item ConnectorOutput or error placeholder
- Timeout and limits from framework applied per call  
**Dependencies:** Connector contract and registry, Connector config resolution and secret loading, Limits and timeout enforcement  
**Labels:** backend, orchestration  
**Priority:** Urgent  

---

**Title:** LLM client and synthesis prompt  
**Description:** Claude client in apps/api. Load synthesis prompt from packages/prompts. Input: question + fragments with labels [1],[2]. Call Claude; parse answer text and cited source indices; build sources[] for response.  
**Acceptance criteria:**
- synthesize_answer(question, fragments_with_labels) → answer text + cited_source_indices
- Prompt: answer only from fragments, cite [1],[2]
- Citation indices aligned with source_metadata order; no out-of-range  
**Dependencies:** Prompts and intent taxonomy, Claude API key  
**Labels:** backend, orchestration  
**Priority:** Urgent  

---

**Title:** Conversations and messages persistence  
**Description:** Create conversation (tenant_id, user_id); append messages (role, content, status). For assistant messages persist answer_sources (message_id, source metadata, link). List conversations and messages for current user; enforce tenant and ownership.  
**Acceptance criteria:**
- POST/GET conversations and GET conversation/{id} with messages — own only, tenant-scoped
- Create message and answer_sources in same flow
- No access to other tenant conversation (RLS + conversation.tenant_id check)  
**Dependencies:** Supabase schema, RLS and tenant isolation  
**Labels:** backend, orchestration  
**Priority:** Urgent  

---

**Title:** Orchestration pipeline (ask endpoint)  
**Description:** Single endpoint POST /conversations/{id}/messages: auth → load/create conversation → user message → intent → source selection → if empty return fallback → parallel fetch → synthesis → persist message + answer_sources → audit log → return answer + sources. Handle no sources and partial failure; set message status completed/partial/failed.  
**Acceptance criteria:**
- One request runs full pipeline in order
- No sources → no connector calls; return fallback message
- Partial failure → answer from available fragments + unavailable source notice
- One audit entry with tenant_id, user_id, message_id, sources_used, status  
**Dependencies:** Supabase Auth and JWT validation, Intent classification, Intent-to-source mapping, Parallel connector invocation, LLM client and synthesis prompt, Conversations and messages persistence, Supabase schema  
**Labels:** backend, orchestration  
**Priority:** Urgent  

---

## Epic: Chat UI & provenance

---

**Title:** Chat screen and ask flow  
**Description:** Chat view: message list or single thread, question input, submit button. Submit → POST ask endpoint, loading state, show answer. Loading copy (e.g. "Asystent odpowiada…"); errors as friendly message.  
**Acceptance criteria:**
- Submit creates/updates conversation and calls ask endpoint
- Loading state while waiting; then assistant message content
- Network/4xx/5xx → message + Retry; no stack trace  
**Dependencies:** Next.js auth and session, Orchestration pipeline (ask endpoint), Shared types  
**Labels:** frontend, chat  
**Priority:** Urgent  

---

**Title:** Answer and source provenance display  
**Description:** In assistant message: answer text with [1],[2] in body and "Sources" section (type, title, link). Mark unavailable sources. Always show sources section (even if empty).  
**Acceptance criteria:**
- Sources from message.sources; [1],[2] in text match list
- Link opens in new tab; partial → one source can show "unavailable"
- No "Show sources" toggle in MVP  
**Dependencies:** Chat screen and ask flow  
**Labels:** frontend, chat  
**Priority:** Urgent  

---

**Title:** Conversation list and history  
**Description:** List user conversations (sidebar or page); click loads thread with messages. Sort by date (newest first). Conversation title e.g. from first question.  
**Acceptance criteria:**
- GET /conversations returns list; GET /conversations/{id} returns messages
- List only own conversations; selecting conversation loads thread in chat view  
**Dependencies:** Conversations and messages persistence, Chat screen and ask flow  
**Labels:** frontend, chat  
**Priority:** Urgent  

---

## Epic: First connectors

---

**Title:** Bitrix connector  
**Description:** Bitrix adapter in packages/connectors/bitrix: auth via webhook URL from config, call crm.deal.list / crm.contact.list, normalize to Fragment[] + SourceMetadata. Respect limits and timeout; on error return partial + error. test_connection for admin.  
**Acceptance criteria:**
- fetch(ConnectorInput) → ConnectorOutput; source_metadata.type = "crm"
- test_connection(config) returns success/error
- Registered as "bitrix"; no Bitrix logic in orchestration  
**Dependencies:** Connector contract and registry, Connector config resolution and secret loading, Limits and timeout enforcement  
**Labels:** integrations, backend  
**Priority:** Urgent  

---

**Title:** Google Drive connector  
**Description:** Google Drive adapter: OAuth per tenant, search/list files, optional text extraction; return Fragment[] + SourceMetadata. Limits and timeout; partial + error on failure. test_connection.  
**Acceptance criteria:**
- fetch → ConnectorOutput; source_metadata.type = "documents" (or per taxonomy)
- test_connection; registered as "google_drive"  
**Dependencies:** Connector contract and registry, Connector config resolution and secret loading, Limits and timeout enforcement  
**Labels:** integrations, backend  
**Priority:** Urgent  

---

**Title:** Google Sheets connector  
**Description:** Google Sheets adapter: OAuth per tenant, read sheets/ranges; return Fragment[] + SourceMetadata. Limits and timeout; partial + error. test_connection.  
**Acceptance criteria:**
- fetch → ConnectorOutput; type = "spreadsheets"; registered "google_sheets"; test_connection  
**Dependencies:** Connector contract and registry, Connector config resolution and secret loading, Limits and timeout enforcement  
**Labels:** integrations, backend  
**Priority:** Urgent  

---

## Epic: Observability & QA

---

**Title:** Audit log write on key actions  
**Description:** Append to audit_logs on message_created (metadata: message_id, sources_used), integration_connected, integration_disabled. No full question/answer text; resource_type and resource_id. Always tenant_id, user_id, timestamp.  
**Acceptance criteria:**
- Entry on each ask (message_created) and on add/disable integration
- metadata has sources_used, status; no question/answer text  
**Dependencies:** Supabase schema, Orchestration pipeline, Add integration backend, Re-auth and disable  
**Labels:** backend, observability  
**Priority:** High  

---

**Title:** Structured logging and request id  
**Description:** Add request_id to each API request; log at entry and on errors with request_id, tenant_id, user_id. No secrets or full bodies. Structured format (e.g. JSON) for aggregation.  
**Acceptance criteria:**
- Every request has request_id; errors log request_id, tenant_id (and optionally user_id)
- No credentials or full request body in logs  
**Dependencies:** None  
**Labels:** backend, observability  
**Priority:** High  

---

**Title:** Error handling and user-facing messages  
**Description:** Consistent API error shape (e.g. code, message). Map internal errors to safe messages. Chat UI: "Something went wrong" / "Source X unavailable"; no raw API or stack trace. Full context in server logs.  
**Acceptance criteria:**
- All API errors use same format (e.g. ErrorResponse)
- UI never shows raw API messages or stack trace  
**Dependencies:** Orchestration pipeline, Chat screen and ask flow, Add integration backend  
**Labels:** backend, frontend, security  
**Priority:** Urgent  

---

**Title:** Tenant isolation tests  
**Description:** Tests: user A cannot read tenant B conversations or integrations; API returns 403 or empty when tenant_id does not match. Use test tenants and RLS.  
**Acceptance criteria:**
- Test: GET conversations as user A with B's conversation_id → 403 or 404
- Test: GET admin/integrations returns only caller's tenant integrations
- At least two tenants in fixture; assertions for isolation  
**Dependencies:** RLS and tenant isolation, Conversations and messages persistence, Integrations list API and UI  
**Labels:** qa, security  
**Priority:** Urgent  

---

**Title:** Integration test: ask flow with mock connector  
**Description:** Test full ask pipeline with mock adapter (fixed fragments). Assert: intent resolved, mock called with correct limits, synthesis returns answer and sources, message and audit written. No real LLM or external API.  
**Acceptance criteria:**
- E2E test: request → intent (mock LLM) → source selection → mock adapter → synthesis (mock LLM) → persist + audit
- Assert message status, presence of sources, audit_logs entry  
**Dependencies:** Orchestration pipeline (ask endpoint), Connector contract and registry (mock adapter)  
**Labels:** qa, backend  
**Priority:** High  

---

**Title:** Runbook and env documentation  
**Description:** Document required env vars (Supabase URL/key, JWT secret, encryption key, Claude key). Short runbook: run locally, run migrations, create first tenant and user.  
**Acceptance criteria:**
- Env vars list with short description (e.g. in docs/environment-setup-guide.md or README)
- Steps: clone, .env, migrations, seed/creation, run api + web  
**Dependencies:** (Final step; all epics)  
**Labels:** documentation, architecture  
**Priority:** High  

---

**Title:** Audit list in admin (optional)  
**Description:** Simple admin page/section: list recent audit_logs for tenant (action, user, resource, timestamp). No export or advanced filters in MVP.  
**Acceptance criteria:**
- GET /admin/audit or equivalent; list with pagination/limit
- Columns: date, user, action, resource; current tenant only  
**Dependencies:** Audit log write on key actions, Admin layout and role guard  
**Labels:** frontend, backend, admin  
**Priority:** Medium  

---

# Suggested implementation order

1. Foundation: Monorepo → Shared types, Prompts, Supabase schema (parallel).
2. Auth: JWT validation → Tenant seeding, Next.js auth (parallel) → RLS.
3. Connector framework: Contract and registry → Config/secret loading, Limits and timeout (parallel).
4. Admin: Admin layout, Integrations list (parallel) → Add integration backend → Add integration frontend → Re-auth and disable.
5. Orchestration: Intent classification, Intent-to-source mapping → LLM synthesis, Conversations persistence (parallel) → Parallel connector invocation → Ask endpoint.
6. Chat UI: Chat screen and ask flow → Answer and source provenance → Conversation list.
7. Connectors: Bitrix → Google Drive, Google Sheets (parallel or sequence).
8. Observability & QA: Structured logging (early); Audit log after ask + integrations; Error handling with chat; Tenant isolation tests and Ask flow test after full pipeline; Runbook last; Audit list optional.
