"use client";

import { useMemo, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function Home() {
  const [query, setQuery] = useState("");
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const sourceRef = useRef(null);

  const agentStates = useMemo(() => {
    const map = new Map();
    for (const task of run?.tasks || []) {
      map.set(task.agent_id, { ...task, latest: "Assigned" });
    }
    for (const event of events) {
      if (event.agent_id && map.has(event.agent_id)) {
        map.set(event.agent_id, { ...map.get(event.agent_id), latest: event.message });
      }
    }
    return [...map.values()];
  }, [run, events]);

  async function startResearch(event) {
    event.preventDefault();
    setError("");
    setEvents([]);
    sourceRef.current?.close();

    const response = await fetch(`${API_BASE}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      setError("Could not create research run.");
      return;
    }

    const nextRun = await response.json();
    setRun(nextRun);
    const source = new EventSource(`${API_BASE}/api/runs/${nextRun.id}/events`);
    sourceRef.current = source;
    source.onmessage = (message) => {
      setEvents((current) => [...current, JSON.parse(message.data)]);
    };
    source.onerror = () => setError("Live event stream disconnected.");
  }

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">RIVEN-STARLANCE</p>
          <h1>Research Control Center</h1>
          <p>One orchestrator, four specialist research agents, real event tracking.</p>
        </div>
        <span className="badge">Foundation v0.1</span>
      </header>

      <section className="panel">
        <form onSubmit={startResearch}>
          <label htmlFor="query">Research task</label>
          <textarea
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Enter a research question or document-analysis objective..."
            minLength={3}
            required
          />
          <button type="submit">Start research run</button>
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
              </article>
            ))}
          </section>

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
