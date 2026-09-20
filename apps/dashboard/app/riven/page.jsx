"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RivenRoom3D from "./riven-room-3d";
import styles from "./riven-orchestrator-lab.module.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function phaseFrom(run, events, executing) {
  const types = [...events].reverse().map((event) => String(event.type || ""));
  if (types.some((type) => type.includes("failed")) || run?.status === "failed") return "failed";
  if (types.includes("run.completed") || run?.status === "completed") return "complete";
  if (types.includes("synthesis.completed") || types.includes("review.started")) return "synthesizing";
  if (types.some((type) => type.includes("follow_up")) || types.some((type) => type.includes("verifying"))) return "verifying";
  if (types.some((type) => type.includes("source.found")) || run?.status === "researching") return "coordinating";
  if (types.includes("plan.created") || run?.status === "planning") return "planning";
  if (executing) return "activating";
  return "idle";
}

const PHASE_COPY = {
  idle: ["READY", "Awaiting mission directive"],
  activating: ["ACTIVATING", "Opening orchestration channels"],
  planning: ["PLANNING", "Decomposing objective into specialist workstreams"],
  coordinating: ["COORDINATING", "Directing live research and evidence flow"],
  verifying: ["VERIFYING", "Checking evidence gaps and contradictions"],
  synthesizing: ["SYNTHESIZING", "Reconciling specialist findings into final output"],
  complete: ["MISSION COMPLETE", "Final synthesis available"],
  failed: ["ATTENTION", "Mission execution reported a failure"],
};

export default function RivenOrchestratorLabPage() {
  const [system, setSystem] = useState(null);
  const [query, setQuery] = useState("");
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const eventSourceRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/system/status`)
      .then((response) => response.ok ? response.json() : null)
      .then(setSystem)
      .catch(() => setSystem(null));
    return () => eventSourceRef.current?.close();
  }, []);

  const phase = useMemo(() => phaseFrom(run, events, executing), [run, events, executing]);
  const [phaseTitle, phaseText] = PHASE_COPY[phase];
  const latestEvent = events.at(-1);
  const sourceCount = events.filter((event) => event.type === "source.found").length;
  const followUps = events.filter((event) => event.type === "follow_up.requested").length;
  const completedAgents = run?.tasks?.filter((task) => task.status === "submitted").length || 0;
  const failedAgents = run?.tasks?.filter((task) => task.status === "failed").length || 0;
  const mainModel = system?.models?.main || "checking";
  const ready = Boolean(system?.runtime_ready);

  async function launchMission(event) {
    event.preventDefault();
    if (query.trim().length < 3) return;

    setError("");
    setEvents([]);
    setRun(null);
    setExecuting(true);
    eventSourceRef.current?.close();

    try {
      const create = await fetch(`${API_BASE}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const created = await create.json().catch(() => ({}));
      if (!create.ok) throw new Error(created.detail || "Could not create mission.");
      setRun(created);

      const stream = new EventSource(`${API_BASE}/api/runs/${created.id}/events`);
      eventSourceRef.current = stream;
      stream.onmessage = (message) => {
        const payload = JSON.parse(message.data);
        setEvents((current) => [...current, payload]);
      };
      stream.onerror = () => setError((current) => current || "Live event stream disconnected.");

      const execute = await fetch(`${API_BASE}/api/runs/${created.id}/execute`, { method: "POST" });
      const executed = await execute.json().catch(() => ({}));
      if (!execute.ok) throw new Error(executed.detail || "Mission execution could not start.");
      setRun(executed);
    } catch (err) {
      setError(err.message || "Mission failed to start.");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <main className={`${styles.page} ${styles[`phase_${phase}`]}`}>
      <header className={styles.topHud}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>✦</span>
          <span><strong>RIVEN–STARLANCE</strong><small>LIVE ORCHESTRATOR COMMAND ROOM</small></span>
        </div>
        <div className={styles.systemState}>
          <i className={ready ? styles.online : styles.pending} />
          <span><strong>{ready ? "RUNTIME ONLINE" : "RUNTIME CHECK"}</strong><small>{system?.provider || "provider"} · {system?.region || "ap-south-1"}</small></span>
        </div>
      </header>

      <section className={styles.commandDeck}>
        <RivenRoom3D
          phase={phase}
          phaseTitle={phaseTitle}
          phaseText={phaseText}
          latestEvent={latestEvent}
          runStatus={run?.status || "ready"}
          sourceCount={sourceCount}
          completedAgents={completedAgents}
          failedAgents={failedAgents}
          events={events}
        />

        <aside className={`${styles.glassPanel} ${styles.missionPanel}`}>
          <div className={styles.panelEyebrow}>MISSION CONTROL</div>
          <form onSubmit={launchMission} className={styles.missionForm}>
            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Give Riven a research mission…"
              minLength={3}
              required
            />
            <button type="submit" disabled={executing || !ready}>{executing ? "ACTIVATING…" : "LAUNCH MISSION"}</button>
          </form>
          <div className={styles.microStats}>
            <span><small>MODEL</small><b>{mainModel}</b></span>
            <span><small>EVENTS</small><b>{events.length}</b></span>
            <span><small>SOURCES</small><b>{sourceCount}</b></span>
          </div>
        </aside>

        <aside className={`${styles.glassPanel} ${styles.activityPanelWrap}`}>
          <div className={styles.panelEyebrow}>LIVE ORCHESTRATION</div>
          <div className={styles.activityPanel}>
            <div><small>RUN</small><strong>{run?.status || "ready"}</strong></div>
            <div><small>AGENTS</small><strong>{completedAgents}/4</strong></div>
            <div><small>FOLLOW-UPS</small><strong>{followUps}</strong></div>
            <div><small>FAILED</small><strong>{failedAgents}</strong></div>
          </div>
          <div className={styles.eventList}>
            {events.slice(-5).reverse().map((event) => (
              <div key={event.id}>
                <i />
                <span><strong>{event.agent_id || "Riven"}</strong><small>{event.message || event.type}</small></span>
              </div>
            ))}
            {!events.length && <p>Launch a mission to watch Riven coordinate real runtime events.</p>}
          </div>
        </aside>

        <div className={styles.phaseBar}>
          <span>{phaseTitle}</span>
          <strong>{latestEvent?.message || phaseText}</strong>
          <em>LIVE STATE · SSE DRIVEN</em>
        </div>

        {error && <div className={styles.error}>{error}</div>}
      </section>

      <footer className={styles.footer}>
        <span>RIVEN ORCHESTRATOR · WEBGL COMMAND ROOM PROTOTYPE</span>
        <span>REAL API + SSE STATE · INTERACTIVE CAMERA</span>
      </footer>
    </main>
  );
}
