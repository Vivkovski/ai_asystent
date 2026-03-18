# Rekomendowana kolejność dalszej pracy

Po zakończeniu foundation (struktura projektu, rules, agents, architecture brief) poniższa kolejność pozwala iść od fundamentów do działającej pętli bez zbędnego kodu z góry.

---

## Faza 0 — Ustalenia (bez kodu)

1. **Taxonomia intencji**  
   Określić kategorie pytań (np. „dane z CRM”, „dokument z Dysku”, „arkusz”) i mapowanie: intencja → które źródła odpytujemy. To wpływa na prompt do Claude i na logikę wyboru źródeł.

2. **Kontrakt odpowiedzi**  
   Zdefiniować format odpowiedzi (np. JSON: `{ "answer": "...", "sources": [{ "type", "id", "title", "url?" }] }`) i sposób prezentacji źródeł w UI.

3. **Kontrakty adapterów**  
   Dla Bitrix, Google Drive, Google Sheets: co adapter przyjmuje (zapytanie, filtry, limit), co zwraca (fragmenty + metadane źródła), jak paginuje i jak obsługuje błędy.

---

## Faza 1 — Infrastruktura i auth

4. **Projekt Supabase**  
   Założyć projekt (lub repozytorium konfiguracji), wstępny schemat: użytkownicy (Supabase Auth), tenanty, tabela konfiguracji integracji per tenant (np. typ, credentials_encrypted, scope). Na razie bez wdrażania migracji w CI.

5. **Auth w API i Web**  
   FastAPI: weryfikacja JWT/sesji Supabase, wyciąganie `tenant_id` i `user_id`. Next.js: logowanie przez Supabase Auth, przekazywanie tokena do API. Nie implementować jeszcze pełnego panelu admina — wystarczy jeden tenant i jeden użytkownik testowy.

6. **Szkielet monorepo**  
   Inicjalizacja `apps/api` (FastAPI) i `apps/web` (Next.js) w monorepo (np. workspace npm/pnpm, lub osobne repozytoria w jednym drzewie). Brak pełnej logiki biznesowej — tylko „hello world” API i strona główna, żeby uruchomić oba stosy lokalnie.

---

## Faza 2 — Logika rdzenia (backend)

7. **Moduł intencji**  
   Na wejściu: pytanie użytkownika. Na wyjściu: kategoria intencji (zgodna z taxonomią). Pierwsza wersja: wywołanie Claude z promptem (bez adapterów). Ewentualnie później: lekki klasyfikator + LLM fallback.

8. **Moduł wyboru źródeł**  
   Wejście: intencja + konfiguracja tenantów (które integracje włączone). Wyjście: lista źródeł do odpytania (np. `["bitrix_contacts", "drive_files"]`). Na początek reguły / mapowanie na podstawie taxonomii; bez uczenia maszynowego.

9. **Orkiestracja zapytania**  
   Jedna ścieżka w API: pytanie → intencja → wybór źródeł → wywołanie tylko wybranych adapterów (na razie mock lub jeden prawdziwy adapter) → zebranie wyników → wywołanie Claude (odpowiedź + cytowanie źródeł) → zwrot do klienta według kontraktu odpowiedzi.

---

## Faza 3 — Integracje

10. **Adapter Bitrix**  
    Połączenie z API Bitrix (OAuth lub API key z konfiguracji tenantów). Implementacja kontraktu adaptera: wejście (np. zapytanie tekstowe, typ zasobu), wyjście (fragmenty + metadane). Obsługa błędów i limitów.

11. **Adapter Google Drive**  
    OAuth per tenant, wyszukiwanie plików / treści. Ten sam kontrakt adaptera co Bitrix. Konfiguracja w panelu admina (później) — na razie można jednego tenant-a z tokenem.

12. **Adapter Google Sheets**  
    OAuth per tenant, odczyt arkuszy/zakresów. Kontrakt spójny z resztą adapterów.

13. **Panel admina — integracje**  
    UI w Next.js: lista integracji, włącz/wyłącz, konfiguracja OAuth/API key (zapis w Supabase, zaszyfrowane). Powiązanie konfiguracji z tenantem.

---

## Faza 4 — Frontend użytkownika i dopracowanie

14. **Chat / formularz pytania**  
    Interfejs w Next.js: pole pytania, wysyłka do API, wyświetlanie odpowiedzi i listy źródeł (zgodnie z kontraktem odpowiedzi).

15. **Doświadczenie i edge case’y**  
    Obsługa długich odpowiedzi, loading, błędy (brak źródeł, timeout adaptera, błąd Claude). Ewentualnie podstawowy cache po stronie API (np. krótki TTL dla tych samych pytań w ramach tenant-a).

16. **Dedicated deployment (opcjonalnie)**  
    Dokumentacja lub skrypty: jedna instancja = jeden tenant, zmienne środowiskowe, Supabase osobny lub ten sam z izolacją po `tenant_id`.

---

## Kolejność w skrócie

| Krok | Treść |
|------|--------|
| 0.1 | Taxonomia intencji + mapowanie na źródła |
| 0.2 | Kontrakt odpowiedzi + kontrakty adapterów |
| 1.1 | Supabase: projekt + wstępny schemat (tenanty, integracje) |
| 1.2 | Auth w API i Web (Supabase Auth, tenant/user w requestach) |
| 1.3 | Szkielet monorepo (FastAPI + Next.js uruchomione lokalnie) |
| 2.1 | Moduł intencji (Claude / prompt) |
| 2.2 | Moduł wyboru źródeł (reguły + konfiguracja tenantów) |
| 2.3 | Orkiestracja: pytanie → intencja → źródła → adaptery → Claude → odpowiedź |
| 3.1 | Adapter Bitrix |
| 3.2 | Adapter Google Drive |
| 3.3 | Adapter Google Sheets |
| 3.4 | Panel admina — konfiguracja integracji |
| 4.1 | UI użytkownika: chat + odpowiedź ze źródłami |
| 4.2 | UX, błędy, opcjonalnie cache |
| 4.3 | (Opcjonalnie) dedicated deployment |

---

*Po foundation nie wdrażamy jeszcze backendu ani frontu w produkcji — najpierw Faza 0 i Faza 1, potem iteracyjnie Faza 2–4.*
