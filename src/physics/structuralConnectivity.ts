import { PlacedPart } from '../types';
import { PART_CATALOG, getPartHeight, getPartWidth } from '../data/parts';

export interface ConnectivityResult {
  connectedParts: PlacedPart[];
  unattachedParts: PlacedPart[];
  rootPartUid: string | null;
}

/**
 * Evaluates the structural connectivity tree of the rocket stack.
 * If a part is placed floating, disconnected, or unattached from the main rocket structure,
 * it will be identified as unattached.
 * 
 * At launch / in flight:
 * - The connected parts fly as the active rocket.
 * - The unattached parts are converted into falling debris that tumble under gravity,
 *   crash into the launchpad / ground, and are destroyed with an explosion, while the rocket flies on!
 */
export function analyzeStructuralConnectivity(parts: PlacedPart[]): ConnectivityResult {
  if (!parts || parts.length === 0) {
    return { connectedParts: [], unattachedParts: [], rootPartUid: null };
  }

  if (parts.length === 1) {
    return { connectedParts: [...parts], unattachedParts: [], rootPartUid: parts[0].uid };
  }

  // Calculate bounding box for each part in world meters
  interface PartBox {
    part: PlacedPart;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }

  const boxes: PartBox[] = parts.map((p) => {
    const def = PART_CATALOG[p.partId];
    const rawW = def ? getPartWidth(p, def) : (p.customWidth || 1.5);
    const rawH = def ? getPartHeight(p, def) : (p.customHeight || 2.0);
    const isRotated = p.rotation === 90 || p.rotation === 270;
    const w = isRotated ? rawH : rawW;
    const h = isRotated ? rawW : rawH;

    return {
      part: p,
      minX: p.x - w / 2,
      maxX: p.x + w / 2,
      minY: p.y - h / 2,
      maxY: p.y + h / 2,
    };
  });

  // Identify root part (prefer Command Pod / Probe Core, then highest tank or first part)
  let rootIndex = parts.findIndex((p) => {
    const def = PART_CATALOG[p.partId];
    return def && (def.category === 'Command' || def.id.includes('pod') || def.id.includes('probe'));
  });

  if (rootIndex === -1) {
    // Find fuel tank with highest Y
    let highestY = -Infinity;
    parts.forEach((p, idx) => {
      const def = PART_CATALOG[p.partId];
      if (def && (def.category === 'Fuel' || def.category === 'Structural') && p.y > highestY) {
        highestY = p.y;
        rootIndex = idx;
      }
    });
  }

  if (rootIndex === -1) {
    rootIndex = 0;
  }

  const rootUid = parts[rootIndex].uid;

  // Build adjacency graph using shared graph generator
  const adj = buildPartAdjacencyGraph(parts);

  // BFS traversal from root
  const visited = new Set<string>();
  const queue = [rootUid];
  visited.add(rootUid);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adj.get(curr) || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }

  const connectedParts: PlacedPart[] = [];
  const unattachedParts: PlacedPart[] = [];

  parts.forEach((p) => {
    if (visited.has(p.uid)) {
      connectedParts.push({ ...p, unattachedWarning: false });
    } else {
      unattachedParts.push({ ...p, unattachedWarning: true });
    }
  });

  return {
    connectedParts,
    unattachedParts,
    rootPartUid: rootUid,
  };
}

/**
 * Builds the physical adjacency graph linking parts based on geometry, snap points,
 * and decoupler release state.
 */
export function buildPartAdjacencyGraph(
  parts: PlacedPart[],
  options?: { severedDecouplerUids?: Set<string> }
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  parts.forEach((p) => adj.set(p.uid, []));

  interface PartBox {
    part: PlacedPart;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    w: number;
    h: number;
  }

  const boxes: PartBox[] = parts.map((p) => {
    const def = PART_CATALOG[p.partId];
    const rawW = def ? getPartWidth(p, def) : (p.customWidth || 1.5);
    const rawH = def ? getPartHeight(p, def) : (p.customHeight || 2.0);
    const isRotated = p.rotation === 90 || p.rotation === 270;
    const w = isRotated ? rawH : rawW;
    const h = isRotated ? rawW : rawH;

    return {
      part: p,
      minX: p.x - w / 2,
      maxX: p.x + w / 2,
      minY: p.y - h / 2,
      maxY: p.y + h / 2,
      w,
      h,
    };
  });

  const severed = options?.severedDecouplerUids;

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const defA = PART_CATALOG[a.part.partId];
      const defB = PART_CATALOG[b.part.partId];

      // If either part is a severed decoupler, do not link across this joint
      if (severed && (severed.has(a.part.uid) || severed.has(b.part.uid))) {
        continue;
      }

      // If there are severed decouplers, prevent parts on opposite sides from linking directly
      if (severed && severed.size > 0) {
        let severedCut = false;
        for (const uid of severed) {
          const decBox = boxes.find((b) => b.part.uid === uid);
          if (!decBox) continue;
          const decDef = PART_CATALOG[decBox.part.partId];
          const isSide = Boolean(decDef?.isSideSeparator || Math.abs(decBox.part.x) > 0.4);
          if (isSide) {
            // Cut across vertical plane at decBox.part.x
            const cutX = decBox.part.x;
            const aOnSide = cutX < 0 ? a.part.x < cutX + 0.1 : a.part.x > cutX - 0.1;
            const bOnSide = cutX < 0 ? b.part.x < cutX + 0.1 : b.part.x > cutX - 0.1;
            if (aOnSide !== bOnSide) {
              severedCut = true;
              break;
            }
          } else {
            // Cut across horizontal plane at decBox.part.y
            const cutY = decBox.part.y;
            const aAbove = a.part.y > cutY;
            const bAbove = b.part.y > cutY;
            if (aAbove !== bAbove) {
              severedCut = true;
              break;
            }
          }
        }
        if (severedCut) continue;
      }

      // Check snap point proximity first
      let snapConnected = false;
      if (defA?.snapPoints && defB?.snapPoints) {
        for (const spA of defA.snapPoints) {
          const worldSpAX = a.part.x + spA.x;
          const worldSpAY = a.part.y + spA.y;
          for (const spB of defB.snapPoints) {
            const worldSpBX = b.part.x + spB.x;
            const worldSpBY = b.part.y + spB.y;
            if (Math.hypot(worldSpAX - worldSpBX, worldSpAY - worldSpBY) < 0.25) {
              snapConnected = true;
              break;
            }
          }
          if (snapConnected) break;
        }
      }

      // Calculate true geometric bounding box separation
      const verticalOverlap = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
      const verticalGap = Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY);
      const horizontalOverlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      const horizontalGap = Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX);

      // Stack alignment: one sits vertically directly on or under the other
      // Tight verticalGap <= 0.12 ensures adjacent stacked parts connect, but decoupler separates them
      const centerDistX = Math.abs(a.part.x - b.part.x);
      const maxAllowedX = Math.max(a.w, b.w) * 0.65 + 0.35;
      const isVerticalStacked = (verticalGap <= 0.12 || (verticalOverlap >= -0.15 && verticalOverlap <= Math.max(a.h, b.h) * 0.95))
        && (horizontalOverlap >= 0.10 || centerDistX <= maxAllowedX);

      // Radial / Side alignment: side-by-side contact (e.g. radial decoupler, booster to core, legs, fins)
      const isSideMounted = (horizontalGap <= 0.35) && (verticalOverlap >= 0.10);

      if (snapConnected || isVerticalStacked || isSideMounted) {
        adj.get(a.part.uid)!.push(b.part.uid);
        adj.get(b.part.uid)!.push(a.part.uid);
      }
    }
  }

  return adj;
}

/**
 * Finds all propellant tanks physically connected to an engine through the structural graph.
 * Traverses structural connections, but stops at unactivated stage decouplers so upper stages
 * do not siphon fuel from lower booster stages (and vice versa).
 */
export function findConnectedFuelTanksForEngine(
  engine: PlacedPart,
  allParts: PlacedPart[],
  options?: { allowCrossfeed?: boolean }
): PlacedPart[] {
  const engineDef = PART_CATALOG[engine.partId];
  if (!engineDef) return [];

  // Solid Rocket Boosters carry internal propellant grain; they can also draw from connected solid fuel tanks
  if (engineDef.isSRB || engine.engineConfig?.engineType === 'Solid' || engine.propellantType === 'solid') {
    const solidTanks = allParts.filter((p) => {
      if (p.uid === engine.uid) return false;
      const def = PART_CATALOG[p.partId];
      const isTank = def && (def.category === 'Fuel' || p.partId === 'custom_fuel_tank');
      return isTank && p.propellantType === 'solid';
    });
    return [engine, ...solidTanks];
  }

  const partsMap = new Map<string, PlacedPart>();
  allParts.forEach((p) => partsMap.set(p.uid, p));

  // Build adjacency graph of current active vessel
  const adj = buildPartAdjacencyGraph(allParts);

  // Traverse structural graph via BFS to find all physically connected tanks
  const visited = new Set<string>();
  const queue = [engine.uid];
  visited.add(engine.uid);
  const connectedTanks: PlacedPart[] = [];

  while (queue.length > 0) {
    const currUid = queue.shift()!;
    const part = partsMap.get(currUid);
    if (!part) continue;

    const def = PART_CATALOG[part.partId];
    if (def && (def.category === 'Fuel' || (part.maxFuel && part.maxFuel > 0))) {
      // Include all physically connected tanks so stage fuel capacity stays accurate
      connectedTanks.push(part);
    }

    const neighbors = adj.get(currUid) || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        const neighborPart = partsMap.get(n);
        const neighborDef = neighborPart ? PART_CATALOG[neighborPart.partId] : null;
        
        // Decouplers block propellant crossfeed between stages unless activated/spent
        if (neighborDef && (neighborDef.isDecoupler || neighborDef.isSideSeparator) && !neighborPart?.activated) {
          continue;
        }

        queue.push(n);
      }
    }
  }

  // Robust Fallback: If strict graph BFS found no connected tanks (e.g. custom layout, gap, or procedural tank),
  // locate propellant tanks belonging to the same stage or in the same vertical stack above the engine.
  if (connectedTanks.length === 0) {
    const fallbackTanks = allParts.filter((p) => {
      if (p.uid === engine.uid) return false;
      const def = PART_CATALOG[p.partId];
      const isFuel = Boolean(def && (def.category === 'Fuel' || (p.maxFuel && p.maxFuel > 0)));
      if (!isFuel) return false;
      // In same stage OR aligned in stack (similar X, and above engine Y)
      const sameStage = p.stage === engine.stage;
      const stackAligned = Math.abs(p.x - engine.x) < 1.8 && p.y >= engine.y - 0.4;
      return sameStage || stackAligned;
    });
    connectedTanks.push(...fallbackTanks);
  }

  // Crossfeed Fuel Priority Sorting:
  // 1. Tanks in earlier stages (lower stage number, e.g. booster stage that decouples earlier)
  //    drain FIRST so the booster is dropped completely empty.
  // 2. Outboard / radial tanks drain before core tanks (distance from center line |x|).
  // 3. For tanks on the same stage and radius, upper tanks drain first to keep CoM forward for aero stability.
  connectedTanks.sort((a, b) => {
    // Stage priority: lower stage number separates earlier -> drains earlier
    if (a.stage !== b.stage) {
      return a.stage - b.stage;
    }
    // Lateral radius priority: outboard booster tanks drain before inboard core tanks
    const distA = Math.abs(a.x);
    const distB = Math.abs(b.x);
    if (Math.abs(distA - distB) > 0.3) {
      return distB - distA; // higher distance = earlier drain
    }
    // Vertical priority: upper tanks drain first
    return b.y - a.y;
  });

  return connectedTanks;
}

/**
 * Executes partial-stage physical separation:
 * When decouplers assigned to the triggering stage fire:
 * 1. The joints at those decouplers are severed.
 * 2. The rocket structure splits into connected components.
 * 3. The component containing the primary root (command pod/probe) remains the active vessel.
 * 4. Any severed clusters (side boosters, spent interstages) become separated groups for realistic debris physics.
 */
export function separateDecoupledStages(
  parts: PlacedPart[],
  triggeringStage: number,
  rootPartUid?: string
): { remainingParts: PlacedPart[]; separatedGroups: PlacedPart[][] } {
  // Find decouplers assigned to this triggering stage (or any unactivated decouplers at or below triggering stage)
  let stageDecouplers = parts.filter((p) => {
    const def = PART_CATALOG[p.partId];
    return def && (def.isDecoupler || def.isSideSeparator) && p.stage === triggeringStage && !p.activated;
  });

  if (stageDecouplers.length === 0) {
    stageDecouplers = parts.filter((p) => {
      const def = PART_CATALOG[p.partId];
      return def && (def.isDecoupler || def.isSideSeparator) && p.stage <= triggeringStage && !p.activated;
    });
  }

  // If no decouplers to trigger, no physical separation occurs (e.g. pure engine ignition stage)
  if (stageDecouplers.length === 0) {
    return {
      remainingParts: [...parts],
      separatedGroups: [],
    };
  }

  // Mark triggered decouplers as activated/severed
  stageDecouplers.forEach((d) => {
    d.activated = true;
  });
  const severedUids = new Set<string>(stageDecouplers.map((d) => d.uid));

  // Determine root part UID
  let rootUid = rootPartUid;
  if (!rootUid || !parts.some((p) => p.uid === rootUid)) {
    const cmd = parts.find((p) => {
      const def = PART_CATALOG[p.partId];
      return def && (def.category === 'Command' || def.id.includes('pod') || def.id.includes('probe'));
    });
    if (cmd) {
      rootUid = cmd.uid;
    } else {
      let highestPart = parts[0];
      for (const p of parts) {
        if (p.y > highestPart.y) highestPart = p;
      }
      rootUid = highestPart.uid;
    }
  }

  // Build adjacency graph with severed decoupler joints
  const adj = buildPartAdjacencyGraph(parts, { severedDecouplerUids: severedUids });

  // Find all connected components
  const visited = new Set<string>();
  const components: PlacedPart[][] = [];

  const partsMap = new Map<string, PlacedPart>();
  parts.forEach((p) => partsMap.set(p.uid, p));

  // 1. Traverse Root Component first
  const rootComponent: PlacedPart[] = [];
  const rootQueue = [rootUid];
  visited.add(rootUid);

  while (rootQueue.length > 0) {
    const curr = rootQueue.shift()!;
    const part = partsMap.get(curr);
    if (part) rootComponent.push(part);

    const neighbors = adj.get(curr) || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        rootQueue.push(n);
      }
    }
  }

  // 2. Traverse remaining disconnected components (spent stages, side boosters, etc.)
  parts.forEach((p) => {
    if (!visited.has(p.uid)) {
      const group: PlacedPart[] = [];
      const q = [p.uid];
      visited.add(p.uid);

      while (q.length > 0) {
        const curr = q.shift()!;
        const part = partsMap.get(curr);
        if (part) group.push(part);

        const neighbors = adj.get(curr) || [];
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            q.push(n);
          }
        }
      }

      if (group.length > 0) {
        components.push(group);
      }
    }
  });

  // Safety: If rootComponent is empty, select the highest remaining component
  let finalRemaining = rootComponent;
  let finalGroups = components;

  if (finalRemaining.length === 0 && finalGroups.length > 0) {
    // Pick the group with highest average Y
    let highestIdx = 0;
    let highestAvgY = -Infinity;
    finalGroups.forEach((g, idx) => {
      const avgY = g.reduce((sum, p) => sum + p.y, 0) / Math.max(1, g.length);
      if (avgY > highestAvgY) {
        highestAvgY = avgY;
        highestIdx = idx;
      }
    });
    finalRemaining = finalGroups[highestIdx];
    finalGroups = finalGroups.filter((_, idx) => idx !== highestIdx);
  }

  return {
    remainingParts: finalRemaining.length > 0 ? finalRemaining : parts,
    separatedGroups: finalGroups,
  };
}
