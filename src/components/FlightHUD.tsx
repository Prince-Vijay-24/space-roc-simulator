import React, { useRef, useEffect, useState } from 'react';
import { OrbitParameters, VesselState, PlacedPart } from '../types';
import { soundEngine } from '../audio/soundEngine';
import { 
  Save, Flame, Orbit, Zap, Gauge, Rocket, RotateCcw, Volume2, VolumeX, 
  ArrowUpRight, ArrowDownRight, Menu, X, Wind, Disc, Shield, Sliders, Pickaxe, Factory, Building2, Power,
  HelpCircle, AlertTriangle
} from 'lucide-react';
import { PART_CATALOG } from '../data/parts';
import { findConnectedFuelTanksForEngine } from '../physics/structuralConnectivity';

interface FlightHUDProps {
  vessel: VesselState;
  orbit: OrbitParameters;
  timeWarp: number;
  isMapMode: boolean;
  onThrottleChange: (val: number) => void;
  onToggleEngine?: () => void;
  onSteerStart?: (direction: 'left' | 'right') => void;
  onSteerEnd?: () => void;
  onStageExecute: () => void;
  onToggleMap: () => void;
  onSetTimeWarp: (warp: number) => void;
  onToggleRCS: () => void;
  onToggleSAS: (mode: VesselState['sasMode']) => void;
  onToggleGear: () => void;
  onToggleSolarPanels?: () => void;
  onDeployParachute: () => void;
  onToggleDrill?: () => void;
  onToggleRefinery?: () => void;
  onToggleSmelter?: () => void;
  onRevertToLaunch: () => void;
  onReturnToVAB: () => void;
  onReturnToSpaceport?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetCamera?: () => void;
  onTogglePartEngine?: (uid: string) => void;
  onActivateActionGroup?: (group: number) => void;
  activeActionGroups?: Set<number>;
  onOpenSaveModal?: () => void;
  onOpenTutorial?: () => void;
}

export const FlightHUD: React.FC<FlightHUDProps> = ({
  vessel,
  orbit,
  timeWarp,
  isMapMode,
  onThrottleChange,
  onToggleEngine,
  onSteerStart,
  onSteerEnd,
  onStageExecute,
  onToggleMap,
  onSetTimeWarp,
  onToggleRCS,
  onToggleSAS,
  onToggleGear,
  onToggleSolarPanels,
  onDeployParachute,
  onToggleDrill,
  onToggleRefinery,
  onToggleSmelter,
  onRevertToLaunch,
  onReturnToVAB,
  onReturnToSpaceport,
  onActivateActionGroup,
  activeActionGroups,
  onOpenSaveModal,
  onOpenTutorial,
}) => {
  const navballCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showSystems, setShowSystems] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const prevLowFuelAlertRef = useRef<boolean>(false);
  const prevFlameoutAlertRef = useRef<boolean>(false);

  // Formatting helpers
  const formatDist = (m: number | undefined | null) => {
    if (m === undefined || m === null || !isFinite(m)) return '0 m';
    if (m >= 1e6) return `${(m / 1e6).toFixed(2)} Mm`;
    if (m >= 1e3) return `${(m / 1e3).toFixed(1)} km`;
    return `${m.toFixed(0)} m`;
  };

  const formatSpeed = (v: number | undefined | null) => {
    if (v === undefined || v === null || !isFinite(v)) return '0.0 m/s';
    if (v >= 1000) return `${(v / 1000).toFixed(2)} km/s`;
    return `${v.toFixed(1)} m/s`;
  };

  const formatTime = (sec: number | undefined | null) => {
    if (sec === undefined || sec === null || !isFinite(sec) || sec <= 0) return '--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // 2D Minimal Navball
  useEffect(() => {
    const canvas = navballCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 3;

    ctx.clearRect(0, 0, w, h);

    // Outer clipping boundary
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    // Rotate by rocket pitch angle
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(vessel.angle);

    // Sky (Cerulean Blue)
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 1.5);

    // Ground (Warm Earth Terracotta)
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-r * 1.5, 0, r * 3, r * 1.5);

    // Horizon line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();

    // Pitch ticks
    [-60, -30, 30, 60].forEach((deg) => {
      const y = -(deg / 90) * (r * 0.75);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-8, y);
      ctx.lineTo(8, y);
      ctx.stroke();
    });

    ctx.restore();

    // Prograde & Retrograde Markers
    const speed = Math.hypot(vessel.vx, vessel.vy);
    if (speed > 1.5) {
      const velAngle = Math.atan2(vessel.vy, vessel.vx) - Math.PI / 2;
      const relAngle = velAngle - vessel.angle;

      const px = cx + Math.cos(relAngle) * (r * 0.65);
      const py = cy + Math.sin(relAngle) * (r * 0.65);

      // Prograde (Green circle with ticks)
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.stroke();

      // Retrograde
      const rx = cx - Math.cos(relAngle) * (r * 0.65);
      const ry = cy - Math.sin(relAngle) * (r * 0.65);
      ctx.strokeStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(rx, ry, 4, 0, Math.PI * 2);
      ctx.moveTo(rx - 3, ry - 3);
      ctx.lineTo(rx + 3, ry + 3);
      ctx.moveTo(rx + 3, ry - 3);
      ctx.lineTo(rx - 3, ry + 3);
      ctx.stroke();
    }

    // Aircraft reference reticle (Center)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx - 3, cy);
    ctx.moveTo(cx + 3, cy);
    ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx, cy - 2);
    ctx.stroke();

    ctx.restore();

    // Sleek border ring
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }, [vessel.angle, vessel.vx, vessel.vy]);

  // Total fuel percentage (with defensive guards against undefined vessel or parts)
  const partsList = Array.isArray(vessel?.parts) ? vessel.parts : [];
  const getPartMaxFuel = (p: PlacedPart | undefined) => {
    if (!p) return 0;
    const def = PART_CATALOG[p.partId];
    const isSolid = Boolean(def?.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');
    const solidCap = isSolid ? (p.maxFuel || def?.fuelMass || (p.engineConfig ? (p.engineConfig.engineSizePercent / 50) * 12.0 : 12.0)) : 0;
    return p.maxFuel || def?.fuelMass || solidCap;
  };

  const totalFuelMax = partsList.reduce((sum, p) => {
    return sum + getPartMaxFuel(p);
  }, 0);
  const totalFuelRemaining = partsList.reduce((sum, p) => {
    const maxF = getPartMaxFuel(p);
    return sum + (p?.fuelRemaining !== undefined ? p.fuelRemaining : maxF);
  }, 0);
  const fuelPct = totalFuelMax > 0 ? (totalFuelRemaining / totalFuelMax) * 100 : (vessel?.fuelPercent ?? 0);

  // Active stage fuel: identify propellant tanks connected to active / current stage engines
  const activeEngines = partsList.filter((p) => {
    if (!p) return false;
    const def = PART_CATALOG[p.partId];
    return def && def.maxThrust > 0 && (p.isEngineOn || p.stage === vessel?.activeStageIndex);
  });

  const activeTanksMap = new Map<string, PlacedPart>();
  activeEngines.forEach((eng) => {
    try {
      const tanks = findConnectedFuelTanksForEngine(eng, partsList);
      if (Array.isArray(tanks)) {
        tanks.forEach((t) => { if (t?.uid) activeTanksMap.set(t.uid, t); });
      }
    } catch {
      // safe fallback
    }
  });

  // Fallback: If no active engines, check parts in active stage with fuel
  if (activeTanksMap.size === 0) {
    partsList
      .filter((p) => {
        const hasFuel = getPartMaxFuel(p) > 0;
        return p && p.stage === vessel?.activeStageIndex && hasFuel;
      })
      .forEach((t) => activeTanksMap.set(t.uid, t));
  }

  const stageTanks = Array.from(activeTanksMap.values());
  const stageFuelMax = stageTanks.length > 0 
    ? stageTanks.reduce((sum, p) => {
        return sum + getPartMaxFuel(p);
      }, 0)
    : (vessel?.stageMaxFuelMass && vessel.stageMaxFuelMass > 0 ? vessel.stageMaxFuelMass : totalFuelMax);
  const stageFuelRem = stageTanks.length > 0 
    ? stageTanks.reduce((sum, p) => {
        const maxF = getPartMaxFuel(p);
        return sum + (p?.fuelRemaining !== undefined ? p.fuelRemaining : maxF);
      }, 0)
    : (vessel?.stageFuelMass !== undefined ? vessel.stageFuelMass : totalFuelRemaining);
  const stagePct = stageFuelMax > 0 ? (stageFuelRem / stageFuelMax) * 100 : fuelPct;

  const isFuelDepleted = stageFuelRem <= 0.0001 || (vessel.fuelMass <= 0.0001) || !!vessel.engineFlameout;
  const isFuelCritical = !isFuelDepleted && (stagePct <= 5.0 || !!vessel.isFuelCritical);
  const isFuelLow = !isFuelDepleted && !isFuelCritical && (stagePct <= 10.0 || !!vessel.lowFuelWarning);

  // Auditory warning for low fuel (<=10%) and cutoff/flameout (0%)
  useEffect(() => {
    if ((isFuelLow || isFuelCritical) && !prevLowFuelAlertRef.current && (vessel.throttle > 0.01 || vessel.isEngineOn)) {
      soundEngine.playLowFuelBeep();
    }
    prevLowFuelAlertRef.current = isFuelLow || isFuelCritical;

    if (isFuelDepleted && !prevFlameoutAlertRef.current && (vessel.throttle > 0.01 || vessel.engineFlameout)) {
      soundEngine.playCountdownBeep(true);
    }
    prevFlameoutAlertRef.current = isFuelDepleted;
  }, [isFuelLow, isFuelCritical, isFuelDepleted, vessel.throttle, vessel.engineFlameout, vessel.isEngineOn]);

  // Mission time string
  const totalSec = Math.floor(vessel.missionTime || 0);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const metStr = `T+${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 font-sans select-none text-slate-100">
      {/* 1. TOP BAR: MINIMALIST TELEMETRY PILL */}
      <div className="flex items-center justify-between gap-3">
        {/* Left Telemetry Cluster */}
        <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-2xl px-3.5 py-1.5 shadow-xl">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              vessel.isCrashed 
                ? 'bg-rose-500 animate-ping' 
                : vessel.hasCommand 
                ? 'bg-emerald-400' 
                : 'bg-amber-400'
            }`} />
            <span className="text-[11px] font-mono font-bold text-slate-300">
              {metStr}
            </span>
          </div>

          <div className="w-px h-4 bg-slate-800" />

          {/* Altitude */}
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ALT</span>
            <span className="text-xs font-bold text-sky-400">{formatDist(vessel.altitude)}</span>
          </div>

          <div className="w-px h-4 bg-slate-800" />

          {/* Speed */}
          <div className="flex items-baseline gap-1 font-mono">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SPD</span>
            <span className="text-xs font-bold text-emerald-400">{formatSpeed(vessel.surfaceSpeed)}</span>
          </div>

          {/* Vertical indicator */}
          <div className="hidden sm:flex items-center font-mono text-[11px]">
            {vessel.verticalSpeed >= 0 ? (
              <span className="text-emerald-400 flex items-center">
                <ArrowUpRight className="w-3 h-3" />
                {formatSpeed(Math.abs(vessel.verticalSpeed))}
              </span>
            ) : (
              <span className="text-rose-400 flex items-center">
                <ArrowDownRight className="w-3 h-3" />
                {formatSpeed(Math.abs(vessel.verticalSpeed))}
              </span>
            )}
          </div>
        </div>

        {/* Center: Apoapsis / Periapsis / TWR */}
        <div className="pointer-events-auto hidden md:flex items-center gap-4 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-2xl px-4 py-1.5 shadow-xl font-mono text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold">Ap</span>
            <span className="font-bold text-sky-400">{orbit && orbit.apoapsis > 0 ? formatDist(orbit.apoapsis) : '--'}</span>
            {orbit && orbit.timeToApoapsis > 0 && <span className="text-[10px] text-slate-500">({formatTime(orbit.timeToApoapsis)})</span>}
          </div>

          <div className="w-px h-4 bg-slate-800" />

          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold">Pe</span>
            <span className={`font-bold ${orbit && orbit.periapsis > 30000 ? 'text-emerald-400' : orbit && orbit.periapsis > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
              {orbit && orbit.periapsis > 0 ? formatDist(orbit.periapsis) : 'Suborbital'}
            </span>
            {orbit && orbit.timeToPeriapsis > 0 && <span className="text-[10px] text-slate-500">({formatTime(orbit.timeToPeriapsis)})</span>}
          </div>

          <div className="w-px h-4 bg-slate-800" />

          <div className="flex items-baseline gap-1">
            <span className="text-[10px] text-slate-400 font-bold">TWR</span>
            <span className={`font-bold ${(vessel.currentTWR ?? 0) >= 1.0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {((vessel.currentTWR && isFinite(vessel.currentTWR)) ? vessel.currentTWR : 0).toFixed(2)}
            </span>
          </div>

          {vessel.dynamicPressure !== undefined && vessel.dynamicPressure > 10 && (
            <>
              <div className="w-px h-4 bg-slate-800" />
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <Wind className="w-3 h-3 text-sky-400" />
                <span>Q: {((vessel.dynamicPressure && isFinite(vessel.dynamicPressure)) ? vessel.dynamicPressure : 0).toFixed(0)} kPa</span>
              </div>
            </>
          )}
        </div>

        {/* Right: Warp, Map View Toggle, Menu */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Time Warp Bar */}
          <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-2xl p-1 text-xs font-mono shadow-xl">
            {[1, 2, 5, 25, 100, 1000].map((w) => (
              <button
                key={w}
                onClick={() => onSetTimeWarp(w)}
                className={`px-2 py-1 rounded-xl font-bold transition cursor-pointer ${
                  timeWarp === w ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {w}x
              </button>
            ))}
          </div>

          {/* Map View Toggle */}
          <button
            onClick={onToggleMap}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition shadow-xl cursor-pointer ${
              isMapMode
                ? 'bg-sky-600 text-white border-sky-400 shadow-sky-600/30'
                : 'bg-slate-900/85 text-slate-200 border-slate-800/80 hover:bg-slate-800'
            }`}
          >
            <Orbit className="w-3.5 h-3.5 text-sky-400" />
            <span>Map (M)</span>
          </button>

          {/* Flight Manual / Tutorial Button */}
          {onOpenTutorial && (
            <button
              id="flight-hud-manual-btn"
              onClick={onOpenTutorial}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition shadow-xl cursor-pointer bg-slate-900/85 hover:bg-slate-800 text-sky-300 border-sky-500/40 hover:border-sky-400 active:scale-95"
              title="Flight Operations Manual & Tutorial (H / F1)"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Manual (H)</span>
            </button>
          )}

          {/* Visible Save Button (Auto-save runs every 10 min) */}
          <button
            id="flight-hud-save-btn"
            onClick={onOpenSaveModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold transition shadow-xl cursor-pointer bg-emerald-600/90 hover:bg-emerald-500 text-white border-emerald-400/80 shadow-emerald-950/40 active:scale-95"
            title="Save Game & Backup (Auto-saves every 10 min)"
          >
            <Save className="w-3.5 h-3.5 text-emerald-100" />
            <span>Save</span>
          </button>

          {/* Menu Dropdown Trigger */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-2xl bg-slate-900/85 hover:bg-slate-800 border border-slate-800/80 text-slate-300 transition shadow-xl cursor-pointer"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PAUSE / UTILITY MENU MODAL */}
      {showMenu && (
        <div className="pointer-events-auto fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <span>Flight Operations</span>
              </h3>
              <button
                onClick={() => setShowMenu(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {onOpenTutorial && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onOpenTutorial();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/40 text-sky-200 text-xs font-bold flex items-center justify-between transition cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-sky-400" />
                    <span>Flight Manual & Tutorial</span>
                  </div>
                  <span className="text-[10px] text-sky-400 font-mono">Press H</span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowMenu(false);
                  if (onOpenSaveModal) onOpenSaveModal();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Save className="w-4 h-4 text-emerald-400" />
                  <span>Save Game & Fleet Backup</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">10m Auto-Save</span>
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  onRevertToLaunch();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span>Revert Flight to Launch (T-0)</span>
                <RotateCcw className="w-4 h-4 text-amber-400" />
              </button>

              <button
                onClick={() => {
                  setShowMenu(false);
                  onReturnToVAB();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span>Return to Vehicle Assembly (VAB)</span>
                <Rocket className="w-4 h-4 text-sky-400" />
              </button>

              {onReturnToSpaceport && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onReturnToSpaceport();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-between transition cursor-pointer"
                >
                  <span>Return to Spaceport Campus</span>
                  <Building2 className="w-4 h-4 text-amber-400" />
                </button>
              )}

              <button
                onClick={() => {
                  const muted = soundEngine.toggleMute();
                  setIsMuted(muted);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-between transition cursor-pointer"
              >
                <span>Sound Effects</span>
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ALERTS / TOAST OVERLAY (IF ANY) */}
      <div className="flex justify-center">
        {vessel.isCrashed && (
          <div className="pointer-events-auto bg-rose-600/90 backdrop-blur-md text-white px-5 py-2 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce">
            <span>Rocket Impact / Vessel Destroyed</span>
            <button
              onClick={onRevertToLaunch}
              className="ml-2 px-2.5 py-1 bg-white text-rose-900 rounded-xl font-mono text-[10px] hover:bg-rose-50"
            >
              Revert
            </button>
          </div>
        )}
      </div>

      {/* 3. BOTTOM FLIGHT DECK: NAVBALL, THROTTLE, GAUGES, SYSTEMS */}
      <div className="flex items-end justify-between gap-4">
        {/* Left: Compact Navball & SAS / Steering */}
        <div className="pointer-events-auto flex items-end gap-2 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-3xl p-2.5 shadow-2xl">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <canvas ref={navballCanvasRef} width={80} height={80} className="w-20 h-20 rounded-full" />
          </div>

          <div className="flex flex-col gap-1.5 pb-0.5">
            {/* Steering Buttons */}
            <div className="flex items-center gap-1">
              <button
                onMouseDown={() => onSteerStart?.('left')}
                onMouseUp={() => onSteerEnd?.()}
                onTouchStart={() => onSteerStart?.('left')}
                onTouchEnd={() => onSteerEnd?.()}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-sky-600 text-slate-200 font-mono font-bold text-xs flex items-center justify-center transition cursor-pointer"
                title="Yaw Left (A)"
              >
                A
              </button>
              <button
                onMouseDown={() => onSteerStart?.('right')}
                onMouseUp={() => onSteerEnd?.()}
                onTouchStart={() => onSteerStart?.('right')}
                onTouchEnd={() => onSteerEnd?.()}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-sky-600 text-slate-200 font-mono font-bold text-xs flex items-center justify-center transition cursor-pointer"
                title="Yaw Right (D)"
              >
                D
              </button>
            </div>

            {/* SAS & RCS Micro Toggles */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleSAS(vessel.sasMode === 'OFF' ? 'STABILITY' : 'OFF')}
                className={`w-8 h-6 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  vessel.sasMode !== 'OFF' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                SAS
              </button>
              <button
                onClick={onToggleRCS}
                className={`w-8 h-6 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                  vessel.rcsActive ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                RCS
              </button>
            </div>
          </div>
        </div>

        {/* Center: Throttle, Warning & Staging Bar */}
        <div className="flex flex-col items-center gap-2">
          {/* Propellant State Warning Banner */}
          {(isFuelLow || isFuelCritical || isFuelDepleted) && (
            <div className="pointer-events-auto flex items-center justify-center">
              {isFuelDepleted ? (
                <div 
                  id="hud-fuel-empty-banner"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-rose-950/90 border border-rose-500/90 text-rose-200 shadow-xl font-mono text-[11px] font-bold animate-pulse backdrop-blur-md"
                >
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>ENGINE CUTOFF: PROPELLANT DEPLETED — FLAMEOUT</span>
                </div>
              ) : isFuelCritical ? (
                <div 
                  id="hud-fuel-critical-banner"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-rose-950/90 border border-rose-500 text-rose-200 shadow-xl font-mono text-[11px] font-bold animate-bounce backdrop-blur-md"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>CRITICAL FUEL ({stagePct.toFixed(1)}%) — CUTOFF IMMINENT (THROTTLING DOWN)</span>
                </div>
              ) : (
                <div 
                  id="hud-fuel-warning-banner"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-amber-950/90 border border-amber-500/90 text-amber-200 shadow-xl font-mono text-[11px] font-bold animate-pulse backdrop-blur-md"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>LOW FUEL WARNING: {stagePct.toFixed(1)}% PROPELLANT REMAINING</span>
                </div>
              )}
            </div>
          )}

          {(() => {
            const currentStageEngines = vessel.parts.filter((p) => {
              const def = PART_CATALOG[p.partId];
              return def && def.maxThrust > 0 && p.stage === vessel.activeStageIndex;
            });
            const allRocketEngines = vessel.parts.filter((p) => {
              const def = PART_CATALOG[p.partId];
              return def && def.maxThrust > 0;
            });
            const activeRocketEngines = currentStageEngines.length > 0 ? currentStageEngines : allRocketEngines;
            const isEngineIgnited = !isFuelDepleted && activeRocketEngines.length > 0 && activeRocketEngines.some(
              (p) => p.isEngineOn === true || (p.isEngineOn !== false && p.stage === vessel.activeStageIndex)
            );

            return (
              <div className={`pointer-events-auto flex items-center gap-3 bg-slate-900/85 backdrop-blur-md border rounded-3xl px-4 py-2.5 shadow-2xl transition-colors ${
                isFuelDepleted
                  ? 'border-rose-700/80 shadow-rose-950/40'
                  : isFuelCritical
                  ? 'border-rose-500/70 shadow-rose-950/30'
                  : isFuelLow
                  ? 'border-amber-500/60 shadow-amber-950/20'
                  : 'border-slate-800/80'
              }`}>
                {/* Throttle Controls */}
                <div className="flex items-center gap-2 font-mono">
                  {/* Master Engine Ignition ON / OFF Toggle */}
                  <button
                    id="engine-ignition-toggle"
                    onClick={() => {
                      if (isFuelDepleted) {
                        soundEngine.playCountdownBeep(true);
                        return;
                      }
                      if (onToggleEngine) {
                        onToggleEngine();
                      } else if (!isEngineIgnited && onThrottleChange) {
                        onThrottleChange(vessel.throttle > 0 ? vessel.throttle : 1.0);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-[11px] font-mono transition cursor-pointer active:scale-95 shadow-md ${
                      isFuelDepleted
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-600/60 shadow-rose-950/40'
                        : isEngineIgnited
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 shadow-amber-500/10'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700'
                    }`}
                    title={isFuelDepleted ? 'Propellant Depleted: Engine Cut Off' : 'Toggle Engine Ignition (Key: E or I)'}
                  >
                    <Power className={`w-3.5 h-3.5 ${
                      isFuelDepleted ? 'text-rose-500' : isEngineIgnited ? 'text-amber-400 animate-pulse' : 'text-slate-500'
                    }`} />
                    <span>{isFuelDepleted ? 'FLAMEOUT' : isEngineIgnited ? 'ENGINE ON' : 'ENGINE OFF'}</span>
                  </button>

                  <div className="w-px h-6 bg-slate-800 mx-0.5" />

                  <button
                    id="throttle-cut-btn"
                    onClick={() => onThrottleChange(0.0)}
                    className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 text-[10px] font-bold cursor-pointer"
                    title="Cut Engine (X)"
                  >
                    CUT
                  </button>

                  <div className="relative flex flex-col items-center">
                    <input
                      id="throttle-slider"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      disabled={isFuelDepleted}
                      value={vessel.throttle}
                      onChange={(e) => onThrottleChange(parseFloat(e.target.value))}
                      className={`w-28 accent-sky-500 cursor-pointer ${isFuelDepleted ? 'opacity-40 cursor-not-allowed' : ''}`}
                    />
                    <span className={`text-[10px] font-bold ${
                      isFuelDepleted ? 'text-rose-400' : isFuelCritical ? 'text-rose-400 animate-pulse' : 'text-slate-400'
                    }`}>
                      {((isFinite(vessel.throttle) ? vessel.throttle : 0) * 100).toFixed(0)}%
                    </span>
                  </div>

                  <button
                    id="throttle-max-btn"
                    disabled={isFuelDepleted}
                    onClick={() => onThrottleChange(1.0)}
                    className={`px-2 py-1 rounded-xl text-[10px] font-bold cursor-pointer ${
                      isFuelDepleted
                        ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-700 text-sky-400'
                    }`}
                    title="Max Throttle (Z)"
                  >
                    MAX
                  </button>
                </div>

                <div className="w-px h-8 bg-slate-800" />

                {/* Minimal Staging Button */}
                <button
                  id="stage-execute-btn"
                  onClick={onStageExecute}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 active:scale-95 text-white font-bold text-xs transition shadow-lg shadow-rose-600/20 cursor-pointer"
                  title="Execute Stage (Space)"
                >
                  <Flame className="w-4 h-4 text-amber-200" />
                  <span>STAGE {vessel.activeStageIndex}</span>
                </button>

                <div className="w-px h-8 bg-slate-800" />

                {/* Compact Fuel & Electric Bars */}
                <div className="flex items-center gap-2.5 text-[10px] font-mono">
                  {/* Stage Propellant */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className={`w-3.5 h-10 bg-slate-950 rounded-full overflow-hidden border p-0.5 flex flex-col justify-end ${
                      isFuelDepleted
                        ? 'border-rose-600'
                        : isFuelCritical
                        ? 'border-rose-500 animate-pulse'
                        : isFuelLow
                        ? 'border-amber-500'
                        : 'border-slate-700/80'
                    }`}>
                      <div 
                        className={`w-full rounded-full transition-all duration-150 ${
                          stagePct > 20 
                            ? 'bg-sky-400' 
                            : stagePct > 10 
                            ? 'bg-amber-500' 
                            : stagePct > 0 
                            ? 'bg-rose-500 animate-pulse' 
                            : 'bg-slate-700'
                        }`}
                        style={{ height: `${Math.max(0, Math.min(100, stagePct))}%` }}
                      />
                    </div>
                    <span className="text-slate-400 font-bold text-[9px]">FUEL</span>
                    <span className={`text-[9px] font-bold ${
                      isFuelDepleted
                        ? 'text-rose-500 font-extrabold'
                        : isFuelCritical
                        ? 'text-rose-400 font-extrabold animate-pulse'
                        : isFuelLow
                        ? 'text-amber-400 font-bold'
                        : stagePct > 20
                        ? 'text-sky-300'
                        : 'text-amber-400'
                    }`}>
                      {isFuelDepleted ? '0%' : `${Math.round(stagePct)}%`}
                    </span>
                  </div>

                  {/* Battery Charge */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="w-3.5 h-10 bg-slate-950 rounded-full overflow-hidden border border-slate-700/80 p-0.5 flex flex-col justify-end">
                      <div 
                        className="w-full bg-emerald-400 rounded-full transition-all duration-300"
                        style={{ height: `${Math.max(0, Math.min(100, vessel.batteryMax && vessel.batteryMax > 0 ? (vessel.batteryCharge / vessel.batteryMax) * 100 : 100))}%` }}
                      />
                    </div>
                    <span className="text-slate-400 font-bold text-[9px]">PWR</span>
                    <span className="text-[9px] font-bold text-emerald-300">
                      {Math.round(vessel.batteryMax && vessel.batteryMax > 0 ? (vessel.batteryCharge / vessel.batteryMax) * 100 : 100)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Center: In-Flight Extraterrestrial Mineral Telemetry (if craft has mined resources or equipment) */}
        {((vessel.totalOreKg || 0) > 0 || (vessel.totalRefinedOreKg || 0) > 0 || (vessel.totalIngotsKg || 0) > 0 || vessel.isDrilling || vessel.isRefining || vessel.isSmelting) && (
          <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-amber-500/30 rounded-2xl px-3 py-1.5 font-mono text-xs shadow-xl">
            <div className="flex items-center gap-1.5 text-amber-400">
              <Pickaxe className="w-3.5 h-3.5" />
              <span className="font-bold">{(vessel.totalOreKg || 0).toFixed(0)} kg Ore</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-teal-300">
              <Factory className="w-3.5 h-3.5" />
              <span className="font-bold">{(vessel.totalRefinedOreKg || 0).toFixed(0)} kg Refined</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-sky-300">
              <Shield className="w-3.5 h-3.5" />
              <span className="font-bold">{(vessel.totalIngotsKg || 0).toFixed(0)} kg Ingots</span>
            </div>
          </div>
        )}

        {/* Right: Quick Action Systems Toggles */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-3xl p-1.5 shadow-2xl">
          {/* Mining Drill Toggle */}
          {onToggleDrill && (
            <button
              onClick={onToggleDrill}
              className={`p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                vessel.isDrilling
                  ? 'bg-amber-600 text-white animate-pulse shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Surface Harvester Drill (Extract Ore)"
            >
              <Pickaxe className="w-4 h-4" />
            </button>
          )}

          {/* Chemical Refinery Toggle */}
          {onToggleRefinery && (
            <button
              onClick={onToggleRefinery}
              className={`p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                vessel.isRefining
                  ? 'bg-teal-600 text-white animate-pulse shadow-lg shadow-teal-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Chemical Refinery (Ore → Purified Feedstock)"
            >
              <Factory className="w-4 h-4" />
            </button>
          )}

          {/* Arc Smelter Toggle */}
          {onToggleSmelter && (
            <button
              onClick={onToggleSmelter}
              className={`p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                vessel.isSmelting
                  ? 'bg-orange-600 text-white animate-pulse shadow-lg shadow-orange-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Vacuum Arc Smelter (Feedstock → Metal Ingots)"
            >
              <Flame className="w-4 h-4" />
            </button>
          )}

          {/* Landing Gear */}
          <button
            onClick={onToggleGear}
            className={`p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
              vessel.landingLegsDeployed ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Landing Gear (G)"
          >
            <Shield className="w-4 h-4" />
          </button>

          {/* Solar Panels */}
          {onToggleSolarPanels && (
            <button
              onClick={onToggleSolarPanels}
              className={`p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                vessel.solarPanelsDeployed ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Toggle Solar Panels (U)"
            >
              <Zap className="w-4 h-4" />
            </button>
          )}

          {/* Action Groups AG1 - AG8 */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((ag) => (
              <button
                key={ag}
                onClick={() => onActivateActionGroup?.(ag)}
                className={`px-1.5 h-8 rounded-xl text-[10px] font-mono font-bold transition cursor-pointer flex items-center justify-center ${
                  activeActionGroups?.has(ag)
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={`Activation Group ${ag} (Keyboard: F${ag})`}
              >
                AG{ag}
              </button>
            ))}
          </div>

          {/* Parachute */}
          <button
            onClick={onDeployParachute}
            className={`p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
              vessel.parachutesDeployed ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Deploy Parachute (P)"
          >
            <Disc className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
