"use client";

import { useEffect, useMemo, useRef } from "react";

const ACCENT = {
  cyan: "#35e8ff",
  violet: "#a76cff",
  amber: "#ffb84d",
  emerald: "#4fffb2",
  rose: "#ff6c9e",
  blue: "#5f8fff",
  lime: "#aef45b",
  fuchsia: "#ee64ff",
  orange: "#ff8a45",
  teal: "#3fe3cb",
  indigo: "#7a76ff",
  sky: "#53c8ff",
  green: "#61e58e",
  purple: "#9c67ff",
  red: "#ff5f6f",
};

const POSITIONS = [
  { x: 205, y: 278, scale: 0.72 },
  { x: 430, y: 250, scale: 0.72 },
  { x: 650, y: 238, scale: 0.72 },
  { x: 950, y: 238, scale: 0.72 },
  { x: 1170, y: 250, scale: 0.72 },
  { x: 1395, y: 278, scale: 0.72 },
  { x: 125, y: 505, scale: 0.86 },
  { x: 370, y: 490, scale: 0.86 },
  { x: 1230, y: 490, scale: 0.86 },
  { x: 1475, y: 505, scale: 0.86 },
  { x: 245, y: 760, scale: 1 },
  { x: 525, y: 725, scale: 1 },
  { x: 800, y: 770, scale: 1.04 },
  { x: 1075, y: 725, scale: 1 },
  { x: 1355, y: 760, scale: 1 },
];

function trim(text, max = 26) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function screenMode(station, index) {
  const role = String(station.role || "").toLowerCase();
  if (role.includes("code")) return "code";
  if (role.includes("security")) return "security";
  if (role.includes("memory")) return "memory";
  if (role.includes("vision") || role.includes("creative")) return "vision";
  if (role.includes("analytics") || role.includes("simulation")) return "analytics";
  if (role.includes("plan") || role.includes("strategy") || role.includes("operations")) return "plan";
  return ["search", "sources", "compare", "evidence"][index % 4];
}

function LiveScreen({ station, index, accent }) {
  const mode = screenMode(station, index);
  const live = station.kind === "working";
  const muted = station.reserve;
  const progress = Math.max(0, Math.min(100, station.progress || 0));

  return (
    <g className={`room2d-screen-content ${live ? "is-live" : ""} ${muted ? "is-muted" : ""}`}>
      <rect x="-78" y="-26" width="156" height="82" rx="7" fill="#03101e" stroke={accent} strokeOpacity={muted ? 0.2 : 0.7} />
      <rect x="-72" y="-20" width="144" height="12" rx="3" fill={accent} opacity={muted ? 0.05 : 0.12} />
      <circle cx="-65" cy="-14" r="2.5" fill={muted ? "#425267" : accent} />
      <text x="-58" y="-11" className="room2d-screen-title">{muted ? "STATION OFFLINE" : live ? "LIVE WORKSPACE" : "READY"}</text>

      {mode === "code" && (
        <g className="room2d-code-lines">
          {[0, 1, 2, 3].map((row) => <rect key={row} x="-66" y={2 + row * 10} width={[98, 72, 112, 86][row]} height="4" rx="2" fill={row === 0 ? accent : "#557389"} opacity={muted ? 0.18 : 0.76} />)}
        </g>
      )}

      {mode === "security" && (
        <g transform="translate(-38 22)">
          <circle r="22" fill="none" stroke={accent} strokeOpacity={muted ? 0.12 : 0.6} />
          <circle r="13" fill="none" stroke={accent} strokeOpacity={muted ? 0.08 : 0.35} />
          <path d="M-22 0H22M0-22V22" stroke={accent} strokeOpacity=".25" />
          <path d="M0 0L17 -9" stroke={accent} strokeWidth="2" className="room2d-radar" />
          <circle cx="20" cy="-2" r="2.5" fill="#ff667f" opacity={muted ? 0.15 : 1} />
        </g>
      )}

      {mode === "memory" && (
        <g stroke={accent} fill={accent} strokeOpacity={muted ? 0.12 : 0.45} fillOpacity={muted ? 0.12 : 0.8}>
          <path d="M-60 35L-35 8L-2 28L30 3L60 30" fill="none" strokeWidth="1.5" />
          {[[-60, 35], [-35, 8], [-2, 28], [30, 3], [60, 30]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />)}
        </g>
      )}

      {mode === "vision" && (
        <g>
          {[[-66, 2], [-24, 2], [18, 2], [-66, 27], [-24, 27], [18, 27]].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="34" height="19" rx="3" fill={i % 2 ? "#713cff" : accent} opacity={muted ? 0.08 : 0.38 + i * 0.04} />
          ))}
        </g>
      )}

      {mode === "analytics" && (
        <g fill="none" stroke={accent} strokeOpacity={muted ? 0.12 : 0.75} strokeWidth="2">
          <path d="M-66 40L-46 26L-28 31L-7 13L10 19L30 2L51 12L66 -2" />
          <path d="M-66 44H66" opacity=".2" />
        </g>
      )}

      {mode === "plan" && (
        <g>
          {[0.92, 0.63, 0.78, 0.49].map((v, i) => <g key={i}><rect x="-66" y={2 + i * 11} width="132" height="5" rx="2" fill="#173048" /><rect x="-66" y={2 + i * 11} width={132 * v} height="5" rx="2" fill={accent} opacity={muted ? 0.12 : 0.72} /></g>)}
        </g>
      )}

      {mode === "search" && (
        <g>
          {[0, 1, 2].map((row) => <g key={row}><circle cx="-60" cy={7 + row * 15} r="3" fill={accent} opacity={muted ? 0.12 : 0.8} /><rect x="-51" y={4 + row * 15} width={94 - row * 12} height="5" rx="2" fill="#75a1b8" opacity={muted ? 0.08 : 0.55} /><rect x="-51" y={11 + row * 15} width={66 + row * 8} height="3" rx="2" fill="#33566a" /></g>)}
        </g>
      )}

      {mode === "sources" && (
        <g stroke={accent} strokeOpacity={muted ? 0.1 : 0.48} fill={accent} fillOpacity={muted ? 0.08 : 0.7}>
          <path d="M-55 34L-22 7L8 35L40 8L62 30" fill="none" />
          {[[-55, 34], [-22, 7], [8, 35], [40, 8], [62, 30]].map(([x, y]) => <rect key={`${x}-${y}`} x={x - 4} y={y - 4} width="8" height="8" rx="2" />)}
        </g>
      )}

      {mode === "compare" && (
        <g>
          <rect x="-66" y="2" width="59" height="41" rx="4" fill="#102237" stroke={accent} strokeOpacity=".25" />
          <rect x="7" y="2" width="59" height="41" rx="4" fill="#102237" stroke="#a76cff" strokeOpacity=".35" />
          {[0, 1, 2].map((row) => <g key={row}><rect x="-59" y={9 + row * 10} width={35 + row * 5} height="4" fill={accent} opacity={muted ? 0.08 : 0.45} /><rect x="14" y={9 + row * 10} width={42 - row * 4} height="4" fill="#a76cff" opacity={muted ? 0.08 : 0.48} /></g>)}
        </g>
      )}

      {mode === "evidence" && (
        <g>
          {[22, 38, 31, 47, 29, 55, 44].map((height, i) => <rect key={i} x={-64 + i * 18} y={45 - height * 0.7} width="10" height={height * 0.7} rx="2" fill={i % 2 ? "#41647d" : accent} opacity={muted ? 0.08 : 0.7} />)}
        </g>
      )}

      <rect x="-67" y="48" width="134" height="3" rx="2" fill="#162d40" />
      <rect x="-67" y="48" width={134 * progress / 100} height="3" rx="2" fill={accent} opacity={muted ? 0.12 : 0.9} />
    </g>
  );
}

function Operator({ station, accent, index }) {
  if (station.reserve) {
    return (
      <g className="room2d-operator reserve" transform="translate(0 98)">
        <ellipse cx="0" cy="14" rx="18" ry="7" fill="#030811" />
        <circle cx="0" cy="-22" r="9" fill="#152437" stroke="#355068" />
        <path d="M-14 -11Q0 -20 14 -11L19 22H-19Z" fill="#0c1724" stroke="#263b4d" />
      </g>
    );
  }

  return (
    <g className={`room2d-operator ${station.kind === "working" ? "working" : ""}`} transform="translate(0 98)" style={{ animationDelay: `${index * 80}ms` }}>
      <ellipse cx="0" cy="22" rx="24" ry="8" fill="#020710" opacity=".8" />
      <path d="M-24 6Q0 -10 24 6L19 33H-19Z" fill="#0e1e31" stroke={accent} strokeOpacity=".45" />
      <circle cx="0" cy="-17" r="11" fill="#b8d5e3" stroke={accent} strokeOpacity=".65" />
      <path d="M-16 -1L-34 -18M16 -1L34 -18" stroke="#7a96a8" strokeWidth="7" strokeLinecap="round" className="room2d-arm" />
      <rect x="-8" y="-23" width="16" height="4" rx="2" fill={accent} opacity=".85" />
    </g>
  );
}

function Workstation({ station, index, position, selected, onSelect }) {
  const accent = ACCENT[station.accent] || ACCENT.cyan;
  const live = station.kind === "working";
  const status = station.reserve ? "OPEN" : station.kind === "complete" ? "DONE" : live ? "LIVE" : station.kind === "failed" ? "ALERT" : "READY";

  const choose = () => onSelect?.(station.id);
  return (
    <g
      className={`room2d-station ${station.reserve ? "reserve" : ""} ${live ? "working" : ""} ${selected ? "selected" : ""}`}
      transform={`translate(${position.x} ${position.y}) scale(${position.scale})`}
      onClick={choose}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") choose(); }}
      role="button"
      tabIndex="0"
      aria-label={`${station.name} ${status}`}
      style={{ "--station-accent": accent }}
    >
      {selected && <ellipse cx="0" cy="76" rx="126" ry="76" fill="none" stroke={accent} strokeOpacity=".62" strokeWidth="2" strokeDasharray="10 8" className="room2d-selected-ring" />}
      <path d="M-105 55L105 55L83 116L-83 116Z" fill="url(#deskTop)" stroke={accent} strokeOpacity={station.reserve ? 0.12 : 0.32} />
      <path d="M-83 116L83 116L70 132L-70 132Z" fill="#050b14" />
      <path d="M-85 116L-69 116L-78 166L-93 166Z" fill="#081321" />
      <path d="M69 116L85 116L93 166L78 166Z" fill="#081321" />
      <Operator station={station} accent={accent} index={index} />
      <g transform="translate(0 1)">
        <path d="M-90 -38L90 -38L82 64L-82 64Z" fill="#040b14" stroke={accent} strokeOpacity={station.reserve ? 0.18 : 0.58} strokeWidth="2" />
        <LiveScreen station={station} index={index} accent={accent} />
        <path d="M-12 64H12L18 82H-18Z" fill="#0c1b2a" stroke={accent} strokeOpacity=".28" />
      </g>
      <g transform="translate(0 -66)">
        <rect x="-82" y="-13" width="164" height="26" rx="13" fill="#04101e" stroke={accent} strokeOpacity={station.reserve ? 0.2 : 0.7} />
        <circle cx="-67" cy="0" r="4" fill={station.kind === "failed" ? "#ff667f" : station.reserve ? "#34485a" : accent} className={live ? "room2d-status-pulse" : ""} />
        <text x="-57" y="4" className="room2d-badge-name">{trim(station.name, 23)}</text>
        <text x="69" y="4" textAnchor="end" className="room2d-badge-state">{status}</text>
      </g>
      {!station.reserve && <text x="0" y="153" textAnchor="middle" className="room2d-station-foot">{trim(station.message || station.objective || station.role, 34)}</text>}
    </g>
  );
}

function DataLinks({ stations }) {
  return (
    <g className="room2d-links">
      {stations.map((station, index) => {
        if (station.reserve) return null;
        const p = POSITIONS[index];
        const endX = p.x;
        const endY = p.y + 18;
        const controlY = Math.min(640, (endY + 490) / 2);
        const accent = ACCENT[station.accent] || ACCENT.cyan;
        return (
          <path
            key={station.id}
            d={`M800 500 Q${(800 + endX) / 2} ${controlY} ${endX} ${endY}`}
            fill="none"
            stroke={accent}
            strokeWidth={station.kind === "working" ? 2 : 1}
            strokeOpacity={station.kind === "working" ? 0.48 : 0.12}
            strokeDasharray={station.kind === "working" ? "8 12" : "3 12"}
            className={station.kind === "working" ? "room2d-live-link" : ""}
          />
        );
      })}
    </g>
  );
}

function RivenCore({ active }) {
  return (
    <g className={`room2d-riven ${active ? "active" : ""}`} transform="translate(800 474)">
      <ellipse cx="0" cy="54" rx="120" ry="42" fill="url(#platformGlow)" stroke="#35e8ff" strokeOpacity=".48" />
      <ellipse cx="0" cy="54" rx="92" ry="29" fill="#06182a" stroke="#a76cff" strokeOpacity=".34" />
      <ellipse cx="0" cy="54" rx="148" ry="58" fill="none" stroke="#35e8ff" strokeOpacity=".18" strokeDasharray="8 12" className="room2d-orbit one" />
      <ellipse cx="0" cy="54" rx="174" ry="70" fill="none" stroke="#a76cff" strokeOpacity=".16" strokeDasharray="4 16" className="room2d-orbit two" />
      <g className="room2d-hologram">
        <path d="M0 -105C-25 -105 -40 -86 -37 -61C-34 -40 -21 -28 -14 -21L-32 28L-18 75L0 58L18 75L32 28L14 -21C21 -28 34 -40 37 -61C40 -86 25 -105 0 -105Z" fill="url(#rivenBody)" stroke="#8cecff" strokeOpacity=".75" />
        <circle cx="0" cy="-122" r="20" fill="url(#rivenHead)" stroke="#c9f8ff" strokeOpacity=".8" />
        <path d="M-17 -24L-70 12M17 -24L70 12" stroke="#6eeaff" strokeWidth="9" strokeLinecap="round" opacity=".68" />
        <path d="M-3 -125H10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      </g>
      <circle cx="0" cy="-50" r="86" fill="none" stroke="#35e8ff" strokeOpacity=".2" strokeDasharray="5 9" className="room2d-orbit three" />
      <circle cx="0" cy="-50" r="112" fill="none" stroke="#a76cff" strokeOpacity=".16" strokeDasharray="3 12" className="room2d-orbit four" />
      <g transform="translate(0 -186)">
        <rect x="-132" y="-16" width="264" height="32" rx="16" fill="#03101d" stroke="#35e8ff" strokeOpacity=".55" />
        <circle cx="-112" cy="0" r="4" fill="#4fffb2" className={active ? "room2d-status-pulse" : ""} />
        <text x="-99" y="4" className="room2d-riven-label">RIVEN // MAIN ORCHESTRATOR</text>
      </g>
    </g>
  );
}

export default function RivenCommandRoom2D({ stations = [], orchestratorActive = false, selectedId, onSelect }) {
  const viewportRef = useRef(null);
  const placed = useMemo(() => stations.slice(0, 15), [stations]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const id = requestAnimationFrame(() => {
      if (node.scrollWidth > node.clientWidth) node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2;
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="room2d-viewport" ref={viewportRef}>
      <div className="room2d-world-wrap">
        <svg className="room2d-world" viewBox="0 0 1600 960" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Riven live multi-agent RPG command room">
          <defs>
            <linearGradient id="wallBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#07162d" /><stop offset="1" stopColor="#020813" /></linearGradient>
            <linearGradient id="floorBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#071426" /><stop offset="1" stopColor="#01040b" /></linearGradient>
            <linearGradient id="deskTop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0b233a" /><stop offset="1" stopColor="#040b15" /></linearGradient>
            <radialGradient id="platformGlow"><stop offset="0" stopColor="#27d8ff" stopOpacity=".34" /><stop offset=".52" stopColor="#0b3d68" stopOpacity=".42" /><stop offset="1" stopColor="#020812" stopOpacity=".88" /></radialGradient>
            <linearGradient id="rivenBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#bff7ff" stopOpacity=".9" /><stop offset=".48" stopColor="#35e8ff" stopOpacity=".55" /><stop offset="1" stopColor="#7868ff" stopOpacity=".35" /></linearGradient>
            <radialGradient id="rivenHead"><stop offset="0" stopColor="#ffffff" /><stop offset=".35" stopColor="#75eaff" /><stop offset="1" stopColor="#2175d7" stopOpacity=".3" /></radialGradient>
            <pattern id="floorGrid" width="56" height="56" patternUnits="userSpaceOnUse"><path d="M56 0H0V56" fill="none" stroke="#2a769b" strokeOpacity=".12" strokeWidth="1" /></pattern>
            <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="10" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <filter id="tinyGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>

          <rect width="1600" height="960" fill="#01040b" />
          <rect x="28" y="24" width="1544" height="252" rx="28" fill="url(#wallBg)" stroke="#16476a" strokeOpacity=".55" />
          <path d="M70 82H1530M70 142H1530M70 202H1530" stroke="#1f6285" strokeOpacity=".13" />
          {[150, 400, 650, 950, 1200, 1450].map((x) => <path key={x} d={`M${x} 34V268`} stroke="#36c8ff" strokeOpacity=".1" />)}

          <g className="room2d-wall-display left">
            <rect x="88" y="66" width="360" height="134" rx="12" fill="#03101d" stroke="#35e8ff" strokeOpacity=".38" />
            <text x="112" y="92" className="room2d-wall-title">GLOBAL INTEL STREAM</text>
            {[0,1,2,3].map((i)=><rect key={i} x="112" y={112+i*18} width={214+i*20} height="7" rx="3" fill={i===0?"#35e8ff":"#27465b"} opacity={.62-i*.08} />)}
            <path d="M328 170L350 145L372 158L394 120L420 140" fill="none" stroke="#4fffb2" strokeWidth="3" />
          </g>
          <g className="room2d-wall-display center">
            <rect x="544" y="50" width="512" height="162" rx="14" fill="#030d19" stroke="#a76cff" strokeOpacity=".28" />
            <text x="574" y="80" className="room2d-wall-title">RIVEN ORCHESTRATION NETWORK</text>
            <circle cx="800" cy="132" r="34" fill="#0d4e73" stroke="#35e8ff" strokeOpacity=".8" />
            {[0,1,2,3,4,5,6,7].map((i)=>{ const a=i*Math.PI/4; const x=800+Math.cos(a)*150; const y=132+Math.sin(a)*52; return <g key={i}><path d={`M800 132L${x} ${y}`} stroke="#35e8ff" strokeOpacity=".18" /><circle cx={x} cy={y} r="7" fill={i%2?"#a76cff":"#35e8ff"} opacity=".65" /></g>;})}
          </g>
          <g className="room2d-wall-display right">
            <rect x="1152" y="66" width="360" height="134" rx="12" fill="#03101d" stroke="#ffb84d" strokeOpacity=".32" />
            <text x="1176" y="92" className="room2d-wall-title">MISSION SIGNALS</text>
            {[32,64,48,91,58,76,42,83].map((h,i)=><rect key={i} x={1180+i*34} y={180-h*.62} width="18" height={h*.62} rx="3" fill={i%2?"#a76cff":"#ffb84d"} opacity=".55" />)}
          </g>

          <path d="M72 270H1528L1600 960H0Z" fill="url(#floorBg)" />
          <path d="M72 270H1528L1600 960H0Z" fill="url(#floorGrid)" opacity=".8" />
          {[210, 390, 570, 750, 930, 1110, 1290, 1470].map((x) => <path key={x} d={`M800 270L${x} 960`} stroke="#2e89ae" strokeOpacity=".08" />)}
          {[340, 440, 560, 700, 860].map((y, i) => <path key={y} d={`M${90-i*18} ${y}H${1510+i*18}`} stroke="#35e8ff" strokeOpacity=".08" />)}

          <g opacity=".7">
            <path d="M0 310L95 286V865L0 930Z" fill="#040b14" stroke="#244b67" strokeOpacity=".45" />
            <path d="M1600 310L1505 286V865L1600 930Z" fill="#040b14" stroke="#244b67" strokeOpacity=".45" />
            {[360,480,600,720].map((y)=><g key={y}><rect x="18" y={y} width="54" height="9" rx="4" fill="#35e8ff" opacity=".12"/><rect x="1528" y={y} width="54" height="9" rx="4" fill="#a76cff" opacity=".12"/></g>)}
          </g>

          <DataLinks stations={placed} />
          <RivenCore active={orchestratorActive} />

          {placed.map((station, index) => (
            <Workstation key={station.id} station={station} index={index} position={POSITIONS[index]} selected={station.id === selectedId} onSelect={onSelect} />
          ))}

          <g className="room2d-floor-label" transform="translate(800 920)">
            <rect x="-236" y="-18" width="472" height="36" rx="18" fill="#03101d" stroke="#35e8ff" strokeOpacity=".22" />
            <text x="0" y="5" textAnchor="middle">RIVEN-STARLANCE // 15-STATION LIVE OPERATIONS DECK</text>
          </g>
        </svg>
      </div>
      <div className="room2d-pan-hint">SWIPE / DRAG TO EXPLORE COMMAND ROOM</div>
    </div>
  );
}
