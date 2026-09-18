from __future__ import annotations

import asyncio
import json
from uuid import UUID

from pydantic import ValidationError

from .documents import DocumentStore
from .events import EventBus
from .models import AgentEvent, AgentResult, AgentStatus, EventType, ResearchRun, ResearchTask, RunStatus
from .providers.base import ModelProvider, ModelRequest


DEFAULT_WORKSTREAMS = (
    ("researcher-1", "Primary evidence", "Find authoritative primary sources and extract directly relevant evidence."),
    ("researcher-2", "Independent research", "Investigate the question independently using complementary sources and methods."),
    ("researcher-3", "Risk and contradiction review", "Look for conflicting evidence, risks, caveats, and unsupported assumptions."),
    ("researcher-4", "Verification and synthesis support", "Verify material claims and identify evidence gaps before main-agent review."),
)

AGENT_SYSTEM_PROMPT = """You are a specialist research agent inside Riven-Starlance.
Return JSON only with this top-level shape:
{"summary":"string","findings":[{"claim":"string","evidence":"string","source_refs":[0],"confidence":0.0}],"sources":[{"title":"string","url":null,"source_type":"unknown","is_primary":false}],"contradictions":["string"],"uncertainties":["string"]}
Never invent sources. If document evidence is provided, treat each numbered excerpt as a source candidate and cite only evidence actually present. If evidence is unavailable, say so in uncertainties and keep findings conservative.
"""

MAIN_SYSTEM_PROMPT = """You are the lead research orchestrator for Riven-Starlance.
Assess all specialist reports, reconcile contradictions by evidence quality rather than majority vote, identify unresolved uncertainty, and produce a concise evidence-grounded final answer. Never invent citations or claims. Clearly distinguish established findings from uncertainty.
"""


class ResearchOrchestrator:
    def __init__(self, event_bus: EventBus, document_store: DocumentStore | None = None) -> None:
        self._event_bus = event_bus
        self._document_store = document_store
        self._runs: dict[UUID, ResearchRun] = {}

    async def create_run(self, query: str) -> ResearchRun:
        run = ResearchRun(query=query, status=RunStatus.PLANNING)
        self._runs[run.id] = run
        await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.RUN_CREATED, message="Research run created and planning started."))
        run.tasks = [ResearchTask(agent_id=a, title=t, objective=o, status=AgentStatus.ASSIGNED) for a, t, o in DEFAULT_WORKSTREAMS]
        run.status = RunStatus.RESEARCHING
        await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.PLAN_CREATED, message="Four parallel research workstreams assigned.", metadata={"task_count": 4}))
        for task in run.tasks:
            await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_ASSIGNED, message=f"Assigned: {task.title}", metadata={"task_id": str(task.id), "objective": task.objective}))
        return run

    async def execute_run(
        self,
        run_id: UUID,
        providers: dict[str, ModelProvider],
        model_ids: dict[str, str],
        main_provider: ModelProvider | None = None,
        main_model_id: str | None = None,
    ) -> ResearchRun:
        run = self._runs.get(run_id)
        if run is None:
            raise KeyError("Research run not found")
        if run.status not in {RunStatus.RESEARCHING, RunStatus.PLANNING}:
            raise ValueError(f"Run cannot execute from status {run.status}")

        await asyncio.gather(*(self._execute_task(run, task, providers.get(task.agent_id), model_ids.get(task.agent_id)) for task in run.tasks))
        successful = [task for task in run.tasks if task.status == AgentStatus.SUBMITTED]
        if not successful:
            run.status = RunStatus.FAILED
            await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.RUN_FAILED, message="All research agents failed."))
            return run

        run.status = RunStatus.REVIEWING
        await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.REVIEW_STARTED, message="Parallel research complete; main-agent review started.", metadata={"successful_agents": len(successful), "failed_agents": len(run.tasks) - len(successful)}))

        if main_provider is not None and main_model_id:
            await self._synthesize(run, successful, main_provider, main_model_id)
        return run

    def _document_context(self, run: ResearchRun, task: ResearchTask) -> str:
        if self._document_store is None:
            return ""
        contexts = self._document_store.retrieve(f"{run.query} {task.title} {task.objective}", limit=4)
        if not contexts:
            return ""
        blocks = []
        for index, context in enumerate(contexts, start=1):
            blocks.append(
                f"[{index}] Document: {context.filename}; chunk: {context.chunk_index}; score: {context.score}\n{context.text}"
            )
        return "\n\nDocument evidence available for this workstream:\n" + "\n\n".join(blocks)

    async def _execute_task(self, run: ResearchRun, task: ResearchTask, provider: ModelProvider | None, model_id: str | None) -> None:
        if provider is None or model_id is None:
            await self._fail_task(run, task, "Provider or model is not configured for this agent.")
            return
        task.status = AgentStatus.RESEARCHING
        await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_STARTED, message=f"{task.title} started.", metadata={"model_id": model_id}))
        try:
            document_context = self._document_context(run, task)
            response = await provider.invoke(ModelRequest(system_prompt=AGENT_SYSTEM_PROMPT, user_prompt=f"Research question: {run.query}\n\nWorkstream: {task.title}\nObjective: {task.objective}{document_context}", model_id=model_id))
            task.status = AgentStatus.VERIFYING
            await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_VERIFYING, message="Model response received; validating structured evidence."))
            parsed = AgentResult.model_validate(json.loads(response.text))
            parsed.provider = response.provider
            parsed.model_id = response.model_id
            parsed.input_tokens = response.input_tokens
            parsed.output_tokens = response.output_tokens
            task.result = parsed
            task.status = AgentStatus.SUBMITTED
            await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_COMPLETED, message=f"{task.title} submitted structured findings.", metadata={"findings": len(parsed.findings), "sources": len(parsed.sources), "contradictions": len(parsed.contradictions), "uncertainties": len(parsed.uncertainties)}))
        except (json.JSONDecodeError, ValidationError) as exc:
            await self._fail_task(run, task, f"Structured output invalid: {exc}")
        except Exception as exc:
            await self._fail_task(run, task, f"{type(exc).__name__}: {exc}")

    async def _synthesize(self, run: ResearchRun, tasks: list[ResearchTask], provider: ModelProvider, model_id: str) -> None:
        reports = [{"agent_id": t.agent_id, "title": t.title, "result": t.result.model_dump(mode="json") if t.result else None} for t in tasks]
        try:
            response = await provider.invoke(ModelRequest(system_prompt=MAIN_SYSTEM_PROMPT, user_prompt=f"Research question: {run.query}\n\nSpecialist reports:\n{json.dumps(reports, indent=2)}", model_id=model_id))
            run.final_answer = response.text.strip()
            run.status = RunStatus.COMPLETED
            await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.SYNTHESIS_COMPLETED, message="Main agent completed evidence assessment and synthesis.", metadata={"model_id": model_id}))
            await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.RUN_COMPLETED, message="Research run completed."))
        except Exception as exc:
            run.status = RunStatus.FAILED
            await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.RUN_FAILED, message="Main-agent synthesis failed.", metadata={"error": f"{type(exc).__name__}: {exc}"}))

    async def _fail_task(self, run: ResearchRun, task: ResearchTask, error: str) -> None:
        task.status = AgentStatus.FAILED
        task.error = error
        await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_FAILED, message="Agent execution failed.", metadata={"error": error}))

    def get_run(self, run_id: UUID) -> ResearchRun | None:
        return self._runs.get(run_id)
