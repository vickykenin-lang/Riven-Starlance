# Riven-Starlance

Riven-Starlance is a multi-agent research platform designed around one orchestrator agent and four parallel specialist research agents, with a live event-driven dashboard.

## Project status

Foundation phase started. Source implementation is beginning; no production deployment or live Bedrock inference is claimed yet.

## Core architecture

- **Main Orchestrator**: decomposes a research task, assigns workstreams, reviews evidence, detects conflicts, requests follow-up research, and synthesizes the final answer.
- **4 Research Agents**: execute independent research workstreams in parallel.
- **Provider abstraction**: AWS Bedrock is the default provider, with provider adapters designed so alternatives can be added independently.
- **Evidence layer**: findings, sources, citations, confidence, contradictions, and uncertainties are stored as structured data.
- **Live dashboard**: every meaningful state transition is emitted as a real event; the UI must never show fake progress.
- **Documents + web**: uploaded documents and web research are first-class research inputs.

## Verification states

Riven-Starlance keeps these states separate:

1. Credential available
2. Endpoint/configuration present
3. Source implemented
4. Test passed
5. Production deployed
6. Live request verified
7. Real output verified
8. Real business outcome verified

## Planned stack

- Dashboard: Next.js / React / TypeScript
- API: FastAPI / Python
- Realtime: Server-Sent Events initially, WebSocket-compatible event model
- Database: PostgreSQL
- Queue/state: Redis when needed; in-process development bus for local MVP
- Documents: Amazon S3
- AI: Amazon Bedrock first, provider-independent adapter layer
- Deployment: AWS

## Repository layout

```text
apps/
  api/          FastAPI backend
  dashboard/    Next.js live control center
packages/
  contracts/    shared event and API contracts
docs/           product and architecture documentation
infra/          AWS deployment definitions (later phase)
```

## Current phase

Phase 1 — Foundation:

- repository structure
- API health endpoint
- research run state model
- event stream contract
- orchestrator skeleton
- Bedrock provider interface
- live dashboard shell
- automated checks

See `docs/ARCHITECTURE.md` and `docs/STATUS.md` as implementation progresses.
