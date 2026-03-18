# QA / Architecture review — AI Assistant

Critical review of the current design with focus on: tenant isolation, secret handling, source selection, live vs stale data, connector failures, partial responses, prompt/orchestration risks, admin edge cases, auditability and explainability. Output: top risks, failure modes, gaps, test priorities, MVP acceptance checklist, and recommendations before implementation.

**Scope:** Design and docs only; no code changes in this document.

---

## 1. Top risks

| # | Risk | Severity | Why it matters |
|---|------|----------|----------------|
| 1 | **Tenant_id not enforced on every path** | Critical | If any API or DB path uses tenant_id from request body, query string, or optional middleware instead of from the verified JWT/session, one tenant can read or trigger another tenant’s data (conversations, integrations, messages). Design says “tenant_id from auth” but does not explicitly list every endpoint and every DB access with “tenant_id from context only”. |
| 2 | **Intent misclassification with no recourse** | High | Intent is LLM-based. Wrong label (e.g. “documents” instead of “crm”) → wrong sources queried → wrong or empty answer. User has no way to correct or override (e.g. “use CRM for this”). Design has no confidence threshold, no “I’m not sure” path, and no fallback to “ask user to clarify”. |
| 3 | **Secrets in memory and logs** | High | Decrypted credentials exist in process when runner calls adapters. If an exception is logged with stack trace or request context, credentials could leak. Design says “never log” but does not mandate: no credentials in exception payloads, no debug dump of ConnectorConfig, and a clear code rule for where decrypted values are allowed. |
| 4 | **Citation index mismatch** | High | Synthesis returns cited_source_indices [1], [2]. If the list of source_metadata does not match the fragment labels (e.g. one source failed and was removed but indices were not renumbered), [2] can point to the wrong source or out of range. Design does not specify strict ordering and alignment between fragment labels and response.sources[]. |
| 5 | **RLS and service role** | High | Supabase service role key bypasses RLS. If any server-side code uses the service role without always applying tenant_id in the query (e.g. raw SQL or a client that doesn’t scope by tenant), data can leak. Design mentions RLS but not “every query must include tenant_id when using service role”. |
| 6 | **Single encryption key and no rotation** | Medium | One ENCRYPTION_KEY for all tenants. Compromise = all credentials decryptable. No key rotation procedure in design. Acceptable for MVP but must be explicit risk; rotation later requires re-encrypting all rows. |
| 7 | **Prompt injection / abuse** | Medium | User question is passed to intent and synthesis. Malicious or odd input could skew intent or pollute the answer. Design mentions “validate inputs” and “do not pass raw user text as system prompt” but does not specify: max length, sanitization, or rate limit. |
| 8 | **Admin can save integration without test** | Medium | Frontend says “Save only if test succeeded” but backend contract is not strict: if POST /admin/integrations accepts credentials without requiring a prior or inline test, a bug or alternate client could save broken config. Then first ask fails and user sees generic error. |

---

## 2. Likely failure modes

| Failure mode | Scenario | Likely outcome | Mitigation in design |
|--------------|----------|----------------|----------------------|
| **Wrong source queried** | Intent = documents, user meant CRM | Drive is queried; no deal data; answer empty or wrong | None beyond better prompts; no user correction in MVP |
| **No sources selected** | Intent = crm, tenant has no Bitrix | Refuse answer + message | Yes (fallback) |
| **All connectors fail** | Bitrix down, Drive timeout | Partial or “couldn’t retrieve” | Partial + warning; no retry |
| **One of two sources fails** | Mixed intent; Bitrix OK, Drive 429 | Answer from Bitrix only; Drive “unavailable” | Partial + provenance; good |
| **Intent LLM timeout/fail** | Claude slow or 5xx | No intent → no source list → ? | Not specified: should go to fallback “couldn’t classify” and not default to query-all |
| **Synthesis LLM timeout/fail** | Fragments OK but Claude fails | User sees “Something went wrong” | Failure path; no partial answer from fragments |
| **Empty fragments** | Connectors return success but 0 fragments | Synthesis gets nothing | Fallback “no data”; good |
| **Stale data in answer** | CRM data changed after fetch | User sees old state; no “as of” in design | No timestamp or “data as of” in answer; accepted as live limitation |
| **Duplicate integration type** | Admin adds second Bitrix (e.g. second portal) | Model says one per type per tenant; UI/API may allow second row | Unclear if backend rejects second integration with same type for tenant |
| **Conversation from another tenant** | Client sends conversation_id that belongs to another tenant | If auth only checks JWT and not “conversation.tenant_id == context.tenant_id”, cross-tenant read/write | Must be enforced on GET/POST conversation and messages |
| **Audit log missing or wrong tenant** | Bug in audit service | Log has wrong tenant_id or no tenant_id | Append-only and metadata.sources_used help; no explicit “audit entry must include tenant_id” validation |

---

## 3. What is missing

- **Explicit tenant_id enforcement list:** A single place (e.g. a checklist or table) that states: for each endpoint and each table, tenant_id comes from CurrentContext only; never from body/query/path (except path id that is then validated against context). And: when using Supabase with service role, every query that touches tenant-scoped data must filter by tenant_id.
- **Intent failure path:** What happens when classify_intent() throws or returns invalid label? Design should state: do not default to “mixed” or “query all”; return fallback “couldn’t determine question type” and do not call connectors.
- **Fragment–source ordering contract:** Clear rule: fragment labels [1], [2], … correspond to the order of ConnectorOutput list (or of source_metadata list) after filtering failed sources. How failed sources are removed and indices renumbered must be specified so citation indices stay in range.
- **“Data as of” / freshness:** No requirement to show “Based on data as of …” or “Live data from CRM”. For compliance or trust, some tenants may want this; not in MVP but worth a one-line “out of scope / future” note.
- **Max input length and sanitization:** No explicit limit on question length (e.g. 2000 chars) or on content stored in message. Prevents abuse and avoids token overflow in LLM.
- **Admin: idempotent “test then save”:** Backend does not guarantee “save only if test passed in this request”. If test is a separate call, a race (e.g. token expired between test and save) can store broken config. Either inline test-before-save in POST or document the risk.
- **Dedicated deployment: tenant_id source:** In dedicated mode, tenant_id still comes from DB (profile). Who creates that single tenant and profile? Document seed or bootstrap for dedicated instance.
- **Error message catalog:** Fallback and partial messages are described but not centralized. A short list of exact messages (or message keys) would avoid ad-hoc strings and improve consistency and i18n later.

---

## 4. What should be tested first

**Before or alongside first production-like deployment:**

1. **Tenant isolation (automated)**  
   - Create two tenants with separate conversations and integrations.  
   - As user of tenant A, call GET /conversations, GET /conversations/{id}, POST /messages with conversation_id of tenant B. Expect 403 or 404.  
   - As user of tenant A, call GET /admin/integrations; expect only A’s integrations.  
   - Use Supabase client with service role and assert that queries without tenant_id filter return no rows (or use RLS and assert that a tenant-scoped role cannot see other tenant’s rows).

2. **Source selection and no query-all**  
   - Mock intent to “crm”; tenant has only Drive enabled. Source selection must return empty (no Bitrix).  
   - Assert that when source selection is empty, no connector adapter is called (mock registry).  
   - Assert that when intent is “mixed” and tenant has Bitrix + Drive, both are in the plan and both adapters are called (with mocks).

3. **Partial failure and provenance**  
   - Mock: Bitrix returns fragments, Drive returns error. Assert: one assistant message with answer from Bitrix only; sources list includes both sources with one marked unavailable or with error; message status = partial; audit has sources_used = [bitrix, google_drive] and status = partial.

4. **Intent failure path**  
   - Mock LLM classify_intent to throw or return invalid label. Assert: no connector calls; fallback message returned; message status = failed; audit logged.

5. **Citation indices**  
   - Test with two sources, both return fragments; synthesis returns answer with [1] and [2]. Assert response.sources has two items and that indices 1 and 2 map to the correct source_metadata (and that UI can render [1]/[2] as links to the right source).

6. **Secrets not in logs**  
   - Run ask flow with real or mocked decrypt; force an error after config is built. Assert log/exception does not contain webhook_url, api_key, or token. Optional: automated grep in CI on log output.

7. **Admin integration: test then save**  
   - If backend supports “save only after test”: POST with invalid credentials; expect 400 and no row. POST with valid credentials; expect 200 and row created.  
   - If test is separate: document that “test then save” is best-effort and that expired token after test is a known edge case.

---

## 5. Acceptance checklist for MVP

Use this as a gate before calling MVP “done”. Each item should be verifiable (test or manual check).

**Tenant and auth**

- [ ] tenant_id for every request comes only from verified JWT/session (profile); never from body/query.
- [ ] Every API that returns or mutates conversations, messages, integrations, or audit is scoped by tenant_id (and conversation ownership where applicable).
- [ ] RLS (or equivalent) is enabled on tenant-scoped tables; service-role queries always include tenant_id filter when reading tenant data.
- [ ] Tenant isolation tests exist and pass (see §4).

**Secrets**

- [ ] Credentials are stored encrypted; decryption only in backend; never in frontend or API response.
- [ ] No credential value (webhook URL, api_key, token) appears in logs, exception messages, or error responses.
- [ ] Test connection and fetch use the same decryption path; no long-lived cache of decrypted credentials.

**Source selection and orchestration**

- [ ] When source selection returns empty, no connector is called; user sees explicit “no relevant source connected” (or equivalent) message.
- [ ] When intent classification fails or returns invalid label, no connector is called; user sees fallback message (no silent “mixed” or query-all).
- [ ] Partial connector failure produces partial answer + warning; message status and sources list reflect which source failed.
- [ ] Citation indices [1], [2] in the answer correctly map to response.sources[]; no index out of range.

**Provenance and audit**

- [ ] Every assistant message has a sources list (possibly empty); UI always shows it (no “hide sources” in MVP).
- [ ] Audit log has one entry per ask with tenant_id, user_id, message_id, sources_used, status; no full question/answer text in audit.

**Admin**

- [ ] Only tenant_admin can access /admin routes; end_user gets 403.
- [ ] Integration list returns only current tenant’s integrations; no credentials in response.
- [ ] Save integration requires valid config; if “test before save” is enforced, failed test blocks save.

**Stability and errors**

- [ ] Connector timeout is enforced (runner or adapter); no unbounded wait.
- [ ] LLM timeout or error does not crash the process; user sees a safe error message.
- [ ] Max length on question input (e.g. 2000 chars) enforced; longer input rejected with clear error.

---

## 6. Recommendations before implementation continues

**Must address**

1. **Document tenant_id rule explicitly.** Add to backend-architecture or technical-blueprint: “For every endpoint that reads or writes tenant-scoped data, tenant_id is taken only from CurrentContext (derived from JWT). Path/body ids (e.g. conversation_id) are validated against that tenant_id. When using Supabase with service role, every query that touches tenants, integrations, conversations, messages, or audit_logs MUST include a tenant_id filter.” Then implement and test accordingly.

2. **Define intent failure behaviour.** In chat-orchestration-design: “If classify_intent raises an exception or returns a label not in the taxonomy, do not call any connector. Return fallback message (e.g. ‘Could not determine question type. Try rephrasing.’) and set message status to failed. Log and audit.” Implement and add test (§4 item 4).

3. **Fix citation–source ordering.** In chat-orchestration-design (or backend-architecture): “The list of source_metadata passed to synthesis and the list used to build response.sources must be in the same order as fragment labels [1], [2], …. If a source failed, either exclude it and renumber fragment labels, or keep it in the list with an ‘unavailable’ flag so indices stay in range.” Choose one strategy and implement consistently.

4. **Secure config in code.** Rule: “ConnectorConfig and any decrypted credentials must not be passed to logging, exception constructors, or any serialization that could end up in logs or responses.” Add to connector-framework or backend-architecture; enforce in code review and optionally with a test that triggers an error after decrypt and asserts log content.

**Should address**

5. **Cap question length.** Backend and frontend: reject question longer than N characters (e.g. 2000). Return 400 with a clear message. Reduces prompt injection surface and avoids token overflow.

6. **Admin: reject duplicate integration type per tenant.** If product rule is “one integration per source_id per tenant”, backend POST /admin/integrations should return 409 or 400 when an integration with the same type/source_id already exists for that tenant. Prevents accidental second Bitrix and clarifies behaviour.

7. **Centralize fallback messages.** Maintain a short list (or keyed messages) for: no sources selected, intent failed, no fragments retrieved, synthesis failed, source unavailable. Use them in orchestration and optionally in API error responses. Easier to tune and later localize.

**Nice to have**

8. **Confidence or “unsure” for intent.** MVP can ship without it, but document as future option: if LLM returns low confidence or “unsure”, fallback to “please clarify” or to a safe default (e.g. mixed) with a note in the answer. Not required for first release.

9. **“Data as of” in answer.** Optional one-liner in synthesis prompt: “If the user asks about current or live data, you may add a short note that the answer is based on data retrieved at the time of the request.” Or leave for a later iteration.

10. **Dedicated deployment bootstrap.** Short runbook or doc: how to create the single tenant and first user for a dedicated instance (e.g. seed script or one-time API). Removes ambiguity when deploying for a single client.

---

## Document control

- **Version:** 1.0  
- **Related:** All architecture and design docs in docs/.  
- **Next review:** After implementing the “must address” items and running the tests in §4. Do not treat this review as a full security audit; for production, consider a dedicated security review and penetration testing.
