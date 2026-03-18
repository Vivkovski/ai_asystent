# Architecture & Product Brief — FlixHome Asystent

## 1. Product Brief

### 1.1 Cel

Aplikacja **AI Asystent dla firm**: pracownicy zadają pytania w języku naturalnym i otrzymują odpowiedzi oparte na **aktualnych danych z podłączonych systemów** (CRM, dyski, arkusze itd.), **bez** ręcznego utrzymywania klasycznej bazy wiedzy (FAQ, wiki).

### 1.2 Wartość

- **Aktualność** — odpowiedzi z żywych systemów, a nie ze zaktualizowanej ręcznie dokumentacji.
- **Celowane odpytanie** — system nie przeszukuje wszystkiego; rozpoznaje intencję i odpytuje tylko wybrane źródła, co ogranicza koszt i czas.
- **Źródła w odpowiedzi** — użytkownik wie, skąd pochodzi informacja (np. Bitrix, Drive, Sheets).

### 1.3 Użytkownicy (docelowo)

- **Pracownik** — zadaje pytania w interfejsie chatu / formularza.
- **Administrator (tenant)** — konfiguruje integracje i (w przyszłości) zakres dostępu do źródeł.

### 1.4 Kluczowy flow (obowiązujący)

1. **Pytanie** — użytkownik wpisuje pytanie.
2. **Rozpoznanie intencji** — system klasyfikuje, o co chodzi (np. „dane z CRM”, „dokument z Dysku”, „arkusz”).
3. **Wybór źródeł** — na podstawie intencji wybierane są najbardziej prawdopodobne źródła (integracje / konkretne typy danych).
4. **Odpytywanie** — zapytania idą **tylko** do wybranych źródeł (z limitami, paginacją).
5. **Odpowiedź** — LLM (Claude) buduje odpowiedź z zebranych danych i **podaje źródła**.

To nie jest chatbot, który za każdym razem przeszukuje wszystkie systemy.

---

## 2. Założenia techniczne

| Obszar | Wybór |
|--------|--------|
| Frontend | Next.js |
| Backend | FastAPI |
| Baza / Auth / Storage | Supabase |
| LLM | Claude (pierwszy provider) |
| Automatyzacje | Brak n8n |
| Infrastruktura | Minimalna |
| Model wdrożenia | Multi-tenant core; opcjonalnie dedicated deployment na klienta |

---

## 3. Architektura wysokopoziomowa

```
┌─────────────────────────────────────────────────────────────────┐
│  Użytkownik / Admin                                              │
└─────────────────────────────┬───────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  apps/web (Next.js)                                              │
│  • Aplikacja użytkownika: chat / pytania, odpowiedzi ze źródłami  │
│  • Panel admina: tenanty, integracje, konfiguracja źródeł         │
└─────────────────────────────┬───────────────────────────────────┘
                               │ HTTP / API
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  apps/api (FastAPI)                                              │
│  • Auth (Supabase JWT / session)                                 │
│  • Intencja → wybór źródeł → odpytanie źródeł → LLM             │
└──────┬──────────────────────┬─────────────────────┬──────────────┘
       │                      │                     │
       ▼                      ▼                     ▼
┌──────────────┐    ┌─────────────────┐    ┌─────────────────────┐
│  Supabase    │    │  Adaptery       │    │  Claude (LLM)       │
│  DB, Auth,   │    │  Bitrix,        │    │  • intencja         │
│  Storage     │    │  Google Drive,   │    │  • odpowiedź        │
│              │    │  Google Sheets   │    │    ze źródłami      │
└──────────────┘    └─────────────────┘    └─────────────────────┘
```

### 3.1 Warstwy

- **Frontend (Next.js)** — UI użytkownika i admina; wywołania API do backendu; auth przez Supabase (np. session).
- **Backend (FastAPI)** — orkiestracja: wejście (pytanie + kontekst tenant/user) → intencja → wybór źródeł → odpytanie adapterów → wywołanie Claude → odpowiedź ze źródłami.
- **Supabase** — użytkownicy, tenanty, konfiguracja integracji, metadane źródeł, ewentualnie cache; storage dla plików jeśli potrzebne.
- **Adaptery** — Bitrix, Google Drive, Google Sheets; każdy ma kontrakt (wejście/wyjście, autoryzacja, limity). Wybór adapterów zależy od konfiguracji tenantów w panelu admina.
- **Claude** — rozpoznawanie intencji (lub wsparcie dla niej), budowanie odpowiedzi na podstawie danych ze źródeł i cytowanie źródeł.

### 3.2 Multi-tenant

- **Tenant** — np. firma / organizacja; izolacja danych i konfiguracji.
- W API każdy request w kontekście `tenant_id` (z tokena / sesji).
- Konfiguracja integracji (które są włączone, credentials, scope) per tenant.
- Opcjonalnie: deployment dedykowany dla jednego klienta (ta sama aplikacja, jedna tenant).

---

## 4. Przepływ danych (uproszczony)

1. **Request:** pytanie użytkownika + kontekst (tenant, user).
2. **Intencja:** klasyfikacja (np. LLM lub hybryda) → typ zapytania / kategoria źródeł.
3. **Źródła:** na podstawie intencji i konfiguracji tenantów → lista źródeł do odpytania (np. „Bitrix – kontakty”, „Drive – ostatnie pliki”).
4. **Odpytywanie:** równoległe lub sekwencyjne wywołania adapterów; zbieranie fragmentów/obiektów + metadane źródła.
5. **Odpowiedź:** prompt do Claude: pytanie użytkownika + zebrane fragmenty + instrukcja „odpowiedz i cytuj źródła” → odpowiedź zwracana do frontendu.
6. **Frontend:** wyświetla odpowiedź i (opcjonalnie) listę źródeł (np. linki do Bitrix/Drive/Sheets).

---

## 5. Integracje (pierwsza faza)

| Integracja | Przeznaczenie (przykłady) | Konfiguracja |
|------------|---------------------------|--------------|
| **Bitrix** | CRM, kontakty, zadania, dealy | OAuth / API key per tenant, z panelu admina |
| **Google Drive** | Dokumenty, pliki, wyszukiwanie | OAuth per tenant, z panelu admina |
| **Google Sheets** | Arkusze, tabele, raporty | OAuth per tenant, z panelu admina |

- Włączanie/wyłączanie i konfiguracja (credentials, scope) z **panelu admina**, per tenant.
- Adaptery zwracają ustandaryzowany format (np. fragmenty + źródło + typ), żeby backend mógł łączyć wyniki i przekazać do LLM.

---

## 6. Infrastruktura (minimalna)

- **Hosting:** na razie bez ustaleń; możliwe Vercel (Next.js) + osobny host pod FastAPI, lub kontener/VM łączący oba.
- **Supabase:** projekt w chmurze Supabase (lub self-hosted przy dedicated deployment).
- **Bez n8n** — orkiestracja w kodzie FastAPI, nie w zewnętrznym silniku workflow.
- **Secrets:** credentials integracji i klucze API (np. Claude) w zmiennych środowiskowych / vault; per tenant tam, gdzie ma to sens (np. Supabase Vault).

---

## 7. Decyzje do doprecyzowania w kolejnych krokach

- **Taxonomia intencji** — lista kategorii / typów pytań i mapowanie na źródła.
- **Format odpowiedzi** — struktura JSON (tekst + lista źródeł z linkami/tytułami).
- **Limity i paginacja** — ile wyników z jednego źródła, łącznie; timeouty.
- **Cache** — czy i gdzie cache’ować wyniki ze źródeł (np. krótki TTL w Supabase/Redis).
- **Dedicated deployment** — jeden repozytorium, wiele instancji; konfiguracja per instancja (env, jedna tenant).

---

*Dokument foundation; aktualizowany w trakcie discovery i implementacji. Brak kodu i endpointów — tylko architektura i product brief.*
