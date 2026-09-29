import React, { useState } from 'react';
import { PlacedPart, FuelType, NozzleType } from '../../types';
import { PART_CATALOG, getPartHeight, getPartWidth, calculateFuelTankProperties } from '../../data/parts';
import { calculateParametricTank, calculateEngineTuning, PROPELLANT_SPECS, DEFAULT_JUNO_ENGINE_CONFIG } from '../../physics/rocketPropulsion';
import { JunoEngineConfigurator } from './JunoEngineConfigurator';
import {
  ArrowLeftRight,
  ArrowUpDown,
  Fuel,
  Flame,
  Layers,
  Settings2,
  Sparkles,
  Shield,
  Gauge,
  Pickaxe,
  AlertTriangle,
  RotateCw,
  Trash2,
  Sun,
  Zap,
  CircleDot,
  Sliders,
  Maximize2,
  ArrowUpRight,
  Wind,
} from 'lucide-react';

interface ProceduralPartInspectorProps {
  part: PlacedPart;
  onUpdatePart: (updatedPart: Partial<PlacedPart>) => void;
  onDeletePart?: () => void;
  onRotatePart?: () => void;
  allParts?: PlacedPart[];
  onUpdateAllParts?: (newParts: PlacedPart[]) => void;
}

export const ProceduralPartInspector: React.FC<ProceduralPartInspectorProps> = ({
  part,
  onUpdatePart,
  onDeletePart,
  onRotatePart,
  allParts,
  onUpdateAllParts,
}) => {
  const def = PART_CATALOG[part.partId];
  if (!def) return null;

  const currentWidth = getPartWidth(part, def);
  const currentHeight = getPartHeight(part, def);
  const currentSkin = part.tankSkin || 'white';
  const currentFuelType: FuelType = part.propellantType || def.fuelType || 'kerolox';
  const currentChamberP = part.chamberPressureBar ?? 110;
  const currentThroatR = part.throatRadiusM ?? 0.16;
  const currentExpansion = part.expansionRatio ?? def.expansionRatio ?? 25;
  const currentNozzle: NozzleType = part.customNozzleType ?? def.nozzleType ?? 'bell';

  const isFuelTank = def.category === 'Fuel' && !def.isOreTank;
  const isOreTank = def.isOreTank || def.id === 'ore_tank';
  const isEngine = def.maxThrust > 0 || def.category === 'Propulsion' || def.id === 'modular_rocket_engine' || !!part.engineConfig;
  const isFairing = def.isFairing || def.category === 'Aerodynamics';
  const isMining = def.isMiningDrill || def.isRefinery || def.isSmelter;
  const isDeployable = def.isSolarPanel || def.isLandingLeg || def.isWheel || def.isParachute || def.id === 'cargo_bay' || def.id.includes('antenna');
  const isProceduralScalable = isFuelTank || isOreTank || def.id === 'custom_fuel_tank' || (def.scalable && !isEngine && def.category !== 'Command' && def.category !== 'Aerodynamics' && !isDeployable);

  // Real-time tank physics
  const tankCalc = calculateParametricTank(currentWidth, currentHeight, currentFuelType, currentSkin);
  const currentMaxFuel = part.maxFuel ?? tankCalc.fuelMass;
  const currentFuelRem = part.fuelRemaining !== undefined ? Math.min(part.fuelRemaining, currentMaxFuel) : currentMaxFuel;
  const fuelPercent = currentMaxFuel > 0 ? (currentFuelRem / currentMaxFuel) * 100 : 100;

  const handleFuelPercentChange = (pct: number) => {
    const clampedPct = Math.max(0, Math.min(100, pct));
    const newRem = Math.round(((currentMaxFuel * clampedPct) / 100) * 100) / 100;
    onUpdatePart({
      fuelRemaining: newRem,
      maxFuel: currentMaxFuel,
    });
  };

  // Real-time engine physics
  const engineCalc = isEngine
    ? calculateEngineTuning({
        baseThrust: def.maxThrust,
        baseIspVac: def.ispVac,
        baseIspSL: def.ispSL,
        baseDryMass: def.dryMass,
        fuelType: currentFuelType,
        chamberPressureBar: currentChamberP,
        throatRadiusM: currentThroatR,
        expansionRatio: currentExpansion,
        nozzleType: currentNozzle,
        ambientPressureKPa: 101.325, // Sea Level
      })
    : null;

  // Handle continuous procedural dimension changes (Juno: New Origins style)
  const handleWidthChange = (val: number) => {
    const clampedW = Math.max(0.4, Math.min(10.0, Math.round(val * 20) / 20));
    const updates: Partial<PlacedPart> = { customWidth: clampedW };

    if (isFuelTank) {
      const calc = calculateParametricTank(clampedW, currentHeight, currentFuelType, currentSkin);
      const ratio = currentMaxFuel > 0 ? currentFuelRem / currentMaxFuel : 1;
      const newRem = Math.round(calc.fuelMass * ratio * 100) / 100;
      updates.fuelRemaining = newRem;
      updates.maxFuel = calc.fuelMass;
    } else if (isOreTank) {
      updates.maxFuel = 0;
      updates.fuelRemaining = 0;
    }
    onUpdatePart(updates);
  };

  const handleHeightChange = (val: number) => {
    const clampedH = Math.max(0.4, Math.min(20.0, Math.round(val * 20) / 20));
    const updates: Partial<PlacedPart> = { customHeight: clampedH };

    if (isFuelTank) {
      const calc = calculateParametricTank(currentWidth, clampedH, currentFuelType, currentSkin);
      const ratio = currentMaxFuel > 0 ? currentFuelRem / currentMaxFuel : 1;
      const newRem = Math.round(calc.fuelMass * ratio * 100) / 100;
      updates.fuelRemaining = newRem;
      updates.maxFuel = calc.fuelMass;
    }
    onUpdatePart(updates);
  };

  const handlePropellantChange = (type: FuelType) => {
    const calc = calculateParametricTank(currentWidth, currentHeight, type, currentSkin);
    const ratio = currentMaxFuel > 0 ? currentFuelRem / currentMaxFuel : 1;
    const newRem = Math.round(calc.fuelMass * ratio * 100) / 100;
    onUpdatePart({
      propellantType: type,
      fuelRemaining: newRem,
      maxFuel: calc.fuelMass,
    });
  };

  const handleSkinChange = (skin: 'white' | 'orange' | 'steel' | 'dark') => {
    onUpdatePart({ tankSkin: skin });
  };

  const defaultEngineWidthForMount = (mountCount: number, tankW: number) => {
    if (mountCount === 1) return Math.min(2.0, Math.round(tankW * 0.75 * 10) / 10);
    if (mountCount === 2) return Math.min(1.5, Math.max(0.6, Math.round(tankW * 0.42 * 10) / 10));
    return Math.min(1.2, Math.max(0.5, Math.round(tankW * 0.30 * 10) / 10));
  };

  // Find any engines currently attached to or directly below this fuel tank's base
  const attachedEngines = (allParts || []).filter((p) => {
    if (p.uid === part.uid) return false;
    const pDef = PART_CATALOG[p.partId];
    if (!pDef || (pDef.category !== 'Propulsion' && p.partId !== 'modular_rocket_engine' && (pDef.maxThrust ?? 0) <= 0)) return false;
    const pH = getPartHeight(p, pDef);
    const tankBottomY = part.y - currentHeight / 2;
    const engineTopY = p.y + pH / 2;
    const isVerticallyAtBottom = Math.abs(engineTopY - tankBottomY) < 0.6;
    const isHorizontallyWithinTank = Math.abs(p.x - part.x) <= currentWidth * 0.7;
    return isVerticallyAtBottom && isHorizontallyWithinTank;
  });

  const currentMountCount: 1 | 2 | 3 = (part.engineMountCount ?? 1) as 1 | 2 | 3;
  const currentMountEngineWidth = part.engineMountWidthM ?? defaultEngineWidthForMount(currentMountCount, currentWidth);

  const handleEngineMountWidthChange = (val: number) => {
    const clampedW = Math.max(0.3, Math.min(currentWidth * 0.95, Math.round(val * 20) / 20));
    onUpdatePart({ engineMountWidthM: clampedW });

    // Also update width of any engines attached to this tank base!
    if (allParts && onUpdateAllParts && attachedEngines.length > 0) {
      const updatedAll = allParts.map((p) => {
        if (attachedEngines.some((ae) => ae.uid === p.uid)) {
          return { ...p, customWidth: clampedW };
        }
        return p;
      });
      onUpdateAllParts(updatedAll);
    }
  };

  const handleEngineMountCountChange = (count: 1 | 2 | 3) => {
    const defaultEngW = defaultEngineWidthForMount(count, currentWidth);
    onUpdatePart({ engineMountCount: count, engineMountWidthM: defaultEngW });

    // Re-align or resize existing attached engines to match the new socket positions
    if (allParts && onUpdateAllParts && attachedEngines.length > 0) {
      const tankBottomY = part.y - currentHeight / 2;
      const targetSlots =
        count === 1
          ? [part.x]
          : count === 2
          ? [part.x - currentWidth * 0.25, part.x + currentWidth * 0.25]
          : [part.x - currentWidth * 0.32, part.x, part.x + currentWidth * 0.32];

      const updatedAll = allParts.map((p) => {
        const engIdx = attachedEngines.findIndex((ae) => ae.uid === p.uid);
        if (engIdx !== -1 && engIdx < targetSlots.length) {
          const pDef = PART_CATALOG[p.partId];
          const pH = getPartHeight(p, pDef);
          return {
            ...p,
            x: targetSlots[engIdx],
            y: tankBottomY - pH / 2,
            customWidth: defaultEngW,
          };
        }
        return p;
      });
      onUpdateAllParts(updatedAll);
    }
  };

  const handleAutoMountEngines = () => {
    if (!allParts || !onUpdateAllParts) return;
    const count = part.engineMountCount || 1;
    const defaultEngW = part.engineMountWidthM ?? defaultEngineWidthForMount(count, currentWidth);
    const tankBottomY = part.y - currentHeight / 2;
    const targetSlots =
      count === 1
        ? [part.x]
        : count === 2
        ? [part.x - currentWidth * 0.25, part.x + currentWidth * 0.25]
        : [part.x - currentWidth * 0.32, part.x, part.x + currentWidth * 0.32];

    const engineDef = PART_CATALOG['modular_rocket_engine'] || PART_CATALOG['engine_hawk'] || PART_CATALOG['engine_titan'];
    const engH = engineDef.height;

    // Remove existing attached engines and create aligned cluster
    const newParts = allParts.filter((p) => !attachedEngines.some((ae) => ae.uid === p.uid));
    const newEngines: PlacedPart[] = targetSlots.map((slotX, idx) => {
      const existing = attachedEngines[idx];
      if (existing) {
        return {
          ...existing,
          x: slotX,
          y: tankBottomY - engH / 2,
          customWidth: defaultEngW,
        };
      }
      return {
        uid: 'eng_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substring(2, 6),
        partId: 'modular_rocket_engine',
        x: slotX,
        y: tankBottomY - engH / 2,
        rotation: 0,
        customWidth: defaultEngW,
        customHeight: engH,
        stage: part.stage,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
        isEngineOn: false,
        propellantType: currentFuelType,
        engineConfig: { ...DEFAULT_JUNO_ENGINE_CONFIG },
      };
    });

    onUpdateAllParts([...newParts, ...newEngines]);
  };

  const widthPresets = [
    { label: '1.2m', val: 1.2 },
    { label: '2.0m', val: 2.0 },
    { label: '3.0m', val: 3.0 },
    { label: '4.0m', val: 4.0 },
    { label: '5.0m', val: 5.0 },
    { label: '7.0m', val: 7.0 },
  ];

  const heightPresets = [
    { label: '1.5m', val: 1.5 },
    { label: '3.0m', val: 3.0 },
    { label: '4.5m', val: 4.5 },
    { label: '6.0m', val: 6.0 },
    { label: '9.0m', val: 9.0 },
    { label: '12.0m', val: 12.0 },
  ];

  return (
    <div className="border border-sky-500/30 rounded-xl bg-slate-900/90 p-3 space-y-3.5 text-xs text-slate-200 shadow-xl">
      {/* Header & Quick Action Buttons */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 font-bold text-sky-400">
          <Settings2 className="w-4 h-4 text-sky-400" />
          <span>Procedural Part Configurator</span>
        </div>
        <div className="flex items-center gap-1">
          {onRotatePart && (
            <button
              onClick={onRotatePart}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Rotate 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
          {onDeletePart && (
            <button
              onClick={onDeletePart}
              className="p-1 rounded bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-800/40 transition cursor-pointer"
              title="Delete Part"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Procedural Sizing (Diameter & Length) - Strictly for procedural tanks and scalable structures */}
      {isProceduralScalable && (
        <div className="space-y-3">
          {/* Width (Diameter) Slider & Stepper */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
                <span>Diameter / Width:</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.4"
                  max="10.0"
                  step="0.1"
                  value={currentWidth}
                  onChange={(e) => handleWidthChange(parseFloat(e.target.value) || 1.0)}
                  className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-right text-sky-300 font-bold focus:outline-none focus:border-sky-500"
                />
                <span className="text-slate-400 font-mono text-[10px]">m</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleWidthChange(currentWidth - 0.2)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                min="0.4"
                max="10.0"
                step="0.05"
                value={currentWidth}
                onChange={(e) => handleWidthChange(parseFloat(e.target.value))}
                className="flex-1 accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => handleWidthChange(currentWidth + 0.2)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1 pt-0.5">
              {widthPresets.map((p) => (
                <button
                  key={p.val}
                  onClick={() => handleWidthChange(p.val)}
                  className={`py-0.5 rounded text-[10px] font-mono transition cursor-pointer border ${
                    Math.abs(currentWidth - p.val) < 0.08
                      ? 'bg-sky-600 text-white border-sky-400 font-bold'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Height (Length) Slider & Stepper */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
                <span>Length / Height:</span>
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0.4"
                  max="20.0"
                  step="0.1"
                  value={currentHeight}
                  onChange={(e) => handleHeightChange(parseFloat(e.target.value) || 1.0)}
                  className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-right text-sky-300 font-bold focus:outline-none focus:border-sky-500"
                />
                <span className="text-slate-400 font-mono text-[10px]">m</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleHeightChange(currentHeight - 0.5)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                -
              </button>
              <input
                type="range"
                min="0.4"
                max="20.0"
                step="0.1"
                value={currentHeight}
                onChange={(e) => handleHeightChange(parseFloat(e.target.value))}
                className="flex-1 accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => handleHeightChange(currentHeight + 0.5)}
                className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold flex items-center justify-center cursor-pointer"
              >
                +
              </button>
            </div>

            <div className="grid grid-cols-6 gap-1 pt-0.5">
              {heightPresets.map((p) => (
                <button
                  key={p.val}
                  onClick={() => handleHeightChange(p.val)}
                  className={`py-0.5 rounded text-[10px] font-mono transition cursor-pointer border ${
                    Math.abs(currentHeight - p.val) < 0.1
                      ? 'bg-sky-600 text-white border-sky-400 font-bold'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Deployable Part Animation Test & Actuation Controls */}
      {isDeployable && (
        <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sky-300 font-bold text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>Deployment & Articulation</span>
            </span>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
              (part.deployProgress ?? (part.deployed ? 1 : 0)) > 0.05
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                : 'bg-slate-900 text-slate-400 border border-slate-800'
            }`}>
              {Math.round((part.deployProgress ?? (part.deployed ? 1 : 0)) * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onUpdatePart({ deployed: false, deployProgress: 0.0 })}
              className={`flex-1 py-1 px-2 rounded text-[11px] font-mono font-bold transition cursor-pointer border ${
                (part.deployProgress ?? (part.deployed ? 1 : 0)) <= 0.05
                  ? 'bg-sky-600 text-white border-sky-400 shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              Fold / Stow
            </button>
            <button
              onClick={() => onUpdatePart({ deployed: true, deployProgress: 1.0 })}
              className={`flex-1 py-1 px-2 rounded text-[11px] font-mono font-bold transition cursor-pointer border ${
                (part.deployProgress ?? (part.deployed ? 1 : 0)) >= 0.95
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              Deploy / Unfold
            </button>
          </div>

          {/* Scrub deploy progress slider for checking folding/unfolding animation */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>Scrub Unfold:</span>
              <span className="text-sky-400 font-bold">{Math.round((part.deployProgress ?? (part.deployed ? 1 : 0)) * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={part.deployProgress ?? (part.deployed ? 1.0 : 0.0)}
              onChange={(e) => {
                const p = parseFloat(e.target.value);
                onUpdatePart({ deployProgress: p, deployed: p > 0.5 });
              }}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Action Group (Activation Group) Assignment */}
      <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
        <div className="flex items-center justify-between text-slate-300">
          <span className="font-medium flex items-center gap-1.5 text-sky-400">
            <Layers className="w-3.5 h-3.5" />
            <span>Action Group:</span>
          </span>
          <select
            value={part.actionGroup || 0}
            onChange={(e) => onUpdatePart({ actionGroup: parseInt(e.target.value) || undefined })}
            className="bg-slate-900 border border-slate-700 text-sky-300 font-bold rounded px-2 py-0.5 text-[11px] focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value={0}>None (Manual Stage Only)</option>
            <option value={1}>Action Group 1 (AG1)</option>
            <option value={2}>Action Group 2 (AG2)</option>
            <option value={3}>Action Group 3 (AG3)</option>
            <option value={4}>Action Group 4 (AG4)</option>
            <option value={5}>Action Group 5 (AG5)</option>
          </select>
        </div>
      </div>

      {/* N×M Solar Panel Detail Editor (Full 2D Matrix Grid System) */}
      {def.isSolarPanel && (() => {
        const gridN = part.solarGridN || def.solarGridN || 2;
        const gridM = part.solarGridM || def.solarGridM || 4;
        const cellW = part.solarCellWidthM ?? 0.45;
        const cellH = part.solarCellHeightM ?? 0.65;
        const efficiency = part.solarEfficiency ?? 0.28;
        const totalAreaM2 = Math.round(gridN * gridM * cellW * cellH * 100) / 100;
        // Solar irradiance at 1 AU ~ 1.36 kW/m2
        const peakPowerKw = Math.round(totalAreaM2 * 1.36 * efficiency * 10) / 10;
        const estimatedDryMassT = Math.round((0.02 + totalAreaM2 * 0.007) * 1000) / 1000;

        const panelType = part.solarPanelType || (def.id.includes('circular') ? 'circular' : def.id.includes('hex') ? 'hexagonal' : 'classic');

        return (
          <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950 border border-amber-500/40 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px]">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Photovoltaic Solar Array Architecture</span>
              </span>
              <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800/60">
                {panelType === 'circular' ? 'Radial Fan' : panelType === 'hexagonal' ? 'Hex Matrix' : `${gridN}×${gridM} Wing`}
              </span>
            </div>

            {/* 3 SOLAR PANEL TYPES SELECTOR */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-medium block">Array Architecture (3 Types):</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { type: 'classic', label: 'Classic Wing', desc: 'Accordion Scissor' },
                  { type: 'circular', label: 'Circular Fan', desc: 'Radial Blossoming' },
                  { type: 'hexagonal', label: 'Hex Matrix', desc: 'JWST Segmented' },
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => onUpdatePart({ solarPanelType: item.type as any })}
                    className={`p-1.5 rounded text-left border transition cursor-pointer ${
                      panelType === item.type
                        ? 'bg-amber-950/80 border-amber-400 text-amber-200 font-bold shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[10px]">{item.label}</div>
                    <div className="text-[8px] text-slate-500 font-normal">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Type-Specific Preview & Controls */}
            {panelType === 'classic' && (
              <>
                {/* Interactive 2D Matrix Visualizer Preview */}
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col items-center">
                  <div className="text-[9px] font-mono text-slate-400 mb-1.5 flex items-center justify-between w-full">
                    <span>N = Transverse ({gridN} cols)</span>
                    <span className="text-amber-400 font-bold">{peakPowerKw} kW Peak</span>
                    <span>M = Longitudinal ({gridM} rows)</span>
                  </div>
                  <div
                    className="grid gap-1 p-1.5 bg-slate-950 rounded border border-amber-500/30 max-h-24 overflow-y-auto w-full justify-center"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(gridN, 10)}, minmax(0, 1fr))`,
                    }}
                  >
                    {Array.from({ length: gridN * gridM }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-3.5 min-w-[12px] rounded-[2px] bg-gradient-to-b from-sky-500 to-blue-700 border border-sky-400/60 shadow-[0_0_4px_rgba(56,189,248,0.3)] transition-all"
                        title={`Cell ${idx + 1}: ${cellW}m × ${cellH}m`}
                      />
                    ))}
                  </div>
                  <div className="text-[8px] font-mono text-slate-500 mt-1">
                    2D Array Area: {totalAreaM2} m² | Est. Mass: {estimatedDryMassT} t
                  </div>
                </div>

                {/* N & M Matrix Sliders */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">N Columns (Transverse):</span>
                      <span className="text-amber-400 font-mono font-bold">{gridN}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={gridN}
                      onChange={(e) => onUpdatePart({ solarGridN: parseInt(e.target.value) || 1 })}
                      className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">M Rows (Perpendicular):</span>
                      <span className="text-amber-400 font-mono font-bold">{gridM}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="16"
                      step="1"
                      value={gridM}
                      onChange={(e) => onUpdatePart({ solarGridM: parseInt(e.target.value) || 1 })}
                      className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </>
            )}

            {panelType === 'circular' && (
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-amber-300 font-bold">Radial Fan Wedge Sectors:</span>
                  <span className="text-amber-200 font-mono font-bold bg-amber-950 px-1.5 py-0.5 rounded border border-amber-700">
                    {part.solarSectors ?? 12} Sectors
                  </span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="24"
                  step="2"
                  value={part.solarSectors ?? 12}
                  onChange={(e) => onUpdatePart({ solarSectors: parseInt(e.target.value) || 12 })}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="grid grid-cols-4 gap-1">
                  {[8, 12, 16, 20].map((num) => (
                    <button
                      key={num}
                      onClick={() => onUpdatePart({ solarSectors: num })}
                      className={`py-0.5 text-[9px] font-mono rounded border transition cursor-pointer ${
                        (part.solarSectors ?? 12) === num
                          ? 'bg-amber-600 text-white border-amber-400 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                      }`}
                    >
                      {num} Wedges
                    </button>
                  ))}
                </div>
                <div className="text-[8px] font-mono text-slate-400">
                  UltraFlex radial array: petals blossom outward in 360° fan geometry
                </div>
              </div>
            )}

            {panelType === 'hexagonal' && (
              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-amber-500/30 space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-amber-300 font-bold">Concentric Hexagonal Rings:</span>
                  <span className="text-amber-200 font-mono font-bold bg-amber-950 px-1.5 py-0.5 rounded border border-amber-700">
                    {(part.solarHexRings ?? 1) === 1 ? '1 Ring (7 Segments)' : '2 Rings (19 Segments)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { rings: 1, label: 'Single Ring (7 Hex)', eff: 'Compact' },
                    { rings: 2, label: 'Double Ring (19 Hex)', eff: 'Deep Space' },
                  ].map((h) => (
                    <button
                      key={h.rings}
                      onClick={() => onUpdatePart({ solarHexRings: h.rings })}
                      className={`p-1.5 rounded text-left border transition cursor-pointer ${
                        (part.solarHexRings ?? 1) === h.rings
                          ? 'bg-amber-950/80 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-mono">{h.label}</div>
                      <div className="text-[8px] text-slate-500">{h.eff}</div>
                    </button>
                  ))}
                </div>
                <div className="text-[8px] font-mono text-slate-400">
                  JWST gold-beryllium tessellated hexagonal mirror/photovoltaic array
                </div>
              </div>
            )}

            {/* Individual Cell Dimensions (Width & Height) */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Wafer Width (N-dim):</span>
                  <span className="text-sky-300 font-mono font-bold">{cellW.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.05"
                  value={cellW}
                  onChange={(e) => onUpdatePart({ solarCellWidthM: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Wafer Height (M-dim):</span>
                  <span className="text-sky-300 font-mono font-bold">{cellH.toFixed(2)} m</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.05"
                  value={cellH}
                  onChange={(e) => onUpdatePart({ solarCellHeightM: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Photovoltaic Material Archetype */}
            <div className="space-y-1">
              <span className="text-slate-400 text-[10px] font-medium block">Photovoltaic Substrate:</span>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { name: 'Silicon Blue Ultra', eff: 0.24 },
                  { name: 'Triple-Junction GaAs', eff: 0.36 },
                  { name: 'Gold Kapton Flexible', eff: 0.20 },
                  { name: 'Hex Honeycomb Mesh', eff: 0.30 },
                ].map((mat) => (
                  <button
                    key={mat.name}
                    onClick={() => onUpdatePart({
                      solarPanelStyle: mat.name as any,
                      solarEfficiency: mat.eff,
                    })}
                    className={`py-1 px-1.5 rounded text-left border text-[9px] font-mono transition cursor-pointer ${
                      (part.solarPanelStyle || 'Silicon Blue Ultra') === mat.name
                        ? 'bg-amber-950/80 border-amber-400 text-amber-200 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>{mat.name}</div>
                    <div className="text-[8px] text-slate-500">{Math.round(mat.eff * 100)}% Eff</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Cell Efficiency & Articulation Unfold Speed */}
            <div className="space-y-2 pt-1 border-t border-slate-800/80">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Photoelectric Efficiency Tuning:</span>
                  <span className="text-amber-300 font-mono font-bold">
                    {Math.round(efficiency * 100)}% ({efficiency > 0.32 ? 'GaAs Multi-Junction' : 'Silicon Monocrystalline'})
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="42"
                  step="1"
                  value={Math.round(efficiency * 100)}
                  onChange={(e) => onUpdatePart({ solarEfficiency: parseInt(e.target.value) / 100 })}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-400">Articulation Accordion Unfold Speed:</span>
                  <span className="text-amber-300 font-mono font-bold">
                    {(part.solarUnfoldSpeed ?? 1.0).toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={part.solarUnfoldSpeed ?? 1.0}
                  onChange={(e) => onUpdatePart({ solarUnfoldSpeed: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Sun-Tracking Servo Toggle */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-300 text-[10px] flex items-center gap-1">
                  <Sun className="w-3 h-3 text-amber-400" />
                  <span>Dual-Axis Sun-Tracking Servo:</span>
                </span>
                <button
                  onClick={() => onUpdatePart({ solarSunTracking: !(part.solarSunTracking ?? true) })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition border ${
                    (part.solarSunTracking ?? true)
                      ? 'bg-amber-600 text-white border-amber-400 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {(part.solarSunTracking ?? true) ? 'ACTIVE' : 'LOCKED'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4-Stage Parachute Remake Detail Editor */}
      {def.isParachute && (() => {
        const isChuteUnfolded = (part.deployProgress ?? (part.deployed ? 1 : 0)) > 0.4;
        const chuteType = part.parachuteChuteType || (
          def.id.includes('drogue') ? 'Drogue' :
          def.id.includes('ram') ? 'Ram-Air' :
          def.id.includes('cluster') ? 'Cluster' : 'Main'
        );

        return (
        <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950 border border-rose-500/40 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-rose-400 flex items-center gap-1.5 text-[11px]">
              <Shield className="w-3.5 h-3.5 text-rose-400" />
              <span>Multi-Stage Parachute System (4 Types)</span>
            </span>
            <span className="text-[10px] font-mono text-rose-300 font-bold bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800/60">
              {chuteType} Chute
            </span>
          </div>

          {/* Chute Specialization Type (4 Recreated Profiles) */}
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400 font-medium block">Specialization Profile (4 Distinct Types):</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { type: 'Main', label: '1. Mk16 Main', desc: '12-Gore Scalloped Dome' },
                { type: 'Drogue', label: '2. Ribbon Drogue', desc: 'Supersonic Slotted Skirt' },
                { type: 'Ram-Air', label: '3. Ram-Air Parafoil', desc: 'Multi-Cell Gliding Wing' },
                { type: 'Cluster', label: '4. Apollo Cluster', desc: 'Triple Radial Canopies' },
              ].map((item) => (
                <button
                  key={item.type}
                  onClick={() => onUpdatePart({
                    parachuteChuteType: item.type,
                    customParachuteRadiusM: item.type === 'Cluster' ? 16 : item.type === 'Main' ? 12 : item.type === 'Ram-Air' ? 10 : 5,
                    parachuteCanopyDiameterM: item.type === 'Cluster' ? 32 : item.type === 'Main' ? 24 : item.type === 'Ram-Air' ? 20 : 10,
                  })}
                  className={`p-1.5 rounded text-left border text-[10px] transition cursor-pointer font-mono font-bold ${
                    chuteType === item.type
                      ? 'bg-rose-950/80 border-rose-400 text-rose-200 shadow-sm'
                      : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                  }`}
                >
                  <div>{item.label}</div>
                  <div className="text-[8px] text-slate-500 font-normal">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Live Parachute Unfold / Fold Animation Scrubber */}
          <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                <span>Canopy Unfolding / Folding Animation:</span>
              </span>
              <button
                onClick={() => {
                  const target = isChuteUnfolded ? 0.0 : 1.0;
                  onUpdatePart({
                    deployed: !isChuteUnfolded,
                    deployProgress: target,
                    parachuteState: !isChuteUnfolded ? 'MAIN' : 'STOWED',
                  });
                }}
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border transition cursor-pointer ${
                  isChuteUnfolded
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isChuteUnfolded ? 'Fold / Pack Chute' : 'Unfold / Deploy Chute'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-slate-400">Pack</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={part.deployProgress ?? (part.deployed ? 1.0 : 0.0)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  const state = val < 0.1 ? 'STOWED' : val < 0.35 ? 'PILOT' : val < 0.75 ? 'DROGUE' : 'MAIN';
                  onUpdatePart({
                    deployProgress: val,
                    deployed: val > 0.05,
                    parachuteState: state,
                  });
                }}
                className="flex-1 accent-rose-500 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
              <span className="text-[9px] font-mono text-slate-400">Blossom</span>
              <span className="text-[10px] font-mono text-rose-300 font-bold min-w-8 text-right">
                {Math.round((part.deployProgress ?? (part.deployed ? 1.0 : 0.0)) * 100)}%
              </span>
            </div>
          </div>

          {/* Canopy Diameter (1m - 30m) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Canopy Diameter:</span>
              <span className="font-mono text-rose-300 font-bold">
                {part.parachuteCanopyDiameterM || 18} m
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={part.parachuteCanopyDiameterM || 18}
              onChange={(e) => onUpdatePart({
                parachuteCanopyDiameterM: parseInt(e.target.value),
                customParachuteRadiusM: parseInt(e.target.value) / 2,
              })}
              className="w-full accent-rose-500 h-1.5 bg-slate-900 rounded cursor-pointer"
            />
          </div>

          {/* Deploy Altitude Slider (100m - 5000m) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Arm / Deploy Altitude:</span>
              <span className="font-mono text-rose-300 font-bold">{part.parachuteDeployAltitudeM || 3500} m</span>
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={part.parachuteDeployAltitudeM || 3500}
              onChange={(e) => onUpdatePart({ parachuteDeployAltitudeM: parseInt(e.target.value) })}
              className="w-full accent-rose-500 h-1.5 bg-slate-900 rounded cursor-pointer"
            />
          </div>

          {/* Drogue / Reefing Cut Altitude Slider (200m - 2000m) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Reefing Cut / Full Blossom Alt:</span>
              <span className="font-mono text-rose-300 font-bold">
                {part.parachuteReefingCutAltM || part.mainAltitudeM || 800} m
              </span>
            </div>
            <input
              type="range"
              min="200"
              max="2000"
              step="50"
              value={part.parachuteReefingCutAltM || part.mainAltitudeM || 800}
              onChange={(e) => onUpdatePart({
                parachuteReefingCutAltM: parseInt(e.target.value),
                mainAltitudeM: parseInt(e.target.value),
              })}
              className="w-full accent-rose-500 h-1.5 bg-slate-900 rounded cursor-pointer"
            />
          </div>

          {/* Minimum Atmospheric Pressure (0.01 - 0.50 atm) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Min Dynamic Pressure Threshold:</span>
              <span className="font-mono text-rose-300 font-bold">
                {(part.parachuteMinPressureAtm || 0.04).toFixed(2)} atm
              </span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.50"
              step="0.01"
              value={part.parachuteMinPressureAtm || 0.04}
              onChange={(e) => onUpdatePart({ parachuteMinPressureAtm: parseFloat(e.target.value) })}
              className="w-full accent-rose-500 h-1.5 bg-slate-900 rounded cursor-pointer"
            />
          </div>
        </div>
        );
      })()}

      {/* Landing Legs Detail Editor (5 Architecture Types) */}
      {def.isLandingLeg && (() => {
        const legType = part.landingLegType || (
          def.id.includes('heavy') ? 'heavy_carbon' :
          def.id.includes('wide') ? 'wide_spreader' :
          def.id.includes('micro') ? 'micro_hopper' :
          def.id.includes('spider') ? 'spider_articulated' : 'standard'
        );

        const isUnfolded = (part.deployProgress ?? (part.deployed ? 1 : 0)) > 0.5;

        return (
          <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950 border border-emerald-500/40 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px]">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hydraulic Landing Gear & Struts (5 Types)</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                {legType === 'heavy_carbon' ? 'Falcon A-Frame' :
                 legType === 'wide_spreader' ? 'Low-G Spreader' :
                 legType === 'micro_hopper' ? 'Micro Hopper' :
                 legType === 'spider_articulated' ? 'Apollo LEM Tripod' : 'LM Telescoping'}
              </span>
            </div>

            {/* 5 LANDING LEG ARCHITECTURE TYPES */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-medium block">Strut Architecture (5 Types):</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { type: 'standard', label: '1. LM Telescoping', desc: 'Apollo shock cylinder & coil spring' },
                  { type: 'heavy_carbon', label: '2. Heavy Carbon', desc: 'Falcon inverted A-frame booster strut' },
                  { type: 'wide_spreader', label: '3. Wide Spreader', desc: 'Low-gravity planetary outrigger tripod' },
                  { type: 'micro_hopper', label: '4. Micro Hopper', desc: 'Titanium leaf spring asteroid hopper' },
                  { type: 'spider_articulated', label: '5. Apollo LEM Tripod', desc: 'Pyramidal truss & lunar contact probe' },
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => onUpdatePart({ landingLegType: item.type as any })}
                    className={`p-1.5 rounded text-left border transition cursor-pointer ${
                      legType === item.type
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 font-bold shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[10px]">{item.label}</div>
                    <div className="text-[8px] text-slate-500 font-normal leading-tight">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Live Unfold / Fold Animation Scrubber & Test Toggle */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span>Folding / Unfolding Animation:</span>
                </span>
                <button
                  onClick={() => {
                    const target = isUnfolded ? 0.0 : 1.0;
                    onUpdatePart({
                      deployed: !isUnfolded,
                      deployProgress: target,
                    });
                  }}
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border transition cursor-pointer ${
                    isUnfolded
                      ? 'bg-emerald-600 text-white border-emerald-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {isUnfolded ? 'Fold / Stow Strut' : 'Unfold / Deploy Strut'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-slate-400">Stowed</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={part.deployProgress ?? (part.deployed ? 1.0 : 0.0)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    onUpdatePart({
                      deployProgress: val,
                      deployed: val > 0.05,
                    });
                  }}
                  className="flex-1 accent-emerald-500 h-1.5 bg-slate-800 rounded cursor-pointer"
                />
                <span className="text-[9px] font-mono text-slate-400">Deployed</span>
                <span className="text-[10px] font-mono text-emerald-300 font-bold min-w-8 text-right">
                  {Math.round((part.deployProgress ?? (part.deployed ? 1.0 : 0.0)) * 100)}%
                </span>
              </div>
            </div>

            {/* Overall Strut Scale Bar */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-emerald-300 font-bold flex items-center gap-1">
                  <Maximize2 className="w-3 h-3 text-emerald-400" />
                  <span>Landing Gear Scale:</span>
                </span>
                <span className="font-mono text-emerald-300 font-bold bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-700">
                  {(part.legScale ?? 1.0).toFixed(1)}x Scale
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.5"
                step="0.1"
                value={part.legScale ?? 1.0}
                onChange={(e) => onUpdatePart({ legScale: parseFloat(e.target.value) || 1.0 })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <div className="flex gap-1 justify-between">
                {[
                  { label: '0.8x Probe', val: 0.8 },
                  { label: '1.0x Nominal', val: 1.0 },
                  { label: '1.5x Heavy', val: 1.5 },
                  { label: '2.0x Super Heavy', val: 2.0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => onUpdatePart({ legScale: preset.val })}
                    className={`flex-1 py-0.5 rounded text-[8px] font-mono transition border cursor-pointer ${
                      Math.abs((part.legScale ?? 1.0) - preset.val) < 0.05
                        ? 'bg-emerald-600 text-white font-bold border-emerald-400'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deploy Angle Slider (20° - 75°) */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Deployed Cant / Splay Angle:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {part.legDeployAngleDeg ?? 45}°
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="75"
                step="5"
                value={part.legDeployAngleDeg ?? 45}
                onChange={(e) => onUpdatePart({ legDeployAngleDeg: parseInt(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Suspension Stiffness Slider (0.1 - 2.0) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Suspension Spring Stiffness:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {(part.legSuspensionStiffness ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={part.legSuspensionStiffness ?? 1.0}
                onChange={(e) => onUpdatePart({ legSuspensionStiffness: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Suspension Damping Slider (0.1 - 2.0) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Shock Absorber Damping:</span>
                <span className="font-mono text-emerald-300 font-bold">
                  {(part.legSuspensionDamping ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={part.legSuspensionDamping ?? 1.0}
                onChange={(e) => onUpdatePart({ legSuspensionDamping: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Footpad Type Selector */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <span className="text-slate-400 text-[10px] font-medium block">Terrain Footpad Style:</span>
              <div className="grid grid-cols-4 gap-1">
                {(['Standard', 'Heavy', 'Wide Terrain', 'Spike Claw'] as const).map((fp) => (
                  <button
                    key={fp}
                    onClick={() => onUpdatePart({ legFootpadType: fp as any })}
                    className={`py-1 px-1 rounded text-center border text-[9px] font-mono transition cursor-pointer ${
                      (part.legFootpadType || 'Standard') === fp
                        ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    {fp}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reaction Control System (RCS) Detail Editor (Clean Configurations) */}
      {def.isRCS && (() => {
        const rcsType = part.rcsThrusterType || (
          def.id.includes('gimbal') ? 'rcs_gimbal_vernier' : 'rcs_3way_cluster'
        );
        const propellant = part.rcsPropellantType || 'monoprop';

        return (
          <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950 border border-sky-500/40 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="font-bold text-sky-400 flex items-center gap-1.5 text-[11px]">
                <Wind className="w-3.5 h-3.5 text-sky-400" />
                <span>Reaction Control System (RCS)</span>
              </span>
              <span className="text-[10px] font-mono text-sky-300 font-bold bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/60">
                {rcsType === 'rcs_gimbal_vernier' ? 'Gimbal Vernier' : '3-Way Cluster'}
              </span>
            </div>

            {/* RCS ARCHITECTURE TYPES */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-medium block">Thruster Configuration:</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { type: 'rcs_3way_cluster', label: '1. 3-Way Cluster', desc: 'Up, Down & Lateral Nozzles' },
                  { type: 'rcs_gimbal_vernier', label: '2. Gimbal Vernier', desc: '360° Agile Vectoring Nozzle' },
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => onUpdatePart({ rcsThrusterType: item.type as any })}
                    className={`p-1.5 rounded text-left border transition cursor-pointer ${
                      rcsType === item.type
                        ? 'bg-sky-950/80 border-sky-400 text-sky-200 font-bold shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[10px]">{item.label}</div>
                    <div className="text-[8px] text-slate-500 font-normal leading-tight">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Propellant Chemistry Selection */}
            <div className="space-y-1 pt-1 border-t border-slate-800">
              <label className="text-[10px] text-slate-400 font-medium block">Propellant Chemistry & Exhaust:</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { prop: 'cold_gas', label: 'Cold Gas (GN2)', spec: 'White Vapor (Isp ~70s)' },
                  { prop: 'monoprop', label: 'Monoprop (N2H4)', spec: 'Cyan Spark (Isp ~220s)' },
                  { prop: 'hypergolic', label: 'Hypergolic Biprop', spec: 'Amber Fire (Isp ~310s)' },
                ].map((item) => (
                  <button
                    key={item.prop}
                    onClick={() => onUpdatePart({ rcsPropellantType: item.prop as any })}
                    className={`p-1.5 rounded text-left border transition cursor-pointer ${
                      propellant === item.prop
                        ? 'bg-sky-950/80 border-sky-400 text-sky-200 font-bold shadow-sm'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[10px]">{item.label}</div>
                    <div className="text-[8px] text-slate-500 font-normal leading-tight">{item.spec}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Thrust Output & Scale */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">RCS Scale:</span>
                  <span className="font-mono text-sky-300 font-bold">{(part.rcsScale ?? 1.0).toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={part.rcsScale ?? 1.0}
                  onChange={(e) => onUpdatePart({ rcsScale: parseFloat(e.target.value) || 1.0 })}
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Thrust per Nozzle:</span>
                  <span className="font-mono text-sky-300 font-bold">{(part.rcsThrustKn ?? 1.0).toFixed(1)} kN</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="5.0"
                  step="0.2"
                  value={part.rcsThrustKn ?? 1.0}
                  onChange={(e) => onUpdatePart({ rcsThrustKn: parseFloat(e.target.value) || 1.0 })}
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Cant Angle for Canted Dual Jet */}
            {rcsType === 'rcs_linear_dual' && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Nozzle Outward Cant Angle:</span>
                  <span className="font-mono text-sky-300 font-bold">{part.rcsCantAngleDeg ?? 35}°</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="5"
                  value={part.rcsCantAngleDeg ?? 35}
                  onChange={(e) => onUpdatePart({ rcsCantAngleDeg: parseInt(e.target.value) || 35 })}
                  className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            )}

            {/* Live Thruster Test Firing Controls */}
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-300 font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span>Plume & Shock Diamond Test:</span>
                </span>
                <button
                  onClick={() => onUpdatePart({ rcsFiring: !part.rcsFiring })}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition cursor-pointer border ${
                    part.rcsFiring
                      ? 'bg-orange-600 text-white border-orange-400 animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                >
                  {part.rcsFiring ? 'FIRING (ACTIVE)' : 'TEST FIRE'}
                </button>
              </div>
              {part.rcsFiring && (
                <div className="flex gap-1 justify-between pt-1">
                  {[
                    { dir: 'ALL', label: 'All Nozzles' },
                    { dir: 'UP', label: 'Up / Out' },
                    { dir: 'LEFT', label: 'Port (Left)' },
                    { dir: 'RIGHT', label: 'Starboard (Right)' },
                  ].map((d) => (
                    <button
                      key={d.dir}
                      onClick={() => onUpdatePart({ rcsFireDirection: d.dir as any })}
                      className={`flex-1 py-0.5 text-[8px] font-mono rounded border transition cursor-pointer ${
                        (part.rcsFireDirection || 'ALL') === d.dir
                          ? 'bg-sky-600 text-white font-bold border-sky-400'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Rover Wheels Detail Editor */}
      {(def.isWheel || def.id.includes('wheel')) && (
        <div className="space-y-2.5 p-2.5 rounded-lg bg-slate-950 border border-cyan-500/40 shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-cyan-400 flex items-center gap-1.5 text-[11px]">
              <CircleDot className="w-3.5 h-3.5 text-cyan-400" />
              <span>Planetary Rover Wheel & Drive System</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-300 font-bold bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/60">
              {(part.wheelMotorPowerKw ?? 2.0).toFixed(1)} kW
            </span>
          </div>

          {/* Motor Power Slider (0.5 - 5.0 kW) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Electric Drive Motor Power:</span>
              <span className="font-mono text-cyan-300 font-bold">
                {(part.wheelMotorPowerKw ?? 2.0).toFixed(1)} kW
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.25"
              value={part.wheelMotorPowerKw ?? 2.0}
              onChange={(e) => onUpdatePart({ wheelMotorPowerKw: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Brake Strength Slider (10% - 100%) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Electromagnetic Brake Torque:</span>
              <span className="font-mono text-cyan-300 font-bold">
                {part.wheelBrakeStrength ?? 80}%
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={part.wheelBrakeStrength ?? 80}
              onChange={(e) => onUpdatePart({ wheelBrakeStrength: parseInt(e.target.value) })}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Steering Angle Slider (0° - 45°) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Max Articulated Steer Angle:</span>
              <span className="font-mono text-cyan-300 font-bold">
                ±{part.wheelMaxSteerAngleDeg ?? 30}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="45"
              step="5"
              value={part.wheelMaxSteerAngleDeg ?? 30}
              onChange={(e) => onUpdatePart({ wheelMaxSteerAngleDeg: parseInt(e.target.value) })}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Suspension Travel Slider (0.1 - 0.8m) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Bogie Suspension Travel:</span>
              <span className="font-mono text-cyan-300 font-bold">
                {(part.wheelSuspensionTravelM ?? 0.35).toFixed(2)} m
              </span>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.05"
              value={part.wheelSuspensionTravelM ?? 0.35}
              onChange={(e) => onUpdatePart({ wheelSuspensionTravelM: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Traction Control Toggle */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-300 text-[10px] flex items-center gap-1">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span>Electronic Anti-Slip Traction Control:</span>
            </span>
            <button
              onClick={() => onUpdatePart({ wheelTractionControl: !(part.wheelTractionControl ?? true) })}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition border ${
                (part.wheelTractionControl ?? true)
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              {(part.wheelTractionControl ?? true) ? 'ACTIVE' : 'OFF'}
            </button>
          </div>
        </div>
      )}

      {/* Rigid Aerospace Specifications Card (For unscaled command, aero, & structural parts) */}
      {!isProceduralScalable && !isEngine && !isMining && (
        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono">
          <div>
            <span className="text-slate-500 block">Dry Mass:</span>
            <span className="text-sky-300 font-bold">{def.dryMass} t</span>
          </div>
          <div>
            <span className="text-slate-500 block">Diameter:</span>
            <span className="text-slate-300 font-bold">{def.width} m</span>
          </div>
          <div>
            <span className="text-slate-500 block">Height:</span>
            <span className="text-slate-300 font-bold">{def.height} m</span>
          </div>
          {def.crewCapacity !== undefined && def.crewCapacity > 0 && (
            <div>
              <span className="text-slate-500 block">Crew Capacity:</span>
              <span className="text-amber-400 font-bold">{def.crewCapacity} Astr.</span>
            </div>
          )}
          {def.batteryCapacity !== undefined && def.batteryCapacity > 0 && (
            <div>
              <span className="text-slate-500 block">Battery:</span>
              <span className="text-emerald-400 font-bold">{def.batteryCapacity} kWh</span>
            </div>
          )}
          <div>
            <span className="text-slate-500 block">Max Temp:</span>
            <span className="text-orange-400 font-bold">{def.maxTemp} K</span>
          </div>
        </div>
      )}

      {/* FUEL TANK CONFIGURATION: Propellant Type & Tank Skin */}
      {isFuelTank && (
        <div id="tank-configuration-section" className="space-y-3 pt-2 border-t border-slate-800">
          {/* Real-time Tank Specs Banner */}
          <div id="tank-specs-banner" className="grid grid-cols-4 gap-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono">
            <div id="tank-stat-volume">
              <span className="text-slate-500 block">Volume:</span>
              <span className="text-sky-300 font-bold">{tankCalc.volumeM3} m³</span>
            </div>
            <div id="tank-stat-propellant">
              <span className="text-slate-500 block">Propellant:</span>
              <span className="text-amber-400 font-bold">{currentFuelRem.toFixed(1)} / {tankCalc.fuelMass} t</span>
            </div>
            <div id="tank-stat-drymass">
              <span className="text-slate-500 block">Dry Mass:</span>
              <span className="text-slate-300 font-bold">{tankCalc.dryMass} t</span>
            </div>
            <div id="tank-stat-wetmass">
              <span className="text-slate-500 block">Wet Mass:</span>
              <span className="text-emerald-400 font-bold">{(tankCalc.dryMass + currentFuelRem).toFixed(1)} t</span>
            </div>
          </div>

          {/* Propellant Fill Level Slider & Presets */}
          <div id="tank-fill-control" className="space-y-1.5 p-2 rounded-lg bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300 font-medium flex items-center gap-1">
                <Fuel className="w-3.5 h-3.5 text-amber-400" />
                <span>Propellant Fill Level:</span>
              </span>
              <span className="font-mono font-bold text-sky-400">
                {Math.round(fuelPercent)}% ({currentFuelRem.toFixed(2)} t)
              </span>
            </div>
            <input
              id="tank-fill-slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={Math.round(fuelPercent)}
              onChange={(e) => handleFuelPercentChange(Number(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="grid grid-cols-5 gap-1 text-[9px] font-mono text-slate-400">
              <button
                type="button"
                onClick={() => handleFuelPercentChange(0)}
                className={`py-0.5 rounded transition cursor-pointer text-center ${
                  Math.round(fuelPercent) === 0 ? 'bg-rose-900/60 text-rose-200 border border-rose-600' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                0% (Dry)
              </button>
              <button
                type="button"
                onClick={() => handleFuelPercentChange(25)}
                className={`py-0.5 rounded transition cursor-pointer text-center ${
                  Math.round(fuelPercent) === 25 ? 'bg-sky-900/60 text-sky-200 border border-sky-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => handleFuelPercentChange(50)}
                className={`py-0.5 rounded transition cursor-pointer text-center ${
                  Math.round(fuelPercent) === 50 ? 'bg-sky-900/60 text-sky-200 border border-sky-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handleFuelPercentChange(75)}
                className={`py-0.5 rounded transition cursor-pointer text-center ${
                  Math.round(fuelPercent) === 75 ? 'bg-sky-900/60 text-sky-200 border border-sky-500' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                75%
              </button>
              <button
                type="button"
                onClick={() => handleFuelPercentChange(100)}
                className={`py-0.5 rounded transition cursor-pointer text-center ${
                  Math.round(fuelPercent) === 100 ? 'bg-emerald-900/60 text-emerald-200 border border-emerald-500 font-bold' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
              >
                100% Full
              </button>
            </div>
          </div>

          {/* Propellant Selection */}
          <div className="space-y-1.5">
            <span className="text-slate-300 font-medium flex items-center gap-1">
              <Fuel className="w-3.5 h-3.5 text-amber-400" />
              <span>Propellant Chemistry:</span>
            </span>

            <div className="grid grid-cols-3 gap-1">
              {(['kerolox', 'hydrolox', 'methalox', 'monoprop', 'hypergolic', 'solid'] as FuelType[]).map((f) => {
                const spec = PROPELLANT_SPECS[f];
                const active = currentFuelType === f;
                return (
                  <button
                    key={f}
                    onClick={() => handlePropellantChange(f)}
                    className={`p-1.5 rounded text-left border transition cursor-pointer ${
                      active
                        ? 'bg-sky-950/80 border-sky-400 text-sky-200 font-bold shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="text-[11px] truncate">{spec.shortName}</div>
                    <div className="text-[9px] font-mono text-slate-500">
                      {spec.densityTonnePerM3} t/m³ | {spec.baseIspVac}s
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skin / Insulation Selection */}
          <div className="space-y-1.5">
            <span className="text-slate-300 font-medium flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Insulation & Exterior Skin:</span>
            </span>

            <div className="grid grid-cols-4 gap-1">
              {[
                { id: 'white', label: 'White Al-Li', desc: 'Standard', color: '#f8fafc' },
                { id: 'orange', label: 'SOFI Foam', desc: 'LH2 Cryo', color: '#ea580c' },
                { id: 'steel', label: 'Stainless', desc: 'Heavy / Reusable', color: '#94a3b8' },
                { id: 'dark', label: 'Carbon Dark', desc: 'Ultra-light', color: '#1e293b' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSkinChange(s.id as any)}
                  className={`p-1 rounded text-center border transition cursor-pointer ${
                    currentSkin === s.id
                      ? 'bg-sky-950/80 border-sky-400 text-white font-bold'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                  }`}
                >
                  <div
                    className="w-full h-1.5 rounded-sm mb-1 mx-auto"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="text-[10px] leading-tight">{s.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* MULTI-ENGINE MOUNT BASE & ENGINE WIDTH MECHANIC (1-3 ENGINES) */}
          <div className="space-y-2 pt-2.5 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-sky-300 font-semibold flex items-center gap-1.5 text-[11px]">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Base Engine Mount Sockets (Max 3):</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800/60">
                {currentMountCount} {currentMountCount === 1 ? 'Socket' : 'Sockets'}
              </span>
            </div>

            {/* Mount Count Selector Buttons: 1, 2, 3 */}
            <div className="grid grid-cols-3 gap-1.5">
              {([1, 2, 3] as (1 | 2 | 3)[]).map((count) => {
                const active = currentMountCount === count;
                return (
                  <button
                    key={count}
                    onClick={() => handleEngineMountCountChange(count)}
                    className={`py-2 px-1.5 rounded-lg border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                      active
                        ? 'bg-sky-600 border-sky-400 text-white font-bold shadow-md shadow-sky-600/30'
                        : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">
                      {count === 1 ? 'Single (1x)' : count === 2 ? 'Dual (2x)' : 'Tri (3x)'}
                    </div>
                    <div className="text-[9px] text-slate-300/80 mt-0.5 font-mono">
                      {count === 1 ? 'Center Mount' : count === 2 ? 'Symmetric Pair' : 'Tri-Cluster'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Each Engine's Mount Width Mechanic */}
            <div className="space-y-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium flex items-center gap-1 text-[11px]">
                  <ArrowLeftRight className="w-3 h-3 text-sky-400" />
                  <span>Each Engine's Width:</span>
                </span>
                <div className="flex items-center gap-1 font-mono">
                  <input
                    type="number"
                    step="0.05"
                    min="0.3"
                    max={currentWidth * 0.95}
                    value={Math.round(currentMountEngineWidth * 100) / 100}
                    onChange={(e) => handleEngineMountWidthChange(parseFloat(e.target.value) || 0.8)}
                    className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right text-sky-300 font-bold focus:outline-none focus:border-sky-500 text-[11px]"
                  />
                  <span className="text-slate-400 text-[10px]">m</span>
                </div>
              </div>

              {/* Slider for Each Engine's Width */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEngineMountWidthChange(currentMountEngineWidth - 0.1)}
                  className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold flex items-center justify-center cursor-pointer text-xs"
                >
                  -
                </button>
                <input
                  type="range"
                  min="0.3"
                  max={Math.max(0.8, Math.round(currentWidth * 0.9 * 10) / 10)}
                  step="0.05"
                  value={currentMountEngineWidth}
                  onChange={(e) => handleEngineMountWidthChange(parseFloat(e.target.value))}
                  className="flex-1 accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <button
                  onClick={() => handleEngineMountWidthChange(currentMountEngineWidth + 0.1)}
                  className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold flex items-center justify-center cursor-pointer text-xs"
                >
                  +
                </button>
              </div>

              {/* Quick Width Presets */}
              <div className="grid grid-cols-5 gap-1 pt-0.5 font-mono text-[9px]">
                {[0.5, 0.8, 1.0, 1.2, 1.5].map((w) => (
                  <button
                    key={w}
                    onClick={() => handleEngineMountWidthChange(w)}
                    className={`py-0.5 rounded text-center border cursor-pointer ${
                      Math.abs(currentMountEngineWidth - w) < 0.05
                        ? 'bg-sky-600 border-sky-400 text-white font-bold'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
                    }`}
                  >
                    {w}m
                  </button>
                ))}
              </div>

              {/* Auto-Snap / Mount Engines Button */}
              {allParts && onUpdateAllParts && (
                <div className="pt-1.5">
                  <button
                    onClick={() => handleAutoMountEngines()}
                    className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 border border-indigo-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>
                      {attachedEngines.length === 0
                        ? `Auto-Mount ${currentMountCount} Engine${currentMountCount > 1 ? 's' : ''}`
                        : `Re-Align ${attachedEngines.length} Engine${attachedEngines.length > 1 ? 's' : ''} to ${currentMountCount} Socket${currentMountCount > 1 ? 's' : ''}`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* JUNO: NEW ORIGINS PROCEDURAL ENGINE CONFIGURATION */}
      {isEngine && (
        <JunoEngineConfigurator
          part={part}
          onUpdatePart={onUpdatePart}
        />
      )}

      {/* MINING & INDUSTRIAL CONFIGURATION */}
      {isMining && (
        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-amber-400 font-semibold">
            <Pickaxe className="w-3.5 h-3.5" />
            <span>Industrial Resource Specifications</span>
          </div>
          <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px]">
            {def.isMiningDrill && (
              <>
                <div>Extraction Rate: <span className="text-amber-400 font-bold">{def.miningRateKgS || 8.5} kg/s</span></div>
                <div>Power Draw: <span className="text-sky-300 font-bold">{def.powerDrawKw || 4.5} kW</span></div>
              </>
            )}
            {def.isRefinery && (
              <>
                <div>Refining Speed: <span className="text-emerald-400 font-bold">{def.refiningRateKgS || 4.0} kg/s</span></div>
                <div>Power Load: <span className="text-sky-300 font-bold">{def.powerDrawKw || 12.0} kW</span></div>
              </>
            )}
            {def.isSmelter && (
              <>
                <div>Smelting Speed: <span className="text-orange-400 font-bold">{def.smeltingRateKgS || 2.5} kg/s</span></div>
                <div>Arc Power Load: <span className="text-sky-300 font-bold">{def.powerDrawKw || 24.0} kW</span></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ORE HOPPER SPECS */}
      {isOreTank && (
        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex items-center gap-1 text-amber-400 font-semibold">
            <Pickaxe className="w-3.5 h-3.5" />
            <span>Mineral Hopper Capacities</span>
          </div>
          <div className="grid grid-cols-3 gap-1 p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px]">
            <div>
              <span className="text-slate-500 block">Raw Ore:</span>
              <span className="text-amber-400 font-bold">
                {Math.round(2500 * (tankCalc.volumeM3 / 9.4))} kg
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Refined Ore:</span>
              <span className="text-emerald-400 font-bold">
                {Math.round(2000 * (tankCalc.volumeM3 / 9.4))} kg
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Metal Ingots:</span>
              <span className="text-sky-300 font-bold">
                {Math.round(1500 * (tankCalc.volumeM3 / 9.4))} kg
              </span>
            </div>
          </div>
        </div>
      )}

      {/* UNIVERSAL ACTIVATION GROUP (AG1 - AG8) ASSIGNMENT CARD */}
      <div className="space-y-2 p-2.5 rounded-lg bg-slate-950 border border-indigo-500/40 shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="font-bold text-indigo-300 flex items-center gap-1.5 text-[11px]">
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Activation Group Assignment</span>
          </span>
          <span className="text-[10px] font-mono text-indigo-300 font-bold bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60">
            {part.actionGroup ? `AG${part.actionGroup}` : 'Unassigned (None)'}
          </span>
        </div>

        <div className="text-[10px] text-slate-400 leading-relaxed">
          {def.isSolarPanel
            ? 'Assign to an Action Group to toggle panel deployment & folding during flight (keys F1-F8 or HUD).'
            : def.isWheel
            ? 'Assign to an Action Group to toggle rover drive motor power and emergency brake lock.'
            : def.isLandingLeg
            ? 'Assign to an Action Group to toggle landing leg strut extension and retraction.'
            : def.maxThrust > 0
            ? 'Assign to an Action Group to individually ignite or shut down this rocket engine.'
            : def.isParachute
            ? 'Assign to an Action Group to arm and fire the 4-stage canopy deployment sequence.'
            : def.isMiningDrill || def.isRefinery || def.isSmelter
            ? 'Assign to an Action Group to activate or pause surface mining and mineral processing.'
            : def.isDecoupler || def.id.includes('decoupler') || def.id.includes('separator')
            ? 'Assign to an Action Group to fire separation charges on command independently of staging.'
            : 'Assign this system to an in-flight Action Group toggle (active until craft destruction).'}
        </div>

        {/* Action Group Buttons (None, AG1 - AG8) */}
        <div className="grid grid-cols-5 gap-1 pt-1">
          <button
            onClick={() => onUpdatePart({ actionGroup: undefined })}
            className={`py-1.5 px-1 rounded text-center border font-mono text-[10px] transition cursor-pointer ${
              !part.actionGroup
                ? 'bg-slate-800 border-slate-600 text-white font-bold'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-500'
            }`}
          >
            None
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((ag) => (
            <button
              key={ag}
              onClick={() => onUpdatePart({ actionGroup: ag })}
              className={`py-1.5 px-1 rounded text-center border font-mono text-[10px] transition cursor-pointer font-bold ${
                part.actionGroup === ag
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm shadow-indigo-500/30'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-indigo-300'
              }`}
            >
              AG{ag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Export backward-compatible alias for existing code
export const FuelTankInspector = ProceduralPartInspector;
