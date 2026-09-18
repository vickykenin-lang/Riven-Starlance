from app.runtime import runtime_status


def test_runtime_status_reports_missing_model_slots(monkeypatch):
    monkeypatch.setenv("RIVEN_AWS_REGION", "ap-south-1")
    for key in (
        "RIVEN_MODEL_MAIN",
        "RIVEN_MODEL_RESEARCHER_1",
        "RIVEN_MODEL_RESEARCHER_2",
        "RIVEN_MODEL_RESEARCHER_3",
        "RIVEN_MODEL_RESEARCHER_4",
    ):
        monkeypatch.delenv(key, raising=False)

    status = runtime_status()

    assert status["provider"] == "aws-bedrock"
    assert status["region"] == "ap-south-1"
    assert status["configured_slots"] == 0
    assert status["required_slots"] == 5
    assert status["runtime_ready"] is False


def test_runtime_status_ready_when_all_five_slots_are_configured(monkeypatch):
    monkeypatch.setenv("RIVEN_MODEL_MAIN", "model-main")
    for index in range(1, 5):
        monkeypatch.setenv(f"RIVEN_MODEL_RESEARCHER_{index}", f"model-{index}")

    status = runtime_status()

    assert status["configured_slots"] == 5
    assert status["runtime_ready"] is True
    assert status["models"]["main"] == "model-main"
    assert status["models"]["researcher-4"] == "model-4"
