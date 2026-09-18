"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function statusLabel(value) {
  return String(value || "idle").replaceAll("_", " ").replaceAll(".", " ");
}

function statusClass(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("fail") || v.includes("error")) return "status bad";
  if (v.includes("complete") || v.includes("submitted") || v.includes("parsed")) return "status good";
  if (v.includes("research") || v.includes("verify") || v.includes("review") || v.includes("plan")) return "status active";
  return "status idle";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [executing, setExecuting] = useState(false);
  const [system, setSystem] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sources, setSources] = useState([]);
  const sourceRef = useRef(null);

  async function refreshDocuments() {
    const response = await fetch(`${API_BASE}/api/documents`);
    if (response.ok) setDocuments(await response.json());
  }

  useEffect(() => {
    fetch(`${API_BASE}/api/system/status`)
      .then((response) => response.ok ? response.json() : null)
      .then(setSystem)
      .catch(() => setSystem(null));
    refreshDocuments().catch(() => {});
    return () => sourceRef.current?.close();
  }, []);

  const agentStates = useMemo(() => {
    const map = new Map();
    for (const task of run?.tasks || []) {
      map.set(task.agent_id, { ...task, latest: task.status || "assigned" });
    }
    for (const event of events) {
      if (event.agent_id && map.has(event.agent_id)) {
        map.set(event.agent_id, { ...map.get(event.agent_id), latest: event.type, message: event.message });
      }
    }
    return [...map.values()];
  }, [run, events]);

  const orchestratorState = useMemo(() => {
    const latest = [...events].reverse().find((event) => !event.agent_id);
    return latest?.type || run?.status || "ready";
  }, [events, run]);

  async function uploadDocument(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${API_BASE}/api/documents`, { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail || "Document upload failed.");
      await refreshDocuments();
    } catch (err) {
      setError(err.message || "Document upload failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function previewEvidence() {
    if (query.trim().length < 2) return;
    const response = await fetch(`${API_BASE}/api/sources/search?q=${encodeURIComponent(query)}&limit=6`);
    if (response.ok) setSources(await response.json());
  }

  async function startResearch(event) {
    event.preventDefault();
    setError("");
    setEvents([]);
    setExecuting(true);
    sourceRef.current?.close();

    try {
      await previewEvidence();
      const response = await fetch(`${API_BASE}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) throw new Error("Could not create research run.");

      const nextRun = await response.json();
      setRun(nextRun);

      const source = new EventSource(`${API_BASE}/api/runs/${nextRun.id}/events`);
      sourceRef.current = source;
      source.onmessage = (message) => setEvents((current) => [...current, JSON.parse(message.data)]);
      source.onerror = () => setError((current) => current || "Live event stream disconnected.");

      const executeResponse = await fetch(`${API_BASE}/api/runs/${nextRun.id}/execute`, { method: "POST" });
      if (!executeResponse.ok) {
        const payload = await executeResponse.json().catch(() => ({}));
        throw new Error(payload.detail || "Research execution could not start.");
      }
      setRun(await executeResponse.json());
    } catch (err) {
      setError(err.message || "Research execution failed.");
    } finally {
      setExecuting(false);
    }
  }

  const modelEntries = Object.entries(system?.models || {});

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">RIVEN-STARLANCE</p>
          <h1>Research Control Center</h1>
          <p>One orchestrator, four specialist research agents, documents, evidence and real event tracking.</p>
        </div>
        <span className="badge">Execution v0.4</span>
      </header>

      <section className="system-strip">
        <div><span>Provider</span><strong>{system?.provider || "AWS Bedrock"}</strong></div>
        <div><span>Region</span><strong>{system?.region || "ap-south-1"}</strong></div>
        <div><span>Model slots</span><strong>{system ? `${system.configured_slots}/${system.required_slots}` : "checking"}</strong></div>
        <div><span>Documents</span><strong>{documents.length}</strong></div>
        <div><span>Runtime</span><strong className={system?.runtime_ready ? "good-text" : "warn-text"}>{system?.runtime_ready ? "Configured" : "Pending model mapping"}</strong></div>
      </section>

      {!system?.runtime_ready && (
        <section className="notice">
          <strong>Bedrock runtime not ready yet.</strong>
          <span> Document ingestion and source retrieval are available, but all five model slots and AWS model authorization are required for a real multi-agent run.</span>
        </section>
      )}

      <section className="workspace-grid">
        <article className="panel">
          <div className="section-head"><div><p className="eyebrow">DOCUMENTS</p><h2>Research sources</h2></div><span>{documents.length} uploaded</span></div>
          <label className="upload-button">
            {uploading ? "Uploading…" : "Upload PDF / DOCX / TXT"}
            <input type="file" accept=".pdf,.docx,.txt" onChange={uploadDocument} disabled={uploading} hidden />
          </label>
          <div className="document-list">
            {documents.length === 0 ? <p>No documents uploaded yet.</p> : documents.map((doc) => (
              <div className="document-row" key={doc.id}>
                <div><strong>{doc.filename}</strong><span>{Math.ceil(doc.size_bytes / 1024)} KB · {doc.chunk_count} chunks</span></div>
                <span className={statusClass(doc.status)}>{statusLabel(doc.status)}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel evidence-panel">
          <div className="section-head"><div><p className="eyebrow">EVIDENCE</p><h2>Relevant source preview</h2></div><button type="button" className="secondary" onClick={previewEvidence}>Refresh evidence</button></div>
          {sources.length === 0 ? <p>Enter a research task and refresh evidence to preview matching document chunks.</p> : sources.map((source) => (
            <div className="source-row" key={source.chunk_id}>
              <div className="source-meta"><strong>{source.filename}</strong><span>Chunk {source.chunk_index + 1} · score {source.score}</span></div>
              <p>{source.text.slice(0, 280)}{source.text.length > 280 ? "…" : ""}</p>
            </div>
          ))}
        </article>
      </section>

      <section className="panel">
        <form onSubmit={startResearch}>
          <label htmlFor="query">Research task</label>
          <textarea id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a research question or document-analysis objective..." minLength={3} required />
          <div className="button-row"><button type="submit" disabled={executing}>{executing ? "Research running…" : "Start research run"}</button><button type="button" className="secondary" onClick={previewEvidence}>Preview evidence</button></div>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="control-grid">
        <article className="agent-card main-agent">
          <div className="card-head"><p className="eyebrow">MAIN AGENT</p><span className={statusClass(orchestratorState)}>{statusLabel(orchestratorState)}</span></div>
          <h2>Research Orchestrator</h2>
          <p>Plans the task, assigns four workstreams, reviews evidence, resolves conflicts and produces the final synthesis.</p>
          <div className="meta-line"><span>Model</span><strong>{system?.models?.main || "Pending"}</strong></div>
        </article>

        {modelEntries.filter(([slot]) => slot !== "main").map(([slot, model], index) => {
          const live = agentStates.find((agent) => agent.agent_id === slot);
          return (
            <article className="agent-card" key={slot}>
              <div className="card-head"><p className="eyebrow">RESEARCHER {index + 1}</p><span className={statusClass(live?.latest)}>{statusLabel(live?.latest || "ready")}</span></div>
              <h2>{live?.title || `Research Agent ${index + 1}`}</h2>
              <p>{live?.objective || "Dynamic research role assigned by the main orchestrator for each run."}</p>
              <div className="meta-line"><span>Model</span><strong>{live?.result?.model_id || model || "Pending"}</strong></div>
              {live?.message && <p className="live-message">{live.message}</p>}
              {live?.result && <p><strong>{live.result.findings.length}</strong> findings · <strong>{live.result.sources.length}</strong> sources</p>}
              {live?.error && <p className="error">{live.error}</p>}
            </article>
          );
        })}
      </section>

      {run && (
        <>
          <section className="summary panel">
            <div><span>Run</span><strong>{run.id}</strong></div><div><span>Status</span><strong>{run.status}</strong></div><div><span>Agents</span><strong>{run.tasks.length}</strong></div><div><span>Events</span><strong>{events.length}</strong></div>
          </section>
          {run.final_answer && <section className="panel final-panel"><p className="eyebrow">MAIN SYNTHESIS</p><h2>Final research answer</h2><p className="final-answer">{run.final_answer}</p></section>}
          <section className="panel timeline">
            <div className="section-head"><h2>Live event timeline</h2><span>{events.length} events</span></div>
            {events.length === 0 ? <p>Waiting for events…</p> : events.map((item) => <div className="event" key={item.id}><time>{new Date(item.timestamp).toLocaleTimeString()}</time><strong>{statusLabel(item.type)}</strong><span>{item.agent_id || "orchestrator"}</span><p>{item.message}</p></div>)}
          </section>
        </>
      )}
    </main>
  );
}
