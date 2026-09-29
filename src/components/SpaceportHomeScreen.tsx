import React, { useState } from 'react';
import {
  Rocket,
  Building2,
  Users,
  Play,
  Flame,
  CheckCircle,
  ShieldCheck,
  ChevronRight,
  X,
  Save,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PlacedPart, Astronaut, GameMode } from '../types';
import { PART_CATALOG } from '../data/parts';
import { loadAstronautRoster, saveAstronautRoster, recruitNewAstronaut } from '../data/astronauts';
import { soundEngine } from '../audio/soundEngine';

interface SpaceportHomeScreenProps {
  onNavigate: (mode: GameMode) => void;
  rocketParts: PlacedPart[];
  onLaunch?: () => void;
  onStartRollout?: () => void;
  economyBalance?: number;
  oreStockpile?: { raw_ore: number; refined_ore: number; ingot: number };
  onSmeltIngots?: (amountKg: number) => void;
  onSellResource?: (type: 'raw_ore' | 'refined_ore' | 'ingot', amountKg: number) => void;
  onOpenMiniGame?: (type: 'DOCKING' | 'ROVER_MINING' | 'SOLAR_ALIGN') => void;
  onOpenSaveModal?: () => void;
  onOpenTutorial?: () => void;
}

export const SpaceportHomeScreen: React.FC<SpaceportHomeScreenProps> = ({
  onNavigate,
  rocketParts,
  onLaunch,
  onStartRollout,
  onOpenSaveModal,
  onOpenTutorial,
}) => {
  const [activeModal, setActiveModal] = useState<'NONE' | 'HQ'>('NONE');
  const [astronauts, setAstronauts] = useState<Astronaut[]>(() => loadAstronautRoster());
  const [newAstroName, setNewAstroName] = useState('');
  const [newAstroRole, setNewAstroRole] = useState<Astronaut['role']>('Pilot');
  const [hqTab, setHqTab] = useState<'ROSTER' | 'TRAINING'>('ROSTER');

  const hasRocket = rocketParts && rocketParts.length > 0;
  const assignedAstronauts = astronauts.filter((a) => a.status === 'assigned');

  const handleRecruit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAstroName.trim()) return;
    recruitNewAstronaut(newAstroName.trim(), newAstroRole);
    setAstronauts(loadAstronautRoster());
    setNewAstroName('');
    soundEngine.playLegoAttachSound();
  };

  const handleToggleAssign = (id: string) => {
    const updated = astronauts.map((a) => {
      if (a.id === id) {
        const nextStatus = a.status === 'assigned' ? 'ready' : 'assigned';
        return { ...a, status: nextStatus as Astronaut['status'] };
      }
      return a;
    });
    setAstronauts(updated);
    saveAstronautRoster(updated);
    soundEngine.playLegoSnapSound();
  };

  return (
    <div className="relative w-full h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none font-sans">
      {/* ATMOSPHERIC BACKGROUND: Minimalist Starlight & Horizon */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-hidden pointer-events-none">
        {/* Subtle Starlight */}
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:32px_32px]" />

        {/* Minimal Horizon */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-900/80 via-sky-950/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-slate-900/90 border-t border-slate-800/80" />

        {/* Crawlerway track */}
        <div className="absolute bottom-8 left-[18%] right-[18%] h-10 bg-slate-800/70 border-y border-slate-700/50 rounded-sm" />
        <div className="absolute bottom-12 left-[18%] right-[18%] h-px border-t border-dashed border-sky-500/30" />

        {/* Minimalist Animated Astrovan */}
        <motion.div
          animate={{ x: [-8, 8, -8] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
          onClick={() => setActiveModal('HQ')}
          className="absolute bottom-11 left-[47%] z-10 flex items-center gap-3 cursor-pointer group pointer-events-auto"
          title="Astronet Astronaut Crew • Click to manage crew"
        >
          <div className="relative w-14 h-6 bg-slate-200 hover:bg-white rounded border border-slate-400 shadow-sm flex items-center px-1 transition-colors">
            <div className="w-full h-0.5 bg-sky-500 rounded-sm" />
            <span className="absolute bottom-0.5 left-2 text-[6px] font-bold tracking-wider text-slate-700">CREW</span>
          </div>

          <div className="relative flex flex-col items-center group-hover:scale-105 transition-transform">
            <div className="w-4 h-4 rounded-full bg-slate-200 border border-slate-400 shadow-sm flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            </div>
            <div className="w-5 h-3 bg-slate-300 rounded-t border border-slate-400 -mt-0.5" />
          </div>
        </motion.div>
      </div>

      {/* MINIMALIST HEADER BAR */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-20 flex items-center justify-between px-8 py-3.5 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <img
              id="spaceport-header-logo"
              src="/icon.png"
              alt="Space Roc Icon"
              className="w-9 h-9 rounded-lg border border-sky-500/40 object-cover shadow-sm shadow-sky-500/20 bg-slate-900"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.triedFallback) {
                  target.dataset.triedFallback = 'true';
                  target.src = '/icon.PNG';
                }
              }}
            />
            <div>
              <div className="text-[10px] font-bold tracking-widest text-sky-400 uppercase">Space ROC Simulation</div>
              <div className="text-sm font-semibold tracking-tight text-white">Cape Canaveral Spaceport</div>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          <div className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>RANGE GREEN • GO FOR LAUNCH</span>
          </div>
        </div>

        {/* Minimalist Right Info */}
        <div className="flex items-center gap-3">
          {onOpenTutorial && (
            <button
              id="spaceport-help-btn"
              onClick={onOpenTutorial}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/80 hover:bg-sky-900 border border-sky-500/40 hover:border-sky-400 text-sky-200 font-bold text-xs shadow-md transition-colors cursor-pointer active:scale-95"
              title="Open Flight Operations Manual & Rocket Academy Tutorial (Press H)"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>Flight Manual (H)</span>
            </button>
          )}

          {onOpenSaveModal && (
            <button
              id="spaceport-save-btn"
              onClick={onOpenSaveModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer active:scale-95"
              title="Save & Export Game File (Auto-saves every 10 min)"
            >
              <Save className="w-3.5 h-3.5 text-emerald-100" />
              <span>Save Game</span>
            </button>
          )}

          <button
            onClick={() => setActiveModal('HQ')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              <strong className="text-white font-medium">{assignedAstronauts.length}</strong> / {astronauts.length} Crew Assigned
            </span>
          </button>
        </div>
      </motion.header>

      {/* CORE 3-PILLAR SPACEPORT GROUND SURFACE & ARCHITECTURAL BUILDINGS */}
      <main className="relative z-10 flex-1 px-4 md:px-8 py-4 flex flex-col justify-between max-w-7xl w-full mx-auto">
        {/* Minimalist Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="my-1 flex items-center justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Spaceport Surface Campus
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
              Planar ground complex with active assembly hangars, dual launch pads, crawlerway aprons, and operations control.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="text-sky-400">COORD:</span> 28.5721° N, 80.6480° W • PLANAR LEVEL 0m
          </div>
        </motion.div>

        {/* PLANAR GROUND SURFACE WITH REALISTIC ARCHITECTURAL BUILDINGS */}
        <div className="relative my-auto py-6 px-4 md:px-8 rounded-2xl bg-gradient-to-b from-slate-900/90 via-slate-900/95 to-slate-950 border border-slate-800 shadow-2xl overflow-hidden [perspective:1200px]">
          {/* Planar ground grid texture, tarmac runways, and service roads */}
          <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="absolute -bottom-10 -left-10 -right-10 h-32 bg-gradient-to-t from-slate-950 via-slate-900/50 to-transparent pointer-events-none" />
          
          {/* Planar Concrete Apron / Roadways connecting all 3 campus buildings */}
          <div className="absolute top-1/2 left-8 right-8 h-8 -translate-y-1/2 bg-slate-800/40 border-y border-dashed border-slate-700/50 pointer-events-none hidden md:block" />
          <div className="absolute top-1/2 left-1/4 -translate-x-1/2 w-48 h-1 bg-amber-500/20 pointer-events-none hidden md:block" />
          <div className="absolute top-1/2 right-1/4 -translate-x-1/2 w-48 h-1 bg-sky-500/20 pointer-events-none hidden md:block" />

          {/* Buildings placed on ground plane */}
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 items-end">
            
            {/* 1. VEHICLE ASSEMBLY BUILDING (VAB) - High-Bay Hangar Structure */}
            <motion.div
              id="campus-building-vab"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              onClick={() => onNavigate('BUILD')}
              className="group relative cursor-pointer flex flex-col justify-between bg-slate-900/95 hover:bg-slate-850 border border-slate-700 hover:border-sky-400/80 rounded-t-xl rounded-b-lg shadow-[0_15px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(56,189,248,0.1)] hover:shadow-[0_20px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(56,189,248,0.25)] transition-all duration-200 overflow-hidden"
            >
              {/* Architectural Roof & Antennas */}
              <div className="h-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                </div>
                <div className="text-[9px] font-mono text-slate-400">HIGH-BAY 1 • ROOF LVL +160m</div>
                <div className="w-4 h-1 bg-sky-500/40 rounded-full" />
              </div>

              {/* Building Facade with Corrugated Panels & High-Bay Vertical Roll-Up Door */}
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <div id="vab-facility-icon" className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 group-hover:bg-sky-500 group-hover:text-white transition-colors shadow-sm">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-medium text-sky-300 px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800/60">
                    FACILITY 01 • VAB
                  </span>
                </div>

                <div className="mt-3">
                  <h2 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors flex items-center gap-1.5">
                    Vehicle Assembly Building
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    Multi-story construction bay for structural staging, parametric fuel tanks, and payload integration.
                  </p>
                </div>

                {/* Architectural Vertical Hangar Bay Door Graphic */}
                <div className="mt-4 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-14 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-sm flex flex-col justify-between p-1 shadow-inner relative overflow-hidden">
                    <div className="w-full h-0.5 bg-slate-600" />
                    <div className="w-full h-0.5 bg-slate-600" />
                    <div className="w-full h-0.5 bg-slate-600" />
                    <div className="w-full h-0.5 bg-slate-600" />
                    <div className="absolute inset-x-0 bottom-0 h-4 bg-sky-500/20 border-t border-sky-400/40 flex items-center justify-center">
                      <Rocket className="w-2.5 h-2.5 text-sky-400" />
                    </div>
                  </div>
                  <div className="flex-1 text-[11px] space-y-1">
                    <div className="text-slate-300 font-medium flex items-center justify-between">
                      <span>Rollout Bay:</span>
                      <span className="font-mono text-sky-400">ACTIVE</span>
                    </div>
                    <div className="text-slate-400 font-mono text-[10px]">
                      {hasRocket ? `${rocketParts.length} Components Mounted` : 'No Assembly Mounted'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Building Ground Foundation Footing */}
              <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400 flex items-center gap-1.5">
                  {hasRocket ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Staged
                    </span>
                  ) : (
                    'Empty Bay'
                  )}
                </span>
                <span className="font-medium text-sky-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Enter VAB <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
              {/* Foundation concrete slab */}
              <div className="h-1.5 bg-slate-800 border-t border-slate-700/60" />
            </motion.div>

            {/* 2. LAUNCH PAD COMPLEX 39A - Elevated Launch Mount & Flame Trench */}
            <motion.div
              id="campus-building-pad"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              onClick={() => {
                if (hasRocket) {
                  if (onLaunch) onLaunch();
                  else if (onStartRollout) onStartRollout();
                  else onNavigate('FLIGHT');
                } else {
                  onNavigate('BUILD');
                }
              }}
              className="group relative cursor-pointer flex flex-col justify-between bg-slate-900/95 hover:bg-slate-850 border border-slate-700 hover:border-amber-400/80 rounded-t-xl rounded-b-lg shadow-[0_15px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(245,158,11,0.1)] hover:shadow-[0_20px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(245,158,11,0.25)] transition-all duration-200 overflow-hidden"
            >
              {/* Architectural Lightning Mast & Tower Header */}
              <div className="h-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                </div>
                <div className="text-[9px] font-mono text-slate-400">PAD 39A • SERVICE GANTRY</div>
                <div className="w-4 h-1 bg-amber-500/40 rounded-full" />
              </div>

              {/* Building Facade & Flame Deflector Structure */}
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-sm">
                    <Flame className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-medium text-amber-300 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-800/60">
                    FACILITY 02 • PAD 39A
                  </span>
                </div>

                <div className="mt-3">
                  <h2 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                    Launch Complex 39A
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    Elevated launch mount with water deluge sound suppression, cryogenic umbilical, and flame trench.
                  </p>
                </div>

                {/* Architectural Launch Mount & Strongback Graphic */}
                <div className="mt-4 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-14 bg-gradient-to-b from-amber-950/40 to-slate-900 border border-amber-800/40 rounded-sm flex flex-col justify-end p-1 shadow-inner relative overflow-hidden">
                    <div className="absolute top-1 right-1 w-1.5 h-8 border-r-2 border-amber-500/50" />
                    <div className="w-full h-3 bg-amber-500/20 rounded-sm flex items-center justify-center">
                      <Play className="w-2.5 h-2.5 text-amber-400 fill-current" />
                    </div>
                  </div>
                  <div className="flex-1 text-[11px] space-y-1">
                    <div className="text-slate-300 font-medium flex items-center justify-between">
                      <span>Mount Status:</span>
                      <span className="font-mono text-amber-400">{hasRocket ? 'PRESSURIZED' : 'STANDBY'}</span>
                    </div>
                    <div className="text-slate-400 font-mono text-[10px]">
                      Flame Trench Clear • Cryo Safe
                    </div>
                  </div>
                </div>
              </div>

              {/* Building Ground Foundation Footing */}
              <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400 flex items-center gap-1.5">
                  {hasRocket ? (
                    <span className="text-amber-400 font-medium flex items-center gap-1.5">
                      <Play className="w-3 h-3 fill-current" /> Ready
                    </span>
                  ) : (
                    'Awaiting Rollout'
                  )}
                </span>
                <span className="font-medium text-amber-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  {hasRocket ? 'Launch Craft' : 'Stage Vehicle'} <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
              {/* Foundation concrete slab */}
              <div className="h-1.5 bg-slate-800 border-t border-slate-700/60" />
            </motion.div>

            {/* 3. ASTRONET HQ & CREW MANAGEMENT - Modern Radar & Operations Dome */}
            <motion.div
              id="campus-building-hq"
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              onClick={() => setActiveModal('HQ')}
              className="group relative cursor-pointer flex flex-col justify-between bg-slate-900/95 hover:bg-slate-850 border border-slate-700 hover:border-indigo-400/80 rounded-t-xl rounded-b-lg shadow-[0_15px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(99,102,241,0.1)] hover:shadow-[0_20px_35px_rgba(0,0,0,0.8),0_0_25px_rgba(99,102,241,0.25)] transition-all duration-200 overflow-hidden"
            >
              {/* Architectural Communications Radome & Dish Header */}
              <div className="h-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                </div>
                <div className="text-[9px] font-mono text-slate-400">CREW HQ • RADOME LEVEL</div>
                <div className="w-4 h-1 bg-indigo-500/40 rounded-full" />
              </div>

              {/* Building Facade & Mission Operations Center */}
              <div className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors shadow-sm">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-medium text-indigo-300 px-2 py-0.5 rounded bg-indigo-950/70 border border-indigo-800/60">
                    FACILITY 03 • HQ
                  </span>
                </div>

                <div className="mt-3">
                  <h2 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                    Astronaut Crew Corps
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    Personnel training suites, mission control telemetry stations, suit checkout, and flight crew assignments.
                  </p>
                </div>

                {/* Architectural Control Room & Bio-Monitor Graphic */}
                <div className="mt-4 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-3">
                  <div className="w-9 h-14 bg-gradient-to-b from-indigo-950/40 to-slate-900 border border-indigo-800/40 rounded-sm flex flex-col justify-between p-1 shadow-inner relative overflow-hidden">
                    <div className="w-full h-1 bg-indigo-400/40 rounded-full" />
                    <div className="flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div className="w-full h-1 bg-indigo-400/40 rounded-full" />
                  </div>
                  <div className="flex-1 text-[11px] space-y-1">
                    <div className="text-slate-300 font-medium flex items-center justify-between">
                      <span>Crew Readiness:</span>
                      <span className="font-mono text-indigo-400">{assignedAstronauts.length}/{astronauts.length} FLIGHT READY</span>
                    </div>
                    <div className="text-slate-400 font-mono text-[10px]">
                      Biometrics Nominal • Comms Online
                    </div>
                  </div>
                </div>
              </div>

              {/* Building Ground Foundation Footing */}
              <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400">
                  {assignedAstronauts.length} Assigned
                </span>
                <span className="font-medium text-indigo-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Roster & HQ <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
              {/* Foundation concrete slab */}
              <div className="h-1.5 bg-slate-800 border-t border-slate-700/60" />
            </motion.div>

          </div>
        </div>

        {/* MINIMALIST BOTTOM ACTION DOCK */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex items-center justify-between p-4 bg-slate-950/70 backdrop-blur-md rounded-xl border border-slate-800/80"
        >
          <div className="text-xs text-slate-400">
            {hasRocket ? (
              <span>
                Vehicle staged with <strong className="text-white font-medium">{rocketParts.length}</strong> components ready for launch.
              </span>
            ) : (
              <span>No active launch vehicle staged. Open VAB to build.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              id="quick-enter-vab-btn"
              onClick={() => onNavigate('BUILD')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg font-medium text-xs border border-slate-700/60 transition-colors cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              Enter VAB Builder
            </button>

            <button
              id="quick-launch-btn"
              onClick={() => {
                if (hasRocket) {
                  if (onLaunch) onLaunch();
                  else if (onStartRollout) onStartRollout();
                  else onNavigate('FLIGHT');
                } else {
                  onNavigate('BUILD');
                }
              }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-xs transition-all shadow-sm ${
                hasRocket
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 cursor-pointer'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {hasRocket ? 'Launch to Flight' : 'Design Rocket'}
            </button>
          </div>
        </motion.div>
      </main>

      {/* MODAL: ASTRONET HQ (ROSTER & RECRUITMENT) */}
      <AnimatePresence>
        {activeModal === 'HQ' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-6 flex flex-col max-h-[85vh] overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Astronet Astronaut Corps</h2>
                    <p className="text-xs text-slate-400">
                      Assign flight crew to command modules before pad rollout.
                    </p>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setHqTab('ROSTER')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      hqTab === 'ROSTER'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Roster ({assignedAstronauts.length}/{astronauts.length})
                  </button>
                  <button
                    onClick={() => setHqTab('TRAINING')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                      hqTab === 'TRAINING'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    EVA Sim
                  </button>
                </div>

                <button
                  onClick={() => setActiveModal('NONE')}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* TAB 1: Roster List */}
              {hqTab === 'ROSTER' && (
                <>
                  <div className="flex-1 overflow-y-auto py-4 space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {astronauts.map((astro) => (
                        <div
                          key={astro.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            astro.status === 'assigned'
                              ? 'bg-indigo-950/20 border-indigo-500/40'
                              : 'bg-slate-950/60 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shadow-sm"
                              style={{ backgroundColor: astro.suitColor || '#38bdf8' }}
                            >
                              {astro.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-xs text-white">{astro.name}</div>
                              <div className="text-[11px] text-slate-400">
                                <span className="text-indigo-400 font-medium">{astro.role}</span> • {astro.missionsFlown} flights
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleToggleAssign(astro.id)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                              astro.status === 'assigned'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                            }`}
                          >
                            {astro.status === 'assigned' ? 'Assigned' : 'Assign'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recruit Form */}
                  <form onSubmit={handleRecruit} className="pt-3 border-t border-slate-800 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Candidate Astronaut Name..."
                      value={newAstroName}
                      onChange={(e) => setNewAstroName(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    <select
                      value={newAstroRole}
                      onChange={(e) => setNewAstroRole(e.target.value as Astronaut['role'])}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="Commander">Commander</option>
                      <option value="Pilot">Pilot</option>
                      <option value="Engineer">Flight Engineer</option>
                      <option value="Scientist">Specialist</option>
                    </select>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Recruit
                    </button>
                  </form>
                </>
              )}

              {/* TAB 2: LIVE EVA SIMULATOR */}
              {hqTab === 'TRAINING' && (
                <div className="flex-1 overflow-hidden py-4 flex flex-col justify-between">
                  <div className="relative h-56 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex flex-col justify-between p-4 shadow-inner">
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]" />
                    <div className="absolute -bottom-20 -left-10 -right-10 h-36 rounded-[100%] bg-gradient-to-t from-sky-600/30 to-transparent blur-sm pointer-events-none" />

                    <div className="relative z-10 flex items-center justify-between text-[11px] font-mono">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>ORBITAL EVA SIMULATOR</span>
                      </div>
                      <span className="text-slate-400">O2: 99.8% • 4.3 PSI</span>
                    </div>

                    <div className="relative z-10 my-auto flex items-center justify-center">
                      <motion.div
                        animate={{ y: [-4, 4, -4] }}
                        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                        className="flex flex-col items-center"
                      >
                        <div className="w-12 h-12 rounded-full bg-white border border-slate-300 shadow-lg flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-amber-200 border border-amber-400" />
                        </div>
                        <div className="w-14 h-10 bg-slate-100 rounded-lg border border-slate-300 shadow-sm flex items-center justify-center mt-[-2px]">
                          <span className="text-[8px] font-mono text-slate-700 font-bold">
                            {assignedAstronauts[0]?.name || 'Neil Vance'}
                          </span>
                        </div>
                      </motion.div>
                    </div>

                    <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>HR: 72 BPM</span>
                      <span>RCS: 98%</span>
                      <span className="text-emerald-400 font-medium">OPTIMAL</span>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => setHqTab('ROSTER')}
                      className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
                    >
                      Back to Roster
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
