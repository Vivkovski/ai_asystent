# Technical Blueprint — AI Assistant platform

Single source of truth for the technical specification. No implementation code here; architecture, models, and decisions only.

---

## Assumed decisions (baseline for this blueprint)

Where no explicit product decision was recorded, the following is assumed for the blueprint. Adjust these first if something should change.

| Area | Assumption |
|------|------------|
| **Tenant** | One tenant = one organization. Strict isolation. Tenants created by platform (invite / admin). Dedicated deployment = same codebase, one instance per client, single tenant in that instance. |
| **User** | One user belongs to one tenant at MVP. Roles: end_user, tenant_admin. No platform super-admin in MVP. SSO out of scope for MVP. |
| **Integrations** | One instance per connector type per tenant (one Bitrix, one Drive, one Sheets). Enable/disable, re-auth. MVP connectors: Bitrix, Google Drive, Google Sheets. Data scope: tenant-level (connector uses tenant credentials). |
| **Secrets** | Stored in Supabase (encrypted column or Vault). Single encryption key in env. No raw credentials in UI. |
| **Routing** | Fixed platform intent taxonomy (e.g. crm, documents, spreadsheets, mixed). Platform-defined intent→source mapping; tenant only enables which connectors exist. LLM classifies intent. Fallback when no source selected: refuse or explicit "no sources". Multi-source: yes; parallel query; LLM merges. |
| **Live vs indexed** | Live-only at MVP. No indexing or cache layer. |
| **Chat history** | Persisted per user, per tenant. Retention configurable (e.g. 90 days). One conversation = thread with context for follow-ups. User sees own history; tenant_admin can have audit view. GDPR: delete/anonymize on request. |
| **Audit** | Log: question id, answer id, sources used, user_id, tenant_id, timestamp. No full question/answer text in audit table; link to conversation. Retention e.g. 1 year. Supabase. Visible to platform and tenant_admin. |
| **Connector contract** | Fragments + metadata (title, link, type, source_id). Same for all. Limits: e.g. 20 fragments per source, 50 total, 30s timeout per connector. One connector failure → partial answer + "source X unavailable". Single connector API version in code at MVP. |
| **Dedicated** | Same codebase; config via env; one Supabase project per dedicated instance. Same release train. |
| **LLM** | OpenRouter at MVP (configurable model, e.g. Claude or GPT via openrouter.ai); abstraction interface with MockLLM when no API key. Same model for intent and answer. No per-tenant rate limits in product at MVP. |
| **Admin integrations** | Add → type → OAuth/API key → test connection → save. Require successful test before save. List integrations with status and last error. Re-auth via in-app OAuth redirect. |
| **Response** | Text + list of sources with links. Inline [1],[2] plus list at end. "No sources" / "low confidence" when applicable. Language: tenant default or user locale; MVP can be single language. |

---

# Part A — Architecture and modules

## 1. Final system architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  User / Tenant Admin (browser)                                               │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  apps/web (Next.js)                                                          │
│  • User app: chat UI, conversation, answer + sources display                  │
│  • Admin: tenant settings, integrations (add/test/list/re-auth)            │
│  • Auth: Supabase client (session); token sent to API                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ REST API (JSON)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  apps/api (FastAPI)                                                          │
│  • Auth: validate JWT, resolve tenant_id + user_id + role                    │
│  • Orchestration: intent → source selection → connectors → LLM → response   │
│  • Chat: create message, load history, persist answer + provenance           │
│  • Admin API: CRUD integrations (with secret handling), test connection     │
└─────┬──────────────┬──────────────┬──────────────┬──────────────────────────┘
      │              │              │              │
      ▼              ▼              ▼              ▼
┌──────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Supabase │  │ packages/   │  │ packages/   │  │ OpenRouter  │
│ DB       │  │ connectors  │  │ prompts     │  │ (LLM)       │
│ Auth     │  │ (Bitrix,    │  │ (templates, │  │ intent +    │
│ Storage  │  │  Drive,     │  │  taxonomy)  │  │ synthesis   │
│ Vault    │  │  Sheets)    │  │             │  │             │
└──────────┘  └─────────────┘  └─────────────┘  └─────────────┘
      │              │
      │              └──────────► External systems (Bitrix API, Google APIs)
      │
      └─────────────► packages/shared (types, constants) ◄── used by apps/web, apps/api, packages/connectors
```

**Deployment:** One or more instances. Each instance is either multi-tenant (many tenants, one Supabase project) or dedicated (one tenant, one Supabase project). Same codebase; config via environment.

---

## 2. Main modules and responsibilities

| Module | Location | Responsibility |
|--------|----------|----------------|
| **Web app** | apps/web | UI for chat and admin; auth via Supabase; calls API only; no business logic, no connector/LLM code. |
| **API gateway & auth** | apps/api | HTTP entry; JWT validation; tenant/user/role resolution; routing to internal modules. |
| **Orchestration** | apps/api | Request pipeline: intent classification → source selection → connector calls (parallel) → LLM synthesis → response + provenance; error handling and partial answers. |
| **Intent & routing** | apps/api + packages/prompts | Load taxonomy and prompts; call LLM for intent; map intent to source ids; filter by tenant-enabled integrations. |
| **Connector adapters** | packages/connectors | Implement single contract: (query, tenant_connector_config, limits) → (fragments, source_metadata, error?). No orchestration. |
| **LLM client** | apps/api | Call OpenRouter (OpenAI-compatible API); intent prompt; synthesis prompt; parse response. When OPENROUTER_API_KEY not set, use MockLLM. |
| **Chat & history** | apps/api + Supabase | Persist messages, conversations, answers; link sources to messages; retention and listing. |
| **Audit** | apps/api + Supabase | Append-only log: who, when, which conversation/message, which sources; no full content in audit. |
| **Integration config** | apps/api + Supabase | Store per-tenant connector config (encrypted credentials); test connection; re-auth flow. |
| **Shared types** | packages/shared | Request/response shapes, intent keys, fragment/source types, error types; used by web, api, connectors. |
| **Prompts & taxonomy** | packages/prompts | Text/config only: intent labels, system prompts for classification and synthesis; loaded by API. |

---

## 3. Dependency diagram (text)

```
                    ┌─────────────┐
                    │  Supabase   │
                    │  (DB/Auth/  │
                    │   Vault)    │
                    └──────┬──────┘
                           │
     ┌─────────────────────┼─────────────────────┐
     │                     │                     │
     ▼                     ▼                     ▼
┌─────────┐         ┌──────────┐         ┌──────────────┐
│ apps/web│         │ apps/api │         │ packages/    │
│         │         │          │         │ connectors   │
└────┬────┘         └────┬─────┘         └──────┬───────┘
     │                    │                      │
     │                    │  ┌───────────────────┘
     │                    │  │
     │                    ▼  ▼
     │               ┌─────────────┐         ┌─────────────┐
     └──────────────►│ packages/   │◄────────┤ packages/   │
                     │ shared      │         │ prompts     │
                     └──────┬──────┘         └──────┬──────┘
                            │                      │
                            │    apps/api only ◄───┘
                            │
                     ┌──────┴──────┐
                     │             │
                     ▼             ▼
               apps/web      packages/connectors
               (types only)  (fragment/source types)
```

**Rules:**

- **apps/web** → packages/shared only (types for API client). No dependency on api, connectors, prompts.
- **apps/api** → packages/shared, packages/connectors, packages/prompts; Supabase; OpenRouter (LLM).
- **packages/connectors** → packages/shared (types). No dependency on apps or prompts.
- **packages/prompts** → none (text/config). Consumed by apps/api at runtime.
- **packages/shared** → none (or std lib only). No app or package imports.

---

## 4. End-to-end flow: user question

```
1. User submits question in chat (apps/web).
   └─► POST /api/conversations/{id}/messages  { "content": "Jaki jest status klienta X?" }
   └─► Headers: Authorization (Supabase JWT)

2. API: auth & context (apps/api).
   └─► Validate JWT → tenant_id, user_id, role
   └─► Load conversation (tenant + user); create message row (pending)

3. API: intent classification (apps/api + packages/prompts).
   └─► Load intent prompt from packages/prompts
   └─► Call LLM (OpenRouter) with question → intent label (e.g. "crm")

4. API: source selection (apps/api).
   └─► Map intent → source ids (e.g. crm → [bitrix])
   └─► Filter by tenant: only enabled integrations → [bitrix] (if Bitrix enabled)
   └─► If empty → return "no sources" / refuse

5. API: fetch from connectors (apps/api → packages/connectors).
   └─► For each source id: load tenant connector config (credentials from Supabase)
   └─► Call adapter in parallel: query, config, limits (e.g. 20 fragments, 30s)
   └─► Collect: list of (fragments[], source_metadata, error?)
   └─► On adapter error: keep partial; add "source X unavailable" to response

6. API: answer synthesis (apps/api + packages/prompts).
   └─► Load synthesis prompt
   └─► LLM (OpenRouter): question + fragments + "answer and cite sources [1],[2]"
   └─► Parse: answer text + cited source indices

7. API: persist & audit (apps/api + Supabase).
   └─► Update message: answer text, status success/partial/failed
   └─► Insert answer_sources (message_id, source_id, metadata, link)
   └─► Append audit log: tenant_id, user_id, message_id, sources_used, timestamp

8. API: response to client.
   └─► 200 { "message": { "content", "answer", "sources": [{ "id", "title", "link", "type" }] } }

9. Web: render answer + sources (inline refs + list at end).
```

---

# Part B — Data and domain models

## 5. Data model (core entities)

- **tenants**  
  - id (uuid), name, slug (optional), created_at, settings (jsonb, e.g. default_language, retention_days).

- **users** (Supabase Auth or custom; if custom)  
  - id (uuid), tenant_id (fk), email, role (enum: end_user, tenant_admin), created_at.  
  - If Supabase Auth only: users in auth.users; tenant_id and role in public.profiles (or tenant_members).

- **tenant_members** (if user can belong to one tenant only)  
  - id, tenant_id, user_id (auth), role, created_at.

- **integrations**  
  - id, tenant_id, type (enum: bitrix, google_drive, google_sheets), display_name, enabled (bool), credentials_encrypted (or ref to Vault), config (jsonb: scope, root_folder_id, etc.), last_tested_at, last_error (text), created_at, updated_at.

- **conversations**  
  - id, tenant_id, user_id, title (optional), created_at, updated_at.

- **messages**  
  - id, conversation_id, role (user | assistant), content (user question or assistant answer), status (pending | completed | partial | failed), created_at.

- **answer_sources** (provenance per message)  
  - id, message_id, integration_id (or source_key), source_type, title, link, fragment_count, created_at.

- **audit_logs**  
  - id, tenant_id, user_id, action (e.g. message_created), resource_type (message), resource_id, metadata (jsonb: sources_used[], etc.), created_at.  
  - No full question/answer text; reference by resource_id.

---

## 6. Tenant model

- **Definition:** One tenant = one organization (company). All data and configuration are scoped by tenant_id.
- **Isolation:** Strict. No cross-tenant data access. Every query and connector call is bound to one tenant_id from the authenticated context.
- **Creation:** By platform only (invite or admin-created). No self-signup in MVP.
- **Attributes:** id, name, optional slug, settings (e.g. default_language, chat_retention_days). No hierarchy (no parent tenant) in MVP.
- **Dedicated deployment:** Same tenant model; one instance runs with a single tenant in the DB (and optionally env flag DEDICATED=true). No code change; only config and data shape.

---

## 7. User and roles model

- **User:** Belongs to exactly one tenant (via tenant_members or profiles). Identified by Supabase Auth user id; tenant_id and role stored in app DB.
- **Roles (MVP):**  
  - **end_user:** Can use chat, see own conversations, no admin.  
  - **tenant_admin:** Can manage integrations (add, edit, delete, re-auth), view audit (e.g. who asked what when), manage tenant settings. No cross-tenant admin.
- **Platform super-admin:** Out of scope for MVP (or read-only support account; no special UI).
- **Auth:** Supabase Auth (email/password). SSO/SAML not in MVP; data model can reserve a field for “auth_provider” for later.

---

## 8. Integration model

- **Scope:** Per tenant. One active integration per type per tenant (one Bitrix, one Google Drive, one Google Sheets).
- **Lifecycle:** Create (with credentials) → enable/disable → re-auth when expired → delete. No versioning of config in MVP.
- **Storage:** Row per integration: tenant_id, type, display_name, enabled, credentials_encrypted (or Vault key), config (jsonb), last_tested_at, last_error.
- **Credentials:** Stored encrypted in Supabase (column or Vault). Encryption key in env. Never returned to frontend; only “connected” / “error” / “needs re-auth”.
- **Test:** Before save, backend calls connector with credentials; on success set last_tested_at, clear last_error; on failure return error to client and do not save (or save with last_error). Require successful test before marking “connected” in MVP.
- **Data scope:** Tenant-level: connector uses tenant’s credentials and sees data that that tenant’s connection can access. User-level scope (e.g. “only this user’s Drive”) deferred.

---

## 9. Connector contracts model

- **Unified contract (all connectors):**
  - **Input:** query_text (string), tenant_integration_config (credentials + config), limits (max_fragments_per_source, max_total_fragments, timeout_seconds).
  - **Output:** success (bool), fragments (list of { content: string, optional_metadata }), source_metadata { source_id, type, title, link }, error (optional string). Same shape for Bitrix, Drive, Sheets.

- **Limits (MVP):** e.g. max 20 fragments per source, 50 total to LLM, 30s timeout per connector. Enforced by orchestration and adapter.

- **Errors:** Adapter returns error + optional partial fragments. Orchestration does not fail entire request; builds partial answer and adds “source X unavailable” to response.

- **Versioning:** Single implementation per connector in code at MVP. When external API changes (e.g. Bitrix v2), upgrade in code and migrate tenant config if needed; no per-tenant connector version.

- **Idempotency:** No requirement for idempotent connector calls in MVP; each request is independent (live query).

---

## 10. Source routing model

- **Intent taxonomy (platform):** Fixed set of labels, e.g. crm, documents, spreadsheets, mixed. Stored or referenced from packages/prompts.

- **Intent → source mapping (platform):** Deterministic map, e.g. crm → [bitrix], documents → [google_drive], spreadsheets → [google_sheets], mixed → [bitrix, google_drive, google_sheets]. Defined in config or code; not tenant-editable in MVP.

- **Classification:** LLM (OpenRouter, model configurable via OPENROUTER_MODEL) with prompt from packages/prompts. Input: user question. Output: single intent label (or primary + secondary). Same model as synthesis at MVP.

- **Selection:** Given intent, resolve source ids from map; then filter by tenant: only sources that have an enabled integration for this tenant. Result: ordered list of source ids to query.

- **Fallback:** If list is empty (e.g. intent “crm” but tenant has no Bitrix), return “no sources” / refuse answer; do not query all enabled sources.

- **Multi-source:** One question can map to multiple sources (e.g. mixed). All selected sources are queried in parallel; results merged and sent to LLM in one synthesis step.

---

## 11. Answer orchestration model

- **Steps (in order):** (1) Auth & context, (2) Intent classification, (3) Source selection, (4) Parallel connector fetch, (5) Synthesis, (6) Persist & audit, (7) Response.

- **Inputs:** question text, conversation_id (optional), tenant_id, user_id (from auth).

- **Outputs:** answer text (markdown or plain), sources list (id, type, title, link), status (completed | partial | failed), optional warning (e.g. “Bitrix temporarily unavailable”).

- **Synthesis prompt:** Includes user question, concatenated fragments with source labels, instruction to answer in one block and cite sources as [1], [2]. LLM returns text; backend parses citations and matches to source list to build sources[].

- **Partial failure:** If one connector times out or errors, keep other results; run synthesis on available fragments; set status partial and add warning. No retry in MVP.

- **Idempotency:** No requirement for idempotent request key; duplicate submit = two messages.

---

## 12. Chat history and audit logs model

- **Chat history:**
  - Conversations: tenant_id, user_id, optional title; list ordered by updated_at.
  - Messages: conversation_id, role, content, status; ordered by created_at. User sees only own conversations (or tenant_admin sees by policy).
  - Retention: configurable per tenant (e.g. retention_days in tenant settings). Hard delete or anonymize after retention; GDPR delete on request (delete or anonymize user + their messages).

- **Audit logs:**
  - Append-only. Columns: tenant_id, user_id, action (e.g. message_created, integration_connected), resource_type, resource_id, metadata (jsonb: e.g. sources_used, integration_id), created_at.
  - Do not store full question or answer text; reference message_id for traceability.
  - Retention: e.g. 1 year; then archive or delete by policy.
  - Access: tenant_admin can read own tenant’s audit; platform (support) can read all. No audit UI in MVP beyond “list recent actions” if needed.

---

## 13. Live data vs indexed data model

- **MVP: live only.** Every user question triggers real-time calls to connectors. No background indexing, no search index, no cache of connector results.

- **Implications:** Latency depends on connector APIs; no offline or precomputed answers. Simpler architecture; no index refresh, no storage for indexed content.

- **Future (out of MVP):** Optional index/cache per source type (e.g. document search index). Would require: scope (which docs), refresh policy, retention, and a separate “search” path in orchestration. Not designed in this blueprint.

---

## 14. Dedicated vs shared multi-tenant deployment model

- **Shared (multi-tenant):** One deployment (e.g. SaaS). One Supabase project. Many tenants in DB. Same codebase; tenant_id on every request. Environment: single set of env vars (API URL, Supabase URL/key, OpenRouter API key, etc.).

- **Dedicated (single-tenant per instance):** Same codebase; one instance per customer. One Supabase project per instance (or one DB with single tenant_id). Env vars per deployment (different Supabase, different keys). Optionally env flag DEDICATED=true to hide “tenant switcher” or show single-tenant branding.

- **Config:** No tenant-specific config in code. Tenant settings in DB (tenant.settings). Connector config in DB (integrations). Secrets in Supabase Vault or encrypted columns. Release process: same build for both; only env and data differ.

- **No per-customer code forks.** Hotfixes for one client = same branch/release; feature flags or env if needed.

---

# Part C — Risks, simplifications, out of scope

## Technical risks

| Risk | Mitigation |
|------|-------------|
| Connector API rate limits or downtime | Timeouts and partial answers; clear “source unavailable” message; optional retry later. |
| LLM latency or cost | Single model for intent + synthesis at MVP; can split to smaller model for intent later; monitor token usage. |
| Credential leakage | No credentials in frontend or logs; encrypt at rest; rotate key procedure. |
| Tenant data leakage | Strict tenant_id on all queries; audit RLS and API middleware. |
| Prompt injection / misuse | Validate inputs; do not pass raw user text as unchecked system prompt; rate limit per user/tenant if needed later. |
| Supabase as single point of failure | Accept for MVP; plan backup/restore and optional multi-region later. |
| No indexing → slow or incomplete answers for large document sets | Accept for MVP; document as limitation; design “indexed path” later. |

---

## MVP simplifications

- **One integration per type per tenant.** No “second Bitrix” or “second Drive”.
- **Fixed intent taxonomy and mapping.** No tenant-customizable intents or mapping.
- **Single LLM model** for both intent and answer.
- **No per-tenant/per-user rate limits** in product (can add at API level externally).
- **No SSO/SAML;** email/password only.
- **No platform super-admin UI;** tenant_admin only.
- **Audit:** Minimal schema; no real-time activity feed; optional simple “recent actions” list.
- **Re-auth:** In-app redirect only; no magic-link-only flow.
- **Language:** Single language or tenant default; no per-request language detection in MVP.
- **Connector errors:** No automatic retry; partial answer + message.
- **Chat:** No streaming response in MVP if not required; request/response is enough.

---

## What we are NOT building now

- **Indexed/cached search.** No background indexing, no vector store, no “search index” for documents.
- **n8n or external workflow engine.** All orchestration in app code.
- **Multiple LLM providers in UI.** OpenRouter with configurable model (e.g. Claude, GPT); abstraction in code for future providers.
- **Tenant-editable prompts or taxonomy.** Prompts and taxonomy in repo (packages/prompts) only.
- **User-level connector scope** (e.g. “only my Drive”). Tenant-level only.
- **API for third-party “ask”** (e.g. API key for external systems). Only in-app chat in MVP.
- **Streaming tokens** to UI (unless explicitly added later).
- **Custom roles beyond end_user and tenant_admin.**
- **White-label or per-tenant branding** (beyond env-based dedicated instance).
- **Offline or mobile app.** Web only.
- **Full audit UI** (dashboards, export). Minimal audit table and optional list only.
- **Connector versioning** (e.g. Bitrix v1 vs v2 in same deployment). One version per connector in code.

---

## Document control

- **Version:** 1.0  
- **Last updated:** (set when you adopt this doc)  
- **Next review:** After MVP scope or stack change.  
- **Related:** docs/architecture-and-product-brief.md, docs/monorepo-structure.md, docs/recommended-next-steps.md.
