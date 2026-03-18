# Bitrix CRM connector — design

Design for the first connector: Bitrix24 CRM. Fits the shared connector contract; used by source routing and orchestration; returns normalized business objects only. Rest of the app never sees raw Bitrix payloads.

**Related:** docs/connector-framework.md (contract, config, secrets, errors, timeout).

---

## 1. Bitrix connector responsibility

**In scope:**

- **Single responsibility:** Given a user question (query_text) and tenant config, call Bitrix24 REST API to fetch relevant CRM data (deals, contacts, optionally activities), normalize to Fragment[] + SourceMetadata, and return ConnectorOutput. No orchestration, no LLM, no routing logic.
- **Implement framework contract:** `fetch(ConnectorInput) -> ConnectorOutput` and optional `test_connection(config) -> TestResult`.
- **Encapsulate Bitrix:** All Bitrix-specific details (endpoints, field names, pagination, auth) live inside this connector. Callers only see source_id "bitrix", ConnectorInput, and ConnectorOutput.
- **Normalize only:** Map Bitrix entities to a small set of logical CRM object types (deal, contact) and to Fragment.content + optional Fragment.metadata. Do not expose raw JSON or Bitrix field names outside the connector.

**Out of scope:**

- Other Bitrix modules (e.g. tasks, calendar) in MVP; only CRM entities needed for “status klienta”, “oferta”, “kontakt” style questions.
- OAuth flow in MVP if webhook is sufficient; can add OAuth later without changing the contract.

---

## 2. Shared connector contract (CRM in the framework)

The connector implements the **common** connector contract (ConnectorInput / ConnectorOutput / Fragment / SourceMetadata). There is no separate “CRM contract” type in the framework; the CRM semantics are expressed by:

- **source_id:** `"bitrix"`.
- **SourceMetadata.type:** `"crm"` so the UI and synthesis know this is CRM data.
- **Fragment.content:** Human-readable summary of one logical CRM entity (e.g. one deal or one contact). No raw Bitrix field names in content; use neutral labels (e.g. “Deal: X, Stage: Y, Amount: Z”).
- **Fragment.metadata:** Optional structured provenance: e.g. `entity_type: "deal" | "contact"`, `entity_id`, `link` (URL to open in Bitrix). Orchestration and UI can use this for “open in CRM” links; they do not depend on Bitrix-specific keys.

So the “CRM connector contract” is: implement the same ConnectorInput/ConnectorOutput as every other connector; for Bitrix, consistently use type `"crm"`, and normalize entities to a small set of entity_type values and readable content. Future CRM connectors (e.g. HubSpot) would do the same: same output shape, type `"crm"`, their own entity_type and links.

**Contract summary:**

- **Input:** ConnectorInput (query_text, config, limits). Config for Bitrix: see §5.
- **Output:** ConnectorOutput (success, fragments, source_metadata, error). source_metadata.source_id = "bitrix", source_metadata.type = "crm". Fragments are normalized deals/contacts (and optionally activities), not raw API responses.

---

## 3. Operations needed in MVP

**Goal:** Support questions like “Jaki jest status klienta X?”, “Jaka była oferta z 17 marca?”, “Dane kontaktu Y.” So we need to **search or list** deals and contacts, optionally filtered by query_text (e.g. by title, company name, or date).

**MVP operations:**

| Operation        | Bitrix API (conceptual) | Purpose |
|------------------|-------------------------|---------|
| **Search/list deals** | crm.deal.list (or crm.item.list with entityTypeId=deal) with filter/order | Find deals by title, stage, date, or keyword; return up to limits.max_fragments. |
| **Search/list contacts** | crm.contact.list (or crm.item.list for contacts) with filter/order | Find contacts by name, company; return up to limit. |
| **Test connection** | Single lightweight call (e.g. crm.deal.list with start=0, limit=1 or user.current) | Verify webhook and permissions; no business data needed. |

**Not in MVP:**

- Writing to Bitrix (create/update deal or contact).
- Activities, products, or custom fields beyond what’s needed for a short summary (can add later).
- Batch or multi-step “conversation” with Bitrix; we only do one fetch per connector call (orchestration may call once per ask).

**Query interpretation:**

- query_text is free-form (e.g. “klient Acme”, “oferta z marca”). Adapter uses it to build Bitrix filters where possible (e.g. TITLE like %Acme%, or DATE_CREATE in March). Simple strategy for MVP: if query looks like a name or keyword, use filter on TITLE/COMPANY_TITLE/NAME; else fetch recent deals and recent contacts within limit and let LLM pick. No NLU inside the connector; keep filter logic simple (keyword in title/name, optional date range).

---

## 4. Data normalization model

**Principle:** Every piece of data returned to the runner is a Fragment with content (text for LLM) and optional metadata (entity_type, id, link). No Bitrix field names (e.g. STAGE_ID, CURRENCY_ID) in content; use neutral, readable text.

**Entity types (logical, inside connector):**

- **Deal** — One fragment per deal. content: short summary (title, stage, amount, date, optional contact/company). metadata: entity_type="deal", entity_id=Bitrix deal id, link=URL to deal in Bitrix (if we can build it from config).
- **Contact** — One fragment per contact. content: name, company, phone/email if useful, optional note. metadata: entity_type="contact", entity_id=Bitrix contact id, link=URL to contact.

**Content format (recommended):**

- Plain text or minimal markdown. Example deal: `Deal: "Oferta dla Acme" | Stage: Wygrana | Amount: 10 000 PLN | Date: 2024-03-17 | Contact: Jan Kowalski`. Example contact: `Contact: Jan Kowalski | Company: Acme | Email: jan@acme.com`. Keep each fragment concise so many fragments fit within limits and LLM context.
- Truncation: if a field is very long, truncate (e.g. description to first N chars). Prefer key fields (title, stage, amount, date) over full description for MVP.

**SourceMetadata:**

- source_id: `"bitrix"`.
- type: `"crm"`.
- title: From config (e.g. display_name “Bitrix — Acme”) or default “Bitrix24”.
- link: Base URL of the Bitrix24 instance (from config) so user can open CRM; or null if not available.

**Mapping from Bitrix response:**

- Bitrix returns arrays of objects with fields like ID, TITLE, STAGE_ID, OPPORTUNITY, CURRENCY_ID, DATE_CREATE, CONTACT_ID, etc. Connector maps these to the logical deal/contact summary above; STAGE_ID can be resolved to a human-readable stage name if a small static map or config is available (optional). No raw field names in Fragment.content.

---

## 5. Auth / tokens / secret storage

**Auth method for MVP: Inbound webhook.**

- Bitrix24 allows an inbound webhook per user/app: URL like `https://<domain>.bitrix24.com/rest/<user_id>/<webhook_code>/`. Each request is authenticated by the URL; no separate token in header for webhook.
- **Stored as secret:** Either (a) full webhook URL, or (b) domain + user_id + webhook_code. Prefer (a) for simplicity: one string, no parsing. Store encrypted in integrations.credentials_encrypted (e.g. json `{"webhook_url": "https://…"}`). Backend decrypts and passes to adapter in ConnectorConfig; adapter uses it as base URL for REST calls (append method name, e.g. `crm.deal.list`).
- **No tokens in frontend.** Admin enters webhook URL in a single field (or domain + webhook code if we split). Backend saves encrypted; never returned to client. Test connection uses same decrypted URL.

**Optional later: OAuth 2.0.**

- If webhook is not enough (e.g. per-user OAuth), credentials shape would extend to access_token + refresh_token; connector would refresh when needed. Design of config (opaque to framework) stays the same; only the adapter’s interpretation of config changes.

**Config shape (adapter-specific, opaque to framework):**

- webhook_url: str (required). Base URL including path up to and including webhook code, e.g. `https://my.bitrix24.com/rest/1/abc123/`.
- display_name: str (optional). For SourceMetadata.title.
- Optional: base_link_for_entity (e.g. `https://my.bitrix24.com/crm/deal/details/`) to build per-entity links. If not set, link in metadata can be null or only SourceMetadata.link set to webhook base.

---

## 6. Retry / timeout / pagination / rate limit

**Timeout:**

- Adapter uses the same timeout as ConnectorLimits.timeout_seconds for all HTTP calls to Bitrix (single call or sum of paginated calls). If Bitrix is slow, adapter returns within timeout with whatever fragments were collected so far (partial success) or with success=false and error="timeout" if nothing was received.
- Runner also enforces a hard timeout; if adapter does not return in time, runner returns ConnectorOutput(success=false, error="timeout"). Adapter should not rely on runner only; it should itself limit total time (e.g. stop after first page if one page already took too long).

**Retry:**

- No retry inside the Bitrix adapter in MVP. One attempt per fetch. If Bitrix returns 5xx or network error, adapter returns ConnectorOutput(success=false, error="…"). Optional: runner-level single retry for 503; adapter stays retry-free.

**Pagination:**

- Bitrix list methods support start and limit (e.g. start=0, limit=50). Adapter fetches pages until it has enough fragments (up to limits.max_fragments) or no more data. Stop early when fragment count is reached to avoid unnecessary requests. If a single page is large (e.g. 50 deals), map only the first N to fragments that fit in max_fragments.
- Order: use a sensible default (e.g. DATE_CREATE desc for deals) so “recent” appears first. query_text can refine filter but not necessarily order in MVP.

**Rate limit:**

- Bitrix may return 429 or a “too many requests” style response. Adapter catches it and returns ConnectorOutput(success=false, error="rate limited", fragments=[] or partial). No automatic backoff inside adapter. If we already got some fragments before hitting rate limit, return partial (success=true or false with error message and partial fragments).

---

## 7. Partial failures

**Scenarios:**

- **Network/HTTP error on first request:** success=false, fragments=[], error="Bitrix unavailable" or similar. No partial data.
- **Timeout after one or more pages:** success=true if at least one fragment was collected; fragments=collected; error="timeout" or null. Orchestration can still use the fragments; optional warning in UI.
- **Rate limit (429) after some data:** success=true, fragments=collected so far, error="rate limited". Same: use what we have.
- **Auth/configuration error (4xx, invalid webhook):** success=false, fragments=[], error="Invalid or expired webhook". No retry with same config.
- **Empty result (no deals/contacts match):** success=true, fragments=[], error=null. Not a failure; orchestration treats as “no data from this source”.

**Contract:**

- Adapter never raises; it always returns ConnectorOutput. On unexpected exception, catch and return ConnectorOutput(success=false, error="unexpected error", fragments=[]). Log full exception server-side.

---

## 8. Admin panel setup flow

**Steps:**

1. Admin chooses “Bitrix24” (or “CRM — Bitrix”) in “Add integration”.
2. Single credential field: **Webhook URL** (or two fields: Bitrix24 domain + Webhook code, and backend builds URL). Help text: “Create an inbound webhook in Bitrix24 (REST API), copy the URL here. Keep it secret.”
3. Optional: Display name (e.g. “Bitrix — Acme”).
4. “Test connection”: backend decrypts, calls adapter’s test_connection(config). Adapter calls Bitrix (e.g. crm.deal.list with start=0, limit=1 or user.current). On success: “Connected.” On failure: show error (e.g. “Invalid webhook” or “Access denied”).
5. “Save”: only if test succeeded (MVP rule). Backend encrypts webhook URL (and optional display_name in config json), stores in integrations row; sets last_tested_at, clears last_error.
6. Later: “Reconnect” = same form; admin pastes new webhook URL; test → save. Old URL is replaced; no versioning in MVP.

**No OAuth redirect in MVP.** If Bitrix is only used via webhook, no redirect flow. When adding OAuth later, admin would click “Connect with Bitrix”, redirect to Bitrix, callback with code; backend exchanges for tokens and stores them in credentials_encrypted; connector config shape would then include access_token/refresh_token instead of or in addition to webhook_url (adapter decides which to use).

**Validation:**

- Backend or adapter validates webhook URL format (e.g. https, contains bitrix24.com or custom domain, path contains /rest/). Invalid format → error before test. Adapter validates again in test_connection and returns clear message if Bitrix responds with 403/404.

---

## 9. Test strategy for the connector

**Unit tests (adapter in isolation):**

- **Normalization:** Given a mock Bitrix JSON response (e.g. one deal, one contact), assert Fragment.content and Fragment.metadata (entity_type, entity_id, link) and SourceMetadata. No real HTTP.
- **Config validation:** Invalid or missing webhook_url in config → test_connection or fetch returns success=false and clear error.
- **Empty result:** Mock Bitrix returns empty list → ConnectorOutput(success=true, fragments=[], error=null).
- **Partial + error:** Mock first page success, second page returns 429 → ConnectorOutput with fragments from first page and error set.

**Integration tests (optional, with real Bitrix or test instance):**

- Use a test Bitrix24 portal and a test webhook. Test: test_connection succeeds; fetch with a simple query returns at least one fragment and correct source_metadata. Mark as integration test; skip in CI without credentials.
- **Contract test:** Call fetch with ConnectorInput; assert return type is ConnectorOutput and shape matches framework (success, fragments, source_metadata, error). Ensures adapter never leaks raw Bitrix payloads.

**Mocking for orchestration/runner tests:**

- Runner and orchestration tests use a **mock Bitrix adapter** that returns a fixed ConnectorOutput (e.g. two fragments, one SourceMetadata). No real Bitrix dependency. Bitrix adapter itself is tested in unit tests above.

**No end-to-end tests in this doc;** those belong to the broader ask-flow tests (mock connector in runner).

---

## 10. File structure for the Bitrix connector

**Location:** packages/connectors (or packages/connectors/bitrix if we group by connector).

**Suggested layout:**

```
packages/connectors/
├── shared/                          # or in packages/shared
│   └── contract.py                  # ConnectorInput, ConnectorOutput, Fragment, SourceMetadata, ConnectorLimits
├── bitrix/
│   ├── __init__.py                  # Exports BitrixAdapter, maybe SOURCE_ID = "bitrix"
│   ├── adapter.py                  # BitrixAdapter: fetch(ConnectorInput) -> ConnectorOutput, test_connection(config) -> TestResult
│   ├── config.py                   # BitrixConfig (typed shape for webhook_url, display_name); parse from opaque config
│   ├── client.py                   # Thin HTTP client: build URL from config, call crm.deal.list / crm.contact.list, handle pagination
│   ├── normalizer.py               # raw deal/contact -> Fragment (content + metadata); raw response -> list[Fragment] + SourceMetadata
│   └── tests/
│       ├── unit/
│       │   ├── test_normalizer.py   # Mock Bitrix payloads -> Fragment/SourceMetadata
│       │   └── test_adapter.py     # Mock client; assert output shape and error handling
│       └── integration/             # Optional
│           └── test_bitrix_live.py # Skip without env; real webhook
```

**Responsibilities per file:**

- **adapter.py:** Implements framework interface. Uses client and normalizer. Validates config; on client errors, returns ConnectorOutput with success=false and error message. No Bitrix URLs or field names in public method signatures.
- **config.py:** Defines BitrixConfig (webhook_url, display_name, optional base_link). Parse from dict that runner passes (opaque ConnectorConfig). Validate required fields.
- **client.py:** All HTTP to Bitrix. Methods like list_deals(filter, order, start, limit) and list_contacts(…) returning raw dicts/lists. Handle 4xx/5xx/429 and raise or return a small result type that adapter converts to ConnectorOutput. Pagination loop can live here or in adapter.
- **normalizer.py:** Pure functions: raw_deal_to_fragment(deal: dict, base_link?: str) -> Fragment; raw_contact_to_fragment(contact: dict, base_link?: str) -> Fragment; build_source_metadata(config: BitrixConfig) -> SourceMetadata. No HTTP.

**Registry (in apps/api):** Register source_id "bitrix" -> BitrixAdapter instance. No Bitrix-specific imports in orchestration; only registry lookup by "bitrix".

---

## Document control

- **Related:** docs/connector-framework.md, docs/backend-architecture.md.
- **Next step:** Implement contract in packages/shared or packages/connectors, then Bitrix adapter, config, client, normalizer, and tests according to this design. No full implementation in this doc.
