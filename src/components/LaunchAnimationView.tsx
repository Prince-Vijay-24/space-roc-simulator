import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PlacedPart, RocketMetrics, Astronaut, JunoEngineConfig } from '../types';
import { PART_CATALOG, getPartHeight, getPartWidth } from '../data/parts';
import { drawPart2D, drawJunoEnginePlume2D } from '../graphics/partRenderer2D';
import { calculateJunoEnginePerformance, DEFAULT_JUNO_ENGINE_CONFIG } from '../physics/rocketPropulsion';
import { physicsEngine } from '../physics/physicsEngine';
import { soundEngine } from '../audio/soundEngine';
import { loadAstronautRoster } from '../data/astronauts';
import {
  FastForward,
  RotateCcw,
  Building2,
  Volume2,
  VolumeX,
  Radio,
  Video,
  AlertTriangle,
  Play,
  Gauge,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Award,
  Flame,
  Rocket,
  Activity,
  Zap,
} from 'lucide-react';

interface LaunchAnimationViewProps {
  parts: PlacedPart[];
  onCompleteLaunch: () => void;
  onAbortToVAB: () => void;
  onReturnToSpaceport: () => void;
}

export type LaunchGamePhase =
  | 'DRIVE_CRAWLER'     // Player drives Crawler-Transporter 2 carrying rocket
  | 'CRAWLER_COLLAPSED' // Rocket collapsed due to excessive speed / stress
  | 'CRAWLER_DOCKED'    // Successfully docked at Pad 39A
  | 'DRIVE_ASTROVAN'    // Player drives Astronet Astrovan carrying astronauts
  | 'ASTROVAN_PARKED'   // Astrovan parked at pad
  | 'PAD_BOARDING'      // Astronauts walk to elevator, ascend tower & ingress capsule
  | 'COCKPIT_READY'     // All crew strapped in, capsule sealed, GO for launch
  | 'COUNTDOWN_IGNITION'// T-minus terminal countdown & engine ignition
  | 'LIFTOFF'           // Clamps released, rocket lifting off pad
  | 'HOT_FIRE';         // Static engine test firing on pad

export const LaunchAnimationView: React.FC<LaunchAnimationViewProps> = ({
  parts,
  onCompleteLaunch,
  onAbortToVAB,
  onReturnToSpaceport,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [phase, setPhase] = useState<LaunchGamePhase>('DRIVE_CRAWLER');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeAstronauts, setActiveAstronauts] = useState<Astronaut[]>([]);
  const [showCrewCam, setShowCrewCam] = useState<boolean>(true);

  // Radio & Comms state
  const [radioMsg, setRadioMsg] = useState<string>(
    'Cape Operations: Crawler-Transporter 2 engine running! Drive vehicle along crawlerway to Pad 39A. Keep speed under 3.5 m/s to prevent rocket collapse!'
  );
  const [crewDialogue, setCrewDialogue] = useState<string>(
    'CDR Neil: "Crawler power on. Ready for rollout to Pad 39A."'
  );

  // -------------------------------------------------------------
  // GAMEPLAY STATE: CRAWLER LOADER VEHICLE
  // -------------------------------------------------------------
  const crawlerPosRef = useRef<number>(0); // 0 (VAB) to 1.0 (Pad 39A)
  const crawlerSpeedRef = useRef<number>(0); // m/s (0 to ~8 m/s)
  const structuralStressRef = useRef<number>(0); // 0 to 100%
  const tiltAngleRef = useRef<number>(0); // dynamic sway in radians
  const isBrakingCrawlerRef = useRef<boolean>(false);
  const isAccelCrawlerRef = useRef<boolean>(false);

  // Collapse animation tracking
  const collapseAnimTimeRef = useRef<number>(0);

  // -------------------------------------------------------------
  // GAMEPLAY STATE: ASTROVAN VEHICLE
  // -------------------------------------------------------------
  const vanPosRef = useRef<number>(0); // 0 (Crew Quarters) to 1.0 (Pad Parking Bay)
  const vanSpeedRef = useRef<number>(0); // m/s (0 to ~25 m/s)
  const vanComfortRef = useRef<number>(100); // 0 to 100%
  const isBrakingVanRef = useRef<boolean>(false);
  const isAccelVanRef = useRef<boolean>(false);

  // -------------------------------------------------------------
  // GAMEPLAY STATE: BOARDING & ELEVATOR
  // -------------------------------------------------------------
  const boardingProgressRef = useRef<number>(0); // 0 to 1.0
  const isWalkingRef = useRef<boolean>(false);

  // -------------------------------------------------------------
  // GAMEPLAY STATE: ENGINE IGNITION, COUNTDOWN & LIFTOFF
  // -------------------------------------------------------------
  const launchThrottleRef = useRef<number>(0);
  const launchIgnitionAgeRef = useRef<number>(999);
  const countdownTimerRef = useRef<number>(3.0);
  const lastCountdownBeepRef = useRef<number>(4);
  const hotFireTimerRef = useRef<number>(4.0);
  const liftoffTimeRef = useRef<number>(0);
  const liftoffVelocityRef = useRef<number>(0);
  const rocketLiftoffAltPxRef = useRef<number>(0);
  const padShakeRef = useRef<number>(0);
  const [hudCountdown, setHudCountdown] = useState<number>(3.0);
  const [hudThrottle, setHudThrottle] = useState<number>(0);
  const [hudHotFireRemaining, setHudHotFireRemaining] = useState<number>(4.0);

  // UI Mirror State for React HUD
  const [hudCrawlerSpeed, setHudCrawlerSpeed] = useState<number>(0);
  const [hudStress, setHudStress] = useState<number>(0);
  const [hudCrawlerProgress, setHudCrawlerProgress] = useState<number>(0);
  const [hudVanSpeed, setHudVanSpeed] = useState<number>(0);
  const [hudVanProgress, setHudVanProgress] = useState<number>(0);
  const [hudVanComfort, setHudVanComfort] = useState<number>(100);
  const [hudBoardingStep, setHudBoardingStep] = useState<number>(0);

  // Load astronaut roster
  useEffect(() => {
    const allAstronauts = loadAstronautRoster();
    const assigned = allAstronauts.filter((a) => a.status === 'assigned');
    if (assigned.length > 0) {
      setActiveAstronauts(assigned);
    } else {
      setActiveAstronauts(allAstronauts.slice(0, 2));
    }
  }, []);

  // Compute rocket metrics
  const metrics: RocketMetrics = React.useMemo(() => {
    return physicsEngine.calculateMetrics(parts);
  }, [parts]);

  // Compute rocket visual bounds
  const rocketBounds = React.useMemo(() => {
    if (!parts || parts.length === 0) {
      return { minY: 0, maxY: 6, minX: -1, maxX: 1, width: 2, height: 6, centerX: 0 };
    }
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;

    parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;
      const baseW = getPartWidth(p, def);
      const baseH = getPartHeight(p, def);
      const rot = (((p.rotation ?? 0) % 180) + 180) % 180;
      const w = rot === 90 ? baseH : baseW;
      const h = rot === 90 ? baseW : baseH;
      minY = Math.min(minY, p.y - h / 2);
      maxY = Math.max(maxY, p.y + h / 2);
      minX = Math.min(minX, p.x - w / 2);
      maxX = Math.max(maxX, p.x + w / 2);
    });

    if (minY === Infinity) {
      minY = 0;
      maxY = 6;
      minX = -1;
      maxX = 1;
    }

    // Preserve core centerline x = 0 alignment with crawler platform
    const hasCenterlineParts = minX <= 0.5 && maxX >= -0.5;
    const centerX = hasCenterlineParts ? 0 : (minX + maxX) / 2;

    return {
      minY,
      maxY,
      minX,
      maxX,
      width: Math.max(1.5, maxX - minX),
      height: Math.max(3, maxY - minY),
      centerX,
    };
  }, [parts]);

  // Keyboard driving controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      soundEngine.init();
      if (e.repeat) return;

      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        isAccelCrawlerRef.current = true;
        isAccelVanRef.current = true;
        isWalkingRef.current = true;
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        isBrakingCrawlerRef.current = true;
        isBrakingVanRef.current = true;
      } else if (e.key === 'h' || e.key === 'H') {
        soundEngine.playVehicleHornSound();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        isAccelCrawlerRef.current = false;
        isAccelVanRef.current = false;
        isWalkingRef.current = false;
      } else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        isBrakingCrawlerRef.current = false;
        isBrakingVanRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Reset / Retry Rollout after collapse
  const handleRestartRollout = useCallback(() => {
    soundEngine.init();
    crawlerPosRef.current = 0;
    crawlerSpeedRef.current = 0;
    structuralStressRef.current = 0;
    tiltAngleRef.current = 0;
    collapseAnimTimeRef.current = 0;
    setPhase('DRIVE_CRAWLER');
    setRadioMsg(
      'Cape Operations: Rollout reset to VAB Bay 1. Drive carefully! Maintain speed in the green zone (<3.5 m/s).'
    );
    setCrewDialogue('CDR Neil: "Restarting rollout. Let\'s keep it steady and safe this time."');
  }, []);

  // Complete launch transition into active flight
  const handleSkipToFlight = useCallback(() => {
    soundEngine.init();
    soundEngine.updateTelemetry(0, false, 0, 0);
    onCompleteLaunch();
  }, [onCompleteLaunch]);

  // Start terminal countdown & liftoff with procedural plume ignition
  const handleStartCountdown = useCallback(() => {
    soundEngine.init();
    countdownTimerRef.current = 3.0;
    lastCountdownBeepRef.current = 4;
    launchIgnitionAgeRef.current = 0;
    launchThrottleRef.current = 0;
    liftoffTimeRef.current = 0;
    liftoffVelocityRef.current = 0;
    rocketLiftoffAltPxRef.current = 0;
    padShakeRef.current = 0;
    setHudCountdown(3.0);
    setHudThrottle(0);
    setPhase('COUNTDOWN_IGNITION');
    soundEngine.playCountdownBeep(false);
    setRadioMsg('Cape Launch Control: Terminal countdown sequence started! T-minus 3 seconds...');
    setCrewDialogue('CDR Neil: "Astronet 1 flight deck ready. Onboard computers taking control."');
  }, []);

  // Start static fire test on pad
  const handleStartHotFire = useCallback(() => {
    soundEngine.init();
    hotFireTimerRef.current = 4.0;
    launchIgnitionAgeRef.current = 0;
    launchThrottleRef.current = 0;
    padShakeRef.current = 0;
    setHudHotFireRemaining(4.0);
    setHudThrottle(0);
    setPhase('HOT_FIRE');
    soundEngine.playStageSound();
    setRadioMsg('Pad Test Cell: Pad 39A hold-down clamps locked. Static engine test firing initiated!');
    setCrewDialogue('ENG Officer: "Chamber pressure sensors active. Engine hot-fire test starting!"');
  }, []);

  // Main Canvas & Simulation Loop
  useEffect(() => {
    soundEngine.init();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let globalTime = 0;
    let lastCreakSoundTime = 0;
    let lastAlarmSoundTime = 0;

    // Helper to draw animated 2D astronaut character
    const drawAstronaut = (
      ax: number,
      ay: number,
      opts: {
        scale?: number;
        isWalking?: boolean;
        walkTime?: number;
        isWaving?: boolean;
        facing?: 'left' | 'right';
        accentColor?: string;
      }
    ) => {
      const s = opts.scale ?? 1.0;
      const t = opts.walkTime ?? 0;
      const isWalking = opts.isWalking ?? false;
      const isWaving = opts.isWaving ?? false;
      const facingLeft = opts.facing === 'left';
      const accent = opts.accentColor || '#38bdf8';

      ctx.save();
      ctx.translate(ax, ay);
      ctx.scale(facingLeft ? -s : s, s);

      const bobY = isWalking ? Math.abs(Math.sin(t * 7)) * -2.5 : 0;
      const legSwing = isWalking ? Math.sin(t * 7) * 5 : 0;

      // Boots & Legs
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-6 + legSwing, -10 + bobY, 4.5, 10);
      ctx.fillRect(1.5 - legSwing, -10 + bobY, 4.5, 10);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-7 + legSwing, -3 + bobY, 6, 4);
      ctx.fillRect(0.5 - legSwing, -3 + bobY, 6, 4);

      // Torso & Life-Support Backpack
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-6, -28 + bobY, 12, 19);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-10, -26 + bobY, 4, 14);

      // Chest Utility Control Pack
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-4, -26 + bobY, 8, 7);
      ctx.fillStyle = accent;
      ctx.fillRect(-3, -24 + bobY, 3, 3);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(1, -24 + bobY, 2, 2);

      // Helmet
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -37 + bobY, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Gold reflective visor
      const visorGrad = ctx.createLinearGradient(0, -42 + bobY, 5, -32 + bobY);
      visorGrad.addColorStop(0, '#f59e0b');
      visorGrad.addColorStop(0.7, '#fbbf24');
      visorGrad.addColorStop(1, '#78350f');
      ctx.fillStyle = visorGrad;
      ctx.beginPath();
      ctx.ellipse(2, -37 + bobY, 4.5, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Visor glare
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.ellipse(3, -39 + bobY, 1.5, 2, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Arms & Gloves
      if (isWaving) {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-6, -27 + bobY, 3.5, 11);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-6.5, -16 + bobY, 4, 3);

        const waveAngle = -2.2 + Math.sin(t * 8) * 0.25;
        ctx.save();
        ctx.translate(5, -27 + bobY);
        ctx.rotate(waveAngle);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-2, 0, 4, 11);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-2.5, 8, 5, 4);
        ctx.restore();
      } else {
        const armAngle = isWalking ? -Math.sin(t * 7) * 0.4 : 0.1;
        ctx.save();
        ctx.translate(5, -27 + bobY);
        ctx.rotate(armAngle);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-2, 0, 4, 11);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(-2.5, 8, 4.5, 3.5);
        ctx.restore();
      }

      ctx.restore();
    };

    const render = (now: number) => {
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;
      globalTime += dt;

      // Resize canvas to parent bounds
      const width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
      const height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

      // ============================================================
      // 1. GAMEPLAY SIMULATION STEP: CRAWLER LOADER VEHICLE
      // ============================================================
      if (phase === 'DRIVE_CRAWLER') {
        const accel = isAccelCrawlerRef.current;
        const brake = isBrakingCrawlerRef.current;

        // Accelerate or decelerate
        if (accel) {
          crawlerSpeedRef.current = Math.min(7.5, crawlerSpeedRef.current + dt * 2.2);
        } else if (brake) {
          crawlerSpeedRef.current = Math.max(0, crawlerSpeedRef.current - dt * 4.0);
        } else {
          // Natural rolling friction on river-rock crawlerway
          crawlerSpeedRef.current = Math.max(0, crawlerSpeedRef.current - dt * 0.85);
        }

        // Advance position along 500-meter crawlerway
        const transitRate = (crawlerSpeedRef.current / 500) * 8; // normalized progress speed
        crawlerPosRef.current = Math.min(1.0, crawlerPosRef.current + transitRate * dt);

        // Calculate dynamic tilt angle due to speed & acceleration
        const safeLimit = 3.2; // m/s
        const speed = crawlerSpeedRef.current;
        const overspeed = Math.max(0, speed - safeLimit);

        const bumpFreq = 6 + speed * 1.5;
        const baseWobble = Math.sin(globalTime * bumpFreq) * (speed / safeLimit) * 0.025;
        const accelKick = (accel ? 0.02 : 0) - (brake ? 0.025 : 0);
        tiltAngleRef.current = baseWobble + accelKick * (speed > 1 ? 1 : 0.3);

        // Structural stress calculations:
        if (overspeed > 0) {
          // Stress increases rapidly with overspeed
          structuralStressRef.current = Math.min(
            100,
            structuralStressRef.current + Math.pow(overspeed, 1.6) * dt * 24
          );

          // Audio warnings when overstressed
          if (structuralStressRef.current > 45 && globalTime - lastCreakSoundTime > 1.2) {
            lastCreakSoundTime = globalTime;
            soundEngine.playMetalCreakSound();
          }
          if (structuralStressRef.current > 75 && globalTime - lastAlarmSoundTime > 0.8) {
            lastAlarmSoundTime = globalTime;
            soundEngine.playKlaxonAlarm();
          }
        } else {
          // Relieve stress in safe speed zone
          structuralStressRef.current = Math.max(0, structuralStressRef.current - dt * 18);
        }

        // Sync React HUD
        setHudCrawlerSpeed(speed);
        setHudStress(structuralStressRef.current);
        setHudCrawlerProgress(crawlerPosRef.current);

        // CHECK COLLAPSE CONDITION:
        if (structuralStressRef.current >= 100) {
          setPhase('CRAWLER_COLLAPSED');
          collapseAnimTimeRef.current = 0;
          soundEngine.playMetalCreakSound();
          soundEngine.playBigExplosionSound();
          soundEngine.playKlaxonAlarm();
          setRadioMsg(
            '🚨 ALERT: CATASTROPHIC ROCKET COLLAPSE! Transport speed exceeded safe limits. The vehicle has toppled on the crawlerway!'
          );
          setCrewDialogue('CAPCOM: "Abort! We lost the vehicle! Structural moment exceeded tolerance."');
        }

        // CHECK ARRIVAL AT PAD 39A:
        if (crawlerPosRef.current >= 0.98 && speed < 1.2) {
          crawlerPosRef.current = 1.0;
          crawlerSpeedRef.current = 0;
          soundEngine.playAirBrakeSound();
          soundEngine.playClampReleaseSound();
          soundEngine.playVictoryFanfare();
          setPhase('CRAWLER_DOCKED');
          setRadioMsg(
            'Pad Operations: Mobile Launcher Platform locked on Pad 39A pedestals! Switching control to Astrovan Crew Transport.'
          );
          setCrewDialogue('CDR Neil: "Rock solid touchdown on Pad 39A mount. Dispatching Astrovan convoy."');

          setTimeout(() => {
            setPhase('DRIVE_ASTROVAN');
            setRadioMsg(
              'Astrovan Escort: You are now driving the Astrovan! Accelerate along the service road to Pad 39A.'
            );
          }, 2000);
        }
      }

      // ============================================================
      // 2. GAMEPLAY SIMULATION STEP: ASTROVAN VEHICLE
      // ============================================================
      if (phase === 'DRIVE_ASTROVAN') {
        const accel = isAccelVanRef.current;
        const brake = isBrakingVanRef.current;

        if (accel) {
          vanSpeedRef.current = Math.min(22, vanSpeedRef.current + dt * 6.5);
        } else if (brake) {
          vanSpeedRef.current = Math.max(0, vanSpeedRef.current - dt * 10);
        } else {
          vanSpeedRef.current = Math.max(0, vanSpeedRef.current - dt * 2.5);
        }

        // Progress along service road
        vanPosRef.current = Math.min(1.0, vanPosRef.current + (vanSpeedRef.current / 300) * 4 * dt);

        // Crew comfort meter
        if (vanSpeedRef.current > 16 || brake) {
          vanComfortRef.current = Math.max(40, vanComfortRef.current - dt * 12);
        } else {
          vanComfortRef.current = Math.min(100, vanComfortRef.current + dt * 8);
        }

        setHudVanSpeed(vanSpeedRef.current);
        setHudVanProgress(vanPosRef.current);
        setHudVanComfort(vanComfortRef.current);

        // Check parking at Pad 39A
        if (vanPosRef.current >= 0.97 && vanSpeedRef.current < 2.0) {
          vanPosRef.current = 1.0;
          vanSpeedRef.current = 0;
          soundEngine.playAirBrakeSound();
          soundEngine.playCountdownBeep(true);
          setPhase('ASTROVAN_PARKED');
          setRadioMsg('Pad Security: Astrovan parked at Pad 39A! Crew cleared to board gantry tower.');
          setCrewDialogue('CDR Neil: "Parked at Pad 39A. Preparing to disembark and take the tower elevator."');
        }
      }

      // ============================================================
      // 3. GAMEPLAY STEP: BOARDING WALK & TOWER ELEVATOR
      // ============================================================
      if (phase === 'PAD_BOARDING') {
        boardingProgressRef.current = Math.min(1.0, boardingProgressRef.current + dt * 0.18);
        setHudBoardingStep(boardingProgressRef.current);

        if (boardingProgressRef.current < 0.35) {
          setRadioMsg('Ground Comms: Astronauts disembarking Astrovan and waving to ground support crews.');
          setCrewDialogue('PLT Buzz: "Pad 39A weather is clear and green. Let\'s go flying!"');
        } else if (boardingProgressRef.current < 0.7) {
          setRadioMsg('Gantry Ops: Elevator ascending Launch Tower to the 60-meter Crew Access Arm.');
          setCrewDialogue('CDR Neil: "Elevator passing 120-foot level. Vehicle looks magnificent from up here."');
        } else if (boardingProgressRef.current < 0.95) {
          setRadioMsg('White Room: Crew walking across swing arm and ingressing Command Module.');
          setCrewDialogue('White Room Lead: "Hatch locked and pressure seal verified. All crew strapped in."');
        } else {
          setPhase('COCKPIT_READY');
          soundEngine.playClampReleaseSound();
          soundEngine.playVictoryFanfare();
          setRadioMsg('Launch Director: Astronauts strapped in! Capsule hatch sealed. GO FOR LAUNCH!');
          setCrewDialogue('CREW: "Astronet 1 flight deck ready. Standing by for manual ignition!"');
        }
      }

      // ============================================================
      // 3B. GAMEPLAY STEP: COUNTDOWN, ENGINE IGNITION & LIFTOFF
      // ============================================================
      if (phase === 'COUNTDOWN_IGNITION') {
        countdownTimerRef.current = Math.max(0, countdownTimerRef.current - dt);
        launchIgnitionAgeRef.current += dt;
        setHudCountdown(countdownTimerRef.current);

        const currentSec = Math.ceil(countdownTimerRef.current);
        if (currentSec !== lastCountdownBeepRef.current && currentSec > 0) {
          lastCountdownBeepRef.current = currentSec;
          soundEngine.playCountdownBeep(currentSec === 1);
        }

        // Main engine ignition begins at T-2.0s
        if (countdownTimerRef.current <= 2.0) {
          launchThrottleRef.current = Math.min(1.0, launchThrottleRef.current + dt * 0.9);
          padShakeRef.current = Math.min(10, padShakeRef.current + dt * 7);
          soundEngine.updateTelemetry(launchThrottleRef.current, true, 0, 0);
        } else {
          launchThrottleRef.current = 0;
          soundEngine.updateTelemetry(0, false, 0, 0);
        }
        setHudThrottle(launchThrottleRef.current);

        if (countdownTimerRef.current <= 0) {
          // T-0: RELEASE CLAMPS & LIFTOFF!
          setPhase('LIFTOFF');
          liftoffTimeRef.current = 0;
          liftoffVelocityRef.current = 0;
          rocketLiftoffAltPxRef.current = 0;
          soundEngine.playClampReleaseSound();
          soundEngine.playCountdownBeep(true);
          setRadioMsg('Launch Control: LIFTOFF! We have liftoff of Astronet 1! Clamps released.');
          setCrewDialogue('CDR Neil: "Liftoff! The clock is running! Astronet 1 is in the air!"');
        } else if (countdownTimerRef.current <= 1.0) {
          setRadioMsg('Launch Control: T-minus 1... All engines ignited! Supersonic thrust nominal.');
        } else if (countdownTimerRef.current <= 2.0) {
          setRadioMsg('Launch Control: T-minus 2... Ignition sequence start!');
          setCrewDialogue('CREW: "Engines started! Chamber pressures green."');
        } else {
          setRadioMsg('Launch Control: T-minus 3 seconds and counting... Guidance is internal.');
        }
      }

      if (phase === 'LIFTOFF') {
        liftoffTimeRef.current += dt;
        launchIgnitionAgeRef.current += dt;
        launchThrottleRef.current = 1.0;
        setHudThrottle(1.0);

        soundEngine.updateTelemetry(1.0, true, 0.1, 0);

        // Rocket accelerates upwards smoothly
        liftoffVelocityRef.current += dt * 14.0;
        rocketLiftoffAltPxRef.current += liftoffVelocityRef.current * dt * 25.0;
        padShakeRef.current = Math.max(0, 12 - liftoffTimeRef.current * 2.8);

        if (liftoffTimeRef.current > 3.8) {
          // Handover to flight simulation!
          soundEngine.updateTelemetry(0, false, 0, 0);
          onCompleteLaunch();
        } else if (liftoffTimeRef.current > 2.0) {
          setRadioMsg('Capcom: Tower cleared! Astronet 1 pitching onto launch corridor. Handing over to flight.');
          setCrewDialogue('PLT Buzz: "Tower cleared. Vehicle handling smooth. Plume expansion 100% nominal."');
        }
      }

      if (phase === 'HOT_FIRE') {
        hotFireTimerRef.current = Math.max(0, hotFireTimerRef.current - dt);
        launchIgnitionAgeRef.current += dt;
        setHudHotFireRemaining(hotFireTimerRef.current);
        padShakeRef.current = Math.min(8, padShakeRef.current + dt * 6);

        if (hotFireTimerRef.current > 2.8) {
          // Spooling up
          launchThrottleRef.current = Math.min(1.0, launchThrottleRef.current + dt * 1.4);
          soundEngine.updateTelemetry(launchThrottleRef.current, true, 0, 0);
          setRadioMsg('Pad Test Cell: STATIC FIRE TEST: Engine ignition sequence start! Spooling turbopumps.');
          setCrewDialogue('ENG Officer: "Chamber pressure surging, turbopump RPM nominal."');
        } else if (hotFireTimerRef.current > 0.8) {
          launchThrottleRef.current = 1.0;
          soundEngine.updateTelemetry(1.0, true, 0, 0);
          setRadioMsg('Pad Test Cell: STATIC FIRE TEST: Full thrust verified! Flame deflector running 100%.');
          setCrewDialogue('ENG Officer: "All telemetry green! Supersonic shock diamonds locked in."');
        } else if (hotFireTimerRef.current > 0) {
          // Shutdown sequence
          launchThrottleRef.current = Math.max(0, launchThrottleRef.current - dt * 2.2);
          soundEngine.updateTelemetry(launchThrottleRef.current, launchThrottleRef.current > 0.05, 0, 0);
          setRadioMsg('Pad Test Cell: STATIC FIRE TEST: Engine cutoff commanded! Purging manifolds.');
        } else {
          // Finished!
          launchThrottleRef.current = 0;
          soundEngine.updateTelemetry(0, false, 0, 0);
          padShakeRef.current = 0;
          soundEngine.playVictoryFanfare();
          setPhase('COCKPIT_READY');
          setRadioMsg('Flight Director: Static hot-fire test successful! All engine plumes and pressures 100% GO.');
          setCrewDialogue('CDR Neil: "Engine test validated. We are fully cleared for flight!"');
        }
        setHudThrottle(launchThrottleRef.current);
      }

      if (phase !== 'COUNTDOWN_IGNITION' && phase !== 'LIFTOFF' && phase !== 'HOT_FIRE') {
        padShakeRef.current = Math.max(0, padShakeRef.current - dt * 10);
      }

      // ============================================================
      // 4. UNIFIED CANVAS RENDERING (SAME SPACEPORT LOCATION)
      // ============================================================
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      const shakeVal = padShakeRef.current;
      if (shakeVal > 0.01) {
        ctx.translate((Math.random() - 0.5) * shakeVal, (Math.random() - 0.5) * shakeVal);
      }

      // Dusk / Twilight Spaceport Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#020617');
      skyGrad.addColorStop(0.4, '#0b1329');
      skyGrad.addColorStop(0.75, '#1e293b');
      skyGrad.addColorStop(1, '#334155');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Starfield
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      for (let i = 0; i < 60; i++) {
        const sx = (Math.sin(i * 197.3) * 0.5 + 0.5) * width;
        const sy = (Math.cos(i * 83.7) * 0.5 + 0.5) * (height * 0.5);
        ctx.beginPath();
        ctx.arc(sx, sy, i % 4 === 0 ? 1.4 : 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Spaceport Ground & Coastal Horizon
      const horizonY = height * 0.72;

      // Distant tree line & coastal lagoon
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, horizonY - 14, width, 16);
      ctx.fillStyle = '#0f766e';
      ctx.fillRect(0, horizonY + 2, width, 10);

      // Cape Canaveral Ground Surface
      const groundGrad = ctx.createLinearGradient(0, horizonY, 0, height);
      groundGrad.addColorStop(0, '#1e293b');
      groundGrad.addColorStop(0.3, '#334155');
      groundGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, horizonY, width, height - horizonY);

      // Crawlerway (dual lane crushed stone river rock)
      const crawlerwayY = horizonY + 12;
      const crawlerwayH = 46;
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, crawlerwayY, width, crawlerwayH);

      // Road Borders
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, crawlerwayY - 3, width, 3);
      ctx.fillRect(0, crawlerwayY + crawlerwayH, width, 3);

      // Dual Track Center Divider
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(0, crawlerwayY + crawlerwayH / 2);
      ctx.lineTo(width, crawlerwayY + crawlerwayH / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Paved Escort Service Road (For Astrovan)
      const serviceRoadY = crawlerwayY + crawlerwayH + 5;
      const serviceRoadH = 28;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, serviceRoadY, width, serviceRoadH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(0, serviceRoadY + serviceRoadH / 2);
      ctx.lineTo(width, serviceRoadY + serviceRoadH / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // ------------------------------------------------------------
      // 5. BUILDINGS ON THE SAME CONTINUOUS SITE:
      // VAB (Far Left) <-----------------> Pad 39A (Far Right)
      // Extended distance across the coastal horizon
      // ------------------------------------------------------------
      const vabX = Math.max(6, width * 0.015);
      const vabW = Math.max(130, Math.min(180, width * 0.12));
      const vabH = height * 0.58;
      const vabY = horizonY - vabH + 10;

      // VAB Structural Body
      ctx.fillStyle = '#334155';
      ctx.fillRect(vabX, vabY, vabW, vabH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(vabX, vabY, vabW, vabH);

      // Ribbed facade
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      for (let vx = vabX + 16; vx < vabX + vabW - 10; vx += 18) {
        ctx.beginPath();
        ctx.moveTo(vx, vabY);
        ctx.lineTo(vx, vabY + vabH);
        ctx.stroke();
      }

      // High Bay 1 Open Doors
      const doorW = vabW * 0.55;
      const doorH = vabH * 0.78;
      const doorX = vabX + vabW - doorW - 8;
      const doorY = vabY + vabH - doorH;

      ctx.fillStyle = '#020617';
      ctx.fillRect(doorX, doorY, doorW, doorH);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(doorX, doorY, doorW, doorH);

      // Hazard Stripes Above Bay Door
      for (let hx = doorX; hx < doorX + doorW - 10; hx += 16) {
        ctx.fillStyle = Math.floor(hx / 16) % 2 === 0 ? '#f59e0b' : '#0f172a';
        ctx.fillRect(hx, doorY - 8, 16, 8);
      }

      // Indian National Flag (Tiranga) Above VAB Bay 1
      const flagX = vabX + 16;
      const flagY = vabY + 16;
      const flagW = 44;
      const flagH = 27;
      const stripeH = flagH / 3;

      // Flagpole
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(flagX - 3, flagY - 3, 2.5, flagH + 20);
      ctx.beginPath();
      ctx.arc(flagX - 1.75, flagY - 3, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#facc15';
      ctx.fill();

      // Saffron (Kesari) top stripe
      ctx.fillStyle = '#FF9933';
      ctx.fillRect(flagX, flagY, flagW, stripeH);

      // White middle stripe
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(flagX, flagY + stripeH, flagW, stripeH);

      // India Green (Hari) bottom stripe
      ctx.fillStyle = '#138808';
      ctx.fillRect(flagX, flagY + stripeH * 2, flagW, stripeH);

      // Flag Border
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(flagX, flagY, flagW, flagH);

      // Navy Blue Ashoka Chakra
      const chakraCenterX = flagX + flagW / 2;
      const chakraCenterY = flagY + stripeH + stripeH / 2;
      const chakraRadius = stripeH * 0.42;

      ctx.strokeStyle = '#000080';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(chakraCenterX, chakraCenterY, chakraRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Chakra Central Hub
      ctx.fillStyle = '#000080';
      ctx.beginPath();
      ctx.arc(chakraCenterX, chakraCenterY, 0.8, 0, Math.PI * 2);
      ctx.fill();

      // 24 Spokes
      for (let s = 0; s < 24; s++) {
        const spokeAngle = (s * Math.PI) / 12;
        ctx.beginPath();
        ctx.moveTo(chakraCenterX, chakraCenterY);
        ctx.lineTo(
          chakraCenterX + Math.cos(spokeAngle) * chakraRadius,
          chakraCenterY + Math.sin(spokeAngle) * chakraRadius
        );
        ctx.stroke();
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('ISRO • VAB BAY 1', vabX + 12, vabY + 54);

      // Pad 39A Foundation & Gantry Tower (Extended to Far Right)
      const padW = Math.max(180, Math.min(260, width * 0.22));
      const padX = width - padW - Math.max(10, width * 0.015);
      const padH = 42;
      const padY = horizonY - padH + 12;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(padX, padY, padW, padH);
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.strokeRect(padX, padY, padW, padH);

      // Flame trench opening
      ctx.fillStyle = '#020617';
      ctx.fillRect(padX + padW * 0.16, padY + 12, padW * 0.44, padH - 12);

      // Steel Truss Launch Tower
      const towerX = padX + padW * 0.62;
      const towerW = 68;
      const towerH = height * 0.6;
      const towerY = horizonY - towerH;

      ctx.fillStyle = '#475569';
      ctx.fillRect(towerX, towerY, towerW, towerH);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(towerX, towerY, towerW, towerH);

      // Tower cross-bracing lattices
      ctx.beginPath();
      for (let y = towerY; y < horizonY; y += 36) {
        ctx.moveTo(towerX, y);
        ctx.lineTo(towerX + towerW, y + 36);
        ctx.moveTo(towerX + towerW, y);
        ctx.lineTo(towerX, y + 36);
      }
      ctx.stroke();

      // Lightning mast atop tower
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(towerX + towerW / 2, towerY);
      ctx.lineTo(towerX + towerW / 2, towerY - 45);
      ctx.stroke();

      // Red flashing beacon
      if (Math.floor(globalTime * 2) % 2 === 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(towerX + towerW / 2, towerY - 45, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // ------------------------------------------------------------
      // 6. RENDER CRAWLER-TRANSPORTER & ROCKET STACK
      // ------------------------------------------------------------
      const crawlerStartX = vabX + vabW - doorW * 0.5;
      const crawlerEndX = padX + padW * 0.32;
      const crawlerCurrentX = crawlerStartX + (crawlerEndX - crawlerStartX) * crawlerPosRef.current;

      const crawlerW = 230;
      const crawlerH = 46;
      const crawlerLeftX = crawlerCurrentX - crawlerW / 2;
      const crawlerY = crawlerwayY + 2;

      // Mobile Launch Platform (MLP) Deck
      const mlpW = 200;
      const mlpH = 22;
      const mlpDeckY = crawlerY - mlpH;

      // Draw Crawler Steel Chassis
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(crawlerLeftX, crawlerY, crawlerW, crawlerH);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(crawlerLeftX, crawlerY, crawlerW, crawlerH);

      // Driver Cabins
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(crawlerLeftX - 12, crawlerY + 6, 14, 26);
      ctx.fillRect(crawlerLeftX + crawlerW - 2, crawlerY + 6, 14, 26);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(crawlerLeftX - 9, crawlerY + 10, 8, 10);
      ctx.fillRect(crawlerLeftX + crawlerW + 1, crawlerY + 10, 8, 10);

      // Rotating Tread Bogies
      const treadW = 70;
      const treadH = 18;
      const trackOffset = (crawlerPosRef.current * 1200) % 12;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(crawlerLeftX + 16, crawlerY + crawlerH - 14, treadW, treadH);
      ctx.fillRect(crawlerLeftX + crawlerW - 86, crawlerY + crawlerH - 14, treadW, treadH);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      for (let tx = crawlerLeftX + 18; tx < crawlerLeftX + 16 + treadW; tx += 10) {
        const otx = tx + (crawlerSpeedRef.current > 0 ? trackOffset : 0);
        if (otx < crawlerLeftX + 16 + treadW - 2) {
          ctx.beginPath();
          ctx.moveTo(otx, crawlerY + crawlerH - 14);
          ctx.lineTo(otx, crawlerY + crawlerH);
          ctx.stroke();
        }
      }
      for (let tx = crawlerLeftX + crawlerW - 84; tx < crawlerLeftX + crawlerW - 16; tx += 10) {
        const otx = tx + (crawlerSpeedRef.current > 0 ? trackOffset : 0);
        if (otx < crawlerLeftX + crawlerW - 18) {
          ctx.beginPath();
          ctx.moveTo(otx, crawlerY + crawlerH - 14);
          ctx.lineTo(otx, crawlerY + crawlerH);
          ctx.stroke();
        }
      }

      // Yellow Deck Railings
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(crawlerLeftX + 15, crawlerY - 6);
      ctx.lineTo(crawlerLeftX + crawlerW - 15, crawlerY - 6);
      for (let px = crawlerLeftX + 15; px <= crawlerLeftX + crawlerW - 15; px += 35) {
        ctx.moveTo(px, crawlerY);
        ctx.lineTo(px, crawlerY - 6);
      }
      ctx.stroke();

      // Mobile Launch Platform (MLP) Deck
      ctx.fillStyle = '#334155';
      ctx.fillRect(crawlerCurrentX - mlpW / 2, mlpDeckY, mlpW, mlpH);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.strokeRect(crawlerCurrentX - mlpW / 2, mlpDeckY, mlpW, mlpH);

      // Hold-Down Clamps
      ctx.fillStyle = '#475569';
      ctx.fillRect(crawlerCurrentX - 42, mlpDeckY - 8, 14, 8);
      ctx.fillRect(crawlerCurrentX + 28, mlpDeckY - 8, 14, 8);

      // ------------------------------------------------------------
      // 7. RENDER ROCKET ON MLP DECK (WITH TILT OR COLLAPSE)
      // ------------------------------------------------------------
      const maxRocketPixels = Math.min(height * 0.48, 300);
      const visualScale = Math.min(20, Math.max(9, maxRocketPixels / rocketBounds.height));

      // Calculate capsule height position for the Crew Access Arm
      const capsuleY = mlpDeckY - rocketBounds.height * visualScale * 0.86;

      const liftoffAltPx = phase === 'LIFTOFF' ? rocketLiftoffAltPxRef.current : 0;
      ctx.save();
      ctx.translate(crawlerCurrentX, mlpDeckY - liftoffAltPx);

      if (phase === 'CRAWLER_COLLAPSED') {
        // COLLAPSE DYNAMICS:
        collapseAnimTimeRef.current += dt;
        const collapseT = collapseAnimTimeRef.current;
        // Rocket tips over sideways onto crawlerway
        const collapseAngle = Math.min(Math.PI / 2.1, collapseT * 1.8);
        ctx.rotate(collapseAngle);

        // Sparks, fire, smoke particles at point of snap
        ctx.fillStyle = '#f97316';
        for (let i = 0; i < 15; i++) {
          const sx = (Math.sin(globalTime * 30 + i) * 35) * Math.min(1.0, collapseT * 2);
          const sy = (Math.cos(globalTime * 25 + i) * 20 - 15) * Math.min(1.0, collapseT * 2);
          ctx.beginPath();
          ctx.arc(sx, sy, 3 + (i % 4), 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Dynamic tilt from crawler movement
        ctx.rotate(tiltAngleRef.current);
      }

      // Idle Cryo Vapor Plumes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (let v = 0; v < 5; v++) {
        const vx = (v % 2 === 0 ? -1 : 1) * (18 + v * 3);
        const vy = -(rocketBounds.height * visualScale * 0.6) - ((globalTime * 14 + v * 8) % 24);
        ctx.beginPath();
        ctx.arc(vx, vy, 4 + v, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw all rocket parts flush on deck with full fidelity
      parts.forEach((p) => {
        const def = PART_CATALOG[p.partId];
        if (!def) return;

        const baseW = getPartWidth(p, def);
        const baseH = getPartHeight(p, def);
        const pw = baseW * visualScale;
        const ph = baseH * visualScale;
        const px = (p.x - rocketBounds.centerX) * visualScale;
        const py = -((p.y - rocketBounds.minY) * visualScale);

        // Calculate Adaptive Adapter Dimensions (cone + cylinder transition)
        let topWidthPx: number | undefined;
        let bottomWidthPx: number | undefined;
        let adapterShape: 'cone_cylinder' | 'straight' | undefined;

        if (def.isDecoupler && !def.isSideSeparator) {
          const partBelow = parts.find((other) => {
            if (other.uid === p.uid) return false;
            const oDef = PART_CATALOG[other.partId];
            if (!oDef) return false;
            const oH = getPartHeight(other, oDef);
            const otherTop = other.y + oH / 2;
            const myBottom = p.y - baseH / 2;
            return Math.abs(other.x - p.x) < 0.6 && Math.abs(otherTop - myBottom) < 0.35;
          });

          const partAbove = parts.find((other) => {
            if (other.uid === p.uid) return false;
            const oDef = PART_CATALOG[other.partId];
            if (!oDef) return false;
            const oH = getPartHeight(other, oDef);
            const otherBottom = other.y - oH / 2;
            const myTop = p.y + baseH / 2;
            return Math.abs(other.x - p.x) < 0.6 && Math.abs(otherBottom - myTop) < 0.35;
          });

          const wBelow = p.adapterBottomWidth ?? (partBelow ? getPartWidth(partBelow, PART_CATALOG[partBelow.partId]) : undefined);
          let wAbove = p.adapterTopWidth;

          if (!wAbove && partAbove) {
            const oDef = PART_CATALOG[partAbove.partId];
            if (oDef.category === 'Propulsion') {
              const oH = getPartHeight(partAbove, oDef);
              const tankAboveEng = parts.find((t) => {
                if (t.uid === partAbove.uid || t.uid === p.uid) return false;
                const tDef = PART_CATALOG[t.partId];
                if (!tDef || tDef.category !== 'Fuel') return false;
                const tH = getPartHeight(t, tDef);
                return Math.abs(t.x - partAbove.x) < 0.6 && Math.abs((t.y - tH / 2) - (partAbove.y + oH / 2)) < 0.35;
              });
              wAbove = tankAboveEng ? getPartWidth(tankAboveEng, PART_CATALOG[tankAboveEng.partId]) : getPartWidth(partAbove, oDef);
            } else {
              wAbove = getPartWidth(partAbove, oDef);
            }
          }

          if (wBelow !== undefined || wAbove !== undefined) {
            const effBot = wBelow ?? wAbove ?? baseW;
            const effTop = wAbove ?? wBelow ?? baseW;
            bottomWidthPx = effBot * visualScale;
            topWidthPx = effTop * visualScale;
            if (Math.abs(effBot - effTop) > 0.05) {
              adapterShape = 'cone_cylinder';
            }
          }
        }

        // Calculate Interstage Fairing Shroud
        let shroudHeightPx = 0;
        if (def.isDecoupler && !def.isSideSeparator) {
          const engineAbove = parts.find((other) => {
            if (other.uid === p.uid) return false;
            const oDef = PART_CATALOG[other.partId];
            if (!oDef || (oDef.category !== 'Propulsion' && !oDef.isSRB && oDef.maxThrust <= 0)) return false;
            const dx = Math.abs(other.x - p.x);
            if (dx > 0.8) return false;
            const oH = getPartHeight(other, oDef);
            const otherBottom = other.y - oH / 2;
            const myTop = p.y + baseH / 2;
            return other.y > p.y && otherBottom <= myTop + 2.5 && (myTop + 3.5) >= other.y;
          });
          if (engineAbove) {
            const oDef = PART_CATALOG[engineAbove.partId];
            const engH = getPartHeight(engineAbove, oDef);
            const shroudH = Math.max(engH, (engineAbove.y + engH / 2) - (p.y + baseH / 2));
            shroudHeightPx = shroudH * visualScale;
          }
        }

        const isPropulsion = def.category === 'Propulsion' || def.isSRB || def.maxThrust > 0;
        const currentThrottle = launchThrottleRef.current;
        const isFiring = isPropulsion && currentThrottle > 0.01;

        ctx.save();
        try {
          ctx.translate(px, py);
          ctx.rotate(((p.rotation ?? 0) * Math.PI) / 180);

          // -------------------------------------------------------------
          // PROCEDURAL ENGINE PLUME RENDERING (JunoEnginePlume2D)
          // -------------------------------------------------------------
          if (isFiring) {
            const engineConfig: JunoEngineConfig = p.engineConfig || {
              ...DEFAULT_JUNO_ENGINE_CONFIG,
              engineType: def.isSRB ? 'Solid' : def.id === 'engine_nuclear_nerva' ? 'Nuclear Thermal' : 'Liquid',
              powerCycle: def.isSRB ? 'Booster' : 'Gas Generator II',
              liquidFuel: def.fuelType === 'hydrolox' ? 'Hydrolox' : def.fuelType === 'methalox' ? 'Methalox' : 'Kerolox',
            };

            const altitudeKm = Math.max(0, rocketLiftoffAltPxRef.current / (visualScale * 1000));
            const perf = calculateJunoEnginePerformance(engineConfig, altitudeKm);

            const lengthFactor = Math.max(0.2, Math.min(2.0, (engineConfig.nozzleLengthPercent || 100) / 100));
            const mountH = ph * 0.22;
            const throatY = -ph * 0.5 + mountH + ph * 0.10;
            const nozzleH = Math.max(ph * 0.35, ph * 0.62 * lengthFactor);
            const exitY = Math.min(ph * 0.5 + 12, throatY + nozzleH);
            const pivotY = -ph * 0.5 + mountH;
            const nozzleL = exitY - pivotY;

            let baseExitW = (pw * 0.5) * 0.85 * Math.sqrt(lengthFactor);
            if (engineConfig.nozzleStyle === 'Cone') baseExitW = (pw * 0.5) * 0.72 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Bravo') baseExitW = (pw * 0.5) * 0.95 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Delta') baseExitW = (pw * 0.5) * 1.28 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Omega') baseExitW = (pw * 0.5) * 1.12 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Dual Bell') baseExitW = (pw * 0.5) * 1.20 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Aerospike') baseExitW = (pw * 0.5) * 0.88;

            const mountCount = p.engineMountCount || 1;
            const mountSlots =
              mountCount === 1
                ? [0]
                : mountCount === 2
                ? [-pw * 0.25, pw * 0.25]
                : [-pw * 0.32, 0, pw * 0.32];
            const slotExitW = baseExitW / Math.sqrt(mountCount);

            mountSlots.forEach((slotX) => {
              ctx.save();
              ctx.translate(slotX, pivotY);
              drawJunoEnginePlume2D(
                ctx,
                engineConfig,
                currentThrottle,
                0,
                nozzleL,
                slotExitW,
                altitudeKm,
                0,
                globalTime,
                perf.exitPressureKPa,
                launchIgnitionAgeRef.current
              );
              ctx.restore();
            });
          }

          drawPart2D(ctx, def, {
            widthPx: pw,
            heightPx: ph,
            rotation: 0,
            isFlight: true,
            throttle: isFiring ? currentThrottle : 0,
            engineActive: isFiring,
            deployed: p.deployed ?? false,
            deployProgress: p.deployProgress !== undefined ? p.deployProgress : (p.deployed ? 1.0 : 0.0),
            wheelSteerAngle: p.wheelSteerAngle,
            wheelRotation: p.wheelRotation,
            shroudHeightPx,
            topWidthPx,
            bottomWidthPx,
            adapterShape,
            engineConfig: p.engineConfig,
            customNozzleType: p.customNozzleType,
            propellantType: p.propellantType,
            tankSkin: p.tankSkin,
            engineMountCount: p.engineMountCount,
            fuelPercent: p.maxFuel && p.maxFuel > 0 ? (p.fuelRemaining ?? p.maxFuel) / p.maxFuel : 1.0,
          });
        } finally {
          ctx.restore();
        }
      });

      ctx.restore();

      // ------------------------------------------------------------
      // PAD 39A FLAME TRENCH EXHAUST & DELUGE STEAM BILLOWS
      // ------------------------------------------------------------
      if (launchThrottleRef.current > 0.01 && (phase === 'COUNTDOWN_IGNITION' || phase === 'LIFTOFF' || phase === 'HOT_FIRE')) {
        const trenchY = mlpDeckY + 22;
        const throttleP = launchThrottleRef.current;

        // Core flame jet deflected sideways under MLP
        for (let t = 0; t < 12; t++) {
          const side = t % 2 === 0 ? 1 : -1;
          const fx = crawlerCurrentX + side * (35 + t * 14) + Math.sin(globalTime * 20 + t) * 10;
          const fy = trenchY + 10 + Math.cos(globalTime * 25 + t) * 8;
          const r = (16 + t * 4) * throttleP;
          const flameGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy, r);
          flameGrad.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
          flameGrad.addColorStop(0.35, 'rgba(249, 115, 22, 0.75)');
          flameGrad.addColorStop(0.7, 'rgba(220, 38, 38, 0.45)');
          flameGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
          ctx.fillStyle = flameGrad;
          ctx.beginPath();
          ctx.arc(fx, fy, r, 0, Math.PI * 2);
          ctx.fill();
        }

        // Billowing white water-deluge steam clouds escaping trenches
        for (let s = 0; s < 22; s++) {
          const side = s % 2 === 0 ? 1 : -1;
          const sx = crawlerCurrentX + side * (45 + s * 16) + Math.sin(globalTime * 5 + s) * 22;
          const sy = trenchY - 8 - ((globalTime * 36 + s * 14) % 85);
          const sr = (20 + (s % 5) * 8) * (0.6 + 0.4 * throttleP);
          ctx.fillStyle = `rgba(241, 245, 249, ${0.42 * throttleP})`;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ------------------------------------------------------------
      // 8. GANTRY TOWER ACCESS ARMS & ELEVATOR
      // ------------------------------------------------------------
      // Crew Access Arm (CAA) & White Room
      const armTargetX = crawlerCurrentX + 22;
      const armStartY = Math.max(towerY + 50, capsuleY);
      const isPadArrived = phase !== 'DRIVE_CRAWLER' && phase !== 'CRAWLER_COLLAPSED';
      // Arm retracts during countdown ignition and liftoff!
      const isArmRetracted = phase === 'LIFTOFF' || (phase === 'COUNTDOWN_IGNITION' && countdownTimerRef.current <= 2.2);
      const armP = isPadArrived ? (isArmRetracted ? 0.05 : 1.0) : 0.0;
      const currentArmX = towerX - (towerX - armTargetX) * armP;

      if (isPadArrived) {
        // CAA Truss Walkway
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(towerX, armStartY);
        ctx.lineTo(currentArmX, armStartY);
        ctx.stroke();

        // White Room enclosure at tip
        const whiteRoomW = 32;
        const whiteRoomH = 22;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(currentArmX - whiteRoomW, armStartY - whiteRoomH / 2, whiteRoomW, whiteRoomH);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(currentArmX - whiteRoomW, armStartY - whiteRoomH / 2, whiteRoomW, whiteRoomH);
        ctx.fillStyle = '#0284c7';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText('ASTRONET', currentArmX - whiteRoomW + 4, armStartY + 3);
      }

      // Elevator Shaft Rails
      const elevatorTrackX = towerX + towerW - 16;
      const elevatorBottomY = padY - 8;
      const elevatorTopY = armStartY;

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(elevatorTrackX, elevatorTopY);
      ctx.lineTo(elevatorTrackX, elevatorBottomY);
      ctx.moveTo(elevatorTrackX + 12, elevatorTopY);
      ctx.lineTo(elevatorTrackX + 12, elevatorBottomY);
      ctx.stroke();

      // Dynamic elevator position
      let elevatorY = elevatorBottomY;
      const bp = boardingProgressRef.current;
      if (phase === 'PAD_BOARDING' && bp >= 0.35 && bp <= 0.7) {
        const ep = (bp - 0.35) / 0.35;
        elevatorY = elevatorBottomY - (elevatorBottomY - elevatorTopY) * ep;
      } else if (phase === 'PAD_BOARDING' && bp > 0.7) {
        elevatorY = elevatorTopY;
      } else if (phase === 'COCKPIT_READY') {
        elevatorY = elevatorTopY;
      }

      // Glass Elevator Car
      const elevW = 16;
      const elevH = 22;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(elevatorTrackX - 2, elevatorY - elevH, elevW, elevH);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(elevatorTrackX - 2, elevatorY - elevH, elevW, elevH);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(elevatorTrackX, elevatorY - elevH + 2, elevW - 4, elevH - 4);

      // ------------------------------------------------------------
      // 9. ASTROVAN (CREW TRANSPORT VEHICLE)
      // ------------------------------------------------------------
      const vanStartX = vabX + vabW + 15;
      const vanEndX = padX + 25;
      const astrovanX = vanStartX + (vanEndX - vanStartX) * vanPosRef.current;
      const astrovanY = serviceRoadY + 3;
      const astrovanW = 86;
      const astrovanH = 28;

      ctx.save();
      // Vehicle Body
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(astrovanX, astrovanY, astrovanW, astrovanH, 5);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tinted Windows
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(astrovanX + 10, astrovanY + 4, 18, 11, 2);
      ctx.roundRect(astrovanX + 32, astrovanY + 4, 20, 11, 2);
      ctx.roundRect(astrovanX + 56, astrovanY + 4, 18, 11, 2);
      ctx.fill();

      // Blue Stripe & Decal
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(astrovanX + 4, astrovanY + 18, astrovanW - 8, 3);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 7px sans-serif';
      ctx.fillText('ASTRONET CREW', astrovanX + 14, astrovanY + 25);

      // Headlights & Taillights
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(astrovanX + astrovanW - 2, astrovanY + 14, 3, 5);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(astrovanX - 1, astrovanY + 14, 2, 5);

      // Flashing Roof Beacon
      if (Math.floor(globalTime * 6) % 2 === 0) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(astrovanX + astrovanW / 2, astrovanY - 2, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Wheels
      const wheelR = 6;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(astrovanX + 18, astrovanY + astrovanH, wheelR, 0, Math.PI * 2);
      ctx.arc(astrovanX + astrovanW - 18, astrovanY + astrovanH, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Highlight Parking Stall at Pad 39A
      if (phase === 'DRIVE_ASTROVAN') {
        ctx.save();
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(vanEndX - 10, serviceRoadY - 4, astrovanW + 20, serviceRoadH + 8);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('▼ CREW PARKING', vanEndX + 10, serviceRoadY - 8);
        ctx.restore();
      }

      // ------------------------------------------------------------
      // 10. ASTRONAUTS CHARACTERS ANIMATION ON PAD
      // ------------------------------------------------------------
      const astroBaseY = serviceRoadY + serviceRoadH - 2;

      if (phase === 'PAD_BOARDING') {
        const walkXStart = vanEndX + astrovanW + 8;
        const towerDoorX = towerX + 10;

        if (bp < 0.35) {
          // Walking to elevator
          const walkP = bp / 0.35;
          const a1x = walkXStart + (towerDoorX - walkXStart) * walkP;
          const a2x = a1x - 22;

          drawAstronaut(a1x, astroBaseY, {
            scale: 1.1,
            isWalking: true,
            walkTime: globalTime,
            isWaving: bp > 0.18,
            facing: 'right',
            accentColor: '#38bdf8',
          });
          drawAstronaut(a2x, astroBaseY, {
            scale: 1.05,
            isWalking: true,
            walkTime: globalTime + 0.4,
            isWaving: false,
            facing: 'right',
            accentColor: '#f43f5e',
          });

          // Speech bubble
          if (bp > 0.18) {
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(a1x - 35, astroBaseY - 60, 80, 18, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px sans-serif';
            ctx.fillText('👋 Ready for Orbit!', a1x - 28, astroBaseY - 48);
          }
        } else if (bp >= 0.7 && bp < 0.95) {
          // Walking across Crew Access Arm into White Room & Capsule
          const ingressP = (bp - 0.7) / 0.25;
          const bridgeWalkX = towerX - (towerX - (currentArmX - 10)) * ingressP;

          drawAstronaut(bridgeWalkX, armStartY, {
            scale: 0.85,
            isWalking: ingressP < 0.9,
            walkTime: globalTime,
            isWaving: ingressP > 0.8,
            facing: 'left',
            accentColor: '#38bdf8',
          });
        }
      }

      ctx.restore(); // Restore pad shake context

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [parts, rocketBounds, phase, onCompleteLaunch]);

  // Mission Prep Overall Progress (0 to 100%)
  const getOverallProgress = () => {
    switch (phase) {
      case 'DRIVE_CRAWLER':
        return Math.min(25, Math.round(hudCrawlerProgress * 25));
      case 'CRAWLER_DOCKED':
        return 28;
      case 'DRIVE_ASTROVAN':
        return 28 + Math.min(25, Math.round(hudVanProgress * 25));
      case 'ASTROVAN_PARKED':
        return 55;
      case 'PAD_BOARDING':
        return 55 + Math.min(25, Math.round(hudBoardingStep * 25));
      case 'COCKPIT_READY':
        return 85;
      case 'HOT_FIRE':
        return 92;
      case 'COUNTDOWN_IGNITION':
        return 96;
      case 'LIFTOFF':
        return 100;
      default:
        return 10;
    }
  };
  const overallProgress = getOverallProgress();

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-sans flex flex-col justify-between">
      {/* Unified 2D Canvas Stage */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0 block" />

      {/* TOP EDGE MISSION SEQUENCE PROGRESS BAR */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-900/90 z-30 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-300 shadow-[0_0_8px_rgba(56,189,248,0.7)]"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* TOP COMMAND & MISSION STATUS HEADER */}
      <header className="relative z-20 p-2 sm:p-3 pt-3 flex items-center justify-between gap-2 pointer-events-auto">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={onReturnToSpaceport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition shadow-sm active:scale-95 cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Campus</span>
          </button>
          <button
            onClick={onAbortToVAB}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition shadow-sm active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>VAB</span>
          </button>
          <button
            onClick={onCompleteLaunch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm active:scale-95 cursor-pointer"
            title="Skip Rollout and Proceed Directly to Active Launchpad Flight"
          >
            <FastForward className="w-3.5 h-3.5 text-emerald-200" />
            <span className="hidden sm:inline">Launch Directly</span>
          </button>
        </div>

        {/* TOP MISSION SEQUENCE PROGRESS BAR & STAGE INDICATOR */}
        <div className="flex-1 max-w-md mx-2 bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl px-3 py-1.5 shadow-md flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  phase === 'COCKPIT_READY'
                    ? 'bg-emerald-400 animate-ping'
                    : phase === 'CRAWLER_COLLAPSED'
                    ? 'bg-rose-500 animate-bounce'
                    : 'bg-cyan-400 animate-pulse'
                }`}
              />
              <span className="text-white font-medium text-[11px] truncate">
                {phase === 'DRIVE_CRAWLER' && 'Rollout: Crawler Transport (< 3.5 m/s)'}
                {phase === 'CRAWLER_COLLAPSED' && 'Structural Alert: Vehicle Collapsed'}
                {phase === 'CRAWLER_DOCKED' && 'Crawler Secured on Pad 39A'}
                {phase === 'DRIVE_ASTROVAN' && 'Drive Astrovan Crew to Pad 39A'}
                {phase === 'ASTROVAN_PARKED' && 'Astrovan Parked at Pad 39A'}
                {phase === 'PAD_BOARDING' && 'Astronauts Boarding Gantry Tower'}
                {phase === 'COCKPIT_READY' && 'All Systems Go • Ready for Launch'}
              </span>
            </div>
            <span className="text-cyan-400 font-bold text-[11px] shrink-0 ml-2">
              {overallProgress}%
            </span>
          </div>

          {/* Integrated progress bar */}
          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800/80">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 transition-all duration-200"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Controls & Quick Actions */}
        <div className="flex items-center gap-1.5">
          {/* Toggle Crew Cam View */}
          <button
            onClick={() => setShowCrewCam((c) => !c)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition cursor-pointer ${
              showCrewCam
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle Astronaut Cockpit Camera"
          >
            <Video className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Cam</span>
          </button>

          {/* Mute Audio Toggle */}
          <button
            onClick={() => {
              setIsMuted((m) => {
                soundEngine.setMuted(!m);
                return !m;
              });
            }}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-sky-400" />}
          </button>

          {/* READY ON PAD (FLY) BUTTON */}
          <button
            onClick={handleSkipToFlight}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all cursor-pointer active:scale-95 shadow-sm"
            title="Place vehicle on Launch Pad 39A and enter active flight controls"
          >
            <span className="hidden sm:inline">Ready on Pad</span>
            <span className="sm:hidden">Fly</span>
            <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* -------------------------------------------------------- */}
      {/* GAMEPLAY HUD: CRAWLER SPEED & STRUCTURAL STABILITY BARS */}
      {/* -------------------------------------------------------- */}
      {phase === 'DRIVE_CRAWLER' && (
        <div className="relative z-20 mx-auto max-w-md w-full px-3 pointer-events-auto">
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-3 shadow-lg flex flex-col gap-2">
            {/* Speedometer Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-medium text-slate-300">
                  Speed: <span className="font-mono text-white text-xs">{hudCrawlerSpeed.toFixed(1)} m/s</span>
                </span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">
                LIMIT: 3.5 m/s
              </span>
            </div>

            {/* Speed Bar Gauge */}
            <div className="relative w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-75 ${
                  hudCrawlerSpeed <= 3.5
                    ? 'bg-emerald-500'
                    : hudCrawlerSpeed <= 5.2
                    ? 'bg-amber-500'
                    : 'bg-rose-500 animate-pulse'
                }`}
                style={{ width: `${Math.min(100, (hudCrawlerSpeed / 7.5) * 100)}%` }}
              />
              {/* 3.5 m/s Safe Marker Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white/70"
                style={{ left: `${(3.5 / 7.5) * 100}%` }}
              />
            </div>

            {/* STRUCTURAL STRESS & STABILITY BAR */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1.5">
                <ShieldAlert
                  className={`w-3.5 h-3.5 ${
                    hudStress < 45
                      ? 'text-emerald-400'
                      : hudStress < 75
                      ? 'text-amber-400'
                      : 'text-rose-500 animate-bounce'
                  }`}
                />
                <span className="text-[11px] font-medium text-slate-300">
                  Stress:{' '}
                  <span
                    className={`font-mono text-xs font-bold ${
                      hudStress < 45
                        ? 'text-emerald-400'
                        : hudStress < 75
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {hudStress.toFixed(0)}%
                  </span>
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {hudStress >= 75 ? 'DANGER: COLLAPSE IMMINENT' : hudStress >= 45 ? 'CAUTION: SWAYING' : 'STABLE'}
              </span>
            </div>

            {/* Stress Progress Bar */}
            <div className="relative w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-75 ${
                  hudStress < 45
                    ? 'bg-emerald-500'
                    : hudStress < 75
                    ? 'bg-amber-500'
                    : 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 animate-pulse'
                }`}
                style={{ width: `${hudStress}%` }}
              />
            </div>

            {/* Rollout Progress & On-screen Drive Controls */}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
              <div className="text-[10px] font-mono text-slate-400">
                ROLLOUT: <span className="text-sky-300 font-bold">{(hudCrawlerProgress * 100).toFixed(0)}%</span> (
                {Math.round(hudCrawlerProgress * 1500)}m / 1,500m)
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onPointerDown={() => {
                    isBrakingCrawlerRef.current = true;
                  }}
                  onPointerUp={() => {
                    isBrakingCrawlerRef.current = false;
                  }}
                  onPointerLeave={() => {
                    isBrakingCrawlerRef.current = false;
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-rose-950 text-rose-300 border border-slate-800 text-xs font-medium transition select-none cursor-pointer"
                >
                  BRAKE (A)
                </button>
                <button
                  onPointerDown={() => {
                    isAccelCrawlerRef.current = true;
                  }}
                  onPointerUp={() => {
                    isAccelCrawlerRef.current = false;
                  }}
                  onPointerLeave={() => {
                    isAccelCrawlerRef.current = false;
                  }}
                  className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold transition select-none cursor-pointer shadow-sm"
                >
                  DRIVE (D)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* GAMEPLAY HUD: ASTROVAN DRIVING CONTROLS */}
      {/* -------------------------------------------------------- */}
      {phase === 'DRIVE_ASTROVAN' && (
        <div className="relative z-20 mx-auto max-w-md w-full px-3 pointer-events-auto">
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800/80 rounded-xl p-3 shadow-lg flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-[11px] font-medium text-slate-300">
                  Speed:{' '}
                  <span className="font-mono text-white text-xs">
                    {(hudVanSpeed * 2.237).toFixed(0)} mph ({hudVanSpeed.toFixed(1)} m/s)
                  </span>
                </span>
              </div>
              <span className="text-[10px] font-mono text-sky-400">
                COMFORT: {hudVanComfort.toFixed(0)}%
              </span>
            </div>

            {/* Van Progress */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-sky-500 transition-all duration-75"
                style={{ width: `${hudVanProgress * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
              <span className="text-[10px] font-mono text-slate-400">
                DISTANCE TO PAD: {Math.max(0, Math.round((1 - hudVanProgress) * 1200))}m
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => soundEngine.playVehicleHornSound()}
                  className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-xs font-medium cursor-pointer"
                  title="Sound Escort Horn (H)"
                >
                  HORN (H)
                </button>
                <button
                  onPointerDown={() => {
                    isBrakingVanRef.current = true;
                  }}
                  onPointerUp={() => {
                    isBrakingVanRef.current = false;
                  }}
                  onPointerLeave={() => {
                    isBrakingVanRef.current = false;
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-rose-950 text-rose-300 border border-slate-800 text-xs font-medium select-none cursor-pointer"
                >
                  BRAKE (A)
                </button>
                <button
                  onPointerDown={() => {
                    isAccelVanRef.current = true;
                  }}
                  onPointerUp={() => {
                    isAccelVanRef.current = false;
                  }}
                  onPointerLeave={() => {
                    isAccelVanRef.current = false;
                  }}
                  className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-xs font-bold select-none cursor-pointer shadow-sm"
                >
                  ACCEL (D)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* GAMEPLAY HUD: ASTROVAN PARKED -> START BOARDING */}
      {/* -------------------------------------------------------- */}
      {phase === 'ASTROVAN_PARKED' && (
        <div className="relative z-20 mx-auto max-w-sm w-full px-3 pointer-events-auto">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-lg flex flex-col items-center gap-2 text-center animate-in zoom-in-95">
            <Award className="w-6 h-6 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">Astrovan Parked at Pad 39A</h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Crew ready to board the tower elevator and enter capsule.
              </p>
            </div>
            <button
              onClick={() => {
                soundEngine.init();
                setPhase('PAD_BOARDING');
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wide shadow-sm cursor-pointer active:scale-95 flex items-center gap-1.5"
            >
              <span>Board Gantry Tower</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* GAMEPLAY HUD: BOARDING IN PROGRESS */}
      {/* -------------------------------------------------------- */}
      {phase === 'PAD_BOARDING' && (
        <div className="relative z-20 mx-auto max-w-sm w-full px-3 pointer-events-auto">
          <div className="bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-300 font-medium">GANTRY INGRESS</span>
              <span className="text-cyan-400 font-bold">{(hudBoardingStep * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-cyan-500 transition-all duration-75"
                style={{ width: `${hudBoardingStep * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* GAMEPLAY MODAL: ROCKET COLLAPSE INCIDENT REPORT */}
      {/* -------------------------------------------------------- */}
      {phase === 'CRAWLER_COLLAPSED' && (
        <div className="absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto">
          <div className="max-w-md w-full bg-slate-950 border border-rose-500/60 rounded-xl p-5 shadow-2xl flex flex-col gap-3 text-center animate-in zoom-in-95">
            <div className="mx-auto w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Vehicle Structural Overload</h2>
              <p className="text-[11px] text-rose-300 font-mono mt-0.5 uppercase tracking-wide">
                Transport Inertia Exceeded Safe Limits
              </p>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                The crawler loader vehicle was driven too fast (&gt; 3.5 m/s), causing excessive sway that snapped the hold-down mounts. Keep transport speed inside safe limits.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
              <button
                onClick={onCompleteLaunch}
                className="w-full sm:flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wide transition shadow-sm cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <FastForward className="w-3.5 h-3.5" />
                <span>Launch Directly (Pad 39A)</span>
              </button>
              <button
                onClick={handleRestartRollout}
                className="w-full sm:w-auto py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide transition shadow-sm cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
              <button
                onClick={onAbortToVAB}
                className="w-full sm:w-auto py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium text-xs transition border border-slate-800 cursor-pointer active:scale-95"
              >
                VAB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* GAMEPLAY READY MODAL: ALL CREW READY FOR MANUAL LAUNCH */}
      {/* -------------------------------------------------------- */}
      {phase === 'COCKPIT_READY' && (
        <div className="relative z-20 mx-auto max-w-md w-full px-3 pointer-events-auto mb-2">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-xl p-4 shadow-xl flex flex-col items-center text-center gap-2.5 animate-in zoom-in-95">
            <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Range Green • Go For Launch</span>
            </div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Crew Secured & Staged on Pad 39A
            </h2>
            <p className="text-xs text-slate-300">
              Mobile launcher platform locked. Astronauts strapped in. Choose launch mode:
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full mt-0.5">
              <button
                onClick={handleStartCountdown}
                className="flex-1 py-2.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wide shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Rocket className="w-3.5 h-3.5 fill-white" />
                <span>Countdown & Liftoff</span>
              </button>
              <button
                onClick={handleStartHotFire}
                className="py-2.5 px-3.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase tracking-wide shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5 fill-white" />
                <span>Hot Fire Test</span>
              </button>
            </div>
            <button
              onClick={handleSkipToFlight}
              className="text-[11px] text-slate-400 hover:text-sky-300 underline transition cursor-pointer flex items-center gap-1 mt-0.5"
            >
              <FastForward className="w-3 h-3" />
              <span>Skip directly to flight simulation</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* COUNTDOWN & IGNITION STATUS HUD BANNER */}
      {/* -------------------------------------------------------- */}
      {phase === 'COUNTDOWN_IGNITION' && (
        <div className="relative z-20 mx-auto max-w-sm w-full px-3 pointer-events-auto mb-2">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2 shadow-lg flex items-center justify-between gap-3 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono font-bold text-base">
                T-0{Math.ceil(hudCountdown)}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center gap-1">
                  <Flame className="w-3 h-3 fill-amber-400 animate-pulse" />
                  <span>{hudCountdown <= 2.0 ? 'ENGINES SPOOLING' : 'TERMINAL COUNTDOWN'}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Throttle: {(hudThrottle * 100).toFixed(0)}% • Pressure Rising
                </div>
              </div>
            </div>
            <div className="w-16 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all duration-75"
                style={{ width: `${Math.round(hudThrottle * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* LIFTOFF CLIMB STATUS HUD BANNER */}
      {/* -------------------------------------------------------- */}
      {phase === 'LIFTOFF' && (
        <div className="relative z-20 mx-auto max-w-sm w-full px-3 pointer-events-auto mb-2">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2 shadow-lg flex items-center justify-between gap-3 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-mono font-bold text-sm animate-bounce">
                🚀
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>LIFTOFF • TOWER CLEARED</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Throttle: 100% • Ascent Nominal
                </div>
              </div>
            </div>
            <div className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-mono font-bold text-emerald-300 uppercase tracking-wider">
              ACTIVE
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* STATIC HOT FIRE TEST STATUS HUD BANNER */}
      {/* -------------------------------------------------------- */}
      {phase === 'HOT_FIRE' && (
        <div className="relative z-20 mx-auto max-w-sm w-full px-3 pointer-events-auto mb-2">
          <div className="bg-slate-950/90 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2 shadow-lg flex items-center justify-between gap-3 animate-in zoom-in-95">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400 font-mono font-bold text-xs">
                {hudHotFireRemaining.toFixed(1)}s
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-orange-300 uppercase tracking-wide flex items-center gap-1">
                  <Flame className="w-3 h-3 fill-orange-400 animate-pulse" />
                  <span>HOT FIRE TEST</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Throttle: {(hudThrottle * 100).toFixed(0)}% • Hold Clamps On
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                launchThrottleRef.current = 0;
                soundEngine.updateTelemetry(0, false, 0, 0);
                setPhase('COCKPIT_READY');
                setRadioMsg('Pad Safety: Hot fire test aborted by operator. Vehicle in safe standby.');
              }}
              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold uppercase tracking-wider transition cursor-pointer active:scale-95"
            >
              Cutoff
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* PICTURE-IN-PICTURE: LIVE ASTRONET CREW COCKPIT CAM */}
      {/* -------------------------------------------------------- */}
      {showCrewCam && (
        <aside className="absolute top-16 right-3 sm:right-4 z-20 w-36 sm:w-40 bg-slate-950/90 backdrop-blur-md border border-slate-800/90 rounded-lg shadow-lg overflow-hidden pointer-events-auto transition-all animate-in fade-in">
          <div className="flex items-center justify-between px-2 py-1 bg-slate-900/90 border-b border-slate-800/80">
            <div className="flex items-center gap-1 text-[9px] font-mono font-semibold text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>CREW LIVE</span>
            </div>
            <span className="text-[8px] font-mono text-emerald-400 bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/20">
              ORBITER
            </span>
          </div>

          {/* Cockpit Interior Illustration */}
          <div className="relative h-16 bg-slate-950 px-1.5 py-1 flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 left-2 right-2 h-4 bg-sky-950/25 rounded-b border-x border-b border-sky-500/20" />

            <div className="relative z-10 flex justify-between items-center px-0.5">
              <div className="px-1 py-0.2 rounded bg-slate-900/80 border border-cyan-500/20 text-[7px] font-mono text-cyan-400 leading-none">
                ATT 0°
              </div>
              <div className="px-1 py-0.2 rounded bg-slate-900/80 border border-emerald-500/20 text-[7px] font-mono text-emerald-400 text-right leading-none">
                GO
              </div>
            </div>

            {/* Astronauts in Flight Couches */}
            <div className="relative z-10 flex justify-center items-end gap-3 pb-0.5">
              {activeAstronauts.slice(0, 2).map((astro) => (
                <div key={astro.id} className="flex flex-col items-center">
                  <div className="relative w-6 h-6 rounded-full bg-white border border-slate-300 shadow-sm flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-amber-200 border border-amber-500/60 flex items-center justify-center">
                      <div className="w-1.5 h-0.5 bg-white/70 rounded-full rotate-[-25deg] translate-y-[-1px]" />
                    </div>
                  </div>
                  <div
                    className="w-8 h-3.5 rounded-t-md bg-slate-200 border border-slate-400 flex items-center justify-between px-0.5 pt-0.2 -mt-0.5"
                    style={{ borderTopColor: astro.suitColor || '#38bdf8' }}
                  >
                    <span className="w-1 h-1 rounded-full bg-blue-600" />
                    <span className="text-[6px] font-bold text-slate-800 truncate max-w-[18px]">
                      {astro.name.split(' ')[0]}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Audio Dialogue Subtitle */}
          <div className="px-2 py-1 bg-slate-950/95 border-t border-slate-800/80 text-[9px] font-mono text-slate-300 leading-tight truncate">
            <span className="text-sky-300">{crewDialogue}</span>
          </div>
        </aside>
      )}

      {/* -------------------------------------------------------- */}
      {/* BOTTOM RADIO CHATTER & STAGED VEHICLE METRICS */}
      {/* -------------------------------------------------------- */}
      <footer className="relative z-10 p-3 sm:p-4 flex flex-col md:flex-row items-end justify-between gap-3 pointer-events-auto">
        {/* Radio Comms Box */}
        <div className="max-w-md w-full bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2.5 shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-1 mb-1">
            <div className="flex items-center gap-1.5 text-[10px] font-mono font-semibold text-sky-400">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Ops Radio Net</span>
            </div>
            <span className="text-[9px] font-mono text-slate-500">LC-39A</span>
          </div>
          <p className="text-xs text-slate-300 font-mono leading-relaxed line-clamp-2">{radioMsg}</p>
        </div>

        {/* Staged Rocket Specs */}
        <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2 shadow-lg flex items-center gap-3.5 text-xs font-mono text-slate-300">
          <div>
            <span className="text-slate-500 block text-[9px]">MASS</span>
            <span className="text-white font-medium">{metrics.wetMass.toFixed(1)}t</span>
          </div>
          <div className="w-px h-5 bg-slate-800/80" />
          <div>
            <span className="text-slate-500 block text-[9px]">THRUST</span>
            <span className="text-amber-400 font-medium">{metrics.totalThrust.toFixed(0)} kN</span>
          </div>
          <div className="w-px h-5 bg-slate-800/80" />
          <div>
            <span className="text-slate-500 block text-[9px]">TWR</span>
            <span
              className={`font-medium ${
                metrics.twrSeaLevel >= 1.2 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {metrics.twrSeaLevel.toFixed(2)}
            </span>
          </div>
          <div className="w-px h-5 bg-slate-800/80" />
          <div>
            <span className="text-slate-500 block text-[9px]">EST. ΔV</span>
            <span className="text-sky-400 font-medium">{metrics.estimatedDeltaV.toFixed(0)} m/s</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
