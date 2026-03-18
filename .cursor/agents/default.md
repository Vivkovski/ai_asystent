# Agent — domyślny kontekst projektu

## Projekt

FlixHome Asystent: AI Asystent dla firm. Odpowiedzi na pytania pracowników na podstawie **aktualnych danych z podłączonych systemów**, bez ręcznej bazy wiedzy.

## Flow (obowiązujący)

1. User zadaje pytanie.
2. System **rozpoznaje intencję**.
3. System **wybiera najbardziej prawdopodobne źródła** (nie wszystkie).
4. System **odpytuje tylko wybrane źródła**.
5. AI **buduje odpowiedź ze źródłami**.

Nie projektuj ani nie implementuj „chatbota, który przeszukuje wszystko”.

## Stack

- Frontend: Next.js (apps/web)
- Backend: FastAPI (apps/api)
- DB/Auth/Storage: Supabase
- LLM: Claude (pierwszy provider)
- Bez n8n, minimalna infrastruktura

## Monorepo, multi-tenant

- Monorepo: apps/web, apps/api, packages.
- Multi-tenant w core; opcjonalnie dedicated deployment na klienta.
- Integracje (Bitrix, Google Drive, Google Sheets) konfigurowane z panelu admina.

## Dokumentacja

- Architektura i product brief: `docs/architecture-and-product-brief.md`
- Kolejność pracy: `docs/recommended-next-steps.md`
- Reguły: `.cursor/rules/`
