from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_create_run_assigns_four_agents() -> None:
    response = client.post("/api/runs", json={"query": "Assess this research question."})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "researching"
    assert len(body["tasks"]) == 4
    assert {task["agent_id"] for task in body["tasks"]} == {
        "researcher-1",
        "researcher-2",
        "researcher-3",
        "researcher-4",
    }
