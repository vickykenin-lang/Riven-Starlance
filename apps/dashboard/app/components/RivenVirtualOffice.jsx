"use client";

import { useMemo, useState } from "react";

const PALETTE = ["#5eead4", "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#fb7185", "#38bdf8"];
const CLASSES = ["Pathfinder", "Analyst", "Sentinel", "Verifier", "Archivist", "Strategist", "Scout", "Specialist"];

function stateKind(value) {
  const state = String(value || "ready").toLowerCase();
  if (state.includes("fail") || state.includes("error") || state.includes("block")) return "blocked";
  if (state.includes("complete") || state.includes("submitted") || state.includes("parsed")) return "complete";
  if (state.includes("research") || state.includes("source") || state.includes("verify") || state.includes("review") || state.includes("plan") || state.includes("follow") || state.includes("execut")) return "working";
  return "idle";
}

function stateLabel(value) {
  return String(value || "ready").replaceAll("_", " ").replaceAll(".", " ");
}

function progressFor(state) {
  const kind = stateKind(state);
  if (kind === "complete") return 100;
  if (kind === "blocked") return 42;
  if (kind === "working") return 68;
  return 12;
}

function shortText(value, fallback, limit = 88) {
  const clean = String(value || fallback).replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

export default function RivenVirtualOffice({
  agents = [],
  orchestratorState = "ready",
  orchestratorMessage = "",
  executing = false,
  sourceCount = 0,
  followUpCount = 0,
}) {
  const [selectedId, setSelectedId] = useState("commander");

  const squad = useMemo(() => agents.map((agent, index) => ({
    id: agent.id || `agent-${index + 1}`,
    name: agent.title || `Researcher ${index + 1}`,
    role: agent.role || CLASSES[index] || `Specialist ${index + 1}`,
    state: agent.state || "ready",
    message: agent.message || "Awaiting mission telemetry.",
    color: PALETTE[index % PALETTE.length],
    level: index + 1,
  })), [agents]);

  const selected = selectedId === "commander"
    ? {
        name: "Riven Commander",
        role: "Main Orchestrator",
        state: orchestratorState,
        message: orchestratorMessage || "Ready to assign research workstreams and synthesize evidence.",
        color: "#fbbf24",
      }
    : squad.find((agent) => agent.id === selectedId) || squad[0];

  return (
    <section className="rpg-command-map" aria-label="Riven agent command map">
      <div className="rpg-map-topbar">
        <div>
          <p className="eyebrow">TACTICAL AGENT MAP</p>
          <h2>Riven Party Command</h2>
          <p className="rpg-map-subtitle">Dynamic squad roster · additional agents appear automatically when registered by the runtime.</p>
        </div>
        <div className="rpg-map-counters">
          <span><b>{squad.length}</b> active units</span>
          <span><b>{sourceCount}</b> intel drops</span>
          <span><b>{followUpCount}</b> follow-ups</span>
        </div>
      </div>

      <div className="rpg-map-stage">
        <button
          type="button"
          className={`rpg-commander-node ${selectedId === "commander" ? "selected" : ""}`}
          onClick={() => setSelectedId("commander")}
        >
          <span className="rpg-node-ring"></span>
          <span className="rpg-node-avatar">R</span>
          <span className="rpg-node-copy">
            <small>COMMANDER</small>
            <strong>Riven Orchestrator</strong>
            <em>{stateLabel(orchestratorState)}</em>
          </span>
        </button>

        <div className="rpg-squad-grid">
          {squad.map((agent, index) => {
            const kind = stateKind(agent.state);
            return (
              <button
                type="button"
                className={`rpg-squad-node ${kind} ${selectedId === agent.id ? "selected" : ""}`}
                style={{ "--unit-color": agent.color }}
                key={agent.id}
                onClick={() => setSelectedId(agent.id)}
              >
                <span className="rpg-unit-index">UNIT {String(index + 1).padStart(2, "0")}</span>
                <span className="rpg-unit-avatar">{index + 1}</span>
                <span className="rpg-unit-copy">
                  <strong>{agent.name}</strong>
                  <small>{agent.role}</small>
                </span>
                <span className={`rpg-unit-state ${kind}`}>{stateLabel(agent.state)}</span>
                <span className="rpg-unit-meter"><i style={{ width: `${progressFor(agent.state)}%` }}></i></span>
              </button>
            );
          })}

          {squad.length === 0 && <div className="rpg-empty-slot">No squad units registered yet.</div>}
          <div className="rpg-reserve-slot">
            <span>＋</span>
            <strong>Reserve Slot</strong>
            <small>Future agents auto-populate here</small>
          </div>
        </div>
      </div>

      <div className="rpg-inspector">
        <div className="rpg-inspector-avatar" style={{ "--unit-color": selected?.color || "#5eead4" }}>
          {selectedId === "commander" ? "R" : selected?.level || "?"}
        </div>
        <div className="rpg-inspector-copy">
          <span>{selected?.role || "Agent"}</span>
          <h3>{selected?.name || "Agent"}</h3>
          <p>{shortText(selected?.message, executing ? "Mission in progress…" : "Ready for deployment.", 170)}</p>
        </div>
        <div className={`rpg-inspector-status ${stateKind(selected?.state)}`}>
          <span></span>{stateLabel(selected?.state)}
        </div>
      </div>
    </section>
  );
}
