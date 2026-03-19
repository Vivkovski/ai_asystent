# Opis architektury do narzędzi do diagramów (draw.io, Miro, Figma, Lucidchart)

Poniższy tekst możesz wkleić do draw.io, Miro, Figma, Lucidchart lub innego narzędzia i na jego podstawie narysować diagram dla osób nietechnicznych.

---

## Tytuł diagramu

**Jak działa FlixHome Asystent** — architektura dla osób nietechnicznych

---

## Warstwy (od góry do dołu)

### Warstwa 1 — Użytkownik i interfejs

- **Użytkownik** — pracownik firmy; zadaje pytanie w języku naturalnym.
- **Czat / Panel** — aplikacja w przeglądarce; użytkownik wpisuje pytanie i widzi odpowiedź wraz z podanymi źródłami (np. linki do Bitrix, Drive, Sheets).

*Strzałka w dół: „Pytanie trafia do asystenta”.*

---

### Warstwa 2 — Asystent („mózg” systemu)

Jeden duży blok: **Asystent (backend)**.

- **Opis:** Serwis łączy pytanie z systemami firmy i buduje odpowiedź. Nie przeszukuje wszystkich systemów za każdym razem — najpierw rozpoznaje intencję, potem odpytuje tylko wybrane źródła.
- **Kroki wewnątrz (można pokazać jako 4 małe prostokąty w jednym bloku):**
  1. **Rozpoznanie intencji** — system ustala, o co chodzi (np. dane z CRM, dokument z Dysku, arkusz).
  2. **Wybór źródeł** — na podstawie intencji wybiera, które integracje odpytować (np. tylko Bitrix albo tylko Drive).
  3. **Odpytywanie źródeł** — wysyła zapytania tylko do wybranych systemów i zbiera fragmenty danych.
  4. **Odpowiedź ze źródłami** — AI układa odpowiedź i dodaje cytowania (źródła).

*Strzałka w dół: „Dane są pobierane tylko z wybranych integracji”.*

---

### Warstwa 3 — Integracje (połączenia z zewnętrznymi systemami)

Trzy bloki obok siebie:

1. **Bitrix (CRM)** — kontakty, dealy, zadania; dane z CRM firmy.
2. **Google Drive** — dokumenty i pliki; wyszukiwanie w Dysku.
3. **Google Sheets** — arkusze i tabele; dane z arkuszy kalkulacyjnych.

*Każda integracja jest konfigurowana w panelu admina (per firma/tenant). Połączenie: Asystent ↔ integracje (dwustronne — zapytanie w jedną stronę, dane w drugą).*

---

### Warstwa 4 — Wsparcie (baza i AI)

Dwa bloki obok siebie:

- **Supabase** — logowanie użytkowników, dane firm (tenantów), konfiguracja integracji (które źródła są włączone).
- **Claude (AI)** — rozpoznawanie intencji pytania i układanie odpowiedzi z zebranych fragmentów oraz podawanie źródeł.

*Połączenia: Asystent korzysta z Supabase (auth, konfiguracja) i z Claude (intencja + odpowiedź).*

---

## Przepływ w jednym zdaniu (do opisu lub legendy)

Pytanie → Asystent rozpoznaje intencję → Wybiera tylko relevantne źródła (np. CRM albo Drive) → Pobiera dane z tych systemów → AI układa odpowiedź i cytuje źródła → W czacie użytkownik widzi odpowiedź i linki do źródeł. Integracje są konfigurowane w panelu admina per firma (tenant).

---

## Sugestie wizualne

- **Kolory:** np. użytkownik/czat — jeden kolor (np. niebieski), asystent — inny (np. zielony), integracje — np. pomarańczowy/żółty, Supabase/Claude — neutralny (szary).
- **Strzałki:** zawsze w dół między warstwami; między Asystentem a integracjami — strzałki w obie strony (zapytanie → dane).
- **Ikony:** człowiek przy użytkowniku, okno czatu przy panelu, trybik/mózg przy asystencie, logo Bitrix / Drive / Sheets przy integracjach (jeśli narzędzie na to pozwala).
