import asyncio
import json

from app.documents import DocumentStore
from app.events import EventBus
from app.models import AgentStatus, RunStatus
from app.orchestrator import ResearchOrchestrator, _normalize_structured_json
from app.providers.base import ModelProvider, ModelRequest, ModelResponse
from app.web_research import WebResearchAdapter, WebSource


VALID_RESULT = {
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
    "uncertainties": [],
}


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
            payload = dict(VALID_RESULT)
            payload["uncertainties"] = [] if not self.with_gap or has_follow_up else ["Need an independent authority source"]
            text = json.dumps(payload)
        return ModelResponse(text=text, provider="fake", model_id=request.model_id, input_tokens=10, output_tokens=20)


class FlakyStructuredProvider(ModelProvider):
    def __init__(self, recover_on_retry: bool = True) -> None:
        self.requests: list[ModelRequest] = []
        self.recover_on_retry = recover_on_retry

    async def invoke(self, request: ModelRequest) -> ModelResponse:
        self.requests.append(request)
        is_repair = "Previous invalid response" in request.user_prompt
        if not is_repair or not self.recover_on_retry:
            text = '{"summary":"truncated"'
        else:
            text = json.dumps(VALID_RESULT)
        return ModelResponse(text=text, provider="fake", model_id=request.model_id, input_tokens=10, output_tokens=20)


class FakeWebResearch(WebResearchAdapter):
    name = "fake-web"

    def __init__(self) -> None:
        self.queries: list[tuple[str, str | None]] = []

    async def search(self, query: str, *, limit: int = 8, agent_id: str | None = None) -> list[WebSource]:
        self.queries.append((query, agent_id))
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
        agent_ids = {agent_id for _, agent_id in web.queries if agent_id}
        assert agent_ids == {"researcher-1", "researcher-2", "researcher-3", "researcher-4"}
        assert any("official documentation" in query for query, agent_id in web.queries if agent_id == "researcher-1")
        assert any("contradictions" in query for query, agent_id in web.queries if agent_id == "researcher-3")

    asyncio.run(scenario())


def test_invalid_structured_output_is_repaired_once():
    async def scenario():
        bus = EventBus()
        orchestrator = ResearchOrchestrator(bus)
        run = await orchestrator.create_run("Assess intermittent structured output")
        providers = {task.agent_id: FlakyStructuredProvider(recover_on_retry=True) for task in run.tasks}
        models = {task.agent_id: "test-model" for task in run.tasks}

        completed = await orchestrator.execute_run(run.id, providers=providers, model_ids=models)

        assert all(task.status == AgentStatus.SUBMITTED for task in completed.tasks)
        assert all(task.result is not None for task in completed.tasks)
        assert all(len(provider.requests) == 2 for provider in providers.values())
        history = bus.history(completed.id)
        repair_events = [event for event in history if event.message == "Structured output invalid; requesting one repair attempt."]
        assert len(repair_events) == 4
        assert all(event.metadata.get("stage") == "initial" for event in repair_events)

    asyncio.run(scenario())


def test_invalid_structured_output_fails_after_single_repair_attempt():
    async def scenario():
        bus = EventBus()
        orchestrator = ResearchOrchestrator(bus)
        run = await orchestrator.create_run("Assess persistent malformed output")
        providers = {task.agent_id: FlakyStructuredProvider(recover_on_retry=False) for task in run.tasks}
        models = {task.agent_id: "test-model" for task in run.tasks}

        completed = await orchestrator.execute_run(run.id, providers=providers, model_ids=models)

        assert completed.status == RunStatus.FAILED
        assert all(task.status == AgentStatus.FAILED for task in completed.tasks)
        assert all("after one repair attempt" in (task.error or "") for task in completed.tasks)
        assert all(len(provider.requests) == 2 for provider in providers.values())

    asyncio.run(scenario())


class FencedStructuredProvider(FakeProvider):
    async def invoke(self, request: ModelRequest) -> ModelResponse:
        response = await super().invoke(request)
        if request.system_prompt.startswith("You are the lead research orchestrator"):
            return response
        return ModelResponse(
            text="```json\n" + response.text + "\n```",
            provider=response.provider,
            model_id=response.model_id,
            input_tokens=response.input_tokens,
            output_tokens=response.output_tokens,
        )


def test_structured_json_normalization_accepts_plain_and_fenced_json():
    plain = json.dumps(VALID_RESULT)
    assert _normalize_structured_json(plain) == plain
    assert json.loads(_normalize_structured_json("```json\n" + plain + "\n```")) == VALID_RESULT
    assert json.loads(_normalize_structured_json("```\n" + plain + "\n```")) == VALID_RESULT


def test_fenced_initial_and_follow_up_specialist_responses_are_accepted():
    async def scenario():
        bus = EventBus()
        web = FakeWebResearch()
        orchestrator = ResearchOrchestrator(bus, web_research=web)
        run = await orchestrator.create_run("Assess fenced structured output")
        provider = FencedStructuredProvider(with_gap=True)
        providers = {task.agent_id: provider for task in run.tasks}
        models = {task.agent_id: "test-model" for task in run.tasks}

        completed = await orchestrator.execute_run(run.id, providers=providers, model_ids=models)

        assert all(task.status == AgentStatus.SUBMITTED for task in completed.tasks)
        specialist_requests = [request for request in provider.requests if not request.system_prompt.startswith("You are the lead research orchestrator")]
        assert sum("Additional follow-up evidence" in request.user_prompt for request in specialist_requests) == 4

    asyncio.run(scenario())


def test_malformed_fenced_json_still_uses_existing_single_repair_attempt():
    malformed = "```json\n{\"summary\":\n```"
    try:
        json.loads(_normalize_structured_json(malformed))
    except json.JSONDecodeError:
        pass
    else:
        raise AssertionError("Malformed fenced JSON must reach the existing repair path")