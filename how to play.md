# Space ROC Simulation Flight Training Manual (How to Play) 🚀👨‍🚀

> *"Building a rocket is only half the battle. Flying it into orbit without turning into a fireworks show is the real art."*

Welcome to flight school, Commander! This guide covers everything you need to know to take your rocket from a stack of parts in the assembly building all the way to a circular parking orbit around Earth and a safe landing on the Moon.

---

## 📑 Table of Contents
1. [Game Modes & Spaceport Overview](#1-game-modes--spaceport-overview)
2. [Vehicle Assembly Building (VAB): Rocket Design](#2-vehicle-assembly-building-vab-rocket-design)
3. [Pre-Launch Operations: Rollout & Boarding](#3-pre-launch-operations-rollout--boarding)
4. [Launch & Liftoff Checklist](#4-launch--liftoff-checklist)
5. [The Gravity Turn: Reaching Stable Earth Orbit](#5-the-gravity-turn-reaching-stable-earth-orbit)
6. [Orbital Navigation & The Map View](#6-orbital-navigation--the-map-view)
7. [Translunar Injection (TLI) & Lunar Touchdown](#7-translunar-injection-tli--lunar-touchdown)
8. [Atmospheric Re-entry & Recovery](#8-atmospheric-re-entry--recovery)
9. [Minigames: Docking, Rover Mining, Solar Tracking](#9-minigames-docking-rover-mining-solar-tracking)
10. [Keybindings & Controls Reference](#10-keybindings--controls-reference)
11. [Troubleshooting & Pro Tips](#11-troubleshooting--pro-tips)

---

## 1. Game Modes & Spaceport Overview

When you launch the game, you will arrive at the **Spaceport Campus**:
- **Vehicle Assembly Building (VAB):** Design, customize, balance, and stage your launch vehicles and orbital spacecraft.
- **Launch Complex 39A:** Experience interactive crawlerway rollouts, astronaut transport, gantry elevator ascents, static hot-fire engine tests, and terminal countdowns.
- **Flight Operations (HUD):** Full active flight simulation featuring 60 FPS 2D canvas graphics, orbital conics, atmospheric thermal ionization, and flight telemetry.
- **Solar System Map:** Patched-conic orbital overview showing Apoapsis ($Ap$), Periapsis ($Pe$), planetary positions, and future trajectory arcs.
- **Station Manager & Roster:** View deployed space stations and manage your astronaut corps.
- **Save / Load Data:** Back up your entire career state or export individual rocket blueprint files (`.json`) to share with friends.

---

## 2. Vehicle Assembly Building (VAB): Rocket Design

A great flight begins with a well-engineered rocket. 

### Core Rocket Anatomy:
1. **Command Capsule or Probe Core:**
   - Placed at the top of the stack. Every rocket requires at least one command unit to provide guidance, SAS attitude control, and radio link to Mission Control.
2. **Payload / Heat Shield:**
   - If flying a crewed mission planned for Earth return, attach an **Ablative Heat Shield** directly beneath your capsule.
3. **Upper Stage (Orbital / Lunar Stage):**
   - Use high-efficiency vacuum engines (high specific impulse, $I_{sp} \ge 350\text{ s}$, like Hydrolox or Nuclear Thermal) with an appropriately sized propellant tank.
4. **Interstage Decoupler:**
   - Stack decouplers between stages. The arrow indicates which direction the explosive ring separates.
5. **First Stage (Booster / Liftoff Stage):**
   - High-thrust, sea-level engines (Kerolox or Methalox) capable of lifting the entire stack against gravity.
6. **Aerodynamic Fins:**
   - Mount fins at the base of your booster stage. This shifts the Center of Lift/Pressure ($CoP$) below the Center of Mass ($CoM$), preventing the rocket from flipping during the transonic barrier.

### Golden Rules of Rocket Engineering:
- **TWR (Thrust-to-Weight Ratio) > 1.2 at Liftoff:**
  If your liftoff TWR is less than 1.0, your engines cannot lift the rocket off the pad! Aim for **1.3 to 1.7** for a smooth, controllable ascent.
- **Watch the Center of Mass (CoM):**
  Check the yellow/black marker in the VAB. As propellant drains from bottom tanks, your CoM will shift upward. Ensure your fins remain lower than the CoM throughout the first stage burn.
- **Staging Order:**
  Stages fire from bottom to top (highest numbered stage first, e.g. Stage 1 ignition, Stage 2 separation, Stage 3 payload fairings).

---

## 3. Pre-Launch Operations: Rollout & Boarding

Once you click **Launch**, you enter the live pre-launch sequence at the spaceport:

1. **Crawler-Transporter Rollout:**
   - Press **D** or **Right Arrow** to drive the massive crawler-transporter down the gravel crawlerway from VAB Bay 1 toward Launch Complex 39A.
   - **Crucial Caution:** Keep speed below **3.5 m/s**. If you drive too fast, structural vibration stress will overload the mobile launch platform and collapse the rocket!
2. **Docking on the Pad:**
   - Ease the crawler into the pad boundary until the hold-down latches engage.
3. **Crew Transport (The Astrovan):**
   - Drive your astronaut crew across the access road to the base of the gantry tower.
4. **Gantry Elevator & White Room Boarding:**
   - Ride the elevator up to the capsule level, extend the crew swing arm, and board your crew into the cockpit couches.
5. **Static Hot-Fire Test (Optional but recommended):**
   - Click **Hot Fire** on the pad console to ignite the booster engines for 3 seconds while hold-down clamps remain locked. Verify chamber pressure and gimbal responses before liftoff.

*(In a rush? Click **"Launch Directly (Pad 39A)"** in the top bar to jump straight to the pad!)*

---

## 4. Launch & Liftoff Checklist

1. **Press T** to engage **SAS** (Stability Augmentation System). The blue SAS icon on the HUD will light up.
2. **Press Z** to command **100% Throttle** (or hold **Shift** to throttle up incrementally).
3. **Press Spacebar** to initiate the terminal countdown and release the pad hold-down clamps.
4. **Watch for Liftoff:** At T-0, your engines roar to life and the rocket clears the launch tower. Keep your hands off the steering until you clear 100 meters to avoid striking the gantry!

---

## 5. The Gravity Turn: Reaching Stable Earth Orbit

Going to space is easy; **staying in space requires going sideways at 7,800 m/s**. Do not fly straight up into the sky!

### The Step-by-Step Flight Profile:

| Altitude | Pitch Angle | What to Do |
|---|---|---|
| **0 – 1,000 m** | **90° (Straight Up)** | Clear the dense lower atmosphere. Maintain 100% throttle. |
| **1,000 – 10,000 m** | **Gradual tilt to 70° East (Right)** | Tap **D** or **Right Arrow** gently to pitch 10° to 20° to the right. Let gravity and aerodynamic flow naturally bend your velocity vector. |
| **10,000 – 30,000 m** | **Smooth tilt to 45°** | Pass through **Max-Q** (maximum aerodynamic pressure). Once past 25 km, atmospheric drag drops drastically. |
| **30,000 – 60,000 m** | **Pitch to 20° – 30°** | Push hard sideways to build horizontal orbital velocity. Watch your Apoapsis ($Ap$) in the top HUD telemetry bar. |
| **Apoapsis Reaches 120 km** | **Throttle Cutoff (Press X)** | Once your projected highest point ($Ap$) reaches your target orbit altitude (e.g. 100–150 km), immediately hit **X** to cut your engines. |
| **Coast to Apoapsis** | **Orient to Prograde** | Click the **PROGRADE** button on the SAS navball. Coast outside the atmosphere (above 70 km). |
| **Circularization Burn** | **Full Throttle (Z) at Ap** | About 15 seconds before reaching Apoapsis, fire your second stage at 100% throttle in the prograde direction until your Periapsis ($Pe$) rises above 80 km. **Congratulations, you are now in orbit!** |

---

## 6. Orbital Navigation & The Map View

Press **M** at any time to toggle the **Solar System Orbital Map**:
- **Apoapsis ($Ap$):** The highest point in your orbital trajectory.
- **Periapsis ($Pe$):** The lowest point in your orbital trajectory.
- **Prograde ($\oplus$):** The direction your spacecraft is currently traveling. Burning prograde raises the opposite side of your orbit.
- **Retrograde ($\ominus$):** The direction opposite your motion. Burning retrograde lowers the opposite side of your orbit.
- **Radial-In / Radial-Out:** Tilts the orientation of your orbit ellipse.
- **Normal / Anti-Normal:** Adjusts orbital plane inclination.

---

## 7. Translunar Injection (TLI) & Lunar Touchdown

Ready to visit the Moon? Follow this Apollo-style mission profile:

1. **Wait for the Moon Window:**
   - In orbit around Earth (120 km), open the Map View (**M**).
   - Orient your rocket to burn prograde when the Moon is about 90° ahead in its orbit (roughly rising over Earth's horizon).
2. **The TLI Burn:**
   - Burn prograde until your trajectory ellipse stretches out toward the Moon's orbital path (approx. $v \approx 3,100\text{ m/s}$).
   - Watch the map until a **Moon Encounter** and **Moon Periapsis** indicator appears!
3. **Lunar Orbit Insertion (LOI):**
   - Coast through deep space until you cross the Moon's Sphere of Influence (SOI).
   - As you arrive at your Moon Periapsis (e.g., 25 km altitude), orient **Retrograde** and burn until captured into a stable circular lunar orbit.
4. **Powered Descent & Landing:**
   - Burn retrograde to drop your Periapsis down to 5 km over the target lunar crater.
   - Extend **Landing Legs** (**G** key).
   - Kill your horizontal speed using RCS and main throttle.
   - Keep your vertical descent rate under **3.0 m/s** for touchdown. Once the contact pads touch down, cut throttle (**X**). Welcome to the Moon!

---

## 8. Atmospheric Re-entry & Recovery

Returning your astronauts safely to Earth:

1. **De-orbit Burn:** In Earth orbit, point **Retrograde** and burn until your Periapsis drops to **30 km** inside the Earth's atmosphere.
2. **Jettison Service Module:** Press **Spacebar** to decouple your orbital service stage. Only the heat shield and crew capsule should re-enter!
3. **Heat Shield Forward:** Align the heat shield directly against the incoming supersonic wind (Retrograde).
4. **Survive the Plasma Sheath:** Watch the thermal ionization shockwave envelope your capsule. Maintain attitude so the heat shield absorbs the convective heat flux.
5. **Parachute Deployment:** Once velocity drops below 250 m/s and altitude drops below 3,000 meters, deploy parachutes for a gentle touchdown in the ocean.

---

## 9. Minigames: Docking, Rover Mining, Solar Tracking

From the Spaceport Campus or in-flight alerts, you can launch specialized interactive minigames:
- **Orbital Docking Simulator:**
  Align translational RCS thrusters (I/J/K/L) and rotational attitude (A/D) to match velocity and docking collar orientation with an orbiting space station.
- **Lunar Rover Mining:**
  Drive a surface rover across regolith craters, locate high-yield titanium/helium-3 ore veins, deploy drill heads, and load transport canisters.
- **Solar Array Alignment:**
  Calibrate photovoltaic solar panels to maintain optimal sun angle ($\theta \approx 90^\circ$) to maximize battery recharging efficiency.

---

## 10. Keybindings & Controls Reference

### Throttle & Propulsion
- **Spacebar:** Stage Separation / Engine Ignition
- **Shift:** Throttle Up (+5%)
- **Ctrl:** Throttle Down (-5%)
- **Z:** Instant Full Throttle (100%)
- **X:** Instant Throttle Cutoff (0%)

### Attitude & Pitch Steering
- **A / Left Arrow:** Pitch Left / Anti-Clockwise
- **D / Right Arrow:** Pitch Right / Clockwise
- **T:** Toggle SAS Autopilot
- **R:** Toggle RCS Thrusters

### RCS Translation (Docking & Landing)
- **I:** RCS Translate Forward (Up)
- **K:** RCS Translate Aft (Down)
- **J:** RCS Translate Port (Left)
- **L:** RCS Translate Starboard (Right)

### Views, Systems, & Camera
- **M:** Toggle Solar System Map View
- **G:** Toggle Landing Gear / Legs
- **Scroll Wheel / Plus / Minus:** Zoom In / Zoom Out
- **Click + Drag:** Pan Camera View
- **Escape:** Pause Flight / Open Mission Menu

---

## 11. Troubleshooting & Pro Tips

- **Why is my rocket flipping during launch?**
  - Your Center of Mass ($CoM$) is too low or your rocket is top-heavy with drag. Add aerodynamic fins at the very bottom, keep your payload fairing streamlined, and avoid pitching hard while traveling through the dense lower atmosphere (under 10 km).
- **Why are my engines not firing?**
  - Check that your throttle is up (**Z** or **Shift**).
  - Verify that the active stage contains propellant tanks structurally connected to the engine. Unactivated decouplers block propellant flow!
- **My rocket collapsed on the crawlerway!**
  - Crawlers weigh thousands of tons! Keep speed below 3.5 m/s. Accelerate and brake gently.
- **How do I recover stranded astronauts?**
  - Build a rescue craft with an empty command module, launch to rendezvous orbit, and match velocities within 50 meters to transfer crew.

*Fly safe, Commander! The stars are waiting.* 🌟
