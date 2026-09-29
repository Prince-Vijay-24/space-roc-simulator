import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { VesselState, OrbitParameters } from '../types';
import { SOLAR_SYSTEM, SolarSystemBody, getBodyPositionAtTime } from '../data/solarSystem';
import { PLANETARY_SURFACES, drawPlanetarySurface } from '../data/planetarySurfaces';
import { 
  Orbit, Rocket, Eye, Maximize2, ZoomIn, ZoomOut, Compass, 
  Flame, ChevronRight, X, Info, Clock, Layers, Navigation, 
  Crosshair, Shield, Play, RotateCcw, AlertTriangle, ArrowUp, ArrowDown
} from 'lucide-react';

export type MapDisplayMode = 'ORBIT' | 'TRANSFER' | 'SOLAR';

interface SolarSystemMapViewProps {
  vessel: VesselState;
  orbit: OrbitParameters;
  timeWarp: number;
  missionTime: number;
  onCloseMap: () => void;
  onSetTimeWarp: (warp: number) => void;
  onThrottleChange?: (val: number) => void;
  onStageExecute?: () => void;
  onSteerStart?: (direction: 'left' | 'right') => void;
  onSteerEnd?: () => void;
  onToggleSAS?: (mode: VesselState['sasMode']) => void;
  onToggleRCS?: () => void;
}

interface TrajectoryPoint {
  x: number; // world coordinates
  y: number;
  r: number;
  alt: number;
  t: number; // seconds from current time
  inAtmosphere: boolean;
  isImpact: boolean;
}

interface TrajectoryAnalysis {
  points: TrajectoryPoint[];
  apoapsisPt: TrajectoryPoint | null;
  periapsisPt: TrajectoryPoint | null;
  impactPt: TrajectoryPoint | null;
  moonEncounterPt: TrajectoryPoint | null;
  isClosedOrbit: boolean;
  isHyperbolic: boolean;
  timeToImpact: number | null;
}

export const SolarSystemMapView: React.FC<SolarSystemMapViewProps> = ({
  vessel,
  orbit,
  timeWarp,
  missionTime,
  onCloseMap,
  onSetTimeWarp,
  onThrottleChange,
  onStageExecute,
  onSteerStart,
  onSteerEnd,
  onToggleSAS,
  onToggleRCS,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Map Modes:
  // 'ORBIT' = Focus on active vessel trajectory, Ap, Pe, atmosphere, local planet
  // 'TRANSFER' = Hohmann transfer, Earth-Moon-Mars transfer angles and SOI boundaries
  // 'SOLAR' = Macro solar system overview (all 14 planets, asteroid belt)
  const [mapMode, setMapMode] = useState<MapDisplayMode>('ORBIT');

  // Focus Target: 'rocket' is FIRST AND PRIMARY DEFAULT
  const [focusTarget, setFocusTarget] = useState<'rocket' | string>('rocket');
  const [isFollowingRocket, setIsFollowingRocket] = useState<boolean>(true);
  const [selectedBodyId, setSelectedBodyId] = useState<string>('earth');

  // UI Panels
  const [showTelemetryDeck, setShowTelemetryDeck] = useState<boolean>(true);
  const [showNavDeck, setShowNavDeck] = useState<boolean>(true);
  const [showTargetInspector, setShowTargetInspector] = useState<boolean>(false);
  const [inspectorTab, setInspectorTab] = useState<'real' | 'sim' | 'geo'>('real');

  // Smooth Camera State (ref prevents unnecessary React re-renders in requestAnimationFrame loop)
  const cameraRef = useRef<{
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    zoom: number;
    targetZoom: number;
  }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    zoom: 0.0012, // Initial crisp zoom framing rocket + Earth horizon + trajectory arc
    targetZoom: 0.0012,
  });

  // User drag interaction
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Historical breadcrumbs trail
  const breadcrumbsRef = useRef<{ x: number; y: number; time: number }[]>([]);

  // Asteroid belt & Kuiper belt particles cache
  const asteroidsRef = useRef<{ r: number; angle: number; speed: number; size: number; color: string; belt: 'main' | 'kuiper' }[]>([]);
  if (asteroidsRef.current.length === 0) {
    const list = [];
    // 1. Main Asteroid Belt (between Mars and Jupiter, around Ceres: 82M to 135M m)
    for (let i = 0; i < 450; i++) {
      const r = 82000000 + Math.random() * 52000000;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.000006 + Math.random() * 0.000004;
      const size = Math.random() * 1.6 + 0.6;
      const color = Math.random() > 0.6 ? '#71717a' : Math.random() > 0.3 ? '#a1a1aa' : '#d4d4d8';
      list.push({ r, angle, speed, size, color, belt: 'main' as const });
    }
    // 2. Kuiper Belt (trans-Neptunian region, around Pluto: 580M to 820M m)
    for (let i = 0; i < 350; i++) {
      const r = 580000000 + Math.random() * 240000000;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.0000015 + Math.random() * 0.000001;
      const size = Math.random() * 1.5 + 0.5;
      const color = Math.random() > 0.5 ? '#94a3b8' : '#64748b';
      list.push({ r, angle, speed, size, color, belt: 'kuiper' as const });
    }
    asteroidsRef.current = list;
  }

  // Realistic high-fidelity starfield cache
  const starsRef = useRef<{ x: number; y: number; size: number; alpha: number; color: string; twinkleSpeed: number }[]>([]);
  if (starsRef.current.length === 0) {
    const starColors = ['#ffffff', '#f8fafc', '#bae6fd', '#93c5fd', '#fef08a', '#fed7aa', '#f43f5e', '#c084fc'];
    const list = [];
    for (let i = 0; i < 650; i++) {
      list.push({
        x: (Math.random() - 0.5) * 4500,
        y: (Math.random() - 0.5) * 4500,
        size: Math.random() * 1.6 + 0.35,
        alpha: Math.random() * 0.7 + 0.3,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        twinkleSpeed: Math.random() * 2 + 1,
      });
    }
    starsRef.current = list;
  }

  // Format Helpers
  const formatDist = (m: number) => {
    if (m >= 1e9) return `${(m / 1e9).toFixed(2)} Gm`;
    if (m >= 1e6) return `${(m / 1e6).toFixed(2)} Mm`;
    if (m >= 1e3) return `${(m / 1e3).toFixed(1)} km`;
    return `${m.toFixed(0)} m`;
  };

  const formatSpeed = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(2)} km/s`;
    return `${v.toFixed(1)} m/s`;
  };

  const formatTime = (sec: number) => {
    if (!isFinite(sec) || sec <= 0) return '--';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  // High-Precision Forward Numerical Trajectory Propagation
  const trajectoryAnalysis: TrajectoryAnalysis = useMemo(() => {
    const earthPos = getBodyPositionAtTime('earth', missionTime);
    const moonPos = getBodyPositionAtTime('moon', missionTime);

    const isMoonSOI = vessel.soi === 'moon';
    const centralBody = isMoonSOI ? SOLAR_SYSTEM.moon : SOLAR_SYSTEM.earth;
    const centralWorldPos = isMoonSOI ? moonPos : earthPos;

    // Relative coordinates to the central gravitational body
    let rx = isMoonSOI ? vessel.x - (moonPos.x - earthPos.x) : vessel.x;
    let ry = isMoonSOI ? vessel.y - (moonPos.y - earthPos.y) : vessel.y;
    let vx = isMoonSOI ? vessel.vx : vessel.vx;
    let vy = isMoonSOI ? vessel.vy : vessel.vy;

    const r0 = Math.hypot(rx, ry);
    const v0 = Math.hypot(vx, vy);

    const points: TrajectoryPoint[] = [];
    points.push({
      x: centralWorldPos.x + rx,
      y: centralWorldPos.y + ry,
      r: r0,
      alt: Math.max(0, r0 - centralBody.radius),
      t: 0,
      inAtmosphere: r0 < centralBody.radius + centralBody.atmosphereHeight,
      isImpact: r0 <= centralBody.radius,
    });

    // If resting static on pad with near zero speed
    if (vessel.altitude < 15 && v0 < 1.0) {
      return {
        points,
        apoapsisPt: null,
        periapsisPt: null,
        impactPt: null,
        moonEncounterPt: null,
        isClosedOrbit: false,
        isHyperbolic: false,
        timeToImpact: null,
      };
    }

    const mu = centralBody.mu;
    const eps = (v0 * v0) / 2 - mu / r0;
    const isHyperbolic = eps >= 0;
    const isClosedOrbit = orbit.isOrbiting && orbit.eccentricity < 0.95;

    // Set forward simulation duration
    let totalSimTime = 1200; // 20 minutes default
    if (isClosedOrbit && orbit.period > 0 && isFinite(orbit.period)) {
      totalSimTime = Math.min(12000, orbit.period * 1.05);
    } else if (orbit.timeToApoapsis > 0) {
      totalSimTime = Math.max(120, Math.min(8000, orbit.timeToApoapsis * 2.3));
    } else if (isHyperbolic) {
      totalSimTime = 15000;
    }

    const steps = 320;
    const dt = Math.max(0.5, totalSimTime / steps);

    let maxDist = r0;
    let maxDistPt: TrajectoryPoint | null = null;
    let minDist = r0;
    let minDistPt: TrajectoryPoint | null = null;
    let impactPt: TrajectoryPoint | null = null;
    let moonEncounterPt: TrajectoryPoint | null = null;

    let prevDist = r0;
    let isAscending = true;

    for (let step = 1; step <= steps; step++) {
      const curDist = Math.hypot(rx, ry);
      const curTime = step * dt;

      // Track Apoapsis (crest of the arc)
      if (isAscending && curDist < prevDist && curDist > centralBody.radius) {
        isAscending = false;
        maxDist = prevDist;
        maxDistPt = points[points.length - 1];
      }
      if (curDist > maxDist) {
        maxDist = curDist;
      }

      // Check ground collision
      if (curDist <= centralBody.radius) {
        impactPt = {
          x: centralWorldPos.x + rx,
          y: centralWorldPos.y + ry,
          r: curDist,
          alt: 0,
          t: curTime,
          inAtmosphere: true,
          isImpact: true,
        };
        points.push(impactPt);
        break;
      }

      // Check Moon SOI Encounter (if in Earth SOI and launching towards Moon)
      if (!isMoonSOI && !moonEncounterPt && SOLAR_SYSTEM.moon) {
        const moonDistNow = Math.hypot((centralWorldPos.x + rx) - moonPos.x, (centralWorldPos.y + ry) - moonPos.y);
        if (moonDistNow <= SOLAR_SYSTEM.moon.soiRadius) {
          moonEncounterPt = {
            x: centralWorldPos.x + rx,
            y: centralWorldPos.y + ry,
            r: curDist,
            alt: curDist - centralBody.radius,
            t: curTime,
            inAtmosphere: false,
            isImpact: false,
          };
        }
      }

      // Gravitational acceleration (inverse square law towards central body)
      const invR3 = 1 / (curDist * curDist * curDist);
      const ax = -mu * rx * invR3;
      const ay = -mu * ry * invR3;

      // Semi-implicit Euler integration
      vx += ax * dt;
      vy += ay * dt;
      rx += vx * dt;
      ry += vy * dt;

      const pt: TrajectoryPoint = {
        x: centralWorldPos.x + rx,
        y: centralWorldPos.y + ry,
        r: curDist,
        alt: Math.max(0, curDist - centralBody.radius),
        t: curTime,
        inAtmosphere: curDist < centralBody.radius + centralBody.atmosphereHeight,
        isImpact: false,
      };
      points.push(pt);

      if (!isAscending && curDist < minDist) {
        minDist = curDist;
        minDistPt = pt;
      }

      prevDist = curDist;
    }

    return {
      points,
      apoapsisPt: maxDistPt,
      periapsisPt: minDistPt,
      impactPt,
      moonEncounterPt,
      isClosedOrbit,
      isHyperbolic,
      timeToImpact: impactPt ? impactPt.t : null,
    };
  }, [vessel, orbit, missionTime]);

  // Handle Target Focus Switching
  const handleSelectFocus = useCallback((targetId: 'rocket' | string) => {
    setFocusTarget(targetId);
    const cam = cameraRef.current;

    if (targetId === 'rocket') {
      setIsFollowingRocket(true);
      const earthPos = getBodyPositionAtTime('earth', missionTime);
      const rx = earthPos.x + vessel.x;
      const ry = earthPos.y + vessel.y;
      cam.targetX = rx;
      cam.targetY = ry;

      // Adaptive zoom based on rocket altitude:
      if (vessel.altitude < 150000) {
        cam.targetZoom = 0.0014; // Surface & ascent arc
      } else if (vessel.altitude < 2000000) {
        cam.targetZoom = 0.0006; // Full Earth low/medium orbit
      } else {
        cam.targetZoom = 0.00012; // High translunar orbit
      }
      setSelectedBodyId('earth');
    } else if (targetId === 'system') {
      setIsFollowingRocket(false);
      cam.targetX = 0;
      cam.targetY = 0;
      cam.targetZoom = 0.0000018; // Full solar system
    } else {
      setIsFollowingRocket(false);
      const bPos = getBodyPositionAtTime(targetId, missionTime);
      cam.targetX = bPos.x;
      cam.targetY = bPos.y;
      setSelectedBodyId(targetId);

      const bodyDef = SOLAR_SYSTEM[targetId];
      if (bodyDef) {
        // Zoom tailored to celestial radius
        const fitRadius = bodyDef.radius * 3.5;
        cam.targetZoom = Math.min(0.005, Math.max(0.000002, 300 / fitRadius));
      }
    }
  }, [missionTime, vessel]);

  // Initial mount: ensure rocket is focused immediately
  useEffect(() => {
    handleSelectFocus('rocket');
  }, []);

  // Update Breadcrumbs history (recent vessel path)
  useEffect(() => {
    const earthPos = getBodyPositionAtTime('earth', missionTime);
    const wx = earthPos.x + vessel.x;
    const wy = earthPos.y + vessel.y;

    const trail = breadcrumbsRef.current;
    if (trail.length === 0 || Math.hypot(trail[trail.length - 1].x - wx, trail[trail.length - 1].y - wy) > 800) {
      trail.push({ x: wx, y: wy, time: missionTime });
      if (trail.length > 200) trail.shift();
    }
  }, [missionTime, vessel.x, vessel.y]);

  // Main Canvas Rendering Loop
  useEffect(() => {
    let animId: number;
    let particleOffset = 0;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return;

      const cx = w / 2;
      const cy = h / 2;

      // Update camera smooth tracking
      const cam = cameraRef.current;
      if (isFollowingRocket) {
        const earthPos = getBodyPositionAtTime('earth', missionTime);
        cam.targetX = earthPos.x + vessel.x;
        cam.targetY = earthPos.y + vessel.y;
      } else if (focusTarget && focusTarget !== 'system' && focusTarget !== 'free') {
        const bPos = getBodyPositionAtTime(focusTarget, missionTime);
        cam.targetX = bPos.x;
        cam.targetY = bPos.y;
      }

      // Lerp camera coordinates
      cam.x += (cam.targetX - cam.x) * 0.12;
      cam.y += (cam.targetY - cam.y) * 0.12;
      cam.zoom += (cam.targetZoom - cam.zoom) * 0.15;

      const curCamX = cam.x;
      const curCamY = cam.y;
      const curZoom = cam.zoom;

      // Coordinate converter: world to screen
      const toScreen = (wx: number, wy: number) => ({
        x: cx + (wx - curCamX) * curZoom,
        y: cy - (wy - curCamY) * curZoom,
      });

      // Clear Canvas & Background
      ctx.fillStyle = '#020617'; // Deep space slate
      ctx.fillRect(0, 0, w, h);

      // Subtle Galactic Center ambient glow
      const sunScreen = toScreen(0, 0);
      const galGlow = ctx.createRadialGradient(sunScreen.x, sunScreen.y, 20, sunScreen.x, sunScreen.y, Math.max(w, h) * 1.5);
      galGlow.addColorStop(0, 'rgba(49, 46, 129, 0.22)');
      galGlow.addColorStop(0.35, 'rgba(30, 27, 75, 0.14)');
      galGlow.addColorStop(0.7, 'rgba(15, 23, 42, 0.08)');
      galGlow.addColorStop(1, 'rgba(2, 6, 23, 0)');
      ctx.fillStyle = galGlow;
      ctx.fillRect(0, 0, w, h);

      // Twinkling multi-spectral stars (high-realism deep space view)
      starsRef.current.forEach((star) => {
        const sx = ((star.x - curCamX * 0.0000006 + 40000) % w + w) % w;
        const sy = ((star.y - curCamY * 0.0000006 + 40000) % h + h) % h;
        const twinkle = 0.72 + 0.28 * Math.sin(missionTime * star.twinkleSpeed + star.x);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = star.alpha * twinkle;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 1. Draw Planetary & Moon Orbits
      Object.values(SOLAR_SYSTEM).forEach((body) => {
        if (!body.parent || body.orbitRadius <= 0) return;

        const parentPos = getBodyPositionAtTime(body.parent, missionTime);
        const pScreen = toScreen(parentPos.x, parentPos.y);
        const rScreen = body.orbitRadius * curZoom;

        if (rScreen < 2) return;

        ctx.save();
        ctx.beginPath();
        ctx.arc(pScreen.x, pScreen.y, rScreen, 0, Math.PI * 2);

        if (body.category === 'moon') {
          const isSelected = selectedBodyId === body.id;
          ctx.strokeStyle = isSelected ? 'rgba(216, 180, 254, 0.75)' : 'rgba(148, 163, 184, 0.28)';
          ctx.lineWidth = isSelected ? 1.5 : 1;
          ctx.setLineDash([4, 6]);
        } else {
          const isSelected = selectedBodyId === body.id;
          ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.75)' : 'rgba(71, 85, 105, 0.3)';
          ctx.lineWidth = isSelected ? 1.75 : 1;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.restore();
      });

      // 2. Draw Asteroid Belt & Kuiper Belt (when visible in solar views)
      if (curZoom < 0.00005) {
        // Main Asteroid Belt boundary guides
        const sunPos = toScreen(0, 0);
        const mainInnerR = 82000000 * curZoom;
        const mainOuterR = 135000000 * curZoom;
        if (mainInnerR > 10) {
          ctx.save();
          ctx.strokeStyle = 'rgba(161, 161, 170, 0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 8]);
          ctx.beginPath();
          ctx.arc(sunPos.x, sunPos.y, mainInnerR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sunPos.x, sunPos.y, mainOuterR, 0, Math.PI * 2);
          ctx.stroke();

          // Label for Main Asteroid Belt
          if (curZoom < 0.000015) {
            ctx.fillStyle = 'rgba(161, 161, 170, 0.45)';
            ctx.font = '8px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('MAIN ASTEROID BELT (2.1–3.3 AU)', sunPos.x + (mainInnerR + mainOuterR) / 2 - 40, sunPos.y - 4);
          }
          ctx.restore();
        }

        // Kuiper Belt boundary guides
        const kuiperInnerR = 580000000 * curZoom;
        const kuiperOuterR = 820000000 * curZoom;
        if (kuiperInnerR > 15) {
          ctx.save();
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 10]);
          ctx.beginPath();
          ctx.arc(sunPos.x, sunPos.y, kuiperInnerR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(sunPos.x, sunPos.y, kuiperOuterR, 0, Math.PI * 2);
          ctx.stroke();

          // Label for Kuiper Belt
          if (curZoom < 0.000004) {
            ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
            ctx.font = '8px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('KUIPER BELT (30–50 AU)', sunPos.x + (kuiperInnerR + kuiperOuterR) / 2 - 30, sunPos.y - 4);
          }
          ctx.restore();
        }

        // Render individual asteroids with orbital motion
        asteroidsRef.current.forEach((ast) => {
          const ang = ast.angle + ast.speed * missionTime;
          const ax = Math.cos(ang) * ast.r;
          const ay = Math.sin(ang) * ast.r;
          const pt = toScreen(ax, ay);

          if (pt.x >= -10 && pt.x <= w + 10 && pt.y >= -10 && pt.y <= h + 10) {
            ctx.fillStyle = ast.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, Math.max(0.65, ast.size * curZoom * 7000), 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // 3. Draw Celestial Bodies (Realistic Surface Geology, Atmospheres, Rings, and Moons)
      // Sort so parents and larger worlds render gracefully
      const sortedBodies = Object.values(SOLAR_SYSTEM).slice().sort((a, b) => {
        if (a.id === 'sun') return -1;
        if (b.id === 'sun') return 1;
        if (a.category === 'planet' && b.category === 'moon') return -1;
        if (a.category === 'moon' && b.category === 'planet') return 1;
        return 0;
      });

      sortedBodies.forEach((body) => {
        const bPos = getBodyPositionAtTime(body.id, missionTime);
        const sPt = toScreen(bPos.x, bPos.y);

        // Cull bodies far off screen
        if (sPt.x < -400 || sPt.x > w + 400 || sPt.y < -400 || sPt.y > h + 400) return;

        const physicalRadiusScreen = body.radius * curZoom;
        const renderRadius = Math.max(4, physicalRadiusScreen);

        ctx.save();

        // Atmospheric Halo & Glow (e.g. Earth, Venus, Titan, Mars)
        if (body.atmosphereHeight > 0 && physicalRadiusScreen > 2) {
          const atmoRadiusScreen = (body.radius + body.atmosphereHeight) * curZoom;
          const atmoGrad = ctx.createRadialGradient(
            sPt.x, sPt.y, physicalRadiusScreen,
            sPt.x, sPt.y, atmoRadiusScreen * 1.15
          );
          const baseAtmoColor = body.atmosphereColor || 'rgba(56, 189, 248, 0.45)';
          atmoGrad.addColorStop(0, baseAtmoColor);
          atmoGrad.addColorStop(0.6, baseAtmoColor.replace('0.45', '0.18').replace('0.5', '0.2').replace('0.6', '0.22'));
          atmoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = atmoGrad;
          ctx.beginPath();
          ctx.arc(sPt.x, sPt.y, atmoRadiusScreen * 1.15, 0, Math.PI * 2);
          ctx.fill();

          // Delicate Karman boundary ring
          ctx.strokeStyle = body.atmosphereColor || 'rgba(56, 189, 248, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sPt.x, sPt.y, atmoRadiusScreen, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Sphere of Influence (SOI) Boundary Ring (in Transfer Mode or when targeted)
        if (body.soiRadius > 0 && body.soiRadius < Infinity && (mapMode === 'TRANSFER' || selectedBodyId === body.id)) {
          const soiScreenRadius = body.soiRadius * curZoom;
          if (soiScreenRadius > 6 && soiScreenRadius < 1800) {
            ctx.strokeStyle = body.category === 'moon' ? 'rgba(216, 180, 254, 0.45)' : 'rgba(56, 189, 248, 0.35)';
            ctx.lineWidth = 1.25;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(sPt.x, sPt.y, soiScreenRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            if (soiScreenRadius > 35) {
              ctx.fillStyle = body.category === 'moon' ? '#c084fc' : '#38bdf8';
              ctx.font = 'bold 9px monospace';
              ctx.fillText(`${body.name} SOI`, sPt.x + soiScreenRadius - 10, sPt.y - 4);
            }
          }
        }

        // Realistic Day/Night Terminator Sun Angle:
        // bPos is heliocentric, so vector from body to Sun at (0, 0) is (-bPos.x, -bPos.y)
        const sunAngle = Math.atan2(-bPos.y, -bPos.x);

        // High detail rendering when zoomed in
        const isHighDetail = physicalRadiusScreen > 8;

        // Render realistic surface from dedicated planetarySurfaces module
        drawPlanetarySurface(
          ctx,
          body.surfaceSpec,
          sPt.x,
          sPt.y,
          renderRadius,
          sunAngle,
          curZoom,
          missionTime,
          isHighDetail
        );

        // Planet & Moon Labels
        if (renderRadius > 3 || selectedBodyId === body.id) {
          ctx.font = selectedBodyId === body.id ? 'bold 11px -apple-system, sans-serif' : '500 10px -apple-system, sans-serif';
          ctx.fillStyle = selectedBodyId === body.id ? '#38bdf8' : 'rgba(226, 232, 240, 0.85)';
          ctx.textAlign = 'center';
          ctx.fillText(body.name, sPt.x, sPt.y + renderRadius + 13);
        }

        ctx.restore();
      });

      // 4. Draw Historical Breadcrumbs Trail (path flown)
      const crumbs = breadcrumbsRef.current;
      if (crumbs.length > 1) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        for (let i = 0; i < crumbs.length; i++) {
          const pt = toScreen(crumbs[i].x, crumbs[i].y);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 5. Draw THE PREDICTED TRAJECTORY PATH (CRYSTAL CLEAR, VIBRANT, GLOWING)
      const traj = trajectoryAnalysis;
      if (traj.points.length > 1) {
        ctx.save();

        // Outer Neon Glow Pass
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = traj.isClosedOrbit 
          ? 'rgba(16, 185, 129, 0.25)' 
          : traj.isHyperbolic 
          ? 'rgba(192, 132, 252, 0.25)' 
          : 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        traj.points.forEach((pt, idx) => {
          const s = toScreen(pt.x, pt.y);
          if (idx === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();

        // Core Sharp Solid Trajectory Line
        ctx.lineWidth = 2.5;
        for (let i = 0; i < traj.points.length - 1; i++) {
          const p1 = traj.points[i];
          const p2 = traj.points[i + 1];
          const s1 = toScreen(p1.x, p1.y);
          const s2 = toScreen(p2.x, p2.y);

          ctx.beginPath();
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);

          // Color coded segments:
          // Amber for re-entry/atmospheric segment, Emerald for closed orbit, Cyan for ascent, Violet for escape
          if (p1.inAtmosphere) {
            ctx.strokeStyle = '#fb923c'; // Re-entry heating amber
          } else if (traj.isClosedOrbit) {
            ctx.strokeStyle = '#10b981'; // Emerald stable orbit
          } else if (traj.isHyperbolic) {
            ctx.strokeStyle = '#c084fc'; // Purple escape
          } else {
            ctx.strokeStyle = '#38bdf8'; // Electric cyan suborbital ascent
          }
          ctx.stroke();
        }

        // Flowing Animated Particle Pulses along trajectory (shows flight direction)
        particleOffset = (particleOffset + 0.008) % 1;
        const totalPts = traj.points.length;
        for (let pulse = 0; pulse < 4; pulse++) {
          const fraction = (particleOffset + pulse * 0.25) % 1;
          const idx = Math.floor(fraction * (totalPts - 1));
          const pt = traj.points[idx];
          if (pt) {
            const s = toScreen(pt.x, pt.y);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }

        ctx.restore();

        // 6. Draw Apoapsis (Ap) Marker Badge
        if (traj.apoapsisPt && traj.apoapsisPt.alt > 1000) {
          const apScreen = toScreen(traj.apoapsisPt.x, traj.apoapsisPt.y);
          ctx.save();

          // Glowing diamond icon
          ctx.fillStyle = '#0284c7';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(apScreen.x, apScreen.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Badge background
          const labelAp = `Ap: ${formatDist(traj.apoapsisPt.alt)}`;
          const labelTime = orbit.timeToApoapsis > 0 ? `T - ${formatTime(orbit.timeToApoapsis)}` : '';
          ctx.font = 'bold 10px monospace';
          const textW = Math.max(ctx.measureText(labelAp).width, ctx.measureText(labelTime).width);

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(apScreen.x + 8, apScreen.y - 18, textW + 12, labelTime ? 32 : 18, 6);
          ctx.fill();
          ctx.stroke();

          // Texts
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'left';
          ctx.fillText(labelAp, apScreen.x + 14, apScreen.y - 5);
          if (labelTime) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '9px monospace';
            ctx.fillText(labelTime, apScreen.x + 14, apScreen.y + 8);
          }
          ctx.restore();
        }

        // 7. Draw Periapsis (Pe) Marker Badge
        if (traj.periapsisPt && traj.isClosedOrbit && traj.periapsisPt.alt > 0) {
          const peScreen = toScreen(traj.periapsisPt.x, traj.periapsisPt.y);
          ctx.save();

          ctx.fillStyle = '#059669';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(peScreen.x, peScreen.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          const labelPe = `Pe: ${formatDist(traj.periapsisPt.alt)}`;
          const labelTime = orbit.timeToPeriapsis > 0 ? `T - ${formatTime(orbit.timeToPeriapsis)}` : '';
          ctx.font = 'bold 10px monospace';
          const textW = Math.max(ctx.measureText(labelPe).width, ctx.measureText(labelTime).width);

          ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(peScreen.x + 8, peScreen.y - 18, textW + 12, labelTime ? 32 : 18, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#10b981';
          ctx.textAlign = 'left';
          ctx.fillText(labelPe, peScreen.x + 14, peScreen.y - 5);
          if (labelTime) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '9px monospace';
            ctx.fillText(labelTime, peScreen.x + 14, peScreen.y + 8);
          }
          ctx.restore();
        }

        // 8. Draw Impact Point Marker (if trajectory impacts surface)
        if (traj.impactPt) {
          const impScreen = toScreen(traj.impactPt.x, traj.impactPt.y);
          ctx.save();

          // Flashing Target Crosshair
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(impScreen.x, impScreen.y, 8, 0, Math.PI * 2);
          ctx.moveTo(impScreen.x - 12, impScreen.y);
          ctx.lineTo(impScreen.x + 12, impScreen.y);
          ctx.moveTo(impScreen.x, impScreen.y - 12);
          ctx.lineTo(impScreen.x, impScreen.y + 12);
          ctx.stroke();

          // Impact label
          const labelImp = '⚠ IMPACT SITE';
          const labelImpTime = traj.timeToImpact ? `T - ${formatTime(traj.timeToImpact)}` : '';
          ctx.font = 'bold 10px monospace';
          const impW = Math.max(ctx.measureText(labelImp).width, ctx.measureText(labelImpTime).width);

          ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(impScreen.x + 14, impScreen.y - 16, impW + 12, 30, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#f87171';
          ctx.fillText(labelImp, impScreen.x + 20, impScreen.y - 3);
          if (labelImpTime) {
            ctx.fillStyle = '#fca5a5';
            ctx.font = '9px monospace';
            ctx.fillText(labelImpTime, impScreen.x + 20, impScreen.y + 9);
          }
          ctx.restore();
        }

        // 9. Draw Moon Encounter Marker
        if (traj.moonEncounterPt) {
          const encScreen = toScreen(traj.moonEncounterPt.x, traj.moonEncounterPt.y);
          ctx.save();
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(encScreen.x, encScreen.y, 10, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#c084fc';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('🌕 Moon SOI Encounter', encScreen.x + 14, encScreen.y + 4);
          ctx.restore();
        }
      }

      // 10. Draw Active Rocket Vessel
      const earthPos = getBodyPositionAtTime('earth', missionTime);
      const vWorldX = earthPos.x + vessel.x;
      const vWorldY = earthPos.y + vessel.y;
      const vScreen = toScreen(vWorldX, vWorldY);

      ctx.save();
      // Outer subtle target pulse ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(vScreen.x, vScreen.y, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Velocity Vector Arrow (Prograde)
      const speed = Math.hypot(vessel.vx, vessel.vy);
      if (speed > 0.5) {
        const normVx = vessel.vx / speed;
        const normVy = -vessel.vy / speed; // screen Y inverted
        const arrowLen = 32;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(vScreen.x, vScreen.y);
        ctx.lineTo(vScreen.x + normVx * arrowLen, vScreen.y + normVy * arrowLen);
        ctx.stroke();

        // Arrowhead
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(vScreen.x + normVx * arrowLen, vScreen.y + normVy * arrowLen, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Active Engine Flame (if firing)
      if (vessel.throttle > 0) {
        const flameAngle = vessel.angle + Math.PI; // Opposite to heading
        const fx = vScreen.x + Math.sin(flameAngle) * 12;
        const fy = vScreen.y + Math.cos(flameAngle) * 12;

        const flameGrad = ctx.createRadialGradient(fx, fy, 2, fx, fy, 14);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#f59e0b');
        flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = flameGrad;
        ctx.beginPath();
        ctx.arc(fx, fy, 12, 0, Math.PI * 2);
        ctx.fill();
      }

      // Oriented Rocket Silhouette / Chevron
      ctx.translate(vScreen.x, vScreen.y);
      ctx.rotate(-vessel.angle); // Heading orientation

      ctx.fillStyle = '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      // Rocket needle / delta-wing body
      ctx.beginPath();
      ctx.moveTo(0, -9); // Nose cone
      ctx.lineTo(6, 7);  // Right fin
      ctx.lineTo(2, 5);  // Engine nozzle recess
      ctx.lineTo(-2, 5);
      ctx.lineTo(-6, 7); // Left fin
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();

      // Vessel HUD Tag
      ctx.save();
      const tagText = `🚀 Astronet-1 | Alt: ${formatDist(vessel.altitude)} | ${formatSpeed(vessel.orbitalSpeed)}`;
      ctx.font = 'bold 10px monospace';
      const tagW = ctx.measureText(tagText).width;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(vScreen.x - tagW / 2 - 8, vScreen.y - 36, tagW + 16, 20, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(tagText, vScreen.x, vScreen.y - 22);
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [missionTime, isFollowingRocket, selectedBodyId, vessel, orbit, trajectoryAnalysis, mapMode]);

  // Window Resize Listener
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse / Wheel Handlers for Smooth Interactive Pan & Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.8 : 1.25;
    const cam = cameraRef.current;
    cam.targetZoom = Math.max(0.0000004, Math.min(0.05, cam.targetZoom * factor));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    // Break rocket lock when user freely drags the map
    setIsFollowingRocket(false);
    setFocusTarget('free');

    const cam = cameraRef.current;
    cam.targetX -= dx / cam.zoom;
    cam.targetY += dy / cam.zoom;
    cam.x = cam.targetX;
    cam.y = cam.targetY;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const cam = cameraRef.current;

    let closestBodyId: string | null = null;
    let closestDist = 28; // Click tolerance in px

    Object.values(SOLAR_SYSTEM).forEach((body) => {
      const bPos = getBodyPositionAtTime(body.id, missionTime);
      const sx = cx + (bPos.x - cam.x) * cam.zoom;
      const sy = cy - (bPos.y - cam.y) * cam.zoom;
      const d = Math.hypot(clickX - sx, clickY - sy);
      const hitRadius = Math.max(18, body.radius * cam.zoom + 8);
      if (d < hitRadius && d < closestDist) {
        closestDist = d;
        closestBodyId = body.id;
      }
    });

    if (closestBodyId) {
      setSelectedBodyId(closestBodyId);
      setShowTargetInspector(true);
    }
  };

  // Target Body Analysis
  const selectedBody = SOLAR_SYSTEM[selectedBodyId] || SOLAR_SYSTEM.earth;
  const earthWorldPos = getBodyPositionAtTime('earth', missionTime);
  const targetWorldPos = getBodyPositionAtTime(selectedBody.id, missionTime);
  const vesselWorldPos = { x: earthWorldPos.x + vessel.x, y: earthWorldPos.y + vessel.y };
  const distanceToTarget = Math.hypot(vesselWorldPos.x - targetWorldPos.x, vesselWorldPos.y - targetWorldPos.y);

  // Flight Guidance status text
  const flightStatus = orbit.isOrbiting
    ? 'STABLE CLOSED ORBIT'
    : orbit.isHyperbolic
    ? 'HYPERBOLIC ESCAPE TRAJECTORY'
    : vessel.altitude < 100
    ? 'LAUNCH PAD / SURFACE'
    : 'SUBORBITAL BALLISTIC TRAJECTORY';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-slate-950 overflow-hidden select-none font-sans text-slate-100"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* TOP BAR: MODES & PRIMARY TARGET FOCUS SELECTOR */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between gap-3 pointer-events-none z-30">
        {/* Left: Map Mode Selector & Target Switcher */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-1.5 shadow-2xl max-w-4xl overflow-x-auto scrollbar-none">
          {/* Map Modes Switcher */}
          <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800/60">
            <button
              onClick={() => setMapMode('ORBIT')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                mapMode === 'ORBIT'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Orbit className="w-3.5 h-3.5" />
              <span>Orbit Mode</span>
            </button>

            <button
              onClick={() => setMapMode('TRANSFER')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                mapMode === 'TRANSFER'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Transfer Mode</span>
            </button>

            <button
              onClick={() => {
                setMapMode('SOLAR');
                handleSelectFocus('system');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                mapMode === 'SOLAR'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Solar System</span>
            </button>
          </div>

          <div className="w-px h-5 bg-slate-800 shrink-0" />

          {/* FIRST & PRIMARY FOCUS: ROCKET BUTTON */}
          <button
            id="map-focus-rocket-btn"
            onClick={() => handleSelectFocus('rocket')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer shrink-0 border ${
              focusTarget === 'rocket' && isFollowingRocket
                ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-md shadow-sky-500/30'
                : 'bg-slate-800 text-sky-400 border-sky-500/30 hover:bg-slate-700'
            }`}
          >
            <Rocket className="w-3.5 h-3.5 fill-current" />
            <span>🚀 Rocket (Focus)</span>
            {isFollowingRocket && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            )}
          </button>

          {/* Quick Celestial Body Focus Switchers */}
          {[
            { id: 'earth', name: 'Earth', icon: '🌍' },
            { id: 'moon', name: 'Moon', icon: '🌕' },
            { id: 'mars', name: 'Mars', icon: '🔴' },
            { id: 'jupiter', name: 'Jupiter', icon: '🪐' },
            { id: 'saturn', name: 'Saturn', icon: '🪐' },
            { id: 'uranus', name: 'Uranus', icon: '🔵' },
            { id: 'neptune', name: 'Neptune', icon: '🔷' },
            { id: 'pluto', name: 'Pluto', icon: '⚪' },
            { id: 'venus', name: 'Venus', icon: '🟡' },
            { id: 'mercury', name: 'Mercury', icon: '⚪' },
            { id: 'sun', name: 'Sun', icon: '☀️' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectFocus(item.id)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                focusTarget === item.id
                  ? 'bg-slate-800 text-sky-300 border border-sky-500/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </div>

        {/* Right: Time Warp & Exit Map Mode */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Time Warp Bar */}
          <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-1 text-xs font-mono shadow-2xl">
            <span className="text-[10px] text-slate-400 font-bold px-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3 text-sky-400" />
              Warp:
            </span>
            {[1, 2, 5, 10, 50, 100, 1000].map((w) => (
              <button
                key={w}
                onClick={() => onSetTimeWarp(w)}
                className={`px-2 py-1 rounded-xl font-bold transition cursor-pointer ${
                  timeWarp === w
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {w}x
              </button>
            ))}
          </div>

          {/* Close Map / Return to Flight View Button */}
          <button
            id="exit-map-btn"
            onClick={onCloseMap}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-xl shadow-sky-600/20 cursor-pointer"
          >
            <Orbit className="w-4 h-4 text-sky-200" />
            <span>Flight View (M)</span>
          </button>
        </div>
      </div>

      {/* FLOATING SNAP-BACK TO ROCKET BUTTON (Visible when user has panned away) */}
      {!isFollowingRocket && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 pointer-events-auto z-30 animate-in fade-in slide-in-from-top-3">
          <button
            onClick={() => handleSelectFocus('rocket')}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-xl shadow-sky-500/30 transition-all hover:scale-105 cursor-pointer"
          >
            <Crosshair className="w-4 h-4" />
            <span>Recenter & Lock on Rocket</span>
          </button>
        </div>
      )}

      {/* LEFT: ORBIT & TRAJECTORY TELEMETRY DECK */}
      <div className="absolute top-18 left-4 pointer-events-auto z-20 flex flex-col gap-2">
        <button
          onClick={() => setShowTelemetryDeck(!showTelemetryDeck)}
          className="self-start px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800/90 text-xs font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-md transition cursor-pointer"
        >
          <Orbit className="w-3.5 h-3.5 text-sky-400" />
          <span>Orbital Telemetry</span>
          <span className="text-[10px] text-slate-500">{showTelemetryDeck ? '▲' : '▼'}</span>
        </button>

        {showTelemetryDeck && (
          <div className="w-76 bg-slate-900/95 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 shadow-2xl text-xs font-mono space-y-3 animate-in fade-in slide-in-from-top-2">
            {/* Status Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Trajectory State</span>
              <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] ${
                orbit.isOrbiting
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : orbit.isHyperbolic
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {flightStatus}
              </span>
            </div>

            {/* Core Telemetry Numbers */}
            <div className="space-y-2 text-slate-300">
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800/50">
                <span className="text-slate-400 flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-sky-400" /> Apoapsis (Ap):
                </span>
                <div className="text-right">
                  <div className="text-sky-400 font-bold">{orbit.apoapsis > 0 ? formatDist(orbit.apoapsis) : 'N/A'}</div>
                  {orbit.timeToApoapsis > 0 && (
                    <div className="text-[9px] text-slate-400">T - {formatTime(orbit.timeToApoapsis)}</div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1.5 rounded-xl border border-slate-800/50">
                <span className="text-slate-400 flex items-center gap-1">
                  <ArrowDown className="w-3 h-3 text-emerald-400" /> Periapsis (Pe):
                </span>
                <div className="text-right">
                  <div className={`font-bold ${
                    orbit.periapsis > 30000 ? 'text-emerald-400' : orbit.periapsis > 0 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {orbit.periapsis > 0 ? formatDist(orbit.periapsis) : trajectoryAnalysis.impactPt ? 'Ground Impact' : 'Suborbital'}
                  </div>
                  {orbit.timeToPeriapsis > 0 && (
                    <div className="text-[9px] text-slate-400">T - {formatTime(orbit.timeToPeriapsis)}</div>
                  )}
                </div>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-slate-400">Orbital Speed:</span>
                <span className="text-emerald-400 font-bold">{formatSpeed(vessel.orbitalSpeed)}</span>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-slate-400">Altitude:</span>
                <span className="text-white font-bold">{formatDist(vessel.altitude)}</span>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-slate-400">Eccentricity:</span>
                <span className="text-slate-300 font-bold">{orbit.eccentricity.toFixed(4)}</span>
              </div>

              <div className="flex justify-between items-center px-1">
                <span className="text-slate-400">Orbital Period:</span>
                <span className="text-slate-300">{orbit.period > 0 && isFinite(orbit.period) ? formatTime(orbit.period) : '--'}</span>
              </div>
            </div>

            {/* Dynamic Guidance Tip */}
            <div className="pt-2 border-t border-slate-800/80 text-[11px] leading-relaxed text-slate-400">
              {vessel.altitude < 30000 ? (
                <span className="text-amber-300">
                  ⚡ Dense atmosphere. Maintain vertical ascent to 10 km, then gradually pitch east (90°) for gravity turn.
                </span>
              ) : !orbit.isOrbiting ? (
                <span className="text-sky-300">
                  🚀 Suborbital. Coast to Apoapsis ({formatDist(orbit.apoapsis)}), then execute Prograde burn to raise Periapsis above 35 km to circularize.
                </span>
              ) : (
                <span className="text-emerald-300">
                  ✨ Stable Earth Orbit. Ready for Trans-Lunar Injection (TLI) burn when Moon phase angle reaches ~90°.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: TARGET BODY INSPECTOR & TRANSFER CALCULATOR */}
      <div className="absolute top-18 right-4 pointer-events-auto z-20 flex flex-col gap-2">
        <button
          onClick={() => setShowTargetInspector(!showTargetInspector)}
          className="self-end px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-800/90 text-xs font-bold flex items-center gap-1.5 shadow-xl backdrop-blur-md transition cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-indigo-400" />
          <span>Target: {selectedBody.name}</span>
          <span className="text-[10px] text-slate-500">{showTargetInspector ? '▲' : '▼'}</span>
        </button>

        {showTargetInspector && (
          <div className="w-80 bg-slate-900/95 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 shadow-2xl space-y-3 text-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: selectedBody.color }} />
                <h4 className="font-bold text-white text-sm">{selectedBody.name}</h4>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {selectedBody.category}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {selectedBody.details}
            </p>

            {/* Inspector Tab Selector */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
              <button
                onClick={() => setInspectorTab('real')}
                className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  inspectorTab === 'real'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Exact Real Units
              </button>
              <button
                onClick={() => setInspectorTab('sim')}
                className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  inspectorTab === 'sim'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Flight Telemetry
              </button>
              <button
                onClick={() => setInspectorTab('geo')}
                className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  inspectorTab === 'geo'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Geology & Atmo
              </button>
            </div>

            {/* Tab 1: Exact Real Astronomical Units */}
            {inspectorTab === 'real' && (
              <div className="bg-slate-950/80 border border-sky-900/40 rounded-xl p-2.5 space-y-1.5 font-mono text-[11px] max-h-64 overflow-y-auto">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Exact Mean Radius:</span>
                  <span className="text-sky-300 font-bold">
                    {selectedBody.surfaceSpec.realRadiusKm
                      ? `${selectedBody.surfaceSpec.realRadiusKm.toLocaleString()} km`
                      : `${(selectedBody.radius / 1000).toLocaleString()} km`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Real Mass:</span>
                  <span className="text-slate-200 font-bold">
                    {selectedBody.surfaceSpec.realMassKg
                      ? `${selectedBody.surfaceSpec.realMassKg.toExponential(3)} kg`
                      : `${selectedBody.mass.toExponential(3)} kg`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Distance from {selectedBody.parent ? SOLAR_SYSTEM[selectedBody.parent]?.name || 'Parent' : 'Sun'}:</span>
                  <span className="text-emerald-400 font-bold">
                    {selectedBody.surfaceSpec.realDistanceKm
                      ? selectedBody.surfaceSpec.realDistanceKm >= 1e8
                        ? `${(selectedBody.surfaceSpec.realDistanceKm / 1e6).toFixed(1)}M km (${selectedBody.surfaceSpec.realSemiMajorAxisAU ?? (selectedBody.surfaceSpec.realDistanceKm / 149597870.7).toFixed(2)} AU)`
                        : `${selectedBody.surfaceSpec.realDistanceKm.toLocaleString()} km`
                      : selectedBody.orbitRadius > 0
                      ? formatDist(selectedBody.orbitRadius)
                      : '0 km (System Center)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Real Surface Gravity:</span>
                  <span className="text-amber-300 font-bold">
                    {selectedBody.surfaceSpec.realSurfaceGravityMs2
                      ? `${selectedBody.surfaceSpec.realSurfaceGravityMs2.toFixed(3)} m/s² (${(selectedBody.surfaceSpec.realSurfaceGravityMs2 / 9.80665).toFixed(2)} g)`
                      : `${selectedBody.surfaceGravity.toFixed(2)} m/s²`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Escape Velocity:</span>
                  <span className="text-rose-300 font-bold">
                    {selectedBody.surfaceSpec.realEscapeVelocityKms
                      ? `${selectedBody.surfaceSpec.realEscapeVelocityKms.toFixed(2)} km/s`
                      : `${(Math.sqrt((2 * selectedBody.surfaceSpec.mu) / selectedBody.radius) / 1000).toFixed(2)} km/s`}
                  </span>
                </div>
                {selectedBody.surfaceSpec.realOrbitSpeedKms !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Mean Orbital Speed:</span>
                    <span className="text-cyan-300 font-bold">{selectedBody.surfaceSpec.realOrbitSpeedKms.toFixed(2)} km/s</span>
                  </div>
                )}
                {selectedBody.surfaceSpec.realOrbitPeriodDays !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Orbital Period:</span>
                    <span className="text-indigo-300 font-bold">
                      {selectedBody.surfaceSpec.realOrbitPeriodDays > 365.25
                        ? `${(selectedBody.surfaceSpec.realOrbitPeriodDays / 365.25).toFixed(2)} Earth yrs`
                        : `${selectedBody.surfaceSpec.realOrbitPeriodDays.toFixed(1)} Earth days`}
                    </span>
                  </div>
                )}
                {selectedBody.surfaceSpec.realDensityGcm3 !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Mean Density:</span>
                    <span className="text-slate-300 font-bold">{selectedBody.surfaceSpec.realDensityGcm3.toFixed(3)} g/cm³</span>
                  </div>
                )}
                {selectedBody.surfaceSpec.realSurfacePressureBar !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Surface Pressure:</span>
                    <span className="text-sky-400 font-bold">
                      {selectedBody.surfaceSpec.realSurfacePressureBar === 0
                        ? 'Vacuum (0 bar)'
                        : selectedBody.surfaceSpec.realSurfacePressureBar >= 1
                        ? `${selectedBody.surfaceSpec.realSurfacePressureBar.toFixed(2)} bar`
                        : `${selectedBody.surfaceSpec.realSurfacePressureBar.toExponential(2)} bar`}
                    </span>
                  </div>
                )}
                {selectedBody.surfaceSpec.realHillSphereKm !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Hill Sphere (Gravity):</span>
                    <span className="text-teal-300 font-bold">{selectedBody.surfaceSpec.realHillSphereKm.toLocaleString()} km</span>
                  </div>
                )}
                {selectedBody.surfaceSpec.realSurfaceTempRangeK && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Surface Temperature:</span>
                    <span className="text-orange-300 font-bold">
                      {selectedBody.surfaceSpec.realSurfaceTempRangeK.avg}K ({selectedBody.surfaceSpec.realSurfaceTempRangeK.avg - 273}°C)
                    </span>
                  </div>
                )}
                {selectedBody.surfaceSpec.axialTiltDeg !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Axial Tilt:</span>
                    <span className="text-slate-300 font-bold">{selectedBody.surfaceSpec.axialTiltDeg.toFixed(2)}°</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Flight Simulation Telemetry */}
            {inspectorTab === 'sim' && (
              <div className="bg-slate-950/70 border border-slate-800/70 rounded-xl p-2.5 space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Distance from Rocket:</span>
                  <span className="text-emerald-400 font-bold">{formatDist(distanceToTarget)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Surface Gravity:</span>
                  <span className="text-slate-200 font-bold">{selectedBody.surfaceGravity.toFixed(2)} m/s²</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Escape Velocity:</span>
                  <span className="text-amber-300 font-bold">
                    {(Math.sqrt((2 * selectedBody.surfaceSpec.mu) / selectedBody.radius) / 1000).toFixed(2)} km/s
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Day Length:</span>
                  <span className="text-slate-300 font-bold">
                    {selectedBody.surfaceSpec.rotationPeriodSec
                      ? (selectedBody.surfaceSpec.rotationPeriodSec / 3600).toFixed(1) + ' h'
                      : 'Synchronous'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Atmosphere:</span>
                  <span className="text-sky-400 font-bold">
                    {selectedBody.atmosphereHeight > 0 ? formatDist(selectedBody.atmosphereHeight) : 'Vacuum (0 km)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">SOI Radius:</span>
                  <span className="text-indigo-400 font-bold">
                    {selectedBody.soiRadius < Infinity ? formatDist(selectedBody.soiRadius) : 'Infinite'}
                  </span>
                </div>
              </div>
            )}

            {/* Tab 3: Geology & Atmosphere */}
            {inspectorTab === 'geo' && (
              <div className="bg-slate-950/80 border border-emerald-900/40 rounded-xl p-2.5 space-y-2 text-[11px] max-h-64 overflow-y-auto">
                <div>
                  <span className="text-emerald-400 font-bold uppercase text-[10px] tracking-wider block">Geological Overview:</span>
                  <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
                    {selectedBody.surfaceSpec.geologySummary || selectedBody.surfaceSpec.landSurface?.geologicalComposition || 'Diverse extraterrestrial terrain.'}
                  </p>
                </div>
                {selectedBody.surfaceSpec.atmosphereComposition && (
                  <div>
                    <span className="text-sky-400 font-bold uppercase text-[10px] tracking-wider block">Atmosphere Chemistry:</span>
                    <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5 font-mono">
                      {selectedBody.surfaceSpec.atmosphereComposition}
                    </p>
                  </div>
                )}
                {selectedBody.surfaceSpec.landSurface?.surfaceFeatures && selectedBody.surfaceSpec.landSurface.surfaceFeatures.length > 0 && (
                  <div>
                    <span className="text-amber-400 font-bold uppercase text-[10px] tracking-wider block">Landmark Features:</span>
                    <div className="space-y-1 mt-1">
                      {selectedBody.surfaceSpec.landSurface.surfaceFeatures.slice(0, 3).map((f) => (
                        <div key={f.id} className="bg-slate-900/80 rounded-lg p-1.5 border border-slate-800">
                          <span className="font-bold text-slate-200">{f.name}</span> ({f.type}):{' '}
                          <span className="text-slate-400">{f.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Child Moons System exploration */}
            {Object.values(SOLAR_SYSTEM).filter((b) => b.parent === selectedBody.id).length > 0 && (
              <div className="pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  Moons ({Object.values(SOLAR_SYSTEM).filter((b) => b.parent === selectedBody.id).length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {Object.values(SOLAR_SYSTEM)
                    .filter((b) => b.parent === selectedBody.id)
                    .map((moon) => (
                      <button
                        key={moon.id}
                        onClick={() => {
                          setSelectedBodyId(moon.id);
                          handleSelectFocus(moon.id);
                        }}
                        className="px-2 py-1 bg-slate-800/90 hover:bg-sky-900/60 border border-slate-700/80 rounded-lg text-[10px] font-semibold text-slate-200 hover:text-sky-300 transition cursor-pointer"
                      >
                        {moon.name}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Parent Planet exploration if this body is a moon */}
            {selectedBody.parent && selectedBody.parent !== 'sun' && SOLAR_SYSTEM[selectedBody.parent] && (
              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Parent Planet:</span>
                <button
                  onClick={() => {
                    if (selectedBody.parent) {
                      setSelectedBodyId(selectedBody.parent);
                      handleSelectFocus(selectedBody.parent);
                    }
                  }}
                  className="px-2 py-1 bg-slate-800/90 hover:bg-sky-900/60 border border-slate-700/80 rounded-lg text-[10px] font-semibold text-sky-300 transition cursor-pointer"
                >
                  {SOLAR_SYSTEM[selectedBody.parent].name} ↗
                </button>
              </div>
            )}

            <button
              onClick={() => handleSelectFocus(selectedBody.id)}
              className="w-full py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-md cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Center Camera on {selectedBody.name}</span>
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM BAR: IN-MAP PILOT DECK (THROTTLE, STAGING, STEERING, SAS, ZOOM) */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 pointer-events-none z-30">
        {/* Left: Complete Interactive Engine Burn Deck */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-2 shadow-2xl">
          {/* Throttle Controls */}
          {onThrottleChange && (
            <div className="flex items-center gap-2 pr-2 border-r border-slate-800">
              <button
                onClick={() => onThrottleChange(0.0)}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-400 hover:text-rose-300 border border-slate-700 text-[10px] font-mono font-bold transition cursor-pointer"
                title="Cutoff Throttle (X)"
              >
                CUT (X)
              </button>

              <div className="flex items-center gap-1.5">
                <Flame className={`w-3.5 h-3.5 ${vessel.throttle > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-600'}`} />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={vessel.throttle}
                  onChange={(e) => onThrottleChange(parseFloat(e.target.value))}
                  className="w-24 accent-sky-500 cursor-pointer"
                />
                <span className="text-xs font-mono text-white font-bold w-9 text-right">
                  {(vessel.throttle * 100).toFixed(0)}%
                </span>
              </div>

              <button
                onClick={() => onThrottleChange(1.0)}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-sky-950 text-sky-400 hover:text-sky-300 border border-slate-700 text-[10px] font-mono font-bold transition cursor-pointer"
                title="Full Throttle (Z)"
              >
                FULL (Z)
              </button>
            </div>
          )}

          {/* Staging Button */}
          {onStageExecute && (
            <button
              id="map-stage-btn"
              onClick={onStageExecute}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>STAGE</span>
            </button>
          )}

          {/* Steer & SAS Buttons */}
          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            {onSteerStart && onSteerEnd && (
              <div className="flex items-center gap-1">
                <button
                  onMouseDown={() => onSteerStart('left')}
                  onMouseUp={onSteerEnd}
                  onMouseLeave={onSteerEnd}
                  className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono transition cursor-pointer"
                  title="Steer Left (A)"
                >
                  ◀ A
                </button>
                <button
                  onMouseDown={() => onSteerStart('right')}
                  onMouseUp={onSteerEnd}
                  onMouseLeave={onSteerEnd}
                  className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold font-mono transition cursor-pointer"
                  title="Steer Right (D)"
                >
                  D ▶
                </button>
              </div>
            )}

            {onToggleSAS && (
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => onToggleSAS(vessel.sasMode === 'PROGRADE' ? 'OFF' : 'PROGRADE')}
                  className={`px-2 py-1 rounded-xl text-[10px] font-bold font-mono transition cursor-pointer ${
                    vessel.sasMode === 'PROGRADE'
                      ? 'bg-emerald-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Lock to Prograde Vector"
                >
                  PRO
                </button>
                <button
                  onClick={() => onToggleSAS(vessel.sasMode === 'RETROGRADE' ? 'OFF' : 'RETROGRADE')}
                  className={`px-2 py-1 rounded-xl text-[10px] font-bold font-mono transition cursor-pointer ${
                    vessel.sasMode === 'RETROGRADE'
                      ? 'bg-rose-500 text-slate-950 font-black'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Lock to Retrograde Vector"
                >
                  RETRO
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Camera Zoom Tools & Scale Legend */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-1.5 shadow-2xl">
          <button
            onClick={() => {
              const cam = cameraRef.current;
              cam.targetZoom = Math.min(0.05, cam.targetZoom * 1.5);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-4 h-4 text-sky-400" />
          </button>

          <button
            onClick={() => {
              const cam = cameraRef.current;
              cam.targetZoom = Math.max(0.0000004, cam.targetZoom * 0.67);
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-4 h-4 text-sky-400" />
          </button>

          <button
            id="map-recenter-rocket-btn"
            onClick={() => handleSelectFocus('rocket')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            title="Snap to Rocket (Home)"
          >
            <Crosshair className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>
    </div>
  );
};
