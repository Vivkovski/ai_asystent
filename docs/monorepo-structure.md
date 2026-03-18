# Monorepo structure — AI Assistant platform

Target directory layout, responsibilities, boundaries, and recommended creation order. No application code here; structure and boundaries only.

---

## 1. Tree structure

```
.
├── apps/
│   ├── web/                    # Next.js frontend
│   └── api/                    # FastAPI backend
├── packages/
│   ├── shared/                 # Shared types, constants, small utilities
│   ├── connectors/             # Connector adapters (Bitrix, Google Drive, Google Sheets)
│   └── prompts/                # Prompt templates and intent taxonomy (text / structured)
├── docs/                       # Architecture, PRDs, runbooks, recommended steps
├── supabase/                  # Supabase project (migrations, seed, config) — optional at start
├── .cursor/                    # Rules and agents
│   ├── rules/
│   └── agents/
├── README.md
└── .gitignore
```

**Optional later (not in initial tree):**

- **scripts/** — One-off or dev scripts (e.g. seed DB, run migrations from CLI). Add when you need repeatable automation that doesn’t belong in an app or Supabase CLI.
- **config/** — Root-level shared tooling (e.g. base `tsconfig.json`, shared ESLint config). Add when you have multiple apps/packages that need the same config and you want a single source of truth at repo root.

---

## 2. Responsibility of each directory

| Directory | Responsibility |
|-----------|----------------|
| **apps/web** | Next.js app: user-facing chat/assistant UI and admin panel. Auth via Supabase client; all server-side business logic and integrations go through **apps/api** via HTTP. |
| **apps/api** | FastAPI app: HTTP API, auth (Supabase JWT/session), orchestration (intent → source selection → connector calls → LLM), and Supabase server-side usage. No UI; no direct frontend code. |
| **packages/shared** | Code used by both **apps/web** and **apps/api**: shared types (e.g. API request/response shapes), constants (e.g. intent keys), and small pure utilities. No app-specific logic, no DB/auth, no connector or LLM code. |
| **packages/connectors** | Connector adapters: Bitrix, Google Drive, Google Sheets (and future connectors). Each adapter implements the same contract (input: query context, tenant config, limits; output: fragments + source metadata). Used only by **apps/api**. No orchestration or prompt logic here. |
| **packages/prompts** | Prompt templates and intent taxonomy as versioned assets: e.g. system prompts for intent classification and answer synthesis, optional structured format (YAML/JSON). Loaded by **apps/api** (or a small loader). No app code; only text/config. |
| **docs** | Product and technical documentation: architecture brief, PRDs, recommended next steps, API/contract docs, runbooks. Single source of truth for “how the system is designed” and “what to do next.” |
| **supabase** | Supabase project config: migrations, seed data, local config. Use when you adopt Supabase CLI; can be added after the first app code. |
| **.cursor** | Cursor-specific context: **rules** (product context, engineering principles, boundaries, security, etc.) and **agents** (solution architect, backend, frontend, connector, QA, docs). |

---

## 3. What not to mix between directories

### Dependency rules

- **apps/web** may depend on **packages/shared** only. Must not import from **apps/api**, **packages/connectors**, or **packages/prompts** (no backend or connector logic in the frontend).
- **apps/api** may depend on **packages/shared**, **packages/connectors**, and **packages/prompts**. Must not import from **apps/web** (no UI in the API).
- **packages/shared** must not depend on any app or on **packages/connectors** / **packages/prompts** (stays minimal and framework-agnostic).
- **packages/connectors** may depend only on **packages/shared** (e.g. for types like `Fragment`, `SourceMetadata`). Must not depend on **apps/** or **packages/prompts**.
- **packages/prompts** should have no code dependencies on apps or other packages; it is text/config consumed by **apps/api**.

### What belongs where

- **Secrets / credentials:** Only in environment or Supabase (e.g. Vault). Never in **packages/** or **apps/web**; **apps/api** reads env/Supabase per request.
- **Orchestration (intent → sources → LLM):** Only in **apps/api**. Not in **packages/connectors** (adapters only fetch data) or **packages/prompts** (only text).
- **Connector implementations:** Only in **packages/connectors**. **apps/api** imports and calls them; it does not contain the full adapter code for Bitrix/Google.
- **Prompt text / intent taxonomy:** Only in **packages/prompts**. **apps/api** loads and uses it; no prompt strings scattered in **apps/api** business logic.
- **Shared types and API contracts:** In **packages/shared** so both **apps/web** and **apps/api** (and optionally **packages/connectors**) use the same shapes. Avoid duplicating type definitions in each app.

### Cross-boundary don’ts

- Do not put UI components or Next.js pages in **apps/api** or **packages/**.
- Do not put FastAPI routes or Supabase server-side logic in **apps/web** or **packages/** (except shared types).
- Do not put adapter implementations (Bitrix, Google, etc.) in **apps/web** or inside **apps/api** if you have **packages/connectors**; keep them in **packages/connectors**.
- Do not put prompt text or intent taxonomy in **apps/api** source files; keep them in **packages/prompts** and load at runtime.

---

## 4. Recommended order for creating directories

Create folders in this order so dependencies and ownership are clear from the start:

| Order | Directory | Reason |
|-------|-----------|--------|
| 1 | **docs/** | Already exists. Keep architecture, PRDs, and recommended steps here. |
| 2 | **.cursor/** | Already exists. Rules and agents define product and engineering boundaries. |
| 3 | **packages/shared** | No dependencies on other packages. Defines types and constants that **apps** and **packages/connectors** will use. Create first so others can depend on it. |
| 4 | **packages/prompts** | No code deps. Prompt templates and intent taxonomy are needed before orchestration in **apps/api**. |
| 5 | **packages/connectors** | Depends on **packages/shared** for types. Adapters implement the contract used by **apps/api**; create after shared so contract types exist. |
| 6 | **apps/api** | Depends on **packages/shared**, **packages/connectors**, **packages/prompts**. Orchestration and API live here; create after packages are in place. |
| 7 | **apps/web** | Depends on **packages/shared**. Can be created in parallel with **apps/api** once shared exists, or right after. |
| 8 | **supabase/** | Add when you introduce Supabase CLI (migrations, seed). Optional until you need versioned migrations or local Supabase. |

**Summary:** docs → .cursor → packages/shared → packages/prompts → packages/connectors → apps/api → apps/web → supabase (when needed). Scripts/ and config/ only if you need them later.
