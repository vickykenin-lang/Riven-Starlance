from __future__ import annotations

import asyncio
import json
from uuid import UUID

from pydantic import ValidationError

from .documents import DocumentStore
from .events import EventBus
from .models import AgentEvent, AgentResult, AgentStatus, EvidenceSource, EventType, ResearchRun, ResearchTask, RunStatus
from .providers.base import ModelProvider, ModelRequest, ModelResponse
from .web_research import DisabledWebResearchAdapter, WebResearchAdapter, WebSource


DEFAULT_WORKSTREAMS = (
    ("researcher-1", "Primary evidence", "Find authoritative primary sources and extract directly relevant evidence."),
    ("researcher-2", "Independent research", "Investigate the question independently using complementary sources and methods."),
    ("researcher-3", "Risk and contradiction review", "Look for conflicting evidence, risks, caveats, and unsupported assumptions."),
    ("researcher-4", "Verification and synthesis support", "Verify material claims and identify evidence gaps before main-agent review."),
)

SEARCH_STRATEGIES = {
    "researcher-1": "Prioritize official documentation, primary records, regulator or company sources, and first-party evidence.",
    "researcher-2": "Use independent secondary sources, expert analysis, industry publications, and alternative explanations.",
    "researcher-3": "Actively search for contradictions, criticism, failure cases, risks, disputes, and evidence that challenges the main claim.",
    "researcher-4": "Cross-check material claims across independent sources, verify dates and facts, and look for corroboration or missing evidence.",
}

AGENT_SYSTEM_PROMPT = """You are a specialist research agent inside Riven-Starlance.
Return JSON only with this top-level shape:
{"summary":"string","findings":[{"claim":"string","evidence":"string","source_refs":[0],"confidence":0.0}],"sources":[{"title":"string","url":null,"source_type":"unknown","is_primary":false}],"contradictions":["string"],"uncertainties":["string"]}
Never invent sources. Use only evidence candidates supplied in the prompt or explicitly state that evidence is unavailable. Prefer primary/authoritative sources when they are identifiable. Preserve uncertainty and contradictory evidence instead of forcing agreement.
"""

MAIN_SYSTEM_PROMPT = """You are the lead research orchestrator for Riven-Starlance.
Assess all specialist reports and their collected evidence sources. Reconcile contradictions by evidence quality rather than majority vote, identify unresolved uncertainty, and produce a concise evidence-grounded final answer. Never invent citations or claims. Clearly distinguish established findings from uncertainty. Consider source diversity and avoid treating repeated evidence from the same domain as independent corroboration.
"""


class StructuredOutputError(RuntimeError):
    pass


class ResearchOrchestrator:
    def __init__(
        self,
        event_bus: EventBus,
        document_store: DocumentStore | None = None,
        web_research: WebResearchAdapter | None = None,
    ) -> None:
        self._event_bus = event_bus
        self._document_store = document_store
        self._web_research = web_research or DisabledWebResearchAdapter()
        self._runs: dict[UUID, ResearchRun] = {}

    async def create_run(self, query: str) -> ResearchRun:
        run = ResearchRun(query=query, status=RunStatus.PLANNING)
        self._runs[run.id] = run
        await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.RUN_CREATED, message="Research run created and planning started."))
        run.tasks = [ResearchTask(agent_id=a, title=t, objective=o, status=AgentStatus.ASSIGNED) for a, t, o in DEFAULT_WORKSTREAMS]
        run.status = RunStatus.RESEARCHING
        await self._event_bus.publish(AgentEvent(run_id=run.id, type=EventType.PLAN_CREATED, message="Four parallel research workstreams assigned.", metadata={"task_count": 4}))
        for task in run.tasks:
            await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_ASSIGNED, message=f"Assigned: {task.title}", metadata={"task_id": str(task.id), "objective": task.objective, "search_strategy": SEARCH_STRATEGIES.get(task.agent_id, "")}))
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

    def _web_query(self, run: ResearchRun, task: ResearchTask, gap: str | None = None) -> str:
        strategy = SEARCH_STRATEGIES.get(task.agent_id, "Find relevant and reliable evidence.")
        parts = [run.query, task.title, task.objective, strategy]
        if gap:
            parts.extend(["Follow-up evidence gap:", gap, "Prefer sources not already used when possible."])
        return " ".join(part for part in parts if part)

    async def _collect_evidence(self, run: ResearchRun, task: ResearchTask) -> str:
        blocks: list[str] = []
        task.evidence_sources = []

        if self._document_store is not None:
            contexts = self._document_store.retrieve(f"{run.query} {task.title} {task.objective}", limit=4)
            for index, context in enumerate(contexts, start=1):
                source = EvidenceSource(
                    title=context.filename,
                    source_type="document",
                    origin="document",
                    snippet=context.text,
                    document_id=context.document_id,
                    chunk_id=context.chunk_id,
                    is_primary=True,
                )
                task.evidence_sources.append(source)
                blocks.append(f"[D{index}] Document: {context.filename}; chunk: {context.chunk_index}; score: {context.score}\n{context.text}")
                await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.SOURCE_FOUND, message=f"Document evidence found: {context.filename}", metadata={"origin": "document", "document_id": str(context.document_id), "chunk_id": str(context.chunk_id), "score": context.score}))

        if self._web_research.enabled:
            try:
                web_sources = await self._web_research.search(self._web_query(run, task), limit=5, agent_id=task.agent_id)
            except Exception as exc:
                web_sources = []
                await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.SOURCE_FOUND, message="Web research adapter returned an error; continuing with available evidence.", metadata={"origin": "web", "error": f"{type(exc).__name__}: {exc}"}))
            blocks.extend(await self._append_web_sources(run, task, web_sources, prefix="W"))

        if not blocks:
            return "\n\nEvidence candidates: none were retrieved. Do not invent sources."
        return "\n\nEvidence candidates (use only these unless explicitly noting a gap):\n\n" + "\n\n".join(blocks)

    async def _append_web_sources(self, run: ResearchRun, task: ResearchTask, web_sources: list[WebSource], *, prefix: str) -> list[str]:
        blocks: list[str] = []
        existing_urls = {source.url for source in task.evidence_sources if source.url}
        offset = sum(1 for source in task.evidence_sources if source.origin == "web")
        for source in web_sources:
            if source.url in existing_urls:
                continue
            evidence = EvidenceSource(
                title=source.title,
                url=source.url,
                source_type=source.source_type,
                origin="web",
                provider=source.provider,
                snippet=source.snippet,
                is_primary=source.is_primary,
                retrieved_at=source.retrieved_at,
            )
            task.evidence_sources.append(evidence)
            existing_urls.add(source.url)
            number = offset + len(blocks) + 1
            blocks.append(f"[{prefix}{number}] Web ({source.provider}): {source.title}\nURL: {source.url}\nSnippet: {source.snippet}")
            await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.SOURCE_FOUND, message=f"Web source found: {source.title}", metadata={"origin": "web", "provider": source.provider, "url": source.url, "domain": source.domain or ""}))
        return blocks

    async def _invoke_structured(
        self,
        run: ResearchRun,
        task: ResearchTask,
        provider: ModelProvider,
        model_id: str,
        user_prompt: str,
        *,
        stage: str,
    ) -> tuple[ModelResponse, AgentResult]:
        response = await provider.invoke(ModelRequest(system_prompt=AGENT_SYSTEM_PROMPT, user_prompt=user_prompt, model_id=model_id))
        try:
            return response, AgentResult.model_validate(json.loads(response.text))
        except (json.JSONDecodeError, ValidationError) as first_exc:
            await self._event_bus.publish(
                AgentEvent(
                    run_id=run.id,
                    agent_id=task.agent_id,
                    type=EventType.AGENT_VERIFYING,
                    message="Structured output invalid; requesting one repair attempt.",
                    metadata={
                        "stage": stage,
                        "first_error": f"{type(first_exc).__name__}: {first_exc}",
                        "response_length": len(response.text),
                    },
                )
            )

            repair_prompt = (
                f"{user_prompt}\n\n"
                "Your previous response was invalid JSON and could not be parsed. "
                "Repair it and return one complete JSON object only, matching the required schema exactly. "
                "Do not add markdown fences, commentary, prefixes, or suffixes.\n\n"
                "Previous invalid response:\n"
                f"{response.text}"
            )
            repaired = await provider.invoke(ModelRequest(system_prompt=AGENT_SYSTEM_PROMPT, user_prompt=repair_prompt, model_id=model_id))
            try:
                parsed = AgentResult.model_validate(json.loads(repaired.text))
            except (json.JSONDecodeError, ValidationError) as second_exc:
                raise StructuredOutputError(
                    "Structured output invalid after one repair attempt: "
                    f"first={type(first_exc).__name__}: {first_exc}; "
                    f"second={type(second_exc).__name__}: {second_exc}"
                ) from second_exc

            repaired.input_tokens = (response.input_tokens or 0) + (repaired.input_tokens or 0)
            repaired.output_tokens = (response.output_tokens or 0) + (repaired.output_tokens or 0)
            return repaired, parsed

    async def _execute_task(self, run: ResearchRun, task: ResearchTask, provider: ModelProvider | None, model_id: str | None) -> None:
        if provider is None or model_id is None:
            await self._fail_task(run, task, "Provider or model is not configured for this agent.")
            return
        task.status = AgentStatus.RESEARCHING
        await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_STARTED, message=f"{task.title} started.", metadata={"model_id": model_id}))
        try:
            evidence_context = await self._collect_evidence(run, task)
            strategy = SEARCH_STRATEGIES.get(task.agent_id, "")
            base_prompt = f"Research question: {run.query}\n\nWorkstream: {task.title}\nObjective: {task.objective}\nResearch strategy: {strategy}{evidence_context}"
            response, parsed = await self._invoke_structured(
                run,
                task,
                provider,
                model_id,
                base_prompt,
                stage="initial",
            )

            if self._web_research.enabled and (parsed.uncertainties or parsed.contradictions):
                gap = (parsed.uncertainties or parsed.contradictions)[0]
                await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.FOLLOW_UP_REQUESTED, message="Evidence gap detected; targeted follow-up research requested.", metadata={"gap": gap}))
                try:
                    follow_sources = await self._web_research.search(self._web_query(run, task, gap), limit=3, agent_id=task.agent_id)
                except Exception:
                    follow_sources = []
                follow_blocks = await self._append_web_sources(run, task, follow_sources, prefix="F")
                if follow_blocks:
                    follow_prompt = (
                        f"{base_prompt}\n\nInitial specialist report:\n{response.text}\n\n"
                        "Additional follow-up evidence:\n" + "\n\n".join(follow_blocks) +
                        "\n\nReturn a complete revised JSON report. Preserve unresolved uncertainty if the new evidence does not resolve it."
                    )
                    follow_response, parsed = await self._invoke_structured(
                        run,
                        task,
                        provider,
                        model_id,
                        follow_prompt,
                        stage="follow-up",
                    )
                    follow_response.input_tokens = (response.input_tokens or 0) + (follow_response.input_tokens or 0)
                    follow_response.output_tokens = (response.output_tokens or 0) + (follow_response.output_tokens or 0)
                    response = follow_response

            task.status = AgentStatus.VERIFYING
            await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_VERIFYING, message="Model response received; validating structured evidence."))
            parsed.provider = response.provider
            parsed.model_id = response.model_id
            parsed.input_tokens = response.input_tokens
            parsed.output_tokens = response.output_tokens
            task.result = parsed
            task.status = AgentStatus.SUBMITTED
            await self._event_bus.publish(AgentEvent(run_id=run.id, agent_id=task.agent_id, type=EventType.AGENT_COMPLETED, message=f"{task.title} submitted structured findings.", metadata={"findings": len(parsed.findings), "sources": len(parsed.sources), "evidence_candidates": len(task.evidence_sources), "contradictions": len(parsed.contradictions), "uncertainties": len(parsed.uncertainties)}))
        except StructuredOutputError as exc:
            await self._fail_task(run, task, str(exc))
        except Exception as exc:
            await self._fail_task(run, task, f"{type(exc).__name__}: {exc}")

    async def _synthesize(self, run: ResearchRun, tasks: list[ResearchTask], provider: ModelProvider, model_id: str) -> None:
        reports = [
            {
                "agent_id": task.agent_id,
                "title": task.title,
                "search_strategy": SEARCH_STRATEGIES.get(task.agent_id, ""),
                "evidence_sources": [source.model_dump(mode="json") for source in task.evidence_sources],
                "result": task.result.model_dump(mode="json") if task.result else None,
            }
            for task in tasks
        ]
        try:
            response = await provider.invoke(ModelRequest(system_prompt=MAIN_SYSTEM_PROMPT, user_prompt=f"Research question: {run.query}\n\nSpecialist reports and evidence:\n{json.dumps(reports, indent=2)}", model_id=model_id))
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
