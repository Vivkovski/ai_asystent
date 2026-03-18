# Design system — AI Assistant

Jeden źródłowy opis kolorów, typografii i komponentów dla frontendu (`apps/web`). Tokeny są zmapowane w `tailwind.config.ts`; w kodzie używaj klas Tailwind lub komponentów z `components/ui`.

---

## Kolory

### Primary (akcent, przyciski, linki)

- **primary-600** — główny przycisk, linki (`bg-primary-600`, `text-primary-600`)
- **primary-500** / **primary-700** — hover / active
- Klasy: `bg-primary-600`, `text-primary-600`, `hover:bg-primary-700`

### Neutral (tła, obramowania, tekst)

- **neutral-50** — tło strony / sekcji
- **neutral-100** — tło nagłówka tabeli, karty
- **neutral-200** — obramowania (`border-neutral-200`)
- **neutral-600** — tekst drugoplanowy (`text-neutral-600`)
- **neutral-800** — tekst główny (`text-neutral-800`)

### Semantyczne (statusy, komunikaty)

- **success** — „Połączono”, sukces (`text-success`, `bg-success-light`)
- **warning** — „Wyłączona”, uwaga (`text-warning`, `bg-warning-light`)
- **error** — „Błąd”, błędy formularza (`text-error`, `bg-error-light`)

---

## Typografia

- **Nagłówek strony (h1):** `text-2xl font-semibold` lub `text-heading-lg`
- **Nagłówek sekcji (h2):** `text-xl font-semibold` lub `text-heading-md`
- **Body:** `text-base` / `text-body` (domyślny rozmiar)
- **Caption / drugoplanowy:** `text-sm text-neutral-600` lub `text-caption`
- **Etykiety formularzy:** `text-sm font-medium`

---

## Spacing

- **Sekcja / strona:** `p-4` lub `p-6`
- **Odstęp między blokami:** `space-y-4` / `space-y-6` lub `gap-4` / `gap-6`
- **Formularze:** `space-y-4` między polami; etykieta nad polem: `mb-1`

---

## Komponenty

### Button

- **Primary:** główna akcja (Zaloguj, Dodaj integrację). Klasy: `bg-primary-600 text-white rounded py-2 px-4 font-medium hover:bg-primary-700 disabled:opacity-50`
- **Secondary:** akcja drugoplanowa. Obramowanie + neutralne tło.
- **Ghost:** bez tła (np. w sidebarze). `text-neutral-600 hover:bg-neutral-100`
- **Danger:** usuwanie / krytyczna akcja. `bg-error text-white` lub `text-error`
- Rozmiary: `sm` (`text-sm py-1.5 px-3`), `md` (domyślny)

Komponent: `components/ui/Button.tsx` — warianty `primary` | `secondary` | `ghost` | `danger`, rozmiary `sm` | `md`, prop `disabled`.

### Input

- Pola tekstowe: `w-full border border-neutral-200 rounded px-3 py-2`; przy błędzie: `border-error`
- Z etykietą: `<Label>` + `<input className="...">`
- Komunikat błędu pod polem: `text-sm text-error`

Komponent: `components/ui/Input.tsx` — opcjonalne `label`, `error`, `type` (text | email | password).

### Label

- Etykieta nad polem: `block text-sm font-medium mb-1` (lub wchodzi w skład `Input`).

Komponent: `components/ui/Label.tsx` — opcjonalnie używany samodzielnie lub wewnątrz `Input`.

### Badge (status)

- **success:** „Połączono” — `text-success`
- **warning:** „Wyłączona” — `text-warning`
- **error:** „Błąd” — `text-error`

Komponent: `components/ui/Badge.tsx` — wariant `success` | `warning` | `error`; używany w tabeli integracji.

### Card

- Kontener z obramowaniem lub cieniem i paddingiem: `border border-neutral-200 rounded-lg p-4` (lub `shadow-sm` zamiast border).

Komponent: `components/ui/Card.tsx` — opcjonalny nagłówek; używany do bloków na stronie dodawania integracji.

### PageTitle

- Nagłówek strony + opcjonalny opis: tytuł `text-xl font-semibold` lub `text-2xl`, opis `text-neutral-600 mt-2`.

Komponent: `components/ui/PageTitle.tsx` — props `title`, opcjonalnie `description`.

### Link

- Link tekstowy: `text-primary-600 hover:underline`. W nawigacji: zwykły tekst + `font-semibold` gdy aktywny.

---

## Tabela

- Obramowanie: `border border-neutral-200`, komórki `border border-neutral-200 p-2`
- Nagłówek: `bg-neutral-50` (lub `bg-neutral-100`)
- Tekst drugoplanowy w komórkach: `text-sm text-neutral-600`

---

## Odniesienia

- Konfiguracja tokenów: [apps/web/tailwind.config.ts](../apps/web/tailwind.config.ts)
- Komponenty UI: [apps/web/components/ui/](../apps/web/components/ui/)
- Stylowanie: klasy Tailwind w komponentach lub użycie komponentów z `components/ui`.
