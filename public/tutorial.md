# Space ROC Simulation Flight Manual & Academy Tutorial 🚀👨‍🚀

Welcome, Flight Commander! This manual contains comprehensive guidance for building, staging, and piloting orbital launch vehicles and lunar spacecraft.

---

## 📑 Quick Navigation
1. **Quick Start: Your First Orbital Launch**
2. **Vehicle Assembly Building (VAB): Rocket Design Principles**
3. **Staging Architecture & Propellant Flow**
4. **The Gravity Turn: Reaching Earth Orbit**
5. **Translunar Injection & Lunar Touchdown**
6. **Keybindings & Controls Reference**

---

## 1. Quick Start: Your First Orbital Launch

### Pre-Flight Checklist:
1. In the **Spaceport**, click **Vehicle Assembly Building (VAB)** or select a rocket preset (e.g., *Falcon 9 Heavy* or *Saturn V*).
2. Click **Launch Rocket** to proceed to Launch Complex 39A.
3. Click **Launch Directly (Pad 39A)** or enjoy the crawlerway rollout and crew boarding sequence.

### Liftoff Sequence:
- **Press T** to turn on **SAS (Stability Augmentation System)**. The blue SAS indicator lights up on your HUD.
- **Press Z** to push throttle instantly to **100%** (or use **Shift / Ctrl** to adjust gradually).
- **Press Spacebar** (or click the **STAGE** button in the lower-right HUD) to ignite your first-stage engines and release the pad clamps!
- Maintain a vertical climb until reaching **1,000 meters**, then begin your gravity turn.

---

## 2. Vehicle Assembly Building (VAB): Rocket Design Principles

A successful mission starts in the assembly building:

### Essential Rocket Anatomy:
- **Command Module / Probe Core:** Located at the top of the stack. Houses flight computers and reaction wheels.
- **Propellant Tanks:** Carry liquid fuel (Kerolox, Hydrolox, or Methalox). Stack them above your engines.
- **Rocket Engines:**
  - *First Stage:* Use high-thrust, sea-level engines (e.g. *Juno Kerolox Booster* or *Merlin-1D*).
  - *Upper Stages:* Use high-efficiency vacuum engines (high specific impulse $I_{sp} \ge 340\text{ s}$, like *Vacuum Merlin* or *RL-10*).
- **Stage Decouplers:** Place stack decouplers between stages to sever spent boosters when propellant is exhausted.
- **Aerodynamic Fins:** Attach 3–4 stabilizing fins at the very bottom of the booster stage. This keeps the Center of Pressure ($CoP$) below the Center of Mass ($CoM$), preventing supersonic tumbling!

### Critical Engineering Metrics:
- **Liftoff TWR (Thrust-to-Weight Ratio):** Must be **> 1.2** at liftoff. Aim for **1.3 – 1.6** for optimal atmospheric ascent.
- **Total Delta-V ($\Delta v$):**
  - **Earth Low Orbit (LEO):** Requires $\approx 3,400\text{ m/s}$.
  - **Lunar Transfer & Touchdown:** Requires $\approx 4,800\text{ m/s}$.

---

## 3. Staging Architecture & Propellant Flow

### How Staging Works:
1. **Stage Firing Order:** Stages activate sequentially from lowest to highest.
2. **Propellant Crossfeed:** When multiple propellant tanks are connected to an engine, the simulator drains outboard booster tanks first, keeping core tanks full until boosters are separated.
3. **Decoupler Separation:** When you press **Spacebar** or click **STAGE**:
   - The stage decoupler ring explodes, severing the physical joint.
   - The spent lower stage or side boosters cleanly detach and drift away with realistic separation velocity.
   - The next stage's engines automatically ignite.
4. **Propellant Gauge (HUD):**
   - The **FUEL** bar in the bottom-right HUD displays the propellant remaining in the active stage's connected tanks in real time.
   - When the active stage's fuel reaches **0%**, execute the next stage immediately to discard dead dry mass and ignite the upper stage!

---

## 4. The Gravity Turn: Reaching Earth Orbit

Do **NOT** fly straight up into the void of space! Staying in orbit requires achieving high horizontal orbital velocity ($\approx 7,800\text{ m/s}$).

### Step-by-Step Flight Profile:
| Altitude | Pitch Angle | Recommended Action |
|---|---|---|
| **0 – 1,000 m** | **0° (Straight Up)** | Clear launch tower and dense surface air. |
| **1,000 – 10,000 m** | **Gently tilt 10° – 30° East (Press D)** | Begin gravity turn into the direction of Earth rotation. |
| **10,000 – 25,000 m** | **Tilt to 45° Pitch** | Max-Q passed. Accelerate horizontally through stratosphere. |
| **25,000 – 35,000 m** | **Tilt to 60° – 75° Pitch** | Thin mesosphere. Build horizontal orbital velocity. |
| **Above 35,000 m** | **Point at Horizon (90° Prograde)** | Space vacuum reached. Burn until Apoapsis ($Ap$) reaches $100\text{ km}$. |

### Orbital Circularization:
1. Once Apoapsis ($Ap$) reaches $100\text{ km}$, throttle down to **0% (Press X)**.
2. Coast along your trajectory until you are **20 seconds before Apoapsis**.
3. Align your rocket with **Prograde** (along velocity vector) and burn at **100% Throttle** until Periapsis ($Pe$) rises above $70\text{ km}$.
4. You are now in a stable, closed parking orbit around Earth!

---

## 5. Translunar Injection (TLI) & Lunar Touchdown

### Flying to the Moon:
1. Open the **Solar System Map (Press M)**.
2. When your Earth parking orbit aligns so that the Moon is approximately **90° ahead** in its orbit, burn **Prograde**.
3. Watch your Apoapsis rise until the projected trajectory intersects the Moon's Sphere of Influence (SOI).
4. Upon entering lunar SOI, point **Retrograde** and burn to capture into low lunar orbit.
5. Kill your horizontal velocity and use gentle throttle pulses to touchdown softly ($< 3\text{ m/s}$) on your landing legs!

---

## 6. Keybindings & Controls Reference

| Key | Action | Description |
|---|---|---|
| **Spacebar** | **Stage / Liftoff** | Execute active stage / ignite engines / decouple |
| **Z** | **Full Throttle (100%)** | Instantly set engine throttle to maximum |
| **X** | **Cut Throttle (0%)** | Instantly cut engine thrust to zero |
| **Shift** | **Throttle Up** | Smoothly increase engine throttle |
| **Ctrl** | **Throttle Down** | Smoothly decrease engine throttle |
| **A / D** | **Pitch / Steer** | Rotate rocket left / right (pitch control) |
| **T** | **Toggle SAS** | Enable / disable stability augmentation gyro |
| **M** | **Map View** | Toggle full Solar System orbital conics map |
| **H / F1** | **Flight Manual** | Open / close this tutorial & help manual |
| **Scroll Wheel** | **Camera Zoom** | Zoom camera in and out |
| **Right-Click Drag**| **Pan Camera** | Pan flight or map camera view |
