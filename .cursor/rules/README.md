# .cursor/rules

Cursor rules for this project. All rules are `.mdc` with frontmatter (`description`, `globs` or `alwaysApply`).

| File | Purpose |
|------|--------|
| **product-context.mdc** | Product goal, flow (intent → source selection → selective query → answer with sources), stack, non-goals. Always applied. |
| **engineering-principles.mdc** | Minimal infra, no n8n, clear boundaries, fail clearly. Always applied. |
| **monorepo-boundaries.mdc** | What lives in apps/web, apps/api, packages; no cross-app imports. Applied when editing `apps/**` or `packages/**`. |
| **ai-orchestration-source-routing.mdc** | Routing-first, intent → source selection, adapter contract, cite sources. Applied when editing API, integrations, or sources. |
| **security-and-secrets.mdc** | No secrets in repo, per-tenant credentials, auth in API, no sensitive data in logs. Always applied. |
| **plan-before-code.mdc** | Design or document before non-trivial implementation; API and integration contracts first. Always applied. |
| **docs-update-discipline.mdc** | When to update architecture brief, recommended steps, READMEs; keep docs in sync. Applied when editing `docs/` or READMEs. |
