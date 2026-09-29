import React, { useState } from 'react';
import { PlacedPart, StageAssembly, StageRole } from '../../types';
import {
  DEFAULT_STAGE_TEMPLATES,
  assembleStagesToRocket,
  calculateIsolatedStageMetrics,
} from '../../data/stageAssemblies';
import {
  Layers,
  Rocket,
  Plus,
  Play,
  Check,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Zap,
  ArrowDown,
  Box,
  SlidersHorizontal,
} from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';

interface StageWiseManagerProps {
  stages?: StageAssembly[];
  stageAssemblies?: StageAssembly[];
  activeStageId?: string;
  onSelectStage: (stageId: string) => void;
  onUpdateStages: (newStages: StageAssembly[]) => void;
  onAssembleToEntire?: (assembledParts: PlacedPart[]) => void;
  onAssembleToRocket?: (assembledParts: PlacedPart[]) => void;
  onDirectLaunch?: (assembledParts: PlacedPart[]) => void;
  onLaunch?: (rocket: any) => void;
  onDecomposeCurrentRocket?: () => void;
  onAddBoosterToRocket?: (boosterStage: StageAssembly, mode: 'twin' | 'left' | 'right') => void;
  onStackStageToRocket?: (stage: StageAssembly, position?: 'top' | 'bottom') => void;
  onReturnToRocketBuilder?: () => void;
  onAddNewStructure?: () => void;
}

export const StageWiseManager: React.FC<StageWiseManagerProps> = ({
  stages: stagesProp,
  stageAssemblies: stageAssembliesProp,
  activeStageId,
  onSelectStage,
  onUpdateStages,
  onAssembleToEntire,
  onAssembleToRocket,
  onDirectLaunch,
  onLaunch,
  onDecomposeCurrentRocket,
  onAddBoosterToRocket,
  onStackStageToRocket,
  onReturnToRocketBuilder,
  onAddNewStructure,
}) => {
  const stages = stagesProp || stageAssembliesProp || Object.values(DEFAULT_STAGE_TEMPLATES);
  const [showAssemblyModal, setShowAssemblyModal] = useState(false);
  const [attachmentStep, setAttachmentStep] = useState<number>(0);

  const activeStage = (stages && stages.length > 0)
    ? (stages.find((s) => s && s.id === activeStageId) || stages[0])
    : DEFAULT_STAGE_TEMPLATES.FIRST_STAGE;

  // Calculate isolated metrics for each stage
  const stageStats = (stages || []).map((stg) => ({
    stage: stg,
    metrics: calculateIsolatedStageMetrics(stg),
  }));

  // Handle step-by-step assembly
  const handleOpenAssembly = () => {
    setAttachmentStep(0);
    setShowAssemblyModal(true);
    soundEngine.playRotateClickSound();
  };

  const handleStepAttach = () => {
    if (attachmentStep < (stages?.length || 0)) {
      setAttachmentStep((prev) => prev + 1);
      soundEngine.playLegoSnapSound();
    }
  };

  const handleResetStage = (role: StageRole) => {
    const template = DEFAULT_STAGE_TEMPLATES[role];
    if (!template) return;
    const updated = (stages || []).map((s) => (s && s.id === activeStageId ? { ...template, id: s.id } : s));
    onUpdateStages(updated);
    soundEngine.playRotateClickSound();
  };

  const handleAssembleAndEdit = () => {
    const assembled = assembleStagesToRocket(stages || []);
    if (onAssembleToEntire) {
      onAssembleToEntire(assembled);
    } else if (onAssembleToRocket) {
      onAssembleToRocket(assembled);
    }
    setShowAssemblyModal(false);
    soundEngine.playStageSound();
  };

  const handleAssembleAndLaunch = () => {
    const assembled = assembleStagesToRocket(stages || []);
    if (onDirectLaunch) {
      onDirectLaunch(assembled);
    } else if (onLaunch) {
      onLaunch(assembled);
    }
    setShowAssemblyModal(false);
  };

  // Preview parts currently attached up to attachmentStep
  const attachedStagesForPreview = (stages || []).slice(0, attachmentStep === 0 ? (stages?.length || 0) : attachmentStep);
  const previewRocketParts = assembleStagesToRocket(attachedStagesForPreview);

  return (
    <div className="flex flex-col bg-slate-900/95 border-b border-slate-800 backdrop-blur-md px-4 py-2.5 z-20 shadow-md">
      {/* Top Banner: Structure Workshop Navigation & Purpose */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Stage/Structure Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-400 mr-1 shrink-0">
            <Layers className="w-4 h-4" />
            <span className="font-mono uppercase tracking-wider text-[11px]">Structure Workshop:</span>
          </div>

          {stages.map((stg, idx) => {
            const isSelected = stg.id === activeStageId;
            const stats = stageStats.find((s) => s.stage.id === stg.id)?.metrics;
            const roleLabels: Record<StageRole, string> = {
              PAYLOAD: '🛰️ Payload Capsule',
              UPPER_STAGE: '🌌 2nd Stage Upper',
              FIRST_STAGE: '🔥 1st Stage Core',
              BOOSTER: '⚡ Strap-On Boosters',
              CUSTOM: '⚙️ Custom Subassembly',
            };

            return (
              <button
                key={stg.id}
                onClick={() => {
                  onSelectStage(stg.id);
                  soundEngine.playRotateClickSound();
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-2 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-950/50 ring-1 ring-sky-300'
                    : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span>{roleLabels[stg.role] || stg.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isSelected ? 'bg-sky-700/80 text-sky-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {stg.parts.length}p {stats ? `(${stats.wetMass.toFixed(1)}t)` : ''}
                </span>
              </button>
            );
          })}

          {/* New Structure Creation Button */}
          {onAddNewStructure && (
            <button
              onClick={onAddNewStructure}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-sky-400 hover:text-sky-300 border border-slate-700/80 text-xs font-bold flex items-center gap-1 shrink-0 transition cursor-pointer"
              title="Create a new custom structure subassembly"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Structure</span>
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => handleResetStage(activeStage.role)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            title="Reset this structure to aerospace template"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Reset</span>
          </button>

          {/* Direct "Use in Rocket" actions based on whether active structure is a Booster or Vertical Stage */}
          {activeStage.role === 'BOOSTER' ? (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 p-0.5 rounded-xl">
              <button
                onClick={() => onAddBoosterToRocket?.(activeStage, 'twin')}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="Add this booster structure as twin radial boosters with side separators onto your rocket"
              >
                <Zap className="w-3.5 h-3.5 fill-white" />
                <span>Add Twin Boosters (2x)</span>
              </button>
              <button
                onClick={() => onAddBoosterToRocket?.(activeStage, 'left')}
                className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
                title="Add single booster to left side"
              >
                Left
              </button>
              <button
                onClick={() => onAddBoosterToRocket?.(activeStage, 'right')}
                className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
                title="Add single booster to right side"
              >
                Right
              </button>
            </div>
          ) : (
            <button
              onClick={() => onStackStageToRocket?.(activeStage, activeStage.role === 'PAYLOAD' ? 'top' : 'bottom')}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
              title="Insert / stack this structure into your rocket vehicle"
            >
              <Box className="w-3.5 h-3.5" />
              <span>Stack Structure into Rocket</span>
            </button>
          )}

          <button
            onClick={handleOpenAssembly}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md border border-emerald-400/40 transition flex items-center gap-1.5 cursor-pointer"
            title="Assemble all structures (Core, Upper, Payload, Boosters) into a complete rocket"
          >
            <Rocket className="w-4 h-4 text-emerald-100" />
            <span>Assemble All</span>
          </button>

          {onReturnToRocketBuilder && (
            <button
              onClick={onReturnToRocketBuilder}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Return to main Rocket Assembly canvas"
            >
              <span>← Rocket Canvas</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Stage Quick Info Pill & Instructions */}
      <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="text-sky-300 font-bold">Building Structure:</span>
          <span className="text-white font-semibold">{activeStage.name}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300">{activeStage.parts.length} parts on workbench</span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400/90 italic hidden sm:inline">
            Build parts into structures here, then use the structure as a building block in your rocket!
          </span>
        </div>

        {(() => {
          const m = calculateIsolatedStageMetrics(activeStage);
          return (
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span>
                Wet Mass: <strong className="text-white">{m.wetMass.toFixed(1)}t</strong>
              </span>
              <span>
                Thrust: <strong className="text-sky-400">{m.thrust}kN</strong>
              </span>
              <span>
                TWR: <strong className={m.twr >= 1.0 ? 'text-emerald-400' : 'text-amber-400'}>{m.twr.toFixed(2)}</strong>
              </span>
              <span>
                Est. Δv: <strong className="text-teal-300">{m.deltaV} m/s</strong>
              </span>
            </div>
          );
        })()}
      </div>

      {/* STAGE ATTACHMENT & STACKING PIPELINE MODAL */}
      {showAssemblyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Stage-Wise Assembly Pipeline</h3>
                  <p className="text-xs text-slate-400">
                    Attach stages one by one into an integrated flight-ready launch vehicle
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAssemblyModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Two Columns */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Stacking Sequence & Stages List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>Assembly Sequence (Top to Bottom)</span>
                  </span>
                  <span className="text-xs font-mono text-sky-400 font-bold">
                    {stages.length} Stages Configured
                  </span>
                </div>

                <div className="space-y-2.5">
                  {stages.map((stg, idx) => {
                    const stats = calculateIsolatedStageMetrics(stg);
                    const isAttached = attachmentStep === 0 || idx < attachmentStep;

                    return (
                      <div
                        key={stg.id}
                        className={`p-3 rounded-xl border transition flex flex-col gap-2 ${
                          isAttached
                            ? 'bg-slate-950/80 border-sky-500/40 shadow-sm'
                            : 'bg-slate-950/30 border-slate-800/80 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isAttached ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-white">{stg.name}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isAttached ? (
                              <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">
                                <Check className="w-3 h-3" /> Attached
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500">Pending</span>
                            )}
                          </div>
                        </div>

                        {/* Stage Details */}
                        <div className="grid grid-cols-4 gap-1 text-[10px] font-mono text-slate-400 bg-slate-900/60 p-2 rounded-lg">
                          <div>
                            <span className="text-slate-500 block">Parts:</span>
                            <span className="text-slate-200 font-bold">{stg.parts.length}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Mass:</span>
                            <span className="text-slate-200 font-bold">{stats.wetMass.toFixed(1)}t</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Thrust:</span>
                            <span className="text-sky-400 font-bold">{stats.thrust}kN</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Δv:</span>
                            <span className="text-teal-300 font-bold">{stats.deltaV}m/s</span>
                          </div>
                        </div>

                        {/* Interstage Decoupler Notice */}
                        {idx < stages.length - 1 && stg.role !== 'BOOSTER' && (
                          <div className="flex items-center justify-center gap-1 text-[10px] text-slate-500 italic py-0.5">
                            <ArrowDown className="w-3 h-3 text-slate-600" />
                            <span>Interstage decoupler automatically inserted</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Step-by-Step Attachment Controls */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Step-by-Step Stacking:</span>
                  <button
                    onClick={handleStepAttach}
                    disabled={attachmentStep >= stages.length && attachmentStep !== 0}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {attachmentStep === 0
                        ? 'Replay Stacking 1-by-1'
                        : attachmentStep >= stages.length
                        ? 'All Stages Attached'
                        : `Attach Stage ${attachmentStep + 1}`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Column: Complete Rocket Preview & Stacking Metrics */}
              <div className="flex flex-col space-y-4">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Integrated Launch Vehicle Overview</span>
                </span>

                {/* Visual Preview Box */}
                <div className="flex-1 min-h-[260px] bg-slate-950 rounded-2xl border border-slate-800/80 p-4 flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-3 left-3 text-[10px] font-mono text-slate-500">
                    Active Parts: {previewRocketParts.length}
                  </div>

                  {/* Rocket Blueprint Graphic Stack */}
                  <div className="flex flex-col items-center justify-center space-y-1 my-auto">
                    {attachedStagesForPreview.map((stg, i) => (
                      <div
                        key={stg.id}
                        className={`px-4 py-2 rounded-lg text-xs font-mono font-bold text-center border transition-all ${
                          stg.role === 'PAYLOAD'
                            ? 'bg-sky-950/60 text-sky-200 border-sky-500/60 min-w-[120px]'
                            : stg.role === 'UPPER_STAGE'
                            ? 'bg-indigo-950/60 text-indigo-200 border-indigo-500/60 min-w-[140px]'
                            : stg.role === 'FIRST_STAGE'
                            ? 'bg-amber-950/60 text-amber-200 border-amber-500/60 min-w-[160px]'
                            : 'bg-emerald-950/60 text-emerald-200 border-emerald-500/60 min-w-[150px]'
                        }`}
                      >
                        {stg.name} ({stg.parts.length} parts)
                      </div>
                    ))}
                  </div>

                  <div className="absolute bottom-3 right-3 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ready for Launchpad
                  </div>
                </div>

                {/* Unified Rocket Performance Banner */}
                <div className="p-3.5 rounded-xl bg-sky-950/30 border border-sky-800/40 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Total Parts:</span>
                    <strong className="text-white font-mono text-sm">{previewRocketParts.length}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Total Wet Mass:</span>
                    <strong className="text-sky-300 font-mono text-sm">
                      {stageStats.reduce((sum, s) => sum + (s.metrics?.wetMass || 0), 0).toFixed(1)}t
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Total Est. Δv:</span>
                    <strong className="text-teal-300 font-mono text-sm">
                      {stageStats.reduce((sum, s) => sum + (s.metrics?.deltaV || 0), 0)} m/s
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setShowAssemblyModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Back to Stage Bench
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleAssembleAndEdit}
                  className="px-4 py-2 rounded-xl bg-sky-900/60 hover:bg-sky-800/80 text-sky-200 border border-sky-600/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Transfer assembled rocket to freeform canvas"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Open in Full Builder</span>
                </button>

                <button
                  onClick={handleAssembleAndLaunch}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 border border-emerald-400 transition flex items-center gap-2 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Launch Assembled Rocket</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
