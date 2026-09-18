# Riven-Starlance

Riven-Starlance is a multi-agent research platform designed around one orchestrator agent and four parallel specialist research agents, with a live event-driven dashboard.

## Project status

Phase 1 foundation is implemented and the executable research pipeline is now under active development. Source implementation does not imply production deployment or live Bedrock verification.

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

- Dashboard: Next.js / React / TypeScript/JSX
- API: FastAPI / Python
- Realtime: Server-Sent Events initially, WebSocket-compatible event model
- Database: PostgreSQL
- Queue/state: Redis when needed; in-process development bus for local MVP
- Documents: Amazon S3
- AI: Amazon Bedrock first, provider-independent adapter layer
- Deployment: AWS

## Current execution flow

```text
User task
  -> Main orchestrator creates four workstreams
  -> 4 research agents execute in parallel
  -> each returns structured evidence/findings/sources
  -> main agent assesses specialist reports
  -> final synthesis
  -> every state transition is streamed to the dashboard
```

## Required Bedrock runtime configuration

Before live execution, set:

- `RIVEN_AWS_REGION` (defaults to `ap-south-1`)
- `RIVEN_MODEL_MAIN`
- `RIVEN_MODEL_RESEARCHER_1`
- `RIVEN_MODEL_RESEARCHER_2`
- `RIVEN_MODEL_RESEARCHER_3`
- `RIVEN_MODEL_RESEARCHER_4`

Model access and live inference must be verified separately in the target AWS account.
