from __future__ import annotations

import os

from .providers.bedrock import BedrockProvider
from .web_research import load_web_research_adapter


RESEARCHER_IDS = ("researcher-1", "researcher-2", "researcher-3", "researcher-4")


def runtime_status() -> dict[str, object]:
    region = os.getenv("RIVEN_AWS_REGION", "ap-south-1")
    model_keys = {
        "main": "RIVEN_MODEL_MAIN",
        "researcher-1": "RIVEN_MODEL_RESEARCHER_1",
        "researcher-2": "RIVEN_MODEL_RESEARCHER_2",
        "researcher-3": "RIVEN_MODEL_RESEARCHER_3",
        "researcher-4": "RIVEN_MODEL_RESEARCHER_4",
    }
    models = {slot: os.getenv(key) or None for slot, key in model_keys.items()}
    configured_slots = sum(1 for value in models.values() if value)
    web_adapter = load_web_research_adapter()
    return {
        "provider": "aws-bedrock",
        "region": region,
        "configured_slots": configured_slots,
        "required_slots": len(models),
        "models": models,
        "runtime_ready": configured_slots == len(models),
        "web_research_provider": web_adapter.name,
        "web_research_providers": web_adapter.providers,
        "web_research_ready": web_adapter.enabled,
        "web_agent_routing": {
            "researcher-1": "tavily-preferred",
            "researcher-2": "exa-preferred",
            "researcher-3": "tavily-preferred",
            "researcher-4": "exa-preferred",
        } if web_adapter.name == "multi-provider" else None,
    }


def load_bedrock_runtime():
    status = runtime_status()
    region = str(status["region"])
    provider = BedrockProvider(region_name=region)

    model_ids: dict[str, str] = {}
    missing: list[str] = []
    for index, agent_id in enumerate(RESEARCHER_IDS, start=1):
        key = f"RIVEN_MODEL_RESEARCHER_{index}"
        value = os.getenv(key)
        if value:
            model_ids[agent_id] = value
        else:
            missing.append(key)

    main_model_id = os.getenv("RIVEN_MODEL_MAIN")
    if not main_model_id:
        missing.append("RIVEN_MODEL_MAIN")

    if missing:
        raise RuntimeError("Missing model configuration: " + ", ".join(missing))

    providers = {agent_id: provider for agent_id in RESEARCHER_IDS}
    return providers, model_ids, provider, main_model_id
