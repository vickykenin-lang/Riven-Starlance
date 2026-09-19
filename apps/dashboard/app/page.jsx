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
  if (v.includes("research") || v.includes("verify") || v.includes("review") || v.includes("plan") || v.includes("source")) return "status active";
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
    fetch(`${API_BASE}/api/system/status`).then((response) => response.ok ? response.json() : null).then(setSystem).catch(() => setSystem(null));
    refreshDocuments().catch(() => {});
    return () => sourceRef.current?.close();
  }, []);

  const agentStates = useMemo(() => {
    const map = new Map();
    for (const task of run?.tasks || []) map.set(task.agent_id, { ...task, latest: task.status || "assigned" });
    for (const event of events) {
      if (event.agent_id && map.has(event.agent_id)) map.set(event.agent_id, { ...map.get(event.agent_id), latest: event.type, message: event.message });
    }
    return [...map.values()];
  }, [run, events]);

  const orchestratorState = useMemo(() => {
    const latest = [...events].reverse().find((event) => !event.agent_id);
    return latest?.type || run?.status || "ready";
  }, [events, run]);

  const liveWebSources = useMemo(() => events.filter((event) => event.type === "source.found" && event.metadata?.origin === "web"), [events]);
  const followUps = useMemo(() => events.filter((event) => event.type === "follow_up.requested"), [events]);

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
      const response = await fetch(`${API_BASE}/api/runs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
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
  const webProviders = system?.web_research_providers?.join(" + ") || system?.web_research_provider || "Disabled";
  const ready = Boolean(system?.runtime_ready && system?.web_research_ready);

  return (
    <main>
      <header className="hero">
        <div>
          <div className="brand-row"><span className="brand-mark">RS</span><p className="eyebrow">RIVEN-STARLANCE</p></div>
          <h1>Research Control Center</h1>
          <p className="hero-copy">One orchestrator, four specialist agents, live evidence collection and auditable synthesis in a single command center.</p>
        </div>
        <div className="hero-status"><span className={`live-dot ${ready ? "online" : "pending"}`}></span><span>{ready ? "SYSTEM ONLINE" : "SYSTEM CHECK"}</span><span className="badge">Execution v0.7</span></div>
      </header>

      <section className="system-strip">
        <div><span>Provider</span><strong>{system?.provider || "checking"}</strong></div>
        <div><span>Region</span><strong>{system?.region || "ap-south-1"}</strong></div>
        <div><span>Model slots</span><strong>{system ? `${system.configured_slots}/${system.required_slots}` : "checking"}</strong></div>
        <div><span>Documents</span><strong>{documents.length}</strong></div>
        <div><span>Web research</span><strong className={system?.web_research_ready ? "good-text" : "warn-text"}>{system?.web_research_ready ? webProviders : "Disabled"}</strong></div>
        <div><span>Runtime</span><strong className={system?.runtime_ready ? "good-text" : "warn-text"}>{system?.runtime_ready ? "Ready" : "Pending"}</strong></div>
      </section>

      {!system?.runtime_ready && <section className="notice"><strong>Model runtime pending.</strong><span> Configure all model slots and provider credentials before starting a real multi-agent run.</span></section>}
      {system?.web_research_provider === "multi-provider" && <section className="notice success-notice"><strong>Diversified web research active.</strong><span> Researchers 1/3 prefer Tavily; Researchers 2/4 prefer Exa, with automatic provider fallback.</span></section>}

      <section className="workspace-grid">
        <article className="panel"><div className="section-head"><div><p className="eyebrow">DOCUMENTS</p><h2>Research sources</h2></div><span>{documents.length} uploaded</span></div><label className="upload-button">{uploading ? "Uploading…" : "Upload PDF / DOCX / TXT"}<input type="file" accept=".pdf,.docx,.txt" onChange={uploadDocument} disabled={uploading} hidden /></label><div className="document-list">{documents.length === 0 ? <p>No documents uploaded yet.</p> : documents.map((doc) => <div className="document-row" key={doc.id}><div><strong>{doc.filename}</strong><span>{Math.ceil(doc.size_bytes / 1024)} KB · {doc.chunk_count} chunks</span></div><span className={statusClass(doc.status)}>{statusLabel(doc.status)}</span></div>)}</div></article>
        <article className="panel evidence-panel"><div className="section-head"><div><p className="eyebrow">EVIDENCE</p><h2>Relevant document preview</h2></div><button type="button" className="secondary" onClick={previewEvidence}>Refresh evidence</button></div>{sources.length === 0 ? <p>Enter a research task and refresh evidence to preview matching document chunks.</p> : sources.map((source) => <div className="source-row" key={source.chunk_id}><div className="source-meta"><strong>{source.filename}</strong><span>Chunk {source.chunk_index + 1} · score {source.score}</span></div><p>{source.text.slice(0, 280)}{source.text.length > 280 ? "…" : ""}</p></div>)}</article>
      </section>

      <section className="panel command-panel"><form onSubmit={startResearch}><div className="section-head"><div><p className="eyebrow">NEW MISSION</p><h2>Launch a research run</h2></div><span className="command-hint">Live SSE telemetry enabled</span></div><label htmlFor="query">Research task</label><textarea id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ask a research question, compare evidence, or analyze uploaded documents..." minLength={3} required /><div className="button-row"><button type="submit" disabled={executing}>{executing ? "Research running…" : "Start research run"}</button><button type="button" className="secondary" onClick={previewEvidence}>Preview evidence</button></div></form>{error && <p className="error">{error}</p>}</section>

      <section className="control-grid research-office">
        <article className="agent-card main-agent reviewer-desk"><div className="office-scene reviewer-scene"><span className="reviewer-avatar">R</span><span className="reviewer-label">Riven · reviewer</span></div><div className="card-head"><div><p className="eyebrow">MAIN AGENT</p><h2>Research Orchestrator</h2></div><span className={statusClass(orchestratorState)}>{statusLabel(orchestratorState)}</span></div><p>Plans the mission, assigns four workstreams, reviews evidence quality, resolves conflicts and produces the final synthesis.</p><div className="meta-line"><span>Model</span><strong>{system?.models?.main || "Pending"}</strong></div></article>
        {modelEntries.filter(([slot]) => slot !== "main").map(([slot, model], index) => {
          const live = agentStates.find((agent) => agent.agent_id === slot);
          const evidence = live?.evidence_sources || [];
          const webCount = evidence.filter((item) => item.origin === "web").length;
          const docCount = evidence.filter((item) => item.origin === "document").length;
          const route = system?.web_agent_routing?.[slot];
          return <article className={`agent-card researcher-desk desk-${index + 1}`} key={slot}><div className="office-scene"><span className="agent-avatar">R{index + 1}</span><span className="desk-screen"></span><span className="desk-light"></span></div><div className="card-head"><div><p className="eyebrow">RESEARCHER {index + 1}</p><h2>{live?.title || `Research Agent ${index + 1}`}</h2></div><span className={statusClass(live?.latest)}>{statusLabel(live?.latest || "ready")}</span></div><p>{live?.objective || "Dynamic research role assigned by the main orchestrator for each run."}</p><div className="meta-line"><span>Search</span><strong>{route || webProviders}</strong></div><div className="meta-line"><span>Model</span><strong>{live?.result?.model_id || model || "Pending"}</strong></div>{live?.message && <p className="live-message">{live.message}</p>}{live && <p className="agent-counts"><strong>{evidence.length}</strong> evidence · {docCount} document · {webCount} web</p>}{live?.result && <p className="agent-counts"><strong>{live.result.findings.length}</strong> findings · <strong>{live.result.sources.length}</strong> cited sources</p>}{live?.error && <p className="error">{live.error}</p>}</article>;
        })}
      </section>

      {run && <><section className="summary panel"><div><span>Run</span><strong>{run.id}</strong></div><div><span>Status</span><strong>{run.status}</strong></div><div><span>Web sources</span><strong>{liveWebSources.length}</strong></div><div><span>Follow-ups</span><strong>{followUps.length}</strong></div></section>{liveWebSources.length > 0 && <section className="panel timeline"><div className="section-head"><h2>Live web evidence</h2><span>{liveWebSources.length} sources</span></div>{liveWebSources.map((item) => <div className="event" key={item.id}><time>{new Date(item.timestamp).toLocaleTimeString()}</time><strong>{item.metadata?.provider || "web"}</strong><span>{item.agent_id}</span><p>{item.message}</p></div>)}</section>}{run.final_answer && <section className="panel final-panel"><p className="eyebrow">MAIN SYNTHESIS</p><h2>Final research answer</h2><p className="final-answer">{run.final_answer}</p></section>}<section className="panel timeline"><div className="section-head"><h2>Live event timeline</h2><span>{events.length} events</span></div>{events.length === 0 ? <p>Waiting for events…</p> : events.map((item) => <div className="event" key={item.id}><time>{new Date(item.timestamp).toLocaleTimeString()}</time><strong>{statusLabel(item.type)}</strong><span>{item.agent_id || "orchestrator"}</span><p>{item.message}</p></div>)}</section></>}
    </main>
  );
}
