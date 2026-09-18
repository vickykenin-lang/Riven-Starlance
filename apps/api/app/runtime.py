from __future__ import annotations

import os

from .providers.bedrock import BedrockProvider


RESEARCHER_IDS = ("researcher-1", "researcher-2", "researcher-3", "researcher-4")


def load_bedrock_runtime():
    region = os.getenv("RIVEN_AWS_REGION", "ap-south-1")
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
