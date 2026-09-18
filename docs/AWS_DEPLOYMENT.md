# AWS Deployment — Initial Lean Architecture

## Status

This document defines the initial deployment target. It does **not** claim production deployment or live Bedrock verification.

Current target region: `ap-south-1` (Mumbai).

## Initial deployment topology

Riven-Starlance will initially use a single AWS compute host to minimize cost and operational complexity during MVP validation.

```text
Internet
  |
  v
Nginx gateway :80
  |-------------------|
  v                   v
Next.js :3000      FastAPI :8000
                      |
                      v
                Amazon Bedrock
```

The gateway keeps the browser and API on the same origin and proxies `/api/*` requests, including Server-Sent Events, to FastAPI.

## Containers

- `apps/api/Dockerfile` — FastAPI backend
- `apps/dashboard/Dockerfile` — Next.js dashboard
- `infra/docker-compose.prod.yml` — production MVP stack
- `infra/nginx.conf` — same-origin gateway and SSE proxy settings

## AWS identity model

Do not store AWS access keys in repository files or production environment files.

The preferred production configuration is an EC2 instance role with the minimum required Bedrock runtime permissions. `infra/iam-bedrock-policy.json` is the initial runtime policy template and must be tightened to verified model resources where AWS supports it and once the final model mapping is known.

## Bedrock model configuration

Five model slots are configured independently:

- `RIVEN_MODEL_MAIN`
- `RIVEN_MODEL_RESEARCHER_1`
- `RIVEN_MODEL_RESEARCHER_2`
- `RIVEN_MODEL_RESEARCHER_3`
- `RIVEN_MODEL_RESEARCHER_4`

Default region:

- `RIVEN_AWS_REGION=ap-south-1`

Do not fill model IDs based on assumption. Each target model must be live-invocation verified before it is marked operational.

## Deployment procedure after AWS account verification is complete

1. Launch a small Linux EC2 instance in Mumbai.
2. Attach an IAM role containing the required Bedrock runtime permission.
3. Allow inbound HTTP port 80 only for initial testing; add HTTPS before production exposure.
4. Install Git, Docker Engine, and Docker Compose.
5. Clone `vickykenin-lang/Riven-Starlance`.
6. Copy `infra/.env.example` to `infra/.env`.
7. Populate only verified Bedrock model IDs.
8. Run:

   ```bash
   docker compose -f infra/docker-compose.prod.yml up -d --build
   ```

9. Verify `/health` through the public endpoint.
10. Run one Bedrock smoke test through the application.
11. Run one complete research task and confirm four parallel agent event streams plus main-agent synthesis.

## Verification gates

Keep these states separate:

| Gate | Requirement |
|---|---|
| Credential available | EC2 role/session exists |
| Endpoint/configuration present | region and model IDs configured |
| Source implemented | deployment source committed |
| Test passed | CI / container checks pass |
| Production deployed | stack is actually running on AWS |
| Live request verified | Bedrock invocation succeeds |
| Real output verified | actual model response is captured |
| Real business outcome verified | only applicable after product use |

## Current blocker

AWS CloudShell environment creation is currently blocked by AWS account verification. Repository-side deployment preparation can continue independently. No AWS deployment is considered complete until the actual account permits resource creation and runtime validation.

## Later hardening

After MVP validation:

- HTTPS/TLS and domain
- persistent database/event store
- durable queue/state layer
- private networking as appropriate
- S3 document storage
- structured secrets/config management
- CloudWatch metrics/logging/alarms
- backup and restore procedures
- deployment automation
- tighter IAM resource scoping
