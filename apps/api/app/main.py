from __future__ import annotations

import json
from uuid import UUID

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .events import event_bus
from .models import CreateResearchRunRequest
from .orchestrator import ResearchOrchestrator
from .runtime import load_bedrock_runtime, runtime_status


app = FastAPI(title="Riven-Starlance API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

orchestrator = ResearchOrchestrator(event_bus)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "riven-starlance-api", "version": "0.3.0"}


@app.get("/api/system/status")
async def system_status() -> dict[str, object]:
    return runtime_status()


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
