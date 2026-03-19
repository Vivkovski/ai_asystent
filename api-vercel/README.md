# Backend Vercel (projekt API w monorepo)

Ten katalog służy do wdrożenia **tylko** FastAPI jako osobnego projektu Vercel (drugi projekt z tego samego repo).

- **Root Directory** w Vercel ustaw na **`api-vercel`**.
- **Framework Preset:** Other.
- Build kopiuje `../apps` (aplikację z `apps/api`) i instaluje zależności; funkcja `api/backend.py` jest serwowana pod `/api/backend`.

Szczegóły: `docs/deployment-vercel-supabase.md`.
