"use client";

import { useState } from "react";

/*
 * Riven-specific SVG office adapted from the visual approach of
 * KbWen/agent-virtual-office (MIT, Copyright 2026 KbWen).
 * No upstream status server or hook collector is included: this component
 * receives only the already-sanitized state produced by Riven's dashboard.
 */

const AGENT_POSITIONS = [
  { id: "r1", x: 205, y: 340, color: "#f59e0b", shirt: "#f97316" },
  { id: "r2", x: 410, y: 340, color: "#a855f7", shirt: "#7c3aed" },
  { id: "r3", x: 635, y: 340, color: "#14b8a6", shirt: "#0f766e" },
  { id: "r4", x: 840, y: 340, color: "#ec4899", shirt: "#be185d" },
];

function stateKind(value) {
  const state = String(value || "ready").toLowerCase();
  if (state.includes("fail") || state.includes("error") || state.includes("block")) return "blocked";
  if (state.includes("complete") || state.includes("submitted") || state.includes("parsed")) return "complete";
  if (
    state.includes("research") ||
    state.includes("source") ||
    state.includes("verify") ||
    state.includes("review") ||
    state.includes("plan") ||
    state.includes("follow") ||
    state.includes("execut")
  ) return "working";
  return "idle";
}

function shortText(value, fallback, limit = 52) {
  const clean = String(value || fallback).replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

function stateLabel(kind) {
  return kind === "idle" ? "Ready" : kind[0].toUpperCase() + kind.slice(1);
}

function PixelAgent({ agent, selected, onSelect, reviewer = false }) {
  const { id, name, role, state, message, x, y, color, shirt } = agent;
  const kind = stateKind(state);
  const showBubble = selected || kind === "working" || kind === "blocked";
  const bubble = shortText(
    message,
    kind === "working" ? "Working through the evidence…" :
    kind === "complete" ? "My findings are ready." :
    kind === "blocked" ? "I need attention here." :
    reviewer ? "Ready to review the mission." : "Ready for research."
  );

  function selectFromKeyboard(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(id);
    }
  }

  return (
    <g
      className={`virtual-agent is-${kind} ${selected ? "is-selected" : ""}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex="0"
      aria-label={`${name}, ${role}, ${kind}. Select for details.`}
      aria-pressed={selected}
      onClick={() => onSelect(id)}
      onKeyDown={selectFromKeyboard}
    >
      <circle className="selection-ring" cx="0" cy="13" r="58" fill="none" stroke={color} strokeWidth="4" strokeDasharray="7 7" />

      {showBubble && (
        <g className="agent-bubble" transform="translate(-84 -137)">
          <rect width="168" height="53" rx="12" fill="#fffdf7" stroke="#473323" strokeWidth="3" />
          <path d="M75 51 L84 65 L94 51" fill="#fffdf7" stroke="#473323" strokeWidth="3" strokeLinejoin="round" />
          <text x="84" y="20" textAnchor="middle" className="bubble-title">{name}</text>
          <text x="84" y="38" textAnchor="middle" className="bubble-copy">{bubble}</text>
        </g>
      )}

      <g className="agent-sprite">
        <ellipse cx="0" cy="53" rx="37" ry="10" fill="#3b2a22" opacity=".24" />
        <rect x="-53" y="32" width="106" height="21" rx="4" fill="#765039" stroke="#3d291d" strokeWidth="4" />
        <rect x="-43" y="50" width="9" height="27" fill="#493122" />
        <rect x="34" y="50" width="9" height="27" fill="#493122" />
        <path d="M-24 64H24L19 82H-19Z" fill="#60412f" stroke="#3d291d" strokeWidth="3" />
        <rect x="-29" y="17" width="58" height="26" rx="3" fill="#29394d" stroke="#172232" strokeWidth="4" />
        <rect x="-23" y="22" width="46" height="14" fill={kind === "blocked" ? "#fb7185" : kind === "complete" ? "#86efac" : "#7dd3fc"} />
        <path d="M-16 25H7M-16 30H16" stroke="#e7f8ff" strokeWidth="2" opacity=".8" />
        <rect x="-18" y="-34" width="36" height="40" rx="9" fill="#f0b982" stroke="#553726" strokeWidth="3" />
        <path d="M-19 -21 Q0 -47 20 -21 L18 -35 Q0 -49 -19 -34Z" fill={reviewer ? "#263a60" : color} />
        <circle cx="-7" cy="-15" r="2.5" fill="#2a1e19" />
        <circle cx="7" cy="-15" r="2.5" fill="#2a1e19" />
        <path d="M-6 -5 Q0 1 6 -5" fill="none" stroke="#8b4b3d" strokeWidth="2" />
        <path d="M-23 4 L23 4 L28 29 L-28 29Z" fill={shirt} stroke="#493026" strokeWidth="3" />
        {reviewer && <path d="M0 6 L8 16 L0 29 L-8 16Z" fill="#f8d568" />}
        <rect x="-34" y="9" width="10" height="25" rx="4" fill="#f0b982" className="typing-arm left-arm" />
        <rect x="24" y="9" width="10" height="25" rx="4" fill="#f0b982" className="typing-arm right-arm" />
      </g>

      <g className="agent-plate" transform="translate(-67 84)">
        <rect width="134" height="39" rx="9" fill="#172033" stroke={color} strokeWidth="3" />
        <circle cx="14" cy="13" r="5" className="state-light" />
        <text x="26" y="17" className="agent-name">{name}</text>
        <text x="14" y="31" className="agent-role">{shortText(role, "Researcher", 20)} · {kind}</text>
      </g>
    </g>
  );
}

function OfficeFurniture() {
  return (
    <>
      <g className="office-wall-art">
        {[72, 268, 464, 660, 856].map((x) => (
          <g key={x} transform={`translate(${x} 28)`}>
            <rect width="112" height="54" rx="3" fill="#8ed8ef" stroke="#654c37" strokeWidth="7" />
            <path d="M56 2V52M2 27H110" stroke="#d9f4fb" strokeWidth="4" opacity=".72" />
          </g>
        ))}
        <rect x="448" y="96" width="150" height="64" rx="5" fill="#8a6849" stroke="#513a2a" strokeWidth="7" />
        <rect x="463" y="111" width="25" height="19" fill="#f5d565" />
        <rect x="494" y="111" width="25" height="19" fill="#77c7d9" />
        <rect x="525" y="111" width="25" height="19" fill="#f08ca2" />
        <rect x="556" y="111" width="25" height="19" fill="#9dd68b" />
        <text x="523" y="150" textAnchor="middle" className="tiny-label">REVIEW QUEUE</text>
      </g>

      <g className="review-room">
        <rect x="878" y="96" width="190" height="145" rx="4" fill="#8b89a6" stroke="#5d5874" strokeWidth="7" />
        <rect x="905" y="139" width="136" height="67" rx="14" fill="#c9965b" stroke="#805f3f" strokeWidth="6" />
        {[916, 946, 976, 1006].map((x) => <circle key={x} cx={x} cy="126" r="7" fill="#5d5874" />)}
        {[916, 946, 976, 1006].map((x) => <circle key={x} cx={x} cy="219" r="7" fill="#5d5874" />)}
        <text x="973" y="116" textAnchor="middle" className="room-label">REVIEW ROOM</text>
      </g>

      <g className="office-details">
        <g transform="translate(27 98)">
          <rect width="118" height="69" rx="4" fill="#9aad85" stroke="#5f7050" strokeWidth="6" />
          <rect x="16" y="19" width="26" height="34" fill="#dbe9c5" stroke="#697b57" strokeWidth="3" />
          <rect x="51" y="19" width="50" height="9" fill="#dbe9c5" />
          <rect x="51" y="36" width="38" height="7" fill="#dbe9c5" />
          <text x="59" y="13" textAnchor="middle" className="tiny-label">MISSION MAP</text>
        </g>
        <g transform="translate(720 96)">
          <rect width="108" height="77" rx="4" fill="#cab989" stroke="#796a48" strokeWidth="6" />
          <rect x="15" y="20" width="23" height="40" fill="#4d6d58" />
          <circle cx="26" cy="19" r="14" fill="#4f9a5c" />
          <rect x="55" y="23" width="37" height="30" rx="3" fill="#554737" />
          <circle cx="73" cy="38" r="10" fill="#d9d2b4" />
          <text x="54" y="13" textAnchor="middle" className="tiny-label">COFFEE</text>
        </g>
        <path d="M75 199H1028" stroke="#8e6f49" strokeWidth="3" strokeDasharray="10 11" opacity=".55" />
      </g>

      <g className="work-area-details">
        {[205,410,635,840].map((x) => (
          <g key={x} transform={`translate(${x - 76} 257)`}>
            <rect width="152" height="14" rx="4" fill="#98704b" opacity=".52" />
            <rect x="6" y="18" width="140" height="84" rx="5" fill="none" stroke="#a07951" strokeWidth="3" strokeDasharray="6 5" opacity=".46" />
          </g>
        ))}
        <text x="523" y="245" textAnchor="middle" className="zone-label">RESEARCH FLOOR</text>
      </g>

      <g className="lounge">
        <rect x="24" y="512" width="277" height="116" fill="#91aa88" stroke="#587052" strokeWidth="7" />
        <rect x="49" y="550" width="121" height="44" rx="5" fill="#bc7953" stroke="#77503b" strokeWidth="6" />
        <circle cx="224" cy="573" r="33" fill="#c89455" stroke="#805c3c" strokeWidth="6" />
        <circle cx="269" cy="539" r="13" fill="#4f9a5c" />
        <rect x="264" y="546" width="10" height="22" fill="#765039" />
        <text x="49" y="540" className="room-label">EVIDENCE LOUNGE</text>
      </g>

      <g className="operations">
        <rect x="315" y="512" width="179" height="116" fill="#9caaad" stroke="#5f7075" strokeWidth="7" />
        <rect x="339" y="548" width="54" height="57" rx="4" fill="#263548" stroke="#172232" strokeWidth="5" />
        {[558,571,584].map((y, i) => <circle key={y} cx="351" cy={y} r="3.5" fill={["#4ade80","#7dd3fc","#facc15"][i]} />)}
        <path d="M404 560H470M404 575H458M404 590H466" stroke="#d7e5e8" strokeWidth="5" opacity=".8" />
        <text x="339" y="539" className="room-label">OPERATIONS</text>
      </g>

      <g className="library">
        <rect x="754" y="512" width="322" height="116" fill="#8d89a5" stroke="#5d5874" strokeWidth="7" />
        {[781, 859, 937, 1015].map((x, i) => (
          <g key={x}>
            <rect x={x} y="542" width="54" height="64" fill="#6e4f3b" stroke="#453329" strokeWidth="5" />
            {[0,1,2,3].map((book) => <rect key={book} x={x + 6 + book * 11} y="551" width="8" height={42 - (book % 2) * 8} fill={["#e35d6a","#f1bd55","#4db6ac","#5b8bd9"][(book+i)%4]} />)}
          </g>
        ))}
        <text x="779" y="535" className="room-label">RESEARCH LIBRARY</text>
      </g>

      <g className="ambient-workers" opacity=".65">
        <path d="M690 550h34v24h-34z" fill="#d9d2b4" stroke="#667453" strokeWidth="4" />
        <path d="M702 542v-15h10v15" fill="none" stroke="#667453" strokeWidth="4" />
        <circle cx="707" cy="526" r="6" fill="#efc16f" className="coffee-steam" />
      </g>
    </>
  );
}

function RosterItem({ agent, selected, onSelect, reviewer = false }) {
  const kind = stateKind(agent.state);
  return (
    <button
      type="button"
      className={`office-roster-item ${selected ? "selected" : ""}`}
      onClick={() => onSelect(agent.id)}
      aria-pressed={selected}
    >
      <span className="roster-avatar" style={{ "--agent-color": agent.color }}>{reviewer ? "R" : agent.name}</span>
      <span className="roster-copy">
        <strong>{agent.name}</strong>
        <small>{shortText(agent.role, "Researcher", 27)}</small>
      </span>
      <i className={`roster-status ${kind}`} title={stateLabel(kind)}></i>
    </button>
  );
}

export default function RivenVirtualOffice({
  agents = [],
  orchestratorState = "ready",
  orchestratorMessage = "",
  executing = false,
  sourceCount = 0,
  followUpCount = 0,
}) {
  const [selectedId, setSelectedId] = useState("riven");

  const riven = {
    id: "riven",
    name: "Riven",
    role: "Chief reviewer",
    state: orchestratorState,
    message: orchestratorMessage,
    x: 523,
    y: 182,
    color: "#38bdf8",
    shirt: "#2563a8",
  };

  const researchers = AGENT_POSITIONS.map((position, index) => ({
    ...position,
    name: `R${index + 1}`,
    role: agents[index]?.title || `Researcher ${index + 1}`,
    state: agents[index]?.state || "ready",
    message: agents[index]?.message || "",
  }));
  const roster = [riven, ...researchers];
  const selected = roster.find((agent) => agent.id === selectedId) || riven;
  const selectedKind = stateKind(selected.state);

  return (
    <section className="riven-virtual-office panel" aria-labelledby="virtual-office-title">
      <div className="section-head office-heading">
        <div>
          <p className="eyebrow">LIVE AGENT FLOOR</p>
          <h2 id="virtual-office-title">Riven Research Office</h2>
          <p className="office-subtitle">Select an agent or workstation to inspect real activity.</p>
        </div>
        <div className="office-metrics" aria-label="Live office metrics">
          <span className={executing ? "office-now active" : "office-now"}>{executing ? "● Mission active" : "○ Standing by"}</span>
          <span>{sourceCount} sources</span>
          <span>{followUpCount} follow-ups</span>
        </div>
      </div>

      <div className="office-shell">
        <div className="office-frame">
          <svg viewBox="0 0 1100 650" role="img" aria-label="Interactive pixel office showing Riven and four research agents">
            <defs>
              <pattern id="floor-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <rect width="24" height="24" fill="#caa36d" />
                <path d="M24 0H0V24" fill="none" stroke="#b58b58" strokeWidth="1.2" opacity=".72" />
                <path d="M0 12H24M12 0V24" stroke="#d7b77f" strokeWidth=".7" opacity=".35" />
              </pattern>
              <filter id="office-shadow" x="-25%" y="-25%" width="150%" height="170%">
                <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#2c1d17" floodOpacity=".32" />
              </filter>
            </defs>

            <rect x="10" y="10" width="1080" height="630" rx="8" fill="url(#floor-grid)" stroke="#3b291f" strokeWidth="12" />
            <rect x="16" y="16" width="1068" height="185" fill="#d9c9a8" />
            <path d="M16 201H1084" stroke="#594231" strokeWidth="12" />
            <OfficeFurniture />

            <g filter="url(#office-shadow)">
              <PixelAgent agent={riven} reviewer selected={selectedId === riven.id} onSelect={setSelectedId} />
              {researchers.map((agent) => (
                <PixelAgent key={agent.id} agent={agent} selected={selectedId === agent.id} onSelect={setSelectedId} />
              ))}
            </g>

            <g transform="translate(507 523)">
              <rect width="230" height="86" rx="9" fill="#eef4de" stroke="#667453" strokeWidth="6" />
              <text x="115" y="27" textAnchor="middle" className="board-title">MISSION BOARD</text>
              <text x="115" y="50" textAnchor="middle" className="board-copy">{executing ? "LIVE RESEARCH" : "AWAITING MISSION"}</text>
              <text x="115" y="68" textAnchor="middle" className="board-copy">{sourceCount} sources · {followUpCount} follow-ups</text>
            </g>
          </svg>
        </div>

        <aside className="office-console" aria-label="Agent inspector">
          <div className="console-header">
            <span>OFFICE ROSTER</span>
            <b>{executing ? "LIVE" : "READY"}</b>
          </div>
          <div className="office-roster">
            <RosterItem agent={riven} reviewer selected={selectedId === riven.id} onSelect={setSelectedId} />
            {researchers.map((agent) => (
              <RosterItem key={agent.id} agent={agent} selected={selectedId === agent.id} onSelect={setSelectedId} />
            ))}
          </div>
          <div className={`agent-inspector ${selectedKind}`}>
            <div className="inspector-top">
              <span className="inspector-avatar" style={{ "--agent-color": selected.color }}>{selected.id === "riven" ? "R" : selected.name}</span>
              <div><small>SELECTED AGENT</small><strong>{selected.name}</strong></div>
            </div>
            <dl>
              <div><dt>Role</dt><dd>{selected.role}</dd></div>
              <div><dt>Status</dt><dd><i></i>{stateLabel(selectedKind)}</dd></div>
              <div><dt>Current action</dt><dd>{shortText(selected.message, selectedKind === "idle" ? "Waiting for the next mission." : "Processing live run telemetry.", 100)}</dd></div>
            </dl>
          </div>
          <div className="office-legend">
            <span><i className="idle"></i>Ready</span>
            <span><i className="working"></i>Working</span>
            <span><i className="complete"></i>Done</span>
            <span><i className="blocked"></i>Blocked</span>
          </div>
        </aside>
      </div>

      <p className="office-attribution">
        Visual approach adapted from <a href="https://github.com/KbWen/agent-virtual-office" target="_blank" rel="noreferrer">Agent Virtual Office</a> (MIT).
      </p>
    </section>
  );
}
