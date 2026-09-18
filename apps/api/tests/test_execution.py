import asyncio
import json

from app.events import EventBus
from app.models import AgentStatus, RunStatus
from app.orchestrator import ResearchOrchestrator
from app.providers.base import ModelProvider, ModelRequest, ModelResponse


class FakeProvider(ModelProvider):
    async def invoke(self, request: ModelRequest) -> ModelResponse:
        await asyncio.sleep(0.01)
        if request.system_prompt.startswith("You are the lead research orchestrator"):
            text = "Final synthesis based on four specialist reports."
        else:
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
                    "uncertainties": [],
                }
            )
        return ModelResponse(text=text, provider="fake", model_id=request.model_id, input_tokens=10, output_tokens=20)


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
