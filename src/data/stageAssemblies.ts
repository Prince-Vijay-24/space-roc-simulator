import { PlacedPart, StageAssembly, StageRole } from '../types';
import { PART_CATALOG, getPartHeight, getPartWidth, calculateFuelTankProperties } from './parts';

/**
 * Starter assemblies for each stage type in Stage-Wise building
 */
export const DEFAULT_STAGE_TEMPLATES: Record<StageRole, StageAssembly> = {
  PAYLOAD: {
    id: 'stage_payload_default',
    name: 'Orbital Capsule & Payload',
    role: 'PAYLOAD',
    decouplerBelow: true,
    parts: [
      {
        uid: 'payload_chute',
        partId: 'parachute',
        x: 0,
        y: 2.2,
        rotation: 0,
        stage: 4,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      },
      {
        uid: 'payload_pod',
        partId: 'command_pod',
        x: 0,
        y: 1.1,
        rotation: 0,
        stage: 4,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      },
      {
        uid: 'payload_hs',
        partId: 'heat_shield',
        x: 0,
        y: 0.1,
        rotation: 0,
        stage: 4,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0.6,
      },
    ],
  },
  UPPER_STAGE: {
    id: 'stage_upper_default',
    name: '2nd Stage (Vacuum / Orbital)',
    role: 'UPPER_STAGE',
    decouplerBelow: true,
    parts: [
      {
        uid: 'upper_tank',
        partId: 'custom_fuel_tank',
        customWidth: 2.0,
        customHeight: 3.5,
        tankSkin: 'white',
        x: 0,
        y: 0.75,
        rotation: 0,
        stage: 3,
        fuelRemaining: 9.3,
        maxFuel: 9.3,
        ablatorRemaining: 0,
      },
      {
        uid: 'upper_eng',
        partId: 'engine_frontier',
        x: 0,
        y: -1.75,
        rotation: 0,
        stage: 3,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
        isEngineOn: false,
      },
      {
        uid: 'upper_rcs_l',
        partId: 'rcs_3way_cluster',
        x: -1.0,
        y: 1.8,
        rotation: 0,
        stage: 3,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      },
      {
        uid: 'upper_rcs_r',
        partId: 'rcs_3way_cluster',
        x: 1.0,
        y: 1.8,
        rotation: 0,
        stage: 3,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      },
    ],
  },
  FIRST_STAGE: {
    id: 'stage_core_default',
    name: '1st Stage (Main Lifter Core)',
    role: 'FIRST_STAGE',
    decouplerBelow: false,
    parts: [
      {
        uid: 'core_tank',
        partId: 'custom_fuel_tank',
        customWidth: 2.5,
        customHeight: 7.0,
        tankSkin: 'white',
        x: 0,
        y: 0.5,
        rotation: 0,
        stage: 2,
        fuelRemaining: 29.2,
        maxFuel: 29.2,
        ablatorRemaining: 0,
      },
      {
        uid: 'core_eng',
        partId: 'engine_titan',
        x: 0,
        y: -3.8,
        rotation: 0,
        stage: 2,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
        isEngineOn: true,
      },
      {
        uid: 'core_fin_l',
        partId: 'aerodynamic_fin',
        x: -1.8,
        y: -3.0,
        rotation: 0,
        stage: 2,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      },
      {
        uid: 'core_fin_r',
        partId: 'aerodynamic_fin',
        x: 1.8,
        y: -3.0,
        rotation: 0,
        stage: 2,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      },
    ],
  },
  BOOSTER: {
    id: 'stage_booster_default',
    name: 'Strap-On Side Boosters',
    role: 'BOOSTER',
    radialMount: true,
    radialSide: 'both',
    radialOffset: 2.1,
    parts: [
      {
        uid: 'booster_nose',
        partId: 'nose_cone',
        x: 0,
        y: 3.5,
        rotation: 0,
        stage: 1,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      },
      {
        uid: 'booster_tank',
        partId: 'custom_fuel_tank',
        customWidth: 1.5,
        customHeight: 5.5,
        tankSkin: 'orange',
        x: 0,
        y: 0.25,
        rotation: 0,
        stage: 1,
        fuelRemaining: 15.5,
        maxFuel: 15.5,
        ablatorRemaining: 0,
      },
      {
        uid: 'booster_eng',
        partId: 'engine_hawk',
        x: 0,
        y: -3.2,
        rotation: 0,
        stage: 1,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
        isEngineOn: true,
      },
      {
        uid: 'booster_fin',
        partId: 'aerodynamic_fin',
        x: 0.95,
        y: -2.7,
        rotation: 0,
        stage: 1,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      },
    ],
  },
  CUSTOM: {
    id: 'stage_custom_default',
    name: 'Custom Auxiliary Stage',
    role: 'CUSTOM',
    decouplerBelow: true,
    parts: [
      {
        uid: 'custom_tank',
        partId: 'custom_fuel_tank',
        customWidth: 2.0,
        customHeight: 2.5,
        tankSkin: 'steel',
        x: 0,
        y: 0.5,
        rotation: 0,
        stage: 1,
        fuelRemaining: 6.7,
        maxFuel: 6.7,
        ablatorRemaining: 0,
      },
      {
        uid: 'custom_eng',
        partId: 'engine_valiant',
        x: 0,
        y: -1.4,
        rotation: 0,
        stage: 1,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
        isEngineOn: true,
      },
    ],
  },
};

/**
 * Calculates bounding box of an array of parts
 */
export function getPartsBoundingBox(parts: PlacedPart[]) {
  if (parts.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  parts.forEach((p) => {
    const def = PART_CATALOG[p.partId];
    const w = getPartWidth(p, def);
    const h = getPartHeight(p, def);
    minX = Math.min(minX, p.x - w / 2);
    maxX = Math.max(maxX, p.x + w / 2);
    minY = Math.min(minY, p.y - h / 2);
    maxY = Math.max(maxY, p.y + h / 2);
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Calculates mass, fuel, and thrust metrics for a stage in isolation
 */
export function calculateIsolatedStageMetrics(stage?: StageAssembly) {
  if (!stage || !stage.parts || !Array.isArray(stage.parts)) {
    return {
      wetMass: 0,
      dryMass: 0,
      fuelMass: 0,
      thrust: 0,
      twr: 0,
      deltaV: 0,
    };
  }

  let wetMass = 0;
  let dryMass = 0;
  let fuelMass = 0;
  let totalThrust = 0;
  let weightedIsp = 0;

  stage.parts.forEach((p) => {
    const def = PART_CATALOG[p.partId];
    if (!def) return;

    let partFuel = 0;
    let partDry = def.dryMass;

    if (def.category === 'Fuel' || p.partId === 'custom_fuel_tank') {
      const w = getPartWidth(p, def);
      const h = getPartHeight(p, def);
      const props = calculateFuelTankProperties(w, h);
      partFuel = p.fuelRemaining !== undefined ? p.fuelRemaining : props.fuelMass;
      partDry = props.dryMass;
    } else {
      partFuel = p.fuelRemaining !== undefined ? p.fuelRemaining : def.fuelMass;
      partDry = def.dryMass;
    }

    const ablator = p.ablatorRemaining ?? def.ablatorMass ?? 0;
    wetMass += partDry + partFuel + ablator;
    dryMass += partDry + ablator;
    fuelMass += partFuel;

    if (def.maxThrust > 0 && p.isEngineOn !== false) {
      totalThrust += def.maxThrust;
      weightedIsp += def.maxThrust * def.ispVac;
    }
  });

  const avgIsp = totalThrust > 0 ? weightedIsp / totalThrust : 300;
  const g0 = 9.80665;
  const twr = wetMass > 0 ? totalThrust / (wetMass * g0) : 0;
  const deltaV =
    dryMass > 0 && wetMass > dryMass ? Math.round(avgIsp * g0 * Math.log(wetMass / dryMass)) : 0;

  return {
    wetMass: Math.round(wetMass * 100) / 100,
    dryMass: Math.round(dryMass * 100) / 100,
    fuelMass: Math.round(fuelMass * 100) / 100,
    thrust: totalThrust,
    twr: Math.round(twr * 100) / 100,
    deltaV,
  };
}

/**
 * Attaches and stacks all stage assemblies into one unified rocket.
 * Stacks vertically: Payload -> Decoupler -> Upper Stage -> Decoupler -> 1st Stage Core
 * Boosters are mounted radially to the left and right of the 1st Stage with side separators.
 */
export function assembleStagesToRocket(stages: StageAssembly[]): PlacedPart[] {
  const resultParts: PlacedPart[] = [];
  let uidCounter = 1;

  // Separate vertical stages and radial booster stages
  const verticalStages = stages.filter((s) => s.role !== 'BOOSTER' && !s.radialMount);
  const boosterStages = stages.filter((s) => s.role === 'BOOSTER' || s.radialMount);

  // Desired vertical order: PAYLOAD (top) -> UPPER_STAGE -> CUSTOM -> FIRST_STAGE (bottom)
  const roleOrder: Record<StageRole, number> = {
    PAYLOAD: 0,
    UPPER_STAGE: 1,
    CUSTOM: 2,
    FIRST_STAGE: 3,
    BOOSTER: 4,
  };

  const sortedVertical = [...verticalStages].sort(
    (a, b) => (roleOrder[a.role] ?? 2) - (roleOrder[b.role] ?? 2)
  );

  let currentBottomY = 0;
  let coreCenterY = 0;
  let coreWidth = 2.5;

  // Compute total staging stages:
  // E.g. Stage 1: Core & Booster ignition, Stage 2: Booster sep, Stage 3: Core decouple & Upper ignition, Stage 4: Payload
  let verticalStageIndex = sortedVertical.length + (boosterStages.length > 0 ? 1 : 0);

  // Stack vertical stages top to bottom
  sortedVertical.forEach((stg, sIndex) => {
    if (stg.parts.length === 0) return;

    const bb = getPartsBoundingBox(stg.parts);

    // If this is the first stage placed (topmost, usually payload)
    if (sIndex === 0) {
      currentBottomY = 10; // Start high in VAB
    } else {
      // Place an interstage decoupler if previous stage had decouplerBelow
      const prevStage = sortedVertical[sIndex - 1];
      if (prevStage.decouplerBelow !== false) {
        const decId = `stg_dec_${uidCounter++}`;
        const decY = currentBottomY - 0.2;
        resultParts.push({
          uid: decId,
          partId: bb.width >= 2.8 ? 'decoupler_3m' : 'decoupler',
          x: 0,
          y: Math.round(decY * 100) / 100,
          rotation: 0,
          stage: verticalStageIndex,
          fuelRemaining: 0,
          maxFuel: 0,
          ablatorRemaining: 0,
        });
        currentBottomY = decY - 0.2;
      }
    }

    // Offset parts so stage top matches currentBottomY
    const shiftY = currentBottomY - bb.maxY;
    const shiftX = -bb.centerX; // center along centerline x=0

    stg.parts.forEach((p) => {
      resultParts.push({
        ...p,
        uid: `p_${stg.role.toLowerCase()}_${uidCounter++}`,
        x: Math.round((p.x + shiftX) * 100) / 100,
        y: Math.round((p.y + shiftY) * 100) / 100,
        stage: Math.max(1, verticalStageIndex),
      });
    });

    currentBottomY = currentBottomY - bb.height;

    // Record core position and width for attaching radial boosters
    if (stg.role === 'FIRST_STAGE' || sIndex === sortedVertical.length - 1) {
      coreCenterY = currentBottomY + bb.height / 2;
      coreWidth = Math.max(2.0, bb.width);
    }

    verticalStageIndex--;
  });

  // Attach Radial Boosters if present
  boosterStages.forEach((boosterStg) => {
    if (boosterStg.parts.length === 0) return;

    const bBox = getPartsBoundingBox(boosterStg.parts);
    const boosterYOffset = coreCenterY - bBox.centerY;
    const offsetDist = boosterStg.radialOffset ?? coreWidth / 2 + bBox.width / 2 + 0.3;

    const sides: ('left' | 'right')[] =
      boosterStg.radialSide === 'left'
        ? ['left']
        : boosterStg.radialSide === 'right'
        ? ['right']
        : ['left', 'right'];

    sides.forEach((side) => {
      const sign = side === 'left' ? -1 : 1;
      const boosterX = sign * offsetDist;

      // Add radial side separator
      const sepUid = `booster_sep_${side}_${uidCounter++}`;
      resultParts.push({
        uid: sepUid,
        partId: 'side_separator',
        x: Math.round((sign * (coreWidth / 2 + 0.25)) * 100) / 100,
        y: Math.round(coreCenterY * 100) / 100,
        rotation: 0,
        stage: 1, // Booster separation stage
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      });

      // Add booster parts
      boosterStg.parts.forEach((p) => {
        resultParts.push({
          ...p,
          uid: `b_${side}_${uidCounter++}`,
          x: Math.round((p.x + boosterX) * 100) / 100,
          y: Math.round((p.y + boosterYOffset) * 100) / 100,
          stage: 1, // First stage ignition with core
        });
      });
    });
  });

  return resultParts;
}

/**
 * Automatically decomposes a full rocket into stage subassemblies
 */
export function extractStagesFromRocket(parts: PlacedPart[]): StageAssembly[] {
  if (parts.length === 0) {
    return [
      { ...DEFAULT_STAGE_TEMPLATES.PAYLOAD, parts: [] },
      { ...DEFAULT_STAGE_TEMPLATES.UPPER_STAGE, parts: [] },
      { ...DEFAULT_STAGE_TEMPLATES.FIRST_STAGE, parts: [] },
      { ...DEFAULT_STAGE_TEMPLATES.BOOSTER, parts: [] },
    ];
  }

  // Detect radial boosters: parts with abs(x) > 1.2
  const boosterParts = parts.filter((p) => Math.abs(p.x) >= 1.25);
  // Pick only positive x side to define standard single booster
  const singleBoosterParts = boosterParts
    .filter((p) => p.x >= 0.5 && p.partId !== 'side_separator')
    .map((p) => {
      return {
        ...p,
        x: p.x - 2.2, // normalize around 0
      };
    });

  // Vertical core parts
  const coreParts = parts.filter((p) => Math.abs(p.x) < 1.25 && p.partId !== 'side_separator');

  // Find decoupler heights to slice stages vertically
  const decouplers = coreParts
    .filter((p) => PART_CATALOG[p.partId]?.isDecoupler)
    .sort((a, b) => b.y - a.y); // top to bottom

  if (decouplers.length >= 2) {
    const topDecY = decouplers[0].y;
    const midDecY = decouplers[1].y;

    const payloadParts = coreParts.filter((p) => p.y > topDecY && !PART_CATALOG[p.partId]?.isDecoupler);
    const upperParts = coreParts.filter(
      (p) => p.y < topDecY && p.y > midDecY && !PART_CATALOG[p.partId]?.isDecoupler
    );
    const firstStageParts = coreParts.filter((p) => p.y < midDecY && !PART_CATALOG[p.partId]?.isDecoupler);

    const norm = (list: PlacedPart[]) => {
      const bb = getPartsBoundingBox(list);
      return list.map((p) => ({ ...p, x: p.x - bb.centerX, y: p.y - bb.centerY }));
    };

    return [
      {
        id: 'stage_payload',
        name: 'Payload Stage',
        role: 'PAYLOAD',
        decouplerBelow: true,
        parts: norm(payloadParts),
      },
      {
        id: 'stage_upper',
        name: '2nd Stage Upper',
        role: 'UPPER_STAGE',
        decouplerBelow: true,
        parts: norm(upperParts),
      },
      {
        id: 'stage_first',
        name: '1st Stage Core',
        role: 'FIRST_STAGE',
        decouplerBelow: false,
        parts: norm(firstStageParts),
      },
      {
        id: 'stage_booster',
        name: 'Side Boosters',
        role: 'BOOSTER',
        radialMount: true,
        radialSide: 'both',
        radialOffset: 2.2,
        parts: singleBoosterParts.length > 0 ? norm(singleBoosterParts) : DEFAULT_STAGE_TEMPLATES.BOOSTER.parts,
      },
    ];
  }

  // Fallback if no clean decouplers: 3 equal vertical slices
  const bb = getPartsBoundingBox(coreParts);
  const oneThird = bb.height / 3;
  const pList = coreParts.filter((p) => p.y > bb.minY + oneThird * 2);
  const uList = coreParts.filter((p) => p.y <= bb.minY + oneThird * 2 && p.y > bb.minY + oneThird);
  const fList = coreParts.filter((p) => p.y <= bb.minY + oneThird);

  const norm = (list: PlacedPart[]) => {
    const b = getPartsBoundingBox(list);
    return list.map((p) => ({ ...p, x: p.x - b.centerX, y: p.y - b.centerY }));
  };

  return [
    {
      id: 'stage_payload',
      name: 'Payload Stage',
      role: 'PAYLOAD',
      decouplerBelow: true,
      parts: norm(pList),
    },
    {
      id: 'stage_upper',
      name: 'Upper Stage',
      role: 'UPPER_STAGE',
      decouplerBelow: true,
      parts: norm(uList),
    },
    {
      id: 'stage_first',
      name: '1st Stage Core',
      role: 'FIRST_STAGE',
      decouplerBelow: false,
      parts: norm(fList),
    },
    {
      id: 'stage_booster',
      name: 'Side Boosters',
      role: 'BOOSTER',
      radialMount: true,
      radialSide: 'both',
      radialOffset: 2.2,
      parts: singleBoosterParts.length > 0 ? norm(singleBoosterParts) : DEFAULT_STAGE_TEMPLATES.BOOSTER.parts,
    },
  ];
}

/**
 * Attaches a booster structure assembly to an existing rocket core as radial strap-on boosters
 * Adds side separators and mirrors/spaces the booster parts properly.
 */
export function attachBoosterStructureToRocket(
  currentParts: PlacedPart[],
  boosterStage: StageAssembly,
  mode: 'twin' | 'left' | 'right' = 'twin'
): PlacedPart[] {
  const newParts = [...currentParts];
  const boosterParts =
    boosterStage.parts && boosterStage.parts.length > 0
      ? boosterStage.parts
      : DEFAULT_STAGE_TEMPLATES.BOOSTER.parts;

  const bBox = getPartsBoundingBox(boosterParts);

  // Core parts along centerline
  const coreParts = newParts.filter((p) => Math.abs(p.x) < 1.4 && p.partId !== 'side_separator');
  let coreCenterY = 0;
  let coreWidth = 2.5;

  if (coreParts.length > 0) {
    const minY = Math.min(...coreParts.map((p) => p.y));
    const maxY = Math.max(...coreParts.map((p) => p.y));
    coreCenterY = (minY + maxY) / 2 - 0.5;
    coreWidth = Math.max(2.0, ...coreParts.map((p) => getPartWidth(p, PART_CATALOG[p.partId])));
  }

  const sides: ('left' | 'right')[] = mode === 'twin' ? ['left', 'right'] : [mode];
  const now = Date.now();
  let uidCounter = 1;

  sides.forEach((side) => {
    const sign = side === 'left' ? -1 : 1;
    // Radial separation distance
    const boosterX = sign * (coreWidth / 2 + Math.max(1.0, bBox.width / 2) + 0.35);
    const boosterYOffset = coreCenterY - bBox.centerY;

    // 1. Add Radial Side Separator between core and booster
    newParts.push({
      uid: `sep_${side}_${now}_${uidCounter++}`,
      partId: 'side_separator',
      x: Math.round((sign * (coreWidth / 2 + 0.25)) * 100) / 100,
      y: Math.round(coreCenterY * 100) / 100,
      rotation: 0,
      stage: 1, // stage 1 booster separation
      fuelRemaining: 0,
      maxFuel: 0,
      ablatorRemaining: 0,
    });

    // 2. Add Booster Structure Parts
    boosterParts.forEach((p) => {
      // If fin or offset part, mirror x appropriately for left vs right
      const localX = side === 'left' && p.x !== 0 ? -p.x : p.x;
      newParts.push({
        ...p,
        uid: `b_${side}_${now}_${uidCounter++}`,
        x: Math.round((boosterX + localX) * 100) / 100,
        y: Math.round((p.y + boosterYOffset) * 100) / 100,
        stage: 1, // first stage liftoff ignition
      });
    });
  });

  return newParts;
}

/**
 * Stacks a stage structure (payload, upper stage, or core) onto an existing rocket vehicle
 */
export function stackStructureOntoRocket(
  currentParts: PlacedPart[],
  stage: StageAssembly,
  position: 'top' | 'bottom' = 'bottom'
): PlacedPart[] {
  if (!stage.parts || stage.parts.length === 0) return currentParts;
  const newParts = [...currentParts];
  const bBox = getPartsBoundingBox(stage.parts);
  const now = Date.now();
  let uidCounter = 1;

  if (newParts.length === 0) {
    stage.parts.forEach((p) => {
      newParts.push({
        ...p,
        uid: `stg_${stage.role.toLowerCase()}_${now}_${uidCounter++}`,
        x: Math.round((p.x - bBox.centerX) * 100) / 100,
        y: Math.round((p.y - bBox.centerY) * 100) / 100,
      });
    });
    return newParts;
  }

  // Find vertical core extent
  const coreParts = newParts.filter((p) => Math.abs(p.x) < 1.5 && p.partId !== 'side_separator');
  const coreBox = getPartsBoundingBox(coreParts);

  if (position === 'top' || stage.role === 'PAYLOAD') {
    // Stack above existing rocket
    const topY = coreBox.maxY + 0.3;
    const shiftY = topY - bBox.minY;
    const shiftX = -bBox.centerX;

    // If needed, insert decoupler below payload
    if (stage.decouplerBelow) {
      newParts.push({
        uid: `dec_top_${now}_${uidCounter++}`,
        partId: bBox.width >= 2.8 ? 'decoupler_3m' : 'decoupler',
        x: 0,
        y: Math.round((coreBox.maxY + 0.2) * 100) / 100,
        rotation: 0,
        stage: 3,
        fuelRemaining: 0,
        maxFuel: 0,
        ablatorRemaining: 0,
      });
    }

    stage.parts.forEach((p) => {
      newParts.push({
        ...p,
        uid: `stg_${stage.role.toLowerCase()}_${now}_${uidCounter++}`,
        x: Math.round((p.x + shiftX) * 100) / 100,
        y: Math.round((p.y + shiftY + (stage.decouplerBelow ? 0.3 : 0)) * 100) / 100,
      });
    });
  } else {
    // Stack below existing rocket (e.g. 1st stage core under 2nd stage)
    const bottomY = coreBox.minY - 0.3;
    const shiftY = bottomY - bBox.maxY;
    const shiftX = -bBox.centerX;

    // Decoupler between stages
    newParts.push({
      uid: `dec_mid_${now}_${uidCounter++}`,
      partId: bBox.width >= 2.8 ? 'decoupler_3m' : 'decoupler',
      x: 0,
      y: Math.round((coreBox.minY - 0.2) * 100) / 100,
      rotation: 0,
      stage: 2,
      fuelRemaining: 0,
      maxFuel: 0,
      ablatorRemaining: 0,
    });

    stage.parts.forEach((p) => {
      newParts.push({
        ...p,
        uid: `stg_${stage.role.toLowerCase()}_${now}_${uidCounter++}`,
        x: Math.round((p.x + shiftX) * 100) / 100,
        y: Math.round((p.y + shiftY - 0.3) * 100) / 100,
        stage: 1,
      });
    });
  }

  return newParts;
}

export * from '../physics/stageAssemblies';

