from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_txt_upload_is_parsed_and_searchable() -> None:
    response = client.post(
        "/api/documents",
        files={"file": ("notes.txt", b"Alpha project risk register. Fire safety approval is pending.", "text/plain")},
    )
    assert response.status_code == 200
    document = response.json()
    assert document["status"] == "parsed"
    assert document["chunk_count"] >= 1

    listed = client.get("/api/documents")
    assert listed.status_code == 200
    assert any(item["id"] == document["id"] for item in listed.json())

    search = client.get("/api/sources/search", params={"q": "fire safety risk"})
    assert search.status_code == 200
    matches = search.json()
    assert matches
    assert matches[0]["filename"] == "notes.txt"
    assert "Fire safety" in matches[0]["text"]


def test_unsupported_upload_is_rejected() -> None:
    response = client.post(
        "/api/documents",
        files={"file": ("image.png", b"not-an-image", "image/png")},
    )
    assert response.status_code == 400
    assert "Unsupported document type" in response.json()["detail"]


def test_system_status_exposes_document_layer() -> None:
    response = client.get("/api/system/status")
    assert response.status_code == 200
    body = response.json()
    assert body["document_layer_ready"] is True
    assert isinstance(body["documents"], int)
