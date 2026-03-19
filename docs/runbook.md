# Runbook — uruchomienie i zmienne środowiskowe

## Wymagania

- Node.js 20+, pnpm
- Konto Supabase (projekt + migracje)

## Kroki uruchomienia

1. **Klon repozytorium**
   ```bash
   git clone <repo> && cd flixhome_asystent
   ```

2. **Zależności**
   ```bash
   pnpm install
   ```

3. **Zmienne środowiskowe**
   - W katalogu głównym lub `apps/web`: skopiuj `.env.example` do `.env.local` (web) i uzupełnij.
   - Zmienne backendu (SUPABASE_*, ENCRYPTION_KEY, OPENROUTER_*, GOOGLE_*) ustaw w tym samym pliku — Next.js API Routes korzysta z nich po stronie serwera.

4. **Supabase**
   - Utwórz projekt w Supabase.
   - Uruchom migracje: `supabase db push` (z katalogu zawierającego `supabase/migrations`) lub wykonaj migracje ręcznie w SQL Editor.
   - Opcjonalnie: `supabase/seed.sql` dla danych startowych.

5. **Seed (opcjonalnie)**
   - Użyj skryptu `scripts/seed_admin_user.py` z Pythonem i zmiennymi SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (poza tym projektem), albo utwórz użytkownika i profil ręcznie w Supabase.

6. **Uruchomienie**
   - Z roota: `pnpm run dev` (buduje shared, uruchamia Next.js).
   - Aplikacja: `http://localhost:3000`. API: `http://localhost:3000/api/...`.

7. **Weryfikacja**
   - `GET http://localhost:3000/api/health` → `{"status":"ok"}`.
   - `GET http://localhost:3000/api/health?debug=1` — flagi auth (supabase_url_set itd.).
   - Web: `/login` → logowanie Supabase; po zalogowaniu `/chat`, `/admin/integrations`.

**Testy (smoke):** Po deployu sprawdź `GET /api/health` i `GET /api/health?debug=1`. Chronione endpointy (/api/v1/me, /api/v1/conversations) wymagają zalogowania w aplikacji.

---

## Zmienne środowiskowe

Wszystkie zmienne ustaw w jednym miejscu (np. `.env.local` w `apps/web` lub root). Next.js ładuje je dla Route Handlers (serwer).

| Zmienna | Wymagana | Opis |
|--------|----------|------|
| `SUPABASE_URL` | Tak | URL projektu Supabase (np. `https://xxx.supabase.co`) |
| `SUPABASE_KEY` | Tak | Klucz **service_role** — dostęp do tabel, RLS bypass |
| `SUPABASE_JWT_SECRET` | Tak | JWT Secret z Supabase (Dashboard → Settings → API) — do weryfikacji tokenów |
| `ENCRYPTION_KEY` | Tak | Min. 32 znaki — do szyfrowania credentials integracji (np. `openssl rand -base64 32`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Tak | Ten sam URL co Supabase projektu (frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tak | Klucz **anon** — logowanie w przeglądarce |
| `GOOGLE_CLIENT_ID` | Dla Drive/Sheets | Client ID z Google Cloud Console (OAuth 2.0) |
| `GOOGLE_CLIENT_SECRET` | Dla Drive/Sheets | Client Secret z Google Cloud Console |
| `GOOGLE_OAUTH_REDIRECT_URI` | Dla „Zaloguj przez Google” | URL callback, np. `http://localhost:3000/admin/integrations/google/callback` (dev) lub `https://<domena>/admin/integrations/google/callback` (prod) |
| `OPENROUTER_API_KEY` | Dla LLM | API key z [openrouter.ai](https://openrouter.ai); bez klucza intent domyślny (crm) |
| `OPENROUTER_MODEL` | Nie | Model w OpenRouter (domyślnie `openai/gpt-4o-mini`) |

**Uwaga:** `NEXT_PUBLIC_API_URL` nie jest już wymagany — frontend wywołuje API pod tym samym hostem (`/api/v1/...`).

---

## Observability

- **Audit:** zdarzenia `message_created`, `integration_connected` zapisywane w tabeli `audit_logs` (bez treści wiadomości i credentials).
- **Błędy:** API zwraca kształt `{ "code": "...", "message": "..." }` lub `{ "detail": "..." }`; 500 bez stack trace w odpowiedzi.

---

## Częste problemy

- **500 na /api/v1/me lub /api/v1/conversations (czat nie działa)** — brak konfiguracji Supabase lub nieobsłużony wyjątek. Kroki:
  1. Sprawdź: `GET https://<domena>/api/health?debug=1` — w odpowiedzi `auth_config` pokaże, czy są ustawione `supabase_url`, `supabase_key`, `supabase_jwt_secret`.
  2. Na Vercel ustaw w projekcie zmienne: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET` (oraz `NEXT_PUBLIC_SUPABASE_*`). Po zmianie zrób **Redeploy**.
- **401 na /api/v1/me** — sprawdź `SUPABASE_JWT_SECRET` (musi być JWT Secret z Dashboard, np. Legacy JWT Secret).
- **Encryption failed przy dodawaniu integracji** — ustaw `ENCRYPTION_KEY` (min. 32 znaki).
- **Google Drive: „refresh_token required”** — użyj przycisku „Zaloguj się przez Google” w adminie (wymaga GOOGLE_*). W Google Cloud Console dodaj w Authorized redirect URIs dokładnie ten sam URL co `GOOGLE_OAUTH_REDIRECT_URI`.
- **Google OAuth: 403 access_denied** — aplikacja jest w trybie **Testing**. W Google Cloud Console → APIs & Services → OAuth consent screen → **Test users** dodaj e-mail, którym logujesz się (np. wywijas.p@gmail.com). Zapisz i spróbuj ponownie. Aby udostępnić wszystkim: ustaw **Publishing status** na **In production** (dla Drive może być później wymagana weryfikacja Google).
