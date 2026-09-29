import React, { useState, useEffect, useMemo } from 'react';
import {
  StationState,
  StationPlacedModule,
  StationOverlayView,
} from '../types';
import { STATION_MODULE_CATALOG, INITIAL_STATION_STATE } from '../data/stationModules';
import {
  Activity,
  AlertTriangle,
  Battery,
  Box,
  CheckCircle,
  Cpu,
  Droplets,
  Flame,
  Gauge,
  HeartPulse,
  Layers,
  Orbit,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Shield,
  Sun,
  Thermometer,
  Trash2,
  Wrench,
  Zap,
  Building2,
} from 'lucide-react';

interface StationManagerProps {
  onBackToBuilder: () => void;
  onLaunchRocket: () => void;
  onReturnToSpaceport?: () => void;
}

const GRID_COLS = 5;
const GRID_ROWS = 5;

export const StationManager: React.FC<StationManagerProps> = ({
  onBackToBuilder,
  onLaunchRocket,
  onReturnToSpaceport,
}) => {
  const [stationState, setStationState] = useState<StationState>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('space_agency_station_state') : null;
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Safe fallback if localStorage is blocked by sandboxed iframe
    }
    return INITIAL_STATION_STATE;
  });

  const [selectedModuleUid, setSelectedModuleUid] = useState<string | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>('solar_array');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [reboostActive, setReboostActive] = useState<boolean>(false);
  const [eventLog, setEventLog] = useState<{ id: string; time: string; text: string; type: 'info' | 'warn' | 'success' }[]>([
    { id: '1', time: 'T+00:00', text: 'Telemetry linked to Gateway Station at 420 km LEO.', type: 'info' },
    { id: '2', time: 'T+00:01', text: 'Thermal rejection loop synchronized: Radiator 60 kW active.', type: 'success' },
  ]);

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem('space_agency_station_state', JSON.stringify(stationState));
    } catch {
      // Safe fallback if localStorage is unavailable
    }
  }, [stationState]);

  // Main simulation loop (Power, Thermal, Atmosphere, Day/Night, Orbit decay)
  useEffect(() => {
    if (simSpeed === 0) return;

    const interval = setInterval(() => {
      setStationState((prev) => {
        const dt = (1 / 10) * simSpeed; // 100ms tick scaled by simSpeed

        // 1. Calculate active module totals
        let totalPowerDemand = 0;
        let totalSolarPotential = 0;
        let totalHeatGen = 0;
        let totalHeatDissipation = 0;
        let netO2Gen = 0;
        let netWaterUse = 0;
        let researchGain = 0;
        let totalHabCrewCap = 0;
        let torqueStress = 0;

        prev.modules.forEach((m) => {
          if (!m.active || m.damaged) return;
          const def = STATION_MODULE_CATALOG[m.moduleId];
          if (!def) return;

          // Power
          if (def.powerDrawKw < 0) {
            totalSolarPotential += Math.abs(def.powerDrawKw);
          } else {
            totalPowerDemand += def.powerDrawKw;
          }

          // Thermal
          if (def.thermalDissipationKw < 0) {
            totalHeatGen += Math.abs(def.thermalDissipationKw);
          } else {
            totalHeatDissipation += def.thermalDissipationKw;
          }

          // Life Support
          netO2Gen += (def.o2GenerationKgHr / 3600) * dt;
          netWaterUse += (def.waterConsumptionLhr / 3600) * dt;
          researchGain += def.researchPointsSec * dt;
          totalHabCrewCap += def.crewCapacity;

          if (def.id === 'centrifuge') {
            torqueStress += 8;
          }
        });

        // 2. Day/Night Cycle & Solar Output
        let newTimer = prev.eclipseTimer - dt;
        let newPhase = prev.dayNightPhase;
        if (newTimer <= 0) {
          if (prev.dayNightPhase === 'sun') {
            newPhase = 'eclipse';
            newTimer = 180; // 3 min night
          } else {
            newPhase = 'sun';
            newTimer = 270; // 4.5 min sun
          }
        }

        const effectiveSolarKw = newPhase === 'sun' ? totalSolarPotential : 0;
        const netPower = effectiveSolarKw - totalPowerDemand;

        // 3. Battery charge / discharge
        let newBattery = prev.batteryChargeKwh + (netPower * dt) / 3600;
        let unpowered = false;
        if (newBattery > prev.batteryMaxKwh) newBattery = prev.batteryMaxKwh;
        if (newBattery < 0) {
          newBattery = 0;
          unpowered = true;
        }

        // 4. Thermal balance
        const netThermalLoad = totalHeatGen - totalHeatDissipation;
        const updatedModules = prev.modules.map((m) => {
          let tState: StationPlacedModule['tempState'] = 'optimal';
          if (netThermalLoad > 25) tState = 'critical';
          else if (netThermalLoad > 10) tState = 'hot';
          else if (netThermalLoad < -40) tState = 'cold';

          let sState: StationPlacedModule['stressState'] = 'nominal';
          if (m.moduleId === 'centrifuge' || torqueStress > 20) {
            sState = 'warning';
          }
          if (prev.structuralIntegrityPercent < 50) {
            sState = 'critical';
          }

          return {
            ...m,
            unpowered,
            tempState: tState,
            stressState: sState,
          };
        });

        // 5. Orbit decay & Reboost
        let newAlt = prev.orbitAltitudeKm - 0.0004 * dt;
        let newMonoprop = prev.monopropellantL;
        if (reboostActive && newMonoprop > 0.5) {
          newAlt += 0.08 * dt;
          newMonoprop -= 1.2 * dt;
        }

        return {
          ...prev,
          dayNightPhase: newPhase,
          eclipseTimer: newTimer,
          solarOutputKw: Math.round(effectiveSolarKw),
          powerLoadKw: Math.round(totalPowerDemand),
          batteryChargeKwh: Math.max(0, Math.min(prev.batteryMaxKwh, newBattery)),
          o2LevelKg: Math.max(0, prev.o2LevelKg + netO2Gen),
          potableWaterL: Math.max(0, prev.potableWaterL - netWaterUse),
          researchPoints: Math.round((prev.researchPoints + researchGain) * 10) / 10,
          orbitAltitudeKm: Math.round(newAlt * 100) / 100,
          monopropellantL: Math.max(0, Math.round(newMonoprop * 10) / 10),
          modules: updatedModules,
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [simSpeed, reboostActive]);

  // Selected module lookup
  const selectedPlacedModule = useMemo(() => {
    return (stationState?.modules || []).find((m) => m.uid === selectedModuleUid) || null;
  }, [stationState?.modules, selectedModuleUid]);

  const selectedDef = useMemo(() => {
    if (!selectedPlacedModule) return null;
    return STATION_MODULE_CATALOG[selectedPlacedModule.moduleId] || null;
  }, [selectedPlacedModule]);

  // Catalog items filtered by category
  const filteredCatalog = useMemo(() => {
    return Object.values(STATION_MODULE_CATALOG).filter(
      (m) => activeCategory === 'All' || m.category === activeCategory
    );
  }, [activeCategory]);

  // Grid cell finder
  const getModuleAt = (x: number, y: number) => {
    return (stationState?.modules || []).find((m) => m.gridX === x && m.gridY === y);
  };

  // Place module on grid
  const handleGridCellClick = (x: number, y: number) => {
    const existing = getModuleAt(x, y);
    if (existing) {
      setSelectedModuleUid(existing.uid);
      return;
    }

    if (selectedCatalogId) {
      const def = STATION_MODULE_CATALOG[selectedCatalogId];
      if (!def) return;

      const newModule: StationPlacedModule = {
        uid: `mod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        moduleId: selectedCatalogId,
        gridX: x,
        gridY: y,
        active: true,
        damaged: false,
        unpowered: false,
        tempState: 'optimal',
        pressureState: 'nominal',
        stressState: 'nominal',
      };

      setStationState((prev) => ({
        ...prev,
        modules: [...prev.modules, newModule],
      }));
      setSelectedModuleUid(newModule.uid);

      setEventLog((prev) => [
        {
          id: String(Date.now()),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          text: `Installed ${def.name} at Grid (${x}, ${y}).`,
          type: 'success',
        },
        ...prev.slice(0, 15),
      ]);
    }
  };

  // Toggle active
  const handleToggleModuleActive = (uid: string) => {
    setStationState((prev) => ({
      ...prev,
      modules: prev.modules.map((m) => (m.uid === uid ? { ...m, active: !m.active } : m)),
    }));
  };

  // Repair module with repair kits
  const handleRepairModule = (uid: string) => {
    if (stationState.repairKits <= 0) return;
    setStationState((prev) => ({
      ...prev,
      repairKits: prev.repairKits - 1,
      modules: prev.modules.map((m) => (m.uid === uid ? { ...m, damaged: false } : m)),
    }));
    setEventLog((prev) => [
      {
        id: String(Date.now()),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: `Repaired module using 1 orbital repair kit.`,
        type: 'info',
      },
      ...prev.slice(0, 15),
    ]);
  };

  // Remove module
  const handleRemoveModule = (uid: string) => {
    setStationState((prev) => ({
      ...prev,
      modules: prev.modules.filter((m) => m.uid !== uid),
    }));
    if (selectedModuleUid === uid) setSelectedModuleUid(null);
  };

  // Craft repair kit
  const handleCraftRepairKit = () => {
    setStationState((prev) => ({
      ...prev,
      repairKits: prev.repairKits + 1,
    }));
  };

  // Switch overlay
  const handleSetOverlay = (view: StationOverlayView) => {
    setStationState((prev) => ({ ...prev, activeOverlay: view }));
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090e] text-slate-100 select-none overflow-hidden font-sans">
      {/* TOP COMMAND HEADER */}
      <header className="h-14 bg-[#0d121d] border-b border-[#1f293d] flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Orbit className="w-5 h-5 animate-spin" style={{ animationDuration: '24s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
                {stationState.name}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/50">
                ORBIT STABLE
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              ALT: <span className="text-cyan-400 font-semibold">{stationState.orbitAltitudeKm.toFixed(1)} km</span> | INC: 51.6° | VEL: 7.68 km/s
            </div>
          </div>
        </div>

        {/* OVERLAY SELECTOR BUTTONS */}
        <div className="flex items-center gap-1 bg-[#131b2c] p-1 rounded-lg border border-[#1e2a42]">
          <span className="text-[11px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-slate-400" /> Overlays:
          </span>
          <button
            id="overlay-power-btn"
            onClick={() => handleSetOverlay('power')}
            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              stationState.activeOverlay === 'power'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-amber-400/80 hover:bg-[#1c273e]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Power
          </button>
          <button
            id="overlay-fuel-btn"
            onClick={() => handleSetOverlay('fuel')}
            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              stationState.activeOverlay === 'fuel'
                ? 'bg-red-500 text-white shadow-md font-bold'
                : 'text-red-400/80 hover:bg-[#1c273e]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> Propellant
          </button>
          <button
            id="overlay-pressure-btn"
            onClick={() => handleSetOverlay('pressure')}
            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              stationState.activeOverlay === 'pressure'
                ? 'bg-cyan-500 text-slate-950 shadow-md font-bold'
                : 'text-cyan-400/80 hover:bg-[#1c273e]'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" /> Atmosphere
          </button>
          <button
            id="overlay-thermal-btn"
            onClick={() => handleSetOverlay('thermal')}
            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              stationState.activeOverlay === 'thermal'
                ? 'bg-orange-500 text-white shadow-md font-bold'
                : 'text-orange-400/80 hover:bg-[#1c273e]'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" /> Thermal Loop
          </button>
          <button
            id="overlay-stress-btn"
            onClick={() => handleSetOverlay('stress')}
            className={`px-2.5 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-all ${
              stationState.activeOverlay === 'stress'
                ? 'bg-purple-500 text-white shadow-md font-bold'
                : 'text-purple-400/80 hover:bg-[#1c273e]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" /> Stress
          </button>
        </div>

        {/* CONTROLS & NAVIGATION */}
        <div className="flex items-center gap-2">
          {/* SIM SPEED */}
          <div className="flex items-center bg-[#131b2c] rounded border border-[#1e2a42] px-1 py-0.5">
            <span className="text-[10px] text-slate-400 uppercase font-mono px-1">WARP:</span>
            {[0, 1, 5, 20].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-2 py-0.5 text-xs font-mono font-bold rounded ${
                  simSpeed === spd ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {spd === 0 ? 'PAUSE' : `${spd}x`}
              </button>
            ))}
          </div>

          <button
            id="station-to-rocket-btn"
            onClick={onLaunchRocket}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
          >
            <Rocket className="w-4 h-4" /> Flight Sim
          </button>
          <button
            id="station-to-builder-btn"
            onClick={onBackToBuilder}
            className="px-3 py-1.5 rounded-lg bg-[#1f293d] hover:bg-[#2b374e] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#334155]"
          >
            <Box className="w-4 h-4" /> Rocket VAB
          </button>
          {onReturnToSpaceport && (
            <button
              id="station-to-spaceport-btn"
              onClick={onReturnToSpaceport}
              className="px-3 py-1.5 rounded-lg bg-amber-950/70 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Building2 className="w-4 h-4 text-amber-400" /> Spaceport
            </button>
          )}
        </div>
      </header>

      {/* SUB-BAR RESOURCE TELEMETRY */}
      <div className="h-10 bg-[#0b0e17] border-b border-[#1a2335] px-4 flex items-center justify-between text-xs font-mono overflow-x-auto gap-4">
        {/* POWER & SOLAR */}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400">Power:</span>
          <span className="text-amber-300 font-bold">{stationState.powerLoadKw} kW load</span>
          <span className="text-slate-500">/</span>
          <span className="text-emerald-400 font-bold">+{stationState.solarOutputKw} kW solar</span>
          <span
            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              stationState.dayNightPhase === 'sun'
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
            }`}
          >
            {stationState.dayNightPhase === 'sun' ? 'SUNLIGHT' : 'ECLIPSE'} (
            {Math.round(stationState.eclipseTimer)}s)
          </span>
        </div>

        {/* BATTERIES */}
        <div className="flex items-center gap-2">
          <Battery className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Battery:</span>
          <span className="text-slate-200 font-bold">
            {Math.round(stationState.batteryChargeKwh)} / {stationState.batteryMaxKwh} kWh
          </span>
          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.min(100, (stationState.batteryChargeKwh / stationState.batteryMaxKwh) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* O2 & LIFE SUPPORT */}
        <div className="flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">Atmosphere:</span>
          <span className="text-cyan-300 font-bold">{stationState.o2LevelKg.toFixed(1)} kg O2</span>
          <span className="text-slate-500">|</span>
          <Droplets className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-blue-300 font-bold">{Math.round(stationState.potableWaterL)} L H2O</span>

          {/* Automated Life Support Toggle */}
          <button
            onClick={() =>
              setStationState((prev) => ({
                ...prev,
                automatedLifeSupport: !prev.automatedLifeSupport,
              }))
            }
            className={`ml-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
              stationState.automatedLifeSupport
                ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                : 'bg-amber-950 text-amber-300 border-amber-700'
            }`}
            title="Toggle between Automated ECLSS computer regulation and Manual crew life support management"
          >
            {stationState.automatedLifeSupport ? 'ECLSS: AUTO' : 'ECLSS: MANUAL'}
          </button>

          {/* Life Support Bus Wiring Toggle */}
          <button
            onClick={() =>
              setStationState((prev) => ({
                ...prev,
                lifeSupportWired: !prev.lifeSupportWired,
              }))
            }
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer ${
              stationState.lifeSupportWired
                ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle inter-module life support and power utility bus conduit wiring"
          >
            {stationState.lifeSupportWired ? 'BUS: WIRED' : 'BUS: UNWIRED'}
          </button>
        </div>

        {/* ORBITAL INDUSTRIAL STOCKPILES */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="text-slate-400">Station Depot:</span>
          <span className="text-amber-400 font-bold">{stationState.oreKg || 0} kg Ore</span>
          <span className="text-slate-500">|</span>
          <span className="text-sky-300 font-bold">{stationState.ingotsKg || 0} kg Ingots</span>
        </div>

        {/* MONOPROPELLANT & THRUSTER REBOOST */}
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-red-400" />
          <span className="text-slate-400">RCS Monoprop:</span>
          <span className="text-red-300 font-bold">{stationState.monopropellantL.toFixed(1)} L</span>
          <button
            id="station-reboost-btn"
            onClick={() => setReboostActive(!reboostActive)}
            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
              reboostActive
                ? 'bg-red-600 text-white border-red-400 animate-pulse'
                : 'bg-[#1b2333] text-slate-300 border-[#2d3a52] hover:bg-[#253047]'
            }`}
          >
            {reboostActive ? 'BURNING RCS...' : 'RE-BOOST ORBIT'}
          </button>
        </div>

        {/* SCIENCE & REPAIR KITS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-violet-300">
            <Cpu className="w-4 h-4 text-violet-400" />
            <span className="font-bold">{stationState.researchPoints.toFixed(1)} RP</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-300">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="font-bold">{stationState.repairKits} Kits</span>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA (3 PANELS: LEFT CATALOG, CENTER 5x5 GRID, RIGHT MODULE TELEMETRY) */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: PAYLOAD MODULE CATALOG DECK */}
        <div className="w-80 bg-[#0d121d] border-r border-[#1a2335] flex flex-col">
          <div className="p-3 border-b border-[#1a2335]">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2 flex items-center justify-between">
              <span>Payload Bay Catalog</span>
              <span className="text-[10px] text-slate-500 font-mono">14 MODULES</span>
            </div>

            {/* CATEGORY TABS */}
            <div className="flex flex-wrap gap-1">
              {['All', 'Core', 'LifeSupport', 'Habitation', 'Utilities', 'Science'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-1 text-[11px] rounded transition-colors font-medium ${
                    activeCategory === cat
                      ? 'bg-cyan-600 text-white font-bold'
                      : 'bg-[#131b2c] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat === 'LifeSupport' ? 'Life Sup' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* MODULE LIST */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredCatalog.map((def) => {
              const isSelected = selectedCatalogId === def.id;
              return (
                <div
                  key={def.id}
                  onClick={() => setSelectedCatalogId(def.id)}
                  className={`p-2.5 rounded-lg cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-[#182338] border-cyan-500 shadow-md ring-1 ring-cyan-500/40'
                      : 'bg-[#111724] border-[#1e2a40] hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">{def.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                        def.powerDrawKw < 0
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-amber-950 text-amber-300'
                      }`}
                    >
                      {def.powerDrawKw < 0 ? `+${Math.abs(def.powerDrawKw)} kW` : `-${def.powerDrawKw} kW`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {def.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {def.category}
                    </span>
                    {def.crewCapacity > 0 && (
                      <span className="text-cyan-400 font-semibold">Crew: {def.crewCapacity}</span>
                    )}
                    {def.thermalDissipationKw > 0 && (
                      <span className="text-orange-400 font-semibold">
                        Cool: +{def.thermalDissipationKw} kW
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-[#0a0d14] border-t border-[#1a2335] text-[11px] text-slate-400 flex items-center justify-between">
            <span>Click any empty grid cell to deploy selected payload module.</span>
          </div>
        </div>

        {/* CENTER: 5x5 STATION GRID CANVAS & VISUALIZER */}
        <div className="flex-1 flex flex-col bg-[#080b12] relative overflow-hidden">
          {/* STARFIELD BACKGROUND WITH RADIAL DEPTH */}
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]" />

          {/* ACTIVE OVERLAY INDICATOR BANNER */}
          <div className="p-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400 uppercase">ACTIVE DIAGNOSTIC VIEW:</span>
              <span
                className={`text-xs font-bold font-mono px-2 py-0.5 rounded uppercase ${
                  stationState.activeOverlay === 'power'
                    ? 'bg-amber-950 text-amber-400 border border-amber-800'
                    : stationState.activeOverlay === 'fuel'
                    ? 'bg-red-950 text-red-400 border border-red-800'
                    : stationState.activeOverlay === 'pressure'
                    ? 'bg-cyan-950 text-cyan-400 border border-cyan-800'
                    : stationState.activeOverlay === 'thermal'
                    ? 'bg-orange-950 text-orange-400 border border-orange-800'
                    : 'bg-purple-950 text-purple-400 border border-purple-800'
                }`}
              >
                {stationState.activeOverlay} LAYER ACTIVE
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>STATION INTEGRITY:</span>
              <span className="text-emerald-400 font-bold">{stationState.structuralIntegrityPercent}%</span>
            </div>
          </div>

          {/* THE 5x5 GRID */}
          <div className="flex-1 flex items-center justify-center p-4 z-10">
            <div
              className={`station-grid grid grid-cols-5 gap-3 p-4 bg-[#0d121c]/90 border border-[#1e2a40] rounded-2xl shadow-2xl backdrop-blur-sm ${
                stationState.activeOverlay === 'power'
                  ? 'overlay-power'
                  : stationState.activeOverlay === 'fuel'
                  ? 'overlay-fuel'
                  : stationState.activeOverlay === 'pressure'
                  ? 'overlay-pressure'
                  : stationState.activeOverlay === 'thermal'
                  ? 'overlay-thermal'
                  : 'overlay-stress'
              }`}
            >
              {Array.from({ length: GRID_ROWS }).map((_, r) =>
                Array.from({ length: GRID_COLS }).map((_, c) => {
                  const mod = getModuleAt(c, r);
                  const isSelected = mod && mod.uid === selectedModuleUid;
                  const def = mod ? STATION_MODULE_CATALOG[mod.moduleId] : null;

                  return (
                    <div
                      key={`${c}-${r}`}
                      onClick={() => handleGridCellClick(c, r)}
                      className={`relative w-28 h-28 rounded-xl border-2 transition-all flex flex-col items-center justify-between p-2 cursor-pointer select-none group ${
                        mod
                          ? isSelected
                            ? 'border-cyan-400 bg-[#1e293b] shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400'
                            : mod.damaged
                            ? 'border-red-600 bg-red-950/40 animate-pulse'
                            : mod.unpowered
                            ? 'border-amber-700/50 bg-[#161a22]'
                            : 'border-[#2d3a52] bg-[#121824] hover:border-slate-400'
                          : 'border-dashed border-slate-800 hover:border-slate-600 hover:bg-[#0f1420]/40'
                      }`}
                    >
                      {mod && def ? (
                        <>
                          {/* MODULE HEADER STATUS & COORD */}
                          <div className="w-full flex items-center justify-between">
                            <span className="text-[9px] font-mono text-slate-500">
                              [{c},{r}]
                            </span>
                            <div className="flex items-center gap-1">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  mod.damaged
                                    ? 'bg-red-500 animate-ping'
                                    : mod.unpowered
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-400'
                                }`}
                              />
                            </div>
                          </div>

                          {/* MODULE ICON & VISUAL SYMBOL */}
                          <div className="flex flex-col items-center justify-center my-auto">
                            {def.category === 'Core' && <Cpu className="w-7 h-7 text-cyan-400" />}
                            {def.category === 'LifeSupport' && <Droplets className="w-7 h-7 text-blue-400" />}
                            {def.category === 'Habitation' && <HeartPulse className="w-7 h-7 text-rose-400" />}
                            {def.category === 'Utilities' && (
                              def.id === 'solar_array' ? (
                                <Sun className="w-7 h-7 text-amber-400" />
                              ) : def.id === 'thermal_radiator' ? (
                                <Thermometer className="w-7 h-7 text-orange-400" />
                              ) : (
                                <Battery className="w-7 h-7 text-emerald-400" />
                              )
                            )}
                            {def.category === 'Science' && <Radio className="w-7 h-7 text-violet-400" />}

                            <span className="text-[10px] font-bold text-center mt-1 line-clamp-1 text-slate-200">
                              {def.name.split(' ')[0]}
                            </span>
                          </div>

                          {/* MODULE OVERLAY VALUE BADGE */}
                          <div className="w-full text-center">
                            {stationState.activeOverlay === 'power' && (
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  def.powerDrawKw < 0 ? 'text-emerald-400' : 'text-amber-400'
                                }`}
                              >
                                {def.powerDrawKw < 0 ? `+${Math.abs(def.powerDrawKw)}kW` : `-${def.powerDrawKw}kW`}
                              </span>
                            )}
                            {stationState.activeOverlay === 'fuel' && (
                              <span className="text-[10px] font-mono font-bold text-red-400">
                                {def.fuelStorageL > 0 ? `${def.fuelStorageL}L` : '0 L'}
                              </span>
                            )}
                            {stationState.activeOverlay === 'pressure' && (
                              <span className="text-[10px] font-mono font-bold text-cyan-400">
                                101.3 kPa
                              </span>
                            )}
                            {stationState.activeOverlay === 'thermal' && (
                              <span
                                className={`text-[10px] font-mono font-bold ${
                                  def.thermalDissipationKw > 0 ? 'text-cyan-300' : 'text-orange-400'
                                }`}
                              >
                                {def.thermalDissipationKw > 0
                                  ? `-${def.thermalDissipationKw}kW`
                                  : `+${Math.abs(def.thermalDissipationKw)}kW`}
                              </span>
                            )}
                            {stationState.activeOverlay === 'stress' && (
                              <span className="text-[10px] font-mono font-bold text-purple-400">
                                {mod.stressState.toUpperCase()}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 group-hover:text-slate-400">
                          <Plus className="w-5 h-5 mb-1" />
                          <span className="text-[10px] font-mono">
                            [{c},{r}]
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* LOWER STATUS AND EVENT LOG STRIP */}
          <div className="h-28 bg-[#0a0e17] border-t border-[#1a2335] p-3 flex flex-col font-mono text-xs z-10">
            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-cyan-400" /> MISSION TELEMETRY LOG
              </span>
              <span className="text-[10px] text-slate-500">REALTIME ORBIT BUS</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 pr-2">
              {eventLog.map((log) => (
                <div key={log.id} className="text-[11px] flex items-center gap-2">
                  <span className="text-slate-500 font-semibold">{log.time}</span>
                  <span
                    className={
                      log.type === 'warn'
                        ? 'text-amber-400'
                        : log.type === 'success'
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                    }
                  >
                    {log.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: SELECTED MODULE TELEMETRY & CONTROLS */}
        <div className="w-80 bg-[#0d121d] border-l border-[#1a2335] flex flex-col p-4 overflow-y-auto">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 pb-3 border-b border-[#1a2335] flex items-center justify-between">
            <span>Module Diagnostics</span>
            <span className="text-[10px] text-cyan-400 font-mono">SPEC V2.4</span>
          </div>

          {selectedPlacedModule && selectedDef ? (
            <div className="flex-1 space-y-4 pt-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100">{selectedDef.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedPlacedModule.damaged
                        ? 'bg-red-950 text-red-400 border border-red-800'
                        : selectedPlacedModule.active
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedPlacedModule.damaged
                      ? 'DAMAGED'
                      : selectedPlacedModule.active
                      ? 'ONLINE'
                      : 'STANDBY'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {selectedDef.description}
                </p>
                <div className="text-[11px] text-cyan-400/90 mt-1.5 font-mono bg-[#141c2c] p-2 rounded border border-[#1e2a40]">
                  {selectedDef.specDetails}
                </div>
              </div>

              {/* STATS MATRIX */}
              <div className="space-y-2 bg-[#111724] p-3 rounded-lg border border-[#1e2a3d] font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Category:</span>
                  <span className="text-slate-200 font-semibold">{selectedDef.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Power Rating:</span>
                  <span
                    className={
                      selectedDef.powerDrawKw < 0 ? 'text-emerald-400 font-bold' : 'text-amber-400'
                    }
                  >
                    {selectedDef.powerDrawKw < 0
                      ? `+${Math.abs(selectedDef.powerDrawKw)} kW (Gen)`
                      : `${selectedDef.powerDrawKw} kW (Draw)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Thermal Output:</span>
                  <span
                    className={
                      selectedDef.thermalDissipationKw > 0 ? 'text-cyan-400' : 'text-orange-400'
                    }
                  >
                    {selectedDef.thermalDissipationKw > 0
                      ? `+${selectedDef.thermalDissipationKw} kW Heat Sink`
                      : `${Math.abs(selectedDef.thermalDissipationKw)} kW Heat`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Crew Capacity:</span>
                  <span className="text-slate-200">{selectedDef.crewCapacity} Astronauts</span>
                </div>
                {selectedDef.fuelStorageL > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Propellant Tank:</span>
                    <span className="text-red-400 font-bold">{selectedDef.fuelStorageL} L Hypergolic</span>
                  </div>
                )}
                {selectedDef.researchPointsSec > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Science Rate:</span>
                    <span className="text-violet-400 font-bold">
                      +{selectedDef.researchPointsSec} RP/sec
                    </span>
                  </div>
                )}
              </div>

              {/* MODULE ACTION BUTTONS */}
              <div className="space-y-2 pt-2">
                <button
                  id="toggle-module-power-btn"
                  onClick={() => handleToggleModuleActive(selectedPlacedModule.uid)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                    selectedPlacedModule.active
                      ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-600/30'
                      : 'bg-emerald-600 text-white hover:bg-emerald-500'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  {selectedPlacedModule.active ? 'POWER DOWN MODULE' : 'POWER UP MODULE'}
                </button>

                {selectedPlacedModule.damaged && (
                  <button
                    id="repair-module-btn"
                    onClick={() => handleRepairModule(selectedPlacedModule.uid)}
                    disabled={stationState.repairKits <= 0}
                    className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white flex items-center justify-center gap-2 transition-colors shadow"
                  >
                    <Wrench className="w-4 h-4" />
                    REPAIR MODULE (1 Kit)
                  </button>
                )}

                <button
                  id="remove-module-btn"
                  onClick={() => handleRemoveModule(selectedPlacedModule.uid)}
                  className="w-full py-2 px-3 rounded-lg text-xs font-bold bg-red-950/60 text-red-300 border border-red-800/60 hover:bg-red-900/60 flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> JETTISON / DECOMMISSION
                </button>
              </div>

              {/* 3D FABRICATION WORKSHOP ACTION */}
              {selectedDef.id === 'fab_workshop' && (
                <div className="p-3 rounded-lg bg-[#141a29] border border-violet-800/40 mt-4 space-y-2">
                  <div className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-violet-400" />
                    Orbital 3D Printer Active
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Sinter titanium alloy powder into station emergency repair kits.
                  </p>
                  <button
                    id="craft-kit-btn"
                    onClick={handleCraftRepairKit}
                    className="w-full py-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors shadow"
                  >
                    Fabricate 1 Repair Kit
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-slate-500">
              <Box className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs font-medium">Select any module on the station grid to inspect its real-time telemetry, power draw, and thermal loads.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
