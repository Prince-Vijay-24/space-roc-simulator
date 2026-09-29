import {
  FuelType,
  NozzleType,
  PartDefinition,
  JunoEngineConfig,
  EngineType,
  EnginePowerCycle,
  LiquidFuelType,
  SolidFuelGrain,
  NuclearFuelType,
  JunoNozzleStyle,
} from '../types';

export interface PropellantSpec {
  id: FuelType;
  name: string;
  shortName: string;
  densityTonnePerM3: number; // tonnes per cubic meter (t/m^3)
  description: string;
  baseIspVac: number; // s
  baseIspSL: number; // s
  exhaustVelocity: number; // m/s (approx c)
  characteristicVelocity: number; // m/s (c*)
  ratioOF: number; // oxidizer-to-fuel ratio
  costPerTonne: number; // Astronet credits
  flameColor: string;
  glowColor: string;
  boiloffRisk: boolean;
}

export const PROPELLANT_SPECS: Record<FuelType, PropellantSpec> = {
  kerolox: {
    id: 'kerolox',
    name: 'Kerolox (RP-1 / LOX)',
    shortName: 'RP-1/LOX',
    densityTonnePerM3: 1.025,
    description: 'High density impulse, classic gas-generator booster fuel with excellent sea-level thrust.',
    baseIspVac: 312,
    baseIspSL: 282,
    exhaustVelocity: 3060,
    characteristicVelocity: 1780,
    ratioOF: 2.56,
    costPerTonne: 1200,
    flameColor: '#f97316',
    glowColor: '#ea580c',
    boiloffRisk: false,
  },
  hydrolox: {
    id: 'hydrolox',
    name: 'Hydrolox (LH2 / LOX)',
    shortName: 'LH2/LOX',
    densityTonnePerM3: 0.355, // Very light! Needs 3x tank volume
    description: 'Extreme vacuum specific impulse (>450s), lightweight cryogenic propellant for upper stages.',
    baseIspVac: 455,
    baseIspSL: 365,
    exhaustVelocity: 4460,
    characteristicVelocity: 2420,
    ratioOF: 5.5,
    costPerTonne: 4200,
    flameColor: '#38bdf8',
    glowColor: '#0284c7',
    boiloffRisk: true,
  },
  methalox: {
    id: 'methalox',
    name: 'Methalox (LCH4 / LOX)',
    shortName: 'LCH4/LOX',
    densityTonnePerM3: 0.830,
    description: 'Modern staged combustion fuel. Clean burning, high performance, soot-free, and reusable.',
    baseIspVac: 378,
    baseIspSL: 328,
    exhaustVelocity: 3710,
    characteristicVelocity: 1860,
    ratioOF: 3.6,
    costPerTonne: 1850,
    flameColor: '#a855f7',
    glowColor: '#7c3aed',
    boiloffRisk: false,
  },
  monoprop: {
    id: 'monoprop',
    name: 'Monopropellant (Hydrazine)',
    shortName: 'N2H4',
    densityTonnePerM3: 1.010,
    description: 'Catalytic single-fluid decomposition. Instantaneous pulsed firing for RCS translation and attitude.',
    baseIspVac: 238,
    baseIspSL: 198,
    exhaustVelocity: 2330,
    characteristicVelocity: 1350,
    ratioOF: 0,
    costPerTonne: 3100,
    flameColor: '#e2e8f0',
    glowColor: '#94a3b8',
    boiloffRisk: false,
  },
  hypergolic: {
    id: 'hypergolic',
    name: 'Hypergolic (Aerozine-50 / NTO)',
    shortName: 'A-50/NTO',
    densityTonnePerM3: 1.180,
    description: 'Spontaneously ignites on contact without igniter spark. Unsurpassed deep-space and lander reliability.',
    baseIspVac: 324,
    baseIspSL: 278,
    exhaustVelocity: 3180,
    characteristicVelocity: 1740,
    ratioOF: 1.9,
    costPerTonne: 5200,
    flameColor: '#e11d48',
    glowColor: '#be123c',
    boiloffRisk: false,
  },
  solid: {
    id: 'solid',
    name: 'Solid Propellant (HTPB / APCP)',
    shortName: 'Solid APCP',
    densityTonnePerM3: 1.750,
    description: 'Ultra-dense pre-cast rubberized grain. Massive liftoff thrust, non-throttleable, cannot shutdown.',
    baseIspVac: 282,
    baseIspSL: 256,
    exhaustVelocity: 2760,
    characteristicVelocity: 1550,
    ratioOF: 0,
    costPerTonne: 750,
    flameColor: '#f59e0b',
    glowColor: '#d97706',
    boiloffRisk: false,
  },
  nuclear: {
    id: 'nuclear',
    name: 'Nuclear Thermal (NERVA H2)',
    shortName: 'NTR LH2',
    densityTonnePerM3: 0.320,
    description: 'Fission reactor heats liquid hydrogen to 2800 K. Exceptional 880s vacuum specific impulse.',
    baseIspVac: 880,
    baseIspSL: 420,
    exhaustVelocity: 8630,
    characteristicVelocity: 3800,
    ratioOF: 0,
    costPerTonne: 12500,
    flameColor: '#06b6d4',
    glowColor: '#0891b2',
    boiloffRisk: true,
  },
  ion: {
    id: 'ion',
    name: 'Xenon Electrostatic Ion',
    shortName: 'Xe Ion',
    densityTonnePerM3: 1.600,
    description: 'Electrostatic grid accelerates ionized xenon gas. Tiny thrust (0.05 kN) but staggering 3,200s Isp.',
    baseIspVac: 3200,
    baseIspSL: 10,
    exhaustVelocity: 31400,
    characteristicVelocity: 15000,
    ratioOF: 0,
    costPerTonne: 28000,
    flameColor: '#38bdf8',
    glowColor: '#06b6d4',
    boiloffRisk: false,
  },
};

export interface EngineTuningParams {
  baseThrust: number; // kN
  baseIspVac: number; // s
  baseIspSL: number; // s
  baseDryMass: number; // tonnes
  fuelType?: FuelType;
  chamberPressureBar: number; // e.g. 60 - 300 bar
  throatRadiusM: number; // e.g. 0.08 - 0.45 m
  expansionRatio: number; // e.g. 10 - 180
  nozzleType?: NozzleType;
  ambientPressureKPa?: number; // 0 (vacuum) to 101.325 (sea level)
}

export interface EnginePerformanceResult {
  thrustVac: number; // kN
  thrustSL: number; // kN
  thrustCurrent: number; // kN at ambientPressureKPa
  ispVac: number; // seconds
  ispSL: number; // seconds
  ispCurrent: number; // seconds at ambientPressureKPa
  massFlowKgS: number; // kg/s
  massFlowTonnesS: number; // tonnes/s
  throatAreaM2: number;
  exitAreaM2: number;
  exitDiameterM: number;
  exitPressureKPa: number;
  engineDryMass: number; // tonnes
  isOverexpandedAtSL: boolean; // Summerfield flow separation warning
  flowSeparationLimitKPa: number;
  thrustCoefficientVac: number;
}

/**
 * Computes transparent, real-world rocket engine physics.
 * Governed by isentropic nozzle expansion and Tsiolkovsky parameters.
 */
export function calculateEngineTuning(params: EngineTuningParams): EnginePerformanceResult {
  const {
    baseThrust,
    baseIspVac,
    baseIspSL,
    baseDryMass,
    fuelType = 'kerolox',
    chamberPressureBar = 100,
    throatRadiusM = 0.16,
    expansionRatio = 25,
    nozzleType = 'bell',
    ambientPressureKPa = 101.325,
  } = params;

  const spec = PROPELLANT_SPECS[fuelType] || PROPELLANT_SPECS.kerolox;

  // 1. Geometry: Throat and Nozzle Exit Area
  const throatAreaM2 = Math.PI * Math.pow(throatRadiusM, 2);
  const exitAreaM2 = throatAreaM2 * expansionRatio;
  const exitDiameterM = 2 * Math.sqrt(exitAreaM2 / Math.PI);

  // 2. Chamber Pressure in Pascals
  const pcPa = chamberPressureBar * 100000;

  // 3. Mass Flow Rate (dot_m = Pc * At / c*)
  const cStar = spec.characteristicVelocity;
  const massFlowKgS = Math.max(0.1, (pcPa * throatAreaM2) / cStar);
  const massFlowTonnesS = massFlowKgS / 1000;

  // 4. Nozzle Exit Pressure Pe approximation (isentropic flow gamma ~ 1.22)
  // Pe / Pc approx = (1 / expansionRatio)^1.22 * 0.95
  const pressureRatio = Math.pow(1 / Math.max(2, expansionRatio), 1.25) * 0.92;
  const exitPressurePa = pcPa * pressureRatio;
  const exitPressureKPa = exitPressurePa / 1000;

  // 5. Ideal Exhaust Velocity & Thrust Coefficients
  // Aerospikes compensate for altitude pressure by naturally adjusting expansion
  const isAerospike = nozzleType === 'aerospike' || nozzleType === 'spike';
  const effectiveExitPressurePa = isAerospike ? Math.max(exitPressurePa, ambientPressureKPa * 1000) : exitPressurePa;

  // Base vacuum exhaust velocity
  const vEffectiveVac = spec.baseIspVac * 9.80665 * (1 + 0.03 * Math.log10(chamberPressureBar / 100));

  // Vacuum Thrust: F_vac = dot_m * v_e + Pe * Ae
  const pressureThrustVac = (effectiveExitPressurePa * exitAreaM2) / 1000; // kN
  const momentumThrust = (massFlowKgS * vEffectiveVac) / 1000; // kN
  const thrustVac = Math.max(5, momentumThrust + pressureThrustVac);

  // Sea level thrust (101.325 kPa ambient)
  const pAtmSL = 101325;
  const pressureLossSL = ((pAtmSL - effectiveExitPressurePa) * exitAreaM2) / 1000; // kN loss
  const thrustSL = Math.max(1, thrustVac - (isAerospike ? pressureLossSL * 0.35 : pressureLossSL));

  // Current thrust at specified ambient pressure
  const pCurrentPa = ambientPressureKPa * 1000;
  const pressureLossCurrent = ((pCurrentPa - effectiveExitPressurePa) * exitAreaM2) / 1000;
  const thrustCurrent = Math.max(1, thrustVac - (isAerospike ? pressureLossCurrent * 0.35 : pressureLossCurrent));

  // 6. Specific Impulses (Isp = F / (dot_m * g0))
  const g0 = 9.80665;
  const ispVac = thrustVac / (massFlowTonnesS * g0);
  const ispSL = thrustSL / (massFlowTonnesS * g0);
  const ispCurrent = thrustCurrent / (massFlowTonnesS * g0);

  // 7. Summerfield Criterion for Flow Separation:
  // If exit pressure Pe < 0.35 * P_atm, the supersonic boundary layer detaches inside the bell!
  const flowSeparationLimitKPa = 101.325 * 0.35; // ~35.4 kPa
  const isOverexpandedAtSL = !isAerospike && exitPressureKPa < flowSeparationLimitKPa;

  // 8. Engine Dry Mass: scales with throat area, chamber pressure rating, and nozzle bell size
  const baseMass = baseDryMass > 0 ? baseDryMass : 0.5;
  const throatFactor = Math.pow(throatRadiusM / 0.16, 1.8);
  const pressureFactor = Math.pow(chamberPressureBar / 100, 0.45);
  const nozzleBellMassFactor = 1 + (expansionRatio / 100) * 0.18;
  const engineDryMass = Math.max(0.08, Math.round(baseMass * throatFactor * pressureFactor * nozzleBellMassFactor * 100) / 100);

  const thrustCoefficientVac = thrustVac / (pcPa * throatAreaM2 / 1000);

  return {
    thrustVac: Math.round(thrustVac * 10) / 10,
    thrustSL: Math.round(thrustSL * 10) / 10,
    thrustCurrent: Math.round(thrustCurrent * 10) / 10,
    ispVac: Math.round(ispVac),
    ispSL: Math.round(ispSL),
    ispCurrent: Math.round(ispCurrent),
    massFlowKgS: Math.round(massFlowKgS * 10) / 10,
    massFlowTonnesS,
    throatAreaM2,
    exitAreaM2,
    exitDiameterM: Math.round(exitDiameterM * 100) / 100,
    exitPressureKPa: Math.round(exitPressureKPa * 10) / 10,
    engineDryMass,
    isOverexpandedAtSL,
    flowSeparationLimitKPa: Math.round(flowSeparationLimitKPa * 10) / 10,
    thrustCoefficientVac: Math.round(thrustCoefficientVac * 100) / 100,
  };
}

export interface ParametricTankResult {
  volumeM3: number; // m^3
  fuelMass: number; // tonnes
  dryMass: number; // tonnes
  wetMass: number; // tonnes
  propellantSpec: PropellantSpec;
  wallAreaM2: number; // m^2
  boiloffRateKgHr: number;
}

/**
 * Juno: New Origins continuous procedural fuel tank sizing.
 * Continuous diameter & length without snapping or fixed steps.
 */
export function calculateParametricTank(
  widthM: number,
  heightM: number,
  fuelType: FuelType = 'kerolox',
  skin: 'white' | 'orange' | 'steel' | 'dark' = 'white'
): ParametricTankResult {
  const radius = widthM / 2;
  // Cylindrical internal tank volume
  const volumeM3 = Math.PI * Math.pow(radius, 2) * heightM;

  const spec = PROPELLANT_SPECS[fuelType] || PROPELLANT_SPECS.kerolox;
  const fuelMass = Math.max(0.1, Math.round(volumeM3 * spec.densityTonnePerM3 * 10) / 10);

  // Surface area of cylinder tank walls + end caps
  const wallAreaM2 = 2 * Math.PI * radius * heightM + 2 * Math.PI * Math.pow(radius, 2);

  // Material skin areal densities:
  // Stainless Steel: 301 Cold-Rolled (heavy, cheap, cryogenic ductile)
  // SOFI Orange Foam: Spray-On Foam Insulation over Al-Li
  // White Al-Li: Painted Aluminum-Lithium alloy
  // Carbon: Carbon composite orthogrid
  let skinMassFactor = 1.0;
  if (skin === 'steel') skinMassFactor = 1.32;
  else if (skin === 'orange') skinMassFactor = 0.96;
  else if (skin === 'dark') skinMassFactor = 0.78;
  else skinMassFactor = 0.92; // white

  // Dry mass based on structural pressure containment (~8% to 11% of tank capacity)
  const baseDry = (wallAreaM2 * 0.016 + volumeM3 * 0.035) * skinMassFactor;
  const dryMass = Math.max(0.05, Math.round(baseDry * 100) / 100);

  // Cryogenic boiloff rate (LH2 hydrolox boils off if not shielded)
  const boiloffRateKgHr = spec.boiloffRisk
    ? (skin === 'orange' ? 0.35 : 1.8) * Math.sqrt(volumeM3)
    : 0;

  return {
    volumeM3: Math.round(volumeM3 * 10) / 10,
    fuelMass,
    dryMass,
    wetMass: Math.round((fuelMass + dryMass) * 100) / 100,
    propellantSpec: spec,
    wallAreaM2: Math.round(wallAreaM2 * 10) / 10,
    boiloffRateKgHr: Math.round(boiloffRateKgHr * 10) / 10,
  };
}

export const DEFAULT_JUNO_ENGINE_CONFIG: JunoEngineConfig = {
  engineSizePercent: 50,
  engineType: 'Liquid',
  powerCycle: 'Gas Generator II',
  liquidFuel: 'Kerolox',
  solidGrain: 'Steady',
  nuclearFuel: 'Liquid Hydrogen',
  chamberPressureKPa: 10000, // 10.0 MPa
  gimbalRangeDeg: 5.0,
  nozzleStyle: 'Bell',
  throatSizePercent: 100,
  nozzleLengthPercent: 100,
};

export interface JunoEnginePerformanceResult {
  thrustVac: number; // kN
  thrustSL: number; // kN
  thrustAtAltitude: number; // kN
  ispVac: number; // s
  ispSL: number; // s
  ispAtAltitude: number; // s
  fuelUsageKgS: number; // kg/s mass flow rate
  fuelUsageSLKgS: number; // kg/s at sea level
  throatRadiusM: number;
  throatAreaM2: number;
  exitDiameterM: number;
  expansionRatio: number;
  exitPressureKPa: number;
  chamberPressureMPa: number;
  chamberPressureKPa: number;
  dryMassTonnes: number;
  costCredits: number;
  isOverexpandedAtSL: boolean;
  flowSeparationWarning: boolean;
  plumeExpansionFactor: number; // 1.0 (sea level column) to 3.2 (vacuum blossom)
  flameColor: string;
  glowColor: string;
}

/**
 * Real Juno: New Origins Physics Simulator
 * Fuel Usage (kg/s) = Thrust (kN) / (Isp (s) * 9.80665)
 */
export function calculateJunoEnginePerformance(
  config: JunoEngineConfig = DEFAULT_JUNO_ENGINE_CONFIG,
  altitudeKm: number = 0
): JunoEnginePerformanceResult {
  const g0 = 9.80665;
  const sizeFactor = Math.max(0.25, Math.min(2.0, config.engineSizePercent / 50));
  const throatFactor = Math.max(0.5, Math.min(1.5, config.throatSizePercent / 100));
  const lengthFactor = Math.max(0.1, Math.min(2.0, config.nozzleLengthPercent / 100));

  // 1. Throat Radius & Area: nominal 0.14m at 50% size, 100% throat
  const throatRadiusM = 0.14 * sizeFactor * throatFactor;
  const throatAreaM2 = Math.PI * Math.pow(throatRadiusM, 2);

  // 2. Chamber Pressure in kPa and Pa
  const pcKPa = Math.max(500, Math.min(30000, config.chamberPressureKPa));
  const pcPa = pcKPa * 1000;
  const chamberPressureMPa = pcKPa / 1000;

  // 3. Expansion Ratio
  let baseExpansion = 32;
  if (config.nozzleStyle === 'Cone') baseExpansion = 22;
  else if (config.nozzleStyle === 'Bravo') baseExpansion = 38;
  else if (config.nozzleStyle === 'Delta') baseExpansion = 75;
  else if (config.nozzleStyle === 'Omega') baseExpansion = 110;
  else if (config.nozzleStyle === 'Aerospike') baseExpansion = 28;

  // Nozzle length stretches expansion ratio; widening throat reduces it
  const expansionRatio = Math.max(
    4,
    Math.min(220, Math.round(baseExpansion * Math.pow(lengthFactor, 1.35) * Math.pow(1 / throatFactor, 1.8)))
  );

  // 4. Determine Fuel Chemistry & Base Specific Impulse
  let baseIspVac = 312;
  let flameColor = '#f97316';
  let glowColor = '#ea580c';

  if (config.engineType === 'Liquid') {
    if (config.liquidFuel === 'Kerolox') {
      baseIspVac = 312;
      flameColor = '#ff8800';
      glowColor = '#ffaa33';
    } else if (config.liquidFuel === 'Hydrolox') {
      baseIspVac = 450;
      flameColor = '#38bdf8';
      glowColor = '#0284c7';
    } else if (config.liquidFuel === 'Methalox') {
      baseIspVac = 372;
      flameColor = '#a855f7';
      glowColor = '#7c3aed';
    }
  } else if (config.engineType === 'Solid') {
    baseIspVac = 280;
    flameColor = '#fbbf24';
    glowColor = '#f59e0b';
  } else if (config.engineType === 'Monopropellant') {
    baseIspVac = 235;
    flameColor = '#e2e8f0';
    glowColor = '#94a3b8';
  } else if (config.engineType === 'Nuclear Thermal') {
    if (config.nuclearFuel === 'Liquid Hydrogen') {
      baseIspVac = 850;
      flameColor = '#06b6d4';
      glowColor = '#0891b2';
    } else {
      baseIspVac = 410; // Steam/Water
      flameColor = '#93c5fd';
      glowColor = '#60a5fa';
    }
  }

  // 5. Power Cycle Isp Modifier
  let cycleIspBonus = 0;
  let cycleThrustMult = 1.0;
  if (config.engineType === 'Liquid') {
    switch (config.powerCycle) {
      case 'Pressure-Fed':
        cycleIspBonus = -6;
        cycleThrustMult = 0.95;
        break;
      case 'Electric':
        cycleIspBonus = 4;
        cycleThrustMult = 0.98;
        break;
      case 'Gas Generator I':
        cycleIspBonus = 0;
        cycleThrustMult = 1.0;
        break;
      case 'Gas Generator II':
        cycleIspBonus = 2;
        cycleThrustMult = 1.02;
        break;
      case 'Staged':
        cycleIspBonus = 12;
        cycleThrustMult = 1.04;
        break;
      case 'Full Flow Staged':
        cycleIspBonus = 18;
        cycleThrustMult = 1.06;
        break;
    }
  }

  // 6. Chamber Pressure & Expansion Ratio Isp Tuning
  const pressureBonus = 8 * Math.log10(Math.max(0.1, chamberPressureMPa / 10));
  const expansionBonus = 20 * Math.log10(Math.max(0.2, expansionRatio / 30));

  let ispVac = Math.round(baseIspVac + cycleIspBonus + pressureBonus + expansionBonus);
  if (config.engineType === 'Nuclear Thermal' && config.nuclearFuel === 'Liquid Hydrogen') {
    ispVac = Math.max(820, ispVac); // Guarantee Nuclear Thermal benchmark
  }

  // 7. Vacuum Thrust: F = Cf * Pc * At
  let cf = 1.73;
  if (config.nozzleStyle === 'Delta' || config.nozzleStyle === 'Omega') cf = 1.82;
  if (config.nozzleStyle === 'Cone') cf = 1.62;
  if (config.nozzleStyle === 'Aerospike') cf = 1.70;

  // Nuclear thermal has lower volumetric energy density thrust per throat size
  const typeThrustFactor = config.engineType === 'Nuclear Thermal' ? 0.16 : config.engineType === 'Monopropellant' ? 0.35 : 1.0;

  const rawThrustVac = (cf * pcPa * throatAreaM2 * cycleThrustMult * typeThrustFactor) / 1000;
  const thrustVac = Math.max(2, Math.round(rawThrustVac * 10) / 10);

  // 8. Nozzle Exit Dimensions & Pressure
  const exitAreaM2 = throatAreaM2 * expansionRatio;
  const exitDiameterM = Math.round(2 * Math.sqrt(exitAreaM2 / Math.PI) * 100) / 100;
  const exitPressurePa = pcPa * Math.pow(1 / Math.max(2, expansionRatio), 1.25) * 0.94;
  const exitPressureKPa = exitPressurePa / 1000;

  // 9. Sea Level Performance & Altitude Compensation
  const pAtmSL = 101.325; // kPa
  const isAerospike = config.nozzleStyle === 'Aerospike';
  const effectiveExitP = isAerospike ? Math.max(exitPressureKPa, pAtmSL) : exitPressureKPa;
  const slPressureLossKN = ((pAtmSL - effectiveExitP) * exitAreaM2);
  const thrustSL = Math.max(1, Math.round((thrustVac - (isAerospike ? slPressureLossKN * 0.3 : slPressureLossKN)) * 10) / 10);
  const ispSL = Math.max(20, Math.round(ispVac * (thrustSL / thrustVac)));

  // Current altitude performance
  const clampedAlt = Math.max(0, Math.min(80, altitudeKm));
  const pAtmCurrent = 101.325 * Math.exp(-clampedAlt / 7.2); // barometric formula
  const altEffectiveExitP = isAerospike ? Math.max(exitPressureKPa, pAtmCurrent) : exitPressureKPa;
  const altPressureLossKN = ((pAtmCurrent - altEffectiveExitP) * exitAreaM2);
  const thrustAtAltitude = Math.max(1, Math.round((thrustVac - (isAerospike ? altPressureLossKN * 0.3 : altPressureLossKN)) * 10) / 10);
  const ispAtAltitude = Math.max(20, Math.round(ispVac * (thrustAtAltitude / thrustVac)));

  // 10. REAL PHYSICS: Mass Flow Rate Fuel Usage (kg/s) = Thrust (kN) / (Isp (s) * 9.80665) * 1000
  const fuelUsageKgS = Math.round((thrustVac / (ispVac * g0)) * 1000 * 10) / 10;
  const fuelUsageSLKgS = Math.round((thrustSL / (ispSL * g0)) * 1000 * 10) / 10;

  // 11. Summerfield Criterion for Flow Separation
  const separationLimitKPa = 101.325 * 0.35; // ~35.4 kPa
  const isOverexpandedAtSL = !isAerospike && exitPressureKPa < separationLimitKPa;
  const flowSeparationWarning = isOverexpandedAtSL && altitudeKm < 6.0;

  // 12. Dry Mass & Cost
  let baseMassTonnes = 0.45 * Math.pow(sizeFactor, 1.8) * Math.pow(throatFactor, 1.6);
  if (config.engineType === 'Nuclear Thermal') baseMassTonnes *= 3.2; // heavy shield & reactor
  else if (config.powerCycle === 'Staged' || config.powerCycle === 'Full Flow Staged') baseMassTonnes *= 1.25;
  else if (config.powerCycle === 'Pressure-Fed') baseMassTonnes *= 0.65;
  baseMassTonnes *= (1 + (lengthFactor - 1) * 0.22);
  const dryMassTonnes = Math.max(0.05, Math.round(baseMassTonnes * 100) / 100);

  const costCredits = Math.round(
    (thrustVac * 18 + dryMassTonnes * 5000 + (chamberPressureMPa > 15 ? 12000 : 4000)) * (config.engineType === 'Nuclear Thermal' ? 4.5 : 1.0)
  );

  // Plume expansion in vacuum
  const plumeExpansionFactor = Math.max(1.0, 1.0 + (1.0 - Math.exp(-clampedAlt / 12)) * (isAerospike ? 1.2 : 2.4));

  return {
    thrustVac,
    thrustSL,
    thrustAtAltitude,
    ispVac,
    ispSL,
    ispAtAltitude,
    fuelUsageKgS,
    fuelUsageSLKgS,
    throatRadiusM: Math.round(throatRadiusM * 1000) / 1000,
    throatAreaM2: Math.round(throatAreaM2 * 10000) / 10000,
    exitDiameterM,
    expansionRatio,
    exitPressureKPa: Math.round(exitPressureKPa * 10) / 10,
    chamberPressureMPa: Math.round(chamberPressureMPa * 10) / 10,
    chamberPressureKPa: Math.round(pcKPa),
    dryMassTonnes,
    costCredits,
    isOverexpandedAtSL,
    flowSeparationWarning,
    plumeExpansionFactor,
    flameColor,
    glowColor,
  };
}
