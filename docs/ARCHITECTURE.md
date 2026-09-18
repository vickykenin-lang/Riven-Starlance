# Architecture

## Objective

Riven-Starlance is a provider-independent, event-driven multi-agent research system. The default execution topology is one main orchestrator plus four parallel specialist research agents.

## Core flow

```text
User task / document
        |
        v
Main Orchestrator
  - understand objective
  - create research plan
  - assign four workstreams
        |
        +--> Researcher 1
        +--> Researcher 2
        +--> Researcher 3
        +--> Researcher 4
                |
                v
      Structured findings + evidence
                |
                v
Main assessment
  - compare claims
  - assess source quality
  - detect contradictions
  - identify evidence gaps
  - request targeted follow-up when required
                |
                v
Citation-backed final report
```

## Live dashboard contract

The dashboard is driven only by backend events. UI progress must represent a real state transition or event emitted by the execution engine. Fake percentage animations are not permitted.

Initial transport: Server-Sent Events (SSE). The event schema is transport-independent so WebSocket can be added later without changing domain events.

Core events include:

- `run.created`
- `plan.created`
- `agent.assigned`
- `agent.started`
- `source.found`
- `finding.created`
- `agent.completed`
- `review.started`
- `follow_up.requested`
- `run.completed`
- `run.failed`

## Provider model

AWS Bedrock is the default provider. Provider adapters implement one common interface so model/provider choice is isolated from orchestration logic.

Provider availability is verified at implementation time. These are separate evidence states:

1. credential available
2. endpoint/configuration present
3. source implemented
4. test passed
5. production deployed
6. live request verified
7. real output verified
8. real business outcome verified

A configured credential must never be treated as proof that a specific model or capability works.

## Storage plan

MVP starts with in-memory run/event storage for development only. Persistent production architecture will use PostgreSQL for runs/tasks/events/evidence and S3 for uploaded documents and generated report artifacts. Redis is introduced when durable distributed queues or horizontal workers are required.

## Security baseline

- no credentials committed to source
- AWS authentication through environment/IAM roles
- provider adapters receive configuration, not hard-coded secrets
- audit events retained with run and agent identity
- document access scoped per research run/user when authentication is introduced
