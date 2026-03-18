# Connector framework — design

Design for a single connector model and adapter layer. Application logic does not depend on provider-specific details. Practical and minimal; no overengineering.

**Scope:** CRM, documents, spreadsheets in MVP; more source types later. Same contract for all.

---

## 1. Connector framework architecture

**Layers:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Orchestration (apps/api)                                        │
│  Knows: source_id, query_text, limits. Does not know Bitrix/     │
│  Drive/Sheets. Calls ConnectorRunner with list of source_ids.     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Connector runner (apps/api)                                      │
│  Loads config per source_id (with decrypted secrets).            │
│  Resolves adapter from Registry by source_id.                     │
│  Invokes adapter with ConnectorInput; enforces timeout & limits.  │
│  Aggregates ConnectorOutput; returns list of results + errors.    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Registry                                                         │
│  Maps source_id (e.g. "bitrix") → adapter instance.               │
│  Adapters implement same interface; no provider logic here.       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Adapters (packages/connectors)                                   │
│  BitrixAdapter, GoogleDriveAdapter, GoogleSheetsAdapter.         │
│  Each: fetch(ConnectorInput) → ConnectorOutput.                    │
│  Normalize provider data to Fragment[] + SourceMetadata.           │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
                    External APIs (Bitrix, Google)
```

**Rules:**

- Orchestration never imports or references a specific adapter (Bitrix, Drive, etc.). It only uses source_id strings and the runner.
- Runner and registry live in apps/api (or a thin layer that apps/api depends on). Adapter implementations live in packages/connectors.
- One interface for all adapters: same input type, same output type. Adapter-specific details (auth, endpoints, pagination) stay inside the adapter.

---

## 2. Connector types in MVP

| source_id    | Type (logical) | Provider   | Purpose in MVP                    |
|-------------|----------------|------------|-----------------------------------|
| **bitrix**  | CRM            | Bitrix24   | Deals, contacts, activities       |
| **google_drive** | Documents | Google Drive | Files, search, optional text snippet |
| **google_sheets** | Spreadsheets | Google Sheets | Spreadsheets, ranges, cell data   |

**Naming:** source_id is a stable, lowercase identifier (e.g. `bitrix`, `google_drive`, `google_sheets`). Used in registry, config, and intent→source mapping. Display name (e.g. "Bitrix24", "Google Drive") is per integration or from a small static map.

**Adding a connector later:** Implement adapter that satisfies the contract; register it under a new source_id; add to intent→source map and admin UI. No change to orchestration or runner.

---

## 3. Common interfaces / contracts

**Single adapter interface:**

- **Method:** `fetch(input: ConnectorInput) -> ConnectorOutput` (sync or async depending on stack). No other methods required for the “ask” flow. Optional: `test_connection(config: ConnectorConfig) -> TestResult` for admin “test before save”.

**ConnectorInput:**

- `query_text: str` — User question or search-like text; adapter uses it to filter or search.
- `config: ConnectorConfig` — Opaque per adapter. Runner passes whatever was stored for this tenant’s integration (credentials + optional settings). Type: struct/dict that each adapter knows how to read; framework does not interpret fields.
- `limits: ConnectorLimits` — `max_fragments: int`, `timeout_seconds: int`. Adapter should respect them; runner enforces timeout at call boundary.

**ConnectorOutput:**

- `success: bool` — True if at least some data was fetched; false on total failure.
- `fragments: list[Fragment]` — Zero or more items. Each: `content: str` (text for LLM), optional `metadata: dict` (adapter-specific; not required for MVP).
- `source_metadata: SourceMetadata` — One per call: `source_id: str`, `type: str` (e.g. "crm", "documents", "spreadsheets"), `title: str` (e.g. "Bitrix — Acme"), `link: str | None` (e.g. link to deal or file).
- `error: str | None` — Present when success is false or partial; short message for logging and UI (“Bitrix temporarily unavailable”).

**Fragment:**

- `content: str` — Required. Plain or markdown text; one logical piece (e.g. one deal, one file snippet, one sheet range).
- `metadata: dict | None` — Optional; adapter can put id, type, link here for provenance; orchestration can pass through to synthesis if needed.

**SourceMetadata:**

- One per connector call (not per fragment). Identifies the source in the answer and in the UI. Same shape for all adapters.

**Contract rules:**

- All adapters return the same output shape. No provider-specific fields in the contract; provider-specific logic stays inside the adapter and is normalized to Fragment + SourceMetadata.
- Runner treats ConnectorConfig as opaque: load from DB (decrypted), pass to adapter. No framework logic on config keys.

---

## 4. Per-tenant connector configuration model

**Where it lives:** One row per tenant per connector type (e.g. `integrations` table: tenant_id, type/source_id, credentials_encrypted, config, enabled, last_tested_at, last_error).

**Config contents (logical):**

- **Credentials** — Stored encrypted; decrypted only in backend when building ConnectorConfig for the runner. Shape depends on adapter (e.g. api_key for Bitrix; refresh_token + access_token for Google). Never logged or sent to frontend.
- **Settings (optional)** — Adapter-specific: e.g. Drive root folder id, Sheets default spreadsheet id. Stored in a `config` json field next to credentials; merged into ConnectorConfig when loading.

**One integration per source_id per tenant in MVP.** No multiple Bitrix or multiple Drive per tenant. Config is “the” config for that source_id in that tenant.

**Loading for a call:** Given tenant_id and source_id, load integration row; decrypt credentials; build ConnectorConfig (credentials + config json); pass to adapter via ConnectorInput. If integration missing or disabled, runner does not call adapter (handled earlier by source selection).

---

## 5. Secret storage model

**Principle:** Secrets exist only in backend memory when needed; never in logs, frontend, or repository.

**Storage:**

- **Where:** Encrypted column in DB (e.g. `integrations.credentials_encrypted`) or Supabase Vault. Per-tenant credentials; one blob per integration.
- **Format:** Opaque to framework. Adapter expects a decrypted config; a small “credentials loader” in apps/api decrypts using a single key from env and returns a struct/dict the adapter understands (e.g. `{ "api_key": "…" }` or `{ "access_token": "…", "refresh_token": "…" }`).
- **Key:** Single ENCRYPTION_KEY in env (e.g. 32-byte). Same key for all tenants in MVP. Rotation = re-encrypt all credentials with new key (out of scope for MVP).

**Flow:**

- **Write:** Admin saves integration → API receives credentials in request body → encrypt → store. Never store plaintext.
- **Read:** Runner needs to call adapter → load row → decrypt in process → build ConnectorConfig → pass to adapter → discard decrypted value after call. No caching of decrypted credentials in MVP.
- **Test connection:** Same as read: decrypt, call adapter’s test_connection (or fetch with minimal query), return success/failure, discard secrets.

---

## 6. Data normalization model

**Goal:** Every adapter produces the same output shape. Provider-specific responses (Bitrix REST, Drive API, Sheets API) are normalized inside the adapter.

**Normalization rules:**

- **Fragment.content** — Text the LLM can use. Adapter decides granularity: one deal as one fragment, one file as one fragment, or one sheet range as one. Prefer concise, relevant text; avoid huge dumps. Truncate or summarize if needed to stay within limits.
- **Fragment.metadata** — Optional. Adapter can add `link`, `id`, `type` for provenance; orchestration may pass to synthesis or only to answer_sources in DB.
- **SourceMetadata** — One per call. source_id and type are fixed for that adapter; title can be tenant/config-based (e.g. “Bitrix — My Company”); link can be a generic dashboard or empty if no single link.

**No shared “schema” for provider payloads.** Each adapter knows its API and maps to Fragment + SourceMetadata. Framework only consumes the normalized output.

**Example (conceptual):** Bitrix returns a list of deals. Adapter maps each deal to a Fragment (content = summary text + key fields), then returns one SourceMetadata (type "crm", title "Bitrix", link to Bitrix base URL or first deal). Same idea for Drive (one fragment per file or per snippet) and Sheets (one fragment per range or sheet).

---

## 7. Health checks / validation model

**Two use cases:**

1. **Test connection (admin)** — Before or after save. “Can we call the provider with this config?” No production query; minimal call (e.g. list one item or ping).
2. **Per-request validation** — Runner only calls adapter when integration exists and is enabled; config is loaded and decrypted. No separate “health” call in the ask path.

**Test connection design:**

- **Who:** Backend, in admin flow. Frontend triggers “Test” or “Save” (and save implies test in MVP).
- **How:** Load config (decrypt) → get adapter by source_id → call adapter’s `test_connection(config)` or a minimal `fetch` with a trivial query. Adapter returns success or error message.
- **Result:** Success → clear last_error, set last_tested_at. Failure → return error to client; optionally set last_error on integration row. No retry in MVP; user retries manually.

**No periodic health checks in MVP.** No background job pinging connectors. Optional later: cron that updates last_tested_at / last_error.

**Validation:**

- Config shape is adapter-specific. Adapter validates config inside fetch or test_connection (e.g. “missing api_key”) and returns error in ConnectorOutput.error or TestResult.

---

## 8. Error handling model

**Error categories:**

- **Config / auth** — Missing or invalid credentials; expired token; wrong endpoint. Adapter returns success=false, error="…". Runner surfaces to caller (orchestration or admin test). No retry with same config for auth errors in MVP.
- **Provider / network** — Timeout, 5xx, rate limit. Adapter returns success=false (and optional partial fragments if some data was received), error="…". Runner may retry later (see §9) or return partial.
- **Limit / business** — Adapter hit max_fragments or truncated. Return success=true with fewer fragments; no error string needed, or optional “truncated” in error for logging.

**Contract:**

- Adapter never throws uncaught provider exceptions to the runner. Catch in adapter; convert to ConnectorOutput(success=false, error="…", fragments=[] or partial).
- Runner catches timeout and converts to ConnectorOutput(success=false, error="timeout", fragments=[]). Runner does not catch adapter-internal errors if adapter already returns Output.

**Orchestration:**

- One connector failure does not fail the whole ask. Runner returns a list of results; each item is either ConnectorOutput or a placeholder (source_id + error). Orchestration builds partial answer and adds “Source X unavailable” to response.

**User-facing messages:**

- Do not expose provider names or raw errors in chat unless desired (e.g. “Bitrix is temporarily unavailable”). Log full error server-side.

---

## 9. Retries / timeout / rate limit awareness

**Timeout:**

- **Runner:** Enforce a single timeout per connector call (e.g. 30s). If adapter does not return within that time, cancel (or treat as failed) and return ConnectorOutput(success=false, error="timeout"). Configurable via env (CONNECTOR_TIMEOUT_SECONDS).
- **Adapter:** Should respect timeout when calling external API (e.g. use same timeout on HTTP client). Optional: adapter returns earlier if it knows the call will exceed limit.

**Retries (MVP):**

- **Simple rule:** No automatic retry in MVP. One attempt per connector per ask. On failure, return error and partial result. Optional: one retry for transient network errors (e.g. 503) with short backoff; keep it in runner, not in adapters.
- **Admin test:** No retry; user clicks “Test” again.

**Rate limits:**

- **Awareness:** Adapters may receive 429 or provider-specific rate limit response. Normalize to ConnectorOutput(success=false, error="rate limited" or "too many requests"). Do not retry immediately in MVP; orchestration returns partial answer.
- **Mitigation:** Optional: per-tenant or per-source_id simple rate limit (e.g. max N calls per minute) in runner or API layer later. Not required for MVP.

**Summary:** Timeout in runner (and adapter). No retries or one simple retry for 5xx. Rate limit = return error and partial; no auto-backoff in MVP.

---

## 10. Extensibility for future integrations

**Adding a new connector:**

1. **Define source_id** — New stable id (e.g. `notion`, `hubspot`). Add to static list used by registry and intent→source map.
2. **Implement adapter** — New class/module in packages/connectors. Implements same interface: fetch(ConnectorInput) -> ConnectorOutput; optional test_connection(config).
3. **Register** — In registry: source_id → adapter instance. No change to runner or orchestration.
4. **Config and secrets** — Define what the adapter needs (e.g. OAuth tokens, API key). Admin UI and backend store it in same integrations table; credentials_encrypted + config json. Decrypt and pass as ConnectorConfig.
5. **Intent mapping** — Add new source_id to intent→sources map (e.g. “wiki” → [notion]). Platform/config change; no adapter change.
6. **Admin UI** — Add new option in “Add integration” (type = new source_id) and type-specific form (OAuth or API key). Backend already supports arbitrary type; only UI and validation are new.

**What does not change:**

- ConnectorInput / ConnectorOutput / Fragment / SourceMetadata.
- Runner, registry interface, orchestration.
- Secret storage and encryption (same key and flow; only payload shape per adapter).

**Optional future:**

- **Adapter discovery** — Adapters self-register by source_id so adding a new package is enough. MVP can use explicit registry map.
- **Per-connector timeouts/retries** — Config or env per source_id. MVP: global timeout and no/simple retry.
- **Connector version** — Single version per source_id in code. Later: version in config or adapter capability for backward compatibility.

---

## Document control

- **Related:** docs/technical-blueprint.md, docs/backend-architecture.md, docs/mvp-backlog.md.
- **Next step:** Implement contract types (packages/shared or packages/connectors), registry and runner (apps/api), then first adapters (Bitrix, Google Drive, Google Sheets) in packages/connectors. No full code in this doc; design only.
