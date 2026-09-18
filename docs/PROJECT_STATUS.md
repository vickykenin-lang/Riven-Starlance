# Riven-Starlance — Project Status Record

**Snapshot timestamp:** 2026-09-18 20:33 IST (Asia/Kolkata)  
**Repository:** `vickykenin-lang/Riven-Starlance`  
**Current production release:** v0.4.0  
**Current development branch:** `phase-6-web-research-evidence`  
**Current open PR:** #6 — Phase 6: Web research and unified evidence  
**Evidence rule:** This document separates implemented source, test/CI evidence, deployment evidence, live verification, and real model/business outcomes. No capability is treated as verified merely because configuration or credentials exist.

---

## 1. Product objective

Riven-Starlance is a multi-agent research platform with:

- 1 Main Agent / research orchestrator.
- 4 parallel research agents.
- Dynamic research workstreams assigned per run.
- Document research from PDF, DOCX and TXT.
- Web research through a provider-independent adapter layer.
- Evidence/source tracking and citations-ready metadata.
- Live execution dashboard with event streaming.
- Main-agent review of findings, contradictions, uncertainties and evidence quality.
- Follow-up research loops when evidence is incomplete or contradictory.
- AWS-first deployment and Amazon Bedrock as the default model provider, while keeping provider abstraction available for future alternatives.

The system is designed so that the live dashboard reflects real emitted events rather than fake progress states.

---

## 2. Core architecture

### Frontend

- Next.js / React dashboard.
- Research task entry.
- Main Agent + 4 Researcher cards.
- Live event timeline.
- System/runtime readiness display.
- Document upload and registry view.
- Evidence/source preview.
- Phase 6 development adds web-research readiness, web-source activity and follow-up counters.

### Backend

- Python + FastAPI.
- Event-driven orchestration.
- SSE used for live dashboard event streaming.
- Structured research task and agent result models.
- Provider abstraction for model runtime.
- Persistent local-volume document storage for current single-EC2 deployment.

### Deployment

Current lean MVP deployment is intentionally single-host:

- AWS EC2.
- Docker Compose.
- Nginx gateway.
- FastAPI API container.
- Next.js dashboard container.
- Persistent Docker volume for uploaded documents.

Managed services such as RDS/ECS/ElastiCache are intentionally deferred for the MVP to conserve AWS credits and reduce operational complexity.

---

## 3. AWS production host

**Region:** `ap-south-1` (Mumbai)  
**EC2 instance:** `i-0ff774ed38ce450a0`  
**Instance name:** RivenStarlance  
**Instance type:** `t3.micro`  
**OS:** Ubuntu 26.04 LTS  
**Private IP:** `172.31.9.255`  
**Current public IPv4:** `15.206.127.64`  
**Current dashboard:** `http://15.206.127.64/`

### Storage / memory actions already completed

- Initial 8 GiB root storage caused Docker build failures with `no space left on device`.
- EBS volume was expanded to 20 GiB.
- 2 GiB swap file was created and persisted in `/etc/fstab` because the t3.micro host has limited RAM.
- Docker and Docker Compose are installed and production containers are running.

### Current container stack

- `infra-api-1`
- `infra-dashboard-1`
- `infra-gateway-1`

A known operational detail is that after API/dashboard container recreation, Nginx may retain stale upstream resolution. Restarting the gateway has restored normal routing in observed deployments.

---

## 4. IAM and Amazon Bedrock status

### IAM

EC2 role created and attached:

- `RivenStarlanceEC2Role`

Policies observed/attached:

- `AmazonSSMManagedInstanceCore`
- `CloudWatchAgentServerPolicy`
- custom `RivenStarlanceBedrockRuntime`

EC2 role attachment was live verified using STS assumed-role identity.

### Bedrock control-plane status

Verified:

- AWS credential/role availability: YES.
- Bedrock endpoint/control-plane access: YES.
- Foundation model catalog discovery: YES.
- Multiple providers/models visible in catalog.
- `GetFoundationModelAvailability` permission added after initial AccessDenied.

### Bedrock runtime authorization status

Tested model availability showed:

- agreement availability: `AVAILABLE`
- entitlement availability: `AVAILABLE`
- region availability: `AVAILABLE`
- authorization status: `NOT_AUTHORIZED`

Runtime calls to tested models returned `ValidationException: Operation not allowed`.

Therefore, as of this snapshot:

- Bedrock catalog access: VERIFIED.
- Bedrock model runtime authorization: NOT VERIFIED / BLOCKED.
- Real Bedrock model request: NOT VERIFIED.
- Real model output: NOT VERIFIED.

### Current model slot configuration

Five required slots exist:

- Main Agent
- Researcher 1
- Researcher 2
- Researcher 3
- Researcher 4

Current production configuration remains intentionally blank until runtime model access is actually authorized.

Current system status observed on v0.4 production:

```json
{
  "provider": "aws-bedrock",
  "region": "ap-south-1",
  "configured_slots": 0,
  "required_slots": 5,
  "models": {
    "main": null,
    "researcher-1": null,
    "researcher-2": null,
    "researcher-3": null,
    "researcher-4": null
  },
  "runtime_ready": false,
  "documents": 0,
  "document_layer_ready": true,
  "document_persistence": "local-volume"
}
```

Note: `runtime_ready` currently reflects model-slot configuration only. It does not independently prove live AWS Bedrock authorization.

---

## 5. Phase history and completion status

### Phase 1 — Foundation

Implemented and merged.

Core foundation included:

- FastAPI backend.
- Next.js dashboard foundation.
- core research/run/agent data models.
- event bus.
- provider abstraction.
- initial orchestrator.
- tests and CI baseline.

### Phase 2 — AWS deployment foundation

Implemented and merged.

Included:

- Docker production configuration.
- Nginx gateway.
- EC2-oriented deployment structure.
- Bedrock IAM policy foundation.
- AWS environment configuration structure.

### Phase 3 — AWS bootstrap / verification

Implemented, CI passed and merged.

Included AWS bootstrap/verification support and Bedrock control-plane checks.

### Phase 4 — Live research control-center dashboard

Implemented, CI passed and merged.

PR #4 merge commit recorded previously:

- `2adeada50684d65dfd3d3dd7465fb67a672071dc`

Delivered:

- live control-center dashboard.
- Main Agent + 4 Researcher views.
- SSE live event flow.
- runtime/model-slot status.
- research run creation and execution path.
- execution/error visibility.
- production v0.3 deployment and public dashboard verification.

### Phase 5 — Document and source layer

Implemented, CI passed, merged and deployed.

PR #5 was successfully merged.  
Merge commit:

- `ac2dc2ac4d34edf62ac29ac785a2eda6fae60d09`

Production release after deployment:

- `v0.4.0`

Delivered:

- PDF upload support.
- DOCX upload support.
- TXT upload support.
- 15 MB upload limit.
- file-type validation.
- document registry.
- parsing status.
- PDF/DOCX/TXT text extraction.
- overlapping text chunking.
- persistent local-volume document registry.
- original uploaded file persistence.
- restart-safe document reload.
- lexical relevant-chunk retrieval.
- `/api/documents` endpoints.
- `/api/sources/search` endpoint.
- automatic relevant document-context injection into research-agent prompts.
- dashboard document upload panel.
- dashboard evidence/source preview panel.
- document-layer readiness in `/api/system/status`.
- automated tests for upload/search, persistence and agent-context binding.

### Phase 5 live production evidence

Production health verified:

```json
{"status":"ok","service":"riven-starlance-api","version":"0.4.0"}
```

A real test document was uploaded on the EC2 production deployment:

- filename: `riven-test.txt`
- document id: `e0e9213b-135c-4b66-bd84-a5d7df6ae4e0`
- content type: `text/plain`
- size: 167 bytes
- parse status: `parsed`
- chunk count: 1
- stored path: `/data/files/e0e9213b-135c-4b66-bd84-a5d7df6ae4e0.txt`

Source retrieval was live verified with query:

`fire safety approval`

Returned evidence included:

- `Key risk: Fire safety approval is pending.`
- `Procurement dependency: gypsum board delivery is critical.`
- retrieval score: `1.0`

The same document remained available after API restart, verifying restart persistence on the production host.

Therefore Phase 5 live evidence includes:

- document upload: VERIFIED.
- TXT parsing: VERIFIED.
- document registry: VERIFIED.
- persistent storage path: VERIFIED.
- restart persistence: VERIFIED.
- source retrieval: VERIFIED.
- document-to-agent context binding: SOURCE IMPLEMENTED + CI TEST VERIFIED.
- real Bedrock-backed document analysis: NOT VERIFIED because Bedrock authorization remains blocked.

### Phase 6 — Web research and unified evidence

Development branch:

- `phase-6-web-research-evidence`

PR:

- #6 — `Phase 6: Web research and unified evidence`

Current Phase 6 branch head at time of this snapshot:

- `9eeadbf1e4edb9fc7b37635c42d9413cae7fcf22`

GitHub Actions CI:

- workflow: `ci`
- run number: `25`
- run id: `35359909044`
- status: COMPLETED
- conclusion: SUCCESS

Phase 6 source currently implements:

- provider-independent web research contract.
- real Brave Search adapter behind environment configuration.
- `RIVEN_WEB_SEARCH_PROVIDER` configuration.
- web-search API key/endpoint configuration.
- `/api/web/search` verification endpoint.
- unified evidence model for document/web/model origins.
- per-agent evidence candidate registry.
- `source.found` events for document and web evidence.
- automatic web evidence injection into researcher prompts.
- targeted follow-up web research when an agent reports uncertainty or contradiction.
- `follow_up.requested` events.
- main-agent synthesis receives specialist reports plus collected evidence metadata.
- dashboard v0.5 web-research readiness.
- dashboard web-source activity visibility.
- dashboard follow-up visibility.
- tests for document evidence binding, web evidence binding and follow-up logic.

Phase 6 is NOT yet production deployed at this timestamp.

No production web-search result is being faked. If provider credentials are absent, live web research remains disabled.

---

## 6. Current API / event model

Important run statuses:

- `created`
- `planning`
- `researching`
- `reviewing`
- `completed`
- `failed`

Important agent statuses:

- `queued`
- `assigned`
- `researching`
- `verifying`
- `submitted`
- `failed`

Important event types include:

- `run.created`
- `plan.created`
- `agent.assigned`
- `agent.started`
- `source.found`
- `finding.created`
- `agent.verifying`
- `agent.completed`
- `review.started`
- `follow_up.requested`
- `synthesis.completed`
- `run.completed`
- `agent.failed`
- `run.failed`

---

## 7. Research-agent behavior currently designed/implemented

Current orchestration design:

1. Main orchestrator creates a research run.
2. Four research workstreams are assigned.
3. Relevant local document chunks are retrieved per workstream.
4. Phase 6 adds web-search evidence per workstream when web provider is configured.
5. Evidence is injected into the research-agent prompt.
6. Research agents must return structured JSON findings/sources/contradictions/uncertainties.
7. Evidence/source events are emitted to the dashboard.
8. If uncertainty or contradiction is reported, Phase 6 can request targeted follow-up web research.
9. Successful specialist reports are sent to the Main Agent.
10. Main Agent is expected to reconcile conflicts by evidence quality rather than simple majority vote.

The source explicitly instructs agents not to invent sources and to remain conservative when evidence is unavailable.

---

## 8. Live dashboard state

Production dashboard currently corresponds to v0.4 and has been publicly verified previously at:

`http://15.206.127.64/`

v0.4 dashboard capabilities live on production include:

- provider/region display.
- model-slot count.
- runtime pending warning.
- document count.
- document upload.
- document list and parse status.
- evidence/source preview from uploaded documents.
- research-task form.
- Main Agent card.
- 4 Researcher cards.
- live SSE event timeline.

Phase 6 branch contains v0.5 dashboard changes for web-source and follow-up visibility, but they are not yet deployed to production at this snapshot.

---

## 9. Evidence matrix at snapshot time

| Capability | Source implemented | Tests / CI | Production deployed | Live request verified | Real output verified |
|---|---:|---:|---:|---:|---:|
| Core FastAPI/Next.js system | YES | YES | YES | YES | N/A |
| Live SSE dashboard | YES | YES | YES | YES | YES for platform events |
| 1 Main + 4 researcher orchestration | YES | YES | YES | run path available | real LLM run NO |
| Bedrock control-plane/catalog | YES/configured | N/A | YES | YES | catalog only |
| Bedrock model inference | YES adapter | tests use non-live/fake provider | YES adapter | NO | NO |
| Document upload | YES | YES | YES | YES | YES |
| TXT parsing | YES | YES | YES | YES | YES |
| PDF/DOCX parsing | YES | YES | YES | not separately live verified in production | no production sample yet |
| Persistent document storage | YES | YES | YES | YES | YES |
| Restart persistence | YES | YES | YES | YES | YES |
| Document source retrieval | YES | YES | YES | YES | YES |
| Document → agent context binding | YES | YES | YES | production real-LLM path blocked | CI evidence only |
| Brave web-search adapter | YES on Phase 6 branch | YES (CI #25) | NO | NO | NO |
| Unified web + document evidence | YES on Phase 6 branch | YES | NO | NO | NO |
| Follow-up web research loop | YES on Phase 6 branch | YES | NO | NO | NO |
| Real Main Agent synthesis | YES source path | fake-provider tests | runtime path deployed | NO Bedrock auth | NO |
| Real business research outcome | architecture only | N/A | N/A | NO | NO |

---

## 10. Current known limitations / blockers

1. **Amazon Bedrock authorization**
   - Tested model runtime authorization is still blocked with `NOT_AUTHORIZED` / `Operation not allowed`.
   - This is the main blocker for real 1+4 LLM execution.

2. **Five model slots are still blank**
   - Intentionally left blank until actual model runtime access is verified.

3. **Phase 6 is not deployed yet**
   - Source and CI are complete for the current slice, but production still runs v0.4.

4. **Live Brave Search is not verified yet**
   - Real provider credential has not yet been configured/verified in production.

5. **Current document retrieval is lexical**
   - Semantic/vector retrieval is not yet production implemented.

6. **Current document persistence is local-volume based**
   - Suitable for the current single-EC2 MVP, but not yet multi-node/cloud-object-storage architecture.

7. **HTTPS/domain/Elastic IP hardening is pending**
   - Current public endpoint uses HTTP on a dynamic public IPv4.

8. **SSM Session Manager remains unresolved**
   - EC2 Instance Connect is being used as the working administration path.

---

## 11. Immediate next planned steps

1. Merge PR #6 after final review (CI #25 is already successful at this snapshot).
2. Deploy v0.5 to EC2.
3. Restart gateway if Nginx retains stale upstream resolution after container recreation.
4. Verify `/health` and `/api/system/status` on v0.5.
5. Configure real web-search provider credential.
6. Verify a real `/api/web/search` request.
7. Verify web-source events on the live dashboard.
8. Verify targeted follow-up web research path.
9. Add source-quality scoring / primary-source prioritization.
10. Add citation-ready final report/export.
11. Continue Bedrock authorization resolution separately.
12. Once Bedrock authorization is available, configure all five model slots and run the first real 1+4 multi-agent research task end-to-end.

---

## 12. Evidence discipline going forward

Every future status update should continue to distinguish these states:

1. Credential available.
2. Endpoint/config present.
3. Source implemented.
4. Test passed.
5. Production deployed.
6. Live request verified.
7. Real output verified.
8. Real business outcome verified.

Fresh evidence should always override older assumptions or memory.

---

**End of snapshot — 2026-09-18 20:33 IST.**
