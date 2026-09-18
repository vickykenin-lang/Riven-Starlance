import asyncio
import json

from app.documents import DocumentStore
from app.events import EventBus
from app.models import AgentStatus, RunStatus
from app.orchestrator import ResearchOrchestrator
from app.providers.base import ModelProvider, ModelRequest, ModelResponse
from app.web_research import WebResearchAdapter, WebSource


class FakeProvider(ModelProvider):
    def __init__(self, with_gap: bool = False) -> None:
        self.requests: list[ModelRequest] = []
        self.with_gap = with_gap

    async def invoke(self, request: ModelRequest) -> ModelResponse:
        self.requests.append(request)
        await asyncio.sleep(0.01)
        if request.system_prompt.startswith("You are the lead research orchestrator"):
            text = "Final synthesis based on four specialist reports."
        else:
            has_follow_up = "Additional follow-up evidence" in request.user_prompt
            text = json.dumps(
                {
                    "summary": "Evidence-backed test summary",
                    "findings": [
                        {
                            "claim": "Test claim",
                            "evidence": "Test evidence",
                            "source_refs": [0],
                            "confidence": 0.9,
                        }
                    ],
                    "sources": [
                        {
                            "title": "Test source",
                            "url": "https://example.com/source",
                            "source_type": "primary",
                            "is_primary": True,
                        }
                    ],
                    "contradictions": [],
                    "uncertainties": [] if not self.with_gap or has_follow_up else ["Need an independent authority source"],
                }
            )
        return ModelResponse(text=text, provider="fake", model_id=request.model_id, input_tokens=10, output_tokens=20)


class FakeWebResearch(WebResearchAdapter):
    name = "fake-web"

    def __init__(self) -> None:
        self.queries: list[str] = []

    async def search(self, query: str, *, limit: int = 8) -> list[WebSource]:
        self.queries.append(query)
        suffix = len(self.queries)
        return [
            WebSource(
                title=f"Authority source {suffix}",
                url=f"https://authority.example/{suffix}",
                snippet="Authority approval is required before handover.",
                provider=self.name,
                is_primary=True,
            )
        ]


def test_parallel_execution_and_main_synthesis():
    async def scenario():
        bus = EventBus()
        orchestrator = ResearchOrchestrator(bus)
        run = await orchestrator.create_run("Assess a test research question")
        provider = FakeProvider()
        providers = {task.agent_id: provider for task in run.tasks}
        models = {task.agent_id: f"model-{index}" for index, task in enumerate(run.tasks, start=1)}

        completed = await orchestrator.execute_run(
            run.id,
            providers=providers,
            model_ids=models,
            main_provider=provider,
            main_model_id="main-model",
        )

        assert completed.status == RunStatus.COMPLETED
        assert completed.final_answer == "Final synthesis based on four specialist reports."
        assert all(task.status == AgentStatus.SUBMITTED for task in completed.tasks)
        assert all(task.result is not None for task in completed.tasks)
        history = bus.history(completed.id)
        event_types = [event.type.value for event in history]
        assert event_types.count("agent.started") == 4
        assert event_types.count("agent.completed") == 4
        assert "review.started" in event_types
        assert "run.completed" in event_types

    asyncio.run(scenario())


def test_uploaded_document_context_is_bound_to_agent_prompts(tmp_path):
    async def scenario():
        store = DocumentStore(tmp_path)
        store.add(
            "commissioning.txt",
            "text/plain",
            b"Fire safety commissioning is pending and requires authority approval before handover.",
        )
        bus = EventBus()
        orchestrator = ResearchOrchestrator(bus, document_store=store)
        run = await orchestrator.create_run("Assess fire safety commissioning risk")
        provider = FakeProvider()
        providers = {task.agent_id: provider for task in run.tasks}
        models = {task.agent_id: "test-model" for task in run.tasks}

        await orchestrator.execute_run(run.id, providers=providers, model_ids=models)

        agent_requests = [request for request in provider.requests if not request.system_prompt.startswith("You are the lead research orchestrator")]
        assert len(agent_requests) == 4
        assert any("Evidence candidates" in request.user_prompt for request in agent_requests)
        assert any("commissioning.txt" in request.user_prompt for request in agent_requests)
        assert any("authority approval" in request.user_prompt for request in agent_requests)
        assert all(any(source.origin == "document" for source in task.evidence_sources) for task in run.tasks)

    asyncio.run(scenario())


def test_web_sources_are_bound_and_follow_up_loop_runs():
    async def scenario():
        bus = EventBus()
        web = FakeWebResearch()
        orchestrator = ResearchOrchestrator(bus, web_research=web)
        run = await orchestrator.create_run("Assess authority approval requirements")
        provider = FakeProvider(with_gap=True)
        providers = {task.agent_id: provider for task in run.tasks}
        models = {task.agent_id: "test-model" for task in run.tasks}

        completed = await orchestrator.execute_run(run.id, providers=providers, model_ids=models)

        assert all(task.status == AgentStatus.SUBMITTED for task in completed.tasks)
        assert all(any(source.origin == "web" for source in task.evidence_sources) for task in completed.tasks)
        assert any("authority.example" in request.user_prompt for request in provider.requests)
        event_types = [event.type.value for event in bus.history(run.id)]
        assert event_types.count("source.found") >= 4
        assert event_types.count("follow_up.requested") == 4
        assert len(web.queries) >= 8

    asyncio.run(scenario())
