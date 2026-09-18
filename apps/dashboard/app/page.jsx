"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function statusLabel(value) {
  return String(value || "idle").replaceAll("_", " ").replaceAll(".", " ");
}

function statusClass(value) {
  const v = String(value || "").toLowerCase();
  if (v.includes("fail") || v.includes("error")) return "status bad";
  if (v.includes("complete") || v.includes("submitted")) return "status good";
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
  const sourceRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/system/status`)
      .then((response) => response.ok ? response.json() : null)
      .then(setSystem)
      .catch(() => setSystem(null));
    return () => sourceRef.current?.close();
  }, []);

  const agentStates = useMemo(() => {
    const map = new Map();
    for (const task of run?.tasks || []) {
      map.set(task.agent_id, { ...task, latest: task.status || "assigned" });
    }
    for (const event of events) {
      if (event.agent_id && map.has(event.agent_id)) {
        map.set(event.agent_id, {
          ...map.get(event.agent_id),
          latest: event.type,
          message: event.message,
        });
      }
    }
    return [...map.values()];
  }, [run, events]);

  const orchestratorState = useMemo(() => {
    const latest = [...events].reverse().find((event) => !event.agent_id);
    return latest?.type || run?.status || "ready";
  }, [events, run]);

  async function startResearch(event) {
    event.preventDefault();
    setError("");
    setEvents([]);
    setExecuting(true);
    sourceRef.current?.close();

    try {
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
      source.onmessage = (message) => {
        const item = JSON.parse(message.data);
        setEvents((current) => [...current, item]);
      };
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
          <p>One orchestrator, four specialist research agents, real event tracking.</p>
        </div>
        <span className="badge">Execution v0.3</span>
      </header>

      <section className="system-strip">
        <div><span>Provider</span><strong>{system?.provider || "AWS Bedrock"}</strong></div>
        <div><span>Region</span><strong>{system?.region || "ap-south-1"}</strong></div>
        <div><span>Model slots</span><strong>{system ? `${system.configured_slots}/${system.required_slots}` : "checking"}</strong></div>
        <div><span>Runtime</span><strong className={system?.runtime_ready ? "good-text" : "warn-text"}>{system?.runtime_ready ? "Configured" : "Pending model mapping"}</strong></div>
      </section>

      {!system?.runtime_ready && (
        <section className="notice">
          <strong>Bedrock runtime not ready yet.</strong>
          <span> Dashboard and orchestration are deployed, but all five model slots must be configured and AWS model authorization must be available before a real research run can execute.</span>
        </section>
      )}

      <section className="panel">
        <form onSubmit={startResearch}>
          <label htmlFor="query">Research task</label>
          <textarea id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a research question or document-analysis objective..." minLength={3} required />
          <button type="submit" disabled={executing}>{executing ? "Research running…" : "Start research run"}</button>
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
            <div><span>Run</span><strong>{run.id}</strong></div>
            <div><span>Status</span><strong>{run.status}</strong></div>
            <div><span>Agents</span><strong>{run.tasks.length}</strong></div>
            <div><span>Events</span><strong>{events.length}</strong></div>
          </section>

          {run.final_answer && (
            <section className="panel final-panel">
              <p className="eyebrow">MAIN SYNTHESIS</p>
              <h2>Final research answer</h2>
              <p className="final-answer">{run.final_answer}</p>
            </section>
          )}

          <section className="panel timeline">
            <div className="section-head"><h2>Live event timeline</h2><span>{events.length} events</span></div>
            {events.length === 0 ? <p>Waiting for events…</p> : events.map((item) => (
              <div className="event" key={item.id}>
                <time>{new Date(item.timestamp).toLocaleTimeString()}</time>
                <strong>{statusLabel(item.type)}</strong>
                <span>{item.agent_id || "orchestrator"}</span>
                <p>{item.message}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
