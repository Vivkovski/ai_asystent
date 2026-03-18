# Propozycja zestawu dokumentów projektowych

Sześć dokumentów wejściowych dla nowej osoby w projekcie. Krótkie i praktyczne; bez powielania istniejącej głębokiej dokumentacji (technical blueprint, backend-architecture, itd.). Najpierw tylko spis i struktura — pełna treść w kolejnym kroku.

---

## Cel zestawu

Nowa osoba ma szybko zrozumieć:
- **co** budujemy (produkt, MVP)
- **jak** to działa (architektura, flow)
- **jak** uruchomić projekt (env, run)
- **jak** dodać nowy connector (krok po kroku)
- **jakie** są najważniejsze decyzje (ADR, ograniczenia)

Dokumenty mają być wejściem; szczegóły zostają w istniejących plikach w `docs/` (blueprint, backend, frontend, connector framework, orchestration, QA review).

---

## 1. README

**Lokalizacja:** `README.md` (root repozytorium)

**Cel:** Główny punkt wejścia. Jedna strona: co to za projekt, jak działa w 3 zdaniach, jak uruchomić (link), gdzie szukać dalej.

**Proponowana struktura:**

- Tytuł + jedna linia opisu produktu
- **Co to jest** — 2–3 zdania: AI Asystent dla firm, odpowiedzi z podłączonych źródeł, routing-first (intent → wybór źródeł → tylko te źródła)
- **Jak to działa** — 5 kroków (pytanie → intencja → źródła → odpytanie → odpowiedź ze źródłami); opcjonalnie mini-diagram ASCII lub link do architecture overview
- **Stack** — tabela 1 wiersz: Next.js, FastAPI, Supabase, Claude
- **Szybki start** — 3–4 komendy (clone, env, install, run) + link do `docs/environment-setup-guide.md`
- **Dokumentacja** — lista 5–6 linków: Architecture overview, MVP scope, Connector guide, Environment guide, ADR, Technical blueprint / Backend / Frontend (głębiej)
- **Struktura repozytorium** — drzewo katalogów (apps/web, apps/api, packages/*, docs); bez długich opisów

**Zależności:** Zastąpić/odświeżyć obecny README; nie duplikować treści z architecture-and-product-brief ani technical-blueprint.

---

## 2. Architecture overview

**Lokalizacja:** `docs/architecture-overview.md`

**Cel:** Jednostronicowy przegląd architektury: diagram + kluczowe decyzje + flow. Po lekturze wiadomo „jak to jest zbudowane” i gdzie szukać szczegółów.

**Proponowana struktura:**

- **System at a glance** — jeden diagram ASCII: User → Web → API → (Supabase, Connectors, Claude); 3–4 zdania opisu
- **Flow pytania** — numerowana lista 6–7 kroków (request → intent → source selection → retrieval → synthesis → provenance → response)
- **Kluczowe decyzje** — 5–7 bulletów: multi-tenant z tenant_id z JWT; routing-first, brak query-all; jeden kontrakt connectorów; LLM za abstrakcją; sekrety tylko w backendzie; live vs documents w taxonomii
- **Gdzie co leży** — krótka tabela: frontend (apps/web), backend (apps/api), connectorzy (packages/connectors), prompty (packages/prompts), szczegóły → linki do technical-blueprint, backend-architecture, connector-framework, chat-orchestration-design

**Zależności:** Czerpać z technical-blueprint, backend-architecture, chat-orchestration-design; nie powielać pełnych modeli.

---

## 3. ADR list (proposal)

**Lokalizacja:** `docs/adr/README.md` (index) + opcjonalnie `docs/adr/000-template.md`

**Cel:** Spis istniejących i proponowanych Architecture Decision Records. Nowa osoba widzi, jakie decyzje są udokumentowane i gdzie szukać uzasadnienia.

**Proponowana struktura `docs/adr/README.md`:**

- **Czym są ADR** — 2 zdania: krótkie rejestrowanie ważnych decyzji architektonicznych i produktowych
- **Konwencja** — numer (001, 002), tytuł, status (accepted/deprecated/superseded), 1–2 zdania kontekstu + link do pliku
- **Lista ADR (propozycja)** — tabela lub lista:
  - 001 — tenant_id only from JWT (accepted)
  - 002 — routing-first, no query-all (accepted)
  - 003 — single connector contract (Fragment + SourceMetadata) (accepted)
  - 004 — LLM behind abstraction (accepted)
  - 005 — secrets only in backend, encrypted at rest (accepted)
  - 006 — fixed intent taxonomy, platform-defined mapping (accepted)
  - 007 — live-only data in MVP, no indexing (accepted)
  - (opcjonalnie) 000-template — szablon nowego ADR
- **Jak dodać ADR** — 3 kroki: skopiuj szablon, wypełnij kontekst/decyzję/konsekwencje, dodaj wpis do tej listy

**Proponowana struktura `docs/adr/000-template.md` (opcjonalnie):**

- Title, Status, Date
- Context (2–4 zdania)
- Decision (co wybraliśmy)
- Consequences (plusy/minusy, co to oznacza w kodzie)

**Uwaga:** Na tym etapie to **propozycja listy**; pełne treści ADR (001–007) można dodać później lub odwołać się do odpowiednich sekcji w technical-blueprint / connector-framework / chat-orchestration.

---

## 4. Connector development guide

**Lokalizacja:** `docs/connector-development-guide.md`

**Cel:** Praktyczny przewodnik „jak dodać nowy connector”. Krok po kroku, bez teorii; od kontraktu do rejestracji i testów.

**Proponowana struktura:**

- **Kiedy dodać connector** — 1 zdanie: gdy mamy nowe źródło danych (np. Notion, HubSpot) i chcemy je odpytować w ask flow
- **Kontrakt** — wejście (ConnectorInput: query_text, config, limits), wyjście (ConnectorOutput: success, fragments, source_metadata, error); 2–3 zdania. Link do connector-framework.
- **Kroki** — numerowana lista: (1) Zdefiniuj source_id, (2) Dodaj adapter w packages/connectors/<name>/, (3) Implementuj fetch + opcjonalnie test_connection, (4) Normalizuj dane do Fragment + SourceMetadata, (5) Zarejestruj w registry (apps/api), (6) Dodaj do mapy intent→sources, (7) Dodaj typ w admin UI i formularz credentials
- **Struktura plików** — małe drzewo na przykładzie Bitrix: adapter.py, config.py, client.py, normalizer.py, tests/; 1 zdanie na plik. Link do connector-bitrix-design.
- **Config i secrets** — gdzie trzymane (integrations.credentials_encrypted), jak przekazywane (runner ładuje, decrypt, przekazuje do adaptera), czego nie robić (nie logować). Link do connector-framework §5.
- **Testy** — unit (normalizer, mock client), contract (zwrot ConnectorOutput), opcjonalnie integration z prawdziwym API. Link do connector-bitrix-design §9.
- **Dokumentacja głęboka** — linki: connector-framework.md, connector-bitrix-design.md (przykład)

**Zależności:** connector-framework, connector-bitrix-design; nie powielać pełnych kontraktów ani modeli.

---

## 5. Environment setup guide

**Lokalizacja:** `docs/environment-setup-guide.md`

**Cel:** Jak uruchomić projekt lokalnie od zera. Wymagania, zmienne, komendy, opcjonalnie seed. Bez długich opisów narzędzi.

**Proponowana struktura:**

- **Wymagania** — Node (wersja), Python (wersja), pnpm/npm, konto Supabase (lub lokal), klucz Claude (Anthropic)
- **Zmienne środowiskowe** — tabela: nazwa, wymagana (tak/nie), opis 1 linia (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET, ENCRYPTION_KEY, CLAUDE_API_KEY, opcjonalnie CLAUDE_MODEL, CORS_ORIGINS). Link do backend-architecture §9 przy pełnej liście.
- **Kroki** — (1) Clone repo, (2) Skopiuj .env.example do .env i uzupełnij, (3) Supabase: nowy projekt lub lokal; uruchom migracje (jeśli są), (4) packages: pnpm install w root (lub per app), (5) apps/api: venv, pip install, uvicorn, (6) apps/web: pnpm dev, (7) Opcjonalnie: seed (tenant, użytkownik, integracja testowa)
- **Weryfikacja** — GET /health, logowanie w UI, jedno pytanie w chacie (jeśli connector mock lub prawdziwy)
- **Typowe problemy** — 2–3: CORS, brak JWT secret, brak klucza Claude; po 1–2 zdania rozwiązania

**Zależności:** backend-architecture (env vars), mvp-backlog / recommended-next-steps (jeśli seed jest opisany gdzie indziej).

---

## 6. MVP scope summary

**Lokalizacja:** `docs/mvp-scope-summary.md`

**Cel:** Jedna strona: co jest w MVP, czego nie ma, główne uproszczenia, kryteria „MVP done”. Szybkie ustalenie granic.

**Proponowana struktura:**

- **W zakresie MVP** — bullety: multi-tenant, jeden tenant = jedna org; chat (pytanie → odpowiedź ze źródłami); panel admina (integracje: lista, dodawanie, test, re-auth); intent → source selection → tylko wybrane źródła; connectorzy Bitrix, Google Drive, Google Sheets; odpowiedź z cytowanymi źródłami; historia konwersacji; audit log (minimalny); live data tylko (bez indeksu)
- **Poza MVP** — bullety: indeks/cache, SSO, wiele instancji integracji na tenant, edytowalna taxonomia po stronie tenanta, API dla zewnętrznych systemów, streaming, pełny audit UI, rate limiting w produkcie
- **Uproszczenia** — 5–7: jedna integracja na typ na tenant, stała taxonomia i mapowanie, jeden model LLM, brak retry w connectorach, brak streamingu, re-auth tylko in-app
- **Kryteria ukończenia MVP** — krótka checklista: tenant isolation działa, ask flow end-to-end z przynajmniej jednym connectorem, źródła widoczne w odpowiedzi, admin może dodać i przetestować integrację, brak krytycznych z QA review (link do qa-architecture-review)
- **Więcej** — linki: mvp-backlog.md, technical-blueprint.md (simplifications, out of scope)

**Zależności:** technical-blueprint (Part C), mvp-backlog, qa-architecture-review (acceptance checklist).

---

## Gdzie co leży (po wdrożeniu)

| Dokument              | Ścieżka                              | Kto czyta pierwszy      |
|-----------------------|--------------------------------------|--------------------------|
| README                | `/README.md`                         | Wszyscy                  |
| Architecture overview | `docs/architecture-overview.md`      | Nowy dev / architekt     |
| ADR list              | `docs/adr/README.md`                 | Kto szuka uzasadnień     |
| Connector guide       | `docs/connector-development-guide.md`| Dev dodający connector   |
| Environment setup     | `docs/environment-setup-guide.md`    | Kto uruchamia lokalnie   |
| MVP scope             | `docs/mvp-scope-summary.md`          | PM / dev / nowy w zespole |

---

## Sugerowana kolejność lektury (nowa osoba)

1. **README** — co to jest, jak uruchomić (link do env guide)
2. **Architecture overview** — jak to działa, główne decyzje
3. **MVP scope summary** — granice projektu
4. **Environment setup guide** — uruchomienie na swoim laptopie
5. **Connector development guide** — gdy trzeba dodać nowe źródło
6. **ADR list** — gdy trzeba zrozumieć „dlaczego tak”

Głęboka dokumentacja (technical-blueprint, backend-architecture, connector-framework, chat-orchestration-design, frontend-architecture, qa-architecture-review, mvp-backlog, connector-bitrix-design) pozostaje w `docs/` jako odnośniki z powyższych dokumentów.

---

## Następny krok

Po akceptacji tej propozycji: napisać treść każdego dokumentu zgodnie ze strukturą (README na root, pozostałe w docs/ i docs/adr/). Można robić po jednym dokumencie i konsultować, albo wszystkie na raz w jednym batchu.
