# FlixHome Asystent

AI Asystent dla firm — odpowiada pracownikom na pytania na podstawie aktualnych danych z podłączonych systemów (bez ręcznej bazy wiedzy).

## Założenia produktowe

- **Intencja** → wybór źródeł → **odpytywanie tylko wybranych** → odpowiedź AI ze źródłami  
- To nie chatbot przeszukujący wszystko; system wybiera najbardziej prawdopodobne źródła i odpytuje tylko je.

## Stack (planowany)

| Warstwa      | Technologia |
|-------------|-------------|
| Frontend    | Next.js     |
| Backend     | FastAPI     |
| DB / Auth / Storage | Supabase |
| LLM         | Claude (pierwszy provider) |
| Infrastruktura | Minimalna, bez n8n |

## Monorepo

- **Multi-tenant** w core.
- Opcjonalnie: dedicated deployment dla pojedynczego klienta.
- Pierwsze integracje: Bitrix, Google Drive, Google Sheets (wybierane z panelu admina).

## Zasady architektury

- [Architecture principles](docs/architecture-principles.md) — no overengineering, monorepo boundaries, routing-first, selective querying, no connector logic in orchestration.

## Dokumentacja

- [Product brief i architektura](docs/architecture-and-product-brief.md)
- [Kolejność dalszej pracy](docs/recommended-next-steps.md)
- [Struktura monorepo](docs/monorepo-structure.md) — layout, odpowiedzialności katalogów, granice, kolejność tworzenia
- [Technical blueprint](docs/technical-blueprint.md) — pełna specyfikacja techniczna (architektura, modele, flow, ryzyka, uproszczenia MVP, poza scope)
- [MVP backlog](docs/mvp-backlog.md) — backlog MVP w fazach + rekomendowana kolejność implementacji
- [Backend](docs/backend-architecture.md) · [Frontend](docs/frontend-architecture.md) · [Connector framework](docs/connector-framework.md) · [Chat orchestration](docs/chat-orchestration-design.md) — architektura warstw  
- [QA / architecture review](docs/qa-architecture-review.md) — ryzyka, failure modes, checklist MVP, rekomendacje

## Struktura repozytorium

```
apps/web/           # Next.js (frontend)
apps/api/           # FastAPI (backend)
packages/shared/    # Współdzielone typy, stałe, narzędzia
packages/connectors/# Adaptery (Bitrix, Google Drive, Google Sheets)
packages/prompts/   # Szablony promptów, taxonomia intencji
docs/               # Architektura, PRD, plany
.cursor/            # Rules, agents
```

Szczegóły i granice zależności: [docs/monorepo-structure.md](docs/monorepo-structure.md).

## Uruchomienie (dev)

- **Wymagania:** Node 20+, pnpm; dla API: Python 3.11+ i [uv](https://docs.astral.sh/uv/) (zalecane) lub pip + venv.
- Z roota repozytorium:
  - `pnpm install` — instaluje zależności dla workspace (web + shared).
  - `pnpm run dev:web` — buduje shared i uruchamia Next.js (http://localhost:3000).
  - `pnpm run dev:api` — uruchamia FastAPI przez uv (http://127.0.0.1:8000). Przy pierwszym uruchomieniu uv utworzy venv w `apps/api` i zainstaluje zależności.
- Aby tylko zbudować: `pnpm run build` (shared + web).
