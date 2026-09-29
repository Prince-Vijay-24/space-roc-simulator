# Space ROC Simulation: 2D Orbital Spaceflight Simulator 🚀🌌

> *"Space isn't just about going high; it's about going fast enough sideways so you keep falling around the planet."*

Welcome to **Space ROC Simulation**, a 2D realistic orbital spaceflight simulator built from scratch using TypeScript, React 19, HTML5 Canvas, and custom Newtonian & Keplerian orbital physics. 

I built this game out of a deep love for space exploration, Kerbal Space Program (KSP), and SimpleRockets. My goal was to create a simulator that runs smoothly in any modern web browser or as a standalone desktop game—without needing a massive 50 GB download—while preserving real physics: patched-conic orbital math, aerodynamic drag, supersonic shockwaves, TVC gimbal control, modular stage decoupling, crawler-transporter pad rollouts, and lunar missions.

---

## 🛰️ Highlights & Features

- **Modular Vehicle Assembly (VAB):**
  - Snap-together rocket parts: command capsules, probes, fuel tanks, fairings, decouplers, RCS thrusters, landing legs, and solar panels.
  - Live Center of Mass (CoM) and Center of Thrust (CoT) telemetry markers.
  - Custom staging sequencer: drag and drop parts into ignition, staging, and separation groups.
  - Advanced engine tuning: nozzle length, cycle selection (Gas Generator, Staged Combustion, Expander), and propellant types (Kerolox, Hydrolox, Methalox).

- **Full Pre-Launch & Pad Operations:**
  - Drive the heavy **Crawler-Transporter** from VAB Bay 1 along the crawlerway to Launch Complex 39A. Keep speed under 3.5 m/s to prevent structural collapse!
  - Drive the **Astrovan** carrying your astronaut crew to the pad.
  - Board the gantry tower elevator and walk the swing arm across the White Room into the command module.
  - Execute static hot-fire clamp tests before committing to the terminal countdown.

- **Realistic Flight Physics Engine:**
  - **Patched Conic Orbits:** Keplerian state vector calculation for Apoapsis ($Ap$), Periapsis ($Pe$), eccentricity ($e$), and orbital velocity ($v$).
  - **Atmospheric Aerodynamics:** Altitude-dependent atmospheric density, supersonic dynamic pressure ($Q$), aerodynamic drag, and transonic buffeting.
  - **Re-entry Heating:** Viscous thermal compression, plasma sheath ionization glow, and ablative heat shield depletion.
  - **SAS Guidance System:** Prograde, Retrograde, Radial-In, Radial-Out, Normal, Anti-Normal, and Heading Hold.
  - **Translational RCS:** 4-axis translation controls (I/J/K/L) for precise orbital rendezvous and lunar touchdowns.

- **Interactive Solar System:**
  - Earth and Moon celestial bodies with true gravitational parameters ($\mu = G \cdot M$), Hill spheres, and Sphere of Influence (SOI) transitions.
  - Interactive map view showing trajectory conics, transfer orbits, and celestial nightside city lights.

- **Spaceport Campus & Astronaut Program:**
  - Manage crew rosters, astronaut specializations, missions, and space station components.
  - Save file manager: Export and import complete mission saves and custom rocket designs as `.json` files.
  - Integrated minigames: Apollo-style orbital docking, lunar rover mining, and solar array sun-tracking.

---

## 🎮 Quick Controls Cheat Sheet

| Key | Action |
|---|---|
| **Space** | Stage Separation / Engine Ignition |
| **Shift** / **Ctrl** | Throttle Up / Throttle Down (Full Throttle = **Z**, Cutoff = **X**) |
| **A** / **D** (or **←** / **→**) | Pitch Left / Pitch Right |
| **I** / **K** | RCS Translate Forward / Aft |
| **J** / **L** | RCS Translate Left / Right |
| **M** | Toggle Solar System Orbital Map View |
| **T** | Toggle SAS (Stability Augmentation System) |
| **R** | Toggle RCS (Reaction Control System) |
| **Scroll Wheel** / **+** / **-** | Camera Zoom In / Zoom Out |

*(For complete flight training, launch checklists, and orbital mechanics tutorials, read [HOW_TO_PLAY.md](./HOW_TO_PLAY.md).)*

---

## 💻 Running the Game Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [npm](https://www.npmjs.com/) or [bun](https://bun.sh/)

### Steps
1. **Clone or download** this repository to your machine.
2. Open your terminal in the project folder and install dependencies:
   ```bash
   npm install
   ```
3. Start the local development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:3000` and start your space program!

---

## 📦 How to Convert into a Standalone `.exe` (Click & Play)

Want to turn this web app into a single `.exe` file that you or your friends can double-click and play on Windows without touching the terminal? Here are the two easiest and most reliable ways:

### Method 1: Electron + Electron-Builder (Recommended, 100% Offline)

This packages the game with an embedded Chromium engine so it runs just like a native Steam game with full hardware acceleration.

#### Step 1: Install Electron packages
Inside your project root folder, run:
```bash
npm install -D electron electron-builder wait-on cross-env
```

#### Step 2: Create `electron-main.cjs`
Create a file named `electron-main.cjs` in your project root with the following code:
```javascript
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#020617',
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Keeps physics smooth when alt-tabbed
    },
    autoHideMenuBar: true,
  });

  Menu.setApplicationMenu(null); // Clean borderless game feel

  // Load the built production app
  win.loadFile(path.join(__dirname, 'dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

#### Step 3: Add Build Scripts to `package.json`
Open your `package.json` and add `"main": "electron-main.cjs"` and these scripts:
```json
{
  "main": "electron-main.cjs",
  "scripts": {
    "build:exe": "vite build && electron-builder --win portable"
  },
  "build": {
    "appId": "com.spaceroc.simulation",
    "productName": "Space ROC Simulation",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "electron-main.cjs"
    ],
    "win": {
      "target": ["portable"]
    }
  }
}
```

#### Step 4: Generate the `.exe`
Run:
```bash
npm run build:exe
```
When it finishes, check your new `release/` folder. You will find **`Space ROC Simulation.exe`**. Just double-click it and enjoy smooth 60 FPS orbital flight!

---

### Method 2: Instant Nativefier Wrapper (Fastest, 1 Command)

If you already have Node.js installed on your Windows machine and want an instant desktop app without modifying any files:

1. Build the production files:
   ```bash
   npm run build
   npm run preview
   ```
2. In another terminal, run:
   ```bash
   npx nativefier --name "Space ROC Simulation" "http://localhost:3000" --width 1366 --height 768 --single-instance
   ```
Nativefier will automatically download the Chromium runtime and output an executable folder with `Space ROC Simulation.exe` ready to play.

---

## 🛠️ Tech Stack & Architecture

- **Engine Core:** TypeScript 5.8, custom 2D Canvas vector rendering engine.
- **Frontend Framework:** React 19 with Vite 6 build system.
- **Styling & UI:** Tailwind CSS v4, Lucide React iconography.
- **Audio Engine:** Web Audio API sound synthesizer producing procedural rocket rumble, wind shear noise, staging clanks, and radio beeps.
- **State & Data:** Zero external cloud dependencies; local browser persistence with complete JSON save/load export capability.

---

## 🤝 Community & Contributing

Have an idea for a new propulsion system (Ion drives, nuclear thermal aerospikes)? Want to add Mars and Jupiter transfer trajectories? Check out [CONTRIBUTING.md](./CONTRIBUTING.md) to learn how the codebase is organized and how you can add parts, planets, and features.

---

## 📄 License

Created with passion for space enthusiasts, students, and indie game developers. Feel free to remix, build new stages, and expand the solar system!
