# apps/api

Backend — **FastAPI**.

- REST API for frontend; auth (Supabase JWT), multi-tenant context.
- Routing-first: intent classification → source selection → connector fetch (parallel) → LLM synthesis → answer with sources.
- Domain: tenants, integrations, chat (conversations, messages), audit.

**Architecture:** See [docs/backend-architecture.md](../../docs/backend-architecture.md) for modules, directory structure, entities/DTOs, endpoints, services, connector contracts, env vars, and mocks.
