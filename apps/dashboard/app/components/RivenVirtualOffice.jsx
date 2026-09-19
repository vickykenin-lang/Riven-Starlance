"use client";

/*
 * Riven-specific SVG office adapted from the visual approach of
 * KbWen/agent-virtual-office (MIT, Copyright 2026 KbWen).
 * No upstream status server or hook collector is included: this component
 * receives only the already-sanitized state produced by Riven's dashboard.
 */

const AGENT_POSITIONS = [
  { x: 215, y: 310, color: "#f59e0b", shirt: "#f97316" },
  { x: 435, y: 310, color: "#a855f7", shirt: "#7c3aed" },
  { x: 655, y: 310, color: "#14b8a6", shirt: "#0f766e" },
  { x: 875, y: 310, color: "#ec4899", shirt: "#be185d" },
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

function shortText(value, fallback) {
  const clean = String(value || fallback).replace(/\s+/g, " ").trim();
  return clean.length > 46 ? `${clean.slice(0, 43)}…` : clean;
}

function PixelAgent({ name, role, state, message, x, y, color, shirt, reviewer = false }) {
  const kind = stateKind(state);
  const bubble = shortText(
    message,
    kind === "working" ? "Working through the evidence…" :
    kind === "complete" ? "My findings are ready." :
    kind === "blocked" ? "I need attention here." :
    reviewer ? "Ready to review the mission." : "Ready for research."
  );

  return (
    <g className={`virtual-agent is-${kind}`} transform={`translate(${x} ${y})`} role="img" aria-label={`${name}, ${role}, ${kind}`}>
      <g className="agent-bubble" transform="translate(-78 -126)">
        <rect width="156" height="49" rx="12" fill="#fffdf7" stroke="#473323" strokeWidth="3" />
        <path d="M70 47 L80 62 L91 47" fill="#fffdf7" stroke="#473323" strokeWidth="3" strokeLinejoin="round" />
        <text x="78" y="20" textAnchor="middle" className="bubble-title">{name}</text>
        <text x="78" y="36" textAnchor="middle" className="bubble-copy">{bubble}</text>
      </g>

      <g className="agent-sprite">
        <ellipse cx="0" cy="51" rx="35" ry="10" fill="#3b2a22" opacity=".24" />
        <rect x="-48" y="31" width="96" height="20" rx="4" fill="#6b4528" stroke="#3d291d" strokeWidth="4" />
        <rect x="-39" y="49" width="9" height="27" fill="#493122" />
        <rect x="30" y="49" width="9" height="27" fill="#493122" />
        <rect x="-27" y="19" width="54" height="23" rx="3" fill="#29394d" stroke="#172232" strokeWidth="4" />
        <rect x="-21" y="24" width="42" height="12" fill={kind === "blocked" ? "#fb7185" : kind === "complete" ? "#86efac" : "#7dd3fc"} />
        <rect x="-17" y="-32" width="34" height="39" rx="8" fill="#f0b982" stroke="#553726" strokeWidth="3" />
        <path d="M-18 -20 Q0 -45 19 -20 L17 -34 Q0 -48 -18 -33Z" fill={reviewer ? "#263a60" : color} />
        <circle cx="-7" cy="-14" r="2.4" fill="#2a1e19" />
        <circle cx="7" cy="-14" r="2.4" fill="#2a1e19" />
        <path d="M-6 -4 Q0 1 6 -4" fill="none" stroke="#8b4b3d" strokeWidth="2" />
        <path d="M-22 5 L22 5 L27 28 L-27 28Z" fill={shirt} stroke="#493026" strokeWidth="3" />
        {reviewer && <path d="M0 7 L8 16 L0 28 L-8 16Z" fill="#f8d568" />}
        <rect x="-32" y="9" width="9" height="24" rx="4" fill="#f0b982" className="typing-arm left-arm" />
        <rect x="23" y="9" width="9" height="24" rx="4" fill="#f0b982" className="typing-arm right-arm" />
      </g>

      <g transform="translate(-63 78)">
        <rect width="126" height="36" rx="9" fill="#172033" stroke={color} strokeWidth="3" />
        <circle cx="14" cy="12" r="5" className="state-light" />
        <text x="25" y="16" className="agent-name">{name}</text>
        <text x="14" y="29" className="agent-role">{role} · {kind}</text>
      </g>
    </g>
  );
}

function OfficeFurniture() {
  return (
    <>
      <g className="office-wall-art">
        {[92, 300, 508, 716, 924].map((x) => (
          <g key={x} transform={`translate(${x} 35)`}>
            <rect width="116" height="58" rx="3" fill="#8ed8ef" stroke="#654c37" strokeWidth="7" />
            <path d="M58 2V56M2 29H114" stroke="#d9f4fb" strokeWidth="4" opacity=".72" />
          </g>
        ))}
        <rect x="472" y="109" width="156" height="68" rx="5" fill="#8a6849" stroke="#513a2a" strokeWidth="7" />
        <rect x="487" y="124" width="25" height="19" fill="#f5d565" />
        <rect x="518" y="124" width="25" height="19" fill="#77c7d9" />
        <rect x="549" y="124" width="25" height="19" fill="#f08ca2" />
        <rect x="580" y="124" width="25" height="19" fill="#9dd68b" />
        <path d="M790 105V174M776 120H804" stroke="#69503a" strokeWidth="6" />
      </g>

      <g className="meeting-room">
        <rect x="866" y="110" width="203" height="142" rx="4" fill="#8b89a6" stroke="#5d5874" strokeWidth="7" />
        <rect x="897" y="149" width="142" height="68" rx="14" fill="#c9965b" stroke="#805f3f" strokeWidth="6" />
        {[908, 940, 972, 1004].map((x) => <circle key={x} cx={x} cy="136" r="8" fill="#5d5874" />)}
        {[908, 940, 972, 1004].map((x) => <circle key={x} cx={x} cy="230" r="8" fill="#5d5874" />)}
        <text x="968" y="127" textAnchor="middle" className="room-label">REVIEW ROOM</text>
      </g>

      <g className="lounge">
        <rect x="24" y="515" width="284" height="112" fill="#91aa88" stroke="#587052" strokeWidth="7" />
        <rect x="52" y="551" width="126" height="43" rx="5" fill="#bc7953" stroke="#77503b" strokeWidth="6" />
        <circle cx="231" cy="571" r="34" fill="#c89455" stroke="#805c3c" strokeWidth="6" />
        <text x="53" y="540" className="room-label">EVIDENCE LOUNGE</text>
      </g>

      <g className="library">
        <rect x="769" y="515" width="307" height="112" fill="#8d89a5" stroke="#5d5874" strokeWidth="7" />
        {[795, 872, 949].map((x, i) => (
          <g key={x}>
            <rect x={x} y="539" width="56" height="67" fill="#6e4f3b" stroke="#453329" strokeWidth="5" />
            {[0,1,2,3].map((book) => <rect key={book} x={x + 7 + book * 11} y="548" width="8" height={44 - (book % 2) * 8} fill={["#e35d6a","#f1bd55","#4db6ac","#5b8bd9"][(book+i)%4]} />)}
          </g>
        ))}
        <text x="790" y="531" className="room-label">RESEARCH LIBRARY</text>
      </g>
    </>
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
  const normalized = AGENT_POSITIONS.map((position, index) => ({
    ...position,
    name: `R${index + 1}`,
    role: agents[index]?.title || `Researcher ${index + 1}`,
    state: agents[index]?.state || "ready",
    message: agents[index]?.message || "",
  }));

  return (
    <section className="riven-virtual-office panel" aria-labelledby="virtual-office-title">
      <div className="section-head office-heading">
        <div>
          <p className="eyebrow">LIVE AGENT FLOOR</p>
          <h2 id="virtual-office-title">Riven Research Office</h2>
        </div>
        <div className="office-metrics" aria-label="Live office metrics">
          <span className={executing ? "office-now active" : "office-now"}>{executing ? "● Mission active" : "○ Standing by"}</span>
          <span>{sourceCount} sources</span>
          <span>{followUpCount} follow-ups</span>
        </div>
      </div>

      <div className="office-frame">
        <svg viewBox="0 0 1100 650" role="img" aria-label="Live pixel office showing Riven and four research agents">
          <defs>
            <pattern id="floor-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <rect width="24" height="24" fill="#caa36d" />
              <path d="M24 0H0V24" fill="none" stroke="#b58b58" strokeWidth="1.2" opacity=".72" />
              <path d="M0 12H24M12 0V24" stroke="#d7b77f" strokeWidth=".7" opacity=".35" />
            </pattern>
            <filter id="office-shadow" x="-20%" y="-20%" width="140%" height="160%">
              <feDropShadow dx="0" dy="5" stdDeviation="3" floodColor="#2c1d17" floodOpacity=".32" />
            </filter>
          </defs>

          <rect x="10" y="10" width="1080" height="630" rx="8" fill="url(#floor-grid)" stroke="#3b291f" strokeWidth="12" />
          <rect x="16" y="16" width="1068" height="188" fill="#d9c9a8" />
          <path d="M16 204H1084" stroke="#594231" strokeWidth="12" />
          <OfficeFurniture />

          <g filter="url(#office-shadow)">
            <PixelAgent
              name="Riven"
              role="Chief reviewer"
              state={orchestratorState}
              message={orchestratorMessage}
              x={550}
              y={188}
              color="#38bdf8"
              shirt="#2563a8"
              reviewer
            />
            {normalized.map((agent) => <PixelAgent key={agent.name} {...agent} />)}
          </g>

          <g transform="translate(350 544)">
            <rect width="350" height="70" rx="9" fill="#eef4de" stroke="#667453" strokeWidth="6" />
            <text x="175" y="25" textAnchor="middle" className="board-title">MISSION BOARD</text>
            <text x="175" y="49" textAnchor="middle" className="board-copy">
              {executing ? "Research in progress · live evidence telemetry" : "Submit a mission to bring the office to life"}
            </text>
          </g>
        </svg>
      </div>

      <p className="office-attribution">
        Visual approach adapted from <a href="https://github.com/KbWen/agent-virtual-office" target="_blank" rel="noreferrer">Agent Virtual Office</a> (MIT).
      </p>
    </section>
  );
}
