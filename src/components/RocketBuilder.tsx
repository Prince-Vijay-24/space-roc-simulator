import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PART_CATALOG, PRESET_ROCKETS, calculateFuelTankProperties, getPartHeight, getPartWidth } from '../data/parts';
import { DEFAULT_JUNO_ENGINE_CONFIG } from '../physics/rocketPropulsion';
import { PartCategory, PartDefinition, PlacedPart, RocketBuildMode, RocketMetrics, StageAssembly, JunoEngineConfig, FuelType } from '../types';
import { 
  DEFAULT_STAGE_TEMPLATES, 
  assembleStagesToRocket, 
  extractStagesFromRocket,
  attachBoosterStructureToRocket,
  stackStructureOntoRocket,
  calculateIsolatedStageMetrics,
} from '../data/stageAssemblies';
import { physicsEngine } from '../physics/physicsEngine';
import { 
  Rocket, Trash2, RotateCw, RotateCcw, Play, Layers, Plus, Minus, Sparkles, 
  HelpCircle, ChevronRight, Zap, Shield, Compass, Disc, Check, Save,
  Search, Copy, FlipHorizontal, Eye, EyeOff, ZoomIn, ZoomOut, Maximize2,
  Sliders, Info, AlertTriangle, X, Move, Flame, Gauge, Wind, Thermometer, Orbit,
  LayoutGrid, List, SlidersHorizontal, ArrowUpRight, Activity, Factory, Building2,
  ChevronLeft, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Magnet,
  BoxSelect, Box, ArrowUp, ArrowDown, GitMerge, Split, Settings2, ShieldAlert, CheckCircle2, AlertCircle, GripVertical, Sun
} from 'lucide-react';
import {
  getStageChecklist,
  reorderStages,
  mergeStages,
  splitStage,
  insertNewStage,
  isStageEmpty,
} from '../physics/stageAssemblies';
import { PartThumbnail } from './PartThumbnail';
import { drawPart2D, drawInterstageShroudDirect } from '../graphics/partRenderer2D';
import { ProceduralPartInspector } from './builder/ProceduralPartInspector';
import { PerformanceAnalyzer } from './builder/PerformanceAnalyzer';
import { AstronetHQModal } from './economy/AstronetHQModal';
import { loadEconomyState, saveEconomyState } from '../economy/economySystem';
import { StageWiseManager } from './builder/StageWiseManager';
import { AddUpgradeMode } from './builder/AddUpgradeMode';
import { soundEngine } from '../audio/soundEngine';
import { calculateMagneticSnap, MagneticSnapResult } from '../utils/magneticSnapEngine';
import { analyzeStructuralConnectivity } from '../physics/structuralConnectivity';

interface RocketBuilderProps {
  initialParts: PlacedPart[];
  onLaunch: (parts: PlacedPart[]) => void;
  onOpenStation?: () => void;
  onReturnToSpaceport?: () => void;
  onOpenSaveModal?: () => void;
}

export const RocketBuilder: React.FC<RocketBuilderProps> = ({ 
  initialParts, 
  onLaunch, 
  onOpenStation, 
  onReturnToSpaceport,
  onOpenSaveModal,
}) => {
  const [parts, setParts] = useState<PlacedPart[]>(initialParts);
  const [buildMode, setBuildMode] = useState<RocketBuildMode>('ENTIRE');
  const lastEntireRocketPartsRef = useRef<PlacedPart[]>(initialParts);
  const [stageAssemblies, setStageAssemblies] = useState<StageAssembly[]>([
    DEFAULT_STAGE_TEMPLATES.PAYLOAD,
    DEFAULT_STAGE_TEMPLATES.UPPER_STAGE,
    DEFAULT_STAGE_TEMPLATES.FIRST_STAGE,
    DEFAULT_STAGE_TEMPLATES.BOOSTER,
  ]);
  const [activeStageId, setActiveStageId] = useState<string>(DEFAULT_STAGE_TEMPLATES.FIRST_STAGE.id);

  const [selectedCategory, setSelectedCategory] = useState<PartCategory | 'All' | 'Structures'>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPlacedUid, setSelectedPlacedUid] = useState<string | null>(null);
  const [selectedPlacedUids, setSelectedPlacedUids] = useState<string[]>([]);
  const [isBoxSelectMode, setIsBoxSelectMode] = useState<boolean>(false);
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [hoveredUid, setHoveredUid] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState<boolean>(false);
  const [showControlsHelp, setShowControlsHelp] = useState<boolean>(false);
  const [showPerformanceAnalyzer, setShowPerformanceAnalyzer] = useState<boolean>(false);
  const [showAstronetHQ, setShowAstronetHQ] = useState<boolean>(false);
  const [economyState, setEconomyState] = useState(() => loadEconomyState());
  const [paletteViewMode, setPaletteViewMode] = useState<'grid' | 'list'>('grid');
  const [symmetryMode, setSymmetryMode] = useState<'1x' | '2x' | '4x'>('1x');
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState<boolean>(true);
  const [showCoM, setShowCoM] = useState<boolean>(true);
  const [showCoT, setShowCoT] = useState<boolean>(true);
  const [gridSnap, setGridSnap] = useState<number>(0.5); // 0.5m, 0.25m, or 0 (free)
  const [rightSidebarTab, setRightSidebarTab] = useState<'details' | 'staging' | 'actionGroups'>('staging');
  const [draggedStagePartUid, setDraggedStagePartUid] = useState<string | null>(null);

  // Panel Collapsible State for maximum workspace efficiency
  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState<boolean>(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState<boolean>(false);

  // Magnetic Snapping & Drag & Drop State
  const [activeSnap, setActiveSnap] = useState<MagneticSnapResult | null>(null);
  const [draggedPalettePart, setDraggedPalettePart] = useState<PartDefinition | null>(null);
  const draggedPalettePartRef = useRef<PartDefinition | null>(null);
  const [paletteGhost, setPaletteGhost] = useState<{ x: number; y: number; isSnapped: boolean } | null>(null);
  const wasSnappedRef = useRef<boolean>(false);

  // Automatically switch side panel to Part Details when a part is clicked
  useEffect(() => {
    if (selectedPlacedUid) {
      setRightSidebarTab('details');
      if (isInspectorCollapsed) setIsInspectorCollapsed(false);
    }
  }, [selectedPlacedUid]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedUid, setDraggedUid] = useState<string | null>(null);

  // Viewport Pan/Zoom in Builder (Default compact zoom 24px/m so rockets are sized properly)
  const [cameraZoom, setCameraZoom] = useState<number>(24);
  const [cameraOffset, setCameraOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Ref to track pointer drag interaction state
  const dragStateRef = useRef<{
    mode: 'NONE' | 'PAN' | 'BOX_SELECT' | 'PART_PENDING' | 'PART_DRAGGING';
    partUid?: string;
    startPx: number;
    startPy: number;
    boxStartWorld?: { x: number; y: number };
    offsetWorldX?: number;
    offsetWorldY?: number;
    initialAnchorPos?: { x: number; y: number };
    initialLinkedJoint?: { x: number; y: number };
    initialPartPositions?: { uid: string; x: number; y: number }[];
    initialTwinPositions?: { uid: string; x: number; y: number }[];
    hasMoved: boolean;
  } | null>(null);

  // Compute live metrics
  const metrics: RocketMetrics = useMemo(() => {
    return physicsEngine.calculateMetrics(parts);
  }, [parts]);

  // Unique stages list
  const stageNumbers = useMemo(() => {
    const s = new Set<number>();
    parts.forEach((p) => s.add(p.stage));
    if (s.size === 0) s.add(1);
    return Array.from(s).sort((a, b) => b - a); // Descending (upper stage on top)
  }, [parts]);

  // Pre-launch stage readout checklist & status breakdown (Simple Rocket 2 / KSP staging concept)
  const stageChecklist = useMemo(() => {
    return getStageChecklist(parts, metrics);
  }, [parts, metrics]);

  // Selected placed part details
  const selectedPart = useMemo(() => {
    if (!selectedPlacedUid) return null;
    return (parts || []).find((p) => p.uid === selectedPlacedUid);
  }, [parts, selectedPlacedUid]);

  const selectedPartDef = useMemo(() => {
    return selectedPart ? PART_CATALOG[selectedPart.partId] : null;
  }, [selectedPart]);

  // Synchronize canvas parts back into active stage assembly when in STAGE_WISE mode
  useEffect(() => {
    if (buildMode === 'STAGE_WISE') {
      setStageAssemblies((prev) =>
        (prev || []).map((s) => (s.id === activeStageId ? { ...s, parts } : s))
      );
    }
  }, [parts, buildMode, activeStageId]);

  // Auto Adjust Part Sizes Mechanism
  // If tank width is high and stage above is low, separator adjusts into cone+cylinder transition shape
  // Also adapts aerodynamic nose cones, fairings, and aerodynamic fins flush with parent stages
  const autoAdjustParts = useCallback((currentParts: PlacedPart[]): PlacedPart[] => {
    return currentParts.map((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return p;
      const pH = getPartHeight(p, def);
      const pW = getPartWidth(p, def);

      // 1. Separators / Decouplers: adapt into conical transition adapter between stages
      if (def.isDecoupler && !def.isSideSeparator) {
        const partBelow = currentParts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef) return false;
          const oH = getPartHeight(other, oDef);
          const otherTop = other.y + oH / 2;
          const myBottom = p.y - pH / 2;
          return Math.abs(other.x - p.x) < 0.6 && Math.abs(otherTop - myBottom) < 0.35;
        });

        const partAbove = currentParts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef) return false;
          const oH = getPartHeight(other, oDef);
          const otherBottom = other.y - oH / 2;
          const myTop = p.y + pH / 2;
          return Math.abs(other.x - p.x) < 0.6 && Math.abs(otherBottom - myTop) < 0.35;
        });

        let wBelow = partBelow ? getPartWidth(partBelow, PART_CATALOG[partBelow.partId]) : undefined;
        let wAbove: number | undefined;

        if (partAbove) {
          const oDef = PART_CATALOG[partAbove.partId];
          if (oDef.category === 'Propulsion') {
            const oH = getPartHeight(partAbove, oDef);
            const tankAboveEng = currentParts.find((t) => {
              if (t.uid === partAbove.uid || t.uid === p.uid) return false;
              const tDef = PART_CATALOG[t.partId];
              if (!tDef || tDef.category !== 'Fuel') return false;
              const tH = getPartHeight(t, tDef);
              return Math.abs(t.x - partAbove.x) < 0.6 && Math.abs((t.y - tH / 2) - (partAbove.y + oH / 2)) < 0.35;
            });
            wAbove = tankAboveEng ? getPartWidth(tankAboveEng, PART_CATALOG[tankAboveEng.partId]) : getPartWidth(partAbove, oDef);
          } else {
            wAbove = getPartWidth(partAbove, oDef);
          }
        }

        if (wBelow !== undefined || wAbove !== undefined) {
          const effBot = wBelow ?? wAbove ?? pW;
          const effTop = wAbove ?? wBelow ?? pW;
          return {
            ...p,
            adapterBottomWidth: effBot,
            adapterTopWidth: effTop,
            customWidth: Math.max(effBot, effTop),
            autoAdjusted: true,
          };
        }
      }

      // 2. Cones, Fairings & Adapters: auto-fit width to match adjacent stage below
      if (def.id.includes('cone') || def.id.includes('adapter') || def.isFairing || def.category === 'Aerodynamics') {
        const partBelow = currentParts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef) return false;
          const oH = getPartHeight(other, oDef);
          const otherTop = other.y + oH / 2;
          const myBottom = p.y - pH / 2;
          return Math.abs(other.x - p.x) < 0.6 && Math.abs(otherTop - myBottom) < 0.35;
        });
        if (partBelow) {
          const wBelow = getPartWidth(partBelow, PART_CATALOG[partBelow.partId]);
          if (wBelow && wBelow > 0 && Math.abs(pW - wBelow) > 0.05) {
            return {
              ...p,
              customWidth: wBelow,
              autoAdjusted: true,
            };
          }
        }
      }

      // 3. Aerodynamic Fins: snap flush against tank outer boundary
      if (def.category === 'Aerodynamics' && def.id.includes('fin')) {
        const tankNear = currentParts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef || oDef.category !== 'Fuel') return false;
          const oH = getPartHeight(other, oDef);
          return Math.abs(other.y - p.y) < oH / 2 + 0.5;
        });
        if (tankNear) {
          const oDef = PART_CATALOG[tankNear.partId];
          const oW = getPartWidth(tankNear, oDef);
          const isRight = p.x >= tankNear.x;
          const flushX = isRight ? tankNear.x + oW / 2 + pW / 2 : tankNear.x - oW / 2 - pW / 2;
          if (Math.abs(p.x - flushX) < 0.5) {
            return { ...p, x: flushX, autoAdjusted: true };
          }
        }
      }

      // 4. Fuel Tank Auto-Detect Engine Propellant Type: syncs tank fuel type to nearby/connected engine
      const isFuel = def.category === 'Fuel' || def.id === 'custom_fuel_tank';
      if (isFuel) {
        const adjacentEngine = currentParts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef) return false;
          const isEng = oDef.category === 'Propulsion' || oDef.id === 'modular_rocket_engine' || oDef.isSRB || Boolean(oDef.maxThrust && oDef.maxThrust > 0);
          if (!isEng) return false;
          const oH = getPartHeight(other, oDef);
          const dx = Math.abs(other.x - p.x);
          const dy = Math.abs(other.y - p.y);
          return dx < 1.0 && dy < (pH + oH) / 2 + 1.8;
        });

        if (adjacentEngine) {
          const engDef = PART_CATALOG[adjacentEngine.partId];
          let engPropellant: FuelType | undefined;
          if (adjacentEngine.engineConfig?.engineType) {
            const et = adjacentEngine.engineConfig.engineType.toLowerCase();
            if (et.includes('solid')) engPropellant = 'solid';
            else if (et.includes('hydrolox')) engPropellant = 'hydrolox';
            else if (et.includes('methalox')) engPropellant = 'methalox';
            else if (et.includes('hypergolic')) engPropellant = 'hypergolic';
            else engPropellant = 'kerolox';
          } else if (engDef?.fuelType) {
            engPropellant = engDef.fuelType as FuelType;
          } else if (engDef?.isSRB) {
            engPropellant = 'solid';
          }

          if (engPropellant && p.propellantType !== engPropellant) {
            return { ...p, propellantType: engPropellant, autoAdjusted: true };
          }
        }
      }

      return p;
    });
  }, []);

  // Trigger manual or automatic auto-adjustment
  const triggerAutoAdjust = () => {
    setParts((prev) => autoAdjustParts(prev));
  };

  // Group & Single Duplicate (with complete Symmetry Pair awareness)
  const duplicateSelectedParts = useCallback(() => {
    const uidsToDuplicate = selectedPlacedUids.length > 0 
      ? selectedPlacedUids 
      : selectedPlacedUid 
      ? [selectedPlacedUid] 
      : [];
    if (uidsToDuplicate.length === 0) return;

    const targets = (parts || []).filter((p) => uidsToDuplicate.includes(p.uid));
    if (targets.length === 0) return;

    // Collect pair IDs present in selection
    const pairIdMap = new Map<string, string>();
    targets.forEach((t) => {
      if (t.symmetryPairId && !pairIdMap.has(t.symmetryPairId)) {
        pairIdMap.set(t.symmetryPairId, 'sym_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
      }
    });

    const newUids: string[] = [];
    const duplicated: PlacedPart[] = targets.map((t) => {
      const newUid = 'part_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      newUids.push(newUid);
      const newPairId = t.symmetryPairId ? pairIdMap.get(t.symmetryPairId) : undefined;
      return {
        ...t,
        uid: newUid,
        symmetryPairId: newPairId,
        x: t.x + 1.0,
        y: t.y,
      };
    });

    // Also duplicate twins of selected parts if the twin wasn't individually in selection
    const extraTwins: PlacedPart[] = [];
    targets.forEach((t) => {
      if (t.symmetryPairId) {
        const twin = (parts || []).find((p) => p.symmetryPairId === t.symmetryPairId && p.uid !== t.uid);
        if (twin && !uidsToDuplicate.includes(twin.uid)) {
          const newTwinUid = 'part_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          extraTwins.push({
            ...twin,
            uid: newTwinUid,
            symmetryPairId: pairIdMap.get(t.symmetryPairId),
            x: -(t.x + 1.0),
            y: twin.y,
          });
        }
      }
    });

    setParts((prev) => [...prev, ...duplicated, ...extraTwins]);
    setSelectedPlacedUids(newUids);
    setSelectedPlacedUid(newUids[0] || null);
    soundEngine.playLegoSnapSound();
  }, [selectedPlacedUids, selectedPlacedUid, parts]);

  // Group & Single Delete (with Symmetry Pair awareness)
  const deleteSelectedParts = useCallback(() => {
    const uidsToDelete = selectedPlacedUids.length > 0 
      ? selectedPlacedUids 
      : selectedPlacedUid 
      ? [selectedPlacedUid] 
      : [];
    if (uidsToDelete.length === 0) return;

    const pairIdsToDelete = new Set(
      parts.filter((p) => uidsToDelete.includes(p.uid) && p.symmetryPairId).map((p) => p.symmetryPairId)
    );

    setParts((prev) => {
      const filtered = prev.filter(
        (p) => !uidsToDelete.includes(p.uid) && (!p.symmetryPairId || !pairIdsToDelete.has(p.symmetryPairId))
      );
      return autoAdjustEnabled ? autoAdjustParts(filtered) : filtered;
    });

    setSelectedPlacedUids([]);
    setSelectedPlacedUid(null);
  }, [selectedPlacedUids, selectedPlacedUid, parts, autoAdjustEnabled, autoAdjustParts]);

  // Turn or Rotate Selected Parts (with Symmetry Pair mirroring)
  const turnParts = useCallback((angleDelta: number = 90) => {
    const uidsToRotate = selectedPlacedUids.length > 0 
      ? selectedPlacedUids 
      : selectedPlacedUid 
      ? [selectedPlacedUid] 
      : (parts || []).filter((p) => PART_CATALOG[p.partId]?.isParachute).map((p) => p.uid);

    if (uidsToRotate.length === 0) return;

    const selectedPairs = new Set(
      parts.filter((p) => uidsToRotate.includes(p.uid) && p.symmetryPairId).map((p) => p.symmetryPairId)
    );

    setParts((prev) =>
      prev.map((p) => {
        if (uidsToRotate.includes(p.uid)) {
          return { ...p, rotation: (p.rotation + angleDelta + 360) % 360 };
        }
        if (p.symmetryPairId && selectedPairs.has(p.symmetryPairId)) {
          // Mirror rotation for symmetry twin
          return { ...p, rotation: (p.rotation - angleDelta + 360) % 360 };
        }
        return p;
      })
    );
  }, [selectedPlacedUids, selectedPlacedUid, parts]);

  // Turn all parachutes on the rocket
  const turnParachutes = useCallback((angleDelta: number = 180) => {
    setParts((prev) =>
      prev.map((p) => {
        const def = PART_CATALOG[p.partId];
        if (def?.isParachute) {
          return { ...p, rotation: (p.rotation + angleDelta + 360) % 360 };
        }
        return p;
      })
    );
  }, []);

  // Select All Parts
  const selectAllParts = useCallback(() => {
    const allUids = parts.map((p) => p.uid);
    setSelectedPlacedUids(allUids);
    if (allUids.length > 0) setSelectedPlacedUid(allUids[0]);
  }, [parts]);

  // Keyboard Shortcuts (R = rotate, T / F = turn/flip 180, Del = delete, Ctrl+D = duplicate, Ctrl+A = select all, Esc = deselect)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in search input or input elements
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      if (e.key === 'r' || e.key === 'R') {
        const delta = e.shiftKey ? 270 : 90;
        turnParts(delta);
      } else if (e.key === 't' || e.key === 'T' || e.key === 'f' || e.key === 'F') {
        turnParts(180);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedParts();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        duplicateSelectedParts();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        selectAllParts();
      } else if (e.key === 'Escape') {
        setSelectedPlacedUids([]);
        setSelectedPlacedUid(null);
        setIsBoxSelectMode(false);
      } else if (e.key === 'b' || e.key === 'B') {
        setIsBoxSelectMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPlacedUids, selectedPlacedUid, parts, duplicateSelectedParts, deleteSelectedParts, turnParts, selectAllParts]);

  // Auto Staging Generator
  const autoGenerateStaging = () => {
    const sorted = [...parts].sort((a, b) => a.y - b.y);
    let currentStage = 1;

    const newParts = sorted.map((p) => {
      const def = PART_CATALOG[p.partId];
      if (def?.isDecoupler || def?.isSideSeparator) {
        currentStage++;
        return { ...p, stage: currentStage };
      }
      return { ...p, stage: currentStage };
    });

    setParts(newParts);
  };

  // Convert Canvas Pixel to Precise World Grid Coordinates (Floating)
  const canvasToWorldGrid = useCallback((px: number, py: number, canvas: HTMLCanvasElement) => {
    const centerX = canvas.width / 2 + cameraOffset.x;
    const centerY = canvas.height / 2 + cameraOffset.y;
    return {
      x: (px - centerX) / cameraZoom,
      y: -(py - centerY) / cameraZoom,
    };
  }, [cameraOffset, cameraZoom]);

  // Convert Canvas Pixel to Snapped Grid Coordinates
  const canvasToGrid = useCallback((px: number, py: number, canvas: HTMLCanvasElement) => {
    const { x: gx, y: gy } = canvasToWorldGrid(px, py, canvas);
    if (gridSnap === 0) return { x: gx, y: gy };
    const step = 1 / gridSnap;
    return { x: Math.round(gx * step) / step, y: Math.round(gy * step) / step };
  }, [canvasToWorldGrid, gridSnap]);

  // Convert Grid to Canvas Pixel Coordinates
  const gridToCanvas = useCallback((gx: number, gy: number, canvas: HTMLCanvasElement) => {
    const centerX = canvas.width / 2 + cameraOffset.x;
    const centerY = canvas.height / 2 + cameraOffset.y;
    return {
      px: centerX + gx * cameraZoom,
      py: centerY - gy * cameraZoom,
    };
  }, [cameraOffset, cameraZoom]);

  // Precise Hit-testing with exact canvas-to-local part transform
  const findPartAtCanvasPx = useCallback(
    (clickPx: number, clickPy: number, canvas: HTMLCanvasElement) => {
      return (parts || []).slice().reverse().find((p) => {
        const def = PART_CATALOG[p.partId];
        if (!def) return false;
        const { px: partPx, py: partPy } = gridToCanvas(p.x, p.y, canvas);
        const dPx = clickPx - partPx;
        const dPy = clickPy - partPy;
        const rotRad = ((p.rotation || 0) * Math.PI) / 180;
        const cos = Math.cos(rotRad);
        const sin = Math.sin(rotRad);
        const localPx = dPx * cos + dPy * sin;
        const localPy = -dPx * sin + dPy * cos;
        const pw = getPartWidth(p, def) * cameraZoom;
        const ph = getPartHeight(p, def) * cameraZoom;
        return Math.abs(localPx) <= pw / 2 && Math.abs(localPy) <= ph / 2;
      });
    },
    [parts, gridToCanvas, cameraZoom]
  );

  const findPartAtWorldPos = useCallback(
    (worldX: number, worldY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const { px, py } = gridToCanvas(worldX, worldY, canvas);
      return findPartAtCanvasPx(px, py, canvas);
    },
    [findPartAtCanvasPx, gridToCanvas]
  );

  // Draw 2D Builder Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const w = canvas.width;
    const h = canvas.height;

    // 1. Dark Blueprint Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    // 2. Blueprint Grid Lines
    const centerX = w / 2 + cameraOffset.x;
    const centerY = h / 2 + cameraOffset.y;

    // Minor Grid (0.5m)
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const step = cameraZoom * 0.5;

    ctx.beginPath();
    for (let x = centerX % step; x < w; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = centerY % step; y < h; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Major Grid (2.0m)
    const majorStep = cameraZoom * 2;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = centerX % majorStep; x < w; x += majorStep) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = centerY % majorStep; y < h; y += majorStep) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Center Vertical Axis (Rocket Centerline & Symmetry Mirror Axis)
    ctx.strokeStyle = symmetryMode === '2x' ? '#38bdf8' : '#0284c7';
    ctx.lineWidth = symmetryMode === '2x' ? 2.5 : 2;
    ctx.setLineDash(symmetryMode === '2x' ? [8, 4] : [6, 6]);
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    if (symmetryMode === '2x') {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ 2X SYMMETRY MIRROR AXIS', centerX, 24);
    }

    // Ground line / launchpad base in builder (y = -6)
    const groundY = centerY - (-6) * cameraZoom;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    // 3. Render Placed Parts
    const connectivity = analyzeStructuralConnectivity(parts);
    const unattachedSet = new Set(connectivity.unattachedParts.map((u) => u.uid));

    parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (!def) return;

      const isUnattached = unattachedSet.has(p.uid);
      const { px, py } = gridToCanvas(p.x, p.y, canvas);
      const isSelected = selectedPlacedUids.includes(p.uid) || p.uid === selectedPlacedUid;
      const isHovered = p.uid === hoveredUid && !isSelected;

      ctx.save();
      try {
        ctx.translate(px, py);
        ctx.rotate((p.rotation * Math.PI) / 180);

      const partW = getPartWidth(p, def);
      const partH = getPartHeight(p, def);
      const pw = partW * cameraZoom;
      const ph = partH * cameraZoom;

      // Calculate Adaptive Adapter Dimensions (cone + cylinder transition)
      let topWidthPx: number | undefined;
      let bottomWidthPx: number | undefined;
      let adapterShape: 'cone_cylinder' | 'straight' | undefined;

      // Vertical Decouplers / Stage Separators & Interstage Adapters: adapt cone+cylinder transition between stages
      const isSeparationOrAdapter = (def.isDecoupler && !def.isSideSeparator) || p.partId === 'structural_adapter' || p.partId.includes('adapter') || p.partId.includes('decoupler');
      if (isSeparationOrAdapter) {
        const partBelow = parts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef) return false;
          const oH = getPartHeight(other, oDef);
          const otherTop = other.y + oH / 2;
          const myBottom = p.y - partH / 2;
          return Math.abs(other.x - p.x) < 0.8 && Math.abs(otherTop - myBottom) < 0.65;
        });

        const partAbove = parts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef) return false;
          const oH = getPartHeight(other, oDef);
          const otherBottom = other.y - oH / 2;
          const myTop = p.y + partH / 2;
          return Math.abs(other.x - p.x) < 0.8 && Math.abs(otherBottom - myTop) < 0.65;
        });

        const defaultBot = p.partId === 'structural_adapter' ? 3.0 : partW;
        const defaultTop = p.partId === 'structural_adapter' ? 2.0 : partW;

        const wBelow = p.adapterBottomWidth ?? (partBelow ? getPartWidth(partBelow, PART_CATALOG[partBelow.partId]) : (partAbove ? undefined : defaultBot));
        let wAbove = p.adapterTopWidth;

        if (!wAbove && partAbove) {
          const oDef = PART_CATALOG[partAbove.partId];
          if (oDef.category === 'Propulsion') {
            const oH = getPartHeight(partAbove, oDef);
            const tankAboveEng = parts.find((t) => {
              if (t.uid === partAbove.uid || t.uid === p.uid) return false;
              const tDef = PART_CATALOG[t.partId];
              if (!tDef || tDef.category !== 'Fuel') return false;
              const tH = getPartHeight(t, tDef);
              return Math.abs(t.x - partAbove.x) < 0.8 && Math.abs((t.y - tH / 2) - (partAbove.y + oH / 2)) < 0.65;
            });
            wAbove = tankAboveEng ? getPartWidth(tankAboveEng, PART_CATALOG[tankAboveEng.partId]) : getPartWidth(partAbove, oDef);
          } else {
            wAbove = getPartWidth(partAbove, oDef);
          }
        }
        if (!wAbove && !partBelow && p.partId === 'structural_adapter') {
          wAbove = defaultTop;
        }

        const effBot = wBelow ?? (wAbove !== undefined && wAbove > 1.8 ? wAbove * 1.35 : (p.partId === 'structural_adapter' ? defaultBot : partW));
        const effTop = wAbove ?? (wBelow !== undefined && wBelow > 1.8 ? wBelow * 0.75 : (p.partId === 'structural_adapter' ? defaultTop : partW));
        bottomWidthPx = effBot * cameraZoom;
        topWidthPx = effTop * cameraZoom;
        if (Math.abs(effBot - effTop) > 0.05 || p.partId === 'structural_adapter') {
          adapterShape = 'cone_cylinder';
        }

        // Cache onto part so flight canvas and debris preserve shape
        p.adapterBottomWidth = effBot;
        p.adapterTopWidth = effTop;
        p.adapterShape = adapterShape;
      }

      // Nose cones & aerodynamic caps maintain their authentic fixed width without dynamic stretching

      // Calculate Interstage Fairing Shroud (Separator covers engines of the next stage above it)
      let shroudHeightPx = 0;
      if (def.isDecoupler && !def.isSideSeparator) {
        const engineAbove = parts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef || (oDef.category !== 'Propulsion' && !oDef.isSRB && oDef.maxThrust <= 0)) return false;
          const dx = Math.abs(other.x - p.x);
          if (dx > 0.8) return false;
          const oH = getPartHeight(other, oDef);
          const otherBottom = other.y - oH / 2;
          const myTop = p.y + partH / 2;
          return other.y > p.y && otherBottom <= myTop + 2.5 && (myTop + 3.5) >= other.y;
        });
        if (engineAbove) {
          const oDef = PART_CATALOG[engineAbove.partId];
          const engH = getPartHeight(engineAbove, oDef);
          const shroudH = Math.max(engH, (engineAbove.y + engH / 2) - (p.y + partH / 2));
          shroudHeightPx = shroudH * cameraZoom;
        }
      }

      // Realistic Spaceflight Simulator / Space Agency part rendering
      drawPart2D(ctx, def, {
        widthPx: pw,
        heightPx: ph,
        rotation: 0,
        isSelected,
        isHovered,
        isFlight: false,
        deployed: p.deployed ?? false,
        deployProgress: p.deployProgress !== undefined ? p.deployProgress : (p.deployed ? 1.0 : 0.0),
        solarPanelType: p.solarPanelType,
        solarGridN: p.solarGridN,
        solarGridM: p.solarGridM,
        solarScale: p.solarScale,
        solarBoomLengthM: p.solarBoomLengthM,
        solarCellWidthM: p.solarCellWidthM,
        solarCellHeightM: p.solarCellHeightM,
        solarPanelStyle: p.solarPanelStyle,
        solarSectors: p.solarSectors,
        solarHexRings: p.solarHexRings,
        solarEfficiency: p.solarEfficiency,
        landingLegType: p.landingLegType,
        legSuspensionStiffness: p.legSuspensionStiffness,
        legSuspensionDamping: p.legSuspensionDamping,
        legDeployAngleDeg: p.legDeployAngleDeg,
        legFootpadType: p.legFootpadType,
        legScale: p.legScale,
        rcsThrusterType: p.rcsThrusterType,
        rcsNozzleCount: p.rcsNozzleCount,
        rcsThrustKn: p.rcsThrustKn,
        rcsPropellantType: p.rcsPropellantType,
        rcsCantAngleDeg: p.rcsCantAngleDeg,
        rcsScale: p.rcsScale,
        rcsFiring: p.rcsFiring,
        rcsFireDirection: p.rcsFireDirection,
        wheelSteerAngle: p.wheelSteerAngle,
        wheelRotation: p.wheelRotation,
        showSnapPoints: isSelected || isHovered || isDragging,
        shroudHeightPx,
        topWidthPx,
        bottomWidthPx,
        adapterShape,
        engineConfig: p.engineConfig,
        customNozzleType: p.customNozzleType,
        propellantType: p.propellantType,
        tankSkin: p.tankSkin,
        engineMountCount: p.engineMountCount,
        fuelPercent: p.maxFuel && p.maxFuel > 0 ? (p.fuelRemaining ?? p.maxFuel) / p.maxFuel : 1.0,
      });

      // Unattached part warning highlight: if part is not connected to root stack
      if (p.unattachedWarning) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-pw / 2 - 3, -ph / 2 - 3, pw + 6, ph + 6);
        ctx.setLineDash([]);

        // Small warning badge
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.roundRect(-pw / 2, -ph / 2 - 14, 56, 12, 3);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('DETACHED', -pw / 2 + 28, -ph / 2 - 8);
      }

      // Stage Number Pill (only display when part is selected to keep view uncluttered)
      if (isSelected) {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(pw * 0.4, -ph * 0.35, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`S${p.stage}`, pw * 0.4, -ph * 0.35);

        // Symmetry badge indicator
        if (p.symmetryPairId) {
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(-pw * 0.4, -ph * 0.35, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 8px monospace';
          ctx.fillText('SYM', -pw * 0.4, -ph * 0.35);
        }

        // Dimension annotations for fuel tanks (Dynamic height & width resizing)
        if (def.category === 'Fuel' || p.partId === 'custom_fuel_tank') {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          // Horizontal width bracket at bottom
          ctx.beginPath();
          ctx.moveTo(-pw / 2, ph / 2 + 8);
          ctx.lineTo(pw / 2, ph / 2 + 8);
          ctx.stroke();
          // Vertical height bracket at right
          ctx.beginPath();
          ctx.moveTo(pw / 2 + 8, -ph / 2);
          ctx.lineTo(pw / 2 + 8, ph / 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Dimension text
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`↔ ${partW.toFixed(2)}m`, 0, ph / 2 + 18);
          ctx.fillText(`↕ ${partH.toFixed(2)}m`, pw / 2 + 22, 0);
        }
      }
      } finally {
        ctx.restore();
      }
    });

    // 3.2. Protective Decoupler Interstage Shrouds (covers next stage engine until decoupler activates)
    parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      if (def?.isDecoupler && !def.isSideSeparator) {
        const partH = getPartHeight(p, def);
        const engineAbove = parts.find((other) => {
          if (other.uid === p.uid) return false;
          const oDef = PART_CATALOG[other.partId];
          if (!oDef || (oDef.category !== 'Propulsion' && !oDef.isSRB && oDef.maxThrust <= 0)) return false;
          const dx = Math.abs(other.x - p.x);
          if (dx > 0.8) return false;
          const oH = getPartHeight(other, oDef);
          const otherBottom = other.y - oH / 2;
          const myTop = p.y + partH / 2;
          return other.y > p.y && otherBottom <= myTop + 2.5 && (myTop + 3.5) >= other.y;
        });

        if (engineAbove) {
          const oDef = PART_CATALOG[engineAbove.partId];
          const engH = getPartHeight(engineAbove, oDef);
          const shroudH = Math.max(engH, (engineAbove.y + engH / 2) - (p.y + partH / 2));
          const shroudHeightPx = shroudH * cameraZoom;
          const pw = getPartWidth(p, def) * cameraZoom;
          const ph = partH * cameraZoom;
          const { px, py } = gridToCanvas(p.x, p.y, canvas);

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate((p.rotation * Math.PI) / 180);
          drawInterstageShroudDirect(
            ctx,
            0,
            -ph / 2,
            pw,
            shroudHeightPx,
            selectedPlacedUids.includes(p.uid) || selectedPlacedUids.includes(engineAbove.uid) || selectedPlacedUid === p.uid,
            hoveredUid === p.uid || hoveredUid === engineAbove.uid
          );
          ctx.restore();
        }
      }
    });

    // 3.5. Draw Marquee Selection Box
    if (selectionBox) {
      const p1 = gridToCanvas(selectionBox.startX, selectionBox.startY, canvas);
      const p2 = gridToCanvas(selectionBox.currentX, selectionBox.currentY, canvas);
      const bx = Math.min(p1.px, p2.px);
      const by = Math.min(p1.py, p2.py);
      const bw = Math.abs(p1.px - p2.px);
      const bh = Math.abs(p1.py - p2.py);

      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
    }

    // 4. Ghost Preview for Dragged Palette Part (with 2x Symmetry Support)
    if (paletteGhost && draggedPalettePart) {
      const { px, py } = gridToCanvas(paletteGhost.x, paletteGhost.y, canvas);
      const isCustomTank = draggedPalettePart.id === 'custom_fuel_tank';
      const isEngine = draggedPalettePart.category === 'Propulsion' || draggedPalettePart.id === 'modular_rocket_engine';
      const pw = (isCustomTank ? 2.0 : draggedPalettePart.width) * cameraZoom;
      const ph = (isCustomTank ? 3.0 : draggedPalettePart.height) * cameraZoom;

      ctx.save();
      ctx.translate(px, py);
      ctx.globalAlpha = 0.75;
      drawPart2D(ctx, draggedPalettePart, {
        widthPx: pw,
        heightPx: ph,
        rotation: 0,
        isSelected: true,
        isHovered: false,
        isFlight: false,
        showSnapPoints: true,
        engineConfig: isEngine ? DEFAULT_JUNO_ENGINE_CONFIG : undefined,
        tankSkin: (draggedPalettePart as any).tankSkin,
      });
      ctx.restore();

      // Mirrored Ghost in 2x Symmetry Mode
      if (symmetryMode === '2x' && Math.abs(paletteGhost.x) > 0.25 && draggedPalettePart.category !== 'Command') {
        const { px: mx, py: my } = gridToCanvas(-paletteGhost.x, paletteGhost.y, canvas);
        ctx.save();
        ctx.translate(mx, my);
        ctx.globalAlpha = 0.65;
        drawPart2D(ctx, draggedPalettePart, {
          widthPx: pw,
          heightPx: ph,
          rotation: 0,
          isSelected: false,
          isHovered: true,
          isFlight: false,
          showSnapPoints: true,
          engineConfig: isEngine ? DEFAULT_JUNO_ENGINE_CONFIG : undefined,
          tankSkin: (draggedPalettePart as any).tankSkin,
        });
        ctx.restore();
      }
    }

    // 5. High-Visibility Magnetic Snap Connection Visualizer
    if (activeSnap?.isSnapped && activeSnap.snapJointWorld) {
      const { px, py } = gridToCanvas(activeSnap.snapJointWorld.x, activeSnap.snapJointWorld.y, canvas);
      ctx.save();

      // Glowing Cyan Snap Joint Ring
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Horizontal alignment guideline
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 35, py);
      ctx.lineTo(px + 35, py);
      ctx.stroke();

      // Magnet Snap HUD Badge
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      const snapLabel = activeSnap.snapType === 'stack_top' ? 'MAGNET: STACK TOP'
        : activeSnap.snapType === 'stack_bottom' ? 'MAGNET: STACK BOTTOM'
        : activeSnap.snapType === 'centerline' ? 'CENTERLINE LOCKED'
        : 'RADIAL SNAP';
      ctx.fillText(snapLabel, px, py - 16);

      ctx.restore();
    }

    // 6. Center of Mass (CoM) Indicator
    if (showCoM && metrics.com && parts.length > 0) {
      const { px, py } = gridToCanvas(metrics.com.x, metrics.com.y, canvas);
      ctx.save();
      ctx.translate(px, py);

      // Yellow/Black Circle
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 10, 0, Math.PI * 0.5);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 10, Math.PI, Math.PI * 1.5);
      ctx.fill();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('CoM', 15, 4);
      ctx.restore();
    }

    // 7. Center of Thrust (CoT) Indicator
    if (showCoT && metrics.cot && parts.length > 0) {
      const { px, py } = gridToCanvas(metrics.cot.x, metrics.cot.y, canvas);
      ctx.save();
      ctx.translate(px, py);

      ctx.fillStyle = '#c084fc';
      ctx.strokeStyle = '#581c87';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Thrust Arrow (Pointing Down)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#c084fc';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('CoT', 15, 4);
      ctx.restore();
    }
  }, [parts, selectedPlacedUid, selectedPlacedUids, selectionBox, hoveredUid, cameraOffset, cameraZoom, gridToCanvas, metrics, showCoM, showCoT, activeSnap, paletteGhost, draggedPalettePart, isDragging]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Canvas Mouse Handlers:
  // 1. Click part -> selects it and opens details inspector immediately.
  // 2. Click & drag part / group -> moves parts together with symmetry mirroring.
  // 3. Normal drag on empty background -> pans the view or box selects when enabled.
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const worldPos = canvasToWorldGrid(px, py, canvas);

    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+click -> Pan canvas
      setIsPanning(true);
      setPanStart({ x: px - cameraOffset.x, y: py - cameraOffset.y });
      dragStateRef.current = {
        mode: 'PAN',
        startPx: px,
        startPy: py,
        hasMoved: false,
      };
      return;
    }

    if (e.button === 0) {
      // Left click
      const clickedPart = findPartAtCanvasPx(px, py, canvas);

      // If Box Select Mode is enabled, or user is clicking empty space while holding Ctrl/Meta
      if (isBoxSelectMode || (!clickedPart && (e.ctrlKey || e.metaKey))) {
        setSelectionBox({
          startX: worldPos.x,
          startY: worldPos.y,
          currentX: worldPos.x,
          currentY: worldPos.y,
        });
        dragStateRef.current = {
          mode: 'BOX_SELECT',
          startPx: px,
          startPy: py,
          boxStartWorld: { x: worldPos.x, y: worldPos.y },
          hasMoved: false,
        };
        return;
      }

      if (clickedPart) {
        let newSelection = [...selectedPlacedUids];
        if (e.shiftKey || e.ctrlKey) {
          // Toggle part in multi-selection
          if (newSelection.includes(clickedPart.uid)) {
            newSelection = newSelection.filter((id) => id !== clickedPart.uid);
          } else {
            newSelection.push(clickedPart.uid);
          }
        } else {
          // Normal click: if clicked part is NOT already part of the current selection, select it solely
          if (!newSelection.includes(clickedPart.uid)) {
            newSelection = [clickedPart.uid];
          }
        }

        setSelectedPlacedUid(clickedPart.uid);
        setSelectedPlacedUids(newSelection);

        // Capture initial positions of all selected parts for delta moving
        const initialPartPositions = parts
          .filter((p) => newSelection.includes(p.uid))
          .map((p) => ({ uid: p.uid, x: p.x, y: p.y }));

        // Capture initial positions of symmetry twins that are not in newSelection
        const selectedSymIds = new Set(
          parts.filter((p) => newSelection.includes(p.uid) && p.symmetryPairId).map((p) => p.symmetryPairId)
        );
        const initialTwinPositions = parts
          .filter((p) => !newSelection.includes(p.uid) && p.symmetryPairId && selectedSymIds.has(p.symmetryPairId))
          .map((p) => ({ uid: p.uid, x: p.x, y: p.y }));

        dragStateRef.current = {
          mode: 'PART_PENDING',
          partUid: clickedPart.uid,
          startPx: px,
          startPy: py,
          offsetWorldX: clickedPart.x - worldPos.x,
          offsetWorldY: clickedPart.y - worldPos.y,
          initialAnchorPos: { x: clickedPart.x, y: clickedPart.y },
          initialLinkedJoint: { x: clickedPart.x, y: clickedPart.y },
          initialPartPositions,
          initialTwinPositions,
          hasMoved: false,
        };
      } else {
        // Clicked on empty canvas space -> Start PANNING across the build area
        if (!e.shiftKey) {
          setSelectedPlacedUid(null);
          setSelectedPlacedUids([]);
        }
        setIsPanning(true);
        setPanStart({ x: px - cameraOffset.x, y: py - cameraOffset.y });
        dragStateRef.current = {
          mode: 'PAN',
          startPx: px,
          startPy: py,
          hasMoved: false,
        };
      }
    }
  };

  const processPointerMove = useCallback(
    (px: number, py: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const worldPos = canvasToWorldGrid(px, py, canvas);

      // Update hover state if not dragging
      if (!dragStateRef.current) {
        const hPart = findPartAtCanvasPx(px, py, canvas);
        setHoveredUid(hPart ? hPart.uid : null);
        return;
      }

      const ds = dragStateRef.current;
      const dist = Math.hypot(px - ds.startPx, py - ds.startPy);

      if (ds.mode === 'PAN') {
        ds.hasMoved = true;
        setCameraOffset({
          x: px - panStart.x,
          y: py - panStart.y,
        });
      } else if (ds.mode === 'BOX_SELECT' && ds.boxStartWorld) {
        ds.hasMoved = true;
        const currentBox = {
          startX: ds.boxStartWorld.x,
          startY: ds.boxStartWorld.y,
          currentX: worldPos.x,
          currentY: worldPos.y,
        };
        setSelectionBox(currentBox);

        // Determine all parts intersecting the selection rectangle
        const minX = Math.min(currentBox.startX, currentBox.currentX);
        const maxX = Math.max(currentBox.startX, currentBox.currentX);
        const minY = Math.min(currentBox.startY, currentBox.currentY);
        const maxY = Math.max(currentBox.startY, currentBox.currentY);

        const insideUids: string[] = [];
        parts.forEach((p) => {
          const def = PART_CATALOG[p.partId];
          const baseW = getPartWidth(p, def);
          const baseH = getPartHeight(p, def);
          const pRot = (((p.rotation ?? 0) % 180) + 180) % 180;
          const pw = pRot === 90 ? baseH : baseW;
          const ph = pRot === 90 ? baseW : baseH;
          const pMinX = p.x - pw / 2;
          const pMaxX = p.x + pw / 2;
          const pMinY = p.y - ph / 2;
          const pMaxY = p.y + ph / 2;
          if (pMinX <= maxX && pMaxX >= minX && pMinY <= maxY && pMaxY >= minY) {
            insideUids.push(p.uid);
          }
        });

        setSelectedPlacedUids(insideUids);
        if (insideUids.length > 0) {
          setSelectedPlacedUid(insideUids[0]);
        }
      } else if (ds.mode === 'PART_PENDING' || ds.mode === 'PART_DRAGGING') {
        // Move part ONLY when clicked and dragged beyond 3px threshold
        if (dist > 3 || ds.mode === 'PART_DRAGGING') {
          ds.mode = 'PART_DRAGGING';
          ds.hasMoved = true;
          setIsDragging(true);
          if (ds.partUid) setDraggedUid(ds.partUid);

          const rawTargetX = worldPos.x + (ds.offsetWorldX || 0);
          const rawTargetY = worldPos.y + (ds.offsetWorldY || 0);

          let snappedX = gridSnap === 0 ? rawTargetX : Math.round(rawTargetX / gridSnap) * gridSnap;
          let snappedY = gridSnap === 0 ? rawTargetY : Math.round(rawTargetY / gridSnap) * gridSnap;

          // Spaceflight Simulator Magnetic Snapping Engine
          const currentPart = parts.find((p) => p.uid === ds.partUid);
          if (currentPart) {
            const def = PART_CATALOG[currentPart.partId];
            const pW = getPartWidth(currentPart, def);
            const pH = getPartHeight(currentPart, def);

            // Filter out parts in the moving group from being snap targets to avoid snapping to themselves
            const movingUids = new Set((ds.initialPartPositions || []).map((ip) => ip.uid));
            if (currentPart.uid) movingUids.add(currentPart.uid);
            const snapCandidateParts = parts.filter((p) => !movingUids.has(p.uid));

            const snapResult = calculateMagneticSnap(
              {
                x: rawTargetX,
                y: rawTargetY,
                width: pW,
                height: pH,
                rotation: currentPart.rotation,
                partId: currentPart.partId,
                uid: currentPart.uid,
              },
              snapCandidateParts,
              {
                threshold: 0.65,
                initialLinkedJoint: ds.initialLinkedJoint,
                disableSnap: gridSnap === 0,
              }
            );

            if (snapResult.isSnapped) {
              snappedX = snapResult.x;
              snappedY = snapResult.y;
              setActiveSnap(snapResult);
              if (!wasSnappedRef.current) {
                soundEngine.playLegoSnapSound();
                wasSnappedRef.current = true;
              }
            } else {
              setActiveSnap(null);
              wasSnappedRef.current = false;
              if (Math.abs(snappedX) < 0.25) {
                snappedX = 0;
              }
            }
          }

          // Calculate displacement delta from initial anchor position
          const anchor = ds.initialAnchorPos || { x: snappedX, y: snappedY };
          const deltaX = snappedX - anchor.x;
          const deltaY = snappedY - anchor.y;

          const initPosMap = new Map<string, { uid: string; x: number; y: number }>(
            (ds.initialPartPositions || []).map((ip) => [ip.uid, ip])
          );
          const initTwinMap = new Map<string, { uid: string; x: number; y: number }>(
            (ds.initialTwinPositions || []).map((it) => [it.uid, it])
          );

          setParts((prev) =>
            prev.map((p) => {
              const initPos = initPosMap.get(p.uid);
              if (initPos) {
                return {
                  ...p,
                  x: initPos.x + deltaX,
                  y: initPos.y + deltaY,
                };
              }
              const initTwin = initTwinMap.get(p.uid);
              if (initTwin) {
                // Symmetrical twin mirrors X movement and matches Y movement
                return {
                  ...p,
                  x: initTwin.x - deltaX,
                  y: initTwin.y + deltaY,
                };
              }
              if (p.uid === ds.partUid) {
                return { ...p, x: snappedX, y: snappedY };
              }
              return p;
            })
          );
        }
      }
    },
    [canvasToWorldGrid, findPartAtCanvasPx, panStart, parts, gridSnap]
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    processPointerMove(px, py);
  };

  const handleMouseUp = useCallback(() => {
    if (dragStateRef.current) {
      const ds = dragStateRef.current;
      // If user clicked empty space without dragging, deselect parts
      if (ds.mode === 'PAN' && !ds.hasMoved) {
        setSelectedPlacedUid(null);
        setSelectedPlacedUids([]);
      }
      if (ds.mode === 'PART_DRAGGING' && autoAdjustEnabled) {
        setParts((prev) => autoAdjustParts(prev));
      }
      dragStateRef.current = null;
    }
    setSelectionBox(null);
    setActiveSnap(null);
    wasSnappedRef.current = false;
    setIsDragging(false);
    setDraggedUid(null);
    setIsPanning(false);
  }, [autoAdjustEnabled, autoAdjustParts]);

  // Window-level mouse listeners to prevent dropped drags during fast movement
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      processPointerMove(px, py);
    };

    const onWindowMouseUp = () => {
      if (dragStateRef.current) {
        handleMouseUp();
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [processPointerMove, handleMouseUp]);

  // Mouse Wheel Zooming around cursor
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(72, Math.max(14, cameraZoom * zoomFactor));

    const centerX = canvas.width / 2 + cameraOffset.x;
    const centerY = canvas.height / 2 + cameraOffset.y;
    const gx = (px - centerX) / cameraZoom;
    const gy = -(py - centerY) / cameraZoom;

    const newCenterX = px - gx * newZoom;
    const newCenterY = py + gy * newZoom;

    setCameraZoom(newZoom);
    setCameraOffset({
      x: newCenterX - canvas.width / 2,
      y: newCenterY - canvas.height / 2,
    });
  };

  // Add Part from Palette (with optional 2x Mirror Symmetry or Drag & Drop Target Position)
  const addPartToGrid = (def: PartDefinition, customPos?: { x: number; y: number }) => {
    const newUid = 'part_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const maxY = parts.reduce((max, p) => Math.max(max, p.y), 0);
    const isFuel = def.category === 'Fuel' || def.id === 'custom_fuel_tank';
    const isSRB = Boolean(def.isSRB || def.fuelType === 'solid' || def.id === 'engine_srb' || def.id === 'engine_sepratron' || def.id === 'launch_escape_tower');
    const isEngine = def.category === 'Propulsion' || def.id === 'modular_rocket_engine' || isSRB;
    const initialW = isFuel ? 2.0 : def.width;
    const initialH = isFuel ? 3.0 : def.height;
    const tankProps = isFuel ? calculateFuelTankProperties(initialW, initialH) : null;
    const initialFuel = tankProps ? tankProps.fuelMass : (isSRB ? (def.fuelMass || 15.0) : def.fuelMass);

    const initialEngineConfig: JunoEngineConfig | undefined = def.id === 'modular_rocket_engine'
      ? { ...DEFAULT_JUNO_ENGINE_CONFIG }
      : isSRB
      ? {
          ...DEFAULT_JUNO_ENGINE_CONFIG,
          engineType: 'Solid',
          powerCycle: 'Booster',
          solidGrain: 'Steady',
          nozzleStyle: 'Cone',
        }
      : isEngine
      ? { ...DEFAULT_JUNO_ENGINE_CONFIG }
      : undefined;

    const initialPropellant: FuelType | undefined = isFuel
      ? 'kerolox'
      : isSRB
      ? 'solid'
      : (def.fuelType as FuelType) || undefined;

    let targetX = customPos ? customPos.x : 0;
    let targetY = customPos ? customPos.y : (parts.length === 0 ? 0 : maxY + initialH * 0.5 + 0.5);

    if (customPos) {
      const snapResult = calculateMagneticSnap(
        {
          x: targetX,
          y: targetY,
          width: initialW,
          height: initialH,
          partId: def.id,
        },
        parts,
        {
          threshold: 0.75,
          disableSnap: gridSnap === 0,
        }
      );
      if (snapResult.isSnapped) {
        targetX = snapResult.x;
        targetY = snapResult.y;
      }
    }

    const defaultRot = 0;
    soundEngine.playLegoSnapSound();

    if (symmetryMode === '2x' && def.category !== 'Command') {
      const pairId = 'sym_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      const posX = customPos ? Math.max(0.6, Math.abs(targetX)) : Math.max(1.4, initialW * 0.85);
      const partLeft: PlacedPart = {
        uid: newUid + '_l',
        partId: def.id,
        customWidth: isFuel ? initialW : undefined,
        customHeight: isFuel ? initialH : undefined,
        tankSkin: isFuel ? 'white' : undefined,
        propellantType: initialPropellant,
        engineConfig: initialEngineConfig ? { ...initialEngineConfig } : undefined,
        x: -posX,
        y: targetY,
        rotation: defaultRot,
        stage: 1,
        fuelRemaining: initialFuel,
        maxFuel: initialFuel,
        ablatorRemaining: def.ablatorMass || 0,
        symmetryPairId: pairId,
      };
      const partRight: PlacedPart = {
        uid: newUid + '_r',
        partId: def.id,
        customWidth: isFuel ? initialW : undefined,
        customHeight: isFuel ? initialH : undefined,
        tankSkin: isFuel ? 'white' : undefined,
        propellantType: initialPropellant,
        engineConfig: initialEngineConfig ? { ...initialEngineConfig } : undefined,
        x: posX,
        y: targetY,
        rotation: defaultRot,
        stage: 1,
        fuelRemaining: initialFuel,
        maxFuel: initialFuel,
        ablatorRemaining: def.ablatorMass || 0,
        symmetryPairId: pairId,
      };
      setParts((prev) => {
        const updated = [...prev, partLeft, partRight];
        return autoAdjustEnabled ? autoAdjustParts(updated) : updated;
      });
      setSelectedPlacedUid(partRight.uid);
      setSelectedPlacedUids([partRight.uid]);
    } else {
      const newPart: PlacedPart = {
        uid: newUid,
        partId: def.id,
        customWidth: isFuel ? initialW : undefined,
        customHeight: isFuel ? initialH : undefined,
        tankSkin: isFuel ? 'white' : undefined,
        propellantType: initialPropellant,
        engineConfig: initialEngineConfig ? { ...initialEngineConfig } : undefined,
        x: targetX,
        y: targetY,
        rotation: defaultRot,
        stage: 1,
        fuelRemaining: initialFuel,
        maxFuel: initialFuel,
        ablatorRemaining: def.ablatorMass || 0,
      };
      setParts((prev) => {
        const updated = [...prev, newPart];
        return autoAdjustEnabled ? autoAdjustParts(updated) : updated;
      });
      setSelectedPlacedUid(newUid);
      setSelectedPlacedUids([newUid]);
    }
  };

  const handlePaletteDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    const canvas = canvasRef.current;
    const def = draggedPalettePart || draggedPalettePartRef.current;
    if (!canvas || !def) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const worldPos = canvasToWorldGrid(px, py, canvas);

    const isFuel = def.category === 'Fuel' || def.id === 'custom_fuel_tank';
    const pW = isFuel ? 2.0 : def.width;
    const pH = isFuel ? 3.0 : def.height;

    const snapResult = calculateMagneticSnap(
      {
        x: worldPos.x,
        y: worldPos.y,
        width: pW,
        height: pH,
        rotation: 0,
        partId: def.id,
      },
      parts,
      {
        threshold: 0.75,
        disableSnap: gridSnap === 0,
      }
    );

    if (snapResult.isSnapped) {
      setPaletteGhost({ x: snapResult.x, y: snapResult.y, isSnapped: true });
      setActiveSnap(snapResult);
      if (!wasSnappedRef.current) {
        soundEngine.playLegoSnapSound();
        wasSnappedRef.current = true;
      }
    } else {
      const targetX = gridSnap === 0 ? worldPos.x : Math.round(worldPos.x / gridSnap) * gridSnap;
      const targetY = gridSnap === 0 ? worldPos.y : Math.round(worldPos.y / gridSnap) * gridSnap;
      setPaletteGhost({ x: targetX, y: targetY, isSnapped: false });
      setActiveSnap(null);
      wasSnappedRef.current = false;
    }
  };

  const handlePaletteDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setPaletteGhost(null);
    setActiveSnap(null);
    wasSnappedRef.current = false;
  };

  const handlePaletteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const worldPos = canvasToWorldGrid(px, py, canvas);

    let partDef = draggedPalettePart || draggedPalettePartRef.current;
    if (!partDef) {
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (raw) {
          const parsed = JSON.parse(raw);
          partDef = PART_CATALOG[parsed.id] || parsed;
        }
      } catch {
        // fallback
      }
    }

    if (partDef) {
      const finalPos = paletteGhost && paletteGhost.isSnapped
        ? { x: paletteGhost.x, y: paletteGhost.y }
        : { x: worldPos.x, y: worldPos.y };
      addPartToGrid(partDef, finalPos);
    }

    draggedPalettePartRef.current = null;
    setDraggedPalettePart(null);
    setPaletteGhost(null);
    setActiveSnap(null);
    wasSnappedRef.current = false;
  };

  const loadPreset = (preset: (typeof PRESET_ROCKETS)[0]) => {
    setParts(JSON.parse(JSON.stringify(preset.parts)));
    lastEntireRocketPartsRef.current = JSON.parse(JSON.stringify(preset.parts));
    setShowPresets(false);
  };

  // Add booster structure to current rocket assembly
  const handleAddBoosterStructureToRocket = (
    boosterStage: StageAssembly,
    mode: 'twin' | 'left' | 'right' = 'twin'
  ) => {
    let baseParts = buildMode === 'ENTIRE' ? parts : lastEntireRocketPartsRef.current;
    if (baseParts.length === 0) {
      baseParts = assembleStagesToRocket(stageAssemblies.filter((s) => s.role !== 'BOOSTER'));
    }
    const updatedParts = attachBoosterStructureToRocket(baseParts, boosterStage, mode);
    lastEntireRocketPartsRef.current = updatedParts;
    setParts(updatedParts);
    setSelectedPlacedUid(null);
    setBuildMode('ENTIRE');
    soundEngine.playLegoSnapSound();
  };

  // Stack a stage structure (payload, upper, or core) onto the rocket
  const handleStackStageStructureToRocket = (
    stage: StageAssembly,
    position: 'top' | 'bottom' = 'bottom'
  ) => {
    let baseParts = buildMode === 'ENTIRE' ? parts : lastEntireRocketPartsRef.current;
    const updatedParts = stackStructureOntoRocket(baseParts, stage, position);
    lastEntireRocketPartsRef.current = updatedParts;
    setParts(updatedParts);
    setSelectedPlacedUid(null);
    setBuildMode('ENTIRE');
    soundEngine.playLegoSnapSound();
  };

  // Create a brand new custom structure subassembly
  const handleAddNewStructure = () => {
    const count = stageAssemblies.length + 1;
    const newStructure: StageAssembly = {
      id: `structure_custom_${Date.now()}`,
      name: `Custom Structure #${count}`,
      role: 'CUSTOM',
      decouplerBelow: true,
      parts: [
        {
          uid: `cust_pod_${Date.now()}`,
          partId: 'probe_core',
          x: 0,
          y: 1.0,
          rotation: 0,
          stage: 1,
          fuelRemaining: 0,
          maxFuel: 0,
          ablatorRemaining: 0,
        },
        {
          uid: `cust_tank_${Date.now()}`,
          partId: 'custom_fuel_tank',
          customWidth: 1.5,
          customHeight: 3.0,
          tankSkin: 'white',
          x: 0,
          y: -1.0,
          rotation: 0,
          stage: 1,
          fuelRemaining: 6.0,
          maxFuel: 6.0,
          ablatorRemaining: 0,
        },
      ],
    };
    setStageAssemblies((prev) => [...prev, newStructure]);
    setActiveStageId(newStructure.id);
    if (buildMode === 'STAGE_WISE') {
      setParts([...newStructure.parts]);
    } else {
      lastEntireRocketPartsRef.current = parts;
      setBuildMode('STAGE_WISE');
      setParts([...newStructure.parts]);
    }
    soundEngine.playRotateClickSound();
  };

  const categories: (PartCategory | 'All' | 'Structures')[] = [
    'All',
    'Structures',
    'Command',
    'Fuel',
    'Propulsion',
    'Aerodynamics',
    'Station',
    'Utility',
    'Structural',
  ];

  const getPartMetricBadge = (def: PartDefinition) => {
    if (def.category === 'Station') {
      return { text: def.crewCapacity ? `${def.crewCapacity} Crew` : 'Orbital', tag: 'Station', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
    }
    if (def.category === 'Propulsion' && def.maxThrust > 0) {
      return { text: `${def.maxThrust} kN`, tag: 'Thrust', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    }
    if (def.category === 'Fuel') {
      return { text: 'Custom', tag: 'Fuel', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
    }
    if (def.category === 'Command') {
      return { text: `${def.torque || 15} kNm`, tag: 'Control', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
    if (def.isDecoupler) {
      return { text: 'Stage', tag: 'Sep', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' };
    }
    if (def.isParachute) {
      return { text: 'Chute', tag: 'Aero', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    }
    if (def.isHeatShield) {
      return { text: `${def.ablatorMass || 0.8}t`, tag: 'Heat', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' };
    }
    if (def.isSolarPanel) {
      return { text: 'Power', tag: 'Solar', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
    }
    if (def.isLandingLeg) {
      return { text: 'Gear', tag: 'Leg', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
    }
    if (def.isDockingPort) {
      return { text: 'Dock', tag: 'Port', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' };
    }
    if (def.category === 'Aerodynamics') {
      return { text: `Cd ${def.dragCoeff}`, tag: 'Aero', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' };
    }
    return { text: `${def.dryMass}t`, tag: 'Dry', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
  };
  
  const seenCatalogIds = new Set<string>();
  const filteredCatalog = Object.values(PART_CATALOG).filter((p) => {
    if (!p || seenCatalogIds.has(p.id)) {
      return false;
    }
    // User requested: "remove all fuel tank . make that user can adjust the hight,width"
    // We remove all old static hardcoded fuel tanks, keeping only the parametric Modular Fuel Tank!
    if (p.category === 'Fuel' && p.id !== 'custom_fuel_tank') {
      return false;
    }
    // User requested: "1. remove all engiens in build mode. 2. make a single engien and in parts edit box we can change it configs."
    // We remove all hardcoded static engines, keeping only the single configurable Rocket Engine!
    if (p.category === 'Propulsion' && p.id !== 'modular_rocket_engine') {
      return false;
    }
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = searchQuery.trim() === '' || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    if (matchesCat && matchesSearch) {
      seenCatalogIds.add(p.id);
      return true;
    }
    return false;
  });

  // Dynamic canvas cursor
  const canvasCursor = isDragging || isPanning 
    ? 'cursor-grabbing' 
    : selectionBox || isBoxSelectMode
    ? 'cursor-crosshair'
    : hoveredUid 
    ? 'cursor-grab' 
    : 'cursor-default';

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      {/* Top Header & Rocket Metrics */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/95 backdrop-blur-md px-4 flex items-center justify-between z-10 shrink-0">
        {/* Left: Spaceport Return & VAB Badge */}
        <div className="flex items-center gap-3">
          {onReturnToSpaceport && (
            <button
              id="return-spaceport-btn"
              onClick={onReturnToSpaceport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition shadow-sm cursor-pointer active:scale-95"
              title="Return to Spaceport Campus Home"
            >
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Spaceport</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="font-black text-sm text-white tracking-wide flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-sky-400" />
              <span>VAB High Bay 1</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {parts.length} parts
            </span>
          </div>
        </div>

        {/* Center: Clean Real-time Metrics Readout */}
        <div className="hidden lg:flex items-center gap-4 bg-slate-950/70 border border-slate-800/90 rounded-xl px-4 py-1 text-xs font-mono">
          <div>
            <span className="text-slate-500">Wet / Dry:</span>{' '}
            <span className="text-amber-400 font-semibold">
              {(metrics?.wetMass ?? 0).toFixed(1)}t / {(metrics?.dryMass ?? 0).toFixed(1)}t
            </span>
          </div>
          <div className="w-px h-5 bg-slate-800" />
          <div>
            <span className="text-slate-500">Fuel:</span>{' '}
            <span className="text-sky-400 font-semibold">
              {(metrics?.wetMass ?? 0) > 0
                ? (((metrics.totalFuelMass || 0) / metrics.wetMass) * 100).toFixed(0)
                : 0}
              %
            </span>
          </div>
          <div className="w-px h-5 bg-slate-800" />
          <div>
            <span className="text-slate-500">Thrust:</span>{' '}
            <span className="text-rose-400 font-semibold">{(metrics?.totalThrust ?? 0).toFixed(0)} kN</span>
          </div>
          <div className="w-px h-5 bg-slate-800" />
          <div>
            <span className="text-slate-500">SL TWR:</span>{' '}
            <span className={`font-semibold ${(metrics?.twrSeaLevel ?? 0) >= 1.15 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(metrics?.twrSeaLevel ?? 0).toFixed(2)}
            </span>
          </div>
          <div className="w-px h-5 bg-slate-800" />
          <div>
            <span className="text-slate-500">Est. Δv:</span>{' '}
            <span className="text-sky-400 font-semibold">{(metrics?.estimatedDeltaV ?? 0).toFixed(0)} m/s</span>
          </div>
          <div className="w-px h-5 bg-slate-800" />
          <div className="flex items-center gap-1">
            {metrics.hasCommandUnit ? (
              <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Command OK</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-rose-400 text-[11px] font-bold animate-pulse" title="Need Cockpit or Probe Core">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>No Command</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Mode Toggles & Launch Action */}
        <div className="flex items-center gap-2">
          {/* Build Mode Selector */}
          <div className="hidden sm:flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => {
                if (buildMode === 'STAGE_WISE') {
                  setStageAssemblies((prev) =>
                    prev.map((s) => (s.id === activeStageId ? { ...s, parts: [...parts] } : s))
                  );
                  setParts(lastEntireRocketPartsRef.current);
                }
                setBuildMode('ENTIRE');
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                buildMode === 'ENTIRE' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Rocket Assembly</span>
            </button>
            <button
              onClick={() => {
                if (buildMode === 'ENTIRE') {
                  lastEntireRocketPartsRef.current = parts;
                }
                setBuildMode('STAGE_WISE');
                const active = (stageAssemblies || []).find((s) => s.id === activeStageId) || stageAssemblies?.[0];
                if (active) {
                  setParts([...active.parts]);
                  setSelectedPlacedUid(null);
                }
              }}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                buildMode === 'STAGE_WISE' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Structure Workshop</span>
            </button>
          </div>

          <button
            onClick={() => setShowPresets(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            title="Load Preset Rocket Blueprint"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Presets</span>
          </button>

          {/* Visible Save / File Button */}
          {onOpenSaveModal && (
            <button
              id="builder-save-btn"
              onClick={onOpenSaveModal}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Save Rocket Blueprint / Export Game Save (Auto-saves every 10 min)"
            >
              <Save className="w-3.5 h-3.5 text-emerald-100" />
              <span>Save</span>
            </button>
          )}

          <button
            onClick={() => setShowPerformanceAnalyzer(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            title="Performance Analyzer"
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Physics</span>
          </button>

          <button
            onClick={() => setShowControlsHelp((h) => !h)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            title="Shortcuts Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (window.confirm('Clear all parts from the workspace?')) {
                setParts([]);
                setSelectedPlacedUid(null);
              }
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/50 hover:text-rose-400 text-slate-400 transition cursor-pointer"
            title="Clear Workspace"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Bold Launch Button */}
          <button
            id="builder-launch-btn"
            onClick={() => {
              if (parts.length === 0) return;
              if (!metrics.hasCommandUnit) {
                const proceed = window.confirm(
                  'Notice: This craft has no Command Unit (Cockpit or Probe Core)!\n\nPer Parts System Section 3.1: "No command unit = no control, no telemetry, nothing works."\n\nLaunch anyway as an unguided test drone?'
                );
                if (!proceed) return;
              }
              onLaunch(parts);
            }}
            disabled={parts.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition cursor-pointer active:scale-95"
            title="Launch Rocket: Rollout to Pad & Ignite Engines"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>LAUNCH</span>
          </button>
        </div>
      </header>

      {/* Sub-header Staging / Upgrade Mode Banners */}
      {buildMode === 'STAGE_WISE' && (
        <StageWiseManager
          stages={stageAssemblies}
          stageAssemblies={stageAssemblies}
          activeStageId={activeStageId}
          onSelectStage={(stageId) => {
            // Save current stage parts before switching
            setStageAssemblies((prev) =>
              (prev || []).map((s) => (s.id === activeStageId ? { ...s, parts: [...parts] } : s))
            );
            setActiveStageId(stageId);
            const target = (stageAssemblies || []).find((s) => s.id === stageId);
            if (target) {
              setParts([...target.parts]);
              setSelectedPlacedUid(null);
            }
          }}
          onUpdateStages={(updated) => {
            setStageAssemblies(updated);
            const current = (updated || []).find((s) => s.id === activeStageId);
            if (current) {
              setParts([...current.parts]);
            }
          }}
          onAssembleToRocket={(assembled) => {
            lastEntireRocketPartsRef.current = assembled;
            setParts(assembled);
            setBuildMode('ENTIRE');
            setSelectedPlacedUid(null);
          }}
          onAddBoosterToRocket={handleAddBoosterStructureToRocket}
          onStackStageToRocket={handleStackStageStructureToRocket}
          onReturnToRocketBuilder={() => {
            setStageAssemblies((prev) =>
              prev.map((s) => (s.id === activeStageId ? { ...s, parts: [...parts] } : s))
            );
            setParts(lastEntireRocketPartsRef.current);
            setBuildMode('ENTIRE');
          }}
          onAddNewStructure={handleAddNewStructure}
          onDecomposeCurrentRocket={() => {
            const base = lastEntireRocketPartsRef.current.length > 0 ? lastEntireRocketPartsRef.current : parts;
            const decomposed = extractStagesFromRocket(base);
            setStageAssemblies(decomposed);
            if (decomposed[0]) {
              setActiveStageId(decomposed[0].id);
              setParts([...decomposed[0].parts]);
            }
          }}
          onLaunch={onLaunch}
        />
      )}

      {buildMode === 'HYBRID' && (
        <AddUpgradeMode
          currentParts={parts}
          stages={stageAssemblies || []}
          metrics={metrics}
          onApplyParts={(upgraded) => {
            setParts(upgraded);
            setSelectedPlacedUid(null);
          }}
          onSwitchToStageWorkshop={(stageId) => {
            setBuildMode('STAGE_WISE');
            setActiveStageId(stageId);
            const active = (stageAssemblies || []).find((s) => s.id === stageId) || stageAssemblies?.[0];
            if (active) {
              setParts([...active.parts]);
              setSelectedPlacedUid(null);
            }
          }}
          onLaunch={() => onLaunch(parts)}
        />
      )}

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Side: Visual Part Palette (Compact & Collapsible) */}
        <div className={`${isPaletteCollapsed ? 'w-10' : 'w-56 sm:w-64'} border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-md flex flex-col z-10 shrink-0 transition-all duration-200`}>
          {/* Header & Collapse Toggle */}
          <div className="p-2 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
            {!isPaletteCollapsed && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Magnet className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider truncate">Parts Catalog</span>
              </div>
            )}
            <button
              onClick={() => setIsPaletteCollapsed((c) => !c)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer mx-auto"
              title={isPaletteCollapsed ? 'Expand Parts Palette' : 'Collapse Parts Palette'}
            >
              {isPaletteCollapsed ? <PanelLeftOpen className="w-3.5 h-3.5 text-sky-400" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
            </button>
          </div>

          {!isPaletteCollapsed && (
            <>
              {/* Search & View Toggle Bar */}
              <div className="p-2 border-b border-slate-800/80 flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                  <input
                    type="text"
                    placeholder="Search parts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md pl-7 pr-2 py-1 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5">
                  <button
                    onClick={() => setPaletteViewMode('grid')}
                    className={`p-1 rounded transition cursor-pointer ${
                      paletteViewMode === 'grid' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setPaletteViewMode('list')}
                    className={`p-1 rounded transition cursor-pointer ${
                      paletteViewMode === 'list' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="List View"
                  >
                    <List className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Category Tabs */}
              <div className="p-1.5 border-b border-slate-800/80 flex flex-wrap gap-1 bg-slate-950/40">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Visual Parts Grid / List with Drag & Drop OR Structures View */}
              <div className="flex-1 overflow-y-auto p-2">
                {selectedCategory === 'Structures' ? (
                  <div className="flex flex-col gap-2.5">
                    {/* Structure Subassembly Intro Banner */}
                    <div className="bg-sky-950/40 border border-sky-800/60 rounded-xl p-2.5 text-xs">
                      <div className="flex items-center gap-1.5 text-sky-300 font-bold mb-1">
                        <Layers className="w-3.5 h-3.5 text-sky-400" />
                        <span>Structures & Boosters</span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-relaxed">
                        Build parts into structures on the workbench, then use complete structures as parts in your rocket!
                      </p>
                      <button
                        onClick={() => {
                          lastEntireRocketPartsRef.current = parts;
                          setBuildMode('STAGE_WISE');
                          const active = (stageAssemblies || []).find((s) => s.id === activeStageId) || stageAssemblies?.[0];
                          if (active) setParts([...active.parts]);
                        }}
                        className="mt-2 w-full py-1.5 px-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] flex items-center justify-center gap-1.5 transition cursor-pointer shadow"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        <span>Open Structure Workshop</span>
                      </button>
                    </div>

                    {/* List of Available Structures */}
                    <div className="flex flex-col gap-2">
                      {stageAssemblies.map((stg) => {
                        const stats = calculateIsolatedStageMetrics(stg);
                        const isBooster = stg.role === 'BOOSTER';
                        const icon = isBooster ? '⚡' : stg.role === 'PAYLOAD' ? '🛰️' : stg.role === 'UPPER_STAGE' ? '🌌' : '🔥';
                        return (
                          <div
                            key={stg.id}
                            className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2 hover:border-sky-500/50 transition group shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[11px] text-white flex items-center gap-1">
                                <span>{icon}</span>
                                <span className="truncate">{stg.name}</span>
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 shrink-0">
                                {stg.parts.length} parts
                              </span>
                            </div>

                            {/* Quick Metrics */}
                            <div className="grid grid-cols-2 gap-1 text-[9px] text-slate-400 font-mono bg-slate-900/80 p-1.5 rounded-lg border border-slate-850">
                              <div>Mass: <span className="text-slate-200">{stats.wetMass.toFixed(1)}t</span></div>
                              <div>Thrust: <span className="text-amber-300">{stats.thrust}kN</span></div>
                              <div>TWR: <span className={stats.twr >= 1.0 ? 'text-emerald-400' : 'text-slate-300'}>{stats.twr.toFixed(2)}</span></div>
                              <div>Δv: <span className="text-teal-300">{stats.deltaV}m/s</span></div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col gap-1 mt-0.5">
                              {isBooster ? (
                                <>
                                  <button
                                    onClick={() => handleAddBoosterStructureToRocket(stg, 'twin')}
                                    className="w-full py-1 px-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow transition cursor-pointer active:scale-95"
                                    title="Add matching twin strap-on boosters with side separators to rocket"
                                  >
                                    <Zap className="w-3 h-3 fill-white" />
                                    <span>Add Twin Boosters (2x)</span>
                                  </button>
                                  <div className="grid grid-cols-2 gap-1">
                                    <button
                                      onClick={() => handleAddBoosterStructureToRocket(stg, 'left')}
                                      className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-medium transition cursor-pointer text-center"
                                    >
                                      + Left Booster
                                    </button>
                                    <button
                                      onClick={() => handleAddBoosterStructureToRocket(stg, 'right')}
                                      className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[9px] font-medium transition cursor-pointer text-center"
                                    >
                                      + Right Booster
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleStackStageStructureToRocket(stg, stg.role === 'PAYLOAD' ? 'top' : 'bottom')}
                                  className="w-full py-1 px-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] flex items-center justify-center gap-1 shadow transition cursor-pointer active:scale-95"
                                  title="Stack this modular structure onto your rocket"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Stack into Rocket</span>
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  lastEntireRocketPartsRef.current = parts;
                                  setActiveStageId(stg.id);
                                  setParts([...stg.parts]);
                                  setBuildMode('STAGE_WISE');
                                  soundEngine.playRotateClickSound();
                                }}
                                className="w-full py-1 px-2 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[9px] transition cursor-pointer flex items-center justify-center gap-1 mt-0.5"
                                title="Edit this structure's parts on the workbench"
                              >
                                <span>🛠️ Edit Structure on Bench</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={handleAddNewStructure}
                      className="w-full py-2 px-2.5 rounded-xl border border-dashed border-slate-700 hover:border-sky-500 bg-slate-950/40 hover:bg-sky-950/20 text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Structure</span>
                    </button>
                  </div>
                ) : paletteViewMode === 'grid' ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {filteredCatalog.map((def) => {
                      const badge = getPartMetricBadge(def);
                      return (
                        <div
                          key={def.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedPalettePart(def);
                            draggedPalettePartRef.current = def;
                            e.dataTransfer.setData('application/json', JSON.stringify(def));
                            e.dataTransfer.setData('text/plain', def.id);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={() => {
                            draggedPalettePartRef.current = null;
                            setDraggedPalettePart(null);
                            setPaletteGhost(null);
                            setActiveSnap(null);
                          }}
                          onClick={() => addPartToGrid(def)}
                          className="group p-1.5 rounded-lg border border-slate-800/90 bg-slate-950/70 hover:border-sky-500/80 hover:bg-slate-800/60 transition-all duration-150 cursor-grab active:cursor-grabbing flex flex-col items-center justify-between shadow-sm relative overflow-hidden select-none"
                          title={`${def.name} - Drag onto rocket or click to add`}
                        >
                          {/* Visual Part Graphic Preview */}
                          <div className="w-full flex items-center justify-center py-1 bg-slate-950/90 rounded border border-slate-900 overflow-hidden pointer-events-none">
                            <PartThumbnail part={def} width={75} height={60} className="w-full h-14 object-contain" />
                          </div>

                          {/* Part Identity Title */}
                          <div className="w-full mt-1 text-center pointer-events-none">
                            <h4 className="text-[10px] font-bold text-slate-100 group-hover:text-sky-400 transition truncate">
                              {def.name}
                            </h4>
                          </div>

                          {/* Stats Badges */}
                          <div className="w-full flex items-center justify-between mt-1 pt-0.5 border-t border-slate-800/60 text-[9px] font-mono pointer-events-none">
                            <span className={`px-1 py-0.2 rounded font-bold border text-[8px] ${badge.color}`}>
                              {badge.text}
                            </span>
                            <span className="text-slate-400">
                              {(def.dryMass + def.fuelMass).toFixed(1)}t
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredCatalog.map((def) => {
                      const badge = getPartMetricBadge(def);
                      return (
                        <div
                          key={def.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedPalettePart(def);
                            draggedPalettePartRef.current = def;
                            e.dataTransfer.setData('application/json', JSON.stringify(def));
                            e.dataTransfer.setData('text/plain', def.id);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={() => {
                            draggedPalettePartRef.current = null;
                            setDraggedPalettePart(null);
                            setPaletteGhost(null);
                            setActiveSnap(null);
                          }}
                          onClick={() => addPartToGrid(def)}
                          className="group p-1.5 rounded-lg border border-slate-800 bg-slate-950/60 hover:border-sky-500/60 hover:bg-slate-800/50 transition cursor-grab active:cursor-grabbing flex items-center justify-between shadow-sm select-none"
                        >
                          <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                            <PartThumbnail part={def} width={36} height={36} className="shrink-0" />
                            <div className="min-w-0">
                              <h4 className="text-[11px] font-bold text-slate-100 group-hover:text-sky-400 transition truncate">
                                {def.name}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-mono">
                                <span className={`px-1 py-0.2 rounded border text-[8px] ${badge.color}`}>
                                  {badge.text}
                                </span>
                                <span className="text-slate-400">
                                  {(def.dryMass + def.fuelMass).toFixed(1)}t
                                </span>
                              </div>
                            </div>
                          </div>
                          <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition shrink-0 ml-1.5" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Center: 2D Builder Canvas */}
        <div 
          className="flex-1 relative overflow-hidden bg-slate-950"
          onDragOver={handlePaletteDragOver}
          onDragLeave={handlePaletteDragLeave}
          onDrop={handlePaletteDrop}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onDragOver={handlePaletteDragOver}
            onDrop={handlePaletteDrop}
            className={`w-full h-full block ${canvasCursor}`}
          />

          {/* Floating Top-Left Builder Toolbar */}
          <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-2 shadow-2xl z-10">
            {/* Box / Marquee Multi-Select Mode */}
            <button
              onClick={() => setIsBoxSelectMode((prev) => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isBoxSelectMode
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
              title="Toggle Box Multi-Select Mode (Shortcut: B)"
            >
              <BoxSelect className="w-3.5 h-3.5 text-sky-400" />
              <span>Box Select</span>
            </button>

            {/* Select All */}
            <button
              onClick={selectAllParts}
              disabled={parts.length === 0}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Select All Parts (Ctrl+A)"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Select All</span>
            </button>

            {/* Rotate */}
            <button
              onClick={() => turnParts(90)}
              disabled={selectedPlacedUids.length === 0 && !selectedPlacedUid}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Rotate 90° Clockwise (R)"
            >
              <RotateCw className="w-3.5 h-3.5 text-sky-400" />
              <span>Rotate</span>
            </button>

            {/* Duplicate */}
            <button
              onClick={duplicateSelectedParts}
              disabled={selectedPlacedUids.length === 0 && !selectedPlacedUid}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Duplicate Selected (Ctrl+D)"
            >
              <Copy className="w-3.5 h-3.5 text-indigo-400" />
              <span>Duplicate</span>
            </button>

            {/* Delete */}
            <button
              onClick={deleteSelectedParts}
              disabled={selectedPlacedUids.length === 0 && !selectedPlacedUid}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/50 disabled:opacity-40 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Delete Selected Parts (Del / Backspace)"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete</span>
            </button>

            {/* Selection Counter Pill */}
            {selectedPlacedUids.length > 1 && (
              <span className="px-2 py-1 rounded-xl bg-sky-950/80 border border-sky-500/40 text-sky-300 text-xs font-bold">
                {selectedPlacedUids.length} Selected
              </span>
            )}

            <div className="w-px h-6 bg-slate-800" />

            {/* Auto-Adjust Part Sizes Toggle & Manual Trigger */}
            <button
              onClick={() => {
                const next = !autoAdjustEnabled;
                setAutoAdjustEnabled(next);
                if (next) triggerAutoAdjust();
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                autoAdjustEnabled ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Auto-adjust adapter sizes: Decouplers morph into cone+cylinder shapes to match adjacent stages; Nose cones match base tank widths"
            >
              <Sliders className="w-3.5 h-3.5 text-teal-300" />
              <span>Auto-Size: {autoAdjustEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Symmetry Mode Toggle */}
            <button
              onClick={() => setSymmetryMode((m) => (m === '1x' ? '2x' : '1x'))}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                symmetryMode === '2x' ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Toggle 2x Mirror Symmetry Mode"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              <span>Symmetry: {symmetryMode}</span>
            </button>

            {/* Grid Snap Toggle */}
            <button
              onClick={() => setGridSnap((s) => (s === 0.5 ? 0.25 : s === 0.25 ? 0 : 0.5))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              title="Cycle Grid Snap Precision"
            >
              Snap: {gridSnap === 0 ? 'Free' : `${gridSnap}m`}
            </button>

            <div className="w-px h-6 bg-slate-800" />

            {/* CoM / CoT Toggles */}
            <button
              onClick={() => setShowCoM((c) => !c)}
              className={`p-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                showCoM ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
              }`}
              title="Toggle Center of Mass"
            >
              CoM
            </button>

            <button
              onClick={() => setShowCoT((c) => !c)}
              className={`p-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                showCoT ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40' : 'bg-slate-800 text-slate-400'
              }`}
              title="Toggle Center of Thrust"
            >
              CoT
            </button>

            <div className="w-px h-6 bg-slate-800" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCameraZoom((z) => Math.max(14, z * 0.85))}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold flex items-center justify-center cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setCameraZoom((z) => Math.min(72, z * 1.15))}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold flex items-center justify-center cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setCameraOffset({ x: 0, y: 0 });
                  setCameraZoom(32);
                }}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold flex items-center justify-center cursor-pointer"
                title="Reset View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Navigation Guide Pill */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 flex items-center gap-3 shadow-lg z-10">
            <span className="flex items-center gap-1 text-sky-400">
              <Move className="w-3 h-3" />
              <span>Drag part to move</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-slate-300">
              <span>Drag background to pan</span>
            </span>
            <span>•</span>
            <span>Scroll to zoom</span>
            <span>•</span>
            <span className="text-slate-400">R: Rotate • Del: Delete</span>
          </div>

        </div>

        {/* Right Side: Dual-Mode Inspector & Staging Column (Docked on the side - compact & collapsible) */}
        <div className={`${isInspectorCollapsed ? 'w-10' : 'w-60 sm:w-68'} border-l border-slate-800/80 bg-slate-900/95 backdrop-blur-md flex flex-col z-10 shrink-0 transition-all duration-200`}>
          {/* Header & Collapse Toggle */}
          <div className="p-1.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60">
            <button
              onClick={() => setIsInspectorCollapsed((c) => !c)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer mx-auto"
              title={isInspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'}
            >
              {isInspectorCollapsed ? <PanelRightOpen className="w-3.5 h-3.5 text-sky-400" /> : <PanelRightClose className="w-3.5 h-3.5" />}
            </button>
            {!isInspectorCollapsed && (
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider pr-1">Inspector</span>
            )}
          </div>

          {!isInspectorCollapsed && (
            <>
              {/* Inspector Tab Switcher: Details | Staging | Actions */}
              <div className="p-1.5 border-b border-slate-800/80 flex items-center bg-slate-950/60 gap-1">
                <button
                  onClick={() => setRightSidebarTab('details')}
                  className={`flex-1 py-1 px-1.5 rounded text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    rightSidebarTab === 'details'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>Details</span>
                  {selectedPart && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                </button>
                <button
                  onClick={() => setRightSidebarTab('staging')}
                  className={`flex-1 py-1 px-1.5 rounded text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    rightSidebarTab === 'staging'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Staging ({stageNumbers.length})</span>
                </button>
                <button
                  onClick={() => setRightSidebarTab('actionGroups')}
                  className={`flex-1 py-1 px-1.5 rounded text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    rightSidebarTab === 'actionGroups'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                  title="Configure Action Groups (Gear, Solar, RCS, Custom 1-8)"
                >
                  <Settings2 className="w-3 h-3" />
                  <span>Actions</span>
                </button>
              </div>

              {/* Tab 1: Selected Part Details (Docked on Side) */}
              {rightSidebarTab === 'details' && (
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 font-mono text-xs">
              {selectedPart && selectedPartDef ? (
                <div className="space-y-3">
                  {/* Part Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full shrink-0" 
                        style={{ backgroundColor: selectedPartDef.color }} 
                      />
                      <div>
                        <h3 className="font-bold text-white font-sans text-sm leading-tight">{selectedPartDef.name}</h3>
                        <span className="text-[10px] text-slate-400 font-mono">{selectedPartDef.category} Module</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-bold">
                        Stg {selectedPart.stage}
                      </span>
                      <button
                        onClick={() => setSelectedPlacedUid(null)}
                        className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                        title="Deselect Part"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                    {selectedPartDef.description}
                  </p>

                  {/* Procedural Inspector */}
                  <ProceduralPartInspector
                    part={selectedPart}
                    onUpdatePart={(updated) => {
                      const pairId = selectedPart.symmetryPairId;
                      setParts((prev) => {
                        const updatedParts = prev.map((p) => {
                          if (p.uid === selectedPart.uid) return { ...p, ...updated };
                          if (pairId && p.symmetryPairId === pairId) {
                            return {
                              ...p,
                              ...updated,
                              uid: p.uid,
                              x: p.x, // Preserve mirrored X position
                              symmetryPairId: pairId,
                            };
                          }
                          return p;
                        });
                        return autoAdjustEnabled ? autoAdjustParts(updatedParts) : updatedParts;
                      });
                    }}
                    allParts={parts}
                    onUpdateAllParts={(newParts) => setParts(newParts)}
                  />

                  {/* Rotation Selector */}
                  <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-xl border border-slate-800/60 text-[11px]">
                    <span className="text-slate-500">Angle:</span>
                    <div className="flex items-center gap-1">
                      {[0, 90, 180, 270].map((deg) => (
                        <button
                          key={deg}
                          onClick={() => {
                            const delta = (deg - selectedPart.rotation + 360) % 360;
                            turnParts(delta);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
                            selectedPart.rotation === deg
                              ? 'bg-sky-600 text-white font-bold'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                          }`}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Transform Actions */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      onClick={() => {
                        turnParts(180);
                      }}
                      className="px-2 py-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/50 text-sky-200 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      title="Turn / Flip 180° (Shortcut: T or F)"
                    >
                      <FlipHorizontal className="w-3.5 h-3.5 text-sky-400" />
                      <span>Flip 180°</span>
                    </button>

                    <button
                      onClick={() => {
                        const pairId = selectedPart.symmetryPairId;
                        setParts((prev) =>
                          prev
                            .filter((p) => !pairId || p.symmetryPairId !== pairId || p.uid === selectedPart.uid)
                            .map((p) => (p.uid === selectedPart.uid ? { ...p, x: 0, symmetryPairId: undefined } : p))
                        );
                      }}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      title="Center on rocket centerline"
                    >
                      <Disc className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Center X=0</span>
                    </button>

                    <button
                      onClick={() => {
                        const newStage = Math.max(1, selectedPart.stage - 1);
                        const pairId = selectedPart.symmetryPairId;
                        setParts((prev) =>
                          prev.map((p) => (p.uid === selectedPart.uid || (pairId && p.symmetryPairId === pairId) ? { ...p, stage: newStage } : p))
                        );
                      }}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Stage -</span>
                    </button>

                    <button
                      onClick={() => {
                        const newStage = selectedPart.stage + 1;
                        const pairId = selectedPart.symmetryPairId;
                        setParts((prev) =>
                          prev.map((p) => (p.uid === selectedPart.uid || (pairId && p.symmetryPairId === pairId) ? { ...p, stage: newStage } : p))
                        );
                      }}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" />
                      <span>Stage +</span>
                    </button>

                    <button
                      onClick={duplicateSelectedParts}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      title="Duplicate Part (Ctrl+D)"
                    >
                      <Copy className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Duplicate</span>
                    </button>

                    <button
                      onClick={deleteSelectedParts}
                      className="px-2 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                      title="Delete Part (Del)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-4 text-slate-500 space-y-2 font-sans">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-center text-slate-400">
                    <Sliders className="w-6 h-6 text-slate-400" />
                  </div>
                  <h4 className="font-bold text-slate-300 text-xs">No Part Selected</h4>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-relaxed">
                    Click any placed part in the workspace to adjust its dimensions, fuel types, rotation, and engine settings.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Staging Sequence & Pre-Launch Checklist (Simple Rocket 2 / KSP Concept) */}
          {rightSidebarTab === 'staging' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-slate-950/40">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-200">Staging Stack</span>
                  <span className="text-[10px] text-sky-400 font-mono bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/50">
                    {stageNumbers.length} {stageNumbers.length === 1 ? 'Stage' : 'Stages'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setParts((prev) => insertNewStage(prev, Math.max(...stageNumbers, 0) + 1))}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-slate-700/60"
                    title="Add a new empty stage"
                  >
                    <Plus className="w-3 h-3 text-emerald-400" />
                    <span>Add</span>
                  </button>
                  <button
                    onClick={autoGenerateStaging}
                    className="px-2 py-1 rounded-lg bg-sky-600/20 text-sky-400 hover:bg-sky-600/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer border border-sky-500/30"
                    title="Auto-calculate stages from decouplers"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Auto-Stage</span>
                  </button>
                </div>
              </div>

              {/* Staging Core Concept Banner */}
              <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800/60 text-[10px] text-slate-400 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                <p className="leading-tight">
                  <strong className="text-slate-200">KSP / SR2 Staging:</strong> Drag parts between stages. Empty stages auto-skip during flight in one press without consuming an extra trigger.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {stageChecklist.map((stgInfo) => {
                  const stgNum = stgInfo.stage;
                  const stageParts = parts.filter((p) => p.stage === stgNum);
                  const isHoveredDrop = draggedStagePartUid !== null;

                  return (
                    <div
                      key={stgNum}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const droppedUid = e.dataTransfer.getData('text/plain') || draggedStagePartUid;
                        if (droppedUid) {
                          const targetPart = parts.find((p) => p.uid === droppedUid);
                          if (targetPart) {
                            const pairId = targetPart.symmetryPairId;
                            setParts((prev) =>
                              prev.map((item) =>
                                item.uid === droppedUid || (pairId && item.symmetryPairId === pairId)
                                  ? { ...item, stage: stgNum }
                                  : item
                              )
                            );
                          }
                          setDraggedStagePartUid(null);
                        }
                      }}
                      className={`border rounded-xl bg-slate-950/70 p-2.5 space-y-2.5 transition-all ${
                        isHoveredDrop
                          ? 'border-sky-500/50 bg-sky-950/20'
                          : stgInfo.isEmpty
                          ? 'border-dashed border-slate-800/80 bg-slate-950/40'
                          : 'border-slate-800/80'
                      }`}
                    >
                      {/* Stage Header & Actions */}
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 text-sky-400 font-mono">
                            <span className={`w-2 h-2 rounded-full ${stgInfo.isEmpty ? 'bg-slate-600' : 'bg-sky-400'}`} />
                            Stage {stgNum}
                          </span>

                          {/* Empty Stage Auto-Skip Badge (Requirement 3 & 6) */}
                          {stgInfo.isEmpty ? (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-950/40 text-amber-400 border border-amber-800/40 flex items-center gap-1 cursor-help"
                              title="Empty Stage: Contains no engines, decouplers, or actions. During flight, staging will automatically skip past this stage in a single press."
                            >
                              <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
                              EMPTY (Auto-skips)
                            </span>
                          ) : (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold flex items-center gap-1 ${
                                stgInfo.isReady
                                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                                  : 'bg-amber-950/40 text-amber-400 border border-amber-800/40'
                              }`}
                            >
                              {stgInfo.isReady ? (
                                <>
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                  READY
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                                  CHECK
                                </>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Stage Reordering & Merging Controls (Requirement 4) */}
                        <div className="flex items-center gap-1">
                          {/* Move Stage Up */}
                          <button
                            onClick={() => setParts((prev) => reorderStages(prev, stgNum, stgNum + 1))}
                            className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer border border-slate-800"
                            title="Move Stage Higher in Sequence"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>

                          {/* Move Stage Down */}
                          {stgNum > 1 && (
                            <button
                              onClick={() => setParts((prev) => reorderStages(prev, stgNum, stgNum - 1))}
                              className="w-5 h-5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition cursor-pointer border border-slate-800"
                              title="Move Stage Lower in Sequence"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          )}

                          {/* Merge Stages */}
                          {stgNum > 1 && (
                            <button
                              onClick={() => setParts((prev) => mergeStages(prev, stgNum, stgNum - 1))}
                              className="px-1.5 h-5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-sky-300 text-[10px] font-mono flex items-center gap-1 transition cursor-pointer border border-slate-800"
                              title={`Merge Stage ${stgNum} into Stage ${stgNum - 1}`}
                            >
                              <GitMerge className="w-2.5 h-2.5" />
                              <span>Merge</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Pre-Launch Stage Readout Checklist (Requirement 6) */}
                      {!stgInfo.isEmpty && (
                        <div className="space-y-1.5">
                          {/* Physical Metrics Grid */}
                          <div className="grid grid-cols-4 gap-1 text-[10px] font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800/60 text-slate-400">
                            <div>
                              <span className="text-slate-500 block text-[9px]">Δv:</span>
                              <span className="text-sky-400 font-bold">{stgInfo.deltaVMs.toFixed(0)} m/s</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">TWR SL:</span>
                              <span
                                className={`font-bold ${
                                  stgInfo.twrSeaLevel >= 1.05
                                    ? 'text-emerald-400'
                                    : stgInfo.twrSeaLevel > 0
                                    ? 'text-amber-400'
                                    : 'text-slate-500'
                                }`}
                              >
                                {stgInfo.twrSeaLevel > 0 ? stgInfo.twrSeaLevel.toFixed(2) : '-'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">Thrust:</span>
                              <span className="text-white font-bold">{stgInfo.thrustKn > 0 ? `${stgInfo.thrustKn.toFixed(0)} kN` : '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">Burn:</span>
                              <span className="text-white font-bold">
                                {stgInfo.burnTimeSec > 0 ? `${stgInfo.burnTimeSec.toFixed(0)}s` : '-'}
                              </span>
                            </div>
                            <div className="col-span-2 pt-1 border-t border-slate-800/60">
                              <span className="text-slate-500 block text-[9px]">Mass (Wet / Dry):</span>
                              <span className="text-slate-300 font-bold">
                                {stgInfo.wetMassTonnes.toFixed(1)}t / {stgInfo.dryMassTonnes.toFixed(1)}t
                              </span>
                            </div>
                            <div className="col-span-2 pt-1 border-t border-slate-800/60">
                              <span className="text-slate-500 block text-[9px]">Usable Fuel:</span>
                              <span className="text-emerald-400 font-bold">{stgInfo.fuelMassTonnes.toFixed(1)} t</span>
                            </div>
                          </div>

                          {/* Stage Checklist Items */}
                          <div className="space-y-0.5 bg-slate-900/40 p-1.5 rounded-lg border border-slate-800/40 text-[10px]">
                            {stgInfo.checklist.map((chk, i) => (
                              <div
                                key={i}
                                className={`flex items-center gap-1.5 ${
                                  chk.status === 'ok'
                                    ? 'text-emerald-400'
                                    : chk.status === 'warning'
                                    ? 'text-amber-400 font-medium'
                                    : 'text-slate-400'
                                }`}
                              >
                                {chk.status === 'ok' ? (
                                  <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                ) : chk.status === 'warning' ? (
                                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                ) : (
                                  <Info className="w-3 h-3 text-sky-400 shrink-0" />
                                )}
                                <span>{chk.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Drag & Drop Parts List */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
                          <span>Parts in Stage ({stageParts.length})</span>
                          <span className="text-[9px] text-slate-600">Drag to re-stage</span>
                        </div>

                        {stageParts.length === 0 ? (
                          <div className="p-2 border border-dashed border-slate-800/60 rounded-lg text-center text-[10px] text-slate-500 font-mono">
                            Drop parts here to assign to Stage {stgNum}
                          </div>
                        ) : (
                          stageParts.map((p) => {
                            const def = PART_CATALOG[p.partId];
                            const isEngine = def?.maxThrust && def.maxThrust > 0;
                            const isDecoupler = def?.isDecoupler || def?.isSideSeparator;

                            return (
                              <div
                                key={p.uid}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', p.uid);
                                  setDraggedStagePartUid(p.uid);
                                }}
                                onDragEnd={() => setDraggedStagePartUid(null)}
                                onClick={() => {
                                  setSelectedPlacedUid(p.uid);
                                  setRightSidebarTab('details');
                                }}
                                className={`p-1.5 rounded-lg border text-xs flex items-center justify-between cursor-grab active:cursor-grabbing transition ${
                                  selectedPlacedUid === p.uid
                                    ? 'border-sky-500 bg-sky-500/10 text-sky-200'
                                    : 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/40 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <GripVertical className="w-3 h-3 text-slate-600 shrink-0" />
                                  {isEngine && <Flame className="w-3 h-3 text-amber-400 shrink-0" />}
                                  {isDecoupler && <Split className="w-3 h-3 text-rose-400 shrink-0" />}
                                  <span className="font-medium truncate text-[11px]">{def?.name}</span>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Split Stage: extracts this part into its own new stage */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setParts((prev) => splitStage(prev, stgNum, [p.uid]));
                                    }}
                                    className="px-1 h-4 rounded bg-slate-800 hover:bg-slate-700 text-[9px] text-slate-400 hover:text-sky-300 font-mono transition cursor-pointer"
                                    title="Split part into new separate stage"
                                  >
                                    Split
                                  </button>

                                  {/* Quick Step Buttons */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const pairId = p.symmetryPairId;
                                      setParts((prev) =>
                                        prev.map((item) =>
                                          item.uid === p.uid || (pairId && item.symmetryPairId === pairId)
                                            ? { ...item, stage: Math.max(1, item.stage - 1) }
                                            : item
                                        )
                                      );
                                    }}
                                    className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-bold flex items-center justify-center cursor-pointer"
                                    title="Move to Lower Stage"
                                  >
                                    -
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const pairId = p.symmetryPairId;
                                      setParts((prev) =>
                                        prev.map((item) =>
                                          item.uid === p.uid || (pairId && item.symmetryPairId === pairId)
                                            ? { ...item, stage: item.stage + 1 }
                                            : item
                                        )
                                      );
                                    }}
                                    className="w-4 h-4 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-bold flex items-center justify-center cursor-pointer"
                                    title="Move to Higher Stage"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Action Groups Manager (Requirement 5) */}
          {rightSidebarTab === 'actionGroups' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-3 border-b border-slate-800/80 bg-slate-950/40">
                <span className="text-xs font-bold text-slate-200">Action Groups</span>
                <p className="text-[10px] text-slate-400 leading-tight mt-1">
                  Non-propulsive actions (solar panels, landing gear, RCS, lights, drills) live exclusively in Action Groups, keeping sequential staging clean so pressing &quot;Stage&quot; during ascent never accidentally triggers them.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-xs">
                {/* Standard System Action Groups */}
                <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider px-0.5">
                  Standard System Groups
                </div>

                {[
                  { id: 101, name: 'GEAR', desc: 'Landing legs & gear deployment', icon: Shield },
                  { id: 102, name: 'SOLAR', desc: 'Solar arrays unfold / retract', icon: Sun },
                  { id: 103, name: 'RCS', desc: 'Attitude control & thrusters', icon: Compass },
                  { id: 104, name: 'LIGHTS', desc: 'Illumination & spotlights', icon: Sparkles },
                  { id: 105, name: 'DRILL', desc: 'Surface harvester drills', icon: Factory },
                  { id: 106, name: 'ABORT', desc: 'Emergency escape & jettison', icon: AlertTriangle },
                ].map((grp) => {
                  const assignedParts = parts.filter((p) => p.actionGroup === grp.id);
                  const isSelectedAssigned = selectedPart?.actionGroup === grp.id;
                  const GroupIcon = grp.icon;

                  return (
                    <div key={grp.id} className="border border-slate-800 rounded-xl bg-slate-950/60 p-2.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-sky-950/60 border border-sky-800/40 flex items-center justify-center text-sky-400">
                            <GroupIcon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-200 text-xs block">{grp.name}</span>
                            <span className="text-[10px] text-slate-500 font-sans leading-none">{grp.desc}</span>
                          </div>
                        </div>

                        {selectedPart && (
                          <button
                            onClick={() => {
                              const pairId = selectedPart.symmetryPairId;
                              setParts((prev) =>
                                prev.map((item) =>
                                  item.uid === selectedPart.uid || (pairId && item.symmetryPairId === pairId)
                                    ? { ...item, actionGroup: isSelectedAssigned ? undefined : grp.id }
                                    : item
                                )
                              );
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                              isSelectedAssigned
                                ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50 hover:bg-rose-900/60'
                                : 'bg-sky-600/20 text-sky-400 border border-sky-500/30 hover:bg-sky-600/30'
                            }`}
                          >
                            {isSelectedAssigned ? 'Unassign' : 'Assign Selected'}
                          </button>
                        )}
                      </div>

                      {/* Assigned Parts List */}
                      {assignedParts.length > 0 ? (
                        <div className="space-y-1 pt-1 border-t border-slate-900">
                          {assignedParts.map((p) => {
                            const def = PART_CATALOG[p.partId];
                            return (
                              <div
                                key={p.uid}
                                className="flex items-center justify-between text-[10px] p-1 bg-slate-900/60 rounded border border-slate-800/60 text-slate-300"
                              >
                                <span className="truncate">{def?.name}</span>
                                <button
                                  onClick={() => {
                                    const pairId = p.symmetryPairId;
                                    setParts((prev) =>
                                      prev.map((item) =>
                                        item.uid === p.uid || (pairId && item.symmetryPairId === pairId)
                                          ? { ...item, actionGroup: undefined }
                                          : item
                                      )
                                    );
                                  }}
                                  className="text-rose-400 hover:text-rose-300 px-1"
                                  title="Remove from group"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-600 italic">No parts assigned</div>
                      )}
                    </div>
                  );
                })}

                {/* Numbered Custom Action Groups 1 to 8 */}
                <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wider px-0.5 pt-2">
                  Custom Hotkey Groups (Keys 1-8)
                </div>

                {[1, 2, 3, 4, 5, 6, 7, 8].map((agNum) => {
                  const assignedParts = parts.filter((p) => p.actionGroup === agNum);
                  const isSelectedAssigned = selectedPart?.actionGroup === agNum;

                  return (
                    <div key={agNum} className="border border-slate-800/80 rounded-xl bg-slate-950/40 p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-300 text-xs">Action Group {agNum}</span>
                        {selectedPart && (
                          <button
                            onClick={() => {
                              const pairId = selectedPart.symmetryPairId;
                              setParts((prev) =>
                                prev.map((item) =>
                                  item.uid === selectedPart.uid || (pairId && item.symmetryPairId === pairId)
                                    ? { ...item, actionGroup: isSelectedAssigned ? undefined : agNum }
                                    : item
                                )
                              );
                            }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                              isSelectedAssigned
                                ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50 hover:bg-rose-900/60'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                          >
                            {isSelectedAssigned ? 'Unassign' : 'Assign'}
                          </button>
                        )}
                      </div>

                      {assignedParts.length > 0 && (
                        <div className="space-y-1">
                          {assignedParts.map((p) => (
                            <div key={p.uid} className="flex items-center justify-between text-[10px] p-1 bg-slate-900/60 rounded text-slate-400">
                              <span className="truncate">{PART_CATALOG[p.partId]?.name}</span>
                              <button
                                onClick={() => {
                                  const pairId = p.symmetryPairId;
                                  setParts((prev) =>
                                    prev.map((item) =>
                                      item.uid === p.uid || (pairId && item.symmetryPairId === pairId)
                                        ? { ...item, actionGroup: undefined }
                                        : item
                                    )
                                  );
                                }}
                                className="text-rose-400 px-1"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>
        )}
        </div>
      </div>

      {/* Presets Modal */}
      {showPresets && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>Rocket Blueprints & Presets</span>
              </h3>
              <button
                onClick={() => setShowPresets(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold transition"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              {PRESET_ROCKETS.map((preset) => (
                <div
                  key={preset.name}
                  onClick={() => loadPreset(preset)}
                  className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:border-sky-500 hover:bg-slate-800/40 transition cursor-pointer flex items-center justify-between group"
                >
                  <div>
                    <h4 className="text-sm font-black text-white group-hover:text-sky-400 transition">{preset.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">{preset.description}</p>
                    <span className="inline-block mt-2 text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">
                      {preset.parts.length} Parts Included
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-sky-400 transition shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls Reference Modal */}
      {showControlsHelp && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Info className="w-5 h-5 text-sky-400" />
                <span>Spaceflight & VAB Controls</span>
              </h3>
              <button
                onClick={() => setShowControlsHelp(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-300">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-sky-400 mb-1">A / D or ↺ / ↻</div>
                  <div>Steer / Pitch Rocket</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-sky-400 mb-1">Spacebar</div>
                  <div>Fire Next Rocket Stage</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-sky-400 mb-1">Shift / Ctrl</div>
                  <div>Throttle Up / Throttle Down</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-sky-400 mb-1">Z / X</div>
                  <div>Max (100%) / Cut (0%) Throttle</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-sky-400 mb-1">M</div>
                  <div>Toggle Orbital Map View</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-sky-400 mb-1">T / F (in VAB)</div>
                  <div>Turn / Flip Part 180°</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-sky-400 mb-1">R / Shift+R (VAB)</div>
                  <div>Rotate Part +90° / -90°</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <div className="font-bold text-sky-400 mb-1">R / G / P (Flight)</div>
                  <div>RCS / Landing Legs / Parachute</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Physics & Performance Analyzer Modal */}
      <PerformanceAnalyzer
        isOpen={showPerformanceAnalyzer}
        metrics={metrics}
        parts={parts}
        onClose={() => setShowPerformanceAnalyzer(false)}
      />

      {/* Astronet HQ: Industrial Resource Chain & Commodity Exchange */}
      <AstronetHQModal
        isOpen={showAstronetHQ}
        onClose={() => setShowAstronetHQ(false)}
        economyState={economyState}
        economy={economyState}
        onUpdateEconomy={(next) => {
          setEconomyState(next);
          saveEconomyState(next);
        }}
      />
    </div>
  );
};
