# Frontend architecture breakdown — AI Assistant MVP

Plan and structure for `apps/web` (Next.js). No full component code here. Aligned with backend API and technical blueprint.

**Principles:** Practical UI; readability and trust in answers; source provenance visible; admin configures integrations without touching code.

---

## 1. Auth flow

**Purpose:** Identify the user, attach them to a tenant and role, and ensure only authenticated users access the app. All API calls send the session token.

**Key screens:**
- **Login** — Email + password; optional “Forgot password” link (Supabase reset).
- **Sign-up** — If enabled: email, password, optional invite code or tenant selection (depending on product decision). MVP can be invite-only (no public sign-up).
- **Post-login redirect** — To default workspace/tenant and then either chat (end_user) or admin home (tenant_admin), or a simple home that links to both.

**States:**
- Unauthenticated: show login (and sign-up if applicable).
- Authenticated, loading profile: show minimal loading (e.g. spinner or skeleton) until tenant_id and role are resolved.
- Authenticated, profile ready: set workspace context (see §2) and render app (chat or admin entry).
- Session expired / 401: clear local state, redirect to login, optional toast “Session expired”.

**API dependencies:**
- Supabase Auth (client): signIn, signUp, signOut, getSession, onAuthStateChange.
- Backend: all requests use `Authorization: Bearer <access_token>`. No dedicated “me” or “profile” endpoint required if tenant/role are resolved from JWT or a small profile endpoint that returns tenant_id and role.

**UX recommendations:**
- Keep login/sign-up minimal: one column form, clear labels, one primary button. No decorative clutter.
- After login, avoid flashing login then redirecting; wait for session + profile then show main UI.
- Show a persistent “Log out” in header or user menu.

---

## 2. Tenant switch / workspace context

**Purpose:** Represent the current tenant (workspace) so the user sees only that tenant’s data. In MVP most users have one tenant; switcher is for future multi-tenant users or dedicated deployments where we still show “workspace” for consistency.

**Key screens:**
- **Workspace indicator** — In app shell (header/sidebar): current tenant name (or “Workspace: X”). If multiple tenants per user later: dropdown to switch.
- **No workspace** — If profile has no tenant_id (edge case): show message “No workspace assigned” and log out or contact admin.

**States:**
- Unknown: loading (after auth, before profile).
- Single tenant: show name; no switcher in MVP.
- Multiple tenants (later): list in dropdown; on select, set context and refetch or re-render tenant-scoped data.

**API dependencies:**
- Profile or session payload that includes tenant_id (and tenant name if available). Optionally GET /api/v1/tenants/current or include in profile response.
- All data requests are implicitly tenant-scoped by backend via JWT; frontend only needs to display current tenant and optionally pass tenant_id if backend requires it in body/query.

**UX recommendations:**
- One clear label (e.g. “Workspace: Acme Inc”) in header. No need for a fancy switcher in MVP if users have one tenant.
- Dedicated deployment: same UI; workspace name can be the client name.

---

## 3. Integrations list

**Purpose:** Let tenant admins see which connectors are connected, their status (connected / error / needs re-auth), and quick actions (reconnect, disable, add new).

**Key screens:**
- **Integrations list page** — Table or card list: one row per integration type (Bitrix, Google Drive, Google Sheets). Columns/cards: name, type, status (badge: Connected / Error / Not configured), last tested, last error (truncated), actions (Reconnect, Disable, or Add if not configured).
- **Empty state** — “No integrations yet. Add one to let the assistant use your data.” CTA: “Add integration”.

**States:**
- Loading: skeleton or spinner for the list.
- Loaded: list of integrations (may be empty).
- Error loading: toast + retry or inline error message.
- After add/update/delete: refetch list or optimistic update.

**API dependencies:**
- GET /api/v1/admin/integrations — list (id, type, display_name, enabled, last_tested_at, last_error). No credentials.

**UX recommendations:**
- Status first: use colour or icon (e.g. green check, red alert, yellow “reconnect”) so admins quickly see what’s broken.
- Show last_error in a compact way (tooltip or expandable row); full message for debugging.
- One primary action per row: “Reconnect” if error/expired, “Disable” if connected. “Add” only for types not yet present.

---

## 4. Integration setup screen

**Purpose:** Allow tenant admin to add a new integration or re-auth an existing one. Collect credentials (OAuth or API key), run test, then save. No code or config files.

**Key screens:**
- **Add integration (wizard or single page)** — Step or section 1: choose type (Bitrix / Google Drive / Google Sheets). Step 2: type-specific form.
  - **Bitrix:** API endpoint URL + API key (or OAuth if required). Optional display name.
  - **Google Drive / Sheets:** OAuth only. Button “Connect with Google” → redirect to OAuth → callback with code; backend exchanges code and stores tokens. Optional display name.
- **Test before save** — After credentials entered: “Test connection” button. Show success or error; on success enable “Save”. On failure, show error and do not save until test passes (per MVP rule).
- **Edit / Re-auth** — Same form pre-filled with display_name only (no credentials). For OAuth: “Reconnect” starts OAuth again. For API key: re-enter key and test.

**States:**
- Idle: form visible, no submit yet.
- Testing: “Testing connection…” disable form and test button.
- Test success: show “Connection OK”, enable Save.
- Test failure: show error message, keep form editable.
- Saving: “Saving…” disable submit.
- Save success: redirect to integrations list or show success toast and stay.
- Save failure: show error, keep form open.

**API dependencies:**
- POST /api/v1/admin/integrations — body: type, display_name?, credentials (OAuth code/tokens or api_key), config? (e.g. root_folder_id for Drive). Backend runs test then saves encrypted.
- PATCH /api/v1/admin/integrations/{id} — for re-auth: new credentials; or display_name, enabled.
- POST /api/v1/admin/integrations/{id}/test — test without persisting (optional; or test is part of POST/PATCH).

**UX recommendations:**
- One integration type per page or clear step; avoid one long form for all types.
- OAuth: single “Connect with Google” (or “Connect with Bitrix” if OAuth). After callback, return to setup and show “Connected. Save to finish.”
- Never show or ask to re-enter stored credentials; only “Reconnect” to replace them.
- Clear copy: “Test connection” and “Save” as separate actions; explain that data is encrypted and never shown.

---

## 5. Source roles configuration

**Purpose:** Expose which “sources” (connector types) are available and their status. In MVP, intent→source mapping is platform-defined (not tenant-editable); this area is about visibility and enable/disable, not about editing routing rules.

**Key screens:**
- **Source types overview** — Can be the same as **Integrations list** (§3): each row is a source type (Bitrix, Drive, Sheets) with status. Optional second view: “Which sources answer what” — read-only text (e.g. “CRM questions use Bitrix; document questions use Google Drive”) so admins understand behaviour without editing.
- **Enable/disable** — Toggle or “Disable” on the integrations list. Disabling hides that source from routing (backend already filters by enabled integrations).

**States:**
- Same as integrations list. Optional: “enabled” toggle per row; PATCH integration to set enabled.

**API dependencies:**
- Same as §3 (GET list). PATCH /api/v1/admin/integrations/{id} with { enabled: false } to disable.
- No MVP API for “edit intent→source mapping”; that is platform config.

**UX recommendations:**
- Keep it simple: integrations list is the source configuration. Add a short help text: “Enabled integrations are used to answer questions. Disable to exclude a source.”
- If you add a read-only “How sources are used” section, use plain language and avoid jargon (e.g. “CRM questions → Bitrix”, “Documents → Google Drive”).

---

## 6. Chat screen

**Purpose:** Let the user ask a question and see the answer with clear source provenance. Primary user-facing screen.

**Key screens:**
- **Chat view** — One main area: conversation thread (messages). At bottom: text input + submit (e.g. “Ask” or “Send”). No sidebar in minimal version; or sidebar with conversation list (§7).
- **Input** — Textarea or input; placeholder e.g. “Ask a question…” Submit on button or Enter (with Shift+Enter for new line if needed).
- **Message bubbles** — User message: right-aligned or distinct style; assistant message: left-aligned; show answer and sources (§8).

**States:**
- No conversation: show empty state “Start a new conversation” and focus input; first submit creates conversation and first message.
- Conversation loaded: show messages; scroll to bottom.
- Sending: append user message immediately (optimistic); show loading indicator for assistant reply (e.g. “Thinking…” or skeleton).
- Reply received: append assistant message with answer and sources; clear loading.
- Error (network or 4xx/5xx): show inline error under input or toast; do not remove user message; allow retry (e.g. “Retry” button or resubmit).

**API dependencies:**
- POST /api/v1/conversations — create conversation (optional title). Or create on first message (backend can create conversation when POST messages if conversation id is optional).
- POST /api/v1/conversations/{id}/messages — body { content: "user question" }. Returns full assistant message (answer + sources). Creates user message and runs ask pipeline.
- GET /api/v1/conversations/{id} — load conversation with messages (for history and re-open).

**UX recommendations:**
- Prioritise readability: sufficient contrast, readable font size, comfortable line length. Avoid tiny or decorative fonts.
- Loading: explicit “The assistant is answering…” so the user knows the system is working (can take several seconds).
- Errors: friendly message (“Something went wrong. Try again.”) and optional “Retry”; no stack traces or raw API errors.

---

## 7. Chat history

**Purpose:** Let the user see past conversations and reopen one to read or continue.

**Key screens:**
- **Conversation list** — Sidebar or separate page: list of conversations (title or first message preview, date). Click to open. Optional: “New conversation” at top.
- **Conversation thread** — When a conversation is selected, show its messages (user + assistant with answer and sources). Same as §6 message bubbles.
- **Empty state** — “No conversations yet. Ask a question to start.”

**States:**
- Loading list: skeleton or spinner.
- List loaded: show items; current conversation highlighted if in sidebar.
- Loading conversation: show skeleton for messages until GET conversation returns.
- Loaded: show messages; scroll to bottom or to last read position (MVP: scroll to bottom).

**API dependencies:**
- GET /api/v1/conversations — list (id, title?, updated_at, maybe first message preview if API supports).
- GET /api/v1/conversations/{id} — conversation with messages (and answer_sources per message).

**UX recommendations:**
- Sort by updated_at descending (newest first). Show date or “Today / Yesterday” for quick scan.
- Title: use first user message (truncated) or “New conversation” if no messages yet. No need for editable title in MVP.
- Clicking a conversation should replace the current thread and update URL if using client-side routing (e.g. /chat/[id]).

---

## 8. Answer details with source provenance

**Purpose:** Build trust by showing exactly which sources the answer used. User must see where information came from and be able to open the original (link) when available.

**Key screens:**
- **Inside assistant message** — (1) Answer text. (2) Inline citations if backend returns them (e.g. [1], [2]). (3) “Sources” section below the answer: list of sources with type, title, and link (e.g. “Bitrix — Deal #123” with link to Bitrix; “Google Drive — Document name” with link to file).
- **Partial or failed source** — If one source failed: show in sources list as “Bitrix — temporarily unavailable” (no link). Answer may still be present from other sources.
- **No sources** — If backend refused (no sources selected): show message “I couldn’t find relevant sources for this question. Try rephrasing or check that integrations are connected in admin.”

**States:**
- Normal: answer + list of sources; each source has type, title, optional link.
- Partial: answer + sources list with one or more entries marked unavailable.
- No sources: short explanation; no answer or placeholder text from backend.

**API dependencies:**
- Message/Ask response includes message.answer and message.sources[] (id?, type, title, link?). Frontend only renders; no extra endpoint.

**UX recommendations:**
- Sources are not optional UI: always show a “Sources” block for assistant messages (even if empty or “unavailable”) so provenance is visible.
- Use consistent formatting: e.g. “[1] Bitrix — Deal title” with [1] linking to the same source in the list, or a small footnote style. Link opens in new tab.
- Differentiate source types (icon or label: CRM / Document / Sheet) so users quickly see mix of sources.
- Avoid hiding sources behind “Show sources”; keep them in the same view as the answer for trust.

---

## 9. Audit / logs view for admin (basic version)

**Purpose:** Let tenant admins see recent activity (who did what, when) for oversight and support. No full PII; reference to resource (e.g. message id), not full question/answer.

**Key screens:**
- **Audit list page** — Table: columns — date/time, user (id or email if available), action (e.g. “Message created”, “Integration connected”), resource type, resource id (link to conversation if applicable). Optional: metadata (e.g. “sources_used: bitrix, drive”). No question/answer text.
- **Filters (optional in MVP)** — By date range, by action type, by user. If not in MVP: show last N entries (e.g. 50) with “Load more” or pagination.

**States:**
- Loading: skeleton or spinner.
- Loaded: table with rows.
- Empty: “No audit entries yet.”
- Error: toast or inline message and retry.

**API dependencies:**
- GET /api/v1/admin/audit — list (id, action, resource_type, resource_id, user_id?, metadata?, created_at). Pagination or limit/offset. Tenant-scoped by backend.

**UX recommendations:**
- Keep it simple: one table, sort by date descending. Export or advanced filters can come later.
- User column: show email or “User {id}” if email not returned for privacy. Action and resource type should be human-readable (e.g. “Message created”, “Integration connected”).
- Link resource_id to conversation when resource_type is “message” (e.g. open conversation in new tab or copy link). No need to show full content.

---

## Cross-cutting

**Navigation:**
- **App shell** — Header with workspace name (§2), user menu (logout), and nav: “Chat” (end_user and tenant_admin) and “Admin” (tenant_admin only). Admin sub-nav: Integrations, Audit.
- **Routing (suggestion)** — `/` or `/chat` (default chat), `/chat/[id]` (conversation), `/admin` (redirect to integrations or dashboard), `/admin/integrations`, `/admin/integrations/new`, `/admin/integrations/[id]` (edit/re-auth), `/admin/audit`, `/login`, `/signup` (if applicable).

**Data fetching:**
- Use one approach consistently (e.g. React Query / TanStack Query or SWR) for API calls. Handle loading and error in a standard way (skeleton, toast, retry).
- Attach Authorization header from Supabase session to every backend request.

**Errors:**
- 401: clear session, redirect to login.
- 403: show “You don’t have access” and do not expose admin routes to end_user.
- 4xx/5xx: user-facing message; log or send to backend for debugging; optional “Retry” or “Contact support”.

**Access control:**
- Resolve role from profile/session. Hide “Admin” nav and redirect /admin to /chat for end_user. Backend enforces; frontend only hides or redirects.

---

## Document control

- **Related:** docs/backend-architecture.md, docs/technical-blueprint.md, docs/mvp-backlog.md.
- **Next step:** Implement screens in order of dependency: auth → workspace context → chat (with answer + sources) → admin (integrations list → setup → audit). No full component code in this doc; use as spec for implementation.
