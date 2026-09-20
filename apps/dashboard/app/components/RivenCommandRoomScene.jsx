"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  LinearFilter,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from "three";
import { useEffect, useMemo, useRef } from "react";

const COLORS = {
  cyan: "#32e6ff",
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

function shorten(text, max = 72) {
  const value = String(text || "").trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
  const words = String(text || "").split(/\s+/);
  let line = "";
  let lineNo = 0;
  for (let i = 0; i < words.length; i += 1) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineNo * lineHeight);
      line = words[i];
      lineNo += 1;
      if (lineNo >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (lineNo < maxLines) ctx.fillText(shorten(line, 58), x, y + lineNo * lineHeight);
}

function drawRoleVisualization(ctx, role, accent, active) {
  const mode = String(role || "").toLowerCase();
  const left = 46;
  const top = 238;
  const width = 676;
  const height = 128;

  ctx.save();
  ctx.strokeStyle = "rgba(95,170,220,.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(left, top, width, height);
  ctx.fillStyle = "rgba(4,14,30,.88)";
  ctx.fillRect(left, top, width, height);

  if (mode.includes("code")) {
    ctx.font = "18px monospace";
    ["async def execute_task():", "  evidence = await gather()", "  result = await model.run()", "  return validate(result)"].forEach((line, i) => {
      ctx.fillStyle = i === 0 ? accent : "#80b5ca";
      ctx.fillText(line, 70, 270 + i * 24);
    });
  } else if (mode.includes("security")) {
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.arc(135, 302, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(135, 256);
    ctx.lineTo(135, 348);
    ctx.moveTo(89, 302);
    ctx.lineTo(181, 302);
    ctx.stroke();
    ctx.fillStyle = "#a9d6e8";
    ctx.font = "18px sans-serif";
    ["Threat scan", "Runtime guard", "Source integrity"].forEach((line, i) => ctx.fillText(line, 220, 278 + i * 32));
  } else if (mode.includes("memory")) {
    const pts = [[110, 278], [178, 252], [230, 320], [318, 270], [402, 326], [500, 260], [612, 310]];
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    pts.forEach(([x, y]) => {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (mode.includes("vision") || mode.includes("creative")) {
    [[72, 258, 150, 84], [248, 258, 150, 84], [424, 258, 150, 84], [600, 258, 96, 84]].forEach(([x, y, w, h], i) => {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, i % 2 ? "#6d45ff" : "#0ea5e9");
      g.addColorStop(1, i % 2 ? "#ec4899" : "#22d3ee");
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    });
  } else if (mode.includes("planning") || mode.includes("strategy") || mode.includes("operations")) {
    [0.86, 0.62, 0.74, 0.48, 0.9].forEach((value, i) => {
      ctx.fillStyle = "rgba(96,150,190,.16)";
      ctx.fillRect(80, 257 + i * 21, 560, 10);
      ctx.fillStyle = accent;
      ctx.fillRect(80, 257 + i * 21, 560 * value, 10);
    });
  } else if (mode.includes("analytics") || mode.includes("simulation")) {
    const values = [18, 42, 30, 75, 54, 92, 70, 108, 86];
    ctx.strokeStyle = accent;
    ctx.lineWidth = 5;
    ctx.beginPath();
    values.forEach((value, i) => {
      const x = 74 + i * 72;
      const y = 350 - value;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
    values.forEach((value, i) => {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(74 + i * 72, 350 - value, 6, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    for (let i = 0; i < 7; i += 1) {
      const h = 28 + ((i * 31) % 76);
      ctx.fillStyle = i % 2 ? accent : "rgba(85,180,220,.42)";
      ctx.fillRect(76 + i * 82, 347 - h, 48, h);
    }
    ctx.fillStyle = "#8cb9ce";
    ctx.font = "16px sans-serif";
    ctx.fillText(active ? "Live evidence stream" : "Awaiting assignment", 76, 362);
  }
  ctx.restore();
}

function makePanelTexture(station) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");
  const accent = COLORS[station.accent] || COLORS.cyan;
  const active = station.kind === "working";

  const gradient = ctx.createLinearGradient(0, 0, 768, 420);
  gradient.addColorStop(0, "#07152b");
  gradient.addColorStop(1, "#020812");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 768, 420);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(7, 7, 754, 406);
  ctx.fillStyle = `${accent}22`;
  ctx.fillRect(0, 0, 768, 74);

  ctx.fillStyle = accent;
  ctx.font = "700 30px sans-serif";
  ctx.fillText(shorten(station.name, 32), 44, 48);
  ctx.font = "700 15px sans-serif";
  ctx.fillText(station.reserve ? "RESERVE STATION" : station.kind.toUpperCase(), 585, 46);

  ctx.fillStyle = "#6f93ab";
  ctx.font = "700 15px sans-serif";
  ctx.fillText("LIVE WORKSPACE", 46, 112);
  ctx.fillStyle = "#e8f8ff";
  ctx.font = "700 25px sans-serif";
  drawWrapped(ctx, station.message || station.objective || station.role || "Standing by", 46, 150, 660, 34, 2);

  drawRoleVisualization(ctx, station.role, accent, active && !station.reserve);

  const progress = station.reserve ? 0 : station.progress;
  ctx.fillStyle = "rgba(255,255,255,.08)";
  ctx.fillRect(46, 389, 620, 9);
  ctx.fillStyle = accent;
  ctx.fillRect(46, 389, 620 * progress / 100, 9);
  ctx.fillStyle = "#bfefff";
  ctx.font = "700 15px sans-serif";
  ctx.fillText(`${progress}%`, 690, 399);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function StationPanel({ station, position, onSelect }) {
  const panelRef = useRef();
  const { camera } = useThree();
  const texture = useMemo(() => makePanelTexture(station), [station]);

  useEffect(() => () => texture.dispose(), [texture]);
  useFrame(() => {
    if (panelRef.current) panelRef.current.lookAt(camera.position);
  });

  return (
    <group
      ref={panelRef}
      position={[position[0], 3.05, position[2]]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(station.id);
      }}
    >
      <mesh>
        <planeGeometry args={[3.05, 1.68]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent opacity={station.reserve ? 0.5 : 1} />
      </mesh>
      {!station.reserve && station.kind === "working" && (
        <pointLight color={COLORS[station.accent] || COLORS.cyan} intensity={1.25} distance={4.5} position={[0, 0, 0.5]} />
      )}
    </group>
  );
}

function AgentOperator({ station }) {
  const ref = useRef();
  const active = station.kind === "working";
  const accent = COLORS[station.accent] || COLORS.cyan;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.position.y = active ? Math.sin(t * 3.1 + station.index) * 0.035 : 0;
    ref.current.rotation.z = active ? Math.sin(t * 2.1 + station.index) * 0.025 : 0;
  });

  return (
    <group ref={ref} position={[0, 0.62, 0.78]}>
      <mesh position={[0, 1.15, 0]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={station.reserve ? "#26374a" : "#b9d8e8"} emissive={station.reserve ? "#000000" : accent} emissiveIntensity={active ? 0.45 : 0.16} roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[0, 0.62, 0]} rotation={[0.12, 0, 0]}>
        <cylinderGeometry args={[0.27, 0.37, 0.82, 16]} />
        <meshStandardMaterial color={station.reserve ? "#172535" : "#101b2c"} emissive={accent} emissiveIntensity={active ? 0.22 : 0.06} metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[-0.34, 0.7, -0.18]} rotation={[0.4, 0, -0.9]}><cylinderGeometry args={[0.07, 0.08, 0.65, 10]} /><meshStandardMaterial color="#4e6f88" /></mesh>
      <mesh position={[0.34, 0.7, -0.18]} rotation={[0.4, 0, 0.9]}><cylinderGeometry args={[0.07, 0.08, 0.65, 10]} /><meshStandardMaterial color="#4e6f88" /></mesh>
    </group>
  );
}

function Workstation({ station, position, rotation, onSelect }) {
  const accent = COLORS[station.accent] || COLORS.cyan;
  return (
    <group
      position={position}
      rotation={[0, rotation, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(station.id);
      }}
    >
      <mesh position={[0, 0.42, 0.05]}>
        <boxGeometry args={[2.25, 0.12, 1.1]} />
        <meshStandardMaterial color="#071222" metalness={0.8} roughness={0.22} emissive={accent} emissiveIntensity={station.reserve ? 0.025 : 0.07} />
      </mesh>
      <mesh position={[0, 0.18, 0.74]}>
        <boxGeometry args={[0.72, 0.72, 0.72]} />
        <meshStandardMaterial color="#09111d" metalness={0.82} roughness={0.24} />
      </mesh>
      <mesh position={[-0.85, 0.15, 0.05]}><boxGeometry args={[0.12, 0.55, 0.92]} /><meshStandardMaterial color="#0a1a2d" /></mesh>
      <mesh position={[0.85, 0.15, 0.05]}><boxGeometry args={[0.12, 0.55, 0.92]} /><meshStandardMaterial color="#0a1a2d" /></mesh>
      <AgentOperator station={station} />
      <mesh position={[0, 0.48, -0.5]} rotation={[-0.12, 0, 0]}>
        <boxGeometry args={[1.9, 0.92, 0.08]} />
        <meshStandardMaterial color="#06111e" emissive={accent} emissiveIntensity={station.kind === "working" ? 0.28 : 0.06} />
      </mesh>
    </group>
  );
}

function DataLink({ end, station }) {
  const pulse = useRef();
  const accent = COLORS[station.accent] || COLORS.cyan;
  const curve = useMemo(() => new CatmullRomCurve3([
    new Vector3(0, 0.4, 0),
    new Vector3(end[0] * 0.42, 1.15, end[2] * 0.42),
    new Vector3(end[0], 0.35, end[2]),
  ]), [end]);
  const geometry = useMemo(() => new TubeGeometry(curve, 28, 0.016, 6, false), [curve]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (!pulse.current || station.reserve || station.kind !== "working") return;
    const t = (clock.getElapsedTime() * 0.24 + station.index * 0.071) % 1;
    pulse.current.position.copy(curve.getPointAt(t));
  });

  if (station.reserve) return null;
  return (
    <group>
      <mesh geometry={geometry}>
        <meshBasicMaterial color={accent} transparent opacity={station.kind === "working" ? 0.5 : 0.12} toneMapped={false} />
      </mesh>
      {station.kind === "working" && (
        <mesh ref={pulse}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function HologramMaterial({ glow }) {
  return <meshStandardMaterial color="#8cecff" emissive="#23cfff" emissiveIntensity={glow} transparent opacity={0.72} metalness={0.15} roughness={0.2} />;
}

function RivenHologram({ active }) {
  const figure = useRef();
  const ringA = useRef();
  const ringB = useRef();
  const ringC = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (figure.current) figure.current.position.y = 2.5 + Math.sin(t * 1.5) * 0.08;
    if (ringA.current) ringA.current.rotation.z = t * 0.28;
    if (ringB.current) ringB.current.rotation.x = 1.2 + t * 0.22;
    if (ringC.current) ringC.current.rotation.y = t * -0.2;
  });

  const glow = active ? 1.35 : 0.8;
  return (
    <group>
      <mesh position={[0, 0.12, 0]}><cylinderGeometry args={[2.15, 2.35, 0.34, 64]} /><meshStandardMaterial color="#07182b" metalness={0.85} roughness={0.2} emissive="#1a8fd4" emissiveIntensity={0.25} /></mesh>
      <mesh position={[0, 0.34, 0]}><torusGeometry args={[1.72, 0.055, 10, 80]} /><meshBasicMaterial color="#55e9ff" toneMapped={false} /></mesh>
      <group ref={figure} position={[0, 2.5, 0]}>
        <mesh position={[0, 1.05, 0]}><sphereGeometry args={[0.34, 24, 24]} /><HologramMaterial glow={glow} /></mesh>
        <mesh position={[0, 0.22, 0]}><cylinderGeometry args={[0.34, 0.5, 1.18, 20]} /><HologramMaterial glow={glow} /></mesh>
        <mesh position={[-0.58, 0.35, 0]} rotation={[0, 0, -0.78]}><cylinderGeometry args={[0.075, 0.09, 1.2, 12]} /><HologramMaterial glow={glow} /></mesh>
        <mesh position={[0.58, 0.35, 0]} rotation={[0, 0, 0.78]}><cylinderGeometry args={[0.075, 0.09, 1.2, 12]} /><HologramMaterial glow={glow} /></mesh>
        <mesh position={[-0.24, -0.7, 0]} rotation={[0, 0, 0.12]}><cylinderGeometry args={[0.09, 0.1, 1.25, 12]} /><HologramMaterial glow={glow} /></mesh>
        <mesh position={[0.24, -0.7, 0]} rotation={[0, 0, -0.12]}><cylinderGeometry args={[0.09, 0.1, 1.25, 12]} /><HologramMaterial glow={glow} /></mesh>
        <pointLight color="#2edcff" intensity={active ? 4 : 2} distance={8} />
      </group>
      <mesh ref={ringA} position={[0, 2.7, 0]} rotation={[1.35, 0, 0.2]}><torusGeometry args={[1.25, 0.018, 8, 96]} /><meshBasicMaterial color="#3ee8ff" transparent opacity={0.75} toneMapped={false} /></mesh>
      <mesh ref={ringB} position={[0, 2.7, 0]} rotation={[0.2, 0.3, 0]}><torusGeometry args={[1.65, 0.015, 8, 96]} /><meshBasicMaterial color="#9172ff" transparent opacity={0.55} toneMapped={false} /></mesh>
      <mesh ref={ringC} position={[0, 2.7, 0]} rotation={[0.6, 0.8, 0.4]}><torusGeometry args={[2.0, 0.012, 8, 96]} /><meshBasicMaterial color="#4fffb2" transparent opacity={0.35} toneMapped={false} /></mesh>
    </group>
  );
}

function RoomArchitecture() {
  const pillars = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    return [Math.sin(angle) * 11.5, Math.cos(angle) * 11.5];
  }), []);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[12.8, 96]} />
        <meshStandardMaterial color="#020916" metalness={0.68} roughness={0.32} />
      </mesh>
      {[3.2, 6.8, 10.2, 12.2].map((radius) => (
        <mesh key={radius} rotation={[Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <torusGeometry args={[radius, 0.025, 8, 96]} />
          <meshBasicMaterial color={radius < 7 ? "#1ccfff" : "#184a6b"} transparent opacity={radius < 7 ? 0.32 : 0.2} toneMapped={false} />
        </mesh>
      ))}
      {pillars.map(([x, z], i) => (
        <mesh key={i} position={[x, 2.3, z]}>
          <boxGeometry args={[0.18, 4.6, 0.18]} />
          <meshStandardMaterial color="#09213a" emissive={i % 3 === 0 ? "#1b77a8" : "#04111d"} emissiveIntensity={0.35} metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 5.1, -10.8]}><boxGeometry args={[20, 0.08, 0.08]} /><meshBasicMaterial color="#2f95c8" transparent opacity={0.35} /></mesh>
    </group>
  );
}

function StarField() {
  const positions = useMemo(() => {
    const data = new Float32Array(360 * 3);
    for (let i = 0; i < 360; i += 1) {
      const r = 18 + Math.random() * 14;
      const angle = Math.random() * Math.PI * 2;
      data[i * 3] = Math.sin(angle) * r;
      data[i * 3 + 1] = 2 + Math.random() * 14;
      data[i * 3 + 2] = Math.cos(angle) * r;
    }
    return data;
  }, []);
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  return <points geometry={geometry}><pointsMaterial color="#72cfff" size={0.055} transparent opacity={0.7} sizeAttenuation /></points>;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const mobile = size.width < 760;
    camera.position.set(0, mobile ? 16.5 : 11.6, mobile ? 28 : 22.5);
    camera.fov = mobile ? 48 : 43;
    camera.lookAt(0, 1.4, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

function CommandRoom({ stations, orchestratorActive, selectedId, onSelect }) {
  const stationLayout = useMemo(() => stations.map((station, index) => {
    const angle = (index / stations.length) * Math.PI * 2;
    const radius = index % 2 === 0 ? 8.7 : 9.5;
    const x = Math.sin(angle) * radius;
    const z = Math.cos(angle) * radius;
    return { station: { ...station, index }, position: [x, 0, z], rotation: angle + Math.PI };
  }), [stations]);

  return (
    <>
      <color attach="background" args={["#010611"]} />
      <fog attach="fog" args={["#010611", 18, 40]} />
      <ambientLight intensity={0.38} color="#77bde8" />
      <directionalLight position={[8, 14, 10]} intensity={1.3} color="#8ccfff" />
      <ResponsiveCamera />
      <StarField />
      <RoomArchitecture />
      <RivenHologram active={orchestratorActive} />
      {stationLayout.map(({ station, position, rotation }) => (
        <group key={station.id}>
          <Workstation station={station} position={position} rotation={rotation} onSelect={onSelect} />
          <StationPanel station={station} position={position} onSelect={onSelect} />
          <DataLink station={station} end={position} />
          {selectedId === station.id && <pointLight position={[position[0], 2.2, position[2]]} color="#ffffff" intensity={2.2} distance={3.8} />}
        </group>
      ))}
    </>
  );
}

export default function RivenCommandRoomScene({ stations, orchestratorActive, selectedId, onSelect }) {
  return (
    <div className="room3d-canvas-wrap">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 11.6, 22.5], fov: 43, near: 0.1, far: 70 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <CommandRoom stations={stations} orchestratorActive={orchestratorActive} selectedId={selectedId} onSelect={onSelect} />
      </Canvas>
    </div>
  );
}
