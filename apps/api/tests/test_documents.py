from pathlib import Path

from fastapi.testclient import TestClient

from app.documents import DocumentStore
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


def test_document_store_survives_reinitialization(tmp_path: Path) -> None:
    first = DocumentStore(tmp_path)
    document = first.add(
        "persistent.txt",
        "text/plain",
        b"Restart-safe evidence about concrete testing and commissioning.",
    )
    assert document.status == "parsed"
    assert document.stored_path is not None
    assert Path(document.stored_path).exists()

    second = DocumentStore(tmp_path)
    restored = second.get(document.id)
    assert restored is not None
    assert restored.filename == "persistent.txt"
    matches = second.retrieve("testing commissioning")
    assert matches
    assert matches[0].document_id == document.id


def test_system_status_exposes_document_layer() -> None:
    response = client.get("/api/system/status")
    assert response.status_code == 200
    body = response.json()
    assert body["document_layer_ready"] is True
    assert body["document_persistence"] == "local-volume"
    assert isinstance(body["documents"], int)
