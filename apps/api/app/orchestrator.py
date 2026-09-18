from __future__ import annotations

from uuid import UUID

from .events import EventBus
from .models import AgentEvent, AgentStatus, EventType, ResearchRun, ResearchTask, RunStatus


DEFAULT_WORKSTREAMS = (
    ("researcher-1", "Primary evidence", "Find authoritative primary sources and extract directly relevant evidence."),
    ("researcher-2", "Independent research", "Investigate the question independently using complementary sources and methods."),
    ("researcher-3", "Risk and contradiction review", "Look for conflicting evidence, risks, caveats, and unsupported assumptions."),
    ("researcher-4", "Verification and synthesis support", "Verify material claims and identify evidence gaps before main-agent review."),
)


class ResearchOrchestrator:
    def __init__(self, event_bus: EventBus) -> None:
        self._event_bus = event_bus
        self._runs: dict[UUID, ResearchRun] = {}

    async def create_run(self, query: str) -> ResearchRun:
        run = ResearchRun(query=query, status=RunStatus.PLANNING)
        self._runs[run.id] = run
        await self._event_bus.publish(
            AgentEvent(
                run_id=run.id,
                type=EventType.RUN_CREATED,
                message="Research run created and planning started.",
            )
        )

        run.tasks = [
            ResearchTask(agent_id=agent_id, title=title, objective=objective, status=AgentStatus.ASSIGNED)
            for agent_id, title, objective in DEFAULT_WORKSTREAMS
        ]
        run.status = RunStatus.RESEARCHING

        await self._event_bus.publish(
            AgentEvent(
                run_id=run.id,
                type=EventType.PLAN_CREATED,
                message="Four parallel research workstreams assigned.",
                metadata={"task_count": len(run.tasks)},
            )
        )
        for task in run.tasks:
            await self._event_bus.publish(
                AgentEvent(
                    run_id=run.id,
                    agent_id=task.agent_id,
                    type=EventType.AGENT_ASSIGNED,
                    message=f"Assigned: {task.title}",
                    metadata={"task_id": str(task.id), "objective": task.objective},
                )
            )
        return run

    def get_run(self, run_id: UUID) -> ResearchRun | None:
        return self._runs.get(run_id)
