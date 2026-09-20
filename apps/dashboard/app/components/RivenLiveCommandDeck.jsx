"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const RivenCommandRoomScene = dynamic(() => import("./RivenCommandRoomScene"), {
  ssr: false,
  loading: () => <div className="room3d-loading"><span></span><strong>Initializing live command room…</strong></div>,
});

const ACCENTS = ["cyan", "violet", "amber", "emerald", "rose", "blue", "lime", "fuchsia", "orange", "teal", "indigo", "sky", "green", "purple", "red"];
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
  if (state.includes("research") || state.includes("source") || state.includes("verify") || state.includes("review") || state.includes("plan") || state.includes("follow") || state.includes("execut") || state.includes("running")) return "working";
  return "ready";
}

function progressFor(state, evidenceCount, hasResult) {
  const kind = stateKind(state);
  if (kind === "failed") return 18;
  if (kind === "complete") return 100;
  if (hasResult) return 94;
  if (kind === "working") return Math.min(90, 30 + evidenceCount * 8);
  return 6;
}

function taskLabel(station) {
  if (station.reserve) return `${station.role} station available`;
  if (station.kind === "failed") return station.error || "Needs attention";
  if (station.kind === "complete") return "Specialist report submitted";
  if (station.kind === "working") return station.message || station.objective || "Processing live mission data";
  return station.objective || "Standing by for assignment";
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
    const connected = models.slice(0, 15).map(([slot, model], index) => {
      const live = liveMap.get(slot) || {};
      const evidence = live.evidence_sources || [];
      const state = live.latest || live.status || "ready";
      const kind = stateKind(state);
      return {
        id: slot,
        name: live.title || `Research Agent ${index + 1}`,
        role: live.title || `Research Agent ${index + 1}`,
        objective: live.objective || "Dynamic research specialist",
        model: live.result?.model_id || model,
        state,
        kind,
        message: live.message || "",
        evidence,
        result: live.result,
        error: live.error,
        reserve: false,
        accent: ACCENTS[index % ACCENTS.length],
        progress: progressFor(state, evidence.length, Boolean(live.result)),
      };
    });

    const reserves = Array.from({ length: Math.max(0, 15 - connected.length) }, (_, index) => ({
      id: `reserve-${index + 1}`,
      name: `Agent Slot ${connected.length + index + 1}`,
      role: RESERVE_ROLES[index % RESERVE_ROLES.length],
      objective: "Ready for a future specialist agent",
      model: "Not assigned",
      state: "reserve",
      kind: "reserve",
      message: "",
      evidence: [],
      result: null,
      error: null,
      reserve: true,
      accent: ACCENTS[(connected.length + index) % ACCENTS.length],
      progress: 0,
    }));
    return [...connected, ...reserves];
  }, [system, agentStates]);

  const connected = stations.filter((station) => !station.reserve);
  const selected = stations.find((station) => station.id === selectedAgent) || connected[0] || stations[0];
  const latestOrchestratorEvent = [...(events || [])].reverse().find((event) => !event.agent_id);
  const latestEvents = [...(events || [])].slice(-5).reverse();
  const working = connected.filter((station) => station.kind === "working").length;
  const complete = connected.filter((station) => station.kind === "complete").length;
  const ready = Boolean(system?.runtime_ready && system?.web_research_ready);
  const orchestratorActive = executing || stateKind(orchestratorState) === "working";
  const runStatus = clean(run?.status || (executing ? "running" : "ready"));

  return (
    <main className="room3d-page">
      <nav className="room3d-topbar">
        <div className="room3d-brand"><i>✦</i><span><strong>RIVEN-STARLANCE</strong><small>LIVE AI COMMAND ROOM</small></span></div>
        <div className="room3d-status"><i className={ready ? "online" : "pending"}></i><span>{ready ? "SYSTEMS ONLINE" : "SYSTEM CHECK"}<small>{connected.length}/15 CONNECTED · {working} WORKING</small></span></div>
      </nav>

      <section className="room3d-ribbon">
        <span><small>PROVIDER</small><strong>{system?.provider || "checking"}</strong></span>
        <span><small>REGION</small><strong>{system?.region || "ap-south-1"}</strong></span>
        <span><small>MISSION</small><strong>{runStatus}</strong></span>
        <span><small>LIVE EVENTS</small><strong>{events?.length || 0}</strong></span>
        <span><small>WEB INTEL</small><strong>{liveWebSources?.length || 0}</strong></span>
        <span><small>AGENTS</small><strong>{connected.length}/15</strong></span>
      </section>

      <section className="room3d-stage-shell">
        <RivenCommandRoomScene stations={stations} orchestratorActive={orchestratorActive} selectedId={selected?.id} onSelect={setSelectedAgent} />

        <div className="room3d-orchestrator-hud">
          <small>MAIN ORCHESTRATOR</small>
          <strong>RIVEN</strong>
          <span>{latestOrchestratorEvent?.message || (executing ? "Coordinating live mission execution" : "Ready for the next mission")}</span>
        </div>

        <aside className="room3d-agent-hud">
          <small>SELECTED STATION</small>
          <strong>{selected?.name}</strong>
          <span className={`room3d-pill state-${selected?.kind}`}>{selected?.reserve ? "OPEN SLOT" : selected?.kind?.toUpperCase()}</span>
          <p>{taskLabel(selected)}</p>
          <dl>
            <div><dt>Progress</dt><dd>{selected?.progress || 0}%</dd></div>
            <div><dt>Evidence</dt><dd>{selected?.evidence?.length || 0}</dd></div>
            <div><dt>Model</dt><dd>{selected?.model || "—"}</dd></div>
          </dl>
        </aside>

        <aside className="room3d-live-hud">
          <header><span><i></i> LIVE OPS</span><b>{events?.length || 0}</b></header>
          {latestEvents.length === 0 ? <p>Launch a mission to activate agents.</p> : latestEvents.map((event) => (
            <div key={event.id}><time>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time><span><strong>{event.agent_id || "Riven"}</strong><small>{event.message}</small></span></div>
          ))}
        </aside>

        <form className="room3d-mission-console" onSubmit={startResearch}>
          <div><small>MISSION CONSOLE</small><strong>{run ? "Mission control" : "Launch new mission"}</strong></div>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Give Riven a research mission…" minLength={3} required />
          <button type="submit" disabled={executing}>{executing ? "RUNNING…" : "LAUNCH"}</button>
          <button type="button" className="room3d-scan" onClick={previewEvidence}>SCAN INTEL</button>
          {error && <p className="room3d-error">{error}</p>}
        </form>

        <div className="room3d-telemetry">
          <span><b>{working}</b><small>WORKING</small></span>
          <span><b>{complete}</b><small>COMPLETE</small></span>
          <span><b>{followUps?.length || 0}</b><small>FOLLOW-UPS</small></span>
          <span><b>{documents?.length || 0}</b><small>DOCUMENTS</small></span>
        </div>
      </section>

      <section className="room3d-lower-grid">
        <article className="room3d-panel">
          <div className="room3d-panel-head"><span><small>INTEL VAULT</small><strong>Documents</strong></span><b>{documents?.length || 0}</b></div>
          <label className="room3d-upload">{uploading ? "Uploading…" : "+ Add PDF / DOCX / TXT"}<input type="file" accept=".pdf,.docx,.txt" onChange={uploadDocument} disabled={uploading} hidden /></label>
          <div className="room3d-list">{(documents || []).slice(0, 5).map((doc) => <div key={doc.id}><span>▣</span><p><strong>{doc.filename}</strong><small>{Math.ceil(doc.size_bytes / 1024)} KB · {doc.chunk_count} chunks</small></p><b>{clean(doc.status)}</b></div>)}{!documents?.length && <p>No stored documents.</p>}</div>
        </article>

        <article className="room3d-panel">
          <div className="room3d-panel-head"><span><small>INTEL PREVIEW</small><strong>Relevant evidence</strong></span><button type="button" onClick={previewEvidence}>Refresh</button></div>
          <div className="room3d-list evidence">{(sources || []).slice(0, 5).map((source, index) => <div key={source.chunk_id || index}><span>◈</span><p><strong>{source.filename || source.title || "Evidence"}</strong><small>{String(source.text || source.snippet || "").slice(0, 110)}</small></p></div>)}{!sources?.length && <p>Scan intel to preview matching evidence.</p>}</div>
        </article>

        <article className="room3d-panel">
          <div className="room3d-panel-head"><span><small>COMMAND TELEMETRY</small><strong>Live runtime</strong></span><b>{ready ? "READY" : "CHECK"}</b></div>
          <div className="room3d-bars">
            <label>Runtime<i><b style={{ width: system?.runtime_ready ? "100%" : "25%" }}></b></i></label>
            <label>Web research<i><b style={{ width: system?.web_research_ready ? "100%" : "25%" }}></b></i></label>
            <label>Agent capacity<i><b style={{ width: `${Math.min(100, connected.length / 15 * 100)}%` }}></b></i></label>
          </div>
        </article>
      </section>

      {run?.final_answer && <section className="room3d-debrief"><small>MISSION DEBRIEF</small><h2>Final synthesis</h2><p>{run.final_answer}</p></section>}
      <footer className="room3d-footer"><span>RIVEN-STARLANCE · LIVE COMMAND ROOM</span><span>15-STATION SCENE · REAL SSE TELEMETRY</span></footer>
    </main>
  );
}
