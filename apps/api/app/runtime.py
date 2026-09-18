from __future__ import annotations

import os

from .providers.bedrock import BedrockProvider
from .providers.mantle import BedrockMantleProvider
from .web_research import load_web_research_adapter


RESEARCHER_IDS = ("researcher-1", "researcher-2", "researcher-3", "researcher-4")
MODEL_KEYS = {
    "main": "RIVEN_MODEL_MAIN",
    "researcher-1": "RIVEN_MODEL_RESEARCHER_1",
    "researcher-2": "RIVEN_MODEL_RESEARCHER_2",
    "researcher-3": "RIVEN_MODEL_RESEARCHER_3",
    "researcher-4": "RIVEN_MODEL_RESEARCHER_4",
}
DEFAULT_MANTLE_MODELS = {
    "main": "qwen.qwen3-coder-next",
    "researcher-1": "qwen.qwen3-coder-next",
    "researcher-2": "deepseek.v3.2",
    "researcher-3": "moonshotai.kimi-k2-thinking",
    "researcher-4": "openai.gpt-oss-120b",
}


def _model_provider_name() -> str:
    return os.getenv("RIVEN_MODEL_PROVIDER", "mantle").strip().lower() or "mantle"


def _configured_models(provider_name: str) -> dict[str, str | None]:
    models: dict[str, str | None] = {}
    for slot, key in MODEL_KEYS.items():
        explicit = (os.getenv(key) or "").strip()
        if explicit:
            models[slot] = explicit
        elif provider_name in {"mantle", "bedrock-mantle"}:
            models[slot] = DEFAULT_MANTLE_MODELS[slot]
        else:
            models[slot] = None
    return models


def runtime_status() -> dict[str, object]:
    region = os.getenv("RIVEN_AWS_REGION", "ap-south-1")
    provider_name = _model_provider_name()
    models = _configured_models(provider_name)
    configured_slots = sum(1 for value in models.values() if value)

    mantle_key_present = bool((os.getenv("RIVEN_MANTLE_API_KEY") or "").strip())
    mantle_base_url = os.getenv(
        "RIVEN_MANTLE_BASE_URL",
        "https://bedrock-mantle.ap-south-1.api.aws/v1",
    ).strip()

    if provider_name in {"mantle", "bedrock-mantle"}:
        provider_ready = mantle_key_present
        provider_display = "bedrock-mantle"
    elif provider_name in {"aws-bedrock", "bedrock", "native-bedrock"}:
        provider_ready = True
        provider_display = "aws-bedrock"
    else:
        provider_ready = False
        provider_display = provider_name

    web_adapter = load_web_research_adapter()
    return {
        "provider": provider_display,
        "region": region,
        "configured_slots": configured_slots,
        "required_slots": len(models),
        "models": models,
        "runtime_ready": provider_ready and configured_slots == len(models),
        "provider_credential_present": mantle_key_present if provider_display == "bedrock-mantle" else None,
        "mantle_base_url": mantle_base_url if provider_display == "bedrock-mantle" else None,
        "native_bedrock_status": "pending-authorization" if provider_display == "bedrock-mantle" else "selected",
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


def load_model_runtime():
    status = runtime_status()
    provider_name = str(status["provider"])
    region = str(status["region"])
    models = status["models"]

    if provider_name == "bedrock-mantle":
        api_key = (os.getenv("RIVEN_MANTLE_API_KEY") or "").strip()
        if not api_key:
            raise RuntimeError("Missing model configuration: RIVEN_MANTLE_API_KEY")
        provider = BedrockMantleProvider(
            api_key=api_key,
            base_url=(
                os.getenv("RIVEN_MANTLE_BASE_URL")
                or "https://bedrock-mantle.ap-south-1.api.aws/v1"
            ).strip(),
        )
    elif provider_name == "aws-bedrock":
        provider = BedrockProvider(region_name=region)
    else:
        raise RuntimeError(f"Unsupported model provider: {provider_name}")

    missing = [MODEL_KEYS[slot] for slot, value in models.items() if not value]
    if missing:
        raise RuntimeError("Missing model configuration: " + ", ".join(missing))

    model_ids = {agent_id: str(models[agent_id]) for agent_id in RESEARCHER_IDS}
    main_model_id = str(models["main"])
    providers = {agent_id: provider for agent_id in RESEARCHER_IDS}
    return providers, model_ids, provider, main_model_id


# Backward-compatible name used by the v0.6 API route.
def load_bedrock_runtime():
    return load_model_runtime()
