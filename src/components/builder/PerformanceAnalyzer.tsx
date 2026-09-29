import React, { useState } from 'react';
import { RocketMetrics, PlacedPart, FuelType } from '../../types';
import { PART_CATALOG, getPartHeight, getPartWidth } from '../../data/parts';
import { calculateEngineTuning, PROPELLANT_SPECS } from '../../physics/rocketPropulsion';
import { physicsEngine } from '../../physics/physicsEngine';
import {
  Gauge,
  Flame,
  Wind,
  Layers,
  Info,
  AlertTriangle,
  X,
  TrendingUp,
  Activity,
  Zap,
  Scale,
  Sparkles,
} from 'lucide-react';

interface PerformanceAnalyzerProps {
  metrics?: RocketMetrics;
  parts: PlacedPart[];
  isOpen?: boolean;
  onClose?: () => void;
}

export const PerformanceAnalyzer: React.FC<PerformanceAnalyzerProps> = ({
  metrics,
  parts,
  isOpen,
  onClose,
}) => {
  if (isOpen === false) return null;

  const effectiveMetrics = metrics ?? physicsEngine.calculateMetrics(parts || []);

  // Altitude slider in km (0 km to 100 km)
  const [testAltitudeKm, setTestAltitudeKm] = useState<number>(0);

  // US Standard Atmosphere 1976 model approximation for ambient pressure
  const altitudeMeters = testAltitudeKm * 1000;
  const ambientPressureKPa =
    altitudeMeters < 11000
      ? 101.325 * Math.pow(1 - (0.0065 * altitudeMeters) / 288.15, 5.25588)
      : altitudeMeters < 25000
      ? 22.632 * Math.exp(-0.00015769 * (altitudeMeters - 11000))
      : altitudeMeters < 80000
      ? 2.488 * Math.exp(-0.00014 * (altitudeMeters - 25000))
      : 0.00001;

  // Scan engines in current rocket
  const engineParts = parts.filter((p) => {
    const def = PART_CATALOG[p.partId];
    return def && def.maxThrust > 0;
  });

  // Calculate detailed engine physics at the current test altitude
  let totalThrustAtAlt = 0;
  let totalMassFlowKgS = 0;
  let totalThrustVac = 0;
  let totalThrustSL = 0;
  let hasFlowSeparation = false;

  const engineDetails = engineParts.map((p) => {
    const def = PART_CATALOG[p.partId];
    const chamberP = p.chamberPressureBar ?? 110;
    const throatR = p.throatRadiusM ?? 0.16;
    const expRatio = p.expansionRatio ?? def.expansionRatio ?? 25;
    const fuelType: FuelType = p.propellantType ?? def.fuelType ?? 'kerolox';
    const nozzleType = p.customNozzleType ?? def.nozzleType ?? 'bell';

    const result = calculateEngineTuning({
      baseThrust: def.maxThrust,
      baseIspVac: def.ispVac,
      baseIspSL: def.ispSL,
      baseDryMass: def.dryMass,
      fuelType,
      chamberPressureBar: chamberP,
      throatRadiusM: throatR,
      expansionRatio: expRatio,
      nozzleType,
      ambientPressureKPa,
    });

    totalThrustAtAlt += result.thrustCurrent;
    totalMassFlowKgS += result.massFlowKgS;
    totalThrustVac += result.thrustVac;
    totalThrustSL += result.thrustSL;
    if (result.isOverexpandedAtSL && testAltitudeKm < 3) {
      hasFlowSeparation = true;
    }

    return {
      part: p,
      def,
      tuning: result,
      fuelType,
    };
  });

  const effectiveIspAtAlt =
    totalMassFlowKgS > 0 ? totalThrustAtAlt / ((totalMassFlowKgS / 1000) * 9.80665) : 0;

  const currentWetMass = effectiveMetrics?.wetMass ?? 0;
  const currentTwr =
    currentWetMass > 0 ? totalThrustAtAlt / (currentWetMass * 9.80665) : 0;

  const analyzerBody = (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 border border-sky-500/30 rounded-2xl shadow-2xl overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900/90 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 tracking-wide flex items-center gap-2">
              Performance Analyzer
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-800">
                Transparent Physics
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Live thrust, specific impulse, mass flow & Tsiolkovsky delta-V
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Interactive Atmospheric Altitude Slider */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Wind className="w-4 h-4 text-sky-400" />
              Ascent Altitude & Ambient Pressure Tester
            </span>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="text-sky-400 font-bold bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                {testAltitudeKm.toFixed(1)} km
              </span>
              <span className="text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                {ambientPressureKPa.toFixed(2)} kPa
              </span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={testAltitudeKm}
            onChange={(e) => setTestAltitudeKm(parseFloat(e.target.value))}
            className="w-full accent-sky-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex justify-between text-[10px] font-mono text-slate-400">
            <span>0 km (Sea Level: 101.3 kPa)</span>
            <span>12 km (Tropopause)</span>
            <span>35 km (Stratosphere)</span>
            <span>100 km (Kármán Line: Vacuum)</span>
          </div>
        </div>

        {/* Live Metrics Grid at Altitude */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Thrust @ Alt</span>
            </div>
            <div className="text-xl font-mono font-bold text-orange-300">
              {totalThrustAtAlt.toFixed(1)} <span className="text-xs font-normal text-slate-400">kN</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Vac: {totalThrustVac.toFixed(1)} kN | SL: {totalThrustSL.toFixed(1)} kN
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              <span>Specific Impulse (Isp)</span>
            </div>
            <div className="text-xl font-mono font-bold text-sky-300">
              {Math.round(effectiveIspAtAlt)} <span className="text-xs font-normal text-slate-400">s</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              Exhaust: {Math.round(effectiveIspAtAlt * 9.80665)} m/s
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Mass Flow Rate (ṁ)</span>
            </div>
            <div className="text-xl font-mono font-bold text-emerald-300">
              {totalMassFlowKgS.toFixed(1)} <span className="text-xs font-normal text-slate-400">kg/s</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              {(totalMassFlowKgS * 60).toFixed(0)} kg/min propellant
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
              <Scale className="w-3.5 h-3.5 text-purple-400" />
              <span>Thrust-to-Weight (TWR)</span>
            </div>
            <div className={`text-xl font-mono font-bold ${currentTwr >= 1.2 ? 'text-purple-300' : 'text-amber-400'}`}>
              {currentTwr.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
              {currentTwr >= 1.2 ? 'Liftoff Capable' : currentTwr > 0 ? 'Upper Stage' : 'No Engines'}
            </div>
          </div>
        </div>

        {/* Summerfield Flow Separation Warning Alert */}
        {hasFlowSeparation && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-semibold text-amber-300">
                Flow Separation Alert (Summerfield Criterion)
              </p>
              <p className="text-slate-300 leading-relaxed">
                One or more engines have high expansion ratios (vacuum nozzle bell). At sea level, nozzle exit pressure is below 35% of ambient atmosphere, causing turbulent flow detachment, shock diamonds, and bell buffeting.
              </p>
            </div>
          </div>
        )}

        {/* Tsiolkovsky Rocket Equation & Stage Breakdown */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              Stage-by-Stage Tsiolkovsky Delta-V Breakdown
            </span>
            <div className="text-xs font-mono font-bold text-emerald-400">
              Total Δv: {Math.round(effectiveMetrics?.estimatedDeltaV ?? 0)} m/s
            </div>
          </div>

          <div className="space-y-2">
            {effectiveMetrics?.stageBreakdown && effectiveMetrics.stageBreakdown.length > 0 ? (
              effectiveMetrics.stageBreakdown.map((stg) => (
                <div
                  key={stg.stage}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono items-center"
                >
                  <div>
                    <span className="text-slate-400 block text-[10px]">STAGE</span>
                    <span className="font-bold text-sky-400">Stage {stg.stage}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">DELTA-V</span>
                    <span className="font-bold text-emerald-400">{Math.round(stg.deltaV)} m/s</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">TWR (SL / VAC)</span>
                    <span className="text-slate-200">
                      {stg.twrSL.toFixed(2)} / {stg.twrVac.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BURN TIME</span>
                    <span className="text-slate-200">{stg.burnTime.toFixed(1)} s</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">MASS (DRY/WET)</span>
                    <span className="text-slate-400">
                      {(stg.dryMass ?? 0).toFixed(1)}t / {(stg.wetMass ?? 0).toFixed(1)}t
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-xs text-slate-500 font-mono">
                No active stages configured. Add fuel tanks and engines in the builder.
              </div>
            )}
          </div>
        </div>

        {/* Active Engine Combustion & Chamber Physics */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-orange-400" />
            Configured Propulsion Units & Combustion Chambers ({engineDetails.length})
          </span>

          <div className="space-y-2">
            {engineDetails.map(({ part, def, tuning, fuelType }, idx) => {
              const spec = PROPELLANT_SPECS[fuelType];
              return (
                <div
                  key={part.uid || idx}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-2">
                      <span>{def.name}</span>
                      <span
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${spec.glowColor}25`, color: spec.flameColor }}
                      >
                        {spec.shortName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      Chamber: {part.chamberPressureBar ?? 110} bar | Throat: {(part.throatRadiusM ?? 0.16).toFixed(2)}m | ε: {tuning.exitAreaM2 ? (tuning.exitAreaM2 / tuning.throatAreaM2).toFixed(0) : '25'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px]">CURRENT THRUST</span>
                      <span className="font-bold text-orange-400">{tuning.thrustCurrent} kN</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">ISP @ ALT</span>
                      <span className="font-bold text-sky-400">{tuning.ispCurrent} s</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">EXIT DIA</span>
                      <span className="text-slate-300">{tuning.exitDiameterM} m</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Educational Physics Reference Box */}
        <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-sky-400" />
            Physics Principles Governing This Simulation
          </div>
          <p className="leading-relaxed">
            • <strong className="text-slate-200">Tsiolkovsky Rocket Equation:</strong>{' '}
            <span className="font-mono text-emerald-400">Δv = g₀ · I_sp · ln(m_wet / m_dry)</span>. Every kilogram of dry structure shed multiplies total delta-V exponentially.
          </p>
          <p className="leading-relaxed">
            • <strong className="text-slate-200">Altitude Pressure Compensation:</strong> Rocket thrust increases in vacuum because back-pressure from the atmosphere vanishes (<span className="font-mono text-orange-400">F = ṁ·v_e + (P_e - P_atm)·A_e</span>).
          </p>
        </div>
      </div>
    </div>
  );

  if (isOpen !== undefined) {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-4xl max-h-[90vh] flex flex-col">
          {analyzerBody}
        </div>
      </div>
    );
  }

  return analyzerBody;
};
