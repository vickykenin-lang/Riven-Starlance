"use client";

import { useMemo, useState } from "react";

const ACCENTS = [
  "cyan", "violet", "amber", "emerald", "rose",
  "blue", "lime", "fuchsia", "orange", "teal",
  "indigo", "sky", "green", "purple", "red",
];

const RESERVE_ROLES = [
  "Strategy Agent", "Security Agent", "Data Agent", "Operations Agent", "Simulation Agent",
  "Planning Agent", "Memory Agent", "Critic Agent", "Vision Agent", "Review Agent", "Creative Agent",
  "Code Agent", "Intel Agent", "Analytics Agent", "Specialist Agent",
];

function clean(value, fallback = "") {
  const text = String(value || fallback).replaceAll("_", " ").replaceAll(".", " ").trim();
  return text || fallback;
}

function stateKind(value) {
  const state = String(value || "ready").toLowerCase();
  if (state.includes("fail") || state.includes("error")) return "failed";
  if (state.includes("complete") || state.includes("submitted") || state.includes("parsed")) return "complete";
  if (
    state.includes("research") || state.includes("source") || state.includes("verify") ||
    state.includes("review") || state.includes("plan") || state.includes("follow") ||
    state.includes("execut") || state.includes("running")
  ) return "working";
  return "ready";
}

function progressFor(state, evidenceCount, hasResult) {
  const kind = stateKind(state);
  if (kind === "failed") return 18;
  if (kind === "complete") return 100;
  if (hasResult) return 94;
  if (kind === "working") return Math.min(88, 34 + evidenceCount * 8);
  return 8;
}

function activityLabel(agent) {
  const kind = stateKind(agent.state);
  if (kind === "failed") return "Needs attention";
  if (kind === "complete") return "Mission report ready";
  if (kind === "working") return clean(agent.message, "Processing live mission data");
  return "Standing by for assignment";
}

function AgentScreen({ station, selected, onSelect }) {
  const evidence = station.evidence || [];
  const progress = station.reserve ? 0 : progressFor(station.state, evidence.length, Boolean(station.result));
  const kind = station.reserve ? "reserve" : stateKind(station.state);
  const latestEvidence = evidence.slice(-2).reverse();

  return (
    <button
      type="button"
      className={`rpg-station accent-${station.accent} state-${kind} ${selected ? "selected" : ""}`}
      onClick={() => onSelect(station.id)}
      aria-pressed={selected}
    >
      <span className="station-badge-row">
        <span className="station-badge">{station.name}</span>
        <span className={`station-state state-${kind}`}>{station.reserve ? "OPEN SLOT" : clean(kind).toUpperCase()}</span>
      </span>

      <span className="station-monitor">
        {station.reserve ? (
          <span className="reserve-screen">
            <span className="reserve-plus">+</span>
            <strong>{station.role}</strong>
            <small>Ready for future agent</small>
          </span>
        ) : (
          <>
            <span className="monitor-topline">
              <small>LIVE TASK</small>
              <i className={kind === "working" ? "pulse-dot" : "status-dot"}></i>
            </span>
            <strong className="monitor-task">{activityLabel(station)}</strong>
            <span className="monitor-grid">
              <span className="mini-graph"><i></i><i></i><i></i><i></i><i></i><i></i></span>
              <span className="monitor-feed">
                {latestEvidence.length ? latestEvidence.map((item, index) => (
                  <small key={`${item.url || item.chunk_id || index}-${index}`}>{clean(item.title || item.filename || item.origin, "Evidence acquired")}</small>
                )) : <small>Waiting for evidence stream…</small>}
              </span>
            </span>
          </>
        )}
      </span>

      <span className="station-progress"><i style={{ width: `${progress}%` }}></i></span>
      <span className="station-footer">
        <small>{station.reserve ? "UNASSIGNED" : `${evidence.length} evidence`}</small>
        <small>{station.reserve ? "AVAILABLE" : station.model}</small>
      </span>
      <span className="operator-silhouette" aria-hidden="true"><i></i></span>
    </button>
  );
}

export default function RivenLiveCommandDeck({
  system,
  documents,
  sources,
  query,
  setQuery,
  uploadDocument,
  uploading,
  previewEvidence,
  startResearch,
  executing,
  error,
  run,
  events,
  agentStates,
  orchestratorState,
  liveWebSources,
  followUps,
}) {
  const [selectedAgent, setSelectedAgent] = useState("researcher-1");

  const stations = useMemo(() => {
    const models = Object.entries(system?.models || {}).filter(([slot]) => slot !== "main");
    const liveMap = new Map((agentStates || []).map((agent) => [agent.agent_id, agent]));
    const activeStations = models.map(([slot, model], index) => {
      const live = liveMap.get(slot) || {};
      return {
        id: slot,
        name: live.title || `Research Agent ${index + 1}`,
        role: live.objective || "Dynamic research specialist",
        model: live.result?.model_id || model,
        state: live.latest || live.status || "ready",
        message: live.message || "",
        evidence: live.evidence_sources || [],
        result: live.result,
        error: live.error,
        reserve: false,
        accent: ACCENTS[index % ACCENTS.length],
      };
    });

    const totalSlots = 15;
    const reserveCount = Math.max(0, totalSlots - activeStations.length);
    const reserves = Array.from({ length: reserveCount }, (_, index) => ({
      id: `reserve-${index + 1}`,
      name: `Agent Slot ${activeStations.length + index + 1}`,
      role: RESERVE_ROLES[index % RESERVE_ROLES.length],
      model: "Not assigned",
      state: "reserve",
      message: "",
      evidence: [],
      result: null,
      error: null,
      reserve: true,
      accent: ACCENTS[(activeStations.length + index) % ACCENTS.length],
    }));

    return [...activeStations, ...reserves];
  }, [system, agentStates]);

  const connectedStations = stations.filter((station) => !station.reserve);
  const workingCount = connectedStations.filter((station) => stateKind(station.state) === "working").length;
  const completedCount = connectedStations.filter((station) => stateKind(station.state) === "complete").length;
  const selected = stations.find((station) => station.id === selectedAgent) || connectedStations[0] || stations[0];
  const latestOrchestratorEvent = [...(events || [])].reverse().find((event) => !event.agent_id);
  const recentEvents = [...(events || [])].slice(-7).reverse();
  const ready = Boolean(system?.runtime_ready && system?.web_research_ready);
  const runStatus = clean(run?.status || (executing ? "running" : "ready"));

  const leftStations = stations.slice(0, 5);
  const rightStations = stations.slice(5, 10);
  const bottomStations = stations.slice(10, 15);

  return (
    <main className="rpg-command-deck">
      <nav className="rpg-topbar">
        <div className="rpg-brand">
          <span className="rpg-brand-mark">✦</span>
          <span><strong>RIVEN-STARLANCE</strong><small>LIVE AI ORCHESTRATION</small></span>
        </div>
        <div className="rpg-nav-links">
          <a href="#live">Live</a><a href="#mission">Mission</a><a href="#agents">Agents</a><a href="#intel">Intel</a>
        </div>
        <div className="rpg-system-live"><i className={ready ? "online" : "pending"}></i><span>{ready ? "SYSTEMS ONLINE" : "SYSTEM CHECK"}<small>{connectedStations.length}/15 CONNECTED</small></span></div>
      </nav>

      <section className="rpg-status-ribbon" id="live">
        <span><small>PROVIDER</small><strong>{system?.provider || "checking"}</strong></span>
        <span><small>REGION</small><strong>{system?.region || "ap-south-1"}</strong></span>
        <span><small>MODEL SLOTS</small><strong>{system ? `${system.configured_slots}/${system.required_slots}` : "--"}</strong></span>
        <span><small>LIVE EVENTS</small><strong>{events?.length || 0}</strong></span>
        <span><small>WEB INTEL</small><strong>{liveWebSources?.length || 0}</strong></span>
        <span><small>RUN</small><strong>{runStatus}</strong></span>
      </section>

      <section className="rpg-arena" id="agents">
        <div className="rpg-side-ring left-ring">
          {leftStations.map((station) => <AgentScreen key={station.id} station={station} selected={selected?.id === station.id} onSelect={setSelectedAgent} />)}
        </div>

        <section className="orchestrator-stage">
          <div className="orchestrator-title"><small>MAIN ORCHESTRATOR</small><strong>RIVEN</strong><span>Plan · Coordinate · Verify · Synthesize</span></div>
          <div className={`orchestrator-core state-${stateKind(orchestratorState)}`}>
            <div className="orbit orbit-a"></div><div className="orbit orbit-b"></div><div className="orbit orbit-c"></div>
            <div className="core-avatar"><i></i><span>R</span></div>
            <div className="core-signal-lines"><i></i><i></i><i></i><i></i></div>
          </div>
          <div className="orchestrator-live-copy">
            <span className="live-kicker"><i></i> LIVE ORCHESTRATION</span>
            <strong>{latestOrchestratorEvent?.message || (executing ? "Mission execution in progress" : "Ready for the next mission")}</strong>
            <small>{system?.models?.main || "Main model pending"}</small>
          </div>

          <form className="mission-console" onSubmit={startResearch} id="mission">
            <div className="mission-console-head"><span><small>MISSION CONSOLE</small><strong>{run ? "Active mission" : "Launch new mission"}</strong></span><b>{executing ? "RUNNING" : runStatus.toUpperCase()}</b></div>
            <textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Enter a research mission for Riven and the agent squad..." minLength={3} required />
            <div className="mission-actions">
              <button type="submit" disabled={executing}>{executing ? "Mission running…" : "Launch Mission"}</button>
              <button type="button" className="ghost-action" onClick={previewEvidence}>Scan Intel</button>
            </div>
            {error && <p className="rpg-error">{error}</p>}
          </form>
        </section>

        <div className="rpg-side-ring right-ring">
          {rightStations.map((station) => <AgentScreen key={station.id} station={station} selected={selected?.id === station.id} onSelect={setSelectedAgent} />)}
        </div>
      </section>

      <section className="rpg-bottom-ring">
        {bottomStations.map((station) => <AgentScreen key={station.id} station={station} selected={selected?.id === station.id} onSelect={setSelectedAgent} />)}
      </section>

      <section className="rpg-ops-grid">
        <article className="rpg-panel agent-inspector">
          <div className="rpg-panel-head"><span><small>SELECTED STATION</small><strong>{selected?.name || "Agent"}</strong></span><b>{selected?.reserve ? "OPEN" : clean(stateKind(selected?.state)).toUpperCase()}</b></div>
          <p>{selected?.reserve ? `${selected.role} slot is reserved for a future agent.` : selected?.role}</p>
          <div className="inspector-stats">
            <span><small>MODEL</small><strong>{selected?.model || "—"}</strong></span>
            <span><small>EVIDENCE</small><strong>{selected?.evidence?.length || 0}</strong></span>
            <span><small>STATE</small><strong>{selected?.reserve ? "Available" : clean(selected?.state, "Ready")}</strong></span>
          </div>
          {!selected?.reserve && <div className="inspector-screen"><span className="screen-scan"></span><strong>{activityLabel(selected)}</strong><small>{selected?.message || "Live agent telemetry will appear here during execution."}</small></div>}
          {selected?.error && <p className="rpg-error">{selected.error}</p>}
        </article>

        <article className="rpg-panel live-ops-panel">
          <div className="rpg-panel-head"><span><small>REAL-TIME</small><strong>Live Ops Feed</strong></span><b>{events?.length || 0} EVENTS</b></div>
          <div className="ops-feed">
            {recentEvents.length === 0 ? <p className="empty-feed">Mission events will stream here live.</p> : recentEvents.map((event) => (
              <div className="ops-event" key={event.id}>
                <time>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
                <i></i>
                <span><strong>{event.agent_id || "Riven"}</strong><small>{event.message}</small></span>
              </div>
            ))}
          </div>
        </article>

        <article className="rpg-panel mission-metrics">
          <div className="rpg-panel-head"><span><small>MISSION STATE</small><strong>Command Telemetry</strong></span><b>{runStatus.toUpperCase()}</b></div>
          <div className="metric-orbs">
            <span><strong>{connectedStations.length}</strong><small>Connected</small></span>
            <span><strong>{workingCount}</strong><small>Working</small></span>
            <span><strong>{completedCount}</strong><small>Complete</small></span>
            <span><strong>{followUps?.length || 0}</strong><small>Follow-ups</small></span>
          </div>
          <div className="system-bars">
            <label>Runtime<i><b style={{ width: system?.runtime_ready ? "100%" : "30%" }}></b></i></label>
            <label>Web Research<i><b style={{ width: system?.web_research_ready ? "100%" : "30%" }}></b></i></label>
            <label>Agent Capacity<i><b style={{ width: `${Math.min(100, (connectedStations.length / 15) * 100)}%` }}></b></i></label>
          </div>
        </article>
      </section>

      <section className="rpg-intel-grid" id="intel">
        <article className="rpg-panel intel-vault">
          <div className="rpg-panel-head"><span><small>INTEL VAULT</small><strong>Documents</strong></span><b>{documents?.length || 0} STORED</b></div>
          <label className="intel-upload">{uploading ? "Uploading…" : "+ Add PDF / DOCX / TXT"}<input type="file" accept=".pdf,.docx,.txt" onChange={uploadDocument} disabled={uploading} hidden /></label>
          <div className="intel-items">
            {(documents || []).slice(0, 5).map((doc) => <div key={doc.id}><span>▣</span><p><strong>{doc.filename}</strong><small>{Math.ceil(doc.size_bytes / 1024)} KB · {doc.chunk_count} chunks</small></p><b>{clean(doc.status)}</b></div>)}
            {!documents?.length && <p className="empty-feed">No stored documents yet.</p>}
          </div>
        </article>

        <article className="rpg-panel evidence-vault">
          <div className="rpg-panel-head"><span><small>EVIDENCE SCAN</small><strong>Relevant Intel</strong></span><button type="button" onClick={previewEvidence}>Refresh</button></div>
          <div className="intel-items">
            {(sources || []).slice(0, 5).map((source) => <div key={source.chunk_id}><span>⌁</span><p><strong>{source.filename}</strong><small>{source.text.slice(0, 120)}{source.text.length > 120 ? "…" : ""}</small></p><b>{source.score}</b></div>)}
            {!sources?.length && <p className="empty-feed">Run an intel scan to preview document evidence.</p>}
          </div>
        </article>
      </section>

      {run?.final_answer && <section className="rpg-panel mission-debrief"><div className="rpg-panel-head"><span><small>MISSION DEBRIEF</small><strong>Final Synthesis</strong></span><b>COMPLETE</b></div><p>{run.final_answer}</p></section>}

      <footer className="rpg-footer"><span>RIVEN-STARLANCE</span><span>15 STATION COMMAND DECK · LIVE INSTANCE</span><span>v0.7</span></footer>
    </main>
  );
}
