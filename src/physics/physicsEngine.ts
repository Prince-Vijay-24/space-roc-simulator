import { CELESTIAL_BODIES, PART_CATALOG, calculateFuelTankProperties, getPartHeight, getPartWidth } from '../data/parts';
import { CelestialBody, DebrisObject, PlacedPart, RocketMetrics, StageMetric, VesselState, UserControls } from '../types';
import { soundEngine } from '../audio/soundEngine';
import { calculateJunoEnginePerformance } from '../physics/rocketPropulsion';
import {
  analyzeStructuralConnectivity,
  findConnectedFuelTanksForEngine,
  separateDecoupledStages,
} from './structuralConnectivity';
import {
  findNextOperationalStage,
  isStageEmpty,
  renumberStagesForDocking,
} from './stageAssemblies';

export class PhysicsEngine {
  public earth: CelestialBody = CELESTIAL_BODIES.earth;
  public moon: CelestialBody = CELESTIAL_BODIES.moon;
  public missionTime: number = 0;

  // Moon live position in Earth frame (3,000 km circular orbit)
  public moonAngle: number = 0; // Starts at 0 (East of Earth)
  public moonX: number = 3000000;
  public moonY: number = 0;
  public moonVx: number = 0;
  public moonVy: number = 569.3;

  public constructor() {
    this.updateMoonPosition(0);
  }

  public updateMoonPosition(dt: number) {
    this.missionTime += dt;
    this.moonAngle += (this.moon.orbitSpeed / this.moon.orbitRadius) * dt;
    this.moonX = Math.cos(this.moonAngle) * this.moon.orbitRadius;
    this.moonY = Math.sin(this.moonAngle) * this.moon.orbitRadius;
    this.moonVx = -Math.sin(this.moonAngle) * this.moon.orbitSpeed;
    this.moonVy = Math.cos(this.moonAngle) * this.moon.orbitSpeed;
  }

  public createInitialVessel(parts: PlacedPart[]): VesselState {
    const earthR = this.earth.radius;

    // 1. Structural Connectivity Validation:
    // If a part is floating unattached, the main connected structure launches safely as the active rocket,
    // while unattached parts become falling debris that tumble, impact the pad/terrain, and are destroyed!
    const connectivity = analyzeStructuralConnectivity(parts);
    const connectedParts = connectivity?.connectedParts && connectivity.connectedParts.length > 0 
      ? connectivity.connectedParts 
      : parts;
    const unattachedParts = connectivity?.unattachedParts || [];

    // Normalize parts so that the lowest point of the connected rocket touches y = 0
    let minY = Infinity;
    connectedParts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      const h = def ? getPartHeight(p, def) : 1.0;
      minY = Math.min(minY, p.y - h * 0.5);
    });
    if (minY === Infinity) minY = 0;

    // Determine the initial active stage (lowest stage number with an engine, or lowest stage in craft)
    const engineParts = connectedParts.filter((p) => {
      const def = PART_CATALOG[p.partId];
      return def && def.maxThrust > 0;
    });
    const allStages = connectedParts.map((p) => p.stage).filter((s) => typeof s === 'number');
    const lowestStage = allStages.length > 0 ? Math.min(...allStages) : 1;
    const initialActiveStage = engineParts.length > 0 ? Math.min(...engineParts.map((p) => p.stage)) : lowestStage;

    const normalizedParts: PlacedPart[] = connectedParts.map((p) => {
      const def = PART_CATALOG[p.partId];
      const isSolid = Boolean(def?.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');
      let maxF = def ? def.fuelMass : 0;
      if (def && (def.category === 'Fuel' || p.partId === 'custom_fuel_tank')) {
        const w = getPartWidth(p, def);
        const h = getPartHeight(p, def);
        const props = calculateFuelTankProperties(w, h, p.propellantType || 'kerolox', p.tankSkin || 'white');
        maxF = p.maxFuel ?? props.fuelMass;
      } else if (isSolid && (def?.category === 'Propulsion' || p.partId === 'modular_rocket_engine' || def?.isSRB)) {
        const defaultSolidMass = (def?.fuelMass && def.fuelMass > 0)
          ? def.fuelMass
          : (p.engineConfig ? (p.engineConfig.engineSizePercent / 50) * 12.0 : 12.0);
        maxF = (p.maxFuel !== undefined && p.maxFuel > 0) ? p.maxFuel : defaultSolidMass;
      }
      let fuelRem = p.fuelRemaining;
      if (fuelRem === undefined || (isSolid && fuelRem <= 0.0001 && maxF > 0 && p.fuelRemaining === undefined)) {
        fuelRem = maxF;
      } else if (isSolid && (p.fuelRemaining === 0 || p.fuelRemaining === undefined) && (!p.maxFuel || p.maxFuel === 0)) {
        fuelRem = maxF;
      }
      // Default engine state: active stage engines start ON (true)
      const isEngine = Boolean(def && def.maxThrust > 0);
      const defaultEngineState = p.isEngineOn !== undefined 
        ? p.isEngineOn 
        : (isEngine ? (p.stage === initialActiveStage || engineParts.length <= 1) : false);
      return {
        ...p,
        y: p.y - minY,
        fuelRemaining: fuelRem,
        maxFuel: maxF,
        propellantType: isSolid ? 'solid' : p.propellantType,
        ablatorRemaining: def?.ablatorMass ? (p.ablatorRemaining !== undefined ? p.ablatorRemaining : def.ablatorMass) : 0,
        isEngineOn: defaultEngineState,
      };
    });

    // Convert unattached/floating parts into falling debris
    const initialDebris: DebrisObject[] = unattachedParts.map((p) => {
      const def = PART_CATALOG[p.partId];
      const partMass = (def?.dryMass || 0.4) + (p.fuelRemaining || 0);
      return {
        id: 'deb_unattached_' + p.uid + '_' + Math.random().toString(36).substring(2, 6),
        parts: [{ ...p, y: 0 }],
        x: p.x,
        y: earthR + Math.max(0.5, p.y - minY),
        vx: (Math.random() - 0.5) * 1.8,
        vy: -0.3 - Math.random() * 1.2,
        mass: partMass,
        angle: (p.rotation * Math.PI) / 180,
        angularVelocity: (Math.random() - 0.5) * 3.0,
      };
    });

    const metrics = this.calculateMetrics(normalizedParts);

    // Initial active stage fuel
    const s1Parts = normalizedParts.filter((p) => p.stage === initialActiveStage);
    const s1Fuel = s1Parts.reduce((sum, p) => sum + (p.fuelRemaining || 0), 0);
    const s1MaxFuel = s1Parts.reduce((sum, p) => {
      const def = PART_CATALOG[p.partId];
      return sum + (p.maxFuel || def?.fuelMass || 0);
    }, 0);

    return {
      x: 0,
      y: earthR, // Launchpad at Earth North Pole
      vx: 0,
      vy: 0,
      angle: 0, // 0 = pointing straight up away from Earth center
      angularVelocity: 0,
      mass: metrics.wetMass,
      dryMass: metrics.dryMass,
      fuelMass: metrics.fuelMass,
      maxFuelMass: normalizedParts.reduce((s, p) => s + (p.maxFuel || 0), 0),
      fuelPercent: metrics.fuelPercent,
      throttle: 0,
      activeStageIndex: initialActiveStage,
      soi: 'earth',
      altitude: 0,
      surfaceSpeed: 0,
      verticalSpeed: 0,
      horizontalSpeed: 0,
      orbitalSpeed: 0,
      dynamicPressure: 0,
      gForce: 1.0,
      atmosphericDensity: 1.225,
      machNumber: 0,
      heatFlux: 0,
      reentryVapor: 0,
      hasBeenInSpace: false,
      hullTemperature: 290, // Kelvin
      isLanded: true,
      isCrashed: false,
      currentTWR: metrics.twrSeaLevel,
      parts: JSON.parse(JSON.stringify(normalizedParts)),
      debris: initialDebris,
      rcsActive: true,
      sasMode: 'STABILITY',
      landingLegsDeployed: false,
      parachutesDeployed: false,
      solarPanelsDeployed: false,
      maxAltitudeReached: 0,
      hasReachedOrbit: false,
      hasLandedOnMoon: false,
      fuelFlowRate: 0,
      estimatedBurnTime: 0,
      totalFuelMass: metrics.fuelMass || 0,
      stageFuelMass: s1Fuel,
      stageMaxFuelMass: s1MaxFuel,
      selectedTankUids: [],
      isTransferringFuel: false,
      transferDirection: 'in',
      maxQValue: 0,
      isMaxQ: false,
      machTransonicFactor: 1.0,
      gimbalAngle: 0,
      aoa: 0,
      missionTime: 0,
      // Section 3: Parts System - Resources & Command
      batteryCharge: metrics.batteryCapacity,
      batteryMax: Math.max(10, metrics.batteryCapacity),
      batteryDrainRate: 0,
      solarPowerGen: 0,
      monopropRemaining: metrics.monopropCapacity,
      monopropMax: Math.max(0.1, metrics.monopropCapacity),
      hasCommand: metrics.hasCommandUnit,
      commandType: !metrics.hasCommandUnit ? 'NONE' : (metrics.crewCapacity > 0 ? 'CREWED' : 'PROBE'),
      hasAstronetSignal: true,
      astronetSignalStrength: 100,
      astronetDistanceKm: 0,
      inEclipse: false,
      fairingsJettisoned: false,
      totalOreKg: 0,
      totalRefinedOreKg: 0,
      totalIngotsKg: 0,
      isDrilling: false,
      isRefining: false,
      isSmelting: false,
      miningRateKgS: 0,
    };
  }

  public calculateMetrics(parts: PlacedPart[]): RocketMetrics {
    let wetMass = 0;
    let dryMass = 0;
    let fuelMass = 0;
    let maxFuelCapacity = 0;
    let totalThrust = 0;
    let totalWeightedIspSL = 0;
    let totalWeightedIspVac = 0;

    let weightedX = 0;
    let weightedY = 0;
    let thrustWeightedX = 0;
    let thrustWeightedY = 0;

    // Unique stages in ascending order
    const stageSet = new Set<number>();
    parts.forEach((p) => stageSet.add(p.stage));
    const stageNumbers = Array.from(stageSet).sort((a, b) => a - b);

    parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;

      let partFuelCap = def.fuelMass;
      let partDry = def.dryMass;
      let partThrust = def.maxThrust;
      let partIspSL = def.ispSL;
      let partIspVac = def.ispVac;

      const isSolid = Boolean(def.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');

      if (def.category === 'Fuel' || p.partId === 'custom_fuel_tank') {
        const w = getPartWidth(p, def);
        const h = getPartHeight(p, def);
        const props = calculateFuelTankProperties(w, h, p.propellantType || 'kerolox', p.tankSkin || 'white');
        partFuelCap = p.maxFuel ?? props.fuelMass;
        partDry = props.dryMass;
      } else if (p.engineConfig) {
        const perf = calculateJunoEnginePerformance(p.engineConfig);
        partDry = perf.dryMassTonnes;
        partThrust = perf.thrustVac;
        partIspSL = perf.ispSL;
        partIspVac = perf.ispVac;
        if (isSolid) {
          const defaultSolid = (def.fuelMass && def.fuelMass > 0)
            ? def.fuelMass
            : (p.engineConfig ? (p.engineConfig.engineSizePercent / 50) * 12.0 : 12.0);
          partFuelCap = p.maxFuel ?? defaultSolid;
        }
      } else if (isSolid) {
        partFuelCap = p.maxFuel ?? (def.fuelMass || 15.0);
      }

      const currentFuel = p.fuelRemaining !== undefined ? p.fuelRemaining : partFuelCap;
      const ablator = p.ablatorRemaining !== undefined ? p.ablatorRemaining : (def.ablatorMass || 0);

      const partWet = partDry + currentFuel + ablator;

      dryMass += partDry;
      wetMass += partWet;
      fuelMass += currentFuel;
      maxFuelCapacity += partFuelCap;

      weightedX += p.x * partWet;
      weightedY += p.y * partWet;

      if (partThrust > 0 && p.isEngineOn !== false) {
        totalThrust += partThrust;
        totalWeightedIspSL += partThrust * partIspSL;
        totalWeightedIspVac += partThrust * partIspVac;

        thrustWeightedX += p.x * partThrust;
        thrustWeightedY += p.y * partThrust;
      }
    });

    const comX = wetMass > 0 ? weightedX / wetMass : 0;
    const comY = wetMass > 0 ? weightedY / wetMass : 0;

    const cotX = totalThrust > 0 ? thrustWeightedX / totalThrust : comX;
    const cotY = totalThrust > 0 ? thrustWeightedY / totalThrust : comY - 1;

    const g0 = this.earth.surfaceGravity;
    const twrSeaLevel = wetMass > 0 ? totalThrust / (wetMass * g0) : 0;
    const twrVacuum = wetMass > 0 ? totalThrust / (wetMass * g0) : 0;

    // Calculate Stage Breakdown with Tsiolkovsky rocket equation per stage
    let runningWetMass = wetMass;
    let totalEstDeltaV = 0;
    const stageBreakdown: StageMetric[] = [];

    stageNumbers.forEach((stgNum) => {
      const stageParts = parts.filter((p) => p.stage === stgNum);
      const stageUpperParts = parts.filter((p) => p.stage >= stgNum);

      let stageThrust = 0;
      let stageWeightedIspSL = 0;
      let stageWeightedIspVac = 0;
      let stageFuel = 0;
      let stageDry = 0;

      stageParts.forEach((p) => {
        const def = PART_CATALOG[p.partId];
        if (!def) return;
        let partFuelCap = def.fuelMass;
        let partDry = def.dryMass;
        let partThrust = def.maxThrust;
        let partIspSL = def.ispSL;
        let partIspVac = def.ispVac;

        const isSolid = Boolean(def.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');

        if (def.category === 'Fuel' || p.partId === 'custom_fuel_tank') {
          const w = getPartWidth(p, def);
          const h = getPartHeight(p, def);
          const props = calculateFuelTankProperties(w, h, p.propellantType || 'kerolox', p.tankSkin || 'white');
          partFuelCap = p.maxFuel ?? props.fuelMass;
          partDry = props.dryMass;
        } else if (p.engineConfig) {
          const perf = calculateJunoEnginePerformance(p.engineConfig);
          partDry = perf.dryMassTonnes;
          partThrust = perf.thrustVac;
          partIspSL = perf.ispSL;
          partIspVac = perf.ispVac;
          if (isSolid) {
            const defaultSolid = (def.fuelMass && def.fuelMass > 0)
              ? def.fuelMass
              : (p.engineConfig ? (p.engineConfig.engineSizePercent / 50) * 12.0 : 12.0);
            partFuelCap = p.maxFuel ?? defaultSolid;
          }
        } else if (isSolid) {
          partFuelCap = p.maxFuel ?? (def.fuelMass || 15.0);
        }

        const curF = p.fuelRemaining !== undefined ? p.fuelRemaining : partFuelCap;
        stageFuel += curF;
        stageDry += partDry;

        if (partThrust > 0 && p.isEngineOn !== false) {
          stageThrust += partThrust;
          stageWeightedIspSL += partThrust * partIspSL;
          stageWeightedIspVac += partThrust * partIspVac;
        }
      });

      const stageWet = stageUpperParts.reduce((sum, p) => {
        const def = PART_CATALOG[p.partId];
        if (!def) return sum;
        let partFuelCap = def.fuelMass;
        let partDry = def.dryMass;
        if (def.category === 'Fuel' || p.partId === 'custom_fuel_tank') {
          const w = getPartWidth(p, def);
          const h = getPartHeight(p, def);
          const props = calculateFuelTankProperties(w, h, p.propellantType || 'kerolox', p.tankSkin || 'white');
          partFuelCap = p.maxFuel ?? props.fuelMass;
          partDry = props.dryMass;
        } else if (p.engineConfig) {
          const perf = calculateJunoEnginePerformance(p.engineConfig);
          partDry = perf.dryMassTonnes;
          if (p.engineConfig.engineType === 'Solid') {
            partFuelCap = perf.dryMassTonnes * 5.0;
          }
        }
        const curF = p.fuelRemaining !== undefined ? p.fuelRemaining : partFuelCap;
        return sum + partDry + curF + (p.ablatorRemaining || 0);
      }, 0);

      const stageBurnoutMass = Math.max(0.1, stageWet - stageFuel);
      const stageIspVac = stageThrust > 0 ? stageWeightedIspVac / stageThrust : 300;
      const stageIspSL = stageThrust > 0 ? stageWeightedIspSL / stageThrust : 280;

      const stageDV = stageBurnoutMass > 0 && stageWet > stageBurnoutMass
        ? stageIspVac * 9.81 * Math.log(stageWet / stageBurnoutMass)
        : 0;

      const stageTwrSL = stageWet > 0 ? stageThrust / (stageWet * g0) : 0;
      const stageTwrVac = stageWet > 0 ? stageThrust / (stageWet * g0) : 0;
      const burnRate = stageThrust > 0 ? stageThrust / (stageIspVac * 9.81) : 0;
      const burnTime = burnRate > 0 ? stageFuel / burnRate : 0;

      totalEstDeltaV += stageDV;

      stageBreakdown.push({
        stage: stgNum,
        deltaV: stageDV,
        twrSL: stageTwrSL,
        twrVac: stageTwrVac,
        thrust: stageThrust,
        wetMass: stageWet,
        dryMass: stageBurnoutMass,
        fuelMass: stageFuel,
        burnTime,
      });

      runningWetMass -= stageFuel + stageDry;
    });

    const estimatedDeltaV = totalEstDeltaV > 0 ? totalEstDeltaV : (
      dryMass > 0 && wetMass > dryMass ? 320 * 9.81 * Math.log(wetMass / dryMass) : 0
    );
    const fuelPercent = maxFuelCapacity > 0 ? (fuelMass / maxFuelCapacity) * 100 : 0;

    // Section 3: Parts System Metrics
    let commandUnitCount = 0;
    let crewCapacity = 0;
    let batteryCapacity = 0;
    let monopropCapacity = 0;
    let maxAntennaRangeKm = 5000;
    let gyroscopeTorque = 0;
    let solarMaxOutputKw = 0;

    parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;
      if (def.partRole === 'COMMAND' || def.category === 'Command') {
        commandUnitCount++;
        crewCapacity += def.crewCapacity || 0;
      }
      batteryCapacity += def.batteryCapacity || 0;
      if (def.monopropMass) {
        monopropCapacity += def.monopropMass;
      } else if (p.partId === 'tank_rcs_monoprop') {
        monopropCapacity += p.maxFuel || def.fuelMass || 1.5;
      }
      if (def.antennaRangeKm && def.antennaRangeKm > maxAntennaRangeKm) {
        maxAntennaRangeKm = def.antennaRangeKm;
      }
      if (def.torque) {
        gyroscopeTorque += def.torque;
      } else if (def.hasReactionWheel) {
        gyroscopeTorque += 30;
      }
      if (def.solarOutputKw) {
        solarMaxOutputKw += def.solarOutputKw;
      }
    });

    return {
      wetMass,
      dryMass,
      totalFuelMass: fuelMass,
      fuelMass,
      fuelPercent,
      maxFuelMass: maxFuelCapacity,
      totalThrust,
      twrSeaLevel,
      twrVacuum,
      estimatedDeltaV,
      stageBreakdown,
      com: { x: comX, y: comY },
      cot: { x: cotX, y: cotY },
      partCount: parts.length,
      hasCommandUnit: commandUnitCount > 0,
      commandUnitCount,
      crewCapacity,
      batteryCapacity: Math.max(20, batteryCapacity),
      monopropCapacity,
      maxAntennaRangeKm,
      gyroscopeTorque,
      solarMaxOutputKw,
    };
  }

  public calculateTotalMass(parts: PlacedPart[]): number {
    return parts.reduce((sum, p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return sum;
      const fuel = p.fuelRemaining !== undefined ? p.fuelRemaining : def.fuelMass;
      const ablator = p.ablatorRemaining !== undefined ? p.ablatorRemaining : (def.ablatorMass || 0);
      return sum + def.dryMass + fuel + ablator;
    }, 0);
  }

  /**
   * Primary Physics Step with Adaptive Sub-stepping
   */
  public step(
    vessel: VesselState,
    dt: number,
    userControls: UserControls
  ) {
    if (vessel.isCrashed) return;

    // Sub-stepping for ultra-high numerical accuracy and stability
    const maxSubStepDt = 0.04;
    const steps = Math.max(1, Math.min(60, Math.ceil(dt / maxSubStepDt)));
    const subDt = dt / steps;

    for (let i = 0; i < steps; i++) {
      this.updateMoonPosition(subDt);
      this.stepSingle(vessel, subDt, userControls);
    }

    // Fuel transfer tick
    if (vessel.isTransferringFuel && vessel.selectedTankUids.length === 2) {
      this.handleFuelTransfer(vessel, dt);
    }

    // Track Milestones & Achievements
    if (vessel.altitude > vessel.maxAltitudeReached) {
      vessel.maxAltitudeReached = vessel.altitude;
    }
    if (vessel.soi === 'earth' && vessel.altitude > 30000 && vessel.orbitalSpeed > 1650 && Math.abs(vessel.verticalSpeed) < 150) {
      vessel.hasReachedOrbit = true;
    }
    if (vessel.soi === 'moon' && vessel.isLanded) {
      vessel.hasLandedOnMoon = true;
    }
  }

  private stepSingle(
    vessel: VesselState,
    dt: number,
    userControls: UserControls
  ) {
    // 1. Detect active SOI
    const distToMoon = Math.hypot(vessel.x - this.moonX, vessel.y - this.moonY);
    const inMoonSOI = distToMoon < this.moon.soiRadius;
    vessel.soi = inMoonSOI ? 'moon' : 'earth';

    const activeBody = vessel.soi === 'moon' ? this.moon : this.earth;

    // Body-relative positions and velocities
    const relX = vessel.soi === 'moon' ? vessel.x - this.moonX : vessel.x;
    const relY = vessel.soi === 'moon' ? vessel.y - this.moonY : vessel.y;
    const relVx = vessel.soi === 'moon' ? vessel.vx - this.moonVx : vessel.vx;
    const relVy = vessel.soi === 'moon' ? vessel.vy - this.moonVy : vessel.vy;

    const r = Math.hypot(relX, relY);
    const altitude = r - activeBody.radius;
    vessel.altitude = Math.max(0, altitude);

    const unitRadialX = r > 0.001 ? relX / r : 0;
    const unitRadialY = r > 0.001 ? relY / r : 1;

    // Speeds
    const speed = Math.hypot(relVx, relVy);
    vessel.orbitalSpeed = speed;
    vessel.verticalSpeed = relVx * unitRadialX + relVy * unitRadialY;
    vessel.horizontalSpeed = Math.abs(relVx * -unitRadialY + relVy * unitRadialX);
    vessel.surfaceSpeed = speed;

    // 2. Multi-Body Gravity (Newton's Law of Universal Gravitation)
    let gx = 0;
    let gy = 0;

    if (vessel.soi === 'earth') {
      const gEarth = -this.earth.mu / (r * r * r);
      gx += relX * gEarth;
      gy += relY * gEarth;

      // Small 3rd body perturbation from Moon
      const dToM = Math.hypot(vessel.x - this.moonX, vessel.y - this.moonY);
      if (dToM > 100) {
        const gMoonPert = -this.moon.mu / (dToM * dToM * dToM);
        gx += (vessel.x - this.moonX) * gMoonPert;
        gy += (vessel.y - this.moonY) * gMoonPert;
      }
    } else {
      // Inside Moon SOI
      const gMoon = -this.moon.mu / (r * r * r);
      gx += relX * gMoon;
      gy += relY * gMoon;
    }

    // 3. Atmospheric Density & Drag & Heating (SFS barometric model)
    let rho = 0;
    let dragFx = 0;
    let dragFy = 0;
    let dynamicPressure = 0;
    let heatFlux = 0;

    // Track if craft went into space
    if (altitude >= this.earth.atmosphereHeight) {
      vessel.hasBeenInSpace = true;
    }

    if (vessel.soi === 'earth' && altitude < this.earth.atmosphereHeight) {
      // Exponential decay: rho(h) = 1.225 * e^(-h / 5000)
      rho = 1.225 * Math.exp(-altitude / this.earth.scaleHeight);
      vessel.atmosphericDensity = rho;

      dynamicPressure = 0.5 * rho * speed * speed * 0.001; // in kPa
      vessel.dynamicPressure = dynamicPressure;
      vessel.machNumber = speed / 340.0;

      // Re-entry heating flux (MW/m^2 approximation based on Sutton-Graves equation)
      // Begins realistically when entering atmosphere at high speed (> 380 m/s with density)
      if (speed > 380 && rho > 0.0002) {
        heatFlux = Math.max(0, 1.74e-4 * Math.sqrt(rho) * Math.pow(speed, 3) * 0.0001);
        vessel.heatFlux = heatFlux;

        // Apply heat to hull or consume heat shield ablator
        const heatShield = vessel.parts.find((p) => p.partId === 'heat_shield');
        if (heatShield && heatShield.ablatorRemaining && heatShield.ablatorRemaining > 0) {
          heatShield.ablatorRemaining = Math.max(0, heatShield.ablatorRemaining - heatFlux * 0.002 * dt);
        } else {
          vessel.hullTemperature = Math.min(3500, vessel.hullTemperature + heatFlux * 140 * dt);
          if (vessel.hullTemperature > 3000) {
            vessel.isCrashed = true;
            soundEngine.playExplosionSound();
          }
        }
      } else {
        vessel.heatFlux = 0;
        vessel.hullTemperature = Math.max(290, vessel.hullTemperature - 15 * dt);
      }

      // Re-entry condensation & aerodynamic vapor trail intensity (0 to 1)
      // Forms when craft enters from space at high speed or flies with high dynamic pressure
      if (speed > 200 && rho > 0.001) {
        const speedRatio = Math.min(1.0, (speed - 200) / 280);
        const rhoRatio = Math.min(1.0, rho / 0.08);
        const spaceBonus = vessel.hasBeenInSpace ? 1.4 : 1.0;
        vessel.reentryVapor = Math.min(1.0, speedRatio * rhoRatio * spaceBonus);
      } else {
        vessel.reentryVapor = 0;
      }

      // 4-Stage Realistic Parachute Aerodynamics
      const chuteParts = vessel.parts.filter((p) => {
        const d = PART_CATALOG[p.partId];
        return d?.isParachute;
      });

      let totalChuteDragForce = 0;
      chuteParts.forEach((chute) => {
        const isChuteDeployed = chute.deployed === true || vessel.parachutesDeployed;
        if (!isChuteDeployed) {
          chute.parachuteState = 'STOWED';
          return;
        }

        const deployAlt = chute.parachuteDeployAltitudeM ?? 3500;
        const reefingAlt = chute.parachuteReefingCutAltM ?? chute.mainAltitudeM ?? 800;
        const fullDiameter = chute.parachuteCanopyDiameterM ?? 18;
        const minPressure = (chute.parachuteMinPressureAtm ?? 0.04) * 101.3; // in kPa

        if (dynamicPressure < minPressure * 0.1 && altitude > 25000) {
          chute.parachuteState = 'STOWED';
          return;
        }

        let stageState: 'PILOT' | 'DROGUE' | 'MAIN' = 'MAIN';
        let effDiameter = fullDiameter;
        let cd = 1.75;

        if (altitude > deployAlt * 0.75) {
          stageState = 'PILOT';
          effDiameter = Math.min(2.5, fullDiameter * 0.15);
          cd = 1.2;
        } else if (altitude > reefingAlt) {
          stageState = 'DROGUE';
          effDiameter = Math.max(3.5, fullDiameter * 0.38);
          cd = 1.45;
        } else {
          stageState = 'MAIN';
          effDiameter = fullDiameter;
          cd = 1.85;
        }

        chute.parachuteState = stageState;
        vessel.parachutesDeployed = true;

        const canopyArea = Math.PI * Math.pow(effDiameter / 2, 2);
        const chuteForce = (0.5 * rho * speed * speed * cd * canopyArea) * 0.001; // in kN
        totalChuteDragForce += chuteForce;
      });

      if (speed > 0.01 && totalChuteDragForce > 0) {
        dragFx -= (relVx / speed) * (totalChuteDragForce / Math.max(0.5, vessel.mass));
        dragFy -= (relVy / speed) * (totalChuteDragForce / Math.max(0.5, vessel.mass));
      }

      // Hull aerodynamic drag (Pointed nose cones reduce drag, broad tanks increase drag)
      let totalDragCoeff = 0.25;
      vessel.parts.forEach((p) => {
        const def = PART_CATALOG[p.partId];
        if (def) totalDragCoeff += def.dragCoeff * 0.08;
      });

      const hullDragForce = 0.5 * rho * speed * speed * totalDragCoeff;
      if (speed > 0.01) {
        dragFx -= (relVx / speed) * (hullDragForce / Math.max(0.5, vessel.mass));
        dragFy -= (relVy / speed) * (hullDragForce / Math.max(0.5, vessel.mass));
      }
    } else {
      vessel.atmosphericDensity = 0;
      vessel.dynamicPressure = 0;
      vessel.machNumber = 0;
      vessel.heatFlux = 0;
      vessel.hullTemperature = Math.max(290, vessel.hullTemperature - 5 * dt);
    }

    // 4. Rocket Thrust & Fuel Consumption (SFS Real-Time Staging & Individual Engine Toggles)
    let thrustFx = 0;
    let thrustFy = 0;
    let totalActiveThrust = 0;

    // Calculate Center of Mass (CoM) for realistic TVC gimbal torque, positional RCS, and aero stability
    let weightedX = 0;
    let weightedY = 0;
    let massSum = 0;
    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      const m = (def ? def.dryMass : 1) + (p.fuelRemaining || 0) + (p.ablatorRemaining || 0);
      weightedX += p.x * m;
      weightedY += p.y * m;
      massSum += m;
    });
    const comX = massSum > 0 ? weightedX / massSum : 0;
    const comY = massSum > 0 ? weightedY / massSum : 0;
    vessel.liveCoMX = comX;
    vessel.liveCoMY = comY;

    // Update fuel statistics
    let currentFuelTotal = 0;
    let maxFuelTotal = 0;
    let currentDryTotal = 0;
    let currentStageFuel = 0;
    let currentStageMaxFuel = 0;

    // Determine candidate tanks feeding active engines via connection graph
    const candidateActiveEngines = vessel.parts.filter(
      (p) => PART_CATALOG[p.partId]?.maxThrust && (p.isEngineOn === true || p.stage === vessel.activeStageIndex)
    );
    const connectedTankUids = new Set<string>();
    candidateActiveEngines.forEach((eng) => {
      const tanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
      tanks.forEach((t) => connectedTankUids.add(t.uid));
    });

    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;
      currentDryTotal += def.dryMass;
      const isSolidP = Boolean(def.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');
      const solidCap = isSolidP ? (p.maxFuel || def.fuelMass || (p.engineConfig ? (p.engineConfig.engineSizePercent / 50) * 12.0 : 12.0)) : 0;
      const pMax = p.maxFuel || def.fuelMass || solidCap;
      if (p.fuelRemaining !== undefined || pMax > 0) {
        const pRem = p.fuelRemaining !== undefined ? p.fuelRemaining : pMax;
        currentFuelTotal += pRem;
        maxFuelTotal += pMax;
        // If tank is in current stage or directly feeds an active engine
        if (p.stage === vessel.activeStageIndex || connectedTankUids.has(p.uid)) {
          currentStageFuel += pRem;
          currentStageMaxFuel += pMax;
        }
      }
    });

    vessel.dryMass = currentDryTotal;
    vessel.fuelMass = currentFuelTotal;
    vessel.totalFuelMass = currentFuelTotal;
    vessel.maxFuelMass = maxFuelTotal;
    vessel.fuelPercent = maxFuelTotal > 0 ? (currentFuelTotal / maxFuelTotal) * 100 : 0;
    vessel.stageFuelMass = currentStageFuel;
    vessel.stageMaxFuelMass = currentStageMaxFuel;
    vessel.mass = this.calculateTotalMass(vessel.parts);

    // Section 3: Parts System - Resources & Command Verification
    const commandUnits = vessel.parts.filter((p) => {
      const def = PART_CATALOG[p.partId];
      return def && (def.partRole === 'COMMAND' || def.category === 'Command');
    });

    const hasCrewedCommand = commandUnits.some((p) => (PART_CATALOG[p.partId]?.crewCapacity || 0) > 0);
    const hasProbeCommand = commandUnits.length > 0 && !hasCrewedCommand;

    // Calculate distance to Astronet Ground Station (Earth center)
    const earthDistMeters = Math.hypot(vessel.x, vessel.y);
    const earthDistKm = Math.max(0, (earthDistMeters - this.earth.radius) / 1000);
    vessel.astronetDistanceKm = Math.round(earthDistKm);

    // Max antenna transmission range
    let maxAntennaKm = 5000;
    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (def?.antennaRangeKm && def.antennaRangeKm > maxAntennaKm) {
        maxAntennaKm = def.antennaRangeKm;
      }
    });

    // Line of sight check (occultation by Moon when in Moon SOI)
    let hasLineOfSight = true;
    if (vessel.soi === 'moon') {
      const toMoonX = this.moonX - vessel.x;
      const toMoonY = this.moonY - vessel.y;
      const toEarthX = -vessel.x;
      const toEarthY = -vessel.y;
      const dot = toMoonX * toEarthX + toMoonY * toEarthY;
      const moonDist = Math.hypot(toMoonX, toMoonY);
      if (dot > 0 && moonDist < this.moon.radius * 1.5) {
        hasLineOfSight = false;
      }
    }

    const inRange = earthDistKm <= maxAntennaKm;
    vessel.hasAstronetSignal = hasLineOfSight && inRange;
    vessel.astronetSignalStrength = !vessel.hasAstronetSignal ? 0 : Math.max(5, Math.round(100 * (1 - earthDistKm / (maxAntennaKm * 1.3))));

    if (commandUnits.length === 0) {
      // In flight test mode, allow manual command authority so test rockets and booster builds can always be throttled
      vessel.hasCommand = true;
      vessel.commandType = 'NONE';
    } else if (hasCrewedCommand) {
      vessel.hasCommand = true;
      vessel.commandType = 'CREWED';
    } else if (hasProbeCommand) {
      vessel.commandType = 'PROBE';
      // Probe core requires battery electricity > 0
      const hasPower = vessel.batteryCharge > 0.0001;
      vessel.hasCommand = hasPower;
    }

    // Solar generation & Eclipse calculation
    let totalSolarGenKw = 0;
    const inEarthShadow = vessel.x < 0 && Math.abs(vessel.y) < this.earth.radius && altitude < 100000;
    vessel.inEclipse = inEarthShadow;

    if (vessel.solarPanelsDeployed && !vessel.inEclipse) {
      vessel.parts.forEach((p) => {
        const def = PART_CATALOG[p.partId];
        if (def?.solarOutputKw && (p.deployed ?? vessel.solarPanelsDeployed)) {
          totalSolarGenKw += def.solarOutputKw;
        }
      });
    }
    vessel.solarPowerGen = totalSolarGenKw;

    // Update animated parts (smooth deployProgress for solar panels and landing legs, wheel rotation)
    const deployRate = 0.55; // Unfolds smoothly over ~1.8 seconds
    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;

      // Solar Panels
      if (def.isSolarPanel) {
        const target = vessel.solarPanelsDeployed ? 1.0 : 0.0;
        const cur = p.deployProgress !== undefined ? p.deployProgress : (vessel.solarPanelsDeployed ? 1.0 : 0.0);
        if (cur < target) {
          p.deployProgress = Math.min(target, cur + deployRate * dt);
        } else if (cur > target) {
          p.deployProgress = Math.max(target, cur - deployRate * dt);
        }
      }

      // Landing Legs (Independent per-leg deployment & part-specific deploy speeds)
      if (def.isLandingLeg) {
        const isLegTargetDeployed = p.deployed !== undefined ? p.deployed : vessel.landingLegsDeployed;
        const target = isLegTargetDeployed ? 1.0 : 0.0;
        const cur = p.deployProgress !== undefined ? p.deployProgress : (isLegTargetDeployed ? 1.0 : 0.0);
        const legSpeed = def.deploySpeed || 0.75;
        if (cur < target) {
          p.deployProgress = Math.min(target, cur + legSpeed * dt);
        } else if (cur > target) {
          p.deployProgress = Math.max(target, cur - legSpeed * dt);
        }
      }

      // Rover Wheels
      if (def.isWheel) {
        const wheelR = def.wheelRadiusM || 0.45;
        const groundSpeed = Math.hypot(vessel.vx, vessel.vy);
        if (groundSpeed > 0.05) {
          p.wheelRotation = ((p.wheelRotation || 0) + (groundSpeed / wheelR) * dt) % (Math.PI * 2);
        }
      }
    });

    // Sync vessel-wide landingLegsDeployed status
    const anyLegDeployed = vessel.parts.some((p) => {
      const def = PART_CATALOG[p.partId];
      return def?.isLandingLeg && (p.deployed === true || (p.deployProgress !== undefined && p.deployProgress > 0.1));
    });
    vessel.landingLegsDeployed = anyLegDeployed;

    // Track Auto-fed monopropellant total in vessel
    let totalMonoprop = 0;
    let totalMonopropCap = 0;
    let totalBatCap = 0;
    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;
      totalBatCap += def.batteryCapacity || 0;
      if (def.monopropMass || p.partId === 'tank_rcs_monoprop') {
        const cap = def.monopropMass || p.maxFuel || def.fuelMass || 1.5;
        totalMonopropCap += cap;
        totalMonoprop += p.fuelRemaining !== undefined ? p.fuelRemaining : cap;
      }
    });
    vessel.batteryMax = Math.max(10, totalBatCap);
    vessel.monopropMax = Math.max(0.1, totalMonopropCap);
    vessel.monopropRemaining = totalMonoprop;

    // Fairing Auto-Jettison
    if (!vessel.fairingsJettisoned) {
      const fairingPart = vessel.parts.find((p) => {
        const def = PART_CATALOG[p.partId];
        return def && (def.isFairing || p.partId === 'fairing');
      });
      if (fairingPart) {
        const targetAlt = fairingPart.jettisonAltitude ?? 28000;
        const targetMaxQ = fairingPart.jettisonMaxQ ?? 0.5;
        if (vessel.altitude >= targetAlt || (vessel.altitude > 15000 && vessel.dynamicPressure <= targetMaxQ)) {
          vessel.fairingsJettisoned = true;
          const fairingParts = vessel.parts.filter((p) => PART_CATALOG[p.partId]?.isFairing || p.partId === 'fairing');
          if (fairingParts.length > 0) {
            const debMass = this.calculateTotalMass(fairingParts);
            const deb: DebrisObject = {
              id: 'fairing_' + Date.now(),
              parts: JSON.parse(JSON.stringify(fairingParts)),
              x: vessel.x - Math.sin(vessel.angle) * 3,
              y: vessel.y + Math.cos(vessel.angle) * 3,
              vx: vessel.vx + (Math.random() - 0.5) * 8,
              vy: vessel.vy + (Math.random() - 0.5) * 8,
              angle: vessel.angle,
              angularVelocity: 0.8,
              mass: debMass,
            };
            vessel.debris.push(deb);
            vessel.parts = vessel.parts.filter((p) => !PART_CATALOG[p.partId]?.isFairing && p.partId !== 'fairing');
            soundEngine.playStageSound();
          }
        }
      }
    }

    // If no command: lock controls, throttle cut, no user input
    if (!vessel.hasCommand) {
      userControls.steerLeft = false;
      userControls.steerRight = false;
      vessel.throttle = 0;
      vessel.sasMode = 'OFF';
    }

    // Track Mission Elapsed Time (MET)
    if (vessel.altitude > 0.5 || vessel.throttle > 0.01) {
      vessel.missionTime = (vessel.missionTime || 0) + dt;
    }

    // Determine user or SAS control demand: -1.0 (steer right / CW) to +1.0 (steer left / CCW)
    let controlDemand = 0;
    let transXDemand = 0;
    let transYDemand = 0;

    if (vessel.hasCommand) {
      if (userControls.steerLeft) {
        controlDemand = 1.0;
        if (vessel.rcsActive && vessel.monopropRemaining > 0) soundEngine.playRcsSound();
      } else if (userControls.steerRight) {
        controlDemand = -1.0;
        if (vessel.rcsActive && vessel.monopropRemaining > 0) soundEngine.playRcsSound();
      } else if (vessel.sasMode !== 'OFF') {
        if (vessel.sasMode === 'STABILITY') {
          controlDemand = Math.max(-1.0, Math.min(1.0, -vessel.angularVelocity * 2.8));
        } else {
          let targetAngle = vessel.angle;
          let hasTarget = false;

          if (vessel.sasMode === 'PROGRADE' && speed > 0.5) {
            targetAngle = Math.atan2(-relVx, relVy);
            hasTarget = true;
          } else if (vessel.sasMode === 'RETROGRADE' && speed > 0.5) {
            targetAngle = Math.atan2(relVx, -relVy);
            hasTarget = true;
          } else if (vessel.sasMode === 'RADIAL_OUT') {
            targetAngle = Math.atan2(-unitRadialX, unitRadialY);
            hasTarget = true;
          } else if (vessel.sasMode === 'RADIAL_IN') {
            targetAngle = Math.atan2(unitRadialX, -unitRadialY);
            hasTarget = true;
          } else if (vessel.sasMode === 'TARGET') {
            const toMoonX = this.moonX - vessel.x;
            const toMoonY = this.moonY - vessel.y;
            targetAngle = Math.atan2(-toMoonX, toMoonY);
            hasTarget = true;
          }

          if (hasTarget) {
            let angleDiff = targetAngle - vessel.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            controlDemand = Math.max(-1.0, Math.min(1.0, angleDiff * 3.8 - vessel.angularVelocity * 2.4));
          }
        }
      }

      // Discrete Translation Control Channels (Body Frame X and Y)
      if (userControls.translateLeft) transXDemand -= 1.0;
      if (userControls.translateRight) transXDemand += 1.0;
      if (userControls.translateUp) transYDemand += 1.0;
      if (userControls.translateDown) transYDemand -= 1.0;

      if ((transXDemand !== 0 || transYDemand !== 0) && vessel.rcsActive && vessel.monopropRemaining > 0) {
        soundEngine.playRcsSound();
      }
    }

    // Telemetry channels
    vessel.rcsPitchCommand = controlDemand;
    vessel.rcsLateralCommand = transXDemand;
    vessel.rcsTranslationX = transXDemand;
    vessel.rcsTranslationY = transYDemand;

    // Battery electricity consumption (passive avionics + gyroscope active torque draw)
    let drainRate = vessel.hasCommand ? 0.08 : 0.01; // kW base
    if (Math.abs(controlDemand) > 0.05) {
      drainRate += 1.4 * Math.abs(controlDemand); // Gyroscope draw
    }
    vessel.batteryDrainRate = drainRate;

    const netPowerKw = totalSolarGenKw - drainRate;
    vessel.batteryCharge = Math.max(0, Math.min(vessel.batteryMax, vessel.batteryCharge + (netPowerKw / 3600) * dt));

    // Extraterrestrial In-Flight Mining, Refining & Smelting Simulation
    const hasDrill = vessel.parts.some((p) => PART_CATALOG[p.partId]?.isMiningDrill || p.partId === 'mining_drill');
    const hasRefinery = vessel.parts.some((p) => PART_CATALOG[p.partId]?.isRefinery || p.partId === 'refinery_unit');
    const hasSmelter = vessel.parts.some((p) => PART_CATALOG[p.partId]?.isSmelter || p.partId === 'smelter_unit');
    
    // Compute total ore hopper capacity
    let maxOreCapacity = 0;
    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (def?.isOreTank || p.partId === 'ore_tank') {
        const w = getPartWidth(p, def);
        const h = getPartHeight(p, def);
        const vol = Math.PI * Math.pow(w / 2, 2) * h;
        maxOreCapacity += Math.round(2500 * (vol / 9.4));
      }
    });
    if (maxOreCapacity === 0 && hasDrill) maxOreCapacity = 1000; // Small internal sample bay

    // 1. Surface Excavation & Drilling
    const currentSpeed = Math.hypot(vessel.vx, vessel.vy);
    const isLanded = vessel.altitude <= 5.0 || vessel.hasLandedOnMoon || (currentSpeed < 1.0 && vessel.altitude < 50);
    if (vessel.isDrilling && hasDrill && isLanded && vessel.batteryCharge > 0.01) {
      const drillRate = 8.5 * dt; // kg per step
      const powerConsumption = (4.5 / 3600) * dt;
      vessel.batteryCharge = Math.max(0, vessel.batteryCharge - powerConsumption);
      vessel.miningRateKgS = 8.5;
      vessel.totalOreKg = Math.min(maxOreCapacity, (vessel.totalOreKg || 0) + drillRate);
    } else {
      vessel.miningRateKgS = 0;
      if (vessel.isDrilling && (!isLanded || vessel.batteryCharge <= 0.01)) {
        vessel.isDrilling = false; // Auto-stop if no power or airborne
      }
    }

    // 2. Chemical Feedstock Refining
    if (vessel.isRefining && hasRefinery && vessel.totalOreKg > 0.1 && vessel.batteryCharge > 0.02) {
      const oreToRefine = Math.min(vessel.totalOreKg, 4.0 * dt);
      const powerConsumption = (12.0 / 3600) * dt;
      vessel.batteryCharge = Math.max(0, vessel.batteryCharge - powerConsumption);
      vessel.totalOreKg -= oreToRefine;
      vessel.totalRefinedOreKg = (vessel.totalRefinedOreKg || 0) + oreToRefine * 0.8; // 80% yield
    } else if (vessel.isRefining && (vessel.totalOreKg <= 0.1 || vessel.batteryCharge <= 0.02)) {
      vessel.isRefining = false;
    }

    // 3. Vacuum Arc Ingot Smelting
    if (vessel.isSmelting && hasSmelter && vessel.totalRefinedOreKg > 0.1 && vessel.batteryCharge > 0.05) {
      const refinedToSmelt = Math.min(vessel.totalRefinedOreKg, 2.5 * dt);
      const powerConsumption = (24.0 / 3600) * dt;
      vessel.batteryCharge = Math.max(0, vessel.batteryCharge - powerConsumption);
      vessel.totalRefinedOreKg -= refinedToSmelt;
      vessel.totalIngotsKg = (vessel.totalIngotsKg || 0) + refinedToSmelt * 0.9; // 90% yield
    } else if (vessel.isSmelting && (vessel.totalRefinedOreKg <= 0.1 || vessel.batteryCharge <= 0.05)) {
      vessel.isSmelting = false;
    }

    // Active Engine Gimbaling (TVC - Thrust Vector Control)
    const maxGimbalRad = 0.105; // ~6 degrees max deflection
    const targetGimbal = controlDemand * maxGimbalRad;
    const currentGimbal = vessel.gimbalAngle || 0;
    const gimbalSlewRate = 6.0 * dt; // Fast hydraulic actuator slew
    vessel.gimbalAngle = Math.max(
      -maxGimbalRad,
      Math.min(maxGimbalRad, currentGimbal + Math.max(-gimbalSlewRate, Math.min(gimbalSlewRate, targetGimbal - currentGimbal)))
    );

    let totalFuelBurnRate = 0;
    let gimbalTorque = 0;

    // Active engines discovery (needed before effectivePropellantPct so live stage fuel can be computed)
    const stageEngines = vessel.parts.filter((p) => {
      const def = PART_CATALOG[p.partId];
      return def && def.maxThrust > 0 && p.stage === vessel.activeStageIndex;
    });
    const allEngines = vessel.parts.filter((p) => {
      const def = PART_CATALOG[p.partId];
      return def && def.maxThrust > 0;
    });
    const relevantEngines = stageEngines.length > 0 ? stageEngines : allEngines;
    const activeEngines = relevantEngines.filter(
      (p) => p.isEngineOn === true || (p.isEngineOn !== false && p.stage === vessel.activeStageIndex)
    );

    // Check available propellant for stage and vessel before burn.
    // IMPORTANT: We compute live stage fuel directly from tanks connected to active-stage engines.
    // Using stale vessel.stageFuelMass (which is 0 when the PREVIOUS stage just ran dry) would
    // incorrectly prevent 2nd+ stage engines from igniting even when those stages have full tanks.
    const overallFuelPctPre = vessel.maxFuelMass > 0 ? (vessel.fuelMass / vessel.maxFuelMass) * 100 : 0;

    // Compute live stage fuel from tanks physically connected to current-stage engines
    const liveStageEngines = stageEngines.length > 0 ? stageEngines : activeEngines;
    const liveStageTankUids = new Set<string>();
    let liveStageFuelRem = 0;
    let liveStageFuelMax = 0;
    liveStageEngines.forEach((eng) => {
      const tanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
      tanks.forEach((t) => {
        if (!liveStageTankUids.has(t.uid)) {
          liveStageTankUids.add(t.uid);
          liveStageFuelRem += t.fuelRemaining ?? (t.maxFuel ?? 0);
          liveStageFuelMax += t.maxFuel ?? 0;
        }
      });
    });
    // Fall back to vessel-level stage accounting when no connected tanks found
    const stageFuelMaxPre = liveStageFuelMax > 0 ? liveStageFuelMax : (vessel.stageMaxFuelMass > 0 ? vessel.stageMaxFuelMass : vessel.maxFuelMass);
    const stageFuelRemPre = liveStageFuelMax > 0 ? liveStageFuelRem : (vessel.stageFuelMass !== undefined ? vessel.stageFuelMass : vessel.fuelMass);
    const stageFuelPctPre = stageFuelMaxPre > 0 ? (stageFuelRemPre / stageFuelMaxPre) * 100 : (vessel.fuelPercent || 0);
    const effectivePropellantPct = Math.min(overallFuelPctPre, stageFuelPctPre > 0 ? stageFuelPctPre : overallFuelPctPre);

    // Warning at fuel low to 10%
    if (effectivePropellantPct <= 10.0 && effectivePropellantPct > 0.0001 && vessel.throttle > 0.001) {
      vessel.lowFuelWarning = true;
    } else {
      vessel.lowFuelWarning = false;
    }

    // Engine toggle set to (n-- , till n =0, from 5 % fuel remaining )
    if (effectivePropellantPct <= 5.0 && effectivePropellantPct > 0.0001 && vessel.throttle > 0) {
      vessel.isFuelCritical = true;
      // Step-down throttle scale from 5% down to 0%
      const sputterThrottleCap = Math.max(0, effectivePropellantPct / 5.0);
      if (vessel.throttle > sputterThrottleCap) {
        // Step down throttle smoothly towards 0 as propellant lines cavitate
        vessel.throttle = Math.max(0, vessel.throttle - dt * 0.4);
        vessel.throttle = Math.min(vessel.throttle, sputterThrottleCap);
      }
    } else {
      vessel.isFuelCritical = false;
    }

    const hasLiveSolidEngine = activeEngines.some((eng) => {
      const def = PART_CATALOG[eng.partId];
      const isSolid = Boolean(def?.isSRB || eng.engineConfig?.engineType === 'Solid' || eng.propellantType === 'solid');
      if (!isSolid) return false;
      const targetTanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
      return targetTanks.reduce((s, t) => s + (t.fuelRemaining || 0), 0) > 0.0001 || (eng.fuelRemaining || 0) > 0.0001;
    });

    if ((vessel.throttle > 0.001 || hasLiveSolidEngine) && (effectivePropellantPct > 0.0001 || hasLiveSolidEngine)) {
      if (activeEngines.length > 0) {
        activeEngines.forEach((eng) => {
          const def = PART_CATALOG[eng.partId];
          if (!def) return;

          let engineThrustVac = def.maxThrust;
          let engineIspSL = def.ispSL;
          let engineIspVac = def.ispVac;
          const isSolid = Boolean(def.isSRB || eng.engineConfig?.engineType === 'Solid' || eng.propellantType === 'solid');

          if (eng.engineConfig) {
            const perf = calculateJunoEnginePerformance(eng.engineConfig);
            engineThrustVac = perf.thrustVac;
            engineIspSL = perf.ispSL;
            engineIspVac = perf.ispVac;
          }

          // Atmospheric vs Vacuum Isp
          const isp = rho > 0 ? engineIspSL + (engineIspVac - engineIspSL) * (1 - Math.min(1, rho / 1.225)) : engineIspVac;

          // Solid Grain factor and thrust calculation:
          // SRB fires at rated grain thrust once ignited, regardless of liquid engine throttle!
          let grainFactor = 1.0;
          if (isSolid) {
            const solidCap = eng.maxFuel || (eng.engineConfig ? (eng.engineConfig.engineSizePercent / 50) * 12.0 : (def.fuelMass || 12.0));
            const fRatio = Math.max(0, Math.min(1.0, (eng.fuelRemaining || 0) / Math.max(0.1, solidCap)));
            if (eng.engineConfig?.solidGrain === 'Ramp Down') {
              grainFactor = 0.7 + 0.6 * fRatio;
            } else if (eng.engineConfig?.solidGrain === 'Ramp Up') {
              grainFactor = 1.3 - 0.5 * fRatio;
            } else if (eng.engineConfig?.solidGrain === 'Impulse') {
              grainFactor = 0.5 + 0.9 * Math.pow(fRatio, 0.5);
            }
          }

          const engineMaxThrust = isSolid
            ? (engineThrustVac * grainFactor)
            : (engineThrustVac * vessel.throttle);

          let actualThrust = 0;
          if (isSolid) {
            // Deduct solid fuel directly from the SRB motor first, and then connected solid tanks
            const targetTanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
            const totalAvailableSolid = targetTanks.reduce((sum, t) => sum + (t.fuelRemaining || 0), 0);

            if (totalAvailableSolid > 0.0001) {
              const fuelBurnRate = engineMaxThrust / (isp * 9.80665);
              const fuelToBurn = Math.min(totalAvailableSolid, fuelBurnRate * dt);
              
              let leftToBurn = fuelToBurn;
              if (eng.fuelRemaining !== undefined && eng.fuelRemaining > 0) {
                const deduct = Math.min(eng.fuelRemaining, leftToBurn);
                eng.fuelRemaining = Math.max(0, eng.fuelRemaining - deduct);
                leftToBurn -= deduct;
              }
              if (leftToBurn > 0.000001) {
                for (const t of targetTanks) {
                  if (t.uid !== eng.uid && t.fuelRemaining && t.fuelRemaining > 0) {
                    const deduct = Math.min(t.fuelRemaining, leftToBurn);
                    t.fuelRemaining = Math.max(0, t.fuelRemaining - deduct);
                    leftToBurn -= deduct;
                    if (leftToBurn <= 0.000001) break;
                  }
                }
              }

              actualThrust = (fuelBurnRate > 0 && fuelToBurn > 0) ? (fuelToBurn / (fuelBurnRate * dt)) * engineMaxThrust : 0;
              totalActiveThrust += actualThrust;
              totalFuelBurnRate += fuelBurnRate;
            } else {
              // Solid booster burnout - toggle engine off
              eng.isEngineOn = false;
            }
          } else {
            // Liquid fuel engine: find available propellant tanks via structural connection graph!
            const targetTanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
            const totalAvailableFuelInTarget = targetTanks.reduce((sum, t) => sum + (t.fuelRemaining || 0), 0);

            if (totalAvailableFuelInTarget > 0.0001) {
              const fuelBurnRate = engineMaxThrust / (isp * 9.80665);
              const desiredFuelToBurn = fuelBurnRate * dt;
              const actualFuelToBurn = Math.min(totalAvailableFuelInTarget, desiredFuelToBurn);

              let remainingToBurn = actualFuelToBurn;
              for (const tank of targetTanks) {
                if (tank.fuelRemaining && tank.fuelRemaining > 0) {
                  const deduct = Math.min(tank.fuelRemaining, remainingToBurn);
                  tank.fuelRemaining -= deduct;
                  remainingToBurn -= deduct;
                  if (remainingToBurn <= 0.000001) break;
                }
              }

              const thrustRatio = desiredFuelToBurn > 0 ? actualFuelToBurn / desiredFuelToBurn : 0;
              actualThrust = engineMaxThrust * thrustRatio;
              totalActiveThrust += actualThrust;
              totalFuelBurnRate += fuelBurnRate * thrustRatio;
            } else {
              // Connected tanks dry - toggle engine off
              eng.isEngineOn = false;
            }
          }

          // TVC Gimbal Torque contribution from this engine
          if (actualThrust > 0 && !def.isSRB) {
            const leverArm = Math.max(1.5, comY - eng.y);
            gimbalTorque += actualThrust * Math.sin(vessel.gimbalAngle || 0) * leverArm;
          }
        });

        // Recalculate vessel fuel and mass immediately after burning so flight telemetry and physics are in sync
        let currentFuelTotalPost = 0;
        let maxFuelTotalPost = 0;
        let currentStageFuelPost = 0;
        let currentStageMaxFuelPost = 0;

        // Build connected tank UIDs from currently active engines (correct stage fuel accounting)
        const connectedTankUidsPostBurn = new Set<string>();
        activeEngines.forEach((eng) => {
          const tanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
          tanks.forEach((t) => connectedTankUidsPostBurn.add(t.uid));
        });

        vessel.parts.forEach((p) => {
          const def = PART_CATALOG[p.partId];
          if (!def) return;
          const isSolidP = Boolean(def.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');
          const solidCap = isSolidP ? (p.maxFuel || def.fuelMass || (p.engineConfig ? (p.engineConfig.engineSizePercent / 50) * 12.0 : 12.0)) : 0;
          const pMax = p.maxFuel || def.fuelMass || solidCap;
          if (p.fuelRemaining !== undefined || pMax > 0) {
            const pRem = p.fuelRemaining !== undefined ? p.fuelRemaining : pMax;
            currentFuelTotalPost += pRem;
            maxFuelTotalPost += pMax;
            // Use connectedTankUids (tanks actually feeding engines) — not engine parts themselves
            if (p.stage === vessel.activeStageIndex || connectedTankUidsPostBurn.has(p.uid)) {
              currentStageFuelPost += pRem;
              currentStageMaxFuelPost += pMax;
            }
          }
        });

        vessel.fuelMass = currentFuelTotalPost;
        vessel.totalFuelMass = currentFuelTotalPost;
        vessel.maxFuelMass = maxFuelTotalPost;
        vessel.fuelPercent = maxFuelTotalPost > 0 ? (currentFuelTotalPost / maxFuelTotalPost) * 100 : 0;
        vessel.stageFuelMass = currentStageFuelPost;
        vessel.stageMaxFuelMass = currentStageMaxFuelPost;
        vessel.mass = this.calculateTotalMass(vessel.parts);

        // Check if active engines have run out of propellant
        const hasLiveEnginesWithFuel = activeEngines.some((eng) => {
          const def = PART_CATALOG[eng.partId];
          if (!def) return false;
          const isSolid = Boolean(def.isSRB || eng.engineConfig?.engineType === 'Solid' || eng.propellantType === 'solid');
          if (isSolid) {
            const solidTanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
            return solidTanks.reduce((s, t) => s + (t.fuelRemaining || 0), 0) > 0.0001 || (eng.fuelRemaining || 0) > 0.0001;
          }
          const targetTanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
          return targetTanks.reduce((sum, t) => sum + (t.fuelRemaining || 0), 0) > 0.0001;
        });

        // Engines go off if fuel is empty!
        // NOTE: We do NOT check currentStageFuelPost here because it can be 0 for a newly-activated stage
        // whose tanks haven't been summed into the post-burn telemetry yet. Instead rely on hasLiveEnginesWithFuel
        // which checks actual connected tanks per engine, giving a true picture.
        if (!hasLiveEnginesWithFuel || (currentFuelTotalPost <= 0.0001 && !hasLiveSolidEngine)) {
          activeEngines.forEach((eng) => {
            eng.isEngineOn = false;
          });
          vessel.throttle = 0;
          vessel.isEngineOn = false;
          vessel.engineFlameout = true;
          vessel.lowFuelWarning = false;
          vessel.isFuelCritical = false;
        }

        // Thrust acceleration: F / m (in m/s^2) aligned with deflected nozzle
        const thrustAngle = vessel.angle + (vessel.gimbalAngle || 0);
        const thrustDirX = -Math.sin(thrustAngle);
        const thrustDirY = Math.cos(thrustAngle);
        thrustFx = (thrustDirX * totalActiveThrust) / Math.max(0.5, vessel.mass);
        thrustFy = (thrustDirY * totalActiveThrust) / Math.max(0.5, vessel.mass);
      }
    } else if (effectivePropellantPct <= 0.0001 || vessel.fuelMass <= 0.0001) {
      // Fuel is completely empty - ensure engine toggle is OFF and throttle is 0
      vessel.parts.forEach((p) => {
        const def = PART_CATALOG[p.partId];
        if (def && def.maxThrust > 0) {
          p.isEngineOn = false;
        }
      });
      vessel.throttle = 0;
      vessel.isEngineOn = false;
      vessel.engineFlameout = true;
      vessel.lowFuelWarning = false;
      vessel.isFuelCritical = false;
    }

    vessel.fuelFlowRate = totalFuelBurnRate;
    vessel.estimatedBurnTime = totalFuelBurnRate > 0 ? vessel.fuelMass / totalFuelBurnRate : 0;

    const localG = activeBody.surfaceGravity * Math.pow(activeBody.radius / Math.max(activeBody.radius, r), 2);
    vessel.currentTWR = vessel.mass > 0 ? totalActiveThrust / (vessel.mass * localG) : 0;

    // 5. Attitude Control & Positional Thruster Physics
    // Moment of Inertia from true distributed part masses and offsets from CoM (Parallel Axis Theorem)
    let momentOfInertia = 0;
    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      const m = (def ? def.dryMass : 1) + (p.fuelRemaining || 0) + (p.ablatorRemaining || 0);
      const dx = p.x - comX;
      const dy = p.y - comY;
      const w = def ? getPartWidth(p, def) : 1.0;
      const h = def ? getPartHeight(p, def) : 1.0;
      const iLocal = (m / 12) * (w * w + h * h);
      momentOfInertia += iLocal + m * (dx * dx + dy * dy);
    });
    momentOfInertia = Math.max(1.5, momentOfInertia);

    // Positional RCS Thruster Simulation (Torque = Sum(r x F), Translation = Sum(F))
    let totalRcsFxBody = 0; // Lateral thrust in rocket body frame (kN)
    let totalRcsFyBody = 0; // Axial thrust in rocket body frame (kN)
    let totalRcsTorque = 0; // Rotational torque about live CoM (kNm)
    let totalRcsBurnRate = 0; // Monoprop burn rate in kg/s

    const hasBatteryPower = vessel.batteryCharge > 0.001;
    const hasMonoprop = vessel.monopropRemaining > 0.0001;
    const rcsEnabled = vessel.rcsActive && hasMonoprop && vessel.hasCommand;

    if (rcsEnabled) {
      vessel.parts.forEach((p) => {
        const def = PART_CATALOG[p.partId];
        if (!def || !def.isRCS) return;

        // Position vector relative to live Center of Mass
        const rx = p.x - comX;
        const ry = p.y - comY;
        const distFromCoM = Math.hypot(rx, ry);

        const thrusterType = p.rcsThrusterType || def.rcsThrusterType || 'rcs_3way_cluster';
        const baseThrustKn = p.rcsThrustKn || def.rcsThrustKn || 1.2;

        let partFxBody = 0;
        let partFyBody = 0;

        if (thrusterType === 'rcs_fixed_single') {
          // Fixed single nozzle pointing in designated direction
          let nx = 0;
          let ny = 0;
          if (p.rotation === 90) { nx = 0; ny = 1; }
          else if (p.rotation === 180) { nx = -1; ny = 0; }
          else if (p.rotation === 270) { nx = 0; ny = -1; }
          else if (p.rotation === 0 && p.x > 0.1) { nx = 1; ny = 0; }
          else if (p.rotation === 0 && p.x < -0.1) { nx = -1; ny = 0; }
          else if (p.x < -0.05) { nx = -1; ny = 0; }
          else if (p.x > 0.05) { nx = 1; ny = 0; }
          else if (ry >= 0) { nx = 0; ny = 1; }
          else { nx = 0; ny = -1; }

          // Unit torque produced by this nozzle: tau = rx * ny - ry * nx
          const unitTorque = rx * ny - ry * nx;

          // Rotation demand
          let rotEffort = 0;
          if (controlDemand !== 0) {
            if ((controlDemand > 0 && unitTorque > 0.05) || (controlDemand < 0 && unitTorque < -0.05)) {
              rotEffort = Math.abs(controlDemand);
            }
          }

          // Translation demand
          let transEffort = 0;
          const transProj = transXDemand * nx + transYDemand * ny;
          if (transProj > 0) transEffort = Math.min(1.0, transProj);

          const effort = Math.min(1.0, rotEffort + transEffort);
          if (effort > 0.01) {
            partFxBody = effort * baseThrustKn * nx;
            partFyBody = effort * baseThrustKn * ny;
          }
        } else if (thrusterType === 'rcs_3way_cluster') {
          // 3-directional cluster: 1 lateral nozzle + 1 up nozzle + 1 down nozzle
          const latDirX = p.x >= 0 ? 1 : -1;
          const nozzles = [
            { nx: latDirX, ny: 0 },
            { nx: 0, ny: 1 },
            { nx: 0, ny: -1 },
          ];

          nozzles.forEach((noz) => {
            const unitTorque = rx * noz.ny - ry * noz.nx;
            let rotEffort = 0;
            if (controlDemand !== 0) {
              if ((controlDemand > 0 && unitTorque > 0.05) || (controlDemand < 0 && unitTorque < -0.05)) {
                rotEffort = Math.abs(controlDemand);
              }
            }
            let transEffort = 0;
            const transProj = transXDemand * noz.nx + transYDemand * noz.ny;
            if (transProj > 0) transEffort = Math.min(1.0, transProj);
            const effort = Math.min(1.0, rotEffort + transEffort);
            if (effort > 0.01) {
              partFxBody += effort * (baseThrustKn / 3) * noz.nx;
              partFyBody += effort * (baseThrustKn / 3) * noz.ny;
            }
          });
        } else if (thrusterType === 'rcs_gimbal_vernier') {
          // Gimbaling single-nozzle vernier thruster
          const d = Math.max(0.2, distFromCoM);
          const tangX = -ry / d;
          const tangY = rx / d;

          const rotFx = controlDemand * tangX * baseThrustKn;
          const rotFy = controlDemand * tangY * baseThrustKn;

          const transFx = transXDemand * baseThrustKn;
          const transFy = transYDemand * baseThrustKn;

          const desiredFx = rotFx + transFx;
          const desiredFy = rotFy + transFy;
          const desiredMag = Math.hypot(desiredFx, desiredFy);

          if (desiredMag > 0.02) {
            const targetAngleRad = Math.atan2(desiredFy, desiredFx);
            const currentGimbal = p.rcsGimbalAngleRad || 0;
            const maxGimbalSlew = 12.0 * dt;
            let angleDiff = targetAngleRad - currentGimbal;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            p.rcsGimbalAngleRad = currentGimbal + Math.max(-maxGimbalSlew, Math.min(maxGimbalSlew, angleDiff));

            const actThrust = Math.min(baseThrustKn, desiredMag);
            partFxBody = actThrust * Math.cos(p.rcsGimbalAngleRad);
            partFyBody = actThrust * Math.sin(p.rcsGimbalAngleRad);
          }
        } else {
          // Multi-way quad/penta/linear clusters
          const nozzles = [
            { nx: 1, ny: 0 },
            { nx: -1, ny: 0 },
            { nx: 0, ny: 1 },
            { nx: 0, ny: -1 },
          ];
          const thrustPerNozzle = baseThrustKn / 4;
          nozzles.forEach((noz) => {
            const unitTorque = rx * noz.ny - ry * noz.nx;
            let rotEffort = 0;
            if (controlDemand !== 0) {
              if ((controlDemand > 0 && unitTorque > 0.05) || (controlDemand < 0 && unitTorque < -0.05)) {
                rotEffort = Math.abs(controlDemand);
              }
            }
            let transEffort = 0;
            const transProj = transXDemand * noz.nx + transYDemand * noz.ny;
            if (transProj > 0) transEffort = Math.min(1.0, transProj);
            const effort = Math.min(1.0, rotEffort + transEffort);
            if (effort > 0.01) {
              partFxBody += effort * thrustPerNozzle * noz.nx;
              partFyBody += effort * thrustPerNozzle * noz.ny;
            }
          });
        }

        // Positional rotational torque around CoM: tau = rx * Fy - ry * Fx
        const partTorque = rx * partFyBody - ry * partFxBody;

        totalRcsFxBody += partFxBody;
        totalRcsFyBody += partFyBody;
        totalRcsTorque += partTorque;

        const partThrustMag = Math.hypot(partFxBody, partFyBody);
        if (partThrustMag > 0.01) {
          totalRcsBurnRate += (partThrustMag / 260) * 0.0035;
        }
      });

      // Deduct monopropellant based on actual thruster burn rate
      if (totalRcsBurnRate > 0) {
        const monopropBurn = totalRcsBurnRate * dt;
        let remainingToDeduct = monopropBurn;
        for (const p of vessel.parts) {
          if (p.partId === 'tank_rcs_monoprop' || PART_CATALOG[p.partId]?.monopropMass) {
            if (p.fuelRemaining && p.fuelRemaining > 0) {
              const deduct = Math.min(p.fuelRemaining, remainingToDeduct);
              p.fuelRemaining -= deduct;
              remainingToDeduct -= deduct;
              if (remainingToDeduct <= 0) break;
            }
          }
        }
        vessel.monopropRemaining = Math.max(0, vessel.monopropRemaining - monopropBurn);
      }
    }

    // Convert RCS body frame forces to world frame based on vessel angle
    const rcsWorldFx = totalRcsFxBody * Math.cos(vessel.angle) - totalRcsFyBody * Math.sin(vessel.angle);
    const rcsWorldFy = totalRcsFxBody * Math.sin(vessel.angle) + totalRcsFyBody * Math.cos(vessel.angle);

    // Apply translational RCS force directly to world acceleration
    const vesselMass = Math.max(0.5, vessel.mass);
    thrustFx += rcsWorldFx / vesselMass;
    thrustFy += rcsWorldFy / vesselMass;

    // Reaction Wheels pure torque
    let rwTorqueTotal = 0;
    if (hasBatteryPower && vessel.hasCommand) {
      vessel.parts.forEach((p) => {
        const def = PART_CATALOG[p.partId];
        if (def?.torque) rwTorqueTotal += def.torque;
        if (def?.hasReactionWheel) rwTorqueTotal += 40.0;
      });
      if (rwTorqueTotal > 0) {
        rwTorqueTotal = Math.max(rwTorqueTotal, vessel.mass * 2.2);
      }
    }
    const rwTorque = controlDemand * rwTorqueTotal;

    // Aerodynamic restoring moment (fins)
    let aeroStabilityTorque = 0;
    if (rho > 0.01 && speed > 5.0) {
      const progradeAngle = Math.atan2(-relVx, relVy);
      let aoaRad = vessel.angle - progradeAngle;
      while (aoaRad > Math.PI) aoaRad -= Math.PI * 2;
      while (aoaRad < -Math.PI) aoaRad += Math.PI * 2;

      vessel.aoa = aoaRad * (180 / Math.PI);

      const fins = vessel.parts.filter((p) => p.partId === 'aerodynamic_fin' || p.partId === 'grid_fin');
      const finCount = Math.max(fins.length, 1);
      const finPower = finCount * 25.0 * (rho / 1.225) * Math.min(3.0, speed / 60);
      aeroStabilityTorque = -Math.sin(aoaRad) * finPower;
    } else {
      vessel.aoa = 0;
    }

    // Total rotational torque applied
    const appliedTorque = gimbalTorque + aeroStabilityTorque + rwTorque + totalRcsTorque;

    // Angular acceleration derived from torque and distributed moment of inertia
    const angularAcc = appliedTorque / momentOfInertia;
    vessel.angularVelocity += angularAcc * dt;
    vessel.angularVelocity *= Math.exp(-0.35 * dt); // Continuous natural damping
    vessel.angle += vessel.angularVelocity * dt;

    // Telemetry updates
    vessel.rcsTorqueNm = totalRcsTorque;
    vessel.rcsThrustKnTotal = Math.hypot(totalRcsFxBody, totalRcsFyBody);

    // 6. Integrate Position & Velocity
    const totalAx = gx + dragFx + thrustFx;
    const totalAy = gy + dragFy + thrustFy;

    // G-force calculation
    const thrustAndDragA = Math.hypot(dragFx + thrustFx, dragFy + thrustFy);
    vessel.gForce = Math.max(0, thrustAndDragA / 9.81);

    // 6. Integrate Position & Velocity
    if (vessel.isLanded) {
      // Calculate surface normal vector
      const curRelX = vessel.soi === 'moon' ? vessel.x - this.moonX : vessel.x;
      const curRelY = vessel.soi === 'moon' ? vessel.y - this.moonY : vessel.y;
      const curR = Math.hypot(curRelX, curRelY) || 1;
      const nx = curRelX / curR;
      const ny = curRelY / curR;

      // Outward radial thrust pushing away from planet center
      const radialThrust = thrustFx * nx + thrustFy * ny;
      const radialGravity = activeBody.surfaceGravity;

      // Liftoff occurs ONLY when net upward thrust exceeds gravity and throttle is active
      if (vessel.throttle > 0.01 && radialThrust > radialGravity) {
        vessel.isLanded = false;
        vessel.vx += totalAx * dt;
        vessel.vy += totalAy * dt;
        vessel.x += vessel.vx * dt;
        vessel.y += vessel.vy * dt;
        const newDist = Math.hypot(
          vessel.soi === 'moon' ? vessel.x - this.moonX : vessel.x,
          vessel.soi === 'moon' ? vessel.y - this.moonY : vessel.y
        );
        vessel.altitude = Math.max(0, newDist - activeBody.radius);
      } else {
        // Ground normal force balances gravitational pull; vessel rests securely on pad/surface
        vessel.isLanded = true;
        vessel.isCrashed = false;
        vessel.altitude = 0;
        vessel.verticalSpeed = 0;
        vessel.horizontalSpeed = 0;
        vessel.angularVelocity = 0;
        if (vessel.soi === 'earth') {
          vessel.angle = 0; // Upright on launchpad
        }

        if (vessel.soi === 'moon') {
          vessel.x = this.moonX + nx * activeBody.radius;
          vessel.y = this.moonY + ny * activeBody.radius;
          vessel.vx = this.moonVx;
          vessel.vy = this.moonVy;
          vessel.hasLandedOnMoon = true;
        } else {
          vessel.x = nx * activeBody.radius;
          vessel.y = ny * activeBody.radius;
          vessel.vx = 0;
          vessel.vy = 0;
        }
      }
    } else {
      // In flight: integrate velocity and position
      vessel.vx += totalAx * dt;
      vessel.vy += totalAy * dt;
      vessel.x += vessel.vx * dt;
      vessel.y += vessel.vy * dt;

      // 7. Terrain Collision & Landing Detection (Earth & Moon)
      const newRelX = vessel.soi === 'moon' ? vessel.x - this.moonX : vessel.x;
      const newRelY = vessel.soi === 'moon' ? vessel.y - this.moonY : vessel.y;
      const newR = Math.hypot(newRelX, newRelY);

      const isDescending = (newRelX * vessel.vx + newRelY * vessel.vy) <= 0.05;

      if (newR <= activeBody.radius && isDescending) {
        // Vessel has contacted the surface while descending in flight
        const impactSpeed = speed;

        // Gather all deployed landing legs
        const deployedLegParts = vessel.parts.filter((p) => {
          const d = PART_CATALOG[p.partId];
          const isLegOn = p.deployed === true || (p.deployProgress !== undefined && p.deployProgress > 0.45) || vessel.landingLegsDeployed;
          return d?.isLandingLeg && isLegOn;
        });

        const hasParachuteOn = Boolean(
          vessel.parachutesDeployed ||
          vessel.parts.some((p) => {
            const d = PART_CATALOG[p.partId];
            return d?.isParachute && (p.deployed === true || vessel.parachutesDeployed);
          })
        );

        // Compute aggregate mechanical gear stats based on active leg parts
        let baseImpactTolerance = 4.0; // Bare hull or no deployed legs
        let effectiveStanceWidth = 2.0; // Default narrow hull width
        let averageSpringStiffness = 1.0;
        let averageDamping = 0.8;
        let maxCompressionM = 0.3;

        if (deployedLegParts.length > 0) {
          // Average or pick best attributes of attached legs
          let sumTolerance = 0;
          let sumStance = 0;
          let sumStiffness = 0;
          let sumDamping = 0;
          let sumCompression = 0;

          deployedLegParts.forEach((lp) => {
            const def = PART_CATALOG[lp.partId];
            sumTolerance += def?.impactToleranceMs || 10.5;
            sumStance += def?.stanceWidthM || 3.2;
            sumStiffness += def?.springStiffness || 1.0;
            sumDamping += def?.suspensionDamping || 0.85;
            sumCompression += def?.maxCompressionM || 0.45;
          });

          const nLegs = deployedLegParts.length;
          baseImpactTolerance = sumTolerance / nLegs;
          effectiveStanceWidth = sumStance / nLegs;
          averageSpringStiffness = sumStiffness / nLegs;
          averageDamping = sumDamping / nLegs;
          maxCompressionM = sumCompression / nLegs;

          // Multi-leg stability bonus: having at least 2 legs provides optimal stance baseline
          if (nLegs >= 2) {
            effectiveStanceWidth *= 1.15;
          }
        }

        // Parachutes provide additional descent impact cushioning (+2.5 m/s)
        if (hasParachuteOn) {
          baseImpactTolerance += 2.5;
        }

        // Calculate surface normal angle and craft tilt relative to ground
        const surfNormalAngle = Math.atan2(newRelX, newRelY);
        let tiltAngle = Math.abs(vessel.angle - surfNormalAngle);
        while (tiltAngle > Math.PI) tiltAngle = Math.abs(tiltAngle - Math.PI * 2);

        // Slope / tilt-over resistance derived from mechanical stance width and CoM height
        const comDistFromBase = Math.max(1.2, Math.abs(comY));
        const maxTipOverAngleRad = Math.atan2(effectiveStanceWidth * 0.5, comDistFromBase);

        // Check if craft exceeds tip-over angle on landing
        const isTippedOver = tiltAngle > maxTipOverAngleRad;

        // Check impact speed against mechanical leg tolerance
        const isWithinImpactTolerance = impactSpeed <= baseImpactTolerance;
        const isSafeLanding = isWithinImpactTolerance && !isTippedOver;

        if (!isSafeLanding) {
          // Check if legs buckle/collapse before total vehicle destruction
          if (!isTippedOver && impactSpeed <= baseImpactTolerance * 1.35) {
            // Legs crushed under excessive kinetic impact! Hull damaged
            deployedLegParts.forEach((lp) => {
              lp.deployed = false;
              lp.deployProgress = 0;
            });
            vessel.landingLegsDeployed = false;
          }
          // Crash / Explosion
          vessel.isCrashed = true;
          vessel.throttle = 0;
          soundEngine.playExplosionSound();
        } else {
          // Safe Touchdown / Landed
          vessel.isCrashed = false;
          vessel.isLanded = true;
          vessel.altitude = 0;
          vessel.verticalSpeed = 0;
          vessel.horizontalSpeed = 0;
          vessel.angularVelocity = 0;

          // Leg suspension compression telemetry (0.0 to 1.0)
          const actualCompression = Math.min(1.0, impactSpeed / Math.max(1.0, baseImpactTolerance));
          vessel.landingGearCompression = actualCompression;

          if (impactSpeed > 2.0) {
            vessel.throttle = 0;
            soundEngine.playVictoryFanfare();
          }

          // Snap unit vectors
          const surfUnitX = newRelX / (newR || 1);
          const surfUnitY = newRelY / (newR || 1);
          const surfX = surfUnitX * activeBody.radius;
          const surfY = surfUnitY * activeBody.radius;

          if (vessel.soi === 'moon') {
            vessel.x = this.moonX + surfX;
            vessel.y = this.moonY + surfY;
            vessel.vx = this.moonVx;
            vessel.vy = this.moonVy;
            vessel.hasLandedOnMoon = true;
          } else {
            vessel.x = surfX;
            vessel.y = surfY;
            vessel.vx = 0;
            vessel.vy = 0;
          }
        }
      }
    }

    // 8. Update Debris Simulation (Physical separation trajectory, aerodynamic drag, tumbling, and lifecycle management)
    // =========================================================================
    // DEBRIS LIFECYCLE & RETIREMENT SPECIFICATION (Simple Rocket 2 / KSP Concept)
    // =========================================================================
    // 1. Physical Trajectory:
    //    Detached stages and booster clusters inherit parent vessel velocity plus
    //    ejection impulse (radial outward for boosters, downward for stack decouplers)
    //    and tumble under full 2-body gravity and atmospheric drag.
    // 2. Lifecycle & Despawn Policy:
    //    - Surface Impact: Colliding with terrain (dist <= activeBody.radius) triggers
    //      detonation sound and immediate destruction.
    //    - Deep Atmospheric Vaporization: Falling into dense lower atmosphere with high
    //      speed or ablated mass <= 0 completely burns up the debris.
    //    - Distance & Tracking Horizon:
    //      * Orbital debris in vacuum with periapsis > atmosphereHeight is preserved
    //        as trackable orbital objects up to a global cap of 40 objects.
    //      * Suborbital or atmospheric debris that drifts farther than 150 km from the
    //        active craft is automatically culled to conserve physics memory and frame rate.
    // =========================================================================
    const MAX_TRACKABLE_DEBRIS = 40;
    const SUBORBITAL_CULL_DISTANCE = 150000; // 150 km from active vessel

    vessel.debris.forEach((deb) => {
      const dRelX = vessel.soi === 'moon' ? deb.x - this.moonX : deb.x;
      const dRelY = vessel.soi === 'moon' ? deb.y - this.moonY : deb.y;
      const dR = Math.hypot(dRelX, dRelY);
      const dG = -activeBody.mu / (dR * dR * dR);

      // Full two-body gravitational acceleration
      deb.vx += dRelX * dG * dt;
      deb.vy += dRelY * dG * dt;

      // Atmospheric aerodynamic drag & re-entry thermal ablation on tumbling detached debris
      const dAlt = dR - activeBody.radius;
      if (vessel.soi === 'earth' && dAlt < activeBody.atmosphereHeight && activeBody.atmosphereHeight > 0) {
        const dRho = 1.225 * Math.exp(-Math.max(0, dAlt) / activeBody.scaleHeight);
        const dSpeed = Math.hypot(deb.vx, deb.vy);
        const dDrag = 0.5 * dRho * dSpeed * dSpeed * 0.55;
        if (dSpeed > 0.01) {
          deb.vx -= (deb.vx / dSpeed) * (dDrag / Math.max(0.2, deb.mass)) * dt;
          deb.vy -= (deb.vy / dSpeed) * (dDrag / Math.max(0.2, deb.mass)) * dt;
        }

        // Aerodynamic tumbling torque dampening and windward inducing
        deb.angularVelocity += (Math.sin(deb.angle) * 0.2 - deb.angularVelocity * 0.05) * dt;

        // Severe re-entry thermal flux ablates and vaporizes unprotected debris
        const dHeatFlux = 0.5 * dRho * Math.pow(dSpeed, 3) * 0.00006;
        if (dHeatFlux > 500) {
          deb.mass -= dt * 35;
        }
      }

      deb.x += deb.vx * dt;
      deb.y += deb.vy * dt;
      deb.angle += deb.angularVelocity * dt;
    });

    // Enforce Debris Lifecycle Rule: Terrain Impact, Atmospheric Burnup, and Distance Cull
    vessel.debris = vessel.debris.filter((deb) => {
      const dRelX = vessel.soi === 'moon' ? deb.x - this.moonX : deb.x;
      const dRelY = vessel.soi === 'moon' ? deb.y - this.moonY : deb.y;
      const dist = Math.hypot(dRelX, dRelY);

      // 1. Terrain Impact
      if (dist <= activeBody.radius) {
        soundEngine.playExplosionSound();
        return false;
      }

      // 2. Re-entry Vaporization (mass ablated to zero)
      if (deb.mass <= 0) {
        soundEngine.playExplosionSound();
        return false;
      }

      // 3. Distance Cull for off-screen suborbital debris
      const distFromCraft = Math.hypot(deb.x - vessel.x, deb.y - vessel.y);
      const dAlt = dist - activeBody.radius;
      const isInsideAtmosphere = dAlt < (activeBody.atmosphereHeight || 0);

      // If deep in atmosphere and drifting far away, or beyond 150 km while suborbital, cull
      if (isInsideAtmosphere && distFromCraft > 50000) {
        return false;
      }
      if (distFromCraft > SUBORBITAL_CULL_DISTANCE && dAlt < 100000) {
        return false;
      }

      return true;
    });

    // Cap orbital trackable debris to prevent memory bloat
    if (vessel.debris.length > MAX_TRACKABLE_DEBRIS) {
      vessel.debris.splice(0, vessel.debris.length - MAX_TRACKABLE_DEBRIS);
    }

    // Sanitize vessel state to prevent NaN / Infinity propagation that crashes canvas and React rendering
    if (!Number.isFinite(vessel.x) || !Number.isFinite(vessel.y)) {
      vessel.x = 0;
      vessel.y = activeBody.radius;
    }
    if (!Number.isFinite(vessel.vx)) vessel.vx = 0;
    if (!Number.isFinite(vessel.vy)) vessel.vy = 0;
    if (!Number.isFinite(vessel.angle)) vessel.angle = 0;
    if (!Number.isFinite(vessel.angularVelocity)) vessel.angularVelocity = 0;
    if (!Number.isFinite(vessel.altitude)) vessel.altitude = Math.max(0, Math.hypot(vessel.x, vessel.y) - activeBody.radius);
    if (!Number.isFinite(vessel.surfaceSpeed)) vessel.surfaceSpeed = Math.hypot(vessel.vx, vessel.vy);
    if (!Number.isFinite(vessel.verticalSpeed)) vessel.verticalSpeed = 0;
    if (!Number.isFinite(vessel.horizontalSpeed)) vessel.horizontalSpeed = 0;
    if (!Number.isFinite(vessel.throttle)) vessel.throttle = 0;
    if (!Number.isFinite(vessel.currentTWR)) vessel.currentTWR = 0;
    if (!Number.isFinite(vessel.dynamicPressure)) vessel.dynamicPressure = 0;
    if (!Number.isFinite(vessel.heatFlux)) vessel.heatFlux = 0;

    // Recalculate vessel mass and propellant telemetry post-burn so HUD updates every frame
    let postDry = 0;
    let postFuel = 0;
    let postMaxFuel = 0;
    let postStageFuel = 0;
    let postStageMaxFuel = 0;

    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;
      postDry += def.dryMass;
      const partMax = p.maxFuel || def.fuelMass || 0;
      if (partMax > 0) {
        const partRem = p.fuelRemaining !== undefined ? p.fuelRemaining : partMax;
        postFuel += partRem;
        postMaxFuel += partMax;
        if (p.stage === vessel.activeStageIndex || connectedTankUids.has(p.uid)) {
          postStageFuel += partRem;
          postStageMaxFuel += partMax;
        }
      }
    });

    vessel.dryMass = postDry;
    vessel.fuelMass = postFuel;
    vessel.totalFuelMass = postFuel;
    vessel.maxFuelMass = postMaxFuel;
    vessel.fuelPercent = postMaxFuel > 0 ? (postFuel / postMaxFuel) * 100 : 0;
    vessel.stageFuelMass = postStageFuel;
    vessel.stageMaxFuelMass = postStageMaxFuel;
    vessel.mass = this.calculateTotalMass(vessel.parts);

    // Update telemetry sound synthesizer
    soundEngine.updateTelemetry(vessel.throttle, totalActiveThrust > 0, vessel.dynamicPressure, vessel.heatFlux);
  }

  /**
   * SFS In-Flight Fuel Transfer Logic
   */
  public handleFuelTransfer(vessel: VesselState, dt: number) {
    if (vessel.selectedTankUids.length !== 2) return;
    const [uidA, uidB] = vessel.selectedTankUids;

    const tankA = vessel.parts.find((p) => p.uid === uidA);
    const tankB = vessel.parts.find((p) => p.uid === uidB);
    if (!tankA || !tankB) return;

    const defA = PART_CATALOG[tankA.partId];
    const defB = PART_CATALOG[tankB.partId];
    if (!defA || !defB) return;

    const maxCapA = tankA.maxFuel || defA.fuelMass;
    const maxCapB = tankB.maxFuel || defB.fuelMass;
    const transferRate = 2.5 * dt; // 2.5 tonnes per second transfer speed

    if (vessel.transferDirection === 'in') {
      // Transfer from tank B into tank A
      if (tankB.fuelRemaining > 0 && tankA.fuelRemaining < maxCapA) {
        const amount = Math.min(transferRate, tankB.fuelRemaining, maxCapA - tankA.fuelRemaining);
        tankB.fuelRemaining -= amount;
        tankA.fuelRemaining += amount;
      }
    } else {
      // Transfer from tank A into tank B
      if (tankA.fuelRemaining > 0 && tankB.fuelRemaining < maxCapB) {
        const amount = Math.min(transferRate, tankA.fuelRemaining, maxCapB - tankB.fuelRemaining);
        tankA.fuelRemaining -= amount;
        tankB.fuelRemaining += amount;
      }
    }
  }

  /**
   * Execute Staging Separation & Ignition (Simple Rocket 2 / KSP Core Concept)
   * - Per-part fuel flow through structural connection graph.
   * - Partial-stage separation: decouplers release only their connected sub-assemblies.
   *   Core engines or non-decoupled parts keep firing seamlessly!
   * - Empty-stage auto-skip: If a stage has no decouplers, engines, or staged actions,
   *   it auto-skips instantly to the next operational stage in one press.
   */
  public executeStage(vessel: VesselState): boolean {
    if (!vessel.hasCommand) {
      soundEngine.playLegoDetachSound();
      return false;
    }

    // Pad Liftoff Check: If vessel is on the pad and engines are not firing,
    // the initial stage action is First Stage Ignition & Liftoff!
    const currentEngines = vessel.parts.filter((p) => {
      const def = PART_CATALOG[p.partId];
      return def && def.maxThrust > 0 && p.stage === vessel.activeStageIndex;
    });
    const isActivelyFiring = currentEngines.some((p) => p.isEngineOn) && vessel.throttle > 0.05 && !vessel.isLanded;

    if (!isActivelyFiring && vessel.isLanded) {
      vessel.throttle = 1.0;
      vessel.isLanded = false;
      vessel.parts.forEach((p) => {
        const def = PART_CATALOG[p.partId];
        if (def && def.maxThrust > 0 && p.stage === vessel.activeStageIndex) {
          p.isEngineOn = true;
        }
      });
      // Advance to the next operational stage so the next stage action triggers the decoupler/upper stage
      const nextOp = findNextOperationalStage(vessel.parts, vessel.activeStageIndex + 1);
      vessel.activeStageIndex = nextOp;
      soundEngine.playStageSound();
      return true;
    }

    soundEngine.playStageSound();

    // 1. Empty-Stage Auto-Skip Rule:
    // If the active stage index points to an empty stage (no engine, decoupler, or action),
    // look ahead instantly to the next stage containing operational actions.
    let stageToExecute = findNextOperationalStage(vessel.parts, vessel.activeStageIndex);

    // 2. Partial-Stage Physical Separation:
    // Only parts attached to fired decouplers in this stage are severed from the root craft.
    // Core stages, sustained engines, and other attached modules remain on the vessel!
    let separation = separateDecoupledStages(vessel.parts, stageToExecute);

    // If no separation occurred at stageToExecute, check if there is an unactivated decoupler in the craft
    if (separation.separatedGroups.length === 0) {
      const unactivatedDecoupler = vessel.parts.find((p) => {
        const def = PART_CATALOG[p.partId];
        return def && (def.isDecoupler || def.isSideSeparator) && !p.activated;
      });
      if (unactivatedDecoupler) {
        stageToExecute = unactivatedDecoupler.stage;
        separation = separateDecoupledStages(vessel.parts, stageToExecute);
      }
    }

    const { remainingParts, separatedGroups } = separation;

    if (separatedGroups.length > 0) {
      const noseX = -Math.sin(vessel.angle);
      const noseY = Math.cos(vessel.angle);
      const perpX = Math.cos(vessel.angle);
      const perpY = Math.sin(vessel.angle);

      separatedGroups.forEach((group) => {
        const debMass = this.calculateTotalMass(group);

        // Calculate center of mass for this separated group relative to rocket
        const comX = group.reduce((sum, p) => sum + p.x, 0) / group.length;
        const isRadialBooster = Math.abs(comX) > 0.25;

        let sepVx = 0;
        let sepVy = 0;
        let tumble = (Math.random() - 0.5) * 1.5;

        if (isRadialBooster) {
          // Radial Booster: Ejection force pushed outward away from core centerline
          const sideSign = comX < 0 ? -1 : 1;
          const radialSpeed = 5.5; // m/s outward
          const rearSpeed = 2.5; // m/s rearward drag

          sepVx = perpX * (sideSign * radialSpeed) - noseX * rearSpeed;
          sepVy = perpY * (sideSign * radialSpeed) - noseY * rearSpeed;
          tumble = sideSign * (1.2 + Math.random() * 0.8);
        } else {
          // Stack Interstage: Downward separation along rocket tail axis
          const stackSepSpeed = 6.0;
          sepVx = -noseX * stackSepSpeed;
          sepVy = -noseY * stackSepSpeed;
        }

        const deb: DebrisObject = {
          id: 'deb_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          parts: JSON.parse(JSON.stringify(group)),
          x: vessel.x - noseX * 1.5 + perpX * comX,
          y: vessel.y - noseY * 1.5 + perpY * comX,
          vx: vessel.vx + sepVx,
          vy: vessel.vy + sepVy,
          angle: vessel.angle,
          angularVelocity: tumble,
          mass: debMass,
        };

        vessel.debris.push(deb);
      });

      // Update remaining craft parts and recalculate mass
      vessel.parts = remainingParts;
      vessel.mass = this.calculateTotalMass(vessel.parts);
    }

    // 3. Ignite engines assigned to this newly triggered stage
    if (vessel.throttle <= 0.05) {
      vessel.throttle = 1.0;
    }

    // Determine upcoming operational stage
    const nextOperational = findNextOperationalStage(vessel.parts, stageToExecute + 1);

    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (def && def.maxThrust > 0 && (p.stage === stageToExecute || (separatedGroups.length > 0 && p.stage === nextOperational))) {
        p.isEngineOn = true;
      }
      if (def && (def.isDecoupler || def.isSideSeparator) && p.stage === stageToExecute) {
        p.activated = true;
      }
    });

    // If still no engine is on in the remaining vessel, ignite any available engine in remaining parts
    const hasAnyEngineOn = vessel.parts.some((p) => p.isEngineOn);
    if (!hasAnyEngineOn) {
      const firstEngine = vessel.parts.find((p) => {
        const def = PART_CATALOG[p.partId];
        return def && def.maxThrust > 0;
      });
      if (firstEngine) {
        firstEngine.isEngineOn = true;
      }
    }

    // 4. Staged non-propulsive actions: Parachutes & Fairings
    const stageParts = vessel.parts.filter((p) => p.stage === stageToExecute);
    if (stageParts.some((p) => p.partId === 'parachute')) {
      vessel.parachutesDeployed = true;
      soundEngine.playParachuteSound();
    }
    if (stageParts.some((p) => p.partId === 'fairing_base' || p.partId === 'fairing_cone')) {
      vessel.fairingsJettisoned = true;
    }

    // 5. Advance active stage index to next operational stage
    vessel.activeStageIndex = nextOperational;

    // Recalculate vessel mass and propellant telemetry immediately upon stage separation
    let stageDry = 0;
    let stageFuel = 0;
    let stageMaxFuel = 0;
    let stageActiveFuel = 0;
    let stageActiveMaxFuel = 0;

    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;
      stageDry += def.dryMass;
      const isSolidP = Boolean(def.isSRB || p.engineConfig?.engineType === 'Solid' || p.propellantType === 'solid');
      const solidCap = isSolidP ? (p.maxFuel || def.fuelMass || (p.engineConfig ? (p.engineConfig.engineSizePercent / 50) * 12.0 : 12.0)) : 0;
      const partMax = p.maxFuel || def.fuelMass || solidCap;
      if (partMax > 0) {
        const partRem = p.fuelRemaining !== undefined ? p.fuelRemaining : partMax;
        stageFuel += partRem;
        stageMaxFuel += partMax;
        if (p.stage === vessel.activeStageIndex || (p.isEngineOn && def.maxThrust > 0)) {
          stageActiveFuel += partRem;
          stageActiveMaxFuel += partMax;
        }
      }
    });

    vessel.dryMass = stageDry;
    vessel.fuelMass = stageFuel;
    vessel.totalFuelMass = stageFuel;
    vessel.maxFuelMass = stageMaxFuel;
    vessel.fuelPercent = stageMaxFuel > 0 ? (stageFuel / stageMaxFuel) * 100 : 0;
    vessel.stageFuelMass = stageActiveFuel;
    vessel.stageMaxFuelMass = stageActiveMaxFuel;
    vessel.mass = this.calculateTotalMass(vessel.parts);

    if (stageActiveFuel > 0.0001) {
      vessel.engineFlameout = false;
      vessel.lowFuelWarning = false;
      vessel.isFuelCritical = false;
      vessel.isEngineOn = true;
      if (vessel.throttle <= 0.05) {
        vessel.throttle = 1.0;
      }
    }

    return true;
  }

  /**
   * Merges two vessels upon docking (Requirement 8: Docking-Safe Stage Numbering).
   * Renumbers the visiting craft's stages strictly above the host craft's highest stage,
   * avoiding stage number collisions and preserving correct staging order after docking.
   */
  public dockVessels(hostVessel: VesselState, visitingVessel: VesselState): VesselState {
    const renumberedVisitingParts = renumberStagesForDocking(hostVessel.parts, visitingVessel.parts);
    const combinedParts = [...hostVessel.parts, ...renumberedVisitingParts];

    const newVessel: VesselState = {
      ...hostVessel,
      parts: combinedParts,
      mass: this.calculateTotalMass(combinedParts),
      debris: [...hostVessel.debris, ...visitingVessel.debris],
      batteryCharge: hostVessel.batteryCharge + visitingVessel.batteryCharge,
      batteryMax: (hostVessel.batteryMax || 0) + (visitingVessel.batteryMax || 0),
      monopropRemaining: hostVessel.monopropRemaining + visitingVessel.monopropRemaining,
      monopropMax: (hostVessel.monopropMax || 0) + (visitingVessel.monopropMax || 0),
    };

    soundEngine.playStageSound();
    return newVessel;
  }

  /**
   * SFS In-Flight Part Interaction (Click-to-Toggle, Click-to-Stage, Click-to-Deploy, Fuel Transfer Selection)
   */
  public interactWithPart(vessel: VesselState, partUid: string): boolean {
    const part = vessel.parts.find((p) => p.uid === partUid);
    if (!part) return false;

    const def = PART_CATALOG[part.partId];
    if (!def) return false;

    // Fuel Tank selection for Fuel Transfer & Fuel percentage inspection
    if (def.category === 'Fuel') {
      const idx = vessel.selectedTankUids.indexOf(partUid);
      if (idx !== -1) {
        // Deselect
        vessel.selectedTankUids.splice(idx, 1);
      } else {
        if (vessel.selectedTankUids.length >= 2) {
          vessel.selectedTankUids = [vessel.selectedTankUids[1], partUid];
        } else {
          vessel.selectedTankUids.push(partUid);
        }
      }
      soundEngine.playStageSound();
      return true;
    }

    if (def.maxThrust > 0) {
      // Toggle engine on/off
      part.isEngineOn = part.isEngineOn === false ? true : false;
      soundEngine.playStageSound();
      return true;
    }

    if (def.isDecoupler || def.isSideSeparator || def.isFairing || def.isDockingPort) {
      // Detach this specific decoupler / fairing / docking port cleanly
      soundEngine.playStageSound();
      part.activated = true;

      const noseX = -Math.sin(vessel.angle);
      const noseY = Math.cos(vessel.angle);
      const sideX = Math.cos(vessel.angle);
      const sideY = Math.sin(vessel.angle);

      const lateralSpeed = def.isSideSeparator ? (part.x < 0 ? -6.0 : 6.0) : def.isFairing ? (part.x < 0 ? -8.0 : 8.0) : 0;
      const verticalSpeed = def.isDecoupler ? -4.0 : def.isDockingPort ? -2.0 : 2.0;

      // Find all parts that detach along with this separator / decoupler
      let detachedParts: PlacedPart[] = [part];

      if (def.isSideSeparator) {
        // Collect all parts on this side booster assembly
        const isRightBooster = part.x > 0.2;
        const isLeftBooster = part.x < -0.2;
        detachedParts = vessel.parts.filter((p) => {
          if (p.uid === part.uid) return true;
          if (isRightBooster && p.x >= part.x - 0.3) return true;
          if (isLeftBooster && p.x <= part.x + 0.3) return true;
          return false;
        });
      } else if (def.isDecoupler) {
        // Collect all parts below this interstage decoupler
        detachedParts = vessel.parts.filter((p) => {
          if (p.uid === part.uid) return true;
          return p.y < part.y - 0.1 && Math.abs(p.x - part.x) < 3.0;
        });
      }

      const detachedUids = new Set(detachedParts.map((p) => p.uid));
      const debMass = this.calculateTotalMass(detachedParts);

      const deb: DebrisObject = {
        id: 'deb_part_' + Date.now(),
        parts: JSON.parse(JSON.stringify(detachedParts)),
        x: vessel.x + (part.x * Math.cos(vessel.angle) - part.y * Math.sin(vessel.angle)),
        y: vessel.y + (part.x * Math.sin(vessel.angle) + part.y * Math.cos(vessel.angle)),
        vx: vessel.vx + sideX * lateralSpeed + noseX * verticalSpeed,
        vy: vessel.vy + sideY * lateralSpeed + noseY * verticalSpeed,
        angle: vessel.angle,
        angularVelocity: (Math.random() - 0.5) * 2.0,
        mass: debMass,
      };

      vessel.debris.push(deb);
      vessel.parts = vessel.parts.filter((p) => !detachedUids.has(p.uid));
      vessel.mass = this.calculateTotalMass(vessel.parts);
      return true;
    }

    if (def.isLandingLeg) {
      // Toggle individual leg deployment
      const currentDeployed = part.deployed !== undefined ? part.deployed : vessel.landingLegsDeployed;
      part.deployed = !currentDeployed;
      vessel.landingLegsDeployed = vessel.parts.some(
        (p) => PART_CATALOG[p.partId]?.isLandingLeg && (p.deployed === true || (p.deployProgress !== undefined && p.deployProgress > 0.1))
      );
      soundEngine.playStageSound();
      return true;
    }

    if (def.isSolarPanel) {
      vessel.solarPanelsDeployed = !vessel.solarPanelsDeployed;
      soundEngine.playStageSound();
      return true;
    }

    if (def.isParachute) {
      vessel.parachutesDeployed = true;
      soundEngine.playParachuteSound();
      return true;
    }

    if (def.isMiningDrill || def.id === 'mining_drill') {
      vessel.isDrilling = !vessel.isDrilling;
      soundEngine.playStageSound();
      return true;
    }

    if (def.isRefinery || def.id === 'refinery_unit') {
      vessel.isRefining = !vessel.isRefining;
      soundEngine.playStageSound();
      return true;
    }

    if (def.isSmelter || def.id === 'smelter_unit') {
      vessel.isSmelting = !vessel.isSmelting;
      soundEngine.playStageSound();
      return true;
    }

    return false;
  }

  public toggleDrilling(vessel: VesselState): boolean {
    vessel.isDrilling = !vessel.isDrilling;
    return vessel.isDrilling;
  }

  public toggleEngines(vessel: VesselState): boolean {
    const stageEngines = vessel.parts.filter((p) => {
      const def = PART_CATALOG[p.partId];
      return def && def.maxThrust > 0 && p.stage === vessel.activeStageIndex;
    });
    const allEngines = vessel.parts.filter((p) => {
      const def = PART_CATALOG[p.partId];
      return def && def.maxThrust > 0;
    });
    const targets = stageEngines.length > 0 ? stageEngines : allEngines;
    const currentlyActive = targets.some((p) => p.isEngineOn === true);
    let nextState = !currentlyActive;

    if (nextState) {
      // Check if target engines have propellant available
      const hasFuel = targets.some((eng) => {
        const def = PART_CATALOG[eng.partId];
        if (!def) return false;
        const isSolid = Boolean(def.isSRB || eng.engineConfig?.engineType === 'Solid' || eng.propellantType === 'solid');
        if (isSolid) {
          const solidTanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
          return solidTanks.reduce((s, t) => s + (t.fuelRemaining || 0), 0) > 0.0001 || (eng.fuelRemaining || 0) > 0.0001;
        }
        const tanks = findConnectedFuelTanksForEngine(eng, vessel.parts, { allowCrossfeed: true });
        return tanks.some((t) => (t.fuelRemaining || 0) > 0.0001);
      });

      if (!hasFuel) {
        // Cannot ignite empty engine! Force off
        targets.forEach((p) => {
          p.isEngineOn = false;
        });
        vessel.throttle = 0;
        vessel.isEngineOn = false;
        vessel.engineFlameout = true;
        return false;
      }
    }

    targets.forEach((p) => {
      p.isEngineOn = nextState;
    });
    vessel.isEngineOn = nextState;
    if (!nextState) {
      vessel.throttle = 0;
    } else {
      vessel.engineFlameout = false;
    }
    return nextState;
  }

  public toggleRefining(vessel: VesselState): boolean {
    vessel.isRefining = !vessel.isRefining;
    return vessel.isRefining;
  }

  public toggleSmelting(vessel: VesselState): boolean {
    vessel.isSmelting = !vessel.isSmelting;
    return vessel.isSmelting;
  }

  public toggleAllLandingLegs(vessel: VesselState): boolean {
    const legs = vessel.parts.filter((p) => PART_CATALOG[p.partId]?.isLandingLeg);
    if (legs.length === 0) return false;
    const anyDeployed = legs.some((p) => p.deployed !== false && (p.deployed === true || (p.deployProgress && p.deployProgress > 0.5)));
    const targetState = !anyDeployed;
    legs.forEach((leg) => {
      leg.deployed = targetState;
    });
    vessel.landingLegsDeployed = targetState;
    soundEngine.playStageSound();
    return targetState;
  }
}

export const physicsEngine = new PhysicsEngine();
