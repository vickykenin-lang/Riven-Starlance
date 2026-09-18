from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RunStatus(StrEnum):
    CREATED = "created"
    PLANNING = "planning"
    RESEARCHING = "researching"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    FAILED = "failed"


class AgentStatus(StrEnum):
    QUEUED = "queued"
    ASSIGNED = "assigned"
    RESEARCHING = "researching"
    VERIFYING = "verifying"
    SUBMITTED = "submitted"
    FAILED = "failed"


class EventType(StrEnum):
    RUN_CREATED = "run.created"
    PLAN_CREATED = "plan.created"
    AGENT_ASSIGNED = "agent.assigned"
    AGENT_STARTED = "agent.started"
    SOURCE_FOUND = "source.found"
    FINDING_CREATED = "finding.created"
    AGENT_VERIFYING = "agent.verifying"
    AGENT_COMPLETED = "agent.completed"
    REVIEW_STARTED = "review.started"
    FOLLOW_UP_REQUESTED = "follow_up.requested"
    SYNTHESIS_COMPLETED = "synthesis.completed"
    RUN_COMPLETED = "run.completed"
    AGENT_FAILED = "agent.failed"
    RUN_FAILED = "run.failed"


class EvidenceSource(BaseModel):
    title: str
    url: str | None = None
    source_type: str = "unknown"
    is_primary: bool = False


class ResearchFinding(BaseModel):
    claim: str
    evidence: str
    source_refs: list[int] = Field(default_factory=list)
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


class AgentResult(BaseModel):
    summary: str
    findings: list[ResearchFinding] = Field(default_factory=list)
    sources: list[EvidenceSource] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    provider: str | None = None
    model_id: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None


class ResearchTask(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    agent_id: str
    title: str
    objective: str
    status: AgentStatus = AgentStatus.QUEUED
    result: AgentResult | None = None
    error: str | None = None


class ResearchRun(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    query: str
    status: RunStatus = RunStatus.CREATED
    created_at: datetime = Field(default_factory=utc_now)
    tasks: list[ResearchTask] = Field(default_factory=list)
    final_answer: str | None = None


class AgentEvent(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    run_id: UUID
    agent_id: str | None = None
    type: EventType
    message: str
    timestamp: datetime = Field(default_factory=utc_now)
    metadata: dict[str, object] = Field(default_factory=dict)


class CreateResearchRunRequest(BaseModel):
    query: str = Field(min_length=3, max_length=20_000)
