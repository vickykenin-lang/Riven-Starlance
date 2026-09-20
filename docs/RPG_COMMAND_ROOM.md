# Riven-Starlance RPG Command Room

## Why this exists

The dashboard is not intended to be a dark SaaS dashboard with game styling. It should behave like a live virtual operations room: Riven occupies the center, agents visibly work at stations, their screens show current work, and backend events drive visible activity.

## Evidence reviewed

Internal project documents reviewed before this revision:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_STATUS.md`
- current dashboard source and previous RPG / virtual-office iterations

Important existing contract: dashboard progress must come from real backend events. Fake percentage animation is not permitted.

Practical prior art reviewed:

- WorkAdventure: open-source web virtual office presented as an RPG. Its client uses Phaser scenes and sprite/game-object composition rather than constructing characters from raw 3D primitives.
- WorkAdventure map workflow: authored room/map layers, furniture, collision and interaction zones are separated from runtime character behavior.
- Phaser: supports 2D scene cameras, sprite animation, tile maps and DOM elements over the game canvas.
- PixiJS: uses a retained 2D scene graph and GPU-accelerated rendering for interactive sprite-based worlds.

The reusable lesson is that convincing web RPG environments are usually authored as layered 2D/2.5D scenes with designed assets and sprites. Runtime state changes which sprites, frames, highlights, labels and panels are active. The visual world is not generated from primitive boxes/cylinders at runtime.

## Assessment of the previous 3D attempt

The WebGL version proved live state could drive a spatial scene, but it failed the visual target because:

1. characters and desks were procedural primitives, so they read as prototype geometry;
2. the camera had to zoom too far out to fit 15 stations;
3. the room lacked authored environmental art, so most of the frame became empty darkness;
4. station screens were technically live but visually detached from a coherent environment;
5. mobile presentation reduced readability further;
6. React Three Fiber / Three.js increased dependency and rendering cost without producing the intended visual quality.

## Chosen architecture

### Layer 1 — authored 2.5D room

Use one coherent SVG scene with walls, floor, lighting, command displays, Riven platform, workstations and depth ordering. The scene remains one visual world rather than many dashboard cards.

### Layer 2 — addressable agent stations

Each of 15 stations is a named scene object. Runtime-connected agents occupy real stations; unused capacity remains visibly available rather than pretending to be active.

Each active station contains:

- operator sprite/figure;
- AI name badge;
- status indicator;
- task-specific monitor visualization;
- progress derived from real run state;
- live-data connection to Riven when working.

### Layer 3 — live event binding

Existing SSE state remains authoritative. Visual transitions map to real states:

- ready: station powered, operator idle;
- assigned/researching/verifying/reviewing: operator movement + active monitor + data link;
- source.found: evidence counters / monitor state update;
- submitted/completed: completed station state;
- failed: alert state;
- reserve: unassigned, dimmed station.

No decorative animation may imply a task state that the backend has not emitted.

### Layer 4 — HTML HUD

Mission entry, selected-agent detail, live event log, documents, evidence preview and final synthesis remain normal React/HTML for clarity and accessibility. They float over or below the world instead of defining the world.

## Mobile behavior

Do not collapse the room into stacked agent cards. Preserve the spatial room at a readable minimum width and allow horizontal touch exploration. Keep only compact HUD overlays on top of the scene.

## Performance decision

The 2.5D SVG/DOM approach is intentionally lighter than the previous React Three Fiber scene for this 15-station mostly fixed-camera use case. WebGL/3D can be reintroduced later only for a visual behavior that genuinely needs it.

## Acceptance criteria

A successful command room must visibly satisfy all of these:

- Riven is the dominant central orchestrator.
- 15 station positions are visible in one coherent room.
- connected agents are visually distinct from reserve slots.
- every connected agent has a readable name badge.
- each monitor shows role/task-specific work rather than the same generic card.
- working agents visibly animate only when real state is active.
- Riven-to-agent data links activate from real state.
- mobile preserves the room and allows spatial exploration.
- existing mission launch, documents, evidence, SSE events and final synthesis continue to work.
