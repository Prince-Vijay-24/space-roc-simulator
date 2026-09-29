import { PartDefinition, JunoEngineConfig, FuelType, NozzleType, EnginePowerCycle } from '../types';
import {
  renderAnimatedSolarPanel,
  renderAnimatedLandingLeg,
  renderAnimatedRoverWheel,
  renderFixedOgiveNoseCone,
  renderAnimatedParachute,
  renderAnimatedRCS,
} from './animatedPartRenderer';

// Safe canvas roundRect polyfill to prevent runtime render exceptions in environments without native roundRect
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    this: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radii?: number | number[]
  ) {
    let r = 0;
    if (typeof radii === 'number') r = radii;
    else if (Array.isArray(radii) && radii.length > 0) r = radii[0];
    r = Math.min(Math.max(0, r), Math.abs(w) / 2, Math.abs(h) / 2);
    this.rect(x, y, w, h);
    return this;
  };
}

export interface RenderPartOptions {
  widthPx: number;
  heightPx: number;
  rotation?: number; // degrees: 0, 90, 180, 270
  isSelected?: boolean;
  isHovered?: boolean;
  isFlight?: boolean;
  deployed?: boolean;
  deployProgress?: number; // 0.0 (stowed) to 1.0 (fully unfolded) for smooth 60fps animations
  parachuteStage?: 'STOWED' | 'PILOT' | 'DROGUE' | 'MAIN';
  wheelSteerAngle?: number; // Steering angle in radians for rover wheels
  wheelRotation?: number; // Rolling rotation in radians for rover wheels
  throttle?: number; // 0 to 1
  engineActive?: boolean;
  showSnapPoints?: boolean;
  fuelPercent?: number; // 0 to 1
  gimbalAngle?: number; // radians
  shroudHeightPx?: number; // Height of interstage fairing covering upper engine
  topWidthPx?: number; // Auto-adjusted top width for conical adapters
  bottomWidthPx?: number; // Auto-adjusted bottom width for conical adapters
  adapterShape?: 'cone_cylinder' | 'straight';
  engineConfig?: JunoEngineConfig;
  customNozzleType?: NozzleType | string;
  propellantType?: FuelType;
  tankSkin?: 'white' | 'orange' | 'steel' | 'dark';
  engineMountCount?: 1 | 2 | 3;
  solarPanelType?: 'classic' | 'circular' | 'hexagonal';
  solarGridN?: number;
  solarGridM?: number;
  solarScale?: number;
  solarBoomLengthM?: number;
  solarCellWidthM?: number;
  solarCellHeightM?: number;
  solarPanelStyle?: string;
  solarSectors?: number;
  solarHexRings?: number;
  solarEfficiency?: number;
  landingLegType?: 'standard' | 'heavy_carbon' | 'wide_spreader' | 'micro_hopper' | 'spider_articulated' | string;
  legSuspensionStiffness?: number;
  legSuspensionDamping?: number;
  legDeployAngleDeg?: number;
  legFootpadType?: 'Standard' | 'Heavy' | 'Wide Terrain' | 'Spike Claw' | string;
  legScale?: number;
  suspensionCompression?: number;
  rcsThrusterType?: 'rcs_quad' | 'rcs_linear_dual' | 'rcs_heavy_penta' | 'rcs_fixed_single' | 'rcs_3way_cluster' | 'rcs_gimbal_vernier' | string;
  rcsNozzleCount?: 1 | 2 | 3 | 4 | 5;
  rcsThrustKn?: number;
  rcsPropellantType?: 'cold_gas' | 'monoprop' | 'hypergolic';
  rcsCantAngleDeg?: number;
  rcsScale?: number;
  rcsFiring?: boolean;
  rcsFireDirection?: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'ALL';
  rcsGimbalAngleRad?: number;
  parachuteState?: 'STOWED' | 'PILOT' | 'DROGUE' | 'MAIN';
  parachuteType?: string;
  parachuteChuteType?: string;
}

/**
 * Ultra-high-fidelity 2D aerospace vector renderer for rocket parts.
 * Inspired by Spaceflight Simulator (SFS), SimpleRockets 2, and Space Agency.
 * Renders authentic cylindrical specular lighting, weld seams, pressurization raceways,
 * DeLaval bell nozzles with regenerative cooling tubes, hydraulic gimbal pistons,
 * cockpit astronaut windows, gold-foil Kapton thermal blankets, and PICA-X heat tiles.
 */
export function drawPart2D(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  options: RenderPartOptions
) {
  const {
    widthPx: pw,
    heightPx: ph,
    rotation = 0,
    isSelected = false,
    isHovered = false,
    isFlight = false,
    deployed = false,
    throttle = 0,
    engineActive = false,
    showSnapPoints = false,
    fuelPercent = 1.0,
    gimbalAngle = 0,
    shroudHeightPx = 0,
    topWidthPx,
    bottomWidthPx,
    adapterShape,
    engineConfig,
    customNozzleType,
    propellantType,
    tankSkin,
    engineMountCount = 1,
  } = options;

  ctx.save();
  try {
    ctx.rotate((rotation * Math.PI) / 180);

  const hw = pw / 2;
  const hh = ph / 2;

  // =========================================================================
  // 1. COMMAND MODULES (CAPSULES & SATELLITE PROBE CORES)
  // =========================================================================
  if (def.category === 'Command') {
    if (def.id === 'probe_core') {
      // Avionics Satellite Probe Core
      // Octagonal gold-foil satellite bus with star tracker lens and solar cells
      const busGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      busGrad.addColorStop(0, '#78350f');
      busGrad.addColorStop(0.2, '#d97706');
      busGrad.addColorStop(0.5, '#fbbf24');
      busGrad.addColorStop(0.8, '#d97706');
      busGrad.addColorStop(1, '#78350f');

      ctx.fillStyle = busGrad;
      ctx.strokeStyle = '#291102';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      const cut = Math.min(hw * 0.32, hh * 0.32);
      ctx.moveTo(-hw + cut, -hh);
      ctx.lineTo(hw - cut, -hh);
      ctx.lineTo(hw, -hh + cut);
      ctx.lineTo(hw, hh - cut);
      ctx.lineTo(hw - cut, hh);
      ctx.lineTo(-hw + cut, hh);
      ctx.lineTo(-hw, hh - cut);
      ctx.lineTo(-hw, -hh + cut);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Gold-foil diamond quilting texture (Kapton thermal blanket)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-hw + cut, -hh);
      ctx.lineTo(hw - cut, -hh);
      ctx.lineTo(hw, -hh + cut);
      ctx.lineTo(hw, hh - cut);
      ctx.lineTo(hw - cut, hh);
      ctx.lineTo(-hw + cut, hh);
      ctx.lineTo(-hw, hh - cut);
      ctx.lineTo(-hw, -hh + cut);
      ctx.closePath();
      ctx.clip();

      ctx.strokeStyle = 'rgba(254, 240, 138, 0.45)';
      ctx.lineWidth = 0.8;
      const qStep = Math.max(7, pw * 0.18);
      for (let x = -hw - hh; x < hw + hh; x += qStep) {
        ctx.beginPath();
        ctx.moveTo(x, -hh);
        ctx.lineTo(x + hh * 2, hh);
        ctx.moveTo(x, hh);
        ctx.lineTo(x + hh * 2, -hh);
        ctx.stroke();
      }
      ctx.restore();

      // Central Optical Navigation Star-Tracker / Sensor Lens
      const lensR = Math.min(hw, hh) * 0.38;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, lensR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Sapphire glass optical aperture with coating reflection
      const glassGrad = ctx.createLinearGradient(-lensR, -lensR, lensR, lensR);
      glassGrad.addColorStop(0, '#0284c7');
      glassGrad.addColorStop(0.5, '#38bdf8');
      glassGrad.addColorStop(1, '#0c4a6e');
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.arc(0, 0, lensR * 0.72, 0, Math.PI * 2);
      ctx.fill();

      // Lens optical specular flare
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(-lensR * 0.25, -lensR * 0.25, lensR * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Status Telemetry LED (Pulsing green)
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(hw * 0.65, -hh * 0.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    } else {
      // Aerodynamic Manned Command Capsule (Apollo / Crew Dragon archetype)
      const topW = hw * 0.44;
      const botW = hw * 0.96;

      // 1. Base Ablative Heatshield rim at bottom (canvas +Y is down / base)
      const hsH = Math.min(ph * 0.16, 7);
      const hsGrad = ctx.createLinearGradient(-botW, 0, botW, 0);
      hsGrad.addColorStop(0, '#261c14');
      hsGrad.addColorStop(0.5, '#451a03');
      hsGrad.addColorStop(1, '#1c1917');
      ctx.fillStyle = hsGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(-botW, hh - hsH);
      ctx.lineTo(botW, hh - hsH);
      ctx.quadraticCurveTo(0, hh + 2, -botW, hh - hsH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Conical Capsule Hull with 3D Specular Cylindrical Shading
      const hullGrad = ctx.createLinearGradient(-botW, 0, botW, 0);
      hullGrad.addColorStop(0, '#cbd5e1');
      hullGrad.addColorStop(0.25, '#f8fafc');
      hullGrad.addColorStop(0.55, '#ffffff');
      hullGrad.addColorStop(0.8, '#e2e8f0');
      hullGrad.addColorStop(1, '#94a3b8');

      ctx.fillStyle = hullGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.moveTo(-topW, -hh + 5);
      ctx.lineTo(topW, -hh + 5);
      ctx.lineTo(botW, hh - hsH);
      ctx.lineTo(-botW, hh - hsH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 3. Nose Docking Collar / Parachute Cap at Top
      const noseGrad = ctx.createLinearGradient(-topW, 0, topW, 0);
      noseGrad.addColorStop(0, '#475569');
      noseGrad.addColorStop(0.5, '#94a3b8');
      noseGrad.addColorStop(1, '#334155');
      ctx.fillStyle = noseGrad;
      ctx.fillRect(-topW, -hh, topW * 2, 6);
      ctx.strokeRect(-topW, -hh, topW * 2, 6);

      // 4. Anti-glare Matte Black Forward Paint Patch
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-topW * 0.7, -hh + 6);
      ctx.lineTo(topW * 0.7, -hh + 6);
      ctx.lineTo(topW * 0.9, -hh * 0.2);
      ctx.lineTo(-topW * 0.9, -hh * 0.2);
      ctx.closePath();
      ctx.fill();

      // 5. Astronaut Cockpit Windows (Dual faceted observation ports)
      const winW = topW * 0.55;
      const winH = Math.min(ph * 0.22, 11);
      const winY = -hh * 0.25;

      // Left Pilot Window
      const winGradL = ctx.createLinearGradient(-topW * 0.8, winY, -topW * 0.1, winY + winH);
      winGradL.addColorStop(0, '#0369a1');
      winGradL.addColorStop(0.4, '#38bdf8');
      winGradL.addColorStop(1, '#0284c7');

      ctx.fillStyle = winGradL;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.2;

      ctx.beginPath();
      ctx.moveTo(-topW * 0.8, winY + winH);
      ctx.lineTo(-topW * 0.65, winY);
      ctx.lineTo(-topW * 0.15, winY);
      ctx.lineTo(-topW * 0.2, winY + winH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right Co-Pilot Window
      const winGradR = ctx.createLinearGradient(topW * 0.1, winY, topW * 0.8, winY + winH);
      winGradR.addColorStop(0, '#0284c7');
      winGradR.addColorStop(0.4, '#38bdf8');
      winGradR.addColorStop(1, '#0369a1');

      ctx.fillStyle = winGradR;
      ctx.beginPath();
      ctx.moveTo(topW * 0.2, winY + winH);
      ctx.lineTo(topW * 0.15, winY);
      ctx.lineTo(topW * 0.65, winY);
      ctx.lineTo(topW * 0.8, winY + winH);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glass specular reflection glint
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.moveTo(-topW * 0.6, winY + 2);
      ctx.lineTo(-topW * 0.25, winY + 2);
      ctx.lineTo(-topW * 0.35, winY + 5);
      ctx.lineTo(-topW * 0.65, winY + 5);
      ctx.closePath();
      ctx.fill();

      // 6. Integrated RCS Thruster Quads on Shoulders
      ctx.fillStyle = '#475569';
      // Left RCS block
      ctx.fillRect(-botW + 1, hh * 0.2, 4, 6);
      ctx.strokeRect(-botW + 1, hh * 0.2, 4, 6);
      // Right RCS block
      ctx.fillRect(botW - 5, hh * 0.2, 4, 6);
      ctx.strokeRect(botW - 5, hh * 0.2, 4, 6);

      // 7. Crew Ingress Hatch Outline
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.65)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-topW * 0.45, hh * 0.15, topW * 0.9, ph * 0.32);
      // Hatch latch
      ctx.fillStyle = '#64748b';
      ctx.fillRect(topW * 0.25, hh * 0.28, 3, 3);
    }
  }

  // =========================================================================
  // 2. PROPULSION & ENGINES & SOLID ROCKET BOOSTERS
  // =========================================================================
  else if (def.category === 'Propulsion') {
    const isSRB = def.isSRB || def.id.includes('srb');

    if (isSRB) {
      // 5-Segment Solid Rocket Booster (SLS / Space Shuttle archetype)
      const noseH = ph * 0.18;
      const nozzleH = ph * 0.24;
      const bodyH = ph - noseH - nozzleH;

      // 1. Aerodynamic Conical Nose Cap
      const srbNoseGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      srbNoseGrad.addColorStop(0, '#94a3b8');
      srbNoseGrad.addColorStop(0.3, '#ffffff');
      srbNoseGrad.addColorStop(0.8, '#cbd5e1');
      srbNoseGrad.addColorStop(1, '#64748b');

      ctx.fillStyle = srbNoseGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.moveTo(0, -hh);
      ctx.quadraticCurveTo(hw * 0.8, -hh + noseH * 0.6, hw, -hh + noseH);
      ctx.lineTo(-hw, -hh + noseH);
      ctx.quadraticCurveTo(-hw * 0.8, -hh + noseH * 0.6, 0, -hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Retro-separation motors on SRB nose
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-hw * 0.5, -hh + noseH * 0.4, 4, 3);
      ctx.fillRect(hw * 0.5 - 4, -hh + noseH * 0.4, 4, 3);

      // 2. Main Cylindrical Booster Casing with Segments & Field Joints
      const bodyGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      bodyGrad.addColorStop(0, '#cbd5e1');
      bodyGrad.addColorStop(0.25, '#f8fafc');
      bodyGrad.addColorStop(0.55, '#ffffff');
      bodyGrad.addColorStop(0.8, '#e2e8f0');
      bodyGrad.addColorStop(1, '#94a3b8');

      ctx.fillStyle = bodyGrad;
      ctx.fillRect(-hw, -hh + noseH, pw, bodyH);
      ctx.strokeRect(-hw, -hh + noseH, pw, bodyH);

      // 5-Segment Structural Field Joint Pin Bands
      const numSegments = 5;
      for (let s = 1; s < numSegments; s++) {
        const sy = -hh + noseH + (bodyH / numSegments) * s;
        // Joint ring band
        ctx.fillStyle = '#475569';
        ctx.fillRect(-hw, sy - 1.5, pw, 3);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(-hw, sy - 1.5, pw, 3);
      }

      // High-Visibility Red / Orange Caution Band
      ctx.fillStyle = def.accentColor || '#ea580c';
      ctx.fillRect(-hw, -hh + noseH + 4, pw, Math.min(8, bodyH * 0.08));

      // Systems Tunnel Raceway running along SRB flank
      ctx.fillStyle = '#64748b';
      ctx.fillRect(hw * 0.45, -hh + noseH, 3, bodyH);
      ctx.strokeRect(hw * 0.45, -hh + noseH, 3, bodyH);

      // 3. Submerged Gimbal SRB Nozzle
      const nozTop = -hh + noseH + bodyH;
      const nozGrad = ctx.createLinearGradient(-hw * 0.7, 0, hw * 0.7, 0);
      nozGrad.addColorStop(0, '#0f172a');
      nozGrad.addColorStop(0.3, '#334155');
      nozGrad.addColorStop(0.7, '#475569');
      nozGrad.addColorStop(1, '#020617');

      ctx.fillStyle = nozGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;

      ctx.beginPath();
      ctx.moveTo(-hw * 0.48, nozTop);
      ctx.lineTo(hw * 0.48, nozTop);
      ctx.lineTo(hw * 0.75, hh);
      ctx.lineTo(-hw * 0.75, hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Nozzle stiffener rings
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.6, nozTop + nozzleH * 0.5);
      ctx.lineTo(hw * 0.6, nozTop + nozzleH * 0.5);
      ctx.stroke();
    } else {
      // =========================================================================
      // JUNO: NEW ORIGINS PROCEDURAL ROCKET ENGINE 2D RENDERER
      // Configurable power cycles, fuel types, chamber pressure, and nozzle styles
      // =========================================================================
      const cfg: JunoEngineConfig = engineConfig ? { ...engineConfig } : {
        engineSizePercent: 50,
        engineType: def.isSRB ? 'Solid' : def.id.includes('nuclear') ? 'Nuclear Thermal' : 'Liquid',
        powerCycle: def.isSRB ? 'Booster' : def.fuelType === 'methalox' ? 'Full Flow Staged' : 'Gas Generator II',
        liquidFuel: def.fuelType === 'methalox' ? 'Methalox' : def.fuelType === 'hydrolox' ? 'Hydrolox' : 'Kerolox',
        solidGrain: 'Steady',
        nuclearFuel: 'Liquid Hydrogen',
        chamberPressureKPa: 10000,
        gimbalRangeDeg: def.gimbalRange || 5.0,
        nozzleStyle: customNozzleType === 'aerospike' ? 'Aerospike' : customNozzleType === 'cone' ? 'Cone' : customNozzleType === 'bravo' ? 'Bravo' : customNozzleType === 'delta' || customNozzleType === 'vac' ? 'Delta' : customNozzleType === 'omega' ? 'Omega' : customNozzleType === 'dual bell' ? 'Dual Bell' : 'Bell',
        throatSizePercent: 100,
        nozzleLengthPercent: 100,
      };

      // Ensure customNozzleType and propellantType always synchronize into the procedural engine cfg
      if (customNozzleType) {
        const norm = String(customNozzleType).toLowerCase();
        if (norm === 'cone') cfg.nozzleStyle = 'Cone';
        else if (norm === 'aerospike') cfg.nozzleStyle = 'Aerospike';
        else if (norm === 'bravo') cfg.nozzleStyle = 'Bravo';
        else if (norm === 'delta' || norm === 'vac') cfg.nozzleStyle = 'Delta';
        else if (norm === 'omega') cfg.nozzleStyle = 'Omega';
        else if (norm === 'dual bell') cfg.nozzleStyle = 'Dual Bell';
        else if (norm === 'bell') cfg.nozzleStyle = 'Bell';
      }

      if (propellantType) {
        if (propellantType === 'methalox') { cfg.liquidFuel = 'Methalox'; cfg.engineType = 'Liquid'; }
        else if (propellantType === 'hydrolox') { cfg.liquidFuel = 'Hydrolox'; cfg.engineType = 'Liquid'; }
        else if (propellantType === 'kerolox') { cfg.liquidFuel = 'Kerolox'; cfg.engineType = 'Liquid'; }
        else if (propellantType === 'solid') cfg.engineType = 'Solid';
        else if (propellantType === 'nuclear') cfg.engineType = 'Nuclear Thermal';
        else if (propellantType === 'monoprop') cfg.engineType = 'Monopropellant';
      }

      const throatFactor = Math.max(0.45, Math.min(1.55, (cfg.throatSizePercent || 100) / 100));
      const lengthFactor = Math.max(0.2, Math.min(2.0, (cfg.nozzleLengthPercent || 100) / 100));
      const isSolid = cfg.engineType === 'Solid';
      const isNuclear = cfg.engineType === 'Nuclear Thermal';
      const isMonoprop = cfg.engineType === 'Monopropellant';
      const isAerospike = cfg.nozzleStyle === 'Aerospike';

      // 1. Structural Gimbal Mount & Titanium Thrust Dome
      const mountH = ph * 0.22;
      const mountW = hw * 0.82;
      const throatY = -hh + mountH + ph * 0.10;
      const throatW = Math.max(4, hw * 0.28 * throatFactor);
      const nozzleH = Math.max(ph * 0.35, ph * 0.62 * lengthFactor);
      const exitY = Math.min(hh + 12, throatY + nozzleH);

      // Exit diameter based on nozzle style & length
      let exitW = hw * 0.85 * Math.sqrt(lengthFactor);
      if (cfg.nozzleStyle === 'Cone') exitW = hw * 0.72 * Math.sqrt(lengthFactor);
      else if (cfg.nozzleStyle === 'Bravo') exitW = hw * 0.95 * Math.sqrt(lengthFactor);
      else if (cfg.nozzleStyle === 'Delta') exitW = hw * 1.28 * Math.sqrt(lengthFactor);
      else if (cfg.nozzleStyle === 'Omega') exitW = hw * 1.12 * Math.sqrt(lengthFactor);
      else if (cfg.nozzleStyle === 'Dual Bell') exitW = hw * 1.20 * Math.sqrt(lengthFactor);
      else if (isAerospike) exitW = hw * 0.88;

      // Top mounting ring
      const mountGrad = ctx.createLinearGradient(-mountW, 0, mountW, 0);
      mountGrad.addColorStop(0, '#1e293b');
      mountGrad.addColorStop(0.35, '#475569');
      mountGrad.addColorStop(0.7, '#64748b');
      mountGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = mountGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.fillRect(-mountW, -hh, mountW * 2, mountH);
      ctx.strokeRect(-mountW, -hh, mountW * 2, mountH);

      // Hydraulic Gimbal Actuators (Dual chrome pistons angled to mount)
      if (!isSolid) {
        const pistonGrad = ctx.createLinearGradient(-mountW, 0, mountW, 0);
        pistonGrad.addColorStop(0, '#64748b');
        pistonGrad.addColorStop(0.5, '#ffffff');
        pistonGrad.addColorStop(1, '#475569');

        ctx.fillStyle = pistonGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.0;

        // Left actuator piston
        ctx.beginPath();
        ctx.moveTo(-mountW * 0.85, -hh + 3);
        ctx.lineTo(-mountW * 0.35, -hh + mountH);
        ctx.lineTo(-mountW * 0.35 - 3, -hh + mountH);
        ctx.lineTo(-mountW * 0.85 - 3, -hh + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right actuator piston
        ctx.beginPath();
        ctx.moveTo(mountW * 0.85, -hh + 3);
        ctx.lineTo(mountW * 0.35, -hh + mountH);
        ctx.lineTo(mountW * 0.35 + 3, -hh + mountH);
        ctx.lineTo(mountW * 0.85 + 3, -hh + 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gimbal pivot center sphere
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, -hh + mountH * 0.5, Math.min(pw * 0.12, ph * 0.08), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.stroke();
      }

      // Gimbal deflection transform
      ctx.save();
      if (gimbalAngle !== 0 && !isSolid) {
        ctx.translate(0, -hh + mountH);
        ctx.rotate(gimbalAngle);
        ctx.translate(0, -(-hh + mountH));
      }

      // 2. Combustion Chamber Dome & Power Cycle Architecture
      const chamberW = Math.max(throatW * 1.4, hw * 0.50);

      if (isSolid) {
        // --- SOLID ROCKET MOTOR CASING ---
        const srbGrad = ctx.createLinearGradient(-chamberW, 0, chamberW, 0);
        srbGrad.addColorStop(0, '#1c1917');
        srbGrad.addColorStop(0.25, '#44403c');
        srbGrad.addColorStop(0.5, '#78716c');
        srbGrad.addColorStop(0.8, '#44403c');
        srbGrad.addColorStop(1, '#0c0a09');

        ctx.fillStyle = srbGrad;
        ctx.strokeStyle = '#0c0a09';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-chamberW, -hh + mountH);
        ctx.lineTo(chamberW, -hh + mountH);
        ctx.lineTo(throatW * 1.1, throatY);
        ctx.lineTo(-throatW * 1.1, throatY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Segment joint rings
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-chamberW * 0.95, -hh + mountH + 4);
        ctx.lineTo(chamberW * 0.95, -hh + mountH + 4);
        ctx.stroke();
      } else if (isNuclear) {
        // --- NUCLEAR THERMAL REACTOR PRESSURE VESSEL ---
        const nucGrad = ctx.createLinearGradient(-chamberW, 0, chamberW, 0);
        nucGrad.addColorStop(0, '#064e3b');
        nucGrad.addColorStop(0.3, '#047857');
        nucGrad.addColorStop(0.7, '#10b981');
        nucGrad.addColorStop(1, '#022c22');

        ctx.fillStyle = nucGrad;
        ctx.strokeStyle = '#022c22';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-chamberW, -hh + mountH);
        ctx.lineTo(chamberW, -hh + mountH);
        ctx.lineTo(throatW * 1.15, throatY);
        ctx.lineTo(-throatW * 1.15, throatY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Heavy tungsten/boron radiation shadow shield collar
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-chamberW * 1.05, -hh + mountH, chamberW * 2.1, 5);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.strokeRect(-chamberW * 1.05, -hh + mountH, chamberW * 2.1, 5);

        // Control drum actuators on sides
        ctx.fillStyle = '#64748b';
        ctx.fillRect(-chamberW * 1.15, -hh + mountH + 6, 4, 8);
        ctx.fillRect(chamberW * 1.15 - 4, -hh + mountH + 6, 4, 8);
      } else {
        // --- COMBUSTION CHAMBER COLORING BY FUEL TYPE & CYCLE ---
        const isHydroloxFuel = cfg.liquidFuel === 'Hydrolox';
        const isMethaloxFuel = cfg.liquidFuel === 'Methalox';
        const isMonopropFuel = cfg.engineType === 'Monopropellant';

        const throatGrad = ctx.createLinearGradient(-chamberW, 0, chamberW, 0);
        if (isHydroloxFuel) {
          // Cryogenic Frost Silver & Cyan
          throatGrad.addColorStop(0, '#0f172a');
          throatGrad.addColorStop(0.2, '#0284c7');
          throatGrad.addColorStop(0.5, '#e0f2fe');
          throatGrad.addColorStop(0.8, '#38bdf8');
          throatGrad.addColorStop(1, '#0c4a6e');
        } else if (isMethaloxFuel) {
          // Inconel / Titanium Metallic Violet
          throatGrad.addColorStop(0, '#3b0764');
          throatGrad.addColorStop(0.25, '#7e22ce');
          throatGrad.addColorStop(0.5, '#e9d5ff');
          throatGrad.addColorStop(0.75, '#9333ea');
          throatGrad.addColorStop(1, '#2e1065');
        } else if (isMonopropFuel) {
          // Gold Kapton / Titanium Sphere
          throatGrad.addColorStop(0, '#78350f');
          throatGrad.addColorStop(0.3, '#d97706');
          throatGrad.addColorStop(0.5, '#fef08a');
          throatGrad.addColorStop(0.8, '#f59e0b');
          throatGrad.addColorStop(1, '#451a03');
        } else {
          // Kerolox / Standard Bronze-Copper Regenerative Milling
          throatGrad.addColorStop(0, '#7c2d12');
          throatGrad.addColorStop(0.3, '#d97706');
          throatGrad.addColorStop(0.5, '#fed7aa');
          throatGrad.addColorStop(0.8, '#ea580c');
          throatGrad.addColorStop(1, '#451a03');
        }

        ctx.fillStyle = throatGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-chamberW, -hh + mountH);
        ctx.lineTo(chamberW, -hh + mountH);
        ctx.lineTo(throatW, throatY);
        ctx.lineTo(-throatW, throatY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Injector manifold ring
        ctx.fillStyle = isHydroloxFuel ? '#0284c7' : isMethaloxFuel ? '#6b21a8' : isMonopropFuel ? '#b45309' : '#475569';
        ctx.fillRect(-chamberW * 0.95, -hh + mountH, chamberW * 1.9, 4);

        // --- POWER CYCLE 2D PLUMBING (Juno: New Origins authentic design) ---
        if (cfg.powerCycle === 'Pressure-Fed') {
          // Clean chamber, dual high-pressure braided inlet tubes
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(-chamberW * 0.6, -hh + mountH * 0.5);
          ctx.lineTo(-chamberW * 0.4, -hh + mountH + 4);
          ctx.moveTo(chamberW * 0.6, -hh + mountH * 0.5);
          ctx.lineTo(chamberW * 0.4, -hh + mountH + 4);
          ctx.stroke();
        } else if (cfg.powerCycle === 'Electric') {
          // Electric Motor Inverter Pack mounted on right with orange HV conduit cables
          const motorW = hw * 0.32;
          const motorH = ph * 0.14;
          const motorX = chamberW * 0.75;
          const motorY = -hh + mountH + 2;

          const motorGrad = ctx.createLinearGradient(motorX, 0, motorX + motorW, 0);
          motorGrad.addColorStop(0, '#0284c7');
          motorGrad.addColorStop(0.6, '#38bdf8');
          motorGrad.addColorStop(1, '#0369a1');

          ctx.fillStyle = motorGrad;
          ctx.strokeStyle = '#0c4a6e';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(motorX, motorY, motorW, motorH, 2);
          ctx.fill();
          ctx.stroke();

          // High-voltage cables
          ctx.strokeStyle = '#f97316';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -hh + mountH * 0.4);
          ctx.quadraticCurveTo(motorX * 0.5, motorY - 2, motorX + motorW * 0.4, motorY);
          ctx.stroke();
        } else if (cfg.powerCycle === 'Gas Generator I') {
          // Single turbopump with single side exhaust dump pipe
          const pumpX = chamberW * 0.78;
          const pumpY = -hh + mountH + 4;
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(pumpX, pumpY, Math.min(pw * 0.08, 7), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#1e293b';
          ctx.stroke();

          // Gas generator exhaust dump pipe running down along nozzle
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(pumpX, pumpY);
          ctx.quadraticCurveTo(exitW * 0.85, (throatY + exitY) * 0.5, exitW * 0.92, exitY);
          ctx.stroke();
        } else if (cfg.powerCycle === 'Gas Generator II') {
          // Dual turbopump assembly (LOX pump on top, Fuel pump below) with interstage turbine shaft
          const pumpX = chamberW * 0.78;
          const pump1Y = -hh + mountH + 3;
          const pump2Y = -hh + mountH + 11;

          // Upper pump
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(pumpX, pump1Y, Math.min(pw * 0.07, 6), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.stroke();

          // Lower pump
          ctx.fillStyle = '#ea580c';
          ctx.beginPath();
          ctx.arc(pumpX, pump2Y, Math.min(pw * 0.07, 6), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.stroke();

          // Interstage drive shaft
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(pumpX, pump1Y);
          ctx.lineTo(pumpX, pump2Y);
          ctx.stroke();

          // Angled turbopump exhaust duct
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(pumpX, pump2Y);
          ctx.quadraticCurveTo(exitW * 0.88, (throatY + exitY) * 0.45, exitW * 0.94, exitY);
          ctx.stroke();
        } else if (cfg.powerCycle === 'Staged') {
          // High-pressure preburner dome with looping hot gas duct
          const preburnerX = -chamberW * 0.75;
          const preburnerY = -hh + mountH + 5;
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(preburnerX, preburnerY, Math.min(pw * 0.08, 7), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.stroke();

          // Heavy braided hot gas loop
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(preburnerX, preburnerY);
          ctx.quadraticCurveTo(0, -hh + mountH - 2, chamberW * 0.5, -hh + mountH + 3);
          ctx.stroke();
        } else if (cfg.powerCycle === 'Full Flow Staged') {
          // Dual preburners on opposite sides! (Oxidizer-rich left, Fuel-rich right)
          const leftX = -chamberW * 0.82;
          const rightX = chamberW * 0.82;
          const preY = -hh + mountH + 5;

          // Oxidizer preburner (cyan/blue)
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(leftX, preY, Math.min(pw * 0.075, 7), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.stroke();

          // Fuel preburner (amber/red)
          ctx.fillStyle = '#dc2626';
          ctx.beginPath();
          ctx.arc(rightX, preY, Math.min(pw * 0.075, 7), 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.stroke();

          // Dual high-pressure loops into center injector
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(leftX, preY);
          ctx.lineTo(-chamberW * 0.2, -hh + mountH + 3);
          ctx.moveTo(rightX, preY);
          ctx.lineTo(chamberW * 0.2, -hh + mountH + 3);
          ctx.stroke();
        }
      }

      // 3. NOZZLE GEOMETRY (Bell, Cone, Bravo, Delta, Omega, Aerospike)
      if (isAerospike) {
        // --- AEROSPIKE ALTITUDE-COMPENSATING ANNULAR PLUG ---
        const spikeGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
        spikeGrad.addColorStop(0, '#334155');
        spikeGrad.addColorStop(0.2, '#64748b');
        spikeGrad.addColorStop(0.5, '#e2e8f0');
        spikeGrad.addColorStop(0.8, '#475569');
        spikeGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = spikeGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.6;

        ctx.beginPath();
        ctx.moveTo(-exitW, throatY);
        ctx.lineTo(exitW, throatY);
        ctx.quadraticCurveTo(exitW * 0.35, (throatY + exitY) * 0.5, 0, exitY);
        ctx.quadraticCurveTo(-exitW * 0.35, (throatY + exitY) * 0.5, -exitW, throatY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Annular combustion rim
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-exitW - 2, throatY - 2, 4, 6);
        ctx.fillRect(exitW - 2, throatY - 2, 4, 6);
      } else {
        // --- EXPANDING NOZZLE (BELL / CONE / BRAVO / DELTA / OMEGA) ---
        const bellGrad = ctx.createLinearGradient(-exitW, 0, exitW, 0);
        bellGrad.addColorStop(0, '#0f172a');
        bellGrad.addColorStop(0.18, '#1e1b4b');
        bellGrad.addColorStop(0.35, '#312e81');
        bellGrad.addColorStop(0.5, '#64748b');
        bellGrad.addColorStop(0.7, '#1e293b');
        bellGrad.addColorStop(1, '#020617');

        ctx.fillStyle = bellGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        if (cfg.nozzleStyle === 'Cone') {
          // Conical straight-sided supersonic nozzle
          ctx.moveTo(-throatW, throatY);
          ctx.lineTo(throatW, throatY);
          ctx.lineTo(exitW, exitY);
          ctx.lineTo(-exitW, exitY);
        } else if (cfg.nozzleStyle === 'Dual Bell') {
          // Stepped two-stage altitude compensating bell
          const infY = throatY + (exitY - throatY) * 0.48;
          const infW = throatW + (exitW - throatW) * 0.42;
          ctx.moveTo(-throatW, throatY);
          ctx.lineTo(throatW, throatY);
          ctx.quadraticCurveTo(infW * 0.72, (throatY + infY) * 0.5, infW, infY);
          ctx.lineTo(infW + 3, infY);
          ctx.quadraticCurveTo(exitW * 0.82, (infY + exitY) * 0.5, exitW, exitY);
          ctx.lineTo(-exitW, exitY);
          ctx.quadraticCurveTo(-exitW * 0.82, (infY + exitY) * 0.5, -infW - 3, infY);
          ctx.lineTo(-infW, infY);
          ctx.quadraticCurveTo(-infW * 0.72, (throatY + infY) * 0.5, -throatW, throatY);
        } else {
          // Curved parabolic contour (Bell, Bravo, Delta, Omega)
          ctx.moveTo(-throatW, throatY);
          ctx.lineTo(throatW, throatY);
          ctx.quadraticCurveTo(exitW * 0.65, (throatY + exitY) * 0.5, exitW, exitY);
          ctx.lineTo(-exitW, exitY);
          ctx.quadraticCurveTo(-exitW * 0.65, (throatY + exitY) * 0.5, -throatW, throatY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Vertical regenerative cooling tubes
        ctx.save();
        ctx.beginPath();
        if (cfg.nozzleStyle === 'Cone') {
          ctx.moveTo(-throatW, throatY);
          ctx.lineTo(throatW, throatY);
          ctx.lineTo(exitW, exitY);
          ctx.lineTo(-exitW, exitY);
        } else if (cfg.nozzleStyle === 'Dual Bell') {
          const infY = throatY + (exitY - throatY) * 0.48;
          const infW = throatW + (exitW - throatW) * 0.42;
          ctx.moveTo(-throatW, throatY);
          ctx.lineTo(throatW, throatY);
          ctx.quadraticCurveTo(infW * 0.72, (throatY + infY) * 0.5, infW, infY);
          ctx.lineTo(infW + 3, infY);
          ctx.quadraticCurveTo(exitW * 0.82, (infY + exitY) * 0.5, exitW, exitY);
          ctx.lineTo(-exitW, exitY);
          ctx.quadraticCurveTo(-exitW * 0.82, (infY + exitY) * 0.5, -infW - 3, infY);
          ctx.lineTo(-infW, infY);
          ctx.quadraticCurveTo(-infW * 0.72, (throatY + infY) * 0.5, -throatW, throatY);
        } else {
          ctx.moveTo(-throatW, throatY);
          ctx.lineTo(throatW, throatY);
          ctx.quadraticCurveTo(exitW * 0.65, (throatY + exitY) * 0.5, exitW, exitY);
          ctx.lineTo(-exitW, exitY);
          ctx.quadraticCurveTo(-exitW * 0.65, (throatY + exitY) * 0.5, -throatW, throatY);
        }
        ctx.closePath();
        ctx.clip();

        ctx.strokeStyle = 'rgba(203, 213, 225, 0.32)';
        ctx.lineWidth = 0.8;
        const numTubes = 9;
        for (let t = 1; t < numTubes; t++) {
          const frac = t / numTubes;
          const topX = -throatW + throatW * 2 * frac;
          const botX = -exitW + exitW * 2 * frac;
          ctx.beginPath();
          ctx.moveTo(topX, throatY);
          if (cfg.nozzleStyle === 'Cone') {
            ctx.lineTo(botX, exitY);
          } else {
            ctx.quadraticCurveTo(botX * 0.65, (throatY + exitY) * 0.5, botX, exitY);
          }
          ctx.stroke();
        }

        ctx.restore();

        // Circumferential Stiffener Hat-Rings
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
        ctx.lineWidth = 1.3;
        const numRings = cfg.nozzleStyle === 'Bravo' ? 6 : cfg.nozzleStyle === 'Delta' ? 4 : 3;
        for (let r = 1; r <= numRings; r++) {
          const ry = throatY + (exitY - throatY) * (r / (numRings + 1));
          const rx = throatW + (exitW - throatW) * Math.pow(r / (numRings + 1), 0.72);
          ctx.beginPath();
          ctx.moveTo(-rx, ry);
          ctx.lineTo(rx, ry);
          ctx.stroke();
        }

        // Omega Nozzle: Spiral Turbopump Dump Manifold Wrap (Juno: New Origins Video 2 at 2:15)
        if (cfg.nozzleStyle === 'Omega') {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.2;
          const spiralTopY = throatY + (exitY - throatY) * 0.22;
          const spiralBotY = throatY + (exitY - throatY) * 0.52;
          for (let s = 0; s < 3; s++) {
            const sy = spiralTopY + (spiralBotY - spiralTopY) * (s / 2);
            const sw = throatW + (exitW - throatW) * 0.35;
            ctx.beginPath();
            ctx.arc(0, sy, sw * 0.85, 0, Math.PI);
            ctx.stroke();
          }
        }

        // Annular Exit Lip Reinforcement
        ctx.fillStyle = '#334155';
        ctx.fillRect(-exitW - 1, exitY - 2, (exitW + 1) * 2, 3);
      }

      // 4. Combustion Core Glow / Active Throttle
      if (engineActive || throttle > 0.01) {
        const glowAlpha = Math.max(0.4, throttle);
        let coreColor = '255, 120, 30'; // Kerolox
        if (cfg.liquidFuel === 'Hydrolox' || (isNuclear && cfg.nuclearFuel === 'Liquid Hydrogen')) {
          coreColor = '56, 189, 248'; // Cyan
        } else if (cfg.liquidFuel === 'Methalox') {
          coreColor = '168, 85, 247'; // Purple
        } else if (isSolid) {
          coreColor = '251, 191, 36'; // Gold
        }

        const glowGrad = ctx.createRadialGradient(0, throatY + 3, 1, 0, throatY + 3, throatW * 2.8);
        glowGrad.addColorStop(0, `rgba(255, 255, 255, ${glowAlpha})`);
        glowGrad.addColorStop(0.3, `rgba(${coreColor}, ${glowAlpha * 0.9})`);
        glowGrad.addColorStop(0.7, `rgba(${coreColor}, ${glowAlpha * 0.5})`);
        glowGrad.addColorStop(1, `rgba(${coreColor}, 0)`);

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, throatY + 3, throatW * 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore(); // Close nozzle gimbal transform
    }
  }

  // =========================================================================
  // 3. FUEL TANKS (SFS & SATURN V / FALCON 9 / STARSHIP ARCHETYPE)
  // =========================================================================
  else if (def.category === 'Fuel') {
    if (def.isOreTank || def.id === 'ore_tank') {
      // Heavy Industrial Reinforced Ore & Mineral Hopper Tank (Flush aerospace boundaries)
      const oreGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      oreGrad.addColorStop(0, '#292524');
      oreGrad.addColorStop(0.2, '#44403c');
      oreGrad.addColorStop(0.5, '#78716c');
      oreGrad.addColorStop(0.8, '#44403c');
      oreGrad.addColorStop(1, '#1c1917');

      ctx.fillStyle = oreGrad;
      ctx.strokeStyle = '#0c0a09';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 2);
      ctx.fill();
      ctx.stroke();

      // Industrial Heavy Ribbed Reinforcements (Corrugated Hull)
      ctx.strokeStyle = 'rgba(217, 119, 6, 0.6)';
      ctx.lineWidth = 1.5;
      const ribs = Math.max(3, Math.floor(ph / 14));
      for (let r = 1; r < ribs; r++) {
        const ry = -hh + (ph / ribs) * r;
        ctx.beginPath();
        ctx.moveTo(-hw, ry);
        ctx.lineTo(hw, ry);
        ctx.stroke();
      }

      // Center High-Pressure Quartz Ore Inspection Viewport
      const viewH = Math.min(ph * 0.35, 24);
      const viewW = Math.min(pw * 0.5, 32);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-viewW / 2, -viewH / 2, viewW, viewH, 3);
      ctx.fill();
      ctx.stroke();

      // Crystalline Mineral Regolith fragments inside viewport
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(-viewW * 0.2, -viewH * 0.1, 3, 0, Math.PI * 2);
      ctx.arc(viewW * 0.15, viewH * 0.15, 3.5, 0, Math.PI * 2);
      ctx.arc(0, -viewH * 0.2, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Industrial Flush Top & Bottom Interface Rings
      const collarH = Math.min(ph * 0.08, 5);
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(-hw, -hh, pw, collarH);
      ctx.fillRect(-hw, hh - collarH, pw, collarH);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(-hw, -hh + collarH - 1.5, pw, 1.5);
      ctx.fillRect(-hw, hh - collarH, pw, 1.5);
    } else if (def.id === 'tank_spherical_cryo' || def.id === 'tank_rcs_monoprop' || def.id.includes('sphere')) {
      // =====================================================================
      // Spherical Cryogenic / Monopropellant Pressure Vessel
      // =====================================================================
      const isCryo = def.id.includes('cryo') || def.fuelType === 'hydrolox' || def.color === '#fbbf24';
      const sphereR = Math.min(hw, hh) - 2;

      // Structural mounting trunnions (Flush interface with top and bottom parts)
      const trunnionW = Math.min(pw * 0.55, 28);
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      // Top mounting collar
      ctx.fillRect(-trunnionW / 2, -hh, trunnionW, Math.max(3, hh - sphereR + 2));
      ctx.strokeRect(-trunnionW / 2, -hh, trunnionW, Math.max(3, hh - sphereR + 2));
      // Bottom mounting collar (Flush at hh)
      ctx.fillRect(-trunnionW / 2, sphereR - 2, trunnionW, Math.max(3, hh - sphereR + 2));
      ctx.strokeRect(-trunnionW / 2, sphereR - 2, trunnionW, Math.max(3, hh - sphereR + 2));

      // 3D Spherical Surface Gradient
      const sphereGrad = ctx.createRadialGradient(
        -sphereR * 0.32,
        -sphereR * 0.35,
        sphereR * 0.08,
        0,
        0,
        sphereR
      );

      if (isCryo) {
        // Multi-Layer Kapton Amber/Gold Insulation
        sphereGrad.addColorStop(0, '#fef08a');
        sphereGrad.addColorStop(0.22, '#fbbf24');
        sphereGrad.addColorStop(0.55, '#d97706');
        sphereGrad.addColorStop(0.85, '#92400e');
        sphereGrad.addColorStop(1, '#451a03');
      } else {
        // High-Pressure Aerospace Titanium (RCS Monoprop)
        sphereGrad.addColorStop(0, '#ffffff');
        sphereGrad.addColorStop(0.2, '#e2e8f0');
        sphereGrad.addColorStop(0.48, '#94a3b8');
        sphereGrad.addColorStop(0.8, '#475569');
        sphereGrad.addColorStop(1, '#0f172a');
      }

      ctx.fillStyle = sphereGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, sphereR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Equatorial Welded Girth Ring & Flange Fasteners
      ctx.strokeStyle = isCryo ? '#78350f' : '#334155';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, sphereR, sphereR * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Specular highlight rim on equatorial ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(0, 0, sphereR * 0.96, sphereR * 0.18, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      // High-pressure braided stainless fluid manifold
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-sphereR * 0.7, 0);
      ctx.lineTo(-sphereR * 0.7, hh - 1);
      ctx.stroke();
    } else if (def.id === 'tank_toroidal') {
      // =====================================================================
      // Toroidal Donut Lunar Descent Tank
      // =====================================================================
      const outerRx = hw - 2;
      const outerRy = hh - 2;
      const innerRx = outerRx * 0.38;
      const innerRy = outerRy * 0.42;

      // Outer Torus Body
      const torusGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      torusGrad.addColorStop(0, '#475569');
      torusGrad.addColorStop(0.2, '#cbd5e1');
      torusGrad.addColorStop(0.45, '#ffffff');
      torusGrad.addColorStop(0.75, '#94a3b8');
      torusGrad.addColorStop(1, '#334155');

      ctx.fillStyle = torusGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;

      ctx.beginPath();
      ctx.ellipse(0, 0, outerRx, outerRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner Cutout Hole
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(0, 0, innerRx, innerRy, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Structural Spider Truss Braces across the torus core
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-innerRx, 0);
      ctx.lineTo(innerRx, 0);
      ctx.moveTo(0, -innerRy);
      ctx.lineTo(0, innerRy);
      ctx.stroke();

      // Top and Bottom Flush Interface Brackets
      const mountW = Math.min(pw * 0.45, 24);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-mountW / 2, -hh, mountW, 2.5);
      ctx.fillRect(-mountW / 2, hh - 2.5, mountW, 2.5);
    } else if (def.id === 'tank_radial_slanted') {
      // =====================================================================
      // Aerodynamic Slanted Nose Booster Tank
      // =====================================================================
      const noseCutY = -hh + ph * 0.35;
      const boosterGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      boosterGrad.addColorStop(0, '#64748b');
      boosterGrad.addColorStop(0.22, '#cbd5e1');
      boosterGrad.addColorStop(0.48, '#ffffff');
      boosterGrad.addColorStop(0.78, '#94a3b8');
      boosterGrad.addColorStop(1, '#475569');

      ctx.fillStyle = boosterGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.moveTo(hw, hh);
      ctx.lineTo(-hw, hh); // Clean flat bottom!
      ctx.lineTo(-hw, noseCutY);
      // Aerodynamic ogive curve to top nose tip
      ctx.quadraticCurveTo(-hw * 0.8, -hh + 4, hw * 0.1, -hh);
      ctx.lineTo(hw, noseCutY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Thermal protective black nose tip cap
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.4, -hh + 9);
      ctx.quadraticCurveTo(-hw * 0.2, -hh + 3, hw * 0.1, -hh);
      ctx.lineTo(hw * 0.5, -hh + 7);
      ctx.closePath();
      ctx.fill();

      // Circumferential Weld Rings on cylindrical lower barrel
      const barrelH = ph * 0.65;
      const rings = Math.max(2, Math.floor(barrelH / 22));
      for (let r = 1; r < rings; r++) {
        const ry = noseCutY + (barrelH / rings) * r;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-hw, ry);
        ctx.lineTo(hw, ry);
        ctx.stroke();
      }

      // Flush Aft Booster Skirt (Zero bulge, flat at hh)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-hw + 1, hh - 3.5, pw - 2, 3.5);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.0;
      ctx.strokeRect(-hw + 1, hh - 3.5, pw - 2, 3.5);
    } else {
      // =====================================================================
      // Standard & Modular Cylindrical Aerospace Fuel Tanks
      // (Falcon 9 / Saturn V / Starship / SLS Archetype)
      // Completely redesigned with clean flush mating rims and ZERO BOTTOM BULGE
      // =====================================================================
      const isHydrolox = def.fuelType === 'hydrolox' || def.id.includes('orange');
      const isSteel = def.id.includes('starship') || def.id.includes('4m') || def.name?.includes('Starship') || def.id.includes('steel');
      const isDarkTank = def.color === '#0f172a' || def.color === '#1e293b' || def.color === '#334155';

      const resolvedSkin = tankSkin || (isHydrolox ? 'orange' : isSteel ? 'steel' : isDarkTank ? 'dark' : 'white');

      // -----------------------------------------------------------------
      // 1. High-Fidelity 3D Cylindrical Surface Shading
      // -----------------------------------------------------------------
      const tankGrad = ctx.createLinearGradient(-hw, 0, hw, 0);

      if (resolvedSkin === 'orange') {
        // Space Shuttle ET / SLS SOFI Orange Textured Cryogenic Foam
        tankGrad.addColorStop(0, '#7c2d12');
        tankGrad.addColorStop(0.12, '#9a3412');
        tankGrad.addColorStop(0.32, '#c2410c');
        tankGrad.addColorStop(0.52, '#ea580c');
        tankGrad.addColorStop(0.68, '#fb923c'); // Specular foam highlight
        tankGrad.addColorStop(0.85, '#c2410c');
        tankGrad.addColorStop(1, '#7c2d12');
      } else if (resolvedSkin === 'steel') {
        // Starship 304L Cold-Rolled Stainless Mirror Sheen
        tankGrad.addColorStop(0, '#334155');
        tankGrad.addColorStop(0.15, '#64748b');
        tankGrad.addColorStop(0.35, '#94a3b8');
        tankGrad.addColorStop(0.48, '#e2e8f0');
        tankGrad.addColorStop(0.55, '#ffffff'); // Crisp chrome reflection streak
        tankGrad.addColorStop(0.72, '#cbd5e1');
        tankGrad.addColorStop(0.88, '#64748b');
        tankGrad.addColorStop(1, '#1e293b');
      } else if (resolvedSkin === 'dark') {
        // Carbon-Composite Graphite / Titanium Interstage
        tankGrad.addColorStop(0, '#020617');
        tankGrad.addColorStop(0.20, '#0f172a');
        tankGrad.addColorStop(0.45, '#1e293b');
        tankGrad.addColorStop(0.58, '#334155'); // Matte carbon sheen
        tankGrad.addColorStop(0.80, '#0f172a');
        tankGrad.addColorStop(1, '#020617');
      } else {
        // Aerospace Satin White Polyurethane (Falcon 9 / Saturn S-IVB)
        tankGrad.addColorStop(0, '#64748b');
        tankGrad.addColorStop(0.12, '#94a3b8');
        tankGrad.addColorStop(0.30, '#cbd5e1');
        tankGrad.addColorStop(0.45, '#f8fafc');
        tankGrad.addColorStop(0.56, '#ffffff'); // Clean satin white highlight
        tankGrad.addColorStop(0.72, '#f1f5f9');
        tankGrad.addColorStop(0.88, '#cbd5e1');
        tankGrad.addColorStop(1, '#64748b');
      }

      ctx.fillStyle = tankGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;

      // Tank Outer Hull: perfectly crisp, micro-beveled corners
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 1.5);
      ctx.fill();
      ctx.stroke();

      // -----------------------------------------------------------------
      // 2. Precision Structural Interface Flanges (Forward & Aft Skirts)
      // Completely flush at -hh and hh — NO PROTRUSION PAST BOUNDARIES
      // -----------------------------------------------------------------
      const collarH = Math.min(3.5, Math.max(2.0, ph * 0.04));

      // Forward (Top) Docking/Interstage Collar
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-hw, -hh, pw, collarH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-hw, -hh, pw, collarH);

      // Aft (Bottom) Skirt Collar: FLAT AND FLUSH AT hh (NO BULGE!)
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-hw, hh - collarH, pw, collarH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-hw, hh - collarH, pw, collarH);

      // Micro bolt rivets along forward and aft collars
      const rivetCount = Math.max(3, Math.floor(pw / 10));
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      for (let rv = 0; rv <= rivetCount; rv++) {
        const rx = -hw + 3 + ((pw - 6) / rivetCount) * rv;
        ctx.fillRect(rx - 0.5, -hh + 1, 1, 1);
        ctx.fillRect(rx - 0.5, hh - collarH + 1, 1, 1);
      }

      // -----------------------------------------------------------------
      // 3. Circumferential Welded Panel Seams / Friction-Stir Rings
      // -----------------------------------------------------------------
      const usablePh = ph - collarH * 2;
      const panelCount = Math.max(2, Math.floor(usablePh / 24));
      for (let i = 1; i < panelCount; i++) {
        const py = -hh + collarH + (usablePh / panelCount) * i;

        // Dark weld seam
        ctx.strokeStyle =
          resolvedSkin === 'orange'
            ? 'rgba(124, 45, 18, 0.7)'
            : resolvedSkin === 'steel'
            ? 'rgba(51, 65, 85, 0.75)'
            : resolvedSkin === 'dark'
            ? 'rgba(2, 6, 23, 0.85)'
            : 'rgba(100, 116, 139, 0.6)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(-hw + 0.5, py);
        ctx.lineTo(hw - 0.5, py);
        ctx.stroke();

        // Specular highlight along weld bead
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(-hw + 0.5, py + 0.8);
        ctx.lineTo(hw - 0.5, py + 0.8);
        ctx.stroke();
      }

      // -----------------------------------------------------------------
      // 4. Internal Common Bulkhead Dome Weld Indicator (Subtle X-ray dome)
      // -----------------------------------------------------------------
      if (ph > 32) {
        const domeH = Math.min(ph * 0.08, 6);
        ctx.strokeStyle =
          resolvedSkin === 'steel'
            ? 'rgba(255, 255, 255, 0.25)'
            : resolvedSkin === 'orange'
            ? 'rgba(154, 52, 18, 0.4)'
            : 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-hw + 2, -hh + collarH + domeH);
        ctx.quadraticCurveTo(0, -hh + collarH + domeH * 1.6, hw - 2, -hh + collarH + domeH);
        ctx.stroke();
      }

      // -----------------------------------------------------------------
      // 5. Cryogenic Frost & Propellant Level Indication
      // -----------------------------------------------------------------
      if (fuelPercent < 0.999 || isFlight) {
        const clampedPct = Math.max(0, Math.min(1, fuelPercent));
        const liquidTopY = hh - collarH - (usablePh * clampedPct);

        // Cryogenic frost layer on lower liquid-filled tank section
        const frostGrad = ctx.createLinearGradient(0, liquidTopY, 0, hh - collarH);
        frostGrad.addColorStop(0, 'rgba(224, 242, 254, 0.18)');
        frostGrad.addColorStop(1, 'rgba(186, 230, 253, 0.06)');

        ctx.fillStyle = frostGrad;
        ctx.fillRect(-hw + 1, liquidTopY, pw - 2, (hh - collarH) - liquidTopY);

        // Condensation Frost Line across tank diameter
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(-hw + 1, liquidTopY);
        ctx.lineTo(hw - 1, liquidTopY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // -----------------------------------------------------------------
      // 6. Flush Aerodynamic Pressurization / Avionics Raceway
      // Runs neatly between forward and aft collars without protruding
      // -----------------------------------------------------------------
      const raceW = Math.max(2.5, Math.min(pw * 0.05, 5));
      const raceX = hw * 0.62;
      const raceTop = -hh + collarH + 2;
      const raceBottom = hh - collarH - 2;
      const raceH = raceBottom - raceTop;

      if (raceH > 8) {
        ctx.fillStyle = resolvedSkin === 'orange' ? '#9a3412' : '#475569';
        ctx.fillRect(raceX, raceTop, raceW, raceH);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(raceX, raceTop, raceW, raceH);

        // Aerodynamic beveled fairing caps at ends
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(raceX, raceTop);
        ctx.lineTo(raceX + raceW / 2, raceTop - 2);
        ctx.lineTo(raceX + raceW, raceTop);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(raceX, raceBottom);
        ctx.lineTo(raceX + raceW / 2, raceBottom + 2);
        ctx.lineTo(raceX + raceW, raceBottom);
        ctx.closePath();
        ctx.fill();
      }

      // -----------------------------------------------------------------
      // 7. Aerospace Propellant Identification Badge & Roll Patterns
      // -----------------------------------------------------------------
      if (!isDarkTank && ph > 45 && pw > 25) {
        // Roll-Control Black & White Optical Pattern
        const checkerH = Math.min(8, ph * 0.12);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-hw, -hh + collarH + 2, pw * 0.22, checkerH);
        ctx.fillRect(hw * 0.25, -hh + collarH + 2, pw * 0.22, checkerH);
      }

      // Propellant Spec Identification Stripe
      const stripeH = Math.min(ph * 0.12, 8);
      const stripeY = -hh + collarH + (ph > 45 && pw > 25 ? 12 : 3);
      ctx.fillStyle = def.accentColor || (resolvedSkin === 'orange' ? '#ea580c' : resolvedSkin === 'steel' ? '#38bdf8' : '#0284c7');
      ctx.fillRect(-hw, stripeY, pw, stripeH);

      // Stenciled Technical Label
      if (pw > 32) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 7.5px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label =
          resolvedSkin === 'orange' || def.fuelType === 'hydrolox'
            ? 'LH2 / LOX'
            : resolvedSkin === 'steel' || def.fuelType === 'methalox'
            ? 'CH4 / LOX'
            : 'RP-1 / LOX';
        ctx.fillText(label, 0, stripeY + stripeH / 2);
      }

      // -----------------------------------------------------------------
      // 8. Flush Aft Thrust Deck & Recessed Internal Gimbal Sockets
      // (ABSOLUTELY NO BULGE — Perfectly flat and flush at the bottom boundary)
      // -----------------------------------------------------------------
      const mountCount = engineMountCount || 1;
      const mountSlots =
        mountCount === 1
          ? [0]
          : mountCount === 2
          ? [-hw * 0.48, hw * 0.48]
          : [-hw * 0.62, 0, hw * 0.62];

      // Internal recessed engine mounting sockets (Contained WITHIN the aft skirt)
      mountSlots.forEach((slotX) => {
        const socketW = Math.min(12, Math.max(5, pw / (mountCount * 3.2)));

        // Recessed internal gimbal cup inside the skirt (Y: hh - 3 to hh)
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(slotX, hh - 1.5, socketW, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.0;
        ctx.stroke();

        // Dark internal fuel feed aperture
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(slotX, hh - 1.5, socketW * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Precision snap target reticle when selected or hovering (Clean, flush on bottom edge)
        if (isSelected || showSnapPoints) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(slotX, hh, Math.min(socketW * 0.8, 6), 0, Math.PI * 2);
          ctx.stroke();

          // Reticle center pip
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(slotX, hh, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }

  // =========================================================================
  // 4. AERODYNAMICS (NOSE CONES, FAIRINGS, FINS & GRID FINS)
  // =========================================================================
  else if (def.category === 'Aerodynamics') {
    // Base width auto-adapts to underlying tank/stage if provided
    const baseHw = bottomWidthPx && bottomWidthPx > 0 ? bottomWidthPx / 2 : hw;

    if (def.isFairing || def.id.includes('fairing')) {
      // Split Payload Clamshell Fairing with glossy aerodynamic curve
      const fairingGrad = ctx.createLinearGradient(-baseHw, 0, baseHw, 0);
      fairingGrad.addColorStop(0, '#94a3b8');
      fairingGrad.addColorStop(0.2, '#e2e8f0');
      fairingGrad.addColorStop(0.45, '#ffffff');
      fairingGrad.addColorStop(0.75, '#cbd5e1');
      fairingGrad.addColorStop(1, '#64748b');

      ctx.fillStyle = fairingGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.moveTo(0, -hh);
      ctx.quadraticCurveTo(baseHw * 1.05, -hh * 0.2, baseHw, hh);
      ctx.lineTo(-baseHw, hh);
      ctx.quadraticCurveTo(-baseHw * 1.05, -hh * 0.2, 0, -hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Fairing Clamshell Separation Seam (Center Line)
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(0, -hh);
      ctx.lineTo(0, hh);
      ctx.stroke();
      ctx.setLineDash([]);

      // Stainless Steel Tip Cap
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, -hh + 3, 3, 0, Math.PI * 2);
      ctx.fill();

      // Pyro Pusher Release Bolts
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, hh * 0.35, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.id.includes('grid_fin') || def.id.includes('grid')) {
      // Titanium Grid Fin with honeycomb lattice
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;

      ctx.fillRect(-hw, -hh, pw, ph);
      ctx.strokeRect(-hw, -hh, pw, ph);

      // Grid lattice
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      const gw = pw / 4;
      for (let x = -hw + gw; x < hw; x += gw) {
        ctx.beginPath();
        ctx.moveTo(x, -hh);
        ctx.lineTo(x, hh);
        ctx.stroke();
      }
      const gh = ph / 4;
      for (let y = -hh + gh; y < hh; y += gh) {
        ctx.beginPath();
        ctx.moveTo(-hw, y);
        ctx.lineTo(hw, y);
        ctx.stroke();
      }

      // 360-degree rotation pivot axle
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, hh, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.id.includes('fin') || def.id.includes('aerodynamic_fin')) {
      // Aerodynamic Swept Winglet Fin
      const finGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      finGrad.addColorStop(0, '#f8fafc');
      finGrad.addColorStop(0.5, '#e2e8f0');
      finGrad.addColorStop(1, '#94a3b8');

      ctx.fillStyle = finGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;

      ctx.beginPath();
      ctx.moveTo(-hw * 0.4, -hh);
      ctx.lineTo(hw, hh);
      ctx.lineTo(-hw, hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Carbon-composite leading edge thermal barrier
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.4, -hh);
      ctx.lineTo(hw, hh);
      ctx.stroke();

      // Aileron flap hinge seam
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(hw * 0.25, hh * 0.2);
      ctx.lineTo(hw * 0.25, hh);
      ctx.stroke();
    } else if (def.id.includes('slanted') || def.id.includes('cone') || (def as { isNoseCone?: boolean }).isNoseCone) {
      // Authentic Fixed-Geometry Tangent Ogive & Slanted Nose Cones (Width never changes unexpectedly)
      renderFixedOgiveNoseCone(ctx, def, options);
    } else {
      renderFixedOgiveNoseCone(ctx, def, options);
    }
  }

  // =========================================================================
  // 5. UTILITY (SOLAR PANELS, LANDING LEGS, DOCKING PORTS, RCS)
  // =========================================================================
  else if (def.category === 'Utility') {
    if (def.isMiningDrill || def.id === 'mining_drill') {
      // Extraterrestrial Surface Harvester Drill
      // Heavy pneumatic rotary housing with spiral tungsten bit
      const bodyGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      bodyGrad.addColorStop(0, '#78350f');
      bodyGrad.addColorStop(0.3, '#d97706');
      bodyGrad.addColorStop(0.7, '#fbbf24');
      bodyGrad.addColorStop(1, '#78350f');

      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.6;

      // Upper pneumatic motor housing
      const motorH = ph * 0.45;
      ctx.beginPath();
      ctx.roundRect(-hw * 0.75, -hh, pw * 0.75, motorH, 3);
      ctx.fill();
      ctx.stroke();

      // Industrial hazard chevrons on motor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-hw * 0.6, -hh + 3, pw * 0.6, 4);

      // Telescoping drill shaft & spiral tungsten bit extending downwards
      const bitTopY = -hh + motorH;
      const bitH = ph * 0.55;
      const bitW = pw * 0.45;

      const bitGrad = ctx.createLinearGradient(-bitW / 2, 0, bitW / 2, 0);
      bitGrad.addColorStop(0, '#475569');
      bitGrad.addColorStop(0.5, '#e2e8f0');
      bitGrad.addColorStop(1, '#334155');

      ctx.fillStyle = bitGrad;
      ctx.beginPath();
      ctx.moveTo(-bitW / 2, bitTopY);
      ctx.lineTo(bitW / 2, bitTopY);
      ctx.lineTo(bitW * 0.2, hh);
      ctx.lineTo(0, hh + 4); // Chisel drill tip
      ctx.lineTo(-bitW * 0.2, hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Spiral flutes carved into bit
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4;
      const turns = 4;
      for (let t = 0; t < turns; t++) {
        const ty = bitTopY + (bitH / turns) * t;
        ctx.beginPath();
        ctx.moveTo(-bitW * 0.4, ty);
        ctx.lineTo(bitW * 0.35, ty + bitH / turns * 0.8);
        ctx.stroke();
      }

      // Hydraulic suspension mounting brackets
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-hw, -hh + 4, hw * 0.3, motorH * 0.6);
    } else if (def.isRefinery || def.id === 'refinery_unit') {
      // ISRU Chemical Refining Processor (Catalytic cracking column & cooling pipes)
      const refGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      refGrad.addColorStop(0, '#042f2e');
      refGrad.addColorStop(0.2, '#0f766e');
      refGrad.addColorStop(0.6, '#14b8a6');
      refGrad.addColorStop(1, '#042f2e');

      ctx.fillStyle = refGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // Dual distillation cracking towers inside unit
      const towerW = pw * 0.36;
      ctx.fillStyle = '#134e4a';
      ctx.strokeStyle = '#2dd4bf';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-hw * 0.85, -hh * 0.75, towerW, ph * 0.75);
      ctx.strokeRect(-hw * 0.85, -hh * 0.75, towerW, ph * 0.75);

      ctx.fillRect(hw * 0.85 - towerW, -hh * 0.75, towerW, ph * 0.75);
      ctx.strokeRect(hw * 0.85 - towerW, -hh * 0.75, towerW, ph * 0.75);

      // Cyan cryogenic high-pressure manifold pipes
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.5, 0);
      ctx.lineTo(hw * 0.5, 0);
      ctx.stroke();

      // Status indicator LED display
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(0, -hh * 0.4, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.isSmelter || def.id === 'smelter_unit') {
      // Vacuum Arc Smelter & Ingot Forge
      const smelterGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      smelterGrad.addColorStop(0, '#1c1917');
      smelterGrad.addColorStop(0.2, '#450a0a');
      smelterGrad.addColorStop(0.5, '#7f1d1d');
      smelterGrad.addColorStop(0.8, '#450a0a');
      smelterGrad.addColorStop(1, '#1c1917');

      ctx.fillStyle = smelterGrad;
      ctx.strokeStyle = '#0c0a09';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // Heavy vertical cooling radiator fins
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1.2;
      const finCount = 5;
      for (let f = 1; f < finCount; f++) {
        const fx = -hw + (pw / finCount) * f;
        ctx.beginPath();
        ctx.moveTo(fx, -hh);
        ctx.lineTo(fx, hh);
        ctx.stroke();
      }

      // Incandescent 2000K Plasma Arc Core Window
      const arcW = pw * 0.4;
      const arcH = ph * 0.35;
      const arcGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, arcW / 2);
      arcGrad.addColorStop(0, '#ffffff');
      arcGrad.addColorStop(0.3, '#fef08a');
      arcGrad.addColorStop(0.7, '#f97316');
      arcGrad.addColorStop(1, '#dc2626');

      ctx.fillStyle = arcGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, arcW / 2, arcH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (def.isWheel) {
      renderAnimatedRoverWheel(ctx, def, options);
    } else if (def.isSolarPanel) {
      renderAnimatedSolarPanel(ctx, def, options);
    } else if (def.isLandingLeg) {
      renderAnimatedLandingLeg(ctx, def, options);
    } else if (def.isDockingPort) {
      // Androgynous Aerospace Docking Ring (ISS / Gateway archetype)
      const portGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      portGrad.addColorStop(0, '#334155');
      portGrad.addColorStop(0.5, '#cbd5e1');
      portGrad.addColorStop(1, '#1e293b');

      ctx.fillStyle = portGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // Capture Petals & Central Hatch Seal
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(hw, hh) * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Green alignment crosshair
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(hw, hh) * 0.45, 0, Math.PI * 2);
      ctx.moveTo(0, -hh * 0.3);
      ctx.lineTo(0, hh * 0.3);
      ctx.moveTo(-hw * 0.3, 0);
      ctx.lineTo(hw * 0.3, 0);
      ctx.stroke();
    } else if (def.isRCS) {
      renderAnimatedRCS(ctx, def, options);
    } else if (def.isDecoupler) {
      // Interstage Decoupler / Separator in Utility
      if (def.isSideSeparator) {
        // Radial / Side Separator for strap-on boosters
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.6;
        ctx.fillRect(-hw, -hh, pw, ph);
        ctx.strokeRect(-hw, -hh, pw, ph);

        // Mounting bracket arm
        ctx.fillStyle = '#475569';
        ctx.fillRect(-hw * 0.5, -hh * 0.7, pw * 0.5, ph * 1.4);

        // Warning hazard stripes
        ctx.fillStyle = '#eab308';
        ctx.fillRect(-hw, -hh * 0.3, pw, ph * 0.6);
        ctx.fillStyle = '#0f172a';
        for (let y = -hh * 0.3; y < hh * 0.3; y += 4) {
          ctx.fillRect(-hw, y, pw, 2);
        }

        // Explosive separation bolts
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -hh * 0.5, 2.5, 0, Math.PI * 2);
        ctx.arc(0, hh * 0.5, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Vertical Interstage Decoupler / Conical Transition Adapter
        const wBot = bottomWidthPx && bottomWidthPx > 0 ? bottomWidthPx : pw;
        const wTop = topWidthPx && topWidthPx > 0 ? topWidthPx : pw;
        const hwBot = wBot / 2;
        const hwTop = wTop / 2;
        const isConicalTransition = Math.abs(wBot - wTop) > 2 || adapterShape === 'cone_cylinder';

        if (isConicalTransition) {
          // CONICAL TRANSITION ADAPTER: "Cone + Cylinder" interstage shape
          const collarH = Math.max(6, ph * 0.35);
          const coneH = ph - collarH;
          const coneTopY = -hh + collarH;

          // 1. Lower Conical Frustum Section
          const coneGrad = ctx.createLinearGradient(-hwBot, 0, hwBot, 0);
          coneGrad.addColorStop(0, '#0f172a');
          coneGrad.addColorStop(0.2, '#1e293b');
          coneGrad.addColorStop(0.5, '#475569');
          coneGrad.addColorStop(0.8, '#1e293b');
          coneGrad.addColorStop(1, '#0f172a');

          ctx.fillStyle = coneGrad;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.8;

          ctx.beginPath();
          ctx.moveTo(-hwBot, hh);
          ctx.lineTo(-hwTop, coneTopY);
          ctx.lineTo(hwTop, coneTopY);
          ctx.lineTo(hwBot, hh);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Longitudinal structural stringers on conical adapter
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1;
          const stringers = 5;
          for (let s = 1; s < stringers; s++) {
            const factor = s / stringers;
            const xBot = -hwBot + wBot * factor;
            const xTop = -hwTop + wTop * factor;
            ctx.beginPath();
            ctx.moveTo(xBot, hh);
            ctx.lineTo(xTop, coneTopY);
            ctx.stroke();
          }

          // 2. Upper Cylindrical Mating Collar
          const collarGrad = ctx.createLinearGradient(-hwTop, 0, hwTop, 0);
          collarGrad.addColorStop(0, '#1e293b');
          collarGrad.addColorStop(0.5, '#334155');
          collarGrad.addColorStop(1, '#0f172a');

          ctx.fillStyle = collarGrad;
          ctx.fillRect(-hwTop, -hh, wTop, collarH);
          ctx.strokeRect(-hwTop, -hh, wTop, collarH);

          // Hazard chevron stripes on mating collar
          ctx.save();
          ctx.beginPath();
          ctx.rect(-hwTop, -hh, wTop, collarH);
          ctx.clip();

          const stripeW = Math.max(5, collarH * 0.7);
          ctx.fillStyle = '#eab308';
          for (let x = -hwTop - collarH; x < hwTop + collarH; x += stripeW * 2) {
            ctx.beginPath();
            ctx.moveTo(x, coneTopY);
            ctx.lineTo(x + stripeW, coneTopY);
            ctx.lineTo(x + stripeW + collarH, -hh);
            ctx.lineTo(x + collarH, -hh);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();

          // Explosive push bolts on collar
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(-hwTop * 0.5, -hh + collarH / 2, 2.2, 0, Math.PI * 2);
          ctx.arc(hwTop * 0.5, -hh + collarH / 2, 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Standard Uniform-Diameter Cylindrical Interstage Decoupler ring
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.8;
          ctx.fillRect(-hw, -hh, pw, ph);
          ctx.strokeRect(-hw, -hh, pw, ph);

          // Yellow & Black Industrial Hazard Chevron Stripes
          ctx.save();
          ctx.beginPath();
          ctx.rect(-hw, -hh, pw, ph);
          ctx.clip();

          const stripeW = Math.max(6, ph * 0.8);
          ctx.fillStyle = '#eab308';
          for (let x = -hw - ph; x < hw + ph; x += stripeW * 2) {
            ctx.beginPath();
            ctx.moveTo(x, hh);
            ctx.lineTo(x + stripeW, hh);
            ctx.lineTo(x + stripeW + ph, -hh);
            ctx.lineTo(x + ph, -hh);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();

          // Push-apart pneumatic pistons
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(-hw * 0.5, 0, 2.5, 0, Math.PI * 2);
          ctx.arc(hw * 0.5, 0, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // AERODYNAMIC INTERSTAGE ENGINE COVER (Separator covers engines above it)
        if (shroudHeightPx > 0) {
          const sh = shroudHeightPx;
          const sTop = -hh - sh;
          const shroudW = wTop;
          const shroudHw = hwTop;

          ctx.save();
          if (isSelected || isHovered) {
            ctx.globalAlpha = 0.55; // Semi-transparent X-ray in inspect mode
          } else {
            ctx.globalAlpha = 0.98; // Solid aerodynamic cover
          }

          // Cylindrical Interstage Shroud Fairing Shell
          const shroudGrad = ctx.createLinearGradient(-shroudHw, 0, shroudHw, 0);
          shroudGrad.addColorStop(0, '#1e293b');
          shroudGrad.addColorStop(0.2, '#334155');
          shroudGrad.addColorStop(0.5, '#e2e8f0');
          shroudGrad.addColorStop(0.8, '#334155');
          shroudGrad.addColorStop(1, '#0f172a');

          ctx.fillStyle = shroudGrad;
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#0f172a';
          ctx.lineWidth = 1.6;
          ctx.fillRect(-shroudHw, sTop, shroudW, sh);
          ctx.strokeRect(-shroudHw, sTop, shroudW, sh);

          // Top Stage Mating Collar with Hazard Ring
          ctx.fillStyle = '#eab308';
          ctx.fillRect(-shroudHw, sTop, shroudW, Math.min(4, sh * 0.15));
          ctx.fillStyle = '#0f172a';
          for (let bx = -shroudHw + 4; bx < shroudHw - 4; bx += 8) {
            ctx.fillRect(bx, sTop, 3, Math.min(4, sh * 0.15));
          }

          // Horizontal panel reinforcement ribs
          ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
          ctx.lineWidth = 1;
          const ribs = Math.max(2, Math.floor(sh / 20));
          for (let r = 1; r <= ribs; r++) {
            const ry = sTop + (sh / (ribs + 1)) * r;
            ctx.beginPath();
            ctx.moveTo(-shroudHw, ry);
            ctx.lineTo(shroudHw, ry);
            ctx.stroke();
          }

          // Vertical Explosive Separation Seam Line
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(0, sTop);
          ctx.lineTo(0, -hh);
          ctx.stroke();
          ctx.setLineDash([]);

          // Staging Technical Label
          ctx.fillStyle = '#0f172a';
          ctx.font = `bold ${Math.max(8, Math.min(11, pw * 0.09))}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText('INTERSTAGE SHROUD', 0, sTop + sh / 2);

          // Umbilical Purge & Conditioning Port
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(hw * 0.65, sTop + sh * 0.75, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(hw * 0.65, sTop + sh * 0.75, 2, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }
    } else {
      ctx.fillStyle = def.color;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-hw, -hh, pw, ph);
      ctx.strokeRect(-hw, -hh, pw, ph);
    }
  }

  // =========================================================================
  // 6. STRUCTURAL (DECOUPLERS, ADAPTERS, HEAT SHIELDS, TRUSSES)
  // =========================================================================
  else if (def.category === 'Structural') {
    const isAdapterOrDecoupler = def.isDecoupler || def.id === 'structural_adapter' || def.id.includes('adapter');

    if (isAdapterOrDecoupler) {
      const wBot = bottomWidthPx && bottomWidthPx > 0 ? bottomWidthPx : (def.id === 'structural_adapter' ? pw * 1.25 : pw);
      const wTop = topWidthPx && topWidthPx > 0 ? topWidthPx : (def.id === 'structural_adapter' ? pw * 0.8 : pw);
      const hwBot = wBot / 2;
      const hwTop = wTop / 2;
      const isConicalTransition = Math.abs(wBot - wTop) > 2 || adapterShape === 'cone_cylinder' || def.id === 'structural_adapter';

      if (isConicalTransition) {
        // CONICAL TRANSITION ADAPTER: "Cone + Cylinder" interstage shape
        const collarH = Math.max(6, ph * 0.35);
        const coneH = ph - collarH;
        const coneTopY = -hh + collarH;

        // 1. Lower Conical Frustum Section
        const coneGrad = ctx.createLinearGradient(-hwBot, 0, hwBot, 0);
        coneGrad.addColorStop(0, '#0f172a');
        coneGrad.addColorStop(0.2, '#1e293b');
        coneGrad.addColorStop(0.5, '#475569');
        coneGrad.addColorStop(0.8, '#1e293b');
        coneGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = coneGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        ctx.moveTo(-hwBot, hh);
        ctx.lineTo(-hwTop, coneTopY);
        ctx.lineTo(hwTop, coneTopY);
        ctx.lineTo(hwBot, hh);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Longitudinal structural stringers on conical adapter
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 1;
        const stringers = 5;
        for (let s = 1; s < stringers; s++) {
          const factor = s / stringers;
          const xBot = -hwBot + wBot * factor;
          const xTop = -hwTop + wTop * factor;
          ctx.beginPath();
          ctx.moveTo(xBot, hh);
          ctx.lineTo(xTop, coneTopY);
          ctx.stroke();
        }

        // 2. Upper Cylindrical Mating Collar
        const collarGrad = ctx.createLinearGradient(-hwTop, 0, hwTop, 0);
        collarGrad.addColorStop(0, '#1e293b');
        collarGrad.addColorStop(0.5, '#334155');
        collarGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = collarGrad;
        ctx.fillRect(-hwTop, -hh, wTop, collarH);
        ctx.strokeRect(-hwTop, -hh, wTop, collarH);

        // Hazard chevron stripes on mating collar
        ctx.save();
        ctx.beginPath();
        ctx.rect(-hwTop, -hh, wTop, collarH);
        ctx.clip();

        const stripeW = Math.max(5, collarH * 0.7);
        ctx.fillStyle = '#eab308';
        for (let x = -hwTop - collarH; x < hwTop + collarH; x += stripeW * 2) {
          ctx.beginPath();
          ctx.moveTo(x, coneTopY);
          ctx.lineTo(x + stripeW, coneTopY);
          ctx.lineTo(x + stripeW + collarH, -hh);
          ctx.lineTo(x + collarH, -hh);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Explosive push bolts on collar
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-hwTop * 0.5, -hh + collarH / 2, 2.2, 0, Math.PI * 2);
        ctx.arc(hwTop * 0.5, -hh + collarH / 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Standard Uniform-Diameter Cylindrical Interstage Decoupler ring
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8;
        ctx.fillRect(-hw, -hh, pw, ph);
        ctx.strokeRect(-hw, -hh, pw, ph);

        // Yellow & Black Industrial Hazard Chevron Stripes
        ctx.save();
        ctx.beginPath();
        ctx.rect(-hw, -hh, pw, ph);
        ctx.clip();

        const stripeW = Math.max(6, ph * 0.8);
        ctx.fillStyle = '#eab308';
        for (let x = -hw - ph; x < hw + ph; x += stripeW * 2) {
          ctx.beginPath();
          ctx.moveTo(x, hh);
          ctx.lineTo(x + stripeW, hh);
          ctx.lineTo(x + stripeW + ph, -hh);
          ctx.lineTo(x + ph, -hh);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();

        // Pneumatic push-apart separation pistons
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-hw * 0.5, 0, 2.5, 0, Math.PI * 2);
        ctx.arc(hw * 0.5, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // AERODYNAMIC INTERSTAGE ENGINE COVER (Separator covers engines above it)
      if (shroudHeightPx > 0 && !def.isSideSeparator && isFlight) {
        const sh = shroudHeightPx;
        const sTop = -hh - sh;

        ctx.save();
        if (isSelected || isHovered) {
          ctx.globalAlpha = 0.55;
        } else {
          ctx.globalAlpha = 0.98;
        }

        const shroudGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
        shroudGrad.addColorStop(0, '#1e293b');
        shroudGrad.addColorStop(0.2, '#334155');
        shroudGrad.addColorStop(0.5, '#e2e8f0');
        shroudGrad.addColorStop(0.8, '#334155');
        shroudGrad.addColorStop(1, '#0f172a');

        ctx.fillStyle = shroudGrad;
        ctx.strokeStyle = isSelected ? '#38bdf8' : '#0f172a';
        ctx.lineWidth = 1.6;
        ctx.fillRect(-hw, sTop, pw, sh);
        ctx.strokeRect(-hw, sTop, pw, sh);

        ctx.fillStyle = '#eab308';
        ctx.fillRect(-hw, sTop, pw, Math.min(4, sh * 0.15));
        ctx.fillStyle = '#0f172a';
        for (let bx = -hw + 4; bx < hw - 4; bx += 8) {
          ctx.fillRect(bx, sTop, 3, Math.min(4, sh * 0.15));
        }

        ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
        ctx.lineWidth = 1;
        const ribs = Math.max(2, Math.floor(sh / 20));
        for (let r = 1; r <= ribs; r++) {
          const ry = sTop + (sh / (ribs + 1)) * r;
          ctx.beginPath();
          ctx.moveTo(-hw, ry);
          ctx.lineTo(hw, ry);
          ctx.stroke();
        }

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, sTop);
        ctx.lineTo(0, -hh);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.max(8, Math.min(11, pw * 0.09))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('INTERSTAGE SHROUD', 0, sTop + sh / 2);

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(hw * 0.65, sTop + sh * 0.75, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(hw * 0.65, sTop + sh * 0.75, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    } else if (def.isHeatShield) {
      // PICA-X Hexagonal / Square Thermal Tile Curved Heat Shield
      const shieldGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      shieldGrad.addColorStop(0, '#1c1917');
      shieldGrad.addColorStop(0.3, '#451a03');
      shieldGrad.addColorStop(0.7, '#78350f');
      shieldGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = shieldGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;

      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, [0, 0, 10, 10]);
      ctx.fill();
      ctx.stroke();

      // Ablative thermal protection system tile lines
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, [0, 0, 10, 10]);
      ctx.clip();

      ctx.strokeStyle = 'rgba(254, 215, 170, 0.25)';
      ctx.lineWidth = 0.8;
      const tileStep = Math.max(8, pw * 0.14);
      for (let x = -hw; x <= hw; x += tileStep) {
        ctx.beginPath();
        ctx.moveTo(x, -hh);
        ctx.lineTo(x, hh);
        ctx.stroke();
      }
      ctx.restore();

      // Thermal standoff attachment bolts
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(-hw * 0.6, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.arc(hw * 0.6, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.isParachute) {
      const pStage = options.parachuteStage || (options.deployed ? 'MAIN' : 'STOWED');
      renderAnimatedParachute(ctx, def, options, pStage);
    } else if (def.id === 'truss' || def.id.includes('truss')) {
      // Open-framework Structural Truss Girder
      ctx.fillStyle = 'rgba(30, 41, 59, 0.3)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.8;
      ctx.fillRect(-hw, -hh, pw, ph);
      ctx.strokeRect(-hw, -hh, pw, ph);

      // Inner diagonal cross bracing
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      const numBays = Math.max(1, Math.round(ph / Math.max(1, pw)));
      const bayH = ph / numBays;
      for (let b = 0; b < numBays; b++) {
        const topY = -hh + b * bayH;
        const botY = topY + bayH;
        ctx.beginPath();
        ctx.moveTo(-hw, topY);
        ctx.lineTo(hw, botY);
        ctx.moveTo(hw, topY);
        ctx.lineTo(-hw, botY);
        ctx.moveTo(-hw, botY);
        ctx.lineTo(hw, botY);
        ctx.stroke();
      }

      // Reinforcement gussets at 4 corners
      ctx.fillStyle = '#64748b';
      const gSize = Math.min(6, Math.min(pw, ph) * 0.25);
      ctx.fillRect(-hw, -hh, gSize, gSize);
      ctx.fillRect(hw - gSize, -hh, gSize, gSize);
      ctx.fillRect(-hw, hh - gSize, gSize, gSize);
      ctx.fillRect(hw - gSize, hh - gSize, gSize, gSize);
    } else {
      ctx.fillStyle = def.color;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-hw, -hh, pw, ph);
      ctx.strokeRect(-hw, -hh, pw, ph);
    }
  }

  // =========================================================================
  // 6. SPACE STATION MODULES (CRAFT PARTS / ORBITAL OUTPOSTS)
  // =========================================================================
  else if (def.category === 'Station') {
    const id = def.id;

    if (id.includes('core')) {
      // Station Core & Command Module
      const coreGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      coreGrad.addColorStop(0, '#64748b');
      coreGrad.addColorStop(0.2, '#cbd5e1');
      coreGrad.addColorStop(0.5, '#f8fafc');
      coreGrad.addColorStop(0.8, '#cbd5e1');
      coreGrad.addColorStop(1, '#475569');

      ctx.fillStyle = coreGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // MLI Quilted Thermal Insulation Seams
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
      ctx.lineWidth = 1.0;
      for (let y = -hh + 6; y < hh; y += 8) {
        ctx.beginPath();
        ctx.moveTo(-hw + 2, y);
        ctx.lineTo(hw - 2, y);
        ctx.stroke();
      }

      // 4-Way Docking Rings (Top, Bottom, Left, Right)
      ctx.fillStyle = '#334155';
      ctx.fillRect(-hw * 0.45, -hh, pw * 0.45, 3.5); // Top
      ctx.fillRect(-hw * 0.45, hh - 3.5, pw * 0.45, 3.5); // Bottom
      ctx.fillRect(-hw, -hh * 0.4, 4, ph * 0.4); // Left
      ctx.fillRect(hw - 4, -hh * 0.4, 4, ph * 0.4); // Right

      // High-Gain Telemetry Dish in Center
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(hw, hh) * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Yellow EVA Grab Rails
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-hw + 6, -hh + 5);
      ctx.lineTo(-hw + 6, hh - 5);
      ctx.moveTo(hw - 6, -hh + 5);
      ctx.lineTo(hw - 6, hh - 5);
      ctx.stroke();

    } else if (id.includes('hab')) {
      // TransHab Cylindrical Living Quarters
      const habGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      habGrad.addColorStop(0, '#94a3b8');
      habGrad.addColorStop(0.2, '#e2e8f0');
      habGrad.addColorStop(0.5, '#ffffff');
      habGrad.addColorStop(0.8, '#e2e8f0');
      habGrad.addColorStop(1, '#64748b');

      ctx.fillStyle = habGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 6);
      ctx.fill();
      ctx.stroke();

      // Blue Agency Stripe
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-hw, -hh * 0.25, pw, ph * 0.5);

      // Observation Porthole Windows (Dual-pane sapphire)
      const numPorts = 3;
      for (let p = 0; p < numPorts; p++) {
        const py = -hh * 0.6 + (p / (numPorts - 1)) * (hh * 1.2);
        // Bezel
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(0, py, 6.5, 0, Math.PI * 2);
        ctx.fill();
        // Glass
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, py, 4.5, 0, Math.PI * 2);
        ctx.fill();
        // Highlight reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.beginPath();
        ctx.arc(-1.5, py - 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Yellow EVA Translation Rails
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-hw + 4, -hh + 6);
      ctx.lineTo(-hw + 4, hh - 6);
      ctx.moveTo(hw - 4, -hh + 6);
      ctx.lineTo(hw - 4, hh - 6);
      ctx.stroke();

    } else if (id.includes('lab')) {
      // Destiny Science Laboratory
      const labGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      labGrad.addColorStop(0, '#475569');
      labGrad.addColorStop(0.2, '#cbd5e1');
      labGrad.addColorStop(0.5, '#f1f5f9');
      labGrad.addColorStop(0.8, '#cbd5e1');
      labGrad.addColorStop(1, '#334155');

      ctx.fillStyle = labGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // Science Purple Decal Banner
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(-hw, -hh * 0.8, pw, 5);
      ctx.fillRect(-hw, hh * 0.8 - 5, pw, 5);

      // External Experiment Palette / Microgravity Bay
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-hw * 0.65, -hh * 0.35, pw * 0.65, ph * 0.7);

      // High-precision optical observation glass
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(-hw * 0.3, -hh * 0.2, pw * 0.3, ph * 0.4);

    } else if (id.includes('cupola')) {
      // 7-Window Geodesic Observation Cupola
      const baseGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      baseGrad.addColorStop(0, '#1e293b');
      baseGrad.addColorStop(0.5, '#475569');
      baseGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = baseGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.95, hh);
      ctx.lineTo(-hw * 0.65, -hh);
      ctx.lineTo(hw * 0.65, -hh);
      ctx.lineTo(hw * 0.95, hh);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Central circular Earth-viewing window
      ctx.fillStyle = '#0284c7';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -hh * 0.2, Math.min(hw, hh) * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Specular reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(-2, -hh * 0.2 - 2, Math.min(hw, hh) * 0.18, 0, Math.PI * 2);
      ctx.fill();

    } else if (id.includes('truss')) {
      // Open-Lattice Structural Truss Girder
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.0;
      ctx.strokeRect(-hw, -hh, pw, ph);

      // Lattice X-Braces
      const bays = 4;
      const bayW = pw / bays;
      for (let b = 0; b < bays; b++) {
        const x1 = -hw + b * bayW;
        const x2 = x1 + bayW;
        ctx.beginPath();
        ctx.moveTo(x1, -hh);
        ctx.lineTo(x2, hh);
        ctx.moveTo(x2, -hh);
        ctx.lineTo(x1, hh);
        ctx.stroke();
      }

      // Utility Conduit Race (Power & Data)
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-hw, -2, pw, 4);

    } else if (id.includes('solar')) {
      // Massive Deployable Dual Solar Array Truss
      ctx.fillStyle = '#334155';
      ctx.fillRect(-4, -hh, 8, ph); // Central SARJ Gimbal Mast

      // Dual Solar Blankets (Left & Right)
      const wingW = hw - 6;
      [-1, 1].forEach((dir) => {
        const startX = dir === 1 ? 5 : -5 - wingW;
        ctx.fillStyle = '#1e3a8a';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.4;
        ctx.fillRect(startX, -hh + 3, wingW, ph - 6);
        ctx.strokeRect(startX, -hh + 3, wingW, ph - 6);

        // Photovoltaic cell grid lines
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.lineWidth = 0.8;
        const cells = 5;
        for (let c = 1; c < cells; c++) {
          const cx = startX + (c / cells) * wingW;
          ctx.beginPath();
          ctx.moveTo(cx, -hh + 3);
          ctx.lineTo(cx, hh - 3);
          ctx.stroke();
        }
      });

    } else if (id.includes('radiator')) {
      // Ammonia Heat Rejection Radiator Panels
      ctx.fillStyle = '#e2e8f0';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.fillRect(-hw, -hh + 2, pw, ph - 4);
      ctx.strokeRect(-hw, -hh + 2, pw, ph - 4);

      // Accordion Pleat Grooves
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.35)';
      ctx.lineWidth = 1.2;
      for (let x = -hw + 4; x < hw; x += 6) {
        ctx.beginPath();
        ctx.moveTo(x, -hh + 2);
        ctx.lineTo(x, hh - 2);
        ctx.stroke();
      }

      // Central Ammonia Coolant Loop Tube
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-hw, 0);
      ctx.lineTo(hw, 0);
      ctx.stroke();

    } else if (id.includes('airlock')) {
      // Quest EVA Airlock
      const airlockGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      airlockGrad.addColorStop(0, '#475569');
      airlockGrad.addColorStop(0.3, '#cbd5e1');
      airlockGrad.addColorStop(0.5, '#f8fafc');
      airlockGrad.addColorStop(0.7, '#cbd5e1');
      airlockGrad.addColorStop(1, '#334155');

      ctx.fillStyle = airlockGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 4);
      ctx.fill();
      ctx.stroke();

      // Outer EVA Hatch Ring
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(hw, hh) * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Locking Dog Handwheel
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // Standard APAS Docking Port or generic station module
      const ringGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
      ringGrad.addColorStop(0, '#475569');
      ringGrad.addColorStop(0.5, '#cbd5e1');
      ringGrad.addColorStop(1, '#334155');

      ctx.fillStyle = ringGrad;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-hw, -hh, pw, ph, 3);
      ctx.fill();
      ctx.stroke();

      // APAS Guide Petals
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.6, -hh);
      ctx.lineTo(-hw * 0.3, -hh - 4);
      ctx.lineTo(-hw * 0.1, -hh);
      ctx.fill();
      ctx.moveTo(hw * 0.1, -hh);
      ctx.lineTo(hw * 0.3, -hh - 4);
      ctx.lineTo(hw * 0.6, -hh);
      ctx.fill();

      // Green alignment crosshair
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(4, 0);
      ctx.moveTo(0, -3);
      ctx.lineTo(0, 3);
      ctx.stroke();
    }
  }

  // =========================================================================
  // SELECTION & HOVER HIGHLIGHTS
  // =========================================================================
  if (isSelected) {
    if (isFlight) {
      // Sleek aerospace cyan selection outline in flight
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.strokeRect(-hw - 2, -hh - 2, pw + 4, ph + 4);
    } else {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-hw - 4, -hh - 4, pw + 8, ph + 8);

      // Corner brackets
      const bLen = Math.min(10, Math.min(pw, ph) * 0.4);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 3;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(-hw - 6, -hh - 6 + bLen);
      ctx.lineTo(-hw - 6, -hh - 6);
      ctx.lineTo(-hw - 6 + bLen, -hh - 6);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(hw + 6 - bLen, -hh - 6);
      ctx.lineTo(hw + 6, -hh - 6);
      ctx.lineTo(hw + 6, -hh - 6 + bLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(-hw - 6, hh + 6 - bLen);
      ctx.lineTo(-hw - 6, hh + 6);
      ctx.lineTo(-hw - 6 + bLen, hh + 6);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(hw + 6 - bLen, hh + 6);
      ctx.lineTo(hw + 6, hh + 6);
      ctx.lineTo(hw + 6, hh + 6 - bLen);
      ctx.stroke();
    }
  } else if (isHovered) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-hw - 2, -hh - 2, pw + 4, ph + 4);
  }

  // Snap Points (Visible when placing / selecting)
  if (showSnapPoints && def.snapPoints) {
    def.snapPoints.forEach((sp) => {
      // Map normalized snap point to pixel coordinates
      const sx = (sp.x / (def.width / 2)) * hw;
      const sy = -(sp.y / (def.height / 2)) * hh;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }
  } finally {
    ctx.restore();
  }
}

/**
 * Dedicated Interstage Protective Shroud Renderer.
 * Draws an aerodynamic fairing covering and protecting the rocket engine
 * of the next stage above an unactivated decoupler.
 * When the decoupler activates, the shroud is discarded, revealing the upper engine.
 */
export function drawInterstageShroudDirect(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  decouplerTopY: number,
  pw: number,
  sh: number,
  isSelected: boolean = false,
  isHovered: boolean = false,
  isFlight: boolean = false
) {
  if (sh <= 0 || pw <= 0) return;
  const hw = pw / 2;
  const sTop = decouplerTopY - sh;

  ctx.save();
  ctx.translate(centerX, 0);

  if (!isFlight) {
    // In builder mode, keep shroud translucent so underlying engines, nozzles, and joints are crystal clear
    ctx.globalAlpha = isSelected || isHovered ? 0.35 : 0.22;
  } else if (isSelected || isHovered) {
    ctx.globalAlpha = 0.7;
  } else {
    ctx.globalAlpha = 0.98;
  }

  // Realistic aerospace brushed aluminium / titanium panel gradient
  const shroudGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
  shroudGrad.addColorStop(0, '#1e293b');
  shroudGrad.addColorStop(0.18, '#334155');
  shroudGrad.addColorStop(0.5, '#e2e8f0');
  shroudGrad.addColorStop(0.82, '#334155');
  shroudGrad.addColorStop(1, '#0f172a');

  ctx.fillStyle = shroudGrad;
  ctx.strokeStyle = isSelected ? '#38bdf8' : '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.fillRect(-hw, sTop, pw, sh);
  ctx.strokeRect(-hw, sTop, pw, sh);

  // Top interstage collar with hazard warning blocks
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-hw, sTop, pw, Math.min(5, sh * 0.15));
  ctx.fillStyle = '#0f172a';
  for (let bx = -hw + 4; bx < hw - 4; bx += 9) {
    ctx.fillRect(bx, sTop, 3.5, Math.min(5, sh * 0.15));
  }

  // Ring stiffeners & panel separation rivets
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.5)';
  ctx.lineWidth = 1;
  const ribs = Math.max(2, Math.floor(sh / 20));
  for (let r = 1; r <= ribs; r++) {
    const ry = sTop + (sh / (ribs + 1)) * r;
    ctx.beginPath();
    ctx.moveTo(-hw, ry);
    ctx.lineTo(hw, ry);
    ctx.stroke();
  }

  // Explosive separation seam
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, sTop);
  ctx.lineTo(0, decouplerTopY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Technical markings
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${Math.max(8, Math.min(11, pw * 0.09))}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('PROTECTIVE INTERSTAGE', 0, sTop + sh / 2);

  // Umbilical port
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(hw * 0.65, sTop + sh * 0.75, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(hw * 0.65, sTop + sh * 0.75, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Procedural Supersonic Plume Renderer with Altitude Expansion (Video 1)
 * Altitude scales from 0.0 km (Sea level narrow shock diamonds) to 75.0 km (Massive vacuum blossom)
 */
export function drawJunoEnginePlume2D(
  ctx: CanvasRenderingContext2D,
  config: JunoEngineConfig,
  throttle: number,
  exitX: number,
  exitY: number,
  exitW: number,
  altitudeKm: number = 0,
  gimbalAngle: number = 0,
  timeSec: number = 0,
  exitPressureKPa?: number,
  ignitionAgeSec: number = 999
) {
  if (throttle <= 0.01) return;

  const isSolid = config.engineType === 'Solid';
  const isNuclear = config.engineType === 'Nuclear Thermal';
  const isAerospike = config.nozzleStyle === 'Aerospike';
  const clampedAlt = Math.max(0, Math.min(80, altitudeKm));

  // Resolved Power Cycle
  const powerCycle: EnginePowerCycle = config.powerCycle || (isSolid ? 'Booster' : 'Gas Generator II');
  
  // Real Atmospheric Gas Dynamics:
  const pAtm = 101.325 * Math.exp(-clampedAlt / 7.2);
  const pe = exitPressureKPa !== undefined && exitPressureKPa > 0 ? exitPressureKPa : 45.0;
  const pr = pe / Math.max(0.001, pAtm); // Pressure ratio Pe / Pamb
  const vacFrac = Math.max(0, Math.min(1, clampedAlt / 65)); // 0 = sea level, 1 = vacuum

  // Summerfield separation criterion (flow separates from nozzle wall if Pe/Pamb < 0.35)
  const isSeparated = !isAerospike && pr < 0.35;
  const isOverexpanded = !isAerospike && pr < 0.9;
  const isUnderexpanded = pr > 1.25 || vacFrac > 0.25;

  // Supersonic Prandtl-Meyer expansion factor:
  const baseExpansionFactor = isAerospike 
    ? 1.0 + vacFrac * 0.75 
    : isSeparated
    ? 0.72 + Math.sin(timeSec * 32) * 0.04
    : 1.0 + Math.pow(vacFrac, 1.2) * 2.5;

  // Power-cycle-specific plume scale multipliers
  let cycleLenMult = 1.0;
  let cycleWidthMult = 1.0;

  switch (powerCycle) {
    case 'Pressure-Fed':
      // Low Pc (~1,500 kPa): slower exhaust velocity, wide bulbous parabolic expansion
      cycleLenMult = 0.72;
      cycleWidthMult = 1.28;
      break;
    case 'Electric':
      // High-frequency electric pump: laser-straight collimated cylinder, tight supersonic profile
      cycleLenMult = 0.96;
      cycleWidthMult = 0.88;
      break;
    case 'Gas Generator I':
      // Open cycle with separate turbopump exhaust dump pipe
      cycleLenMult = 1.0;
      cycleWidthMult = 1.02;
      break;
    case 'Gas Generator II':
      // Open cycle with nozzle film cooling dump curtain
      cycleLenMult = 1.04;
      cycleWidthMult = 1.06;
      break;
    case 'Staged':
      // High chamber pressure (~18,000 kPa): dense, rigid, elongated supersonic spear
      cycleLenMult = 1.22;
      cycleWidthMult = 0.92;
      break;
    case 'Full Flow Staged':
      // Extreme chamber pressure (>25,000 kPa): longest, most hyper-energized supersonic shock train
      cycleLenMult = 1.36;
      cycleWidthMult = 0.95;
      break;
    case 'Expander':
      // High Isp cryogenic expander: ethereal translucent vacuum expansion
      cycleLenMult = 0.88;
      cycleWidthMult = 1.22;
      break;
    case 'Booster':
      // Solid rocket motor: violent jagged turbulent fireball with dense aluminum oxide particulates
      cycleLenMult = 1.15;
      cycleWidthMult = 1.30;
      break;
    case 'Amateur':
      // Low grade solid motor: erratic, sputtering, shorter fluctuating plume
      cycleLenMult = 0.65 + Math.sin(timeSec * 48) * 0.12;
      cycleWidthMult = 1.15;
      break;
  }

  const plumeLength = Math.max(24, exitW * (2.8 + throttle * 4.4) * (1.0 + vacFrac * 0.35) * cycleLenMult);
  const basePlumeWidth = exitW * (0.85 + throttle * 0.4) * cycleWidthMult;
  const blossomedWidth = basePlumeWidth * baseExpansionFactor;

  // Authentic Propellant & Cycle Chemiluminescence Colors
  let coreColor = '255, 255, 255';
  let midColor = '249, 115, 22';
  let outerColor = '234, 88, 12';
  let flameAlpha = 0.70 + throttle * 0.28;

  if (config.liquidFuel === 'Hydrolox' || (isNuclear && config.nuclearFuel === 'Liquid Hydrogen')) {
    midColor = powerCycle === 'Expander' ? '103, 232, 249' : '56, 189, 248';
    outerColor = powerCycle === 'Expander' ? '168, 85, 247' : '2, 132, 199';
    flameAlpha = powerCycle === 'Expander' ? 0.45 + throttle * 0.25 : 0.54 + throttle * 0.28;
  } else if (config.liquidFuel === 'Methalox') {
    if (powerCycle === 'Full Flow Staged') {
      // Raptor FFSC: vivid amethyst/violet C2 Swan band radicals with sapphire-white core
      midColor = '168, 85, 247';
      outerColor = '126, 34, 206';
      coreColor = '224, 242, 254';
      flameAlpha = 0.75 + throttle * 0.25;
    } else {
      midColor = '192, 132, 252';
      outerColor = '147, 51, 234';
      flameAlpha = 0.65 + throttle * 0.30;
    }
  } else if (isSolid) {
    if (powerCycle === 'Amateur') {
      midColor = '245, 158, 11';
      outerColor = '180, 83, 9';
      flameAlpha = 0.78;
    } else {
      // Booster SRB
      midColor = '251, 191, 36';
      outerColor = '217, 119, 6';
      flameAlpha = 0.90;
    }
  } else if (powerCycle === 'Electric') {
    // Electric pump: pristine, crisp cyan-white with electric ionization rim
    midColor = '56, 189, 248';
    outerColor = '14, 116, 144';
    coreColor = '240, 249, 255';
    flameAlpha = 0.68 + throttle * 0.28;
  } else if (powerCycle === 'Pressure-Fed') {
    // Soft warm amber-red with diffuse gradients
    midColor = '251, 146, 60';
    outerColor = '220, 38, 38';
    flameAlpha = 0.60 + throttle * 0.25;
  } else if (powerCycle === 'Staged') {
    // Staged combustion: incandescent brilliant solar white with razor-sharp flame sheath
    midColor = '253, 186, 116';
    outerColor = '234, 88, 12';
    coreColor = '255, 255, 255';
    flameAlpha = 0.82 + throttle * 0.18;
  } else if (config.engineType === 'Monopropellant') {
    midColor = '226, 232, 240';
    outerColor = '148, 163, 184';
    flameAlpha = 0.48;
  }

  ctx.save();
  ctx.translate(exitX, exitY);
  if (gimbalAngle !== 0 && !isSolid) {
    ctx.rotate(gimbalAngle);
  }

  // Flow separation high-frequency side-load turbulence
  if (isSeparated) {
    const flutterAngle = Math.sin(timeSec * 50) * 0.035 * throttle;
    ctx.rotate(flutterAngle);
  }

  // =========================================================================
  // POWER CYCLE IGNITION FLAME & TRANSIENT BURSTS (ignitionAgeSec < 0.8s)
  // =========================================================================
  const isIgniting = ignitionAgeSec >= 0 && ignitionAgeSec < 0.8;
  const ignProg = Math.max(0, Math.min(1, ignitionAgeSec / 0.8));

  if (isIgniting) {
    const ignIntensity = (1.0 - ignProg);

    if (powerCycle === 'Gas Generator I') {
      // --- GAS GENERATOR I: DRAMATIC TEA-TEB PYROPHORIC EMERALD GREEN IGNITION FLASH ---
      // Pyrophoric triethylaluminum-triethylborane reacts violently on contact with LOX
      const teaTebGrad = ctx.createRadialGradient(0, plumeLength * 0.25, 0, 0, plumeLength * 0.3, exitW * 2.6 * ignIntensity);
      teaTebGrad.addColorStop(0, `rgba(255, 255, 255, ${ignIntensity * 0.95})`);
      teaTebGrad.addColorStop(0.2, `rgba(52, 211, 153, ${ignIntensity * 0.92})`); // Vivid emerald green
      teaTebGrad.addColorStop(0.55, `rgba(16, 185, 129, ${ignIntensity * 0.75})`);
      teaTebGrad.addColorStop(0.85, `rgba(5, 150, 105, ${ignIntensity * 0.40})`);
      teaTebGrad.addColorStop(1, 'rgba(4, 120, 87, 0)');

      ctx.fillStyle = teaTebGrad;
      ctx.beginPath();
      ctx.ellipse(0, plumeLength * 0.25, exitW * 2.4 * ignIntensity, plumeLength * 0.5 * ignIntensity, 0, 0, Math.PI * 2);
      ctx.fill();

      // Green pyrophoric ignition droplets bursting outward
      ctx.fillStyle = `rgba(110, 231, 183, ${ignIntensity * 0.9})`;
      for (let p = 0; p < 8; p++) {
        const pAngle = (p * Math.PI) / 4 + timeSec * 12;
        const pDist = exitW * (0.8 + Math.sin(p * 37) * 0.4) * ignIntensity;
        ctx.beginPath();
        ctx.arc(Math.cos(pAngle) * pDist, plumeLength * 0.2 + Math.sin(pAngle) * pDist * 0.6, 2.0 * ignIntensity, 0, Math.PI * 2);
        ctx.fill();
      }

      // Initial dense black turbopump puff on the side dump
      const sideDumpX = -exitW * 0.65;
      ctx.fillStyle = `rgba(15, 23, 42, ${ignIntensity * 0.85})`;
      ctx.beginPath();
      ctx.arc(sideDumpX - 6, plumeLength * 0.35 * ignIntensity, 14 * ignIntensity, 0, Math.PI * 2);
      ctx.fill();
    } else if (powerCycle === 'Electric') {
      // --- ELECTRIC: HIGH-VOLTAGE ELECTRIC IONIZATION ARC SPARK CRACKLE ---
      // Inverter spin-up with zero soot; high-voltage capacitive ignition arc
      ctx.strokeStyle = `rgba(56, 189, 248, ${ignIntensity * 0.95})`;
      ctx.lineWidth = 1.8;
      for (let a = 0; a < 5; a++) {
        ctx.beginPath();
        const startX = (Math.random() - 0.5) * exitW * 0.8;
        ctx.moveTo(startX, 0);
        const midArcX = startX + (Math.random() - 0.5) * 16;
        const midArcY = plumeLength * 0.15 * Math.random();
        const endArcX = (Math.random() - 0.5) * exitW * 0.6;
        const endArcY = plumeLength * 0.32 * Math.random();
        ctx.lineTo(midArcX, midArcY);
        ctx.lineTo(endArcX, endArcY);
        ctx.stroke();
      }

      // Blue-white injector face ionization flare
      ctx.fillStyle = `rgba(224, 242, 254, ${ignIntensity * 0.9})`;
      ctx.beginPath();
      ctx.arc(0, 4, exitW * 0.85 * ignIntensity, 0, Math.PI * 2);
      ctx.fill();
    } else if (powerCycle === 'Full Flow Staged') {
      // --- FULL FLOW STAGED: DUAL-TORCH PREBURNER SHOCK DETONATION SNAP ---
      // Fuel-rich (violet) and Oxidizer-rich (emerald/sapphire) dual ignition torches
      ctx.strokeStyle = `rgba(168, 85, 247, ${ignIntensity * 0.9})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-exitW * 0.45, -2);
      ctx.lineTo(0, plumeLength * 0.4);
      ctx.stroke();

      ctx.strokeStyle = `rgba(56, 189, 248, ${ignIntensity * 0.9})`;
      ctx.beginPath();
      ctx.moveTo(exitW * 0.45, -2);
      ctx.lineTo(0, plumeLength * 0.4);
      ctx.stroke();

      // Sudden supersonic shock concussion ring
      ctx.strokeStyle = `rgba(255, 255, 255, ${ignIntensity * 0.85})`;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(0, plumeLength * 0.4, exitW * 1.8 * (1.1 - ignProg), 6 * (1.1 - ignProg), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (powerCycle === 'Staged') {
      // --- STAGED: HIGH-VELOCITY PREBURNER TORCH IGNITION NEEDLE ---
      const needleGrad = ctx.createLinearGradient(0, 0, 0, plumeLength * 0.6);
      needleGrad.addColorStop(0, '#ffffff');
      needleGrad.addColorStop(0.3, `rgba(254, 215, 170, ${ignIntensity})`);
      needleGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');
      ctx.fillStyle = needleGrad;
      ctx.beginPath();
      ctx.moveTo(-exitW * 0.25, 0);
      ctx.lineTo(0, plumeLength * 0.65 * (1 + ignIntensity * 0.4));
      ctx.lineTo(exitW * 0.25, 0);
      ctx.closePath();
      ctx.fill();
    } else if (powerCycle === 'Booster') {
      // --- BOOSTER: EXPLOSIVE PYROTECHNIC IGNITER OVERPRESSURE BLAST WAVE ---
      const blastGrad = ctx.createRadialGradient(0, plumeLength * 0.2, 0, 0, plumeLength * 0.25, exitW * 2.8 * ignIntensity);
      blastGrad.addColorStop(0, `rgba(255, 255, 255, ${ignIntensity})`);
      blastGrad.addColorStop(0.25, `rgba(254, 240, 138, ${ignIntensity * 0.9})`);
      blastGrad.addColorStop(0.6, `rgba(249, 115, 22, ${ignIntensity * 0.75})`);
      blastGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = blastGrad;
      ctx.beginPath();
      ctx.arc(0, plumeLength * 0.25, exitW * 2.8 * ignIntensity, 0, Math.PI * 2);
      ctx.fill();
    } else if (powerCycle === 'Amateur') {
      // --- AMATEUR: SPUTTERING BLACK POWDER FUSE PUFF & ERRATIC SPARKS ---
      ctx.fillStyle = `rgba(51, 65, 85, ${ignIntensity * 0.75})`;
      ctx.beginPath();
      ctx.arc((Math.random() - 0.5) * 8, plumeLength * 0.2, 16 * ignIntensity, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // =========================================================================
  // 1. OUTER DIFFUSE EXPANSION ENVELOPE (Tailored by Power Cycle Geometry)
  // =========================================================================
  const outerGrad = ctx.createRadialGradient(
    0, 
    plumeLength * 0.45, 
    basePlumeWidth * 0.22, 
    0, 
    plumeLength * 0.52, 
    blossomedWidth * 1.35
  );
  outerGrad.addColorStop(0, `rgba(${midColor}, ${flameAlpha * 0.46})`);
  outerGrad.addColorStop(0.48, `rgba(${outerColor}, ${flameAlpha * 0.22})`);
  outerGrad.addColorStop(1, `rgba(${outerColor}, 0)`);

  ctx.fillStyle = outerGrad;
  ctx.beginPath();

  if (powerCycle === 'Pressure-Fed') {
    // Parabolic rounded expansion (low exit Mach, gentle bulbous curve)
    ctx.moveTo(-basePlumeWidth, 0);
    ctx.quadraticCurveTo(-blossomedWidth * 1.2, plumeLength * 0.42, 0, plumeLength);
    ctx.quadraticCurveTo(blossomedWidth * 1.2, plumeLength * 0.42, basePlumeWidth, 0);
  } else if (powerCycle === 'Electric') {
    // Collimated cylindrical beam with straight supersonic boundaries
    ctx.moveTo(-basePlumeWidth * 0.92, 0);
    ctx.lineTo(-blossomedWidth * 0.88, plumeLength * 0.75);
    ctx.lineTo(0, plumeLength);
    ctx.lineTo(blossomedWidth * 0.88, plumeLength * 0.75);
    ctx.lineTo(basePlumeWidth * 0.92, 0);
  } else if (powerCycle === 'Expander') {
    // Ethereal translucent bell
    ctx.moveTo(-basePlumeWidth, 0);
    ctx.quadraticCurveTo(-blossomedWidth * 1.15, plumeLength * 0.5, 0, plumeLength);
    ctx.quadraticCurveTo(blossomedWidth * 1.15, plumeLength * 0.5, basePlumeWidth, 0);
  } else if (powerCycle === 'Booster' || powerCycle === 'Amateur') {
    // Jagged, turbulent serrated flame envelope
    const flutter = Math.sin(timeSec * 40) * basePlumeWidth * 0.08;
    ctx.moveTo(-basePlumeWidth, 0);
    ctx.lineTo(-blossomedWidth * 0.95 + flutter, plumeLength * 0.35);
    ctx.lineTo(-blossomedWidth * 0.7 - flutter, plumeLength * 0.7);
    ctx.lineTo(0, plumeLength);
    ctx.lineTo(blossomedWidth * 0.7 + flutter, plumeLength * 0.7);
    ctx.lineTo(blossomedWidth * 0.95 - flutter, plumeLength * 0.35);
    ctx.lineTo(basePlumeWidth, 0);
  } else if (isSeparated) {
    // Pinched neck at detachment line, followed by turbulent eddy spread
    const neckY = plumeLength * 0.25;
    const neckW = basePlumeWidth * 0.65;
    ctx.moveTo(-basePlumeWidth * 0.85, 0);
    ctx.quadraticCurveTo(-neckW, neckY * 0.6, -neckW, neckY);
    ctx.quadraticCurveTo(-blossomedWidth * 0.8, plumeLength * 0.6, -blossomedWidth * 0.35, plumeLength);
    ctx.lineTo(blossomedWidth * 0.35, plumeLength);
    ctx.quadraticCurveTo(blossomedWidth * 0.8, plumeLength * 0.6, neckW, neckY);
    ctx.quadraticCurveTo(neckW, neckY * 0.6, basePlumeWidth * 0.85, 0);
  } else {
    // Standard Staged / Gas Generator supersonic profile
    ctx.moveTo(-basePlumeWidth, 0);
    ctx.quadraticCurveTo(-blossomedWidth, plumeLength * 0.48, -blossomedWidth * 0.38, plumeLength);
    ctx.lineTo(blossomedWidth * 0.38, plumeLength);
    ctx.quadraticCurveTo(blossomedWidth, plumeLength * 0.48, basePlumeWidth, 0);
  }
  ctx.closePath();
  ctx.fill();

  // =========================================================================
  // 2. HIGH-TEMPERATURE SUPERSONIC COMBUSTION CORE
  // =========================================================================
  const coreGrad = ctx.createLinearGradient(0, 0, 0, plumeLength * 0.88);
  coreGrad.addColorStop(0, `rgba(${coreColor}, ${flameAlpha})`);
  coreGrad.addColorStop(0.18, `rgba(${midColor}, ${flameAlpha * 0.92})`);
  coreGrad.addColorStop(0.68, `rgba(${outerColor}, ${flameAlpha * 0.38})`);
  coreGrad.addColorStop(1, `rgba(${outerColor}, 0)`);

  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  if (isAerospike) {
    ctx.moveTo(-basePlumeWidth, 0);
    ctx.lineTo(-basePlumeWidth * 0.38, plumeLength * 0.58);
    ctx.lineTo(0, plumeLength * 0.88);
    ctx.lineTo(basePlumeWidth * 0.38, plumeLength * 0.58);
    ctx.lineTo(basePlumeWidth, 0);
  } else if (powerCycle === 'Electric') {
    // High-frequency ripple on straight supersonic jet
    const ripple = Math.sin(timeSec * 90) * 1.2;
    ctx.moveTo(-basePlumeWidth * 0.55 + ripple, 0);
    ctx.lineTo(-basePlumeWidth * 0.45 - ripple, plumeLength * 0.7);
    ctx.lineTo(0, plumeLength * 0.92);
    ctx.lineTo(basePlumeWidth * 0.45 + ripple, plumeLength * 0.7);
    ctx.lineTo(basePlumeWidth * 0.55 - ripple, 0);
  } else if (powerCycle === 'Staged' || powerCycle === 'Full Flow Staged') {
    // Ultra-sharp supersonic spear
    ctx.moveTo(-basePlumeWidth * 0.65, 0);
    ctx.lineTo(-basePlumeWidth * 0.42, plumeLength * 0.48);
    ctx.lineTo(0, plumeLength * 0.94);
    ctx.lineTo(basePlumeWidth * 0.42, plumeLength * 0.48);
    ctx.lineTo(basePlumeWidth * 0.65, 0);
  } else if (isSeparated) {
    const neckY = plumeLength * 0.22;
    const neckW = basePlumeWidth * 0.5;
    ctx.moveTo(-basePlumeWidth * 0.65, 0);
    ctx.quadraticCurveTo(-neckW, neckY * 0.5, -neckW, neckY);
    ctx.quadraticCurveTo(-basePlumeWidth * 0.6, plumeLength * 0.5, 0, plumeLength * 0.82);
    ctx.quadraticCurveTo(basePlumeWidth * 0.6, plumeLength * 0.5, neckW, neckY);
    ctx.quadraticCurveTo(neckW, neckY * 0.5, basePlumeWidth * 0.65, 0);
  } else {
    ctx.moveTo(-basePlumeWidth * 0.72, 0);
    ctx.quadraticCurveTo(-basePlumeWidth * 0.85, plumeLength * 0.42, 0, plumeLength * 0.86);
    ctx.quadraticCurveTo(basePlumeWidth * 0.85, plumeLength * 0.42, basePlumeWidth * 0.72, 0);
  }
  ctx.closePath();
  ctx.fill();

  // Pure white incandescent central spear tip for Staged / Full Flow
  if ((powerCycle === 'Staged' || powerCycle === 'Full Flow Staged') && throttle > 0.2) {
    ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * throttle})`;
    ctx.beginPath();
    ctx.moveTo(-basePlumeWidth * 0.25, 0);
    ctx.lineTo(0, plumeLength * 0.52);
    ctx.lineTo(basePlumeWidth * 0.25, 0);
    ctx.closePath();
    ctx.fill();
  }

  // =========================================================================
  // 3. POWER-CYCLE SPECIFIC AUXILIARY EXHAUSTS & BOUNDARY LAYERS
  // =========================================================================

  // --- A. GAS GENERATOR I: ASYMMETRIC TURBOPUMP EXHAUST DUMP PIPE ---
  // A dedicated auxiliary duct mounted alongside nozzle pouring dark soot & burning gas
  if (powerCycle === 'Gas Generator I' && !isSolid) {
    const dumpX = -exitW * 0.68;
    const dumpW = exitW * 0.28;
    const dumpLen = plumeLength * 0.68;
    const dumpCurl = Math.sin(timeSec * 16) * 6;

    // Turbopump metallic exhaust duct nozzle tip
    ctx.fillStyle = '#334155';
    ctx.fillRect(dumpX - dumpW * 0.4, -4, dumpW * 0.8, 5);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.strokeRect(dumpX - dumpW * 0.4, -4, dumpW * 0.8, 5);

    // Billowing dark soot turbopump stream with fuel-rich orange core
    const dumpGrad = ctx.createLinearGradient(dumpX, 0, dumpX + dumpCurl, dumpLen);
    dumpGrad.addColorStop(0, 'rgba(249, 115, 22, 0.9)'); // Hot gas entering
    dumpGrad.addColorStop(0.2, 'rgba(234, 88, 12, 0.75)');
    dumpGrad.addColorStop(0.5, 'rgba(30, 41, 59, 0.82)'); // Oily unburned carbon soot
    dumpGrad.addColorStop(0.85, 'rgba(15, 23, 42, 0.55)');
    dumpGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');

    ctx.fillStyle = dumpGrad;
    ctx.beginPath();
    ctx.moveTo(dumpX - dumpW * 0.4, 1);
    ctx.quadraticCurveTo(dumpX - dumpW * 0.9 + dumpCurl, dumpLen * 0.5, dumpX - dumpW * 0.6 + dumpCurl, dumpLen);
    ctx.quadraticCurveTo(dumpX + dumpW * 0.4 + dumpCurl, dumpLen * 0.6, dumpX + dumpW * 0.4, 1);
    ctx.closePath();
    ctx.fill();
  }

  // --- B. GAS GENERATOR II: ANNULAR FILM-COOLING NOZZLE SKIRT CURTAIN ---
  // Turbine exhaust is dumped into the lower nozzle rim to cool the nozzle skirt
  if (powerCycle === 'Gas Generator II' && !isSolid) {
    const curtainW = basePlumeWidth * 1.14;
    const curtainLen = plumeLength * 0.82;
    const curtainGrad = ctx.createLinearGradient(0, 0, 0, curtainLen);
    curtainGrad.addColorStop(0, 'rgba(60, 40, 30, 0.68)');
    curtainGrad.addColorStop(0.4, 'rgba(40, 25, 20, 0.55)');
    curtainGrad.addColorStop(0.8, 'rgba(234, 88, 12, 0.25)');
    curtainGrad.addColorStop(1, 'rgba(30, 20, 15, 0)');

    ctx.fillStyle = curtainGrad;
    ctx.beginPath();
    ctx.moveTo(-curtainW, 0);
    ctx.quadraticCurveTo(-curtainW * 1.15, curtainLen * 0.5, -basePlumeWidth * 0.4, curtainLen);
    ctx.lineTo(basePlumeWidth * 0.4, curtainLen);
    ctx.quadraticCurveTo(curtainW * 1.15, curtainLen * 0.5, curtainW, 0);
    ctx.lineTo(basePlumeWidth * 0.85, 0);
    ctx.quadraticCurveTo(curtainW * 0.8, curtainLen * 0.45, 0, curtainLen * 0.9);
    ctx.quadraticCurveTo(-curtainW * 0.8, curtainLen * 0.45, -basePlumeWidth * 0.85, 0);
    ctx.closePath();
    ctx.fill();
  }

  // --- C. ELECTRIC: INJECTOR FACE CYAN IONIZATION CORONA ---
  if (powerCycle === 'Electric') {
    const coronaGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, exitW * 0.95);
    coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    coronaGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.65)');
    coronaGrad.addColorStop(0.8, 'rgba(6, 182, 212, 0.35)');
    coronaGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, exitW * 0.9, exitW * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- D. EXPANDER: EXPANDING RAREFACTION CONCENTRIC SONIC WAVE RINGS ---
  if (powerCycle === 'Expander') {
    ctx.strokeStyle = 'rgba(165, 243, 252, 0.45)';
    ctx.lineWidth = 1.4;
    for (let r = 1; r <= 3; r++) {
      const ringProgress = ((timeSec * 1.4 + r * 0.33) % 1);
      const ry = plumeLength * 0.15 + plumeLength * 0.6 * ringProgress;
      const rx = basePlumeWidth * (0.35 + ringProgress * 0.85);
      ctx.beginPath();
      ctx.ellipse(0, ry, rx, rx * 0.22, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // =========================================================================
  // 4. SUPERSONIC MACH SHOCK DIAMONDS (Tailored Count, Sharpness & Vibrations)
  // =========================================================================
  const shockVisibility = Math.max(0, 1.0 - vacFrac * 1.35) * Math.min(1.0, throttle * 1.4);

  if (shockVisibility > 0.05 && !isAerospike && powerCycle !== 'Amateur') {
    // Power-cycle-specific shock diamond count & geometry
    let numDiamonds = 3;
    let shockFrequency = 28;
    let diamondColor = '255, 255, 255';

    switch (powerCycle) {
      case 'Full Flow Staged':
        numDiamonds = isSeparated ? 4 : 7; // Extreme Pc creates long 7-diamond train
        shockFrequency = 45;
        diamondColor = config.liquidFuel === 'Methalox' ? '240, 171, 252' : '255, 255, 255';
        break;
      case 'Staged':
        numDiamonds = isSeparated ? 3 : 5;
        shockFrequency = 34;
        diamondColor = '254, 240, 138';
        break;
      case 'Electric':
        numDiamonds = isSeparated ? 2 : 4;
        shockFrequency = 60; // Inverter high-speed hum
        diamondColor = '224, 242, 254';
        break;
      case 'Gas Generator I':
      case 'Gas Generator II':
        numDiamonds = isSeparated ? 2 : 3;
        shockFrequency = 24;
        diamondColor = '254, 215, 170';
        break;
      case 'Pressure-Fed':
        numDiamonds = 1; // Low Pc only forms 1 faint diffuse shock disk
        shockFrequency = 16;
        break;
      case 'Expander':
        numDiamonds = 2;
        shockFrequency = 20;
        diamondColor = '186, 230, 253';
        break;
      case 'Booster':
        numDiamonds = 2;
        shockFrequency = 30;
        diamondColor = '254, 243, 199';
        break;
    }

    const pulseOffset = Math.sin(timeSec * shockFrequency) * 1.4;

    for (let d = 1; d <= numDiamonds; d++) {
      const dy = (plumeLength * 0.58) * (d / (numDiamonds + 0.85)) + (d === 1 ? pulseOffset * 0.5 : pulseOffset);
      const dw = basePlumeWidth * 0.38 * (1.0 - d / (numDiamonds + 2.2));
      const dh = dw * (powerCycle === 'Full Flow Staged' ? 1.4 : 1.25);

      // Diamond outer oblique shock
      ctx.fillStyle = `rgba(${diamondColor}, ${shockVisibility * 0.88})`;
      ctx.beginPath();
      ctx.moveTo(0, dy - dh);
      ctx.lineTo(dw, dy);
      ctx.lineTo(0, dy + dh);
      ctx.lineTo(-dw, dy);
      ctx.closePath();
      ctx.fill();

      // Normal shock disk (Mach Disk) in center
      ctx.strokeStyle = `rgba(255, 255, 255, ${shockVisibility * 0.95})`;
      ctx.lineWidth = powerCycle === 'Full Flow Staged' ? 2.2 : 1.6;
      ctx.beginPath();
      ctx.moveTo(-dw * 0.55, dy);
      ctx.lineTo(dw * 0.55, dy);
      ctx.stroke();

      // Shock reflection core glow
      ctx.fillStyle = `rgba(${midColor}, ${shockVisibility * 0.72})`;
      ctx.beginPath();
      ctx.arc(0, dy, dw * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // =========================================================================
  // 5. SOLID & AMATEUR MOTOR MOLTEN PARTICULATES & SPARKS
  // =========================================================================
  if (isSolid) {
    const isAmateur = powerCycle === 'Amateur';
    ctx.fillStyle = isAmateur ? 'rgba(251, 146, 60, 0.95)' : 'rgba(254, 243, 199, 0.92)';
    const numSparks = isAmateur ? 7 : 14;
    for (let s = 0; s < numSparks; s++) {
      const sparkPhase = (timeSec * (isAmateur ? 6 : 9) + s * 1.37) % 1;
      const sy = plumeLength * (0.18 + sparkPhase * 0.82);
      const spread = Math.sin(s * 91 + timeSec * (isAmateur ? 12 : 6)) * blossomedWidth * (0.2 + sparkPhase * 0.7);
      const sr = isAmateur ? 1.2 + (s % 2) * 0.8 : 1.6 + (s % 3) * 0.9;
      ctx.beginPath();
      ctx.arc(spread, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
