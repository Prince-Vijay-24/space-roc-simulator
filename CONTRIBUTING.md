# Developer Guide: How to Contribute & Enhance the Code 🛠️🚀

> *"Every line of code in this project was written with a clear purpose: making spaceflight feel intuitive, mathematically authentic, and deeply rewarding to play."*

Welcome to the engineering bay! Whether you want to add new propulsion engines, design new solar system celestial bodies (Mars, Venus, Europa, Titan), build new minigames, or optimize the physics integrator, this guide gives you the full architectural blueprint.

---

## 🏛️ Codebase Mental Model & Architecture

The simulator is built with **TypeScript**, **React 19**, and a **custom Canvas 2D render pipeline**. There are no heavy black-box physics engines like Matter.js or Box2D; every vector, gravity pull, aerodynamic drag curve, and orbital Keplerian state vector is computed directly in clean, maintainable TypeScript math.

```
/src
├── audio/                   # Web Audio API procedural sound engine
│   └── soundEngine.ts       # Synthesized rocket rumble, wind shear, staging sounds, radio FX
├── components/              # React UI Views & Overlays
│   ├── builder/             # VAB modular staging tree, part palette, stats HUD
│   ├── minigames/           # Docking, Rover Mining, Solar Array Alignment games
│   ├── FlightHUD.tsx        # In-flight telemetry HUD, Navball, SAS buttons, throttles
│   ├── LaunchAnimationView.tsx # Pad operations (Crawler-transporter, Astrovan, Gantry tower)
│   ├── RocketBuilder.tsx    # VAB canvas, part snapping, symmetry, CoM/CoT markers
│   ├── SolarSystemMapView.tsx # 2D patched-conic orbital map view
│   └── SpaceportHomeScreen.tsx # Main campus hub
├── data/                    # Game configurations & Celestial catalogs
│   ├── astronauts.ts        # Astronaut roster generation & training stats
│   ├── parts.ts             # Complete PART_CATALOG with masses, dry/wet ratios, thrust, snap points
│   └── planets/             # Planetary bodies, gravity specs, and terrain procedural shaders
├── economy/                 # Science tree, contracts, funds, and space station management
├── graphics/                # High-performance 2D Canvas rendering pipeline
│   ├── flightCanvas2D.ts    # Main flight viewport: camera transform, stars, re-entry plasma, smoke
│   └── partRenderer2D.ts    # Procedural drawing of rocket tanks, bells, shrouds, and plumes
├── physics/                 # Core mathematical & physical simulation loop
│   ├── orbitalMath.ts       # Keplerian state vectors, conic elements, Vis-Viva equation, delta-v
│   ├── physicsEngine.ts     # Newtonian step integrator, aerodynamic drag, re-entry heating, SAS
│   ├── rocketPropulsion.ts  # Juno engine performance, ISP scaling vs altitude, nozzle geometry
│   └── structuralConnectivity.ts # Graph adjacency solver for stage separation & fuel crossfeed
├── types.ts                 # Central TypeScript interfaces, enums, and data definitions
└── utils/                   # Save/load file managers, vector math, and formatting helpers
```

---

## 🔬 How the Physics Engine Works

### 1. Numerical Integration Loop (`src/physics/physicsEngine.ts`)
The simulator updates physics in fixed micro-steps ($dt \approx \frac{1}{60}\text{ s}$ or sub-stepped during high-g maneuvers):

1. **Gravitational Acceleration:**
   $$\vec{a}_g = -\frac{\mu}{r^2} \hat{r}$$
   where $\mu = G \cdot M$ is the gravitational parameter of the primary body (Earth or Moon).
2. **Atmospheric Density & Aerodynamic Drag:**
   $$\rho(h) = \rho_0 \cdot e^{-h / H}$$
   $$\vec{F}_{\text{drag}} = -\frac{1}{2} \rho(h) \cdot v^2 \cdot C_d \cdot A \cdot \hat{v}$$
   Computes dynamic pressure ($Q = \frac{1}{2} \rho v^2$) to simulate Max-Q stresses and atmospheric entry heating.
3. **Thrust & Fuel Consumption:**
   $$F_{\text{thrust}} = \dot{m} \cdot v_e = \dot{m} \cdot (I_{sp} \cdot g_0)$$
   Fuel is drained from structurally connected tanks using the graph traversal solver in `structuralConnectivity.ts`. Decouplers act as firewalls preventing fuel from leaking between stages.
4. **Attitude Control & TVC Gimbal:**
   Engine thrust vectors swivel via Thrust Vector Control (TVC) when pitch controls are pressed, producing realistic turning moments based on distance from the Center of Mass ($CoM$).

### 2. Orbital Mechanics & Conic Predictions (`src/physics/orbitalMath.ts`)
The orbit is continuously computed in real-time from the Cartesian state vector $(\vec{r}, \vec{v})$:
- Specific orbital energy: $\varepsilon = \frac{v^2}{2} - \frac{\mu}{r}$
- Semi-major axis: $a = -\frac{\mu}{2\varepsilon}$
- Eccentricity vector: $\vec{e} = \frac{1}{\mu} [ (v^2 - \frac{\mu}{r})\vec{r} - (\vec{r} \cdot \vec{v})\vec{v} ]$
- Apoapsis & Periapsis:
  $$r_{ap} = a(1 + e) - R_{\text{planet}}$$
  $$r_{pe} = a(1 - e) - R_{\text{planet}}$$

---

## 🚀 How to Add a New Rocket Part

Want to add an Ion engine, a robotic cargo bay, or a nuclear thermal reactor? Follow these steps:

1. Open **`src/data/parts.ts`**.
2. Add your part definition to the `PART_CATALOG` dictionary:
```typescript
custom_ion_thruster: {
  id: 'custom_ion_thruster',
  name: 'Xenon Hall-Effect Thruster',
  category: 'Engines',
  description: 'Ultra-high efficiency electrical propulsion for deep space interplanetary transit.',
  dryMass: 0.25,        // Tonnes
  fuelMass: 0.0,         // Consumes electricity & xenon propellant
  maxThrust: 35,         // kN (Low thrust, immense ISP!)
  ispSeaLevel: 1200,     // Seconds
  ispVacuum: 4200,       // Seconds
  cost: 4500,            // Credits in Career mode
  width: 1.2,
  height: 1.4,
  snapPoints: [
    { x: 0, y: 0.7, type: 'stack' },   // Top attachment node
    { x: 0, y: -0.7, type: 'stack' },  // Bottom attachment node
  ],
  fuelType: 'xenon',
  isGimballed: true,
  gimbalAngle: 6,        // Maximum gimbal deflection in degrees
}
```
3. (Optional) Customize its visual look in `src/graphics/partRenderer2D.ts` if you want a custom rendering style (e.g. glowing cyan xenon plasma emission).
4. Run `npm run dev` and your new part will immediately appear in the VAB palette ready to test!

---

## 🪐 How to Add a New Planet or Moon

Want to add Mars, Venus, or an asteroid?

1. Open **`src/data/planets/index.ts`** (or `solarSystemBodies.ts`).
2. Add your celestial body definition:
```typescript
mars: {
  id: 'mars',
  name: 'Ares (Mars Analogue)',
  radius: 3389500,               // Radius in meters
  mass: 6.4171e23,               // Mass in kg
  surfaceGravity: 3.72,          // m/s^2 (0.38g)
  atmosphereHeight: 45000,       // Thin atmosphere up to 45km
  atmospherePressureSeaLevel: 0.006, // 0.6% of Earth
  semiMajorAxis: 227.9e6 * 1000, // Orbital distance from Sun
  color: '#c2410c',              // Rust red tint
  orbitColor: 'rgba(234, 88, 12, 0.4)',
  landSurface: {
    baseColor: '#7c2d12',
    accentColor: '#9a3412',
    roughness: 0.35,
  }
}
```
3. Update the SOI checking function in `src/physics/physicsEngine.ts` to transition the vessel when passing inside the body's Hill sphere.

---

## 🎮 How to Create a New Minigame

All minigames live in `src/components/minigames/`.
To build a new one (such as a **Space Station EVA spacewalk** or **Satellite Repair**):

1. Create `src/components/minigames/SpacewalkMiniGame.tsx`.
2. Model it as an isolated, self-contained overlay component that accepts:
   ```typescript
   interface SpacewalkMiniGameProps {
     onClose: () => void;
     onSuccess: (reward: { science: number; funds: number }) => void;
   }
   ```
3. Add the launcher button inside `SpaceportHomeScreen.tsx` or as an in-flight alert in `FlightHUD.tsx`.

---

## 💻 Local Development & Verification Workflow

Always test your changes thoroughly before submitting:

```bash
# 1. Install dependencies
npm install

# 2. Run local dev server with Hot Reload
npm run dev

# 3. Type check & Lint (ensure zero TypeScript compile errors)
npm run lint

# 4. Test production build bundle
npm run build
```

---

## 📦 Converting Your Build into a Windows `.exe`

Want to distribute your enhanced version as an executable game for players?

### Option A: Using Electron (Self-Contained Executable)
1. Add Electron dependencies:
   ```bash
   npm install -D electron electron-builder
   ```
2. Create `electron-main.cjs` (as detailed in `README.md`).
3. Add the build script to `package.json`:
   ```json
   "scripts": {
     "package:exe": "vite build && electron-builder --win portable"
   }
   ```
4. Run:
   ```bash
   npm run package:exe
   ```
   The `.exe` is generated in the `release/` directory.

### Option B: Using Tauri (High Performance, Small Size)
If you prefer a lightweight executable (< 10 MB):
1. Install the Tauri CLI:
   ```bash
   npm install -D @tauri-apps/cli
   ```
2. Initialize Tauri:
   ```bash
   npx tauri init
   ```
3. Build the Windows installer or portable binary:
   ```bash
   npx tauri build
   ```

---

## 🤝 Contribution Guidelines & Best Practices

1. **Physics Authenticity:** When modifying orbital math or propulsion equations, document the formula and keep variable names clean (e.g. `apoapsis`, `periapsis`, `eccentricity`, `twr`).
2. **Performance First:** The flight simulation runs in an animation loop (`requestAnimationFrame`). Avoid object allocations (creating new objects or arrays) inside `drawVessel` or `stepPhysics`. Reuse existing vectors and mathematical primitives to prevent Garbage Collection frame stutters.
3. **Save Compatibility:** When adding new fields to `PlacedPart` or `VesselState`, provide safe default values so existing saved rocket designs don't break when loaded.
4. **Pull Requests:** Open a PR with a concise description of the new part, mechanic, or optimization, along with a screenshot or GIF of the feature in action.

*Thank you for helping push the frontiers of space exploration!* 🌌🛠️
