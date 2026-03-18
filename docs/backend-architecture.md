# Backend architecture breakdown — AI Assistant MVP

Plan and structure for `apps/api` (FastAPI). No full implementation code here. Aligned with technical blueprint and MVP backlog.

**Principles:** Connector-specific logic stays out of shared orchestration; LLM behind abstraction; source routing as a separate layer; secrets only on backend; design for testability.

---

## 1. Backend modules (list)

| Module | Purpose |
|--------|---------|
| **Gateway / HTTP** | FastAPI app, CORS, middleware, route mounting. |
| **Auth** | JWT validation, tenant/user/role resolution, dependency injection of request context. |
| **Tenants** | Tenant entity access and tenant-scoped checks (no cross-tenant). |
| **Integrations** | CRUD and config for tenant integrations; credential load/decrypt; test connection. |
| **Source routing** | Intent classification (LLM), intent→source mapping, tenant filter; returns list of source ids to query. |
| **Connector orchestration** | Resolve adapter by source id, load config, call adapters in parallel, enforce limits/timeout; no connector-specific logic. |
| **LLM** | Abstract interface + OpenRouter implementation (and MockLLM when no key); intent and synthesis calls; response parsing. |
| **Answer orchestration** | End-to-end ask pipeline: auth → routing → fetch → synthesis → persist → audit → response. |
| **Chat** | Conversations and messages persistence, listing; answer_sources persistence. |
| **Audit** | Append-only audit log writes (no full PII). |
| **Prompts loader** | Load prompt text and taxonomy from packages/prompts (or config); used by routing and LLM. |
| **Secrets / config** | Encryption/decryption of credentials; env and feature flags; no secrets in logs. |

---

## 2. Module responsibilities (short)

- **Gateway / HTTP:** Register routers, global exception handler, request_id middleware, CORS. No business logic.
- **Auth:** Validate Supabase JWT; load profile (tenant_id, role); provide `CurrentContext` (tenant_id, user_id, role). 401/403 when invalid or forbidden.
- **Tenants:** Get tenant by id (for checks); no tenant creation in this module (handled by seed or separate admin flow).
- **Integrations:** List by tenant; get by id (for orchestration); create/update with encrypted credentials; test connection (call connector registry + adapter); delete/disable. Never return raw credentials.
- **Source routing:** Run intent classification (via LLM interface); apply intent→source map; filter by tenant-enabled integrations; return ordered source ids or “no sources”.
- **Connector orchestration:** Given source ids + query + tenant_id, load integration config per source, get adapter per source, run adapters in parallel with timeout/limits, aggregate fragments and errors. No knowledge of Bitrix/Drive/Sheets specifics.
- **LLM:** Interface: `classify_intent(question: str) -> IntentLabel` and `synthesize_answer(question: str, fragments_with_labels: list) -> SynthesisResult`. OpenRouter implementation calls OpenRouter API (OpenAI-compatible) and parses; prompts come from packages/prompts. When OPENROUTER_API_KEY is not set, MockLLM is used.
- **Answer orchestration:** Orchestrate: get context → create/load conversation and user message → routing → connector fetch → synthesis → persist message and answer_sources → audit → return DTO. Handles “no sources” and partial failure.
- **Chat:** Create conversation; create message; update message (content, status, answer); list conversations; get conversation with messages; persist answer_sources. All tenant- and user-scoped.
- **Audit:** Single method: `log(tenant_id, user_id, action, resource_type, resource_id, metadata)`. Append-only; no full question/answer in metadata.
- **Prompts loader:** Load intent taxonomy (labels), intent prompt text, synthesis prompt text from packages/prompts or env path. Cache in memory if needed. No LLM or connector code.
- **Secrets / config:** Encrypt(plaintext) and Decrypt(ciphertext) using key from env; load integration credentials and pass decrypted to connector layer only in process; never log or return.

---

## 3. Directory structure for apps/api

```
apps/api/
├── main.py                    # FastAPI app, lifespan, router include
├── config.py                  # Env loading, settings (Pydantic BaseSettings)
├── dependencies.py             # FastAPI dependencies: get_current_context, get_db, etc.
│
├── api/
│   ├── __init__.py
│   ├── v1/
│   │   ├── __init__.py
│   │   ├── router.py          # Aggregates v1 route modules
│   │   ├── conversations.py  # POST /conversations, GET /conversations, GET /conversations/{id}
│   │   ├── messages.py       # POST /conversations/{id}/messages (ask)
│   │   └── admin/
│   │       ├── __init__.py
│   │       ├── router.py     # Prefix /admin
│   │       ├── integrations.py  # GET/POST /admin/integrations, GET/PATCH/DELETE /admin/integrations/{id}, POST test
│   │       └── audit.py      # GET /admin/audit (optional)
│   └── errors.py              # HTTP exception handlers, error response schema
│
├── core/
│   ├── __init__.py
│   ├── auth.py                # JWT validation, context resolution
│   ├── context.py             # CurrentContext (tenant_id, user_id, role)
│   └── secrets.py             # Encrypt/decrypt helpers (or use Supabase Vault client)
│
├── domain/
│   ├── __init__.py
│   ├── tenants.py             # Tenant repo/service (get by id)
│   ├── integrations.py        # Integration repo + “test connection” (uses connector registry)
│   ├── chat.py                # Conversation + message repo/service
│   └── audit.py               # Audit log write
│
├── services/
│   ├── __init__.py
│   ├── routing/
│   │   ├── __init__.py
│   │   ├── intent.py          # Intent classification (calls LLM interface)
│   │   ├── source_selector.py # Intent → source ids, tenant filter
│   │   └── taxonomy.py        # Intent labels + intent→sources map (from config/prompts)
│   ├── connectors/
│   │   ├── __init__.py
│   │   ├── registry.py        # Resolve adapter by source_id (from packages.connectors)
│   │   ├── runner.py          # Parallel fetch with timeout/limits; aggregates results
│   │   └── contract.py        # In-process types for adapter I/O (or re-export from shared)
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── interface.py       # Abstract LLM interface (classify_intent, synthesize_answer)
│   │   └── openrouter.py      # OpenRouter implementation
│   ├── prompts_loader.py      # Load prompts/taxonomy from packages/prompts
│   └── orchestration/
│       ├── __init__.py
│       └── ask.py             # Full ask pipeline (routing → connectors → LLM → persist → audit)
│
├── models/                    # SQLAlchemy or Supabase client models (DB shape)
│   ├── __init__.py
│   ├── tenant.py
│   ├── profile.py             # or tenant_member
│   ├── integration.py
│   ├── conversation.py
│   ├── message.py
│   ├── answer_source.py
│   └── audit_log.py
│
├── schemas/                   # Pydantic DTOs (request/response)
│   ├── __init__.py
│   ├── common.py              # ErrorResponse, PaginationMeta
│   ├── context.py             # (internal) CurrentContext
│   ├── conversations.py
│   ├── messages.py
│   ├── integrations.py
│   ├── routing.py             # IntentLabel, SourceId, etc.
│   └── audit.py
│
└── tests/
    ├── __init__.py
    ├── conftest.py            # Fixtures: client, mock context, mock LLM, mock connectors
    ├── api/
    │   ├── test_conversations.py
    │   ├── test_messages.py
    │   └── test_admin_integrations.py
    ├── services/
    │   ├── test_routing.py
    │   ├── test_connector_runner.py
    │   └── test_ask_orchestration.py
    └── unit/
        └── test_source_selector.py
```

**Boundaries:** `api/` only uses `services/`, `domain/`, `schemas/`, `dependencies`. `services/orchestration` uses `services/routing`, `services/connectors`, `services/llm`, `domain/chat`, `domain/audit`. Connector implementations live in `packages/connectors`; `services/connectors/registry` imports and returns them.

---

## 4. Entities and DTOs

### Entities (DB / persistence)

| Entity | Table | Key fields |
|--------|-------|------------|
| **Tenant** | tenants | id, name, slug?, settings (jsonb), created_at |
| **Profile** | profiles or tenant_members | id, tenant_id, user_id (auth), role (end_user \| tenant_admin), created_at |
| **Integration** | integrations | id, tenant_id, type (bitrix \| google_drive \| google_sheets), display_name, enabled, credentials_encrypted, config (jsonb), last_tested_at, last_error, created_at, updated_at |
| **Conversation** | conversations | id, tenant_id, user_id, title?, created_at, updated_at |
| **Message** | messages | id, conversation_id, role (user \| assistant), content, status (pending \| completed \| partial \| failed), created_at |
| **AnswerSource** | answer_sources | id, message_id, integration_id?, source_type, title, link?, fragment_count, created_at |
| **AuditLog** | audit_logs | id, tenant_id, user_id, action, resource_type, resource_id, metadata (jsonb), created_at |

### DTOs (schemas) — request/response

| DTO | Direction | Use |
|-----|-----------|-----|
| **ConversationCreate** | Request | (optional) title |
| **ConversationOut** | Response | id, tenant_id, user_id, title?, created_at, updated_at |
| **ConversationListOut** | Response | items: ConversationOut[], total?, cursor? |
| **MessageCreate** | Request | content (user question) |
| **MessageOut** | Response | id, conversation_id, role, content, status, answer?, sources?: SourceItemOut[], created_at |
| **SourceItemOut** | Response | id?, type, title, link? |
| **AskResponse** | Response | message: MessageOut (with answer and sources) |
| **IntegrationOut** | Response | id, type, display_name, enabled, last_tested_at?, last_error?, created_at (no credentials) |
| **IntegrationCreate** | Request | type, display_name?, credentials (OAuth tokens or api_key), config? |
| **IntegrationUpdate** | Request | display_name?, enabled?, credentials?, config? |
| **IntegrationTestResult** | Response | success, error? |
| **AuditEntryOut** | Response | id, action, resource_type, resource_id, user_id?, metadata?, created_at |
| **ErrorResponse** | Response | code, message, details? |
| **CurrentContext** | Internal | tenant_id, user_id, role (not exposed in API) |

Internal (service layer) DTOs: **IntentLabel**, **SourceId**, **ConnectorInput**, **ConnectorOutput**, **FragmentWithLabel**, **SynthesisResult** — can live in `schemas/routing.py` or in `services/` and align with `packages/shared` types where applicable.

---

## 5. Endpoints (list)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| **Conversations** | | | |
| POST | /api/v1/conversations | Yes | Create conversation (tenant, user from context). |
| GET | /api/v1/conversations | Yes | List conversations for current user (tenant-scoped). |
| GET | /api/v1/conversations/{id} | Yes | Get conversation with messages (ownership check). |
| **Messages (ask)** | | | |
| POST | /api/v1/conversations/{id}/messages | Yes | Create user message and run ask pipeline; return assistant message with answer and sources. |
| **Admin — integrations** | | | tenant_admin only |
| GET | /api/v1/admin/integrations | Yes | List integrations for tenant (no credentials). |
| POST | /api/v1/admin/integrations | Yes | Add integration (credentials encrypted, test before save). |
| GET | /api/v1/admin/integrations/{id} | Yes | Get one integration (no credentials). |
| PATCH | /api/v1/admin/integrations/{id} | Yes | Update (display_name, enabled, or re-auth credentials). |
| DELETE | /api/v1/admin/integrations/{id} | Yes | Disable or delete integration. |
| POST | /api/v1/admin/integrations/{id}/test | Yes | Test connection (no persist). |
| **Admin — audit** | | | tenant_admin only, optional in MVP |
| GET | /api/v1/admin/audit | Yes | List recent audit entries for tenant. |
| **Health** | | | |
| GET | /health | No | Liveness (and optional readiness: DB + env). |

---

## 6. Domain services (list)

| Service | Layer | Responsibility |
|---------|--------|----------------|
| **TenantService** | domain/tenants | Get tenant by id; optional: get settings. No creation in MVP. |
| **IntegrationService** | domain/integrations | List by tenant; get by id; create (encrypt credentials, test, then save); update; delete; load config for connector (decrypt, return in-memory only). |
| **ChatService** | domain/chat | Create conversation; create message; update message (content, status, answer); list conversations; get conversation with messages; create answer_sources for a message. All scoped by tenant_id and user_id. |
| **AuditService** | domain/audit | Append audit log entry (tenant_id, user_id, action, resource_type, resource_id, metadata). No read in domain (read in API or optional admin query). |

These are the “repositories” or “domain use cases” that orchestration and API call. They do not call LLM or connector adapters directly (except IntegrationService for “test connection”, which uses connector registry).

---

## 7. Connector contracts (list)

Defined in `packages/shared` (or `services/connectors/contract.py` re-exporting shared). Used by `packages/connectors` adapters and by `services/connectors/runner`.

**Input (per connector call):**

- **ConnectorInput**
  - `query_text: str`
  - `config: ConnectorConfig` (credentials + config json; adapter-specific shape behind interface)
  - `limits: ConnectorLimits` (max_fragments_per_source: int, timeout_seconds: int)

**Output:**

- **ConnectorOutput**
  - `success: bool`
  - `fragments: list[Fragment]` (content: str, optional metadata)
  - `source_metadata: SourceMetadata` (source_id: str, type: str, title: str, link: str | None)
  - `error: str | None`

**Contract rules:** Same input/output for all adapters. Adapters in `packages/connectors` implement a single interface (e.g. `async def fetch(input: ConnectorInput) -> ConnectorOutput`). Registry in `apps/api` maps source_id (e.g. "bitrix") to adapter instance. Orchestration does not know adapter internals; it only passes config and limits and aggregates outputs.

---

## 8. Orchestration services (list)

| Service | Location | Responsibility |
|---------|----------|----------------|
| **IntentClassifier** | services/routing/intent.py | Calls LLM interface to classify question → IntentLabel. Uses prompts loader. |
| **SourceSelector** | services/routing/source_selector.py | Given IntentLabel, resolve source ids from taxonomy; filter by tenant-enabled integrations; return list of SourceId or empty. |
| **ConnectorRunner** | services/connectors/runner.py | Given list of source ids, tenant_id, query_text, limits: load config per source, get adapter per source, run adapters in parallel with timeout, aggregate ConnectorOutput list (with per-source errors). No connector-specific logic. |
| **LLMProvider** | services/llm/interface.py + openrouter.py | Abstract: classify_intent(question), synthesize_answer(question, fragments_with_labels). OpenRouter impl: load prompts, call OpenRouter API, parse. MockLLM when no API key. |
| **PromptsLoader** | services/prompts_loader.py | Load intent taxonomy, intent prompt, synthesis prompt from packages/prompts (or env path). Expose to routing and LLM. |
| **AskOrchestrator** | services/orchestration/ask.py | Full pipeline: get context → create/load conversation and user message → IntentClassifier → SourceSelector → (if empty: return “no sources”) → ConnectorRunner → LLMProvider.synthesize_answer → ChatService update message + answer_sources → AuditService.log → return MessageOut with answer and sources. Handles partial failure (some connectors fail) and sets message status. |

Dependencies: AskOrchestrator depends on IntentClassifier, SourceSelector, ConnectorRunner, LLMProvider, ChatService, AuditService, PromptsLoader. No direct dependency on concrete connector implementations; only on registry and contract.

---

## 9. Env vars (list)

| Variable | Required | Description |
|----------|----------|-------------|
| **SUPABASE_URL** | Yes | Supabase project URL. |
| **SUPABASE_SERVICE_ROLE_KEY** | Yes | Server-side key for DB and Auth (admin). Not for client. |
| **SUPABASE_JWT_SECRET** | Yes | Used to verify JWT from Supabase Auth (or use JWKS). |
| **ENCRYPTION_KEY** | Yes | Key for encrypting/decrypting integration credentials (e.g. 32-byte hex). |
| **OPENROUTER_API_KEY** | For LLM | OpenRouter API key (from openrouter.ai); when unset, MockLLM is used. |
| **OPENROUTER_MODEL** | No | Model id in OpenRouter (e.g. openai/gpt-4o-mini, anthropic/claude-3.5-sonnet); default openai/gpt-4o-mini. |
| **PROMPTS_PATH** | No | Path to packages/prompts assets (default: relative to repo or package). |
| **LOG_LEVEL** | No | debug, info, warning, error. |
| **CORS_ORIGINS** | No | Comma-separated origins for CORS (default for local dev). |
| **REQUEST_TIMEOUT_SECONDS** | No | Global request timeout (optional). |
| **CONNECTOR_TIMEOUT_SECONDS** | No | Per-connector timeout (default e.g. 30). |
| **MAX_FRAGMENTS_PER_SOURCE** | No | Default limit per connector (e.g. 20). |
| **MAX_TOTAL_FRAGMENTS** | No | Max fragments passed to LLM (e.g. 50). |

Secrets: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, ENCRYPTION_KEY, OPENROUTER_API_KEY must not be logged or exposed. Load via env only (or secret manager in production).

---

## 10. Things to mock at start (testability)

| Target | Mock purpose | Used in |
|--------|--------------|---------|
| **Supabase client** | Avoid real DB in unit/integration tests; control tenant/user data and RLS. | All domain and API tests. |
| **CurrentContext / Auth** | Inject known tenant_id, user_id, role without JWT. | API tests, orchestration tests. |
| **LLM interface** | Return fixed IntentLabel and fixed SynthesisResult; no real OpenRouter/API calls. | Routing tests, ask orchestration tests. |
| **Connector registry** | Return mock adapter that returns fixed ConnectorOutput (success + fragments). | Connector runner tests, ask orchestration tests. |
| **Prompts loader** | Return fixed prompt strings and taxonomy; no file I/O. | Intent and synthesis tests. |
| **Secrets / encryption** | No-op encrypt/decrypt or in-memory key for tests. | Integration service tests (save/load config). |
| **Audit log** | In-memory append or no-op so tests don’t require audit table. | Ask orchestration tests. |

**Suggested order:** Implement LLM interface and connector registry from day one so orchestration and routing depend on abstractions. Use mock implementations in tests; use real OpenRouter and real adapters only in E2E or manual runs. This keeps routing and orchestration testable without external services.

---

## Document control

- **Related:** docs/technical-blueprint.md, docs/mvp-backlog.md, docs/monorepo-structure.md.
- **Next step:** Implement modules in order of MVP backlog (foundation → auth → domain → connector framework → routing → orchestration → endpoints).
