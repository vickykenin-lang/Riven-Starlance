from __future__ import annotations

import json
from uuid import UUID

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .documents import document_store
from .events import event_bus
from .models import CreateResearchRunRequest
from .orchestrator import ResearchOrchestrator
from .runtime import load_bedrock_runtime, runtime_status
from .web_research import load_web_research_adapter


app = FastAPI(title="Riven-Starlance API", version="0.6.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

web_research = load_web_research_adapter()
orchestrator = ResearchOrchestrator(event_bus, document_store=document_store, web_research=web_research)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "riven-starlance-api", "version": "0.6.0"}


@app.get("/api/system/status")
async def system_status() -> dict[str, object]:
    status = runtime_status()
    status["documents"] = len(document_store.list())
    status["document_layer_ready"] = True
    status["document_persistence"] = "local-volume"
    return status


@app.get("/api/documents")
async def list_documents():
    return document_store.list()


@app.post("/api/documents")
async def upload_document(file: UploadFile = File(...)):
    payload = await file.read()
    try:
        return document_store.add(file.filename or "document", file.content_type, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/api/documents/{document_id}/chunks")
async def document_chunks(document_id: UUID):
    document = document_store.get(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document_store.chunks(document_id)


@app.get("/api/sources/search")
async def search_sources(q: str, limit: int = 8):
    if len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query is too short")
    return document_store.retrieve(q, limit=max(1, min(limit, 20)))


@app.get("/api/web/search")
async def search_web(q: str, limit: int = 8, agent_id: str | None = None):
    if len(q.strip()) < 2:
        raise HTTPException(status_code=400, detail="Search query is too short")
    if not web_research.enabled:
        raise HTTPException(status_code=503, detail="Web research provider is not configured")
    try:
        return await web_research.search(q, limit=max(1, min(limit, 20)), agent_id=agent_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Web research failed: {type(exc).__name__}: {exc}") from exc


@app.post("/api/runs")
async def create_run(payload: CreateResearchRunRequest):
    return await orchestrator.create_run(payload.query)


@app.post("/api/runs/{run_id}/execute")
async def execute_run(run_id: UUID):
    run = orchestrator.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Research run not found")
    try:
        providers, model_ids, main_provider, main_model_id = load_bedrock_runtime()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        return await orchestrator.execute_run(
            run_id,
            providers=providers,
            model_ids=model_ids,
            main_provider=main_provider,
            main_model_id=main_model_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/runs/{run_id}")
async def get_run(run_id: UUID):
    run = orchestrator.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Research run not found")
    return run


@app.get("/api/runs/{run_id}/events")
async def stream_events(run_id: UUID):
    run = orchestrator.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Research run not found")

    async def event_stream():
        for event in event_bus.history(run_id):
            yield f"data: {json.dumps(event.model_dump(mode='json'))}\n\n"
        async for event in event_bus.subscribe(run_id):
            yield f"data: {json.dumps(event.model_dump(mode='json'))}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
