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
    AGENT_COMPLETED = "agent.completed"
    REVIEW_STARTED = "review.started"
    FOLLOW_UP_REQUESTED = "follow_up.requested"
    RUN_COMPLETED = "run.completed"
    RUN_FAILED = "run.failed"


class ResearchTask(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    agent_id: str
    title: str
    objective: str
    status: AgentStatus = AgentStatus.QUEUED


class ResearchRun(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    query: str
    status: RunStatus = RunStatus.CREATED
    created_at: datetime = Field(default_factory=utc_now)
    tasks: list[ResearchTask] = Field(default_factory=list)


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
