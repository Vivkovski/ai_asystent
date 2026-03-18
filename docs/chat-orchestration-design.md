# Chat orchestration layer — design

Design for the pipeline that turns a user question into an answer with source provenance. **Not** a generic chatbot; **no** query-all-sources by default. Routing-first and selective querying; live operational data (e.g. CRM) treated distinctly from documents where it matters. Simple and controllable.

**Flow:** Question → intent classification → source selection → query only selected sources → answer composition from results → user sees answer + sources.

**Related:** docs/technical-blueprint.md, docs/backend-architecture.md, docs/connector-framework.md.

---

## End-to-end flow (single ask)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. REQUEST                                                                   │
│    Input: question (str), conversation_id, tenant_id, user_id                 │
│    Create: user message row (pending); no assistant message yet              │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. INTENT CLASSIFICATION                                                     │
│    Input: question                                                           │
│    Output: single intent label (e.g. crm | documents | spreadsheets | mixed) │
│    Mechanism: LLM + intent prompt + taxonomy (no connector calls)            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. SOURCE SELECTION                                                          │
│    Input: intent label, tenant_id                                            │
│    Logic: intent → source_ids (platform map); filter by tenant integrations  │
│    Output: ordered list of source_ids to query, or empty                     │
│    If empty → go to FALLBACK (refuse answer; no connector calls)              │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. SOURCE QUERY PLANNING                                                     │
│    Input: source_ids, question, limits (max_fragments_per_source, timeout)    │
│    Output: plan: one “query” per source_id (same query_text; config per      │
│            source loaded later). No execution yet.                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. RETRIEVAL EXECUTION                                                       │
│    For each source_id: load config (decrypt) → get adapter → fetch(Input)    │
│    Run in parallel; enforce timeout and fragment limits per source          │
│    Output: list of ConnectorOutput (fragments + source_metadata + error?)    │
│    Partial OK: some sources fail → keep successful results; record errors   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. ANSWER COMPOSITION                                                        │
│    Input: question, aggregated fragments (with source labels [1],[2],…)      │
│    LLM: synthesis prompt + question + fragments → answer text + citations   │
│    Output: answer (str), cited_source_indices (for provenance)               │
│    If no fragments at all → go to FALLBACK                                   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. SOURCE PROVENANCE / CITATIONS                                             │
│    Map cited indices to source_metadata; build response.sources[]            │
│    Persist: message (answer, status); answer_sources (message_id, metadata)  │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 8. AUDIT LOGGING                                                             │
│    Append: tenant_id, user_id, message_id, action=message_created,           │
│            metadata={ sources_used: source_ids[], status }                   │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 9. RESPONSE                                                                  │
│    Return: message (content=question, answer, status), sources[]             │
│    Optional: warning if partial (e.g. “Bitrix temporarily unavailable”)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Principles:** Intent first; only then source selection; only selected sources are queried. No “search everything” path. Live data (CRM) and documents are distinguished in the taxonomy and in how we name/link sources, not by a different execution path.

---

## 1. Intent classification

**Purpose:** Determine what kind of information the user is asking for, so we can choose the right sources. Single label per question in MVP.

**Input:** User question (plain text). Optional: conversation_id for future context (e.g. “a co z klientem Y?”); MVP can use question only.

**Output:** One intent label from a fixed taxonomy, e.g.:
- **crm** — Deals, contacts, status, offers, client data (live operational CRM).
- **documents** — Procedures, files, documents (Drive, file storage).
- **spreadsheets** — Tables, sheets, numbers (Sheets, Excel-like).
- **mixed** — Clearly spans more than one (e.g. “oferta z 17 marca” → CRM + document). Map to multiple sources.

**Mechanism:** LLM call with a dedicated intent prompt. Prompt includes: short description of each label, instruction to pick one label, few-shot examples optional. No connector calls; no retrieval. Fast path: single LLM request.

**Taxonomy location:** packages/prompts (or config): list of labels + descriptions. Intent prompt references this taxonomy. Changes to labels require prompt/taxonomy update and intent→source map update.

**Controllability:** Taxonomy and prompt are in repo/config; no per-tenant customization in MVP. Same behaviour for all tenants; predictable.

**Live vs documents:** The taxonomy explicitly separates “crm” (live, transactional) from “documents” (content, procedures). This drives which connectors we call and how we describe sources to the user (e.g. “Dane z CRM” vs “Dokument”).

---

## 2. Source selection

**Purpose:** From intent, produce the list of source_ids that will be queried. **Never** “all enabled sources”; only sources that match the intent.

**Input:** Intent label, tenant_id.

**Logic:**
1. **Intent → source_ids map (platform):** Deterministic. E.g. crm → [bitrix], documents → [google_drive], spreadsheets → [google_sheets], mixed → [bitrix, google_drive, google_sheets]. Stored in config or code (packages/prompts or services/routing).
2. **Tenant filter:** For the tenant, load enabled integrations (by type/source_id). Keep only source_ids that have an enabled integration. Order preserved (e.g. bitrix first for mixed if that’s the desired priority).

**Output:** Ordered list of source_ids, or empty list. Empty if e.g. intent is crm but tenant has no Bitrix integration.

**No query-all fallback:** If the list is empty, we do **not** fall back to “query all enabled sources”. We go to fallback behaviour: refuse to answer and explain that no relevant source is connected (see §7).

**Controllability:** Map is platform-defined; tenant only controls which integrations exist and are enabled. Simple and auditable.

---

## 3. Source query planning

**Purpose:** Turn the selected source_ids into a concrete execution plan: one logical “query” per source with the same question and global limits. No connector-specific logic here; only structure.

**Input:** source_ids (ordered), question (query_text), limits (max_fragments_per_source, max_total_fragments, timeout_seconds).

**Output:** A **plan**: list of items, each item = (source_id, query_text, limits). query_text is the same for all (the user question). limits can be per-call (e.g. max_fragments = min(max_fragments_per_source, max_total_fragments / number_of_sources) so we don’t overflow context). Runner will load config per source_id and invoke adapter with ConnectorInput(query_text, config, limits).

**No semantic rewriting per source in MVP:** We don’t send “CRM-optimized” vs “document-optimized” query to different connectors; same question. Connectors interpret query_text in their own way (e.g. Bitrix filters by keyword, Drive by search). Optional later: per-source query expansion or rewriting.

**Live vs documents:** Planning is the same; the distinction is already in source selection (crm vs documents intent). Limits and timeout apply uniformly; we can later add different limits for “live” vs “document” sources if needed (e.g. fewer fragments from CRM, more from Drive).

---

## 4. Retrieval execution

**Purpose:** Run the plan: for each (source_id, query_text, limits), load tenant config, get adapter, call fetch(ConnectorInput), aggregate results. No LLM here; only connector calls.

**Steps:**
1. For each source_id in the plan, load integration row for tenant; decrypt credentials; build ConnectorConfig (opaque for adapter).
2. Get adapter from registry by source_id.
3. Call adapter.fetch(ConnectorInput(query_text, config, limits)) **in parallel** (e.g. asyncio.gather or equivalent). Enforce timeout per call (runner-level); adapter can also respect timeout internally.
4. Collect ConnectorOutput per source: fragments, source_metadata, success, error.
5. If one or more sources fail: keep all successful results; attach error messages for failed sources (for provenance and fallback message). Do not fail the whole request.

**Output:** List of (source_metadata, fragments[], error?). Order matches plan. This list is passed to answer composition.

**Partial failures:** Handled here. Failed source → error string and empty fragments for that source; other sources’ fragments still go to synthesis. Orchestration later sets message status to “partial” and can add a warning (e.g. “Source X unavailable”).

**Controllability:** Timeout and limits from env or config; single place. No per-connector logic in orchestration; adapters encapsulate provider behaviour.

---

## 5. Answer composition

**Purpose:** Produce the final answer text from the question and the retrieved fragments, and indicate which sources were used (citations).

**Input:** Question, aggregated fragments with source labels. Each fragment is tagged with its source (e.g. [1] for first source, [2] for second). Optional: list of source_metadata and any per-source error messages (for “Source X unavailable” in the answer or in provenance).

**Mechanism:** Single LLM call (synthesis). Prompt includes: system instruction (answer based only on the provided fragments; cite sources as [1], [2]; say if information is missing or a source was unavailable); user message = question + concatenated fragments with labels. LLM returns answer text with inline citations [1], [2].

**Output:** answer (str), and parsed cited indices (e.g. [1, 2]) so we can map to source_metadata and build response.sources[].

**Rules:** Answer must be grounded in fragments; no fabrication. If no fragments at all, do not call synthesis; go to fallback. If only some sources failed, synthesis sees the remaining fragments and can mention “Source X was unavailable” if we inject that into the prompt or add it in post-processing.

**Controllability:** One synthesis prompt in packages/prompts; same for all tenants. Easy to tune instructions (length, tone, citation format).

---

## 6. Source provenance / citations

**Purpose:** User sees where the answer came from: inline references [1], [2] and a clear list of sources (type, title, link). Builds trust and allows “open in CRM/document”.

**Data flow:**
- After synthesis we have: answer text, cited_source_indices (e.g. [1, 2]), and the list of source_metadata from retrieval (one per source_id that was queried).
- Build **response.sources**: for each source that was used (or all that were queried, with “unavailable” if error), one entry: source_id, type (e.g. "crm", "documents"), title, link. Order matches fragment labels [1], [2] so [1] = first source in the list.
- Persist **answer_sources**: for each source that contributed (or each we want to show), insert row: message_id, source_type, title, link, fragment_count (optional). No full question/answer in DB; only references.

**Citation format:** Inline [1], [2] in answer text; UI shows “Sources” section with numbered list, each with title and link. User can click to open Bitrix/Drive/Sheets.

**Live vs documents:** type field ("crm" vs "documents" vs "spreadsheets") lets UI differentiate (e.g. icon or label). Same structure for all; no special handling in orchestration beyond passing through source_metadata.type.

---

## 7. Fallback behaviour

**Purpose:** When we cannot produce a normal answer (no sources selected, or no fragments retrieved), behave in a predictable way: refuse gracefully and explain. **Never** silently query all sources or make up an answer.

**Cases:**

| Case | Condition | Behaviour |
|------|-----------|-----------|
| No sources selected | Source selection returns empty (e.g. intent crm but no Bitrix) | Do not call any connector. Do not call synthesis. Return assistant message with status=failed or no_answer; content = short explanation: “No connected source for this type of question. Connect CRM or documents in admin.” Persist message; audit log. |
| No fragments retrieved | All connectors failed or returned empty | Do not call synthesis with empty fragments. Return assistant message with status=failed or partial; content = “I couldn’t retrieve data from the selected sources. Try again or check integrations in admin.” Optional: list which sources failed. Persist; audit. |
| Partial retrieval | Some sources failed, some returned fragments | Proceed with synthesis using successful fragments. Set status=partial. In response or in answer text, add warning: “One source was temporarily unavailable.” Provenance lists all sources (available + unavailable). |
| Synthesis failure | LLM error or timeout | Treat as failure. Return message with status=failed; content = “Something went wrong. Try again.” Log error; audit. |

**No query-all:** Under no circumstance does the orchestration layer “fall back” to querying every enabled integration when source selection returns empty. Empty selection → explicit refuse with explanation.

**Controllability:** Fallback messages can be in packages/prompts or config so they are editable without code change.

---

## 8. Audit logging

**Purpose:** Record that an ask happened, who, when, and which sources were used (for compliance and support). No full question/answer text in the audit log.

**When:** After the assistant message is persisted (or in the same transaction). One audit entry per ask.

**Payload:** tenant_id, user_id, action (e.g. "message_created" or "ask_completed"), resource_type ("message"), resource_id (message_id), metadata (json): e.g. sources_used = [source_ids], status = "completed" | "partial" | "failed", optional request_id. **Do not** store question text or answer text in metadata; reference by resource_id.

**Storage:** Append-only table (e.g. audit_logs). Retention per policy (e.g. 1 year). Queryable by tenant_admin for “recent activity”.

**Controllability:** Single place that writes audit; same shape for all asks. Optional: add intent label to metadata for analytics later.

---

## 9. Prompt architecture

**Purpose:** Keep all LLM-facing text in one place (packages/prompts or config), versioned and easy to change. Two main prompts: intent classification and answer synthesis.

**Intent prompt:**
- **Role:** Classify the user question into one intent.
- **Content:** Short system message: describe each taxonomy label (crm, documents, spreadsheets, mixed) and ask for one label. Optionally few-shot examples (question → label). Output format: single token or short phrase (e.g. “crm”).
- **Location:** packages/prompts/intent_classification.txt (or .yaml with sections). Loaded at runtime by orchestration; passed to LLM provider.

**Synthesis prompt:**
- **Role:** Answer the question using only the provided fragments; cite sources.
- **Content:** System: “You answer based only on the following fragments. Use [1], [2] to cite sources. If a source was unavailable, say so. Do not invent information.” User (or combined): the question + blocks of fragments, each block prefixed with [1], [2], etc. Output: answer text with inline [1], [2].
- **Location:** packages/prompts/answer_synthesis.txt. Loaded at runtime.

**Taxonomy and map:**
- **Intent labels:** List in packages/prompts/taxonomy.yaml (or .json): labels + short descriptions. Used by intent prompt and by source selection (intent → source_ids map). E.g. labels: [crm, documents, spreadsheets, mixed]; map: crm → [bitrix], documents → [google_drive], …
- **No tenant-specific prompts in MVP.** Same prompts for all tenants. Optional later: tenant can override system prompt suffix or language.

**Controllability:** Change behaviour by editing prompt files or taxonomy; no code change in orchestration. Clear separation: intent prompt vs synthesis prompt vs taxonomy.

---

## 10. LLM provider abstraction

**Purpose:** Orchestration does not depend on Claude or any specific API. It calls an interface; the implementation can be Claude today and another provider later (or multiple for A/B). Keeps orchestration testable (mock LLM) and swappable.

**Interface (conceptual):**
- **classify_intent(question: str) -> IntentLabel** — Returns one label from the taxonomy. Input: question. Output: string (e.g. "crm"). Implementation: call Claude with intent prompt; parse response.
- **synthesize_answer(question: str, fragments_with_labels: list[str], source_metadata_list: list) -> SynthesisResult** — Returns answer text and cited indices. Implementation: call Claude with synthesis prompt; parse response to extract [1], [2] and build SynthesisResult.

**SynthesisResult:** answer: str, cited_source_indices: list[int] (1-based to match [1], [2]). Optional: raw_response for debugging.

**Provider-specific details:** Only inside the implementation (e.g. Claude client, model name, API key, response parsing). Orchestration only sees IntentLabel and SynthesisResult. No Claude package or URL in orchestration code.

**Testing:** Mock implementation returns fixed IntentLabel and fixed SynthesisResult so orchestration and routing tests don’t need a real API.

**Controllability:** One interface; swap provider by replacing implementation. Model choice (e.g. claude-3-5-sonnet) in env or config of the provider, not in orchestration.

---

## Summary: what is not in scope

- **Generic chatbot:** We do not “answer anything” from a single knowledge base. We route by intent and query only selected live/document sources.
- **Query-all by default:** We never query every enabled source when we could not determine intent or when source selection is empty. Empty selection → refuse.
- **Same treatment for live and documents in execution:** Both go through the same retrieval and synthesis path; the difference is in taxonomy (crm vs documents) and in source selection and provenance type. We can later add different limits or prompts per type if needed.
- **Tenant-customizable intent or map in MVP:** Taxonomy and intent→source map are platform-defined. Tenants only enable/disable integrations.
- **Streaming:** MVP is request/response; no streaming tokens. Can be added later at the HTTP and LLM layer without changing this design.

---

## Document control

- **Related:** docs/technical-blueprint.md, docs/backend-architecture.md, docs/connector-framework.md, docs/mvp-backlog.md.
- **Next step:** Implement orchestration (ask pipeline) following this flow; implement intent and synthesis prompts and taxonomy; add LLM interface and Claude implementation; wire audit and provenance. No full code in this doc; design only.
