# Implementation status

Stan implementacji względem backlogu Linear (Foundation → Auth → Connector framework). Kolejne epiki: Admin, Orchestration, Chat UI, First connectors (real), Observability.

## Zaimplementowane

### Foundation
- **HOU-6 Shared types and constants** — `packages/shared`: AskRequest, AskResponse, SourceItem, Fragment, SourceMetadata, intent keys, INTENT_TO_SOURCES, ERROR_CODES.
- **HOU-7 Prompts and intent taxonomy** — `packages/prompts`: taxonomy.yaml, intent-classification.txt, answer-synthesis.txt.
- **HOU-8 Supabase schema** — `supabase/migrations/`: tenants, profiles, integrations, conversations, messages, answer_sources, audit_logs; `supabase/seed.sql`; RLS w drugiej migracji.

### Auth & tenant model
- **HOU-9 Supabase Auth and JWT validation** — `apps/api`: config, core/context, core/auth (JWT + profile load), GET /api/v1/me (chroniony).
- **HOU-10 Tenant and profile seeding** — `scripts/seed_tenant.py`, `supabase/seed.sql`.
- **HOU-11 RLS and tenant isolation** — `supabase/migrations/20260318000001_rls_tenant_isolation.sql`.
- **HOU-12 Next.js auth and session** — `apps/web`: Supabase SSR (client/server), /login, middleware, /chat i /admin chronione, apiFetch z tokenem.

### Connector framework
- **HOU-18 Connector contract and registry** — `apps/api/services/connectors/contract.py`, `registry.py`, mock Bitrix w `mock_bitrix.py`; rejestracja przy starcie.
- **HOU-19 Connector config resolution and secret loading** — `apps/api/domain/integrations.py` (load_config), `core/secrets.py` (encrypt/decrypt).
- **HOU-20 Limits and timeout** — ConnectorLimits w contract, `runner.py`: asyncio.wait_for, fetch_all równolegle.

### Admin — integrations
- **HOU-13 Admin layout and role guard** — layout z nawigacją, sprawdzanie tenant_admin przez /api/v1/me, przekierowanie end_user.
- **HOU-14 Integrations list API and UI** — GET /api/v1/admin/integrations, strona /admin/integrations z tabelą (typ, status, ostatni test, błąd).
- **HOU-15 Add integration — backend** — POST /api/v1/admin/integrations (type, credentials, display_name), test przed zapisem, szyfrowanie, 201.
- **HOU-16 Add integration — frontend** — /admin/integrations/add: wybór typu, Bitrix URL webhooka, przycisk „Testuj i zapisz”.
- **HOU-17 Re-auth and disable** — PATCH /api/v1/admin/integrations/:id (credentials lub enabled), strona /admin/integrations/[id] (Połącz ponownie, Wyłącz/Włącz).

### Source routing & orchestration
- **HOU-21 Intent classification** — OpenRouter LLM (gdy OPENROUTER_API_KEY) lub Mock LLM w `services/llm/openrouter.py` / `mock.py`, `services/routing/intent.py` (classify_intent).
- **HOU-22 Intent-to-source mapping** — `services/routing/source_selector.py`: INTENT_TO_SOURCES, filtrowanie po włączonych integracjach tenantów.
- **HOU-23 Parallel connector invocation** — `services/connectors/runner.py` (fetch_all).
- **HOU-24 LLM synthesis** — OpenRouter LLM (gdy OPENROUTER_API_KEY) lub Mock LLM synthesize_answer w orchestration.
- **HOU-25 Conversations and messages persistence** — `domain/chat.py`: create/list/get conversation, create/update message, get_messages, insert_answer_sources.
- **HOU-26 Orchestration pipeline (ask)** — `services/orchestration/ask.py`: run_ask (intent → sources → fetch → synthesis → persist); POST /api/v1/conversations/:id/messages.

### Chat UI & provenance
- **HOU-27 Chat screen and ask flow** — /chat: lista konwersacji, wybór/nowa, lista wiadomości, input, submit → POST ask, loading, odpowiedź.
- **HOU-28 Answer and source provenance** — Sekcja „Źródła” pod odpowiedzią asystenta: [id] tytuł, link (opcjonalnie „niedostępne”).
- **HOU-29 Conversation list** — Sidebar z konwersacjami, klik → załaduj wiadomości.

### First connectors (częściowo)
- **HOU-31 Google Drive** — adapter w `apps/api/services/connectors/google_drive.py` (refresh_token, list/search plików, Fragment + SourceMetadata); config: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; admin add: pole refresh token dla Google Drive/Sheets.

### Observability (HOU-33–35)
- **Audit log** — `domain/audit.py`: log(tenant_id, user_id, action, resource_type, resource_id, metadata); wywołania: run_ask → message_created; admin create integration → integration_connected; admin disable → integration_disabled.
- **Structured logging i request_id** — `middleware.py`: RequestIdMiddleware (x-request-id), setup_logging; global_exception_handler loguje z request_id.
- **Error handling** — `api/errors.py`: ErrorResponse, error_response(), global_exception_handler (500 bez stack trace).

### QA / Runbook
- **Runbook** — `docs/runbook.md`: wymagane zmienne (Supabase, JWT, ENCRYPTION_KEY, Google OAuth, NEXT_PUBLIC_*), kroki: clone, .env, migracje, seed, uruchomienie API i web, częste problemy.

### QA (HOU-36–39, częściowo)
- **Tenant isolation tests** — `apps/api/tests/test_tenant_isolation.py`: list_conversations, get_conversation, admin list_integrations używają tenant_id/user_id z kontekstu (dependency_overrides + mock domain).
- **Ask flow test** — `apps/api/tests/test_ask_flow.py`: POST messages wywołuje run_ask z poprawnymi argumentami, zwraca message+sources; odrzucenie pustego content; 404 gdy konwersacja nie znaleziona.

## Do zrobienia (kolejność z backlogu)

1. **First connectors (HOU-30, 32)** — prawdziwy adapter Bitrix (zamiast mock), Google Sheets adapter.
2. **Opcjonalnie** — lista audit w admin (GET /api/v1/admin/audit + UI).

## Uruchomienie

- **Web:** `pnpm run dev:web` (wymaga NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL).
- **API:** `cd apps/api && uv run uvicorn main:app --reload` (wymaga SUPABASE_URL, SUPABASE_KEY, SUPABASE_JWT_SECRET dla auth; ENCRYPTION_KEY dla credentials).
- **Migracje:** `supabase db push` lub ręcznie w Supabase; seed: `SEED_USER_ID=<uuid> uv run python ../../scripts/seed_tenant.py` z apps/api.
