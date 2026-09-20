"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
      <div className={styles.ceilingGlow} />
      <div className={styles.roomFrame}>
        <header className={styles.topHud}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>✦</span>
            <span><strong>RIVEN-STarlance</strong><small>ORCHESTRATOR DEVELOPMENT LAB</small></span>
          </div>
          <div className={styles.systemState}>
            <i className={ready ? styles.online : styles.pending} />
            <span><strong>{ready ? "RUNTIME ONLINE" : "RUNTIME CHECK"}</strong><small>{system?.provider || "provider"} · {system?.region || "ap-south-1"}</small></span>
          </div>
        </header>

        <section className={styles.chamber}>
          <div className={styles.wallGrid} />
          <div className={styles.leftBay}>
            <div className={styles.bayTitle}>MISSION INPUT</div>
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
          </div>

          <div className={styles.centerStage}>
            <div className={styles.namePlate}><small>MAIN ORCHESTRATOR</small><strong>RIVEN</strong><span>{phaseTitle}</span></div>

            <div className={styles.holoRig}>
              <div className={styles.outerRing} />
              <div className={styles.midRing} />
              <div className={styles.innerRing} />
              <div className={styles.energyColumn} />
              <div className={styles.rivenAvatar} aria-label={`Riven state: ${phaseTitle}`}>
                <div className={styles.crown}><i /><i /><i /></div>
                <div className={styles.head}><span className={styles.eyeLeft} /><span className={styles.eyeRight} /><b /></div>
                <div className={styles.neck} />
                <div className={styles.shoulders}><i /><i /></div>
                <div className={styles.torso}><span className={styles.core}><b /></span><em /></div>
                <div className={styles.armLeft}><i /></div>
                <div className={styles.armRight}><i /></div>
                <div className={styles.lower}><i /><i /></div>
              </div>
              <div className={styles.platform}>
                <div /><div /><span />
              </div>
              <div className={styles.dataArcLeft}><i /><i /><i /></div>
              <div className={styles.dataArcRight}><i /><i /><i /></div>
            </div>

            <div className={styles.phaseCaption}>
              <strong>{phaseTitle}</strong>
              <span>{latestEvent?.message || phaseText}</span>
            </div>
          </div>

          <aside className={styles.rightBay}>
            <div className={styles.bayTitle}>LIVE ORCHESTRATION</div>
            <div className={styles.activityPanel}>
              <div><small>RUN</small><strong>{run?.status || "ready"}</strong></div>
              <div><small>AGENTS COMPLETE</small><strong>{completedAgents}/4</strong></div>
              <div><small>FOLLOW-UPS</small><strong>{followUps}</strong></div>
              <div><small>FAILED</small><strong>{failedAgents}</strong></div>
            </div>
            <div className={styles.eventList}>
              {events.slice(-6).reverse().map((event) => (
                <div key={event.id}>
                  <i />
                  <span><strong>{event.agent_id || "Riven"}</strong><small>{event.message || event.type}</small></span>
                </div>
              ))}
              {!events.length && <p>Launch a mission to watch Riven coordinate real runtime events.</p>}
            </div>
          </aside>

          <div className={styles.floor}>
            <div className={styles.floorLines} />
            <div className={styles.emptyStationRow}>
              {Array.from({ length: 6 }, (_, index) => <span key={index}><i /><b>FUTURE AGENT BAY {index + 1}</b></span>)}
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </section>

        <footer className={styles.footer}>
          <span>RIVEN ORCHESTRATOR · SINGLE-AGENT VISUAL PROTOTYPE</span>
          <span>ALL MOTION STATES DERIVED FROM LIVE RUN / SSE STATE</span>
        </footer>
      </div>
    </main>
  );
}
