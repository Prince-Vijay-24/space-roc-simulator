import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameMode, OrbitParameters, PlacedPart, VesselState, UserControls } from './types';
import { PRESET_ROCKETS, PART_CATALOG } from './data/parts';
import { physicsEngine } from './physics/physicsEngine';
import { OrbitalMath } from './physics/orbitalMath';
import { FlightCanvas2D } from './graphics/flightCanvas2D';
import { RocketBuilder } from './components/RocketBuilder';
import { FlightHUD } from './components/FlightHUD';
import { SolarSystemMapView } from './components/SolarSystemMapView';
import { StationManager } from './components/StationManager';
import { SpaceportHomeScreen } from './components/SpaceportHomeScreen';
import { LaunchAnimationView } from './components/LaunchAnimationView';
import { soundEngine } from './audio/soundEngine';
import { DockingMiniGame } from './components/minigames/DockingMiniGame';
import { RoverMiningMiniGame } from './components/minigames/RoverMiningMiniGame';
import { SolarAlignmentMiniGame } from './components/minigames/SolarAlignmentMiniGame';
import { SaveDataModal } from './components/SaveDataModal';
import { TutorialHelpModal } from './components/TutorialHelpModal';
import { performAutoSave } from './utils/saveFileManager';
import { Save, Check } from 'lucide-react';

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('SPACEPORT');
  const defaultParts: PlacedPart[] = PRESET_ROCKETS?.[0]?.parts || [];
  const [placedParts, setPlacedParts] = useState<PlacedPart[]>(defaultParts);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);
  const [autoSaveNotification, setAutoSaveNotification] = useState<string | null>(null);
  const [activeMiniGame, setActiveMiniGame] = useState<'DOCKING' | 'ROVER_MINING' | 'SOLAR_ALIGN' | null>(null);
  const [vessel, setVessel] = useState<VesselState>(() => physicsEngine.createInitialVessel(defaultParts));
  const [orbit, setOrbit] = useState<OrbitParameters>(() =>
    OrbitalMath.calculateOrbit(
      physicsEngine.createInitialVessel(defaultParts),
      physicsEngine.earth,
      {
        x: physicsEngine.moonX,
        y: physicsEngine.moonY,
        vx: physicsEngine.moonVx,
        vy: physicsEngine.moonVy,
        radius: physicsEngine.moon.radius,
        soiRadius: physicsEngine.moon.soiRadius,
        orbitRadius: physicsEngine.moon.orbitRadius,
        orbitSpeed: physicsEngine.moon.orbitSpeed,
      }
    )
  );
  const [timeWarp, setTimeWarp] = useState<number>(1);
  const [isMapMode, setIsMapMode] = useState<boolean>(false);
  const [activeActionGroups, setActiveActionGroups] = useState<Set<number>>(new Set());

  const handleActivateActionGroup = (group: number) => {
    setActiveActionGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

    const isGroupActive = !activeActionGroups.has(group);
    let updated = false;

    vesselRef.current.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (p.actionGroup === group) {
        updated = true;
        if (def?.isSolarPanel) {
          p.deployed = isGroupActive;
          vesselRef.current.solarPanelsDeployed = isGroupActive;
        } else if (def?.isLandingLeg) {
          p.deployed = isGroupActive;
          vesselRef.current.landingLegsDeployed = isGroupActive;
        } else if (def?.isWheel || def?.id.includes('wheel')) {
          p.activated = isGroupActive;
        } else if (def?.isParachute) {
          p.deployed = true;
          vesselRef.current.parachutesDeployed = true;
        } else if (def?.maxThrust && def.maxThrust > 0) {
          p.isEngineOn = isGroupActive;
        } else if (def?.isMiningDrill) {
          p.isDrillActive = isGroupActive;
          vesselRef.current.isDrilling = isGroupActive;
        } else if (def?.isRefinery) {
          p.isRefineryActive = isGroupActive;
          vesselRef.current.isRefining = isGroupActive;
        } else if (def?.isSmelter) {
          p.isSmelterActive = isGroupActive;
          vesselRef.current.isSmelting = isGroupActive;
        } else if (def?.isDecoupler || def?.id.includes('decoupler') || def?.id.includes('separator')) {
          physicsEngine.executeStage(vesselRef.current);
        } else {
          p.deployed = isGroupActive;
        }
      }
    });

    if (updated) {
      soundEngine.playRotateClickSound();
      setVessel({ ...vesselRef.current });
    }
  };

  const containerRef = useRef<HTMLDivElement | null>(null);
  const flightCanvasRef = useRef<FlightCanvas2D | null>(null);
  const vesselRef = useRef<VesselState>(vessel);
  const keysRef = useRef<UserControls>({
    steerLeft: false,
    steerRight: false,
    stagePressed: false,
    translateLeft: false,
    translateRight: false,
    translateUp: false,
    translateDown: false,
  });

  // Auto-Save every 10 minutes (600,000 ms)
  useEffect(() => {
    const AUTO_SAVE_INTERVAL_MS = 10 * 60 * 1000;
    const autoSaveTimer = setInterval(() => {
      try {
        const partsToSave = (vesselRef.current?.parts && vesselRef.current.parts.length > 0)
          ? vesselRef.current.parts
          : placedParts;
        performAutoSave(partsToSave);
        const timeStr = new Date().toLocaleTimeString();
        setAutoSaveNotification(`Auto-saved at ${timeStr}`);
        setTimeout(() => setAutoSaveNotification(null), 4000);
      } catch (err) {
        console.warn('Auto-save error:', err);
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(autoSaveTimer);
  }, [placedParts]);

  // Global Flight Manual / Tutorial Help hotkey (H or F1)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;
      if (e.key === 'h' || e.key === 'H' || e.key === 'F1') {
        e.preventDefault();
        setIsTutorialOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Launch Rocket: triggers rollout / pad liftoff animation sequence, then transitions into active flight
  const handleLaunch = (parts: PlacedPart[]) => {
    soundEngine.init();
    setPlacedParts(parts);
    const newVessel = physicsEngine.createInitialVessel(parts);
    vesselRef.current = newVessel;
    setVessel(newVessel);
    setTimeWarp(1);
    setIsMapMode(false);
    setGameMode('ROLLOUT');
  };

  // Complete launch transition into active flight simulation
  const handleCompleteLaunchToFlight = () => {
    soundEngine.init();
    const cleanVessel = physicsEngine.createInitialVessel(placedParts);
    vesselRef.current = cleanVessel;
    setVessel(cleanVessel);
    setTimeWarp(1);
    setIsMapMode(false);
    setGameMode('FLIGHT');
    if (flightCanvasRef.current) {
      flightCanvasRef.current.resetCameraFocus();
      flightCanvasRef.current.setMapMode(false);
    }
  };

  // Revert to Launchpad (T-0)
  const handleRevertToLaunch = () => {
    soundEngine.init();
    const newVessel = physicsEngine.createInitialVessel(placedParts);
    vesselRef.current = newVessel;
    setVessel(newVessel);
    setTimeWarp(1);
    setIsMapMode(false);
    if (flightCanvasRef.current) {
      flightCanvasRef.current.resetCameraFocus();
      flightCanvasRef.current.setMapMode(false);
    }
  };

  // Return to VAB Builder
  const handleReturnToVAB = () => {
    setTimeWarp(1);
    setIsMapMode(false);
    setGameMode('BUILD');
  };

  // Return to Spaceport Campus
  const handleReturnToSpaceport = () => {
    setTimeWarp(1);
    setIsMapMode(false);
    setGameMode('SPACEPORT');
  };

  // Handle in-flight part interaction (engine toggle, decoupling, legs, solar panels, chute)
  const handlePartClick = useCallback((partUid: string) => {
    soundEngine.init();
    const success = physicsEngine.interactWithPart(vesselRef.current, partUid);
    if (success) {
      setVessel({ ...vesselRef.current });
    }
  }, []);

  // Keyboard Handlers for Flight Control
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      soundEngine.init();
      if (gameMode === 'BUILD') return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const ok = physicsEngine.executeStage(vesselRef.current);
        if (ok && flightCanvasRef.current) {
          flightCanvasRef.current.triggerStagingEffect(vesselRef.current.x, vesselRef.current.y, vesselRef.current.angle);
        }
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        keysRef.current.steerLeft = true;
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        keysRef.current.steerRight = true;
      } else if (e.key === 'Shift' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        const stageFuel = vesselRef.current.stageFuelMass !== undefined ? vesselRef.current.stageFuelMass : vesselRef.current.fuelMass;
        const hasLiveSolid = vesselRef.current.parts.some((p) => {
          const def = PART_CATALOG[p.partId];
          const isSolid = Boolean(def?.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');
          return isSolid && (p.fuelRemaining || 0) > 0.0001;
        });
        if ((stageFuel > 0.0001 && vesselRef.current.fuelMass > 0.0001) || hasLiveSolid) {
          const fuelPct = vesselRef.current.fuelPercent || 0;
          const maxTh = fuelPct < 5.0 ? Math.max(0, fuelPct / 5.0) : 1.0;
          vesselRef.current.throttle = Math.min(maxTh, vesselRef.current.throttle + 0.1);
          if (vesselRef.current.throttle > 0) {
            vesselRef.current.parts.forEach((p) => {
              const def = PART_CATALOG[p.partId];
              if (def && def.maxThrust > 0 && p.stage === vesselRef.current.activeStageIndex && p.isEngineOn === false) {
                p.isEngineOn = true;
              }
            });
          }
        }
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'Control' || e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        vesselRef.current.throttle = Math.max(0.0, vesselRef.current.throttle - 0.1);
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'z' || e.key === 'Z') {
        const stageFuel = vesselRef.current.stageFuelMass !== undefined ? vesselRef.current.stageFuelMass : vesselRef.current.fuelMass;
        const hasLiveSolid = vesselRef.current.parts.some((p) => {
          const def = PART_CATALOG[p.partId];
          const isSolid = Boolean(def?.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');
          return isSolid && (p.fuelRemaining || 0) > 0.0001;
        });
        if ((stageFuel > 0.0001 && vesselRef.current.fuelMass > 0.0001) || hasLiveSolid) {
          const fuelPct = vesselRef.current.fuelPercent || 0;
          const maxTh = fuelPct < 5.0 ? Math.max(0, fuelPct / 5.0) : 1.0;
          vesselRef.current.throttle = maxTh;
          vesselRef.current.parts.forEach((p) => {
            const def = PART_CATALOG[p.partId];
            if (def && def.maxThrust > 0 && p.stage === vesselRef.current.activeStageIndex && p.isEngineOn === false) {
              p.isEngineOn = true;
            }
          });
        }
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'x' || e.key === 'X') {
        vesselRef.current.throttle = 0.0;
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'e' || e.key === 'E') {
        const nextState = physicsEngine.toggleEngines(vesselRef.current);
        if (nextState && vesselRef.current.throttle <= 0) {
          const fuelPct = vesselRef.current.fuelPercent || 0;
          vesselRef.current.throttle = fuelPct < 5.0 ? Math.max(0, fuelPct / 5.0) : 1.0;
        }
        soundEngine.playStageSound();
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'j' || e.key === 'J') {
        keysRef.current.translateLeft = true;
      } else if (e.key === 'l' || e.key === 'L') {
        keysRef.current.translateRight = true;
      } else if (e.key === 'i' || e.key === 'I') {
        keysRef.current.translateUp = true;
      } else if (e.key === 'k' || e.key === 'K') {
        keysRef.current.translateDown = true;
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMapMode((prev) => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        vesselRef.current.rcsActive = !vesselRef.current.rcsActive;
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'g' || e.key === 'G') {
        physicsEngine.toggleAllLandingLegs(vesselRef.current);
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'p' || e.key === 'P') {
        vesselRef.current.parachutesDeployed = true;
        soundEngine.playParachuteSound();
        setVessel({ ...vesselRef.current });
      } else if (e.key === 'u' || e.key === 'U') {
        vesselRef.current.solarPanelsDeployed = !vesselRef.current.solarPanelsDeployed;
        setVessel({ ...vesselRef.current });
      } else if (e.key === '+' || e.key === '=') {
        if (flightCanvasRef.current) {
          flightCanvasRef.current.setZoom(flightCanvasRef.current.zoom * 1.25);
        }
      } else if (e.key === '-' || e.key === '_') {
        if (flightCanvasRef.current) {
          flightCanvasRef.current.setZoom(flightCanvasRef.current.zoom * 0.8);
        }
      } else if (e.key === '1') setTimeWarp(1);
      else if (e.key === '2') setTimeWarp(2);
      else if (e.key === '3') setTimeWarp(5);
      else if (e.key === '4') setTimeWarp(25);
      else if (e.key === '5') setTimeWarp(100);
      else if (e.key === '6') setTimeWarp(1000);
      else if (e.key === 'F1') { e.preventDefault(); handleActivateActionGroup(1); }
      else if (e.key === 'F2') { e.preventDefault(); handleActivateActionGroup(2); }
      else if (e.key === 'F3') { e.preventDefault(); handleActivateActionGroup(3); }
      else if (e.key === 'F4') { e.preventDefault(); handleActivateActionGroup(4); }
      else if (e.key === 'F5') { e.preventDefault(); handleActivateActionGroup(5); }
      else if (e.key === 'F6') { e.preventDefault(); handleActivateActionGroup(6); }
      else if (e.key === 'F7') { e.preventDefault(); handleActivateActionGroup(7); }
      else if (e.key === 'F8') { e.preventDefault(); handleActivateActionGroup(8); }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        keysRef.current.steerLeft = false;
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        keysRef.current.steerRight = false;
      } else if (e.key === 'j' || e.key === 'J') {
        keysRef.current.translateLeft = false;
      } else if (e.key === 'l' || e.key === 'L') {
        keysRef.current.translateRight = false;
      } else if (e.key === 'i' || e.key === 'I') {
        keysRef.current.translateUp = false;
      } else if (e.key === 'k' || e.key === 'K') {
        keysRef.current.translateDown = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameMode]);

  // Initialize 2D Canvas Flight Renderer
  useEffect(() => {
    if (gameMode === 'FLIGHT' && containerRef.current && !flightCanvasRef.current) {
      try {
        const canvas2d = new FlightCanvas2D(containerRef.current);
        canvas2d.onPartClick = handlePartClick;
        flightCanvasRef.current = canvas2d;
      } catch (err) {
        console.warn('FlightCanvas2D initialization warning:', err);
      }
    }
    return () => {
      if (flightCanvasRef.current) {
        flightCanvasRef.current.destroy();
        flightCanvasRef.current = null;
      }
    };
  }, [gameMode, handlePartClick]);

  // Main Simulation Loop
  useEffect(() => {
    if (gameMode !== 'FLIGHT') return;

    let lastTime = performance.now();
    let lastReactUpdateTime = performance.now();
    let animationFrameId: number;

    const gameLoop = (currentTime: number) => {
      const deltaSec = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      const effectiveDt = deltaSec * timeWarp;

      // 1. Step Physics Engine safely
      const prevCrashed = vesselRef.current.isCrashed;
      try {
        physicsEngine.step(vesselRef.current, effectiveDt, keysRef.current);
      } catch (err) {
        console.warn('Physics step warning:', err);
      }

      if (!prevCrashed && vesselRef.current.isCrashed && flightCanvasRef.current) {
        flightCanvasRef.current.triggerExplosion(vesselRef.current.x, vesselRef.current.y);
      }

      // 2. Calculate Orbit Parameters safely
      let calculatedOrbit = orbit;
      try {
        const activeBody = vesselRef.current.soi === 'moon' ? physicsEngine.moon : physicsEngine.earth;
        calculatedOrbit = OrbitalMath.calculateOrbit(
          vesselRef.current,
          activeBody,
          {
            x: physicsEngine.moonX,
            y: physicsEngine.moonY,
            vx: physicsEngine.moonVx,
            vy: physicsEngine.moonVy,
            radius: physicsEngine.moon.radius,
            soiRadius: physicsEngine.moon.soiRadius,
            orbitRadius: physicsEngine.moon.orbitRadius,
            orbitSpeed: physicsEngine.moon.orbitSpeed,
          }
        );
      } catch (err) {
        console.warn('Orbit calculation warning:', err);
      }

      // 3. Update 2D Graphics Canvas if in flight mode (not map) with protective error handling
      if (flightCanvasRef.current && !isMapMode) {
        try {
          flightCanvasRef.current.render(vesselRef.current, calculatedOrbit, deltaSec);
        } catch (renderErr) {
          console.warn('Canvas render error intercepted safely:', renderErr);
        }
      }

      // 4. Update React State throttled to avoid UI freeze or white screen memory churn
      const shouldForceUpdate = prevCrashed !== vesselRef.current.isCrashed;
      if (shouldForceUpdate || currentTime - lastReactUpdateTime > 80) {
        lastReactUpdateTime = currentTime;
        setVessel({ ...vesselRef.current });
        setOrbit(calculatedOrbit);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameMode, timeWarp, isMapMode]);

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden select-none font-sans">
      {/* 1. Spaceport Campus Home Screen (VAB, Launch Pad, Astronet HQ, Warehouse, Mining Foundry) */}
      {gameMode === 'SPACEPORT' && (
        <SpaceportHomeScreen
          onNavigate={(mode) => setGameMode(mode)}
          rocketParts={placedParts}
          onLaunch={() => handleLaunch(placedParts)}
          onOpenMiniGame={(type) => setActiveMiniGame(type)}
          onOpenSaveModal={() => setIsSaveModalOpen(true)}
          onOpenTutorial={() => setIsTutorialOpen(true)}
        />
      )}

      {/* 2. 2D VAB Rocket Builder */}
      {gameMode === 'BUILD' && (
        <RocketBuilder
          initialParts={placedParts}
          onLaunch={handleLaunch}
          onOpenStation={() => setGameMode('STATION')}
          onReturnToSpaceport={handleReturnToSpaceport}
          onOpenSaveModal={() => setIsSaveModalOpen(true)}
        />
      )}

      {/* 3. Rocket Launch Animation Sequence (Rollout to Pad 39A -> Engine Ignition -> Liftoff) */}
      {gameMode === 'ROLLOUT' && (
        <LaunchAnimationView
          parts={placedParts}
          onCompleteLaunch={handleCompleteLaunchToFlight}
          onAbortToVAB={() => setGameMode('BUILD')}
          onReturnToSpaceport={handleReturnToSpaceport}
        />
      )}

      {/* 4. Space Agency Station Manager */}
      {gameMode === 'STATION' && (
        <StationManager
          onBackToBuilder={() => setGameMode('BUILD')}
          onLaunchRocket={() => handleLaunch(placedParts)}
          onReturnToSpaceport={handleReturnToSpaceport}
        />
      )}

      {/* 5. 2D Space Flight & Solar System Map Canvas */}
      {gameMode === 'FLIGHT' && (
        <div className="relative w-full h-full">
          {/* Flight 2D World Canvas (visible when not in map mode) */}
          <div 
            ref={containerRef} 
            className={`w-full h-full block bg-slate-950 ${isMapMode ? 'hidden' : 'block'}`} 
          />

          {/* Minimalist Flight HUD (when in direct flight view) */}
          {!isMapMode && (
            <FlightHUD
              vessel={vessel}
              orbit={orbit}
              timeWarp={timeWarp}
              isMapMode={isMapMode}
              onThrottleChange={(th) => {
                const stageFuel = vesselRef.current.stageFuelMass !== undefined ? vesselRef.current.stageFuelMass : vesselRef.current.fuelMass;
                const hasLiveSolid = vesselRef.current.parts.some((p) => {
                  const def = PART_CATALOG[p.partId];
                  const isSolid = Boolean(def?.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');
                  return isSolid && (p.fuelRemaining || 0) > 0.0001;
                });
                if ((stageFuel <= 0.0001 || vesselRef.current.fuelMass <= 0.0001) && !hasLiveSolid) {
                  vesselRef.current.throttle = 0;
                  setVessel({ ...vesselRef.current });
                  return;
                }
                const fuelPct = vesselRef.current.fuelPercent || 0;
                const maxTh = fuelPct < 5.0 ? Math.max(0, fuelPct / 5.0) : 1.0;
                const finalTh = Math.min(th, maxTh);
                vesselRef.current.throttle = finalTh;
                if (finalTh > 0) {
                  vesselRef.current.parts.forEach((p) => {
                    const def = PART_CATALOG[p.partId];
                    if (def && def.maxThrust > 0 && p.stage === vesselRef.current.activeStageIndex && p.isEngineOn === false) {
                      p.isEngineOn = true;
                    }
                  });
                }
                setVessel({ ...vesselRef.current });
              }}
              onToggleEngine={() => {
                const nextState = physicsEngine.toggleEngines(vesselRef.current);
                if (nextState && vesselRef.current.throttle <= 0) {
                  const fuelPct = vesselRef.current.fuelPercent || 0;
                  vesselRef.current.throttle = fuelPct < 5.0 ? Math.max(0, fuelPct / 5.0) : 1.0;
                }
                soundEngine.playStageSound();
                setVessel({ ...vesselRef.current });
              }}
              onSteerStart={(dir) => {
                if (dir === 'left') {
                  keysRef.current.steerLeft = true;
                  keysRef.current.steerRight = false;
                } else {
                  keysRef.current.steerRight = true;
                  keysRef.current.steerLeft = false;
                }
              }}
              onSteerEnd={() => {
                keysRef.current.steerLeft = false;
                keysRef.current.steerRight = false;
              }}
              onStageExecute={() => {
                const ok = physicsEngine.executeStage(vesselRef.current);
                if (ok && flightCanvasRef.current) {
                  flightCanvasRef.current.triggerStagingEffect(vesselRef.current.x, vesselRef.current.y, vesselRef.current.angle);
                }
                setVessel({ ...vesselRef.current });
              }}
              onToggleMap={() => setIsMapMode(true)}
              onSetTimeWarp={(w) => setTimeWarp(w)}
              onToggleRCS={() => {
                vesselRef.current.rcsActive = !vesselRef.current.rcsActive;
                setVessel({ ...vesselRef.current });
              }}
              onToggleSAS={(mode) => {
                vesselRef.current.sasMode = mode;
                setVessel({ ...vesselRef.current });
              }}
              onToggleGear={() => {
                vesselRef.current.landingLegsDeployed = !vesselRef.current.landingLegsDeployed;
                setVessel({ ...vesselRef.current });
              }}
              onToggleSolarPanels={() => {
                vesselRef.current.solarPanelsDeployed = !vesselRef.current.solarPanelsDeployed;
                setVessel({ ...vesselRef.current });
              }}
              onDeployParachute={() => {
                vesselRef.current.parachutesDeployed = true;
                soundEngine.playParachuteSound();
                setVessel({ ...vesselRef.current });
              }}
              onToggleDrill={() => {
                vesselRef.current.isDrilling = !vesselRef.current.isDrilling;
                setVessel({ ...vesselRef.current });
              }}
              onToggleRefinery={() => {
                vesselRef.current.isRefining = !vesselRef.current.isRefining;
                setVessel({ ...vesselRef.current });
              }}
              onToggleSmelter={() => {
                vesselRef.current.isSmelting = !vesselRef.current.isSmelting;
                setVessel({ ...vesselRef.current });
              }}
              onActivateActionGroup={handleActivateActionGroup}
              activeActionGroups={activeActionGroups}
              onRevertToLaunch={handleRevertToLaunch}
              onReturnToVAB={handleReturnToVAB}
              onReturnToSpaceport={handleReturnToSpaceport}
              onZoomIn={() => {
                if (flightCanvasRef.current) {
                  flightCanvasRef.current.setZoom(flightCanvasRef.current.zoom * 1.3);
                }
              }}
              onZoomOut={() => {
                if (flightCanvasRef.current) {
                  flightCanvasRef.current.setZoom(flightCanvasRef.current.zoom * 0.77);
                }
              }}
              onResetCamera={() => {
                if (flightCanvasRef.current) {
                  flightCanvasRef.current.resetCameraFocus();
                }
              }}
              onTogglePartEngine={(uid) => {
                const part = vesselRef.current.parts.find((p) => p.uid === uid);
                if (part) {
                  part.isEngineOn = part.isEngineOn === false ? true : false;
                  setVessel({ ...vesselRef.current });
                }
              }}
              onOpenSaveModal={() => setIsSaveModalOpen(true)}
              onOpenTutorial={() => setIsTutorialOpen(true)}
            />
          )}

          {/* Full Solar System Map View (remade from scratch) */}
          {isMapMode && (
            <SolarSystemMapView
              vessel={vessel}
              orbit={orbit}
              timeWarp={timeWarp}
              missionTime={vessel.missionTime || 0}
              onCloseMap={() => setIsMapMode(false)}
              onSetTimeWarp={(w) => setTimeWarp(w)}
              onThrottleChange={(th) => {
                vesselRef.current.throttle = th;
                if (th > 0) {
                  vesselRef.current.parts.forEach((p) => {
                    const def = PART_CATALOG[p.partId];
                    if (def && def.maxThrust > 0 && p.stage === vesselRef.current.activeStageIndex && p.isEngineOn === false) {
                      p.isEngineOn = true;
                    }
                  });
                }
                setVessel({ ...vesselRef.current });
              }}
              onStageExecute={() => {
                const ok = physicsEngine.executeStage(vesselRef.current);
                if (ok && flightCanvasRef.current) {
                  flightCanvasRef.current.triggerStagingEffect(vesselRef.current.x, vesselRef.current.y, vesselRef.current.angle);
                }
                setVessel({ ...vesselRef.current });
              }}
              onSteerStart={(dir) => {
                if (dir === 'left') {
                  keysRef.current.steerLeft = true;
                  keysRef.current.steerRight = false;
                } else {
                  keysRef.current.steerRight = true;
                  keysRef.current.steerLeft = false;
                }
              }}
              onSteerEnd={() => {
                keysRef.current.steerLeft = false;
                keysRef.current.steerRight = false;
              }}
              onToggleSAS={(mode) => {
                vesselRef.current.sasMode = mode;
                setVessel({ ...vesselRef.current });
              }}
              onToggleRCS={() => {
                vesselRef.current.rcsActive = !vesselRef.current.rcsActive;
                setVessel({ ...vesselRef.current });
              }}
            />
          )}
        </div>
      )}

      {/* Mini-Games Modals */}
      {activeMiniGame === 'DOCKING' && (
        <DockingMiniGame onClose={() => setActiveMiniGame(null)} />
      )}
      {activeMiniGame === 'ROVER_MINING' && (
        <RoverMiningMiniGame onClose={() => setActiveMiniGame(null)} />
      )}
      {activeMiniGame === 'SOLAR_ALIGN' && (
        <SolarAlignmentMiniGame onClose={() => setActiveMiniGame(null)} />
      )}

      {/* Global Save File & Fleet Management Modal */}
      <SaveDataModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        activeRocketParts={gameMode === 'FLIGHT' ? vessel.parts : placedParts}
        onLoadRocket={(newParts) => {
          setPlacedParts(newParts);
          const freshVessel = physicsEngine.createInitialVessel(newParts);
          vesselRef.current = freshVessel;
          setVessel(freshVessel);
        }}
        onFullSaveRestored={() => {
          // If a full save was restored, state has been updated into localStorage
          soundEngine.playStageSound();
        }}
      />

      {/* Flight Operations Manual & Tutorial Modal */}
      <TutorialHelpModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      {/* Auto-Save Notification Toast */}
      {autoSaveNotification && (
        <div 
          id="autosave-toast"
          className="fixed bottom-5 right-5 z-50 pointer-events-none flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/60 text-white shadow-xl backdrop-blur-md animate-fade-in text-xs font-medium"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Save className="w-3.5 h-3.5 text-emerald-400" />
          <span>{autoSaveNotification}</span>
        </div>
      )}
    </div>
  );
}
