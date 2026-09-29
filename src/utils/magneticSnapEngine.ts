import { PlacedPart, PartDefinition } from '../types';
import { PART_CATALOG, getPartHeight, getPartWidth } from '../data/parts';

export interface MagneticSnapResult {
  x: number;
  y: number;
  isSnapped: boolean;
  snapJointWorld?: { x: number; y: number };
  snapType?: 'stack_top' | 'stack_bottom' | 'radial_left' | 'radial_right' | 'centerline';
  targetUid?: string;
  targetPartName?: string;
  suggestedRotation?: number;
  suggestedWidth?: number;
  mountIndex?: number;
}

export interface SnapOptions {
  threshold?: number;
  disableSnap?: boolean;
  initialLinkedJoint?: { x: number; y: number }; // Joint it was already attached to before drag
}

/**
 * High-precision magnetic snap engine inspired by Spaceflight Simulator (SFS).
 * Evaluates candidate parts in the rocket workspace and magnetically latches
 * dragged parts flush against complementary snap boundaries.
 * 
 * Rules:
 * 1. Snaps to stack top, stack bottom, centerline, and ANY part side (RCS, Solar, Legs, Fins, etc.)
 * 2. If a joint is already linked / occupied by an existing part, snapping to it is FORBIDDEN.
 * 3. Prevents re-snapping to the same joint while detaching an already-linked part.
 */
export function calculateMagneticSnap(
  target: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    partId?: string;
    uid?: string;
  },
  existingParts: PlacedPart[],
  optionsOrThreshold: number | SnapOptions = 0.65
): MagneticSnapResult {
  const options: SnapOptions =
    typeof optionsOrThreshold === 'number'
      ? { threshold: optionsOrThreshold }
      : optionsOrThreshold;

  const threshold = options.threshold ?? 0.65;

  let bestResult: MagneticSnapResult = {
    x: target.x,
    y: target.y,
    isSnapped: false,
  };

  if (options.disableSnap) {
    return bestResult;
  }

  let bestDist = threshold;
  const targetRot = (((target.rotation ?? 0) % 180) + 180) % 180;
  const isTargetHorizontal = targetRot === 90;
  const targetW = isTargetHorizontal ? target.height : target.width;
  const targetH = isTargetHorizontal ? target.width : target.height;
  const targetDef = target.partId ? PART_CATALOG[target.partId] : null;

  // Filter out the dragged part itself
  const candidates = existingParts.filter((p) => p.uid !== target.uid);

  // Helper: checks if a proposed snap bounding box overlaps an existing placed part
  const isPositionOccupiedByCandidate = (
    posX: number,
    posY: number,
    posW: number,
    posH: number,
    ignoreUid?: string
  ): boolean => {
    return candidates.some((p) => {
      if (ignoreUid && p.uid === ignoreUid) return false;
      const pDef = PART_CATALOG[p.partId];
      if (!pDef) return false;
      const baseW = getPartWidth(p, pDef);
      const baseH = getPartHeight(p, pDef);
      const pRot = (((p.rotation ?? 0) % 180) + 180) % 180;
      const pw = pRot === 90 ? baseH : baseW;
      const ph = pRot === 90 ? baseW : baseH;

      const pLeft = p.x - pw / 2;
      const pRight = p.x + pw / 2;
      const pBottom = p.y - ph / 2;
      const pTop = p.y + ph / 2;

      const overlapX = Math.min(posX + posW * 0.42, pRight) - Math.max(posX - posW * 0.42, pLeft);
      const overlapY = Math.min(posY + posH * 0.42, pTop) - Math.max(posY - posH * 0.42, pBottom);

      return overlapX > 0.18 && overlapY > 0.18;
    });
  };

  for (const other of candidates) {
    const oDef = PART_CATALOG[other.partId];
    if (!oDef) continue;

    const baseOtherW = getPartWidth(other, oDef);
    const baseOtherH = getPartHeight(other, oDef);
    const otherRot = (((other.rotation ?? 0) % 180) + 180) % 180;
    const otherW = otherRot === 90 ? baseOtherH : baseOtherW;
    const otherH = otherRot === 90 ? baseOtherW : baseOtherH;

    const otherTopY = other.y + otherH / 2;
    const otherBottomY = other.y - otherH / 2;
    const otherLeftX = other.x - otherW / 2;
    const otherRightX = other.x + otherW / 2;

    // -------------------------------------------------------------
    // OCCUPIED JOINT & SPOT DETECTION:
    // If a joint or spot is already linked to another part, do NOT snap to it!
    // -------------------------------------------------------------
    const isTopOccupied =
      candidates.some((p) => {
        if (p.uid === other.uid) return false;
        const pDef = PART_CATALOG[p.partId];
        const baseW = pDef ? getPartWidth(p, pDef) : 1;
        const baseH = pDef ? getPartHeight(p, pDef) : 1;
        const rot = (((p.rotation ?? 0) % 180) + 180) % 180;
        const pW = rot === 90 ? baseH : baseW;
        const pH = rot === 90 ? baseW : baseH;
        const horizOverlap = Math.min(p.x + pW / 2, otherRightX) - Math.max(p.x - pW / 2, otherLeftX);
        return horizOverlap > 0.25 && Math.abs(p.y - pH / 2 - otherTopY) < 0.25;
      }) || isPositionOccupiedByCandidate(other.x, otherTopY + targetH / 2, targetW, targetH, other.uid);

    const isBottomOccupied =
      candidates.some((p) => {
        if (p.uid === other.uid) return false;
        const pDef = PART_CATALOG[p.partId];
        const baseW = pDef ? getPartWidth(p, pDef) : 1;
        const baseH = pDef ? getPartHeight(p, pDef) : 1;
        const rot = (((p.rotation ?? 0) % 180) + 180) % 180;
        const pW = rot === 90 ? baseH : baseW;
        const pH = rot === 90 ? baseW : baseH;
        const horizOverlap = Math.min(p.x + pW / 2, otherRightX) - Math.max(p.x - pW / 2, otherLeftX);
        return horizOverlap > 0.25 && Math.abs(p.y + pH / 2 - otherBottomY) < 0.25;
      }) || isPositionOccupiedByCandidate(other.x, otherBottomY - targetH / 2, targetW, targetH, other.uid);

    // -------------------------------------------------------------
    // 1. VERTICAL STACKING: Dragged part bottom onto other part top
    // -------------------------------------------------------------
    if (!isTopOccupied) {
      const distStackTopY = Math.abs(target.y - targetH / 2 - otherTopY);
      const distStackTopX = Math.abs(target.x - other.x);
      if (distStackTopY < threshold && distStackTopX < Math.max(0.8, otherW * 0.7)) {
        // If part was initially linked here and hasn't broken away yet
        const isInitialLink =
          options.initialLinkedJoint &&
          Math.hypot(target.x - options.initialLinkedJoint.x, target.y - options.initialLinkedJoint.y) < 0.15;

        if (!isInitialLink) {
          const totalDist = Math.hypot(distStackTopX, distStackTopY);
          if (totalDist < bestDist) {
            bestDist = totalDist;
            bestResult = {
              x: other.x,
              y: otherTopY + targetH / 2,
              isSnapped: true,
              snapJointWorld: { x: other.x, y: otherTopY },
              snapType: 'stack_top',
              targetUid: other.uid,
              targetPartName: oDef.name,
            };
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 2. VERTICAL STACKING: Dragged part top under other part bottom
    // Special mechanic: Fuel tanks support up to 3 engines mounted at base!
    // -------------------------------------------------------------
    const isTargetEngine =
      targetDef?.category === 'Propulsion' ||
      target.partId === 'modular_rocket_engine' ||
      (targetDef?.maxThrust ?? 0) > 0;
    const isOtherFuelTank =
      oDef.category === 'Fuel' ||
      other.partId.includes('tank') ||
      oDef.id === 'custom_fuel_tank';

    if (isTargetEngine && isOtherFuelTank) {
      // Tank engine mounts: 1, 2, or 3 engines across base
      const mountCount = (other.engineMountCount || 1) as 1 | 2 | 3;
      let mountSlots: { x: number; index: number; maxW: number }[] = [];

      if (other.engineMountCount === 1) {
        mountSlots = [{ x: other.x, index: 0, maxW: otherW * 0.95 }];
      } else if (other.engineMountCount === 2) {
        const offset = otherW * 0.25;
        mountSlots = [
          { x: other.x - offset, index: 0, maxW: (otherW / 2) * 0.92 },
          { x: other.x + offset, index: 1, maxW: (otherW / 2) * 0.92 },
        ];
      } else if (other.engineMountCount === 3) {
        const offset = otherW * 0.32;
        mountSlots = [
          { x: other.x - offset, index: 0, maxW: (otherW / 3) * 0.92 },
          { x: other.x, index: 1, maxW: (otherW / 3) * 0.92 },
          { x: other.x + offset, index: 2, maxW: (otherW / 3) * 0.92 },
        ];
      } else {
        // If mountCount is not explicitly locked, dynamically provide 3 potential base slots (left, center, right)
        const offset = otherW * 0.28;
        mountSlots = [
          { x: other.x - offset, index: 0, maxW: (otherW / 3) * 0.92 },
          { x: other.x, index: 1, maxW: (otherW / 2) * 0.92 },
          { x: other.x + offset, index: 2, maxW: (otherW / 3) * 0.92 },
        ];
      }

      const distStackBottomY = Math.abs(target.y + targetH / 2 - otherBottomY);
      const engineSnapThresholdY = Math.max(threshold * 1.5, 0.95);

      if (distStackBottomY < engineSnapThresholdY) {
        for (const slot of mountSlots) {
          // Check if this specific slot is already occupied by another engine
          const slotOccupied = candidates.some((p) => {
            if (p.uid === other.uid || p.uid === target.uid) return false;
            const pDef = PART_CATALOG[p.partId];
            const isPEngine =
              pDef?.category === 'Propulsion' ||
              p.partId === 'modular_rocket_engine' ||
              (pDef?.maxThrust ?? 0) > 0;
            if (!isPEngine) return false;
            const pH = pDef ? getPartHeight(p, pDef) : 1;
            const pTopY = p.y + pH / 2;
            return (
              Math.abs(pTopY - otherBottomY) < 0.45 &&
              Math.abs(p.x - slot.x) < Math.max(0.35, slot.maxW * 0.5)
            );
          });

          if (!slotOccupied) {
            const distSlotX = Math.abs(target.x - slot.x);
            if (distSlotX < Math.max(0.7, otherW * 0.45)) {
              const isInitialLink =
                options.initialLinkedJoint &&
                Math.hypot(
                  target.x - options.initialLinkedJoint.x,
                  target.y - options.initialLinkedJoint.y
                ) < 0.15;

              if (!isInitialLink) {
                const totalDist = Math.hypot(distSlotX, distStackBottomY);
                if (totalDist < bestDist) {
                  bestDist = totalDist;
                  bestResult = {
                    x: slot.x,
                    y: otherBottomY - targetH / 2,
                    isSnapped: true,
                    snapJointWorld: { x: slot.x, y: otherBottomY },
                    snapType: 'stack_bottom',
                    targetUid: other.uid,
                    targetPartName: oDef.name,
                    suggestedWidth: other.engineMountWidthM || slot.maxW,
                    mountIndex: slot.index,
                  };
                }
              }
            }
          }
        }
      }
    } else if (!isBottomOccupied) {
      const distStackBottomY = Math.abs(target.y + targetH / 2 - otherBottomY);
      const distStackBottomX = Math.abs(target.x - other.x);
      if (distStackBottomY < threshold && distStackBottomX < Math.max(0.8, otherW * 0.7)) {
        const isInitialLink =
          options.initialLinkedJoint &&
          Math.hypot(target.x - options.initialLinkedJoint.x, target.y - options.initialLinkedJoint.y) < 0.15;

        if (!isInitialLink) {
          const totalDist = Math.hypot(distStackBottomX, distStackBottomY);
          if (totalDist < bestDist) {
            bestDist = totalDist;
            bestResult = {
              x: other.x,
              y: otherBottomY - targetH / 2,
              isSnapped: true,
              snapJointWorld: { x: other.x, y: otherBottomY },
              snapType: 'stack_bottom',
              targetUid: other.uid,
              targetPartName: oDef.name,
            };
          }
        }
      }
    }

    // -------------------------------------------------------------
    // 3. UNIVERSAL RADIAL / SIDE ATTACHMENT FOR ALL PARTS:
    // Attaches Side Boosters, Fuel Tanks, Separators, RCS, Solar Panels,
    // Landing Legs, Batteries, Fins, etc.
    // Notice: Main stack propulsion engines attach to base, not sides!
    // -------------------------------------------------------------
    const isTargetSidePart =
      targetDef?.isRCS ||
      targetDef?.isSolarPanel ||
      targetDef?.isLandingLeg ||
      targetDef?.isSideSeparator ||
      targetDef?.isSRB ||
      targetDef?.category === 'Aerodynamics' ||
      targetDef?.category === 'Utility' ||
      targetDef?.category === 'Fuel' ||
      (targetDef?.category === 'Propulsion' && (targetDef?.isRadial || target.partId === 'engine_sepratron')) ||
      targetDef?.category === 'Structural';

    const isTargetBoosterOrTank =
      targetDef?.category === 'Fuel' ||
      targetDef?.isSRB ||
      target.partId?.includes('tank') ||
      target.partId?.includes('booster');
    const isOtherSeparator = Boolean(oDef.isSideSeparator || other.partId === 'side_separator');
    const isTargetSeparator = Boolean(targetDef?.isSideSeparator || target.partId === 'side_separator');
    const isOtherBoosterOrTank =
      oDef.category === 'Fuel' ||
      oDef.isSRB ||
      other.partId.includes('tank') ||
      other.partId.includes('booster');

    const isSeparatorBoosterPair =
      (isOtherSeparator && isTargetBoosterOrTank) ||
      (isTargetSeparator && isOtherBoosterOrTank);

    // Check vertical overlap between target and other
    const overlapMin = Math.max(target.y - targetH / 2, otherBottomY);
    const overlapMax = Math.min(target.y + targetH / 2, otherTopY);
    const hasVerticalOverlap = isSeparatorBoosterPair
      ? Math.abs(target.y - other.y) <= (targetH + otherH) * 0.55 + threshold * 1.5
      : overlapMax >= overlapMin - threshold * 0.4;

    if (isTargetSidePart && hasVerticalOverlap) {
      // Calculate smart vertical snap heights along the side of the host part:
      const candidateYs: number[] = [];

      if (isOtherSeparator && isTargetBoosterOrTank) {
        // Target is a booster tank attaching to a side separator
        // Allow booster to snap at user drag height (smooth / 0.25m steps) or aligned
        candidateYs.push(target.y);
        candidateYs.push(Math.round(target.y * 4) / 4);
        candidateYs.push(other.y);
        // Align booster bottom with main rocket base
        candidateYs.push(other.y + targetH / 2 - otherH / 2);
        candidateYs.push(other.y - targetH / 2 + otherH / 2);
      } else if (targetDef?.isLandingLeg || target.partId?.includes('leg')) {
        // Landing leg: snap flush to lower tank rim
        candidateYs.push(otherBottomY + targetH / 2);
        candidateYs.push(otherBottomY + targetH * 0.3);
      } else if (targetDef?.isRCS || target.partId?.includes('rcs')) {
        // RCS thrusters: top quadrant, middle, bottom quadrant
        candidateYs.push(otherTopY - Math.max(0.3, targetH * 0.6));
        candidateYs.push(other.y);
        candidateYs.push(otherBottomY + Math.max(0.3, targetH * 0.6));
      } else if (targetDef?.isSolarPanel) {
        // Solar panels: middle of tank
        candidateYs.push(other.y);
        candidateYs.push(otherTopY - targetH / 2 - 0.2);
      } else if (isTargetSeparator) {
        // Side separator attaching to host tank: center, upper third, lower third, or fine steps
        candidateYs.push(target.y);
        candidateYs.push(Math.round(target.y * 4) / 4);
        candidateYs.push(other.y);
        candidateYs.push(other.y + otherH * 0.25);
        candidateYs.push(other.y - otherH * 0.25);
      } else {
        // General parts: center of host part or grid steps
        candidateYs.push(other.y);
        candidateYs.push(Math.round(target.y * 4) / 4);
      }

      // Pick closest valid candidate Y
      let bestSideY = candidateYs[0] ?? other.y;
      let bestYDist = Infinity;

      for (const cy of candidateYs) {
        let clampedY = cy;
        if (isSeparatorBoosterPair) {
          if (otherH >= targetH) {
            const lowerLimit = otherBottomY + targetH * 0.2;
            const upperLimit = otherTopY - targetH * 0.2;
            clampedY = Math.max(lowerLimit, Math.min(upperLimit, cy));
          } else {
            // Booster is taller than separator: separator can be anywhere along the booster length
            const lowerLimit = other.y - targetH * 0.48;
            const upperLimit = other.y + targetH * 0.48;
            clampedY = Math.max(lowerLimit, Math.min(upperLimit, cy));
          }
        } else if (otherH >= targetH) {
          const lowerLimit = otherBottomY + targetH * 0.4;
          const upperLimit = otherTopY - targetH * 0.4;
          clampedY = Math.max(lowerLimit, Math.min(upperLimit, cy));
        } else {
          const lowerLimit = other.y - targetH * 0.45;
          const upperLimit = other.y + targetH * 0.45;
          clampedY = Math.max(lowerLimit, Math.min(upperLimit, cy));
        }

        const dy = Math.abs(target.y - clampedY);
        if (dy < bestYDist) {
          bestYDist = dy;
          bestSideY = clampedY;
        }
      }

      // If host tank already has a side separator mounted on that side,
      // prevent booster tank from clipping through separator directly into main tank!
      const otherHasRightSeparator = isTargetBoosterOrTank && !isOtherSeparator && candidates.some((p) => {
        const pDef = PART_CATALOG[p.partId];
        return Boolean(pDef?.isSideSeparator || p.partId === 'side_separator') &&
          p.x > other.x && Math.abs((p.x - (pDef ? getPartWidth(p, pDef) : 0.5) / 2) - otherRightX) < 0.35;
      });

      const otherHasLeftSeparator = isTargetBoosterOrTank && !isOtherSeparator && candidates.some((p) => {
        const pDef = PART_CATALOG[p.partId];
        return Boolean(pDef?.isSideSeparator || p.partId === 'side_separator') &&
          p.x < other.x && Math.abs((p.x + (pDef ? getPartWidth(p, pDef) : 0.5) / 2) - otherLeftX) < 0.35;
      });

      // Check if radial slot is already occupied by another part or occupied bounding box
      const isRightSlotOccupied =
        otherHasRightSeparator ||
        isPositionOccupiedByCandidate(otherRightX + targetW / 2, bestSideY, targetW, targetH, other.uid) ||
        candidates.some((p) => {
          if (p.uid === other.uid) return false;
          const pDef = PART_CATALOG[p.partId];
          const baseW = pDef ? getPartWidth(p, pDef) : 1;
          const baseH = pDef ? getPartHeight(p, pDef) : 1;
          const rot = (((p.rotation ?? 0) % 180) + 180) % 180;
          const pW = rot === 90 ? baseH : baseW;
          const pH = rot === 90 ? baseW : baseH;
          const pLeftX = p.x - pW / 2;
          return (
            Math.abs(pLeftX - otherRightX) < 0.25 &&
            Math.abs(p.y - bestSideY) < Math.min(targetH, pH) * 0.55
          );
        });

      const isLeftSlotOccupied =
        otherHasLeftSeparator ||
        isPositionOccupiedByCandidate(otherLeftX - targetW / 2, bestSideY, targetW, targetH, other.uid) ||
        candidates.some((p) => {
          if (p.uid === other.uid) return false;
          const pDef = PART_CATALOG[p.partId];
          const baseW = pDef ? getPartWidth(p, pDef) : 1;
          const baseH = pDef ? getPartHeight(p, pDef) : 1;
          const rot = (((p.rotation ?? 0) % 180) + 180) % 180;
          const pW = rot === 90 ? baseH : baseW;
          const pH = rot === 90 ? baseW : baseH;
          const pRightX = p.x + pW / 2;
          return (
            Math.abs(pRightX - otherLeftX) < 0.25 &&
            Math.abs(p.y - bestSideY) < Math.min(targetH, pH) * 0.55
          );
        });

      // Prefer side based on which side target is on relative to other
      const preferRight = target.x >= other.x;

      // Higher magnetic threshold and priority for booster-separator pairs
      const isPriorityRadial = isOtherSeparator || isTargetSeparator;
      const radialThreshold = isPriorityRadial ? Math.max(threshold * 1.6, 1.2) : threshold;
      const yWeight = isPriorityRadial ? 0.25 : 0.6;

      // Mount to OTHER's RIGHT side
      if (!isRightSlotOccupied && preferRight) {
        const distRightX = Math.abs(target.x - targetW / 2 - otherRightX);
        const distRightY = Math.abs(target.y - bestSideY);
        const distRight = Math.hypot(distRightX, distRightY * yWeight);

        if (distRight < radialThreshold && distRight < bestDist) {
          bestDist = distRight;
          bestResult = {
            x: otherRightX + targetW / 2,
            y: bestSideY,
            isSnapped: true,
            snapJointWorld: { x: otherRightX, y: bestSideY },
            snapType: 'radial_right',
            targetUid: other.uid,
            targetPartName: oDef.name,
            suggestedRotation: 0,
          };
        }
      }

      // Mount to OTHER's LEFT side
      if (!isLeftSlotOccupied && !preferRight) {
        const distLeftX = Math.abs(target.x + targetW / 2 - otherLeftX);
        const distLeftY = Math.abs(target.y - bestSideY);
        const distLeft = Math.hypot(distLeftX, distLeftY * yWeight);

        if (distLeft < radialThreshold && distLeft < bestDist) {
          bestDist = distLeft;
          bestResult = {
            x: otherLeftX - targetW / 2,
            y: bestSideY,
            isSnapped: true,
            snapJointWorld: { x: otherLeftX, y: bestSideY },
            snapType: 'radial_left',
            targetUid: other.uid,
            targetPartName: oDef.name,
            suggestedRotation: 0,
          };
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 4. CENTERLINE MAGNET (x = 0)
  // -------------------------------------------------------------
  if (!bestResult.isSnapped && Math.abs(target.x) < 0.35) {
    bestResult.x = 0;
    bestResult.isSnapped = true;
    bestResult.snapType = 'centerline';
    bestResult.snapJointWorld = { x: 0, y: target.y };
  }

  // -------------------------------------------------------------
  // 5. FINAL ANTI-OVERLAP GUARANTEE:
  // If the snapped position would overlap another part occupying the same spot,
  // cancel the snap immediately!
  // -------------------------------------------------------------
  if (
    bestResult.isSnapped &&
    bestResult.snapType !== 'centerline' &&
    isPositionOccupiedByCandidate(bestResult.x, bestResult.y, targetW, targetH, bestResult.targetUid)
  ) {
    bestResult = {
      x: target.x,
      y: target.y,
      isSnapped: false,
    };
  }

  return bestResult;
}
