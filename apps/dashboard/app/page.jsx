"use client";

import { useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function Home() {
  const [query, setQuery] = useState("");
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [executing, setExecuting] = useState(false);
  const sourceRef = useRef(null);

  const agentStates = useMemo(() => {
    const map = new Map();
    for (const task of run?.tasks || []) {
      map.set(task.agent_id, { ...task, latest: task.status || "assigned" });
    }
    for (const event of events) {
      if (event.agent_id && map.has(event.agent_id)) {
        map.set(event.agent_id, { ...map.get(event.agent_id), latest: event.message, eventType: event.type });
      }
    }
    return [...map.values()];
  }, [run, events]);

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
      const finishedRun = await executeResponse.json();
      setRun(finishedRun);
    } catch (err) {
      setError(err.message || "Research execution failed.");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">RIVEN-STARLANCE</p>
          <h1>Research Control Center</h1>
          <p>One orchestrator, four specialist research agents, real event tracking.</p>
        </div>
        <span className="badge">Execution v0.2</span>
      </header>

      <section className="panel">
        <form onSubmit={startResearch}>
          <label htmlFor="query">Research task</label>
          <textarea id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a research question or document-analysis objective..." minLength={3} required />
          <button type="submit" disabled={executing}>{executing ? "Research running…" : "Start research run"}</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {run && (
        <>
          <section className="summary panel">
            <div><span>Run</span><strong>{run.id}</strong></div>
            <div><span>Status</span><strong>{run.status}</strong></div>
            <div><span>Agents</span><strong>{run.tasks.length}</strong></div>
            <div><span>Events</span><strong>{events.length}</strong></div>
          </section>

          <section className="grid">
            {agentStates.map((agent) => (
              <article className="agent-card" key={agent.agent_id}>
                <p className="eyebrow">{agent.agent_id}</p>
                <h2>{agent.title}</h2>
                <p>{agent.objective}</p>
                <div className="status-line"><span className="dot" />{agent.latest}</div>
                {agent.result && <p><strong>{agent.result.findings.length}</strong> findings · <strong>{agent.result.sources.length}</strong> sources</p>}
                {agent.error && <p className="error">{agent.error}</p>}
              </article>
            ))}
          </section>

          {run.final_answer && (
            <section className="panel">
              <h2>Main-agent synthesis</h2>
              <p className="final-answer">{run.final_answer}</p>
            </section>
          )}

          <section className="panel timeline">
            <h2>Live event timeline</h2>
            {events.length === 0 ? <p>Waiting for events…</p> : events.map((item) => (
              <div className="event" key={item.id}>
                <time>{new Date(item.timestamp).toLocaleTimeString()}</time>
                <strong>{item.type}</strong>
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
