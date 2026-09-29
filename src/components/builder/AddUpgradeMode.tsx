import React, { useState } from 'react';
import { PlacedPart, RocketMetrics, StageAssembly } from '../../types';
import { PART_CATALOG, calculateFuelTankProperties, getPartHeight, getPartWidth } from '../../data/parts';
import { 
  DEFAULT_STAGE_TEMPLATES, 
  assembleStagesToRocket, 
  extractStagesFromRocket,
  attachBoosterStructureToRocket 
} from '../../data/stageAssemblies';
import { Zap, Plus, ArrowUpRight, Check, Rocket, Sparkles, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';

interface AddUpgradeModeProps {
  currentParts: PlacedPart[];
  stages: StageAssembly[];
  metrics: RocketMetrics;
  onApplyParts: (newParts: PlacedPart[]) => void;
  onSwitchToStageWorkshop: (stageId: string) => void;
  onLaunch: () => void;
}

export const AddUpgradeMode: React.FC<AddUpgradeModeProps> = ({
  currentParts,
  stages,
  metrics,
  onApplyParts,
  onSwitchToStageWorkshop,
  onLaunch,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // One-click upgrade actions
  const handleAddTwinBoosters = () => {
    // Check if boosters already exist and strip them first to prevent overlapping
    const hasBoosters = currentParts.some((p) => p.partId === 'side_separator' || Math.abs(p.x) >= 1.5);
    const baseParts = hasBoosters
      ? currentParts.filter((p) => p.partId !== 'side_separator' && Math.abs(p.x) < 1.5)
      : [...currentParts];

    const boosterStage = (stages || []).find((s) => s.role === 'BOOSTER') || DEFAULT_STAGE_TEMPLATES.BOOSTER;
    const newParts = attachBoosterStructureToRocket(baseParts, boosterStage, 'twin');

    onApplyParts(newParts);
    soundEngine.playLegoSnapSound();
  };

  const handleUpgradeCoreDiameter = () => {
    // Widen all main core tanks to 3.0m and switch to Titan engine
    const updated = currentParts.map((p) => {
      const def = PART_CATALOG[p.partId];
      if (def?.category === 'Fuel' && Math.abs(p.x) < 1.0) {
        const currentH = getPartHeight(p, def);
        const newW = 3.0;
        const props = calculateFuelTankProperties(newW, currentH);
        return {
          ...p,
          partId: 'custom_fuel_tank',
          customWidth: newW,
          customHeight: currentH,
          fuelRemaining: props.fuelMass,
          maxFuel: props.fuelMass,
        };
      }
      // Upgrade stage 1 engines
      if (def?.category === 'Propulsion' && p.stage === 1 && Math.abs(p.x) < 1.0) {
        return {
          ...p,
          partId: 'engine_titan',
        };
      }
      return p;
    });

    onApplyParts(updated);
    soundEngine.playRotateClickSound();
  };

  const handleInsertVacuumUpperStage = () => {
    // Decompose current rocket into stages, ensure Upper Stage is inserted, then re-assemble
    const extracted = extractStagesFromRocket(currentParts);
    const upperTemplate = DEFAULT_STAGE_TEMPLATES.UPPER_STAGE;

    const newStages = extracted.map((stg) => {
      if (stg.role === 'UPPER_STAGE' && stg.parts.length === 0) {
        return { ...upperTemplate };
      }
      return stg;
    });

    const assembled = assembleStagesToRocket(newStages);
    onApplyParts(assembled);
    soundEngine.playStageSound();
  };

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-4 py-3 z-20 space-y-3">
      {/* Top Banner: Hybrid Mode Overview */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Add & Upgrade Mode</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-900/60 text-amber-300 border border-amber-700/50">
                Hybrid Stage + Freeform
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Upgrade core diameter, attach strap-on boosters, or swap stages while preserving your custom build
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onLaunch}
          className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition flex items-center gap-1.5 cursor-pointer"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Launch Upgraded Rocket</span>
        </button>
      </div>

      {/* Upgrade Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Strap-On Boosters */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-sky-500/50 transition flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-1.5 text-amber-400">
                <Zap className="w-3.5 h-3.5" />
                <span>Strap-On Boosters</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">+400 kN Thrust</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Attaches aerodynamic twin liquid boosters with side separators for maximum liftoff thrust.
            </p>
          </div>
          <button
            onClick={handleAddTwinBoosters}
            className="w-full py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add / Replace Twin Boosters</span>
          </button>
        </div>

        {/* Card 2: Upgrade Core Diameter & Engine */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 transition flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-1.5 text-sky-400">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Heavy Core Upgrade</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">3.0m Core Tank</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Expands core tanks to 3.0m diameter and equips high-thrust Titan heavy engine.
            </p>
          </div>
          <button
            onClick={handleUpgradeCoreDiameter}
            className="w-full py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Expand Core to 3.0m</span>
          </button>
        </div>

        {/* Card 3: Upper Stage Vacuum Engine */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 transition flex flex-col justify-between space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Rocket className="w-3.5 h-3.5" />
                <span>Vacuum Upper Stage</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">+1,850 m/s Δv</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Equips high-Isp Frontier vacuum engine and RCS control package for orbital maneuvers.
            </p>
          </div>
          <button
            onClick={handleInsertVacuumUpperStage}
            className="w-full py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Insert Vacuum Upper Stage</span>
          </button>
        </div>
      </div>
    </div>
  );
};
