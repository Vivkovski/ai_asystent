# .cursor/agents

Subagent profiles for this project. Reference a file in chat (e.g. "act as .cursor/agents/backend-implementer.md") or paste its content for role-specific context.

## Project context (generic)

| File | Use |
|------|-----|
| **default.md** | Lightweight project context (goal, flow, stack) when no specific role is needed. |

## Role-based subagents (6)

| File | Role | When to use |
|------|------|-------------|
| **solution-architect.md** | Solution Architect | Design flows, APIs, intent taxonomy; document architecture; no code. |
| **backend-implementer.md** | Backend Implementer | Implement or change FastAPI, orchestration, auth, in `apps/api`. |
| **frontend-builder.md** | Frontend Builder | Implement or change Next.js UI and admin panel in `apps/web`. |
| **connector-engineer.md** | Connector Engineer | Implement or change adapters (Bitrix, Google Drive, Google Sheets). |
| **qa-reviewer.md** | QA Reviewer | Review code and behavior against rules; suggest fixes and tests. |
| **docs-prd-writer.md** | Docs / PRD Writer | Write or update PRDs, architecture, recommended steps, READMEs. |

Each file contains: Description, Responsibilities, Constraints/Rules, Expected Output Style, When to Use.
