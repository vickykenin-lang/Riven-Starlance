"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./riven-orchestrator-lab.module.css";

const PHASE_COLORS = {
  idle: "#56e7ff",
  activating: "#7f8cff",
  planning: "#7686ff",
  coordinating: "#44e3ff",
  verifying: "#ffb45c",
  synthesizing: "#a06cff",
  complete: "#57f5b5",
  failed: "#ff5e78",
};

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function makePanelCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 576;
  return canvas;
}

function paintPanel(canvas, data, kind) {
  const ctx = canvas.getContext("2d");
  const accent = PHASE_COLORS[data.phase] || PHASE_COLORS.idle;
  const events = data.events || [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#06111e");
  bg.addColorStop(1, "#02070d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(83, 211, 255, .28)";
  ctx.lineWidth = 3;
  for (let x = 0; x < canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = accent;
  ctx.font = "700 24px Arial";
  ctx.letterSpacing = "4px";
  ctx.fillText("RIVEN // LIVE ORCHESTRATION", 46, 58);

  ctx.fillStyle = "#eaf8ff";
  ctx.font = "700 48px Arial";
  ctx.fillText(data.phaseTitle || "READY", 46, 126);

  ctx.fillStyle = "#78a7bb";
  ctx.font = "24px Arial";
  const message = String(data.message || "Awaiting mission directive").slice(0, 56);
  ctx.fillText(message, 46, 166);

  if (kind === "mission") {
    const stats = [
      ["RUN", data.runStatus || "ready"],
      ["SOURCES", String(data.sourceCount || 0)],
      ["AGENTS", `${data.completedAgents || 0}/4`],
      ["FAILED", String(data.failedAgents || 0)],
    ];
    stats.forEach(([label, value], index) => {
      const x = 46 + (index % 2) * 250;
      const y = 224 + Math.floor(index / 2) * 132;
      roundedRect(ctx, x, y, 220, 100, 14);
      ctx.fillStyle = "rgba(8, 28, 46, .92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(75, 200, 255, .24)";
      ctx.stroke();
      ctx.fillStyle = "#628a9f";
      ctx.font = "700 16px Arial";
      ctx.fillText(label, x + 20, y + 30);
      ctx.fillStyle = "#f4fdff";
      ctx.font = "700 30px Arial";
      ctx.fillText(value, x + 20, y + 72);
    });

    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(580, 420);
    for (let i = 0; i < 300; i += 10) {
      const px = 580 + i;
      const py = 420 - Math.sin(i * 0.08) * 36 - Math.sin(i * 0.025) * 18;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  } else {
    ctx.fillStyle = "#80a9bb";
    ctx.font = "700 16px Arial";
    ctx.fillText("RECENT ACTIVITY", 46, 222);
    const rows = events.slice(-5).reverse();
    rows.forEach((event, index) => {
      const y = 258 + index * 57;
      ctx.fillStyle = index === 0 ? accent : "#4d7d92";
      ctx.beginPath();
      ctx.arc(58, y - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#dff8ff";
      ctx.font = "700 18px Arial";
      ctx.fillText(String(event.agent_id || "Riven").slice(0, 18), 80, y);
      ctx.fillStyle = "#7298aa";
      ctx.font = "16px Arial";
      ctx.fillText(String(event.message || event.type || "runtime event").slice(0, 54), 260, y);
    });
    if (!rows.length) {
      ctx.fillStyle = "#62879a";
      ctx.font = "22px Arial";
      ctx.fillText("Mission stream will appear here.", 46, 286);
    }
  }

  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
}

export default function RivenRoom3D({
  phase,
  phaseTitle,
  phaseText,
  latestEvent,
  runStatus,
  sourceCount,
  completedAgents,
  failedAgents,
  events,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const dataRef = useRef({});
  const [loadError, setLoadError] = useState("");

  dataRef.current = {
    phase,
    phaseTitle,
    message: latestEvent?.message || phaseText,
    runStatus,
    sourceCount,
    completedAgents,
    failedAgents,
    events,
  };

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    async function boot() {
      try {
        const runtimeImport = new Function("url", "return import(url)");
        const THREE = await runtimeImport("https://cdn.jsdelivr.net/npm/three@0.160.0/+esm");
        if (cancelled || !mountRef.current) return;

        const mount = mountRef.current;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x02050a);
        scene.fog = new THREE.FogExp2(0x02050a, 0.035);

        const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);
        camera.position.set(11.8, 7.6, 15.5);
        const lookTarget = new THREE.Vector3(0, 2.1, -0.4);
        camera.lookAt(lookTarget);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        renderer.setSize(mount.clientWidth, mount.clientHeight, false);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.22;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mount.appendChild(renderer.domElement);

        const ambient = new THREE.HemisphereLight(0x7fc8ff, 0x06101d, 1.8);
        scene.add(ambient);

        const keyLight = new THREE.SpotLight(0x7eeaff, 90, 40, Math.PI / 5, 0.45, 1.3);
        keyLight.position.set(2, 10, 6);
        keyLight.target.position.set(0, 1, 0);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight, keyLight.target);

        const warmLight = new THREE.PointLight(0xff9c4a, 26, 18, 2);
        warmLight.position.set(-6, 3, 2);
        scene.add(warmLight);
        const coolLight = new THREE.PointLight(0x266dff, 36, 20, 2);
        coolLight.position.set(6, 4, -2);
        scene.add(coolLight);

        const metal = new THREE.MeshStandardMaterial({ color: 0x101923, metalness: 0.88, roughness: 0.26 });
        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x060a10, metalness: 0.9, roughness: 0.32 });
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x152533, metalness: 0.72, roughness: 0.28 });
        const whiteArmor = new THREE.MeshPhysicalMaterial({ color: 0xdbe8ef, metalness: 0.62, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.18 });
        const blackArmor = new THREE.MeshPhysicalMaterial({ color: 0x071019, metalness: 0.78, roughness: 0.18, clearcoat: 0.7 });
        const glass = new THREE.MeshPhysicalMaterial({ color: 0x1a76a8, transparent: true, opacity: 0.18, roughness: 0.06, metalness: 0.1, transmission: 0.08 });
        const cyanGlow = new THREE.MeshStandardMaterial({ color: 0x1d6b82, emissive: 0x4be5ff, emissiveIntensity: 4.5, metalness: 0.35, roughness: 0.2 });
        const orangeGlow = new THREE.MeshStandardMaterial({ color: 0x6b3210, emissive: 0xff9b45, emissiveIntensity: 3.2, metalness: 0.25, roughness: 0.22 });

        function mesh(geometry, material, position, rotation = [0, 0, 0]) {
          const item = new THREE.Mesh(geometry, material);
          item.position.set(...position);
          item.rotation.set(...rotation);
          item.castShadow = true;
          item.receiveShadow = true;
          scene.add(item);
          return item;
        }

        // Architectural shell
        mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshStandardMaterial({ color: 0x070d14, metalness: 0.8, roughness: 0.34 }), [0, 0, 0], [-Math.PI / 2, 0, 0]);
        mesh(new THREE.PlaneGeometry(22, 8.4), new THREE.MeshStandardMaterial({ color: 0x08111c, metalness: 0.62, roughness: 0.42 }), [0, 4.2, -7.6]);
        mesh(new THREE.PlaneGeometry(16, 8.4), new THREE.MeshStandardMaterial({ color: 0x07101a, metalness: 0.7, roughness: 0.38 }), [-11, 4.2, 0], [0, Math.PI / 2, 0]);
        mesh(new THREE.PlaneGeometry(16, 8.4), new THREE.MeshStandardMaterial({ color: 0x07101a, metalness: 0.7, roughness: 0.38 }), [11, 4.2, 0], [0, -Math.PI / 2, 0]);

        const grid = new THREE.GridHelper(22, 22, 0x19526f, 0x0d2535);
        grid.position.y = 0.012;
        grid.material.transparent = true;
        grid.material.opacity = 0.34;
        scene.add(grid);

        // Ceiling ribs and perimeter light strips
        for (let i = -10; i <= 10; i += 2.5) {
          mesh(new THREE.BoxGeometry(0.12, 0.12, 15.2), darkMetal, [i, 8.22, -0.2]);
        }
        mesh(new THREE.BoxGeometry(20, 0.055, 0.07), cyanGlow, [0, 7.95, -7.42]);
        mesh(new THREE.BoxGeometry(0.055, 0.07, 14), orangeGlow, [-10.72, 4.5, 0]);
        mesh(new THREE.BoxGeometry(0.055, 0.07, 14), cyanGlow, [10.72, 4.5, 0]);

        // Rear panoramic windows + procedural city
        const windowFrame = new THREE.Group();
        scene.add(windowFrame);
        const windowBack = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 4.8), new THREE.MeshBasicMaterial({ color: 0x020817 }));
        windowBack.position.set(0, 4.3, -7.54);
        windowFrame.add(windowBack);
        for (let x = -5.7; x <= 5.7; x += 2.28) {
          const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5.05, 0.12), metal);
          mullion.position.set(x, 4.25, -7.42);
          windowFrame.add(mullion);
        }
        const sill = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.14, 0.2), metal);
        sill.position.set(0, 1.78, -7.42);
        windowFrame.add(sill);

        const cityGroup = new THREE.Group();
        cityGroup.position.z = -7.72;
        scene.add(cityGroup);
        for (let i = 0; i < 55; i += 1) {
          const width = 0.18 + Math.random() * 0.42;
          const height = 0.7 + Math.random() * 4.5;
          const building = new THREE.Mesh(
            new THREE.BoxGeometry(width, height, 0.3 + Math.random() * 0.5),
            new THREE.MeshStandardMaterial({ color: 0x06101d, emissive: i % 5 === 0 ? 0x112f62 : 0x06101d, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.5 })
          );
          building.position.set(-6.1 + Math.random() * 12.2, 1.65 + height / 2 + Math.random() * 0.6, -Math.random() * 2.8);
          cityGroup.add(building);
          if (i % 2 === 0) {
            const light = new THREE.Mesh(new THREE.BoxGeometry(width * 0.5, 0.05, 0.02), i % 4 === 0 ? orangeGlow : cyanGlow);
            light.position.set(building.position.x, 1.9 + Math.random() * 3.6, building.position.z + 0.18);
            cityGroup.add(light);
          }
        }

        // Wall panels and server racks
        function makeServerRack(x, z, warm = false) {
          const rack = new THREE.Group();
          rack.position.set(x, 0, z);
          scene.add(rack);
          const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 3.3, 0.85), darkMetal);
          body.position.y = 1.65;
          body.castShadow = true;
          rack.add(body);
          for (let row = 0; row < 8; row += 1) {
            const slot = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.16, 0.05), panelMat);
            slot.position.set(0, 0.42 + row * 0.34, 0.46);
            rack.add(slot);
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.045, 0.03), warm && row % 3 === 0 ? orangeGlow : cyanGlow);
            led.position.set(0.33, 0.42 + row * 0.34, 0.5);
            rack.add(led);
          }
        }
        makeServerRack(-9.2, -5.8, true);
        makeServerRack(-7.8, -5.8, false);
        makeServerRack(9.2, -5.8, false);
        makeServerRack(7.8, -5.8, true);

        // Workstations
        const screenCanvases = [];
        function makeScreenMaterial(kind) {
          const canvas = makePanelCanvas();
          paintPanel(canvas, dataRef.current, kind);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          screenCanvases.push({ canvas, texture, kind });
          return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
        }

        function makeWorkstation(x, z, side, active = false) {
          const group = new THREE.Group();
          group.position.set(x, 0, z);
          group.rotation.y = side === "left" ? -0.2 : 0.2;
          scene.add(group);

          const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 1.25), metal);
          desk.position.y = 1.15;
          desk.castShadow = true;
          desk.receiveShadow = true;
          group.add(desk);
          for (const lx of [-1.35, 1.35]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 0.16), darkMetal);
            leg.position.set(lx, 0.57, 0.38);
            group.add(leg);
          }

          const monitorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.08, 0.08), darkMetal);
          monitorFrame.position.set(0, 1.95, -0.15);
          monitorFrame.rotation.x = -0.05;
          group.add(monitorFrame);
          const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.9), makeScreenMaterial(active ? "activity" : "mission"));
          screen.position.set(0, 1.95, -0.104);
          screen.rotation.x = -0.05;
          group.add(screen);

          const keyboard = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.38), panelMat);
          keyboard.position.set(0, 1.3, 0.18);
          keyboard.rotation.x = -0.1;
          group.add(keyboard);

          const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.74), darkMetal);
          chairSeat.position.set(0, 0.72, 1.06);
          group.add(chairSeat);
          const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1.05, 0.16), darkMetal);
          chairBack.position.set(0, 1.22, 1.36);
          chairBack.rotation.x = -0.13;
          group.add(chairBack);

          const underglow = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.04, 0.06), active ? cyanGlow : orangeGlow);
          underglow.position.set(0, 0.18, 0.55);
          group.add(underglow);
        }
        makeWorkstation(-5.9, -1.8, "left", true);
        makeWorkstation(5.9, -1.8, "right", true);
        makeWorkstation(-6.7, 3.3, "left", false);
        makeWorkstation(6.7, 3.3, "right", false);

        // Central orchestration dais
        const dais = new THREE.Group();
        scene.add(dais);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.15, 0.48, 64), darkMetal);
        base.position.y = 0.24;
        base.castShadow = true;
        base.receiveShadow = true;
        dais.add(base);
        const trim = new THREE.Mesh(new THREE.TorusGeometry(3.65, 0.055, 16, 96), cyanGlow);
        trim.rotation.x = Math.PI / 2;
        trim.position.y = 0.46;
        dais.add(trim);
        const innerTrim = new THREE.Mesh(new THREE.TorusGeometry(2.45, 0.035, 12, 96), orangeGlow);
        innerTrim.rotation.x = Math.PI / 2;
        innerTrim.position.y = 0.5;
        dais.add(innerTrim);

        const holoGroup = new THREE.Group();
        holoGroup.position.set(0, 3.2, -0.9);
        scene.add(holoGroup);
        const orbMat = new THREE.MeshBasicMaterial({ color: 0x56e7ff, wireframe: true, transparent: true, opacity: 0.34 });
        const orb = new THREE.Mesh(new THREE.SphereGeometry(1.42, 32, 24), orbMat);
        holoGroup.add(orb);
        const orbCore = new THREE.Mesh(new THREE.SphereGeometry(1.02, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0x1d7db4, transparent: true, opacity: 0.12, transmission: 0.2, emissive: 0x28bde9, emissiveIntensity: 2.4 }));
        holoGroup.add(orbCore);
        const orbit1 = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.025, 8, 96), cyanGlow);
        orbit1.rotation.set(1.18, 0, 0.35);
        holoGroup.add(orbit1);
        const orbit2 = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.018, 8, 96), new THREE.MeshBasicMaterial({ color: 0x7a7dff, transparent: true, opacity: 0.75 }));
        orbit2.rotation.set(0.35, 0.7, 1.4);
        holoGroup.add(orbit2);

        // Riven robot — original low-poly/PBR avatar, not CSS geometry.
        const riven = new THREE.Group();
        riven.position.set(0, 0.58, 2.45);
        riven.rotation.y = -0.06;
        scene.add(riven);

        const pelvis = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.52, 0.5), blackArmor);
        pelvis.position.y = 1.5;
        riven.add(pelvis);

        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 1.58, 8), whiteArmor);
        torso.position.y = 2.52;
        torso.scale.z = 0.72;
        torso.castShadow = true;
        riven.add(torso);

        const chestInset = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.76, 0.12), blackArmor);
        chestInset.position.set(0, 2.55, 0.51);
        riven.add(chestInset);
        const core = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.065, 12, 36), cyanGlow);
        core.position.set(0, 2.68, 0.59);
        riven.add(core);
        const coreDisk = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshBasicMaterial({ color: 0x041018 }));
        coreDisk.position.set(0, 2.68, 0.60);
        riven.add(coreDisk);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.34, 10), blackArmor);
        neck.position.y = 3.48;
        riven.add(neck);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 18), whiteArmor);
        head.scale.set(0.92, 1.1, 0.88);
        head.position.y = 3.98;
        riven.add(head);
        const visor = new THREE.Mesh(new THREE.SphereGeometry(0.39, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.64), blackArmor);
        visor.scale.set(0.92, 0.78, 0.96);
        visor.position.set(0, 3.99, 0.19);
        visor.rotation.x = -0.22;
        riven.add(visor);
        const faceRing = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 10, 30), cyanGlow);
        faceRing.position.set(0, 4.02, 0.46);
        riven.add(faceRing);

        function limb(x, upperY, lowerY, mirrored) {
          const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), whiteArmor);
          shoulder.scale.set(1.25, 0.9, 1);
          shoulder.position.set(x, 3.05, 0);
          riven.add(shoulder);
          const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.95, 8), whiteArmor);
          upper.position.set(x * 1.07, upperY, 0.02);
          upper.rotation.z = mirrored ? -0.10 : 0.10;
          riven.add(upper);
          const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.88, 8), blackArmor);
          fore.position.set(x * 1.11, lowerY, 0.08);
          fore.rotation.z = mirrored ? 0.08 : -0.08;
          riven.add(fore);
        }
        limb(-0.83, 2.62, 1.78, false);
        limb(0.83, 2.62, 1.78, true);

        function leg(x) {
          const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.16, 8), whiteArmor);
          thigh.position.set(x, 0.94, 0);
          riven.add(thigh);
          const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.0, 8), blackArmor);
          shin.position.set(x, 0.03, 0.03);
          riven.add(shin);
          const foot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.74), whiteArmor);
          foot.position.set(x, -0.54, 0.15);
          riven.add(foot);
        }
        leg(-0.31);
        leg(0.31);

        // Split holographic cape for a stronger authored silhouette.
        const capeMat = new THREE.MeshBasicMaterial({ color: 0x47d6ff, transparent: true, opacity: 0.16, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
        const capeGeo = new THREE.BufferGeometry();
        capeGeo.setAttribute("position", new THREE.Float32BufferAttribute([
          -0.55, 3.2, -0.15, -1.15, 0.2, -0.28, -0.08, 0.4, -0.2,
           0.55, 3.2, -0.15,  1.15, 0.2, -0.28,  0.08, 0.4, -0.2,
        ], 3));
        capeGeo.computeVertexNormals();
        const cape = new THREE.Mesh(capeGeo, capeMat);
        riven.add(cape);

        const rivenSpot = new THREE.SpotLight(0x5ce8ff, 38, 12, Math.PI / 6, 0.6, 1.4);
        rivenSpot.position.set(0, 7.2, 4.2);
        rivenSpot.target = riven;
        scene.add(rivenSpot);

        const stateRefs = {
          THREE,
          core,
          coreMaterial: cyanGlow,
          orbMaterial: orbMat,
          orangeGlow,
          cyanGlow,
          screenCanvases,
        };
        sceneRef.current = stateRefs;

        let phaseColor = new THREE.Color(PHASE_COLORS[dataRef.current.phase] || PHASE_COLORS.idle);
        const mouse = { x: 0, y: 0 };
        const desired = { x: 0, y: 0 };
        let zoom = 0;
        let raf = 0;
        let lastScreenSignature = "";
        const clock = new THREE.Clock();

        const updateScreens = () => {
          const data = dataRef.current;
          const signature = JSON.stringify([
            data.phase,
            data.phaseTitle,
            data.message,
            data.runStatus,
            data.sourceCount,
            data.completedAgents,
            data.failedAgents,
            (data.events || []).slice(-5).map((event) => [event.id, event.type, event.message, event.agent_id]),
          ]);
          if (signature === lastScreenSignature) return;
          lastScreenSignature = signature;
          screenCanvases.forEach((screen) => {
            paintPanel(screen.canvas, data, screen.kind);
            screen.texture.needsUpdate = true;
          });
          phaseColor = new THREE.Color(PHASE_COLORS[data.phase] || PHASE_COLORS.idle);
          cyanGlow.emissive.copy(phaseColor);
          orbMat.color.copy(phaseColor);
        };

        function onPointerMove(event) {
          const rect = mount.getBoundingClientRect();
          desired.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
          desired.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        }
        function onPointerLeave() {
          desired.x = 0;
          desired.y = 0;
        }
        function onWheel(event) {
          zoom = Math.max(-2, Math.min(2.4, zoom + Math.sign(event.deltaY) * 0.28));
        }
        mount.addEventListener("pointermove", onPointerMove);
        mount.addEventListener("pointerleave", onPointerLeave);
        mount.addEventListener("wheel", onWheel, { passive: true });

        const observer = new ResizeObserver(() => {
          if (!mount.clientWidth || !mount.clientHeight) return;
          camera.aspect = mount.clientWidth / mount.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(mount.clientWidth, mount.clientHeight, false);
        });
        observer.observe(mount);

        function animate() {
          raf = requestAnimationFrame(animate);
          updateScreens();
          const t = clock.getElapsedTime();
          mouse.x += (desired.x - mouse.x) * 0.035;
          mouse.y += (desired.y - mouse.y) * 0.035;

          camera.position.x = 11.8 + mouse.x * 0.72;
          camera.position.y = 7.6 - mouse.y * 0.28;
          camera.position.z = 15.5 + zoom;
          camera.lookAt(lookTarget.x + mouse.x * 0.16, lookTarget.y - mouse.y * 0.08, lookTarget.z);

          holoGroup.rotation.y = t * 0.12;
          orbit1.rotation.z = t * 0.22;
          orbit2.rotation.y = t * -0.18;
          orb.material.opacity = 0.27 + Math.sin(t * 2.0) * 0.08;
          core.scale.setScalar(1 + Math.sin(t * 3.4) * 0.055);
          riven.position.y = 0.58 + Math.sin(t * 1.4) * 0.018;
          cyanGlow.emissiveIntensity = 3.8 + Math.sin(t * 2.4) * 0.85;
          orangeGlow.emissiveIntensity = 2.8 + Math.sin(t * 1.8 + 1) * 0.55;

          renderer.render(scene, camera);
        }
        animate();

        cleanup = () => {
          cancelAnimationFrame(raf);
          observer.disconnect();
          mount.removeEventListener("pointermove", onPointerMove);
          mount.removeEventListener("pointerleave", onPointerLeave);
          mount.removeEventListener("wheel", onWheel);
          scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose?.();
            if (object.material) {
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material) => {
                material.map?.dispose?.();
                material.dispose?.();
              });
            }
          });
          renderer.dispose();
          renderer.domElement.remove();
          sceneRef.current = null;
        };
      } catch (error) {
        if (!cancelled) setLoadError("3D engine could not initialize on this device/browser.");
      }
    }

    boot();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <div className={styles.room3dShell}>
      <div ref={mountRef} className={styles.room3dMount} aria-label={`Interactive Riven command room, ${phaseTitle}`} />
      <div className={styles.roomVignette} />
      <div className={styles.roomScanlines} />
      <div className={styles.roomBadge}>
        <span>MAIN ORCHESTRATOR</span>
        <strong>RIVEN</strong>
        <em>{phaseTitle}</em>
      </div>
      <div className={styles.roomHint}>MOVE TO EXPLORE · SCROLL TO ZOOM</div>
      {loadError && <div className={styles.room3dError}>{loadError}</div>}
    </div>
  );
}
