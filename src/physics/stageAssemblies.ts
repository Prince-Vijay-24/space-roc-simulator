import { PlacedPart, RocketMetrics, StageMetric } from '../types';
import { PART_CATALOG } from '../data/parts';

export interface StageChecklistInfo {
  stage: number;
  dryMassTonnes: number;
  wetMassTonnes: number;
  fuelMassTonnes: number;
  thrustKn: number;
  deltaVMs: number;
  twrSeaLevel: number;
  twrVacuum: number;
  burnTimeSec: number;
  engineCount: number;
  decouplerCount: number;
  partsCount: number;
  isEmpty: boolean;
  isReady: boolean;
  warnings: string[];
  checklist: { label: string; status: 'ok' | 'warning' | 'info' }[];
}

/**
 * Checks whether a stage has no decouplers, no unignited engines, and no staged actions.
 * In accordance with the Empty-Stage Auto-Skip Rule:
 * An empty stage contains zero actionable triggers and is auto-skipped on staging.
 */
export function isStageEmpty(parts: PlacedPart[], stageNum: number): boolean {
  const stageParts = parts.filter((p) => p.stage === stageNum);
  if (stageParts.length === 0) return true;

  const hasDecoupler = stageParts.some((p) => {
    const def = PART_CATALOG[p.partId];
    return def && (def.isDecoupler || def.isSideSeparator) && !p.activated;
  });

  const hasUnignitedEngine = stageParts.some((p) => {
    const def = PART_CATALOG[p.partId];
    return def && def.maxThrust > 0 && !p.isEngineOn;
  });

  const hasStageableAction = stageParts.some((p) => {
    return (p.partId === 'parachute' && !p.deployed) || (p.partId === 'fairing_base' && !p.activated);
  });

  return !hasDecoupler && !hasUnignitedEngine && !hasStageableAction;
}

/**
 * Empty-stage auto-skip rule:
 * If a stage has no engine and no meaningful action, staging through it is instant
 * and does not cost the player an extra button press or accidentally chain into the next real stage.
 * Scans forward from currentStage and returns the next stage that contains executable actions.
 */
export function findNextOperationalStage(parts: PlacedPart[], currentStage: number): number {
  const allStages = Array.from(new Set(parts.map((p) => p.stage))).sort((a, b) => a - b);
  const remainingStages = allStages.filter((s) => s >= currentStage);

  for (const stg of remainingStages) {
    if (!isStageEmpty(parts, stg)) {
      return stg;
    }
  }

  // Fallback to highest stage or currentStage if all remaining are empty
  return remainingStages.length > 0 ? remainingStages[0] : currentStage;
}

/**
 * Reorders a stage number across the rocket parts:
 * Moves all parts in `fromStage` to `toStage`, shifting other stages accordingly.
 */
export function reorderStages(parts: PlacedPart[], fromStage: number, toStage: number): PlacedPart[] {
  if (fromStage === toStage) return [...parts];

  return parts.map((p) => {
    if (p.stage === fromStage) {
      return { ...p, stage: toStage };
    }
    if (fromStage < toStage) {
      // Shifting down stages between fromStage + 1 and toStage
      if (p.stage > fromStage && p.stage <= toStage) {
        return { ...p, stage: p.stage - 1 };
      }
    } else {
      // Shifting up stages between toStage and fromStage - 1
      if (p.stage >= toStage && p.stage < fromStage) {
        return { ...p, stage: p.stage + 1 };
      }
    }
    return p;
  });
}

/**
 * Merges two stages into one:
 * All parts in `sourceStage` are reassigned to `targetStage`.
 * Any stages numbered higher than `sourceStage` are decremented to close gaps.
 */
export function mergeStages(parts: PlacedPart[], sourceStage: number, targetStage: number): PlacedPart[] {
  const minMerged = Math.min(sourceStage, targetStage);
  const maxMerged = Math.max(sourceStage, targetStage);

  const updated = parts.map((p) => {
    if (p.stage === maxMerged) {
      return { ...p, stage: minMerged };
    }
    if (p.stage > maxMerged) {
      return { ...p, stage: p.stage - 1 };
    }
    return p;
  });

  return updated;
}

/**
 * Splits a stage:
 * Moves specified parts into a newly created stage, shifting all higher stages up by 1.
 */
export function splitStage(parts: PlacedPart[], baseStage: number, partUidsToMove: string[]): PlacedPart[] {
  const moveSet = new Set(partUidsToMove);
  const newStageNumber = baseStage + 1;

  return parts.map((p) => {
    if (p.stage > baseStage) {
      return { ...p, stage: p.stage + 1 };
    }
    if (p.stage === baseStage && moveSet.has(p.uid)) {
      return { ...p, stage: newStageNumber };
    }
    return p;
  });
}

/**
 * Inserts a new empty stage at a specific index, shifting subsequent stages up by 1.
 */
export function insertNewStage(parts: PlacedPart[], atStageIndex: number): PlacedPart[] {
  return parts.map((p) => {
    if (p.stage >= atStageIndex) {
      return { ...p, stage: p.stage + 1 };
    }
    return p;
  });
}

/**
 * Docking-safe stage numbering (Requirement 8):
 * When two vessels dock, their stage lists must merge without number collisions.
 * The docking/visiting vessel's stages are renumbered strictly above the host's highest existing stage,
 * so staging after docking fires the correct parts in the correct order.
 */
export function renumberStagesForDocking(hostParts: PlacedPart[], visitingParts: PlacedPart[]): PlacedPart[] {
  const hostStages = hostParts.map((p) => p.stage).filter((s) => typeof s === 'number');
  const maxHostStage = hostStages.length > 0 ? Math.max(...hostStages) : 0;

  const visitingStages = visitingParts.map((p) => p.stage).filter((s) => typeof s === 'number');
  const minVisitingStage = visitingStages.length > 0 ? Math.min(...visitingStages) : 1;

  // Offset ensures lowest visiting stage becomes maxHostStage + 1
  const offset = maxHostStage > 0 ? maxHostStage + 1 - minVisitingStage : 0;

  return visitingParts.map((p) => ({
    ...p,
    stage: p.stage + offset,
  }));
}

/**
 * Computes a detailed per-stage performance readout and readiness checklist
 * for pre-launch verification in the rocket builder (Requirement 6).
 */
export function getStageChecklist(parts: PlacedPart[], metrics: RocketMetrics): StageChecklistInfo[] {
  const stageSet = new Set<number>();
  parts.forEach((p) => stageSet.add(p.stage));
  const stageNumbers = Array.from(stageSet).sort((a, b) => a - b);

  return stageNumbers.map((stgNum) => {
    const stageParts = parts.filter((p) => p.stage === stgNum);
    const metric: StageMetric | undefined = metrics.stageBreakdown?.find((s) => s.stage === stgNum);

    let dry = 0;
    let fuel = 0;
    let engineCount = 0;
    let decouplerCount = 0;

    stageParts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      const pDry = def?.dryMass || 0.4;
      const pFuel = p.fuelRemaining !== undefined ? p.fuelRemaining : (p.maxFuel || def?.fuelMass || 0);
      dry += pDry;
      fuel += pFuel;

      if (def?.maxThrust && def.maxThrust > 0) {
        engineCount++;
      }
      if (def?.isDecoupler || def?.isSideSeparator) {
        decouplerCount++;
      }
    });

    const wet = dry + fuel;
    const deltaV = metric?.deltaV || 0;
    const twrSL = metric?.twrSL || 0;
    const twrVac = metric?.twrVac || 0;
    const thrust = metric?.thrust || 0;
    const burnTime = metric?.burnTime || 0;
    const empty = isStageEmpty(parts, stgNum);

    const warnings: string[] = [];
    if (empty) {
      warnings.push('Empty Stage: No engine, decoupler, or action scheduled. Will auto-skip.');
    } else if (stgNum === 1 && twrSL < 1.05 && thrust > 0) {
      warnings.push(`Low Liftoff TWR (${twrSL.toFixed(2)}): Rocket may fail to leave pad without booster assist.`);
    } else if (engineCount > 0 && fuel <= 0.01) {
      warnings.push('Engine assigned to stage with no propellant tank connected.');
    }

    const isReady = !empty && (stgNum > 1 || twrSL >= 1.05 || thrust === 0);

    const checklist: { label: string; status: 'ok' | 'warning' | 'info' }[] = [];
    if (empty) {
      checklist.push({ label: 'Empty stage: will automatically skip in flight in one press', status: 'info' });
    } else {
      if (stgNum === 1) {
        if (twrSL >= 1.05) {
          checklist.push({ label: `Liftoff TWR ${twrSL.toFixed(2)} (Safe for launch)`, status: 'ok' });
        } else if (thrust > 0) {
          checklist.push({ label: `Liftoff TWR ${twrSL.toFixed(2)} (< 1.05: Needs booster assist)`, status: 'warning' });
        }
      }
      if (engineCount > 0) {
        if (fuel > 0.01) {
          checklist.push({ label: `${engineCount} Engine(s) connected to ${fuel.toFixed(1)}t propellant`, status: 'ok' });
        } else {
          checklist.push({ label: `${engineCount} Engine(s) with NO propellant connected`, status: 'warning' });
        }
      }
      if (decouplerCount > 0) {
        checklist.push({ label: `${decouplerCount} Decoupler/Separator armed for stage ejection`, status: 'ok' });
      }
      if (deltaV > 0) {
        checklist.push({ label: `Planned burn provides ${deltaV.toFixed(0)} m/s Δv`, status: 'info' });
      }
    }

    return {
      stage: stgNum,
      dryMassTonnes: metric?.dryMass ?? dry,
      wetMassTonnes: metric?.wetMass ?? wet,
      fuelMassTonnes: metric?.fuelMass ?? fuel,
      thrustKn: thrust,
      deltaVMs: deltaV,
      twrSeaLevel: twrSL,
      twrVacuum: twrVac,
      burnTimeSec: burnTime,
      engineCount,
      decouplerCount,
      partsCount: stageParts.length,
      isEmpty: empty,
      isReady,
      warnings,
      checklist,
    };
  });
}
