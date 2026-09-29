import React from 'react';
import { CelestialBody, OrbitParameters, VesselState } from '../types';
import { CameraFocusTarget } from '../graphics/flightCanvas2D';
import { Orbit, Globe, Disc, Rocket, Maximize2, Compass, ArrowRight, Eye } from 'lucide-react';

interface MapOverlayProps {
  vessel: VesselState;
  orbit: OrbitParameters;
  earth: CelestialBody;
  moon: CelestialBody;
  moonPos: { x: number; y: number };
  focusTarget?: CameraFocusTarget;
  onSetFocusTarget?: (target: CameraFocusTarget) => void;
  onFitOrbit?: () => void;
}

export const MapOverlay: React.FC<MapOverlayProps> = ({
  vessel,
  orbit,
  earth,
  moon,
  moonPos,
  focusTarget = 'vessel',
  onSetFocusTarget,
  onFitOrbit,
}) => {
  const formatDist = (m: number) => {
    if (m >= 1000000) return `${(m / 1000000).toFixed(2)} Mm`;
    if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
    return `${m.toFixed(0)} m`;
  };

  const speed = Math.hypot(vessel.vx, vessel.vy);

  return (
    <div className="absolute top-20 right-4 pointer-events-auto w-84 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl z-20 text-xs font-mono select-none flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Orbit className="w-4 h-4 text-sky-400" />
          <h3 className="font-bold text-white uppercase tracking-wider">Map Navigation</h3>
        </div>
        <span
          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
            orbit.isOrbiting
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : orbit.isHyperbolic
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
          }`}
        >
          {orbit.isOrbiting ? 'STABLE ORBIT' : orbit.isHyperbolic ? 'ESCAPE TRAJECTORY' : 'SUB-ORBITAL'}
        </span>
      </div>

      {/* Camera Focus Controls */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1 font-bold text-slate-300">
            <Eye className="w-3.5 h-3.5 text-sky-400" /> Camera Focus
          </span>
          {onFitOrbit && (
            <button
              onClick={onFitOrbit}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold transition cursor-pointer"
              title="Fit zoom to active orbit"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit Orbit</span>
            </button>
          )}
        </div>
        {onSetFocusTarget && (
          <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            {[
              { id: 'vessel', label: 'Vessel', icon: Rocket },
              { id: 'earth', label: 'Earth', icon: Globe },
              { id: 'moon', label: 'Moon', icon: Disc },
              { id: 'system', label: 'System', icon: Compass },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onSetFocusTarget(id as CameraFocusTarget)}
                className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg font-bold text-[10px] transition cursor-pointer ${
                  focusTarget === id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Primary Orbital Parameters */}
      <div className="space-y-1.5 py-2.5 border-y border-slate-800 text-slate-300">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Apoapsis (Ap):</span>
          <span className="text-sky-400 font-bold">{orbit.apoapsis > 0 ? formatDist(orbit.apoapsis) : 'N/A'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Periapsis (Pe):</span>
          <span
            className={`font-bold ${
              orbit.periapsis > earth.atmosphereHeight
                ? 'text-emerald-400'
                : orbit.periapsis > 0
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {orbit.periapsis > earth.atmosphereHeight
              ? formatDist(orbit.periapsis)
              : orbit.periapsis > 0
              ? `${formatDist(orbit.periapsis)} (Decay)`
              : 'Suborbital / Impact'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Eccentricity (e):</span>
          <span className="text-slate-200 font-bold">{orbit.eccentricity.toFixed(4)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Semi-Major Axis (a):</span>
          <span className="text-slate-200">{formatDist(orbit.semiMajorAxis)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Orbital Velocity:</span>
          <span className="text-emerald-400 font-bold">{speed.toFixed(1)} m/s</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Orbital Period (T):</span>
          <span className="text-slate-200">
            {orbit.period > 0 && orbit.period < Infinity ? `${orbit.period.toFixed(0)}s` : 'N/A'}
          </span>
        </div>
        {orbit.timeToApoapsis > 0 && (
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Time to Ap:</span>
            <span className="text-slate-200 font-bold">{orbit.timeToApoapsis.toFixed(0)}s</span>
          </div>
        )}
      </div>

      {/* Lunar Encounter Predictor */}
      {orbit.closestApproachMoon && (
        <div className="pt-1">
          <div className="flex items-center gap-1.5 text-amber-400 font-bold text-[11px] mb-1.5">
            <Disc className="w-3.5 h-3.5" />
            <span>Lunar Encounter Predictor</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Closest Approach:</span>
              <span
                className={`font-bold ${
                  orbit.closestApproachMoon.intersectsSOI ? 'text-emerald-400' : 'text-slate-300'
                }`}
              >
                {formatDist(orbit.closestApproachMoon.distance)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Time to Closest:</span>
              <span className="text-slate-200 font-bold">{orbit.closestApproachMoon.timeToClosest.toFixed(0)}s</span>
            </div>
            {orbit.closestApproachMoon.intersectsSOI ? (
              <div className="text-[10px] text-emerald-400 font-bold pt-1 flex items-center gap-1 border-t border-slate-800/80">
                <span>✓ Trajectory enters Moon SOI (150 km)</span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800/80">
                Misses Moon SOI by {formatDist(orbit.closestApproachMoon.distance - moon.soiRadius)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Navigation Controls */}
      <div className="text-[10px] text-slate-500 leading-tight">
        Left-click + drag to pan map • Scroll wheel to zoom • Press [M] to toggle views
      </div>
    </div>
  );
};
