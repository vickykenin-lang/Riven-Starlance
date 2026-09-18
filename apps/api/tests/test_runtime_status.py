from app.runtime import runtime_status


def _clear_models(monkeypatch):
    for key in (
        "RIVEN_MODEL_MAIN",
        "RIVEN_MODEL_RESEARCHER_1",
        "RIVEN_MODEL_RESEARCHER_2",
        "RIVEN_MODEL_RESEARCHER_3",
        "RIVEN_MODEL_RESEARCHER_4",
    ):
        monkeypatch.delenv(key, raising=False)


def test_mantle_runtime_uses_verified_default_model_map(monkeypatch):
    monkeypatch.setenv("RIVEN_AWS_REGION", "ap-south-1")
    monkeypatch.setenv("RIVEN_MODEL_PROVIDER", "mantle")
    monkeypatch.delenv("RIVEN_MANTLE_API_KEY", raising=False)
    _clear_models(monkeypatch)

    status = runtime_status()

    assert status["provider"] == "bedrock-mantle"
    assert status["region"] == "ap-south-1"
    assert status["configured_slots"] == 5
    assert status["required_slots"] == 5
    assert status["runtime_ready"] is False
    assert status["provider_credential_present"] is False
    assert status["models"]["main"] == "qwen.qwen3-coder-next"
    assert status["models"]["researcher-2"] == "deepseek.v3.2"
    assert status["models"]["researcher-3"] == "moonshotai.kimi-k2-thinking"
    assert status["models"]["researcher-4"] == "openai.gpt-oss-120b"


def test_mantle_runtime_ready_when_key_is_present(monkeypatch):
    monkeypatch.setenv("RIVEN_MODEL_PROVIDER", "mantle")
    monkeypatch.setenv("RIVEN_MANTLE_API_KEY", "test-key")
    _clear_models(monkeypatch)

    status = runtime_status()

    assert status["configured_slots"] == 5
    assert status["runtime_ready"] is True
    assert status["provider_credential_present"] is True


def test_explicit_model_override_wins(monkeypatch):
    monkeypatch.setenv("RIVEN_MODEL_PROVIDER", "mantle")
    monkeypatch.setenv("RIVEN_MANTLE_API_KEY", "test-key")
    monkeypatch.setenv("RIVEN_MODEL_RESEARCHER_4", "custom-model")

    status = runtime_status()

    assert status["models"]["researcher-4"] == "custom-model"


def test_native_bedrock_still_supported(monkeypatch):
    monkeypatch.setenv("RIVEN_MODEL_PROVIDER", "aws-bedrock")
    for index in range(1, 5):
        monkeypatch.setenv(f"RIVEN_MODEL_RESEARCHER_{index}", f"model-{index}")
    monkeypatch.setenv("RIVEN_MODEL_MAIN", "model-main")

    status = runtime_status()

    assert status["provider"] == "aws-bedrock"
    assert status["configured_slots"] == 5
    assert status["runtime_ready"] is True
