import { PartDefinition } from '../types';
import { RenderPartOptions } from './partRenderer2D';

/**
 * Animated Vector Renderer for Aerospace Rocket & Rover Parts
 * Provides high-fidelity 60fps animations for:
 * - Classic N*M solar arrays (accordion scissor mast unfolding)
 * - Circular solar arrays (UltraFlex 360-degree fan blooming)
 * - Hexagonal solar arrays (JWST articulated beryllium honeycomb petals)
 * - Telescoping hydraulic landing legs & Falcon carbon quad struts
 * - Planetary rover wheels (suspension, steering, rotating chevron cleats)
 * - Fixed-geometry aerodynamic ogive nose cones & slanted booster caps
 */

/**
 * Renders an animated deployable solar panel
 */
export function renderAnimatedSolarPanel(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  options: RenderPartOptions
) {
  const { widthPx: pw, heightPx: ph, isHovered, isSelected } = options;
  const hw = pw / 2;
  const hh = ph / 2;

  // Determine smooth deployment progress (0.0 = folded/stowed, 1.0 = fully deployed)
  const progress = Math.max(
    0,
    Math.min(1, options.deployProgress !== undefined ? options.deployProgress : (options.deployed ? 1.0 : 0.0))
  );

  const solarType = options.solarPanelType || def.solarPanelType || 'classic';

  if (solarType === 'circular') {
    renderCircularSolarArray(ctx, def, hw, hh, pw, ph, progress, options, isHovered, isSelected);
  } else if (solarType === 'hexagonal') {
    renderHexagonalSolarArray(ctx, def, hw, hh, pw, ph, progress, options, isHovered, isSelected);
  } else {
    renderClassicNMArray(ctx, def, hw, hh, pw, ph, progress, options, isHovered, isSelected);
  }
}

/**
 * 1. Classic N*M Array Solar Wing (Accordion Scissor-Mast Unfolding & Outward Extension Boom)
 */
function renderClassicNMArray(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number,
  options: RenderPartOptions,
  isHovered?: boolean,
  isSelected?: boolean
) {
  const M = Math.max(1, options.solarGridM || def.solarGridM || 4); // Rows in M direction
  const N = Math.max(1, options.solarGridN || def.solarGridN || 2); // Columns in N direction
  const boomLengthM = Math.max(0, options.solarBoomLengthM ?? 0);
  const substrateStyle = options.solarPanelStyle || 'Silicon Blue Ultra';

  // Base mounting hinge bracket attached to craft hull - proportional to part scale
  const bracketH = Math.min(8, ph * 0.1);
  const bracketW = pw * 0.45;
  const cornerR = Math.min(2, bracketH * 0.25);
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.min(1.8, Math.max(0.4, pw * 0.04));
  ctx.beginPath();
  ctx.roundRect(-bracketW / 2, hh - bracketH, bracketW, bracketH, cornerR);
  ctx.fill();
  ctx.stroke();

  // Central rotary gimbal / servo motor hub
  const hubRadius = Math.min(4, Math.max(0.6, bracketH * 0.5));
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(0, hh - bracketH * 0.5, hubRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.min(1, Math.max(0.3, hubRadius * 0.3));
  ctx.stroke();

  // Boom extension calculation (distance extending outwards from craft hull)
  // When boomLengthM > 0, boom extends outward by boomPx * progress (or min standoff)
  const boomScalePx = boomLengthM * (ph / Math.max(1.5, def.height || 2.4)) * 0.85;
  const curBoomDist = boomScalePx * (0.08 + 0.92 * progress);
  const startY = hh - bracketH - curBoomDist;

  // Draw Articulated Outward Extension Boom Truss if boomLengthM > 0
  if (boomLengthM > 0 && curBoomDist > 1) {
    const boomStartY = hh - bracketH;
    const boomEndY = startY;
    const railOffset = Math.min(5, Math.max(0.8, pw * 0.08));

    // Dual carbon-fiber boom rails
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.min(2.4, Math.max(0.5, pw * 0.04));
    ctx.beginPath();
    ctx.moveTo(-railOffset, boomStartY);
    ctx.lineTo(-railOffset, boomEndY);
    ctx.moveTo(railOffset, boomStartY);
    ctx.lineTo(railOffset, boomEndY);
    ctx.stroke();

    // Telescopic inner silver hydraulic sleeve
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.min(1.5, Math.max(0.3, pw * 0.03));
    ctx.beginPath();
    ctx.moveTo(0, boomStartY);
    ctx.lineTo(0, boomEndY);
    ctx.stroke();

    // Lattice diagonal cross-bracing along boom
    if (curBoomDist > 10) {
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = Math.min(1, Math.max(0.3, pw * 0.02));
      const bSegments = Math.max(2, Math.floor(curBoomDist / 12));
      const bStep = (boomStartY - boomEndY) / bSegments;
      for (let s = 0; s < bSegments; s++) {
        const by1 = boomStartY - bStep * s;
        const by2 = boomStartY - bStep * (s + 1);
        ctx.beginPath();
        ctx.moveTo(-railOffset, by1);
        ctx.lineTo(railOffset, by2);
        ctx.moveTo(railOffset, by1);
        ctx.lineTo(-railOffset, by2);
        ctx.stroke();

        // Articulation joint knuckle
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(-railOffset, by1, Math.min(1.8, hubRadius * 0.5), 0, Math.PI * 2);
        ctx.arc(railOffset, by1, Math.min(1.8, hubRadius * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Boom top bracket mounting flange
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.min(1.4, Math.max(0.3, pw * 0.03));
    const flangeH = Math.min(4, Math.max(0.6, bracketH * 0.5));
    ctx.beginPath();
    ctx.roundRect(-hw * 0.35, boomEndY - flangeH, pw * 0.35, flangeH, Math.min(1.5, flangeH * 0.3));
    ctx.fill();
    ctx.stroke();
  }

  // Purely proportional dimensions (no arbitrary Math.max pixel clamps that inflate during zoom-out)
  const boxH = ph * 0.26;
  const boxW = pw * 0.85;

  if (progress <= 0.01) {
    // STOWED / FOLDED STATE:
    // Compact launch canister / cassette box with Kapton thermal cover & release latches
    const goldGrad = ctx.createLinearGradient(-boxW / 2, 0, boxW / 2, 0);
    goldGrad.addColorStop(0, '#78350f');
    goldGrad.addColorStop(0.25, '#d97706');
    goldGrad.addColorStop(0.5, '#fbbf24');
    goldGrad.addColorStop(0.75, '#d97706');
    goldGrad.addColorStop(1, '#78350f');

    ctx.fillStyle = goldGrad;
    ctx.strokeStyle = '#291102';
    ctx.lineWidth = Math.min(1.8, Math.max(0.4, pw * 0.04));
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, startY - boxH, boxW, boxH, Math.min(3, boxH * 0.2));
    ctx.fill();
    ctx.stroke();

    // Kapton thermal blanket quilted texture (if large enough)
    if (boxW > 8) {
      ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
      ctx.lineWidth = Math.min(1, Math.max(0.3, pw * 0.02));
      const step = Math.max(3, boxW / 6);
      for (let x = -boxW / 2 + step * 0.5; x < boxW / 2; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, startY - boxH);
        ctx.lineTo(x + step * 0.6, startY);
        ctx.stroke();
      }

      // Pyro release latches & wire spools
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-boxW * 0.35, startY - boxH * 0.5, Math.min(2.5, boxH * 0.2), 0, Math.PI * 2);
      ctx.arc(boxW * 0.35, startY - boxH * 0.5, Math.min(2.5, boxH * 0.2), 0, Math.PI * 2);
      ctx.fill();

      // Cable tension spool
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-boxW * 0.05, startY - boxH * 0.7, boxW * 0.1, boxH * 0.4);
    }
    return;
  }

  // UNFOLDING OR FULLY DEPLOYED STATE:
  // Accordion mast extending outward towards -hh
  const stowedH = ph * 0.26;
  const fullH = Math.max(stowedH, ph * 0.95 - (boomLengthM > 0 ? curBoomDist * 0.5 : 0));
  const curH = stowedH + (fullH - stowedH) * progress;
  const topY = startY - curH;

  // Central extendable carbon-fiber lattice truss mast
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = Math.min(1.8, Math.max(0.4, pw * 0.03));
  ctx.beginPath();
  ctx.moveTo(0, startY);
  ctx.lineTo(0, topY);
  ctx.stroke();

  // Draw scissor truss bracing along central spine
  if (curH > 8) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.7)';
    ctx.lineWidth = Math.min(1, Math.max(0.3, pw * 0.02));
    const trussSteps = Math.max(2, Math.floor(M * 2 * progress));
    const stepH = curH / trussSteps;
    const trussOffset = Math.min(4, Math.max(0.5, pw * 0.05));
    for (let s = 0; s < trussSteps; s++) {
      const y1 = startY - stepH * s;
      const y2 = startY - stepH * (s + 1);
      ctx.beginPath();
      ctx.moveTo(-trussOffset, y1);
      ctx.lineTo(trussOffset, y2);
      ctx.moveTo(trussOffset, y1);
      ctx.lineTo(-trussOffset, y2);
      ctx.stroke();
    }
  }

  // Draw M solar panel segments articulating in accordion motion
  const panelSpanW = pw * (0.45 + 0.55 * Math.min(1.0, progress * 1.3));
  const segH = curH / M;

  // Substrate Color & Texture Configuration
  let borderStroke = '#38bdf8';
  let busbarStroke = '#facc15';
  let gridLineStroke = 'rgba(186, 230, 253, 0.45)';

  for (let m = 0; m < M; m++) {
    const segBottom = startY - segH * m;
    const segTop = segBottom - segH;

    // Accordion perspective scale: when unfolding, panels alternate angles
    const accordionFold = (1 - progress) * (m % 2 === 0 ? 0.35 : -0.35);
    const scaleX = 1.0 - Math.abs(accordionFold) * 0.3;

    // Draw Left and Right panel wings
    const colW = (panelSpanW * 0.48 * scaleX);

    // Photovoltaic Substrate Palette Selection
    let cellGrad = ctx.createLinearGradient(-panelSpanW / 2, 0, panelSpanW / 2, 0);
    if (substrateStyle.includes('GaAs') || substrateStyle.includes('Triple')) {
      // Triple-Junction GaAs: Radiant Iridescent Purple / Deep Obsidian
      cellGrad.addColorStop(0, '#0f0728');
      cellGrad.addColorStop(0.2, '#3b0764');
      cellGrad.addColorStop(0.5, '#581c87');
      cellGrad.addColorStop(0.8, '#3b0764');
      cellGrad.addColorStop(1, '#0f0728');
      borderStroke = '#c084fc';
      busbarStroke = '#fb7185';
      gridLineStroke = 'rgba(233, 213, 255, 0.45)';
    } else if (substrateStyle.includes('Kapton') || substrateStyle.includes('Gold')) {
      // Gold Kapton Flexible: Shimmering Amber-Gold Foil (ROSA style)
      cellGrad.addColorStop(0, '#451a03');
      cellGrad.addColorStop(0.25, '#92400e');
      cellGrad.addColorStop(0.5, '#d97706');
      cellGrad.addColorStop(0.75, '#fbbf24');
      cellGrad.addColorStop(1, '#78350f');
      borderStroke = '#fde047';
      busbarStroke = '#b45309';
      gridLineStroke = 'rgba(254, 240, 138, 0.5)';
    } else if (substrateStyle.includes('Hex') || substrateStyle.includes('Mesh')) {
      // Hex Honeycomb Mesh: Titanium Beryllium with Hex Matrix
      cellGrad.addColorStop(0, '#0f172a');
      cellGrad.addColorStop(0.3, '#1e293b');
      cellGrad.addColorStop(0.5, '#334155');
      cellGrad.addColorStop(0.7, '#1e293b');
      cellGrad.addColorStop(1, '#0f172a');
      borderStroke = '#94a3b8';
      busbarStroke = '#e2e8f0';
      gridLineStroke = 'rgba(203, 213, 225, 0.5)';
    } else {
      // Silicon Blue Ultra: Deep Cosmic Cobalt / Electric Blue
      cellGrad.addColorStop(0, '#020617');
      cellGrad.addColorStop(0.18, '#1e3a8a');
      cellGrad.addColorStop(0.5, '#1d4ed8');
      cellGrad.addColorStop(0.82, '#1e3a8a');
      cellGrad.addColorStop(1, '#020617');
      borderStroke = '#38bdf8';
      busbarStroke = '#facc15';
      gridLineStroke = 'rgba(186, 230, 253, 0.45)';
    }

    ctx.fillStyle = cellGrad;
    ctx.strokeStyle = borderStroke;
    ctx.lineWidth = 1.3;

    // Left Wing
    const spineGap = Math.min(4, Math.max(0.2, pw * 0.04));
    const padH = Math.min(1, Math.max(0.1, segH * 0.08));
    const wingCorner = Math.min(2, Math.max(0.2, Math.min(colW, segH) * 0.1));

    ctx.beginPath();
    ctx.roundRect(-spineGap - colW, segTop + padH, colW, Math.max(0.1, segH - padH * 2), wingCorner);
    ctx.fill();
    ctx.stroke();

    // Right Wing
    ctx.beginPath();
    ctx.roundRect(spineGap, segTop + padH, colW, Math.max(0.1, segH - padH * 2), wingCorner);
    ctx.fill();
    ctx.stroke();

    // Draw N Columns of Individual Photovoltaic Wafers per wing
    const numSubCols = Math.max(1, N);
    const waferW = colW / numSubCols;

    for (let c = 0; c < numSubCols; c++) {
      const leftWaferX = -spineGap - colW + c * waferW;
      const rightWaferX = spineGap + c * waferW;

      // Wafer boundary gap
      if (numSubCols > 1 && c > 0 && waferW > 2) {
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.lineWidth = Math.min(1.2, Math.max(0.3, pw * 0.02));
        ctx.beginPath();
        ctx.moveTo(leftWaferX, segTop + padH);
        ctx.lineTo(leftWaferX, segBottom - padH);
        ctx.moveTo(rightWaferX, segTop + padH);
        ctx.lineTo(rightWaferX, segBottom - padH);
        ctx.stroke();
      }

      // Individual Gold/Silver Electrical Busbars down center of each wafer
      if (waferW > 1.5) {
        ctx.strokeStyle = busbarStroke;
        ctx.lineWidth = Math.min(1, Math.max(0.3, pw * 0.015));
        ctx.beginPath();
        ctx.moveTo(leftWaferX + waferW * 0.5, segTop + padH + 0.5);
        ctx.lineTo(leftWaferX + waferW * 0.5, segBottom - padH - 0.5);
        ctx.moveTo(rightWaferX + waferW * 0.5, segTop + padH + 0.5);
        ctx.lineTo(rightWaferX + waferW * 0.5, segBottom - padH - 0.5);
        ctx.stroke();
      }

      // Fine horizontal conductive collector micro-traces across each cell
      if (progress > 0.3 && segH > 6 && waferW > 3) {
        ctx.strokeStyle = gridLineStroke;
        ctx.lineWidth = Math.min(0.7, Math.max(0.2, pw * 0.01));
        const traces = Math.max(2, Math.floor((segH - 4) / 5));
        const traceStep = (segH - 4) / traces;
        for (let t = 1; t < traces; t++) {
          const ty = segTop + 2 + t * traceStep;
          ctx.beginPath();
          ctx.moveTo(leftWaferX + 1, ty);
          ctx.lineTo(leftWaferX + waferW - 1, ty);
          ctx.moveTo(rightWaferX + 1, ty);
          ctx.lineTo(rightWaferX + waferW - 1, ty);
          ctx.stroke();
        }
      }
    }

    // Gold hinge knuckle at segment joints
    if (curH > 4) {
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(0, segBottom, Math.min(2.5, Math.max(0.4, segH * 0.15)), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Top tip tension cap & sun sensor diode
  const tipH = Math.min(3, Math.max(0.5, ph * 0.03));
  ctx.fillStyle = '#475569';
  ctx.fillRect(-hw * 0.3, topY - tipH, pw * 0.3, tipH);
  if (pw > 3) {
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(0, topY - tipH * 0.6, Math.min(2.5, Math.max(0.5, tipH * 0.8)), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 2. Circular Solar Array (UltraFlex / Orion / Phoenix 360-Degree Radial Fan)
 */
function renderCircularSolarArray(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number,
  options?: RenderPartOptions,
  isHovered?: boolean,
  isSelected?: boolean
) {
  const boomLengthM = Math.max(0, options?.solarBoomLengthM ?? 0);
  const boomScalePx = boomLengthM * (ph / Math.max(1.5, def.height || 2.4)) * 0.8;
  const curBoomDist = boomScalePx * (0.1 + 0.9 * progress);

  const hubX = 0;
  const hubY = hh * 0.3 - curBoomDist;
  const radius = Math.min(pw * 0.85, ph * 0.85);

  // Mounting bracket - proportional
  const bracketH = Math.min(6, Math.max(0.6, ph * 0.08));
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.min(1.6, Math.max(0.4, pw * 0.03));
  ctx.beginPath();
  ctx.roundRect(-hw * 0.4, hh - bracketH, pw * 0.4, bracketH, Math.min(2, bracketH * 0.3));
  ctx.fill();
  ctx.stroke();

  // Cantilever boom connecting bracket to central hub
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = Math.min(2.5, Math.max(0.5, pw * 0.04));
  ctx.beginPath();
  ctx.moveTo(0, hh - bracketH);
  ctx.lineTo(hubX, hubY);
  ctx.stroke();

  if (progress <= 0.01) {
    // STOWED STATE:
    // Slender cylindrical canister pod with clamshell latch
    const podW = pw * 0.55;
    const podH = ph * 0.35;

    const podGrad = ctx.createLinearGradient(-podW / 2, 0, podW / 2, 0);
    podGrad.addColorStop(0, '#1e293b');
    podGrad.addColorStop(0.5, '#64748b');
    podGrad.addColorStop(1, '#0f172a');

    ctx.fillStyle = podGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.min(1.8, Math.max(0.4, pw * 0.03));
    ctx.beginPath();
    ctx.roundRect(-podW / 2, hubY - podH / 2, podW, podH, Math.min(4, podH * 0.3));
    ctx.fill();
    ctx.stroke();

    if (podW > 6) {
      // Release clamp band
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = Math.min(1.5, Math.max(0.4, pw * 0.02));
      ctx.beginPath();
      ctx.moveTo(-podW / 2, hubY);
      ctx.lineTo(podW / 2, hubY);
      ctx.stroke();

      // Status LED
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, hubY, Math.min(2.5, Math.max(0.5, podH * 0.15)), 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  // UNFOLDING / DEPLOYED STATE:
  // Blossoming 360-degree radial fan
  const totalSectors = 12;
  const sweepAngle = progress * Math.PI * 2;
  const activeSectors = Math.max(1, Math.ceil(totalSectors * progress));

  ctx.save();
  ctx.translate(hubX, hubY);

  // Draw triangular pie sectors blossoming out sequentially
  const startAngle = -Math.PI * 0.5; // Start pointing UP
  for (let s = 0; s < activeSectors; s++) {
    const a1 = startAngle + (s / totalSectors) * Math.PI * 2;
    const a2 = Math.min(startAngle + sweepAngle, startAngle + ((s + 1) / totalSectors) * Math.PI * 2);
    if (a2 <= a1) continue;

    // Deep iridescent photovoltaic blue gradient for each sector
    const sectorGrad = ctx.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
    sectorGrad.addColorStop(0, '#1e3a8a');
    sectorGrad.addColorStop(0.6, '#1d4ed8');
    sectorGrad.addColorStop(1, '#0f172a');

    ctx.fillStyle = sectorGrad;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = Math.min(1.2, Math.max(0.3, radius * 0.03));

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, a1, a2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Concentric gold power collection rings across sectors (if visible)
    if (radius > 12) {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = Math.min(0.9, Math.max(0.3, radius * 0.015));
      for (let r = 0.4; r <= 0.9; r += 0.25) {
        ctx.beginPath();
        ctx.arc(0, 0, radius * r, a1, a2);
        ctx.stroke();
      }
    }

    // Radial carbon-fiber stiffening spoke
    if (radius > 5) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = Math.min(1.2, Math.max(0.3, radius * 0.02));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a2) * radius, Math.sin(a2) * radius);
      ctx.stroke();
    }
  }

  // Central Rotary Hub & Gimbal Actuator - proportional
  const hubR = radius * 0.16;
  if (hubR > 0.5) {
    const hubGrad = ctx.createRadialGradient(0, 0, Math.max(0.1, hubR * 0.1), 0, 0, hubR);
    hubGrad.addColorStop(0, '#f8fafc');
    hubGrad.addColorStop(0.5, '#94a3b8');
    hubGrad.addColorStop(1, '#334155');

    ctx.fillStyle = hubGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.min(1.8, Math.max(0.3, hubR * 0.2));
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Gold telemetry commutator ring
    if (hubR > 2) {
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = Math.min(1.2, Math.max(0.3, hubR * 0.15));
      ctx.beginPath();
      ctx.arc(0, 0, hubR * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      // Center optical sun tracker diode
      ctx.fillStyle = progress > 0.9 ? '#22d3ee' : '#eab308';
      ctx.beginPath();
      ctx.arc(0, 0, hubR * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * 3. Hexagonal Segmented Solar Array (JWST Articulated Beryllium Honeycomb Petals)
 */
function renderHexagonalSolarArray(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number,
  options?: RenderPartOptions,
  isHovered?: boolean,
  isSelected?: boolean
) {
  const boomLengthM = Math.max(0, options?.solarBoomLengthM ?? 0);
  const boomScalePx = boomLengthM * (ph / Math.max(1.5, def.height || 2.4)) * 0.8;
  const curBoomDist = boomScalePx * (0.1 + 0.9 * progress);

  const hubX = 0;
  const hubY = 0 - curBoomDist;
  const hexRadius = Math.min(pw, ph) * 0.28;

  // Base mounting hinge - proportional
  const bracketH = Math.min(6, Math.max(0.6, ph * 0.08));
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.min(1.6, Math.max(0.4, pw * 0.03));
  ctx.beginPath();
  ctx.roundRect(-hw * 0.45, hh - bracketH, pw * 0.45, bracketH, Math.min(2, bracketH * 0.3));
  ctx.fill();
  ctx.stroke();

  // Beryllium swing-arm support boom extending to center
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = Math.min(2.4, Math.max(0.5, pw * 0.04));
  ctx.beginPath();
  ctx.moveTo(0, hh - bracketH);
  ctx.lineTo(hubX, hubY);
  ctx.stroke();

  if (progress <= 0.01) {
    // STOWED STATE:
    // Folded compact single hexagonal core
    drawSingleHexagon(ctx, hubX, hubY, hexRadius * 0.8, '#1e293b', '#64748b', true);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(hubX, hubY, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // UNFOLDING / DEPLOYED STATE:
  // Central Hexagon + 6 Outer Hexagonal Petals sliding & rotating outward
  const petalDist = hexRadius * 1.75 * progress;

  // 1. Draw Central Hexagon
  drawSingleHexagon(ctx, hubX, hubY, hexRadius, '#0f172a', '#f59e0b', false);

  // 2. Draw 6 Outer Petals around center
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const px = hubX + Math.cos(angle) * petalDist;
    const py = hubY + Math.sin(angle) * petalDist;

    // Support strut connecting petal to hub
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hubX, hubY);
    ctx.lineTo(px, py);
    ctx.stroke();

    drawSingleHexagon(ctx, px, py, hexRadius * 0.88, '#1e293b', '#38bdf8', false);
  }

  // Central Sun Tracking Star-Sensor
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(hubX, hubY, 4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Helper to draw a single regular hexagon
 */
function drawSingleHexagon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fillColor: string,
  strokeColor: string,
  isStowed: boolean
) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  // Photovoltaic cell gradient
  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  grad.addColorStop(0, '#1d4ed8');
  grad.addColorStop(0.7, '#1e3a8a');
  grad.addColorStop(1, fillColor);

  ctx.fillStyle = grad;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.4;
  ctx.fill();
  ctx.stroke();

  // Internal triple-junction solar grid lines
  if (!isStowed) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
      ctx.lineTo(cx - Math.cos(a) * r * 0.8, cy - Math.sin(a) * r * 0.8);
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Renders an animated deployable aerospace landing leg
 * Supports 4 distinct landing leg architectures:
 * 1. 'standard': Apollo LM style telescoping hydraulic strut with coil spring & self-leveling dish
 * 2. 'heavy_carbon': Falcon 9 / New Glenn inverted A-frame carbon-composite scissor leg
 * 3. 'wide_spreader': Low-gravity wide outrigger tripod with dual dampers & rock-crawler claw footpad
 * 4. 'micro_hopper': Ultra-compact probe cantilever leaf spring & magnetic harpoon spike
 */
export function renderAnimatedLandingLeg(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  options: RenderPartOptions
) {
  const { widthPx: pw, heightPx: ph } = options;
  const hw = pw / 2;
  const hh = ph / 2;

  const legType = options.landingLegType || def.landingLegType || 'standard';
  const legScale = Math.max(0.4, options.legScale ?? 1.0);
  const footpadType = options.legFootpadType || def.legFootpadType || 'Standard';

  const progress = Math.max(
    0,
    Math.min(1, options.deployProgress !== undefined ? options.deployProgress : (options.deployed ? 1.0 : 0.0))
  );

  // Deploy angles customized per architecture or overridden by legDeployAngleDeg
  const defaultAngleDeg =
    legType === 'wide_spreader' ? 62 :
    legType === 'heavy_carbon' ? 54 :
    legType === 'spider_articulated' ? 50 :
    legType === 'micro_hopper' ? 38 : 45;
  const deployAngleDeg = options.legDeployAngleDeg ?? defaultAngleDeg;
  const maxAngle = deployAngleDeg * (Math.PI / 180);
  const curAngle = progress * maxAngle;

  const compression = Math.max(0, Math.min(1, options.suspensionCompression ?? 0));

  if (legType === 'heavy_carbon') {
    renderFalconCarbonLandingLeg(ctx, hw, hh, pw, ph, progress, curAngle, legScale, footpadType, compression);
  } else if (legType === 'wide_spreader') {
    renderWideSpreaderLandingLeg(ctx, hw, hh, pw, ph, progress, curAngle, legScale, footpadType, compression);
  } else if (legType === 'micro_hopper') {
    renderMicroHopperLandingLeg(ctx, hw, hh, pw, ph, progress, curAngle, legScale, footpadType, compression);
  } else if (legType === 'spider_articulated') {
    renderApolloLemSpiderLandingLeg(ctx, hw, hh, pw, ph, progress, curAngle, legScale, footpadType, compression);
  } else {
    renderStandardHydraulicLandingLeg(ctx, hw, hh, pw, ph, progress, curAngle, legScale, footpadType, compression);
  }
}

/**
 * 1. Standard Hydraulic Telescoping Lunar Strut
 */
function renderStandardHydraulicLandingLeg(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number,
  curAngle: number,
  legScale: number,
  footpadType: string,
  compression: number
) {
  // Base mounting fuselage bracket
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  const bracketW = pw * 0.45;
  const bracketH = ph * 0.35;
  ctx.beginPath();
  ctx.roundRect(-hw * 0.5, -hh, bracketW, bracketH, 3);
  ctx.fill();
  ctx.stroke();

  // Hazard warning chevron stripes
  ctx.fillStyle = '#eab308';
  ctx.fillRect(-hw * 0.42, -hh + 3, bracketW * 0.84, 3);

  // Main pivot knuckle
  const pivotX = -hw * 0.15;
  const pivotY = -hh + bracketH;

  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Length calculation
  const retractedLen = ph * 0.55 * legScale;
  const extendedLen = ph * 1.15 * legScale;
  const uncompressedLen = retractedLen + (extendedLen - retractedLen) * progress;
  const curLen = uncompressedLen * (1.0 - compression * 0.22);

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(curAngle);

  // 1. Outer Shock Cylinder Housing (Gunmetal Alloy)
  const cylLen = curLen * 0.55;
  const cylW = 8 * legScale;

  const cylGrad = ctx.createLinearGradient(-cylW / 2, 0, cylW / 2, 0);
  cylGrad.addColorStop(0, '#334155');
  cylGrad.addColorStop(0.5, '#64748b');
  cylGrad.addColorStop(1, '#1e293b');

  ctx.fillStyle = cylGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-cylW / 2, 0, cylW, cylLen, 2);
  ctx.fill();
  ctx.stroke();

  // 2. Telescoping Polished Chrome Hydraulic Piston
  const pistonW = 5 * legScale;
  const pistonLen = curLen * 0.65;

  const chromeGrad = ctx.createLinearGradient(-pistonW / 2, 0, pistonW / 2, 0);
  chromeGrad.addColorStop(0, '#64748b');
  chromeGrad.addColorStop(0.3, '#cbd5e1');
  chromeGrad.addColorStop(0.5, '#ffffff');
  chromeGrad.addColorStop(0.8, '#94a3b8');
  chromeGrad.addColorStop(1, '#475569');

  ctx.fillStyle = chromeGrad;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.roundRect(-pistonW / 2, cylLen * 0.6, pistonW, pistonLen, 1);
  ctx.fill();
  ctx.stroke();

  // 3. Coil-over suspension spring wrapping around cylinder
  if (progress > 0.2) {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    const springTurns = 6;
    const sTop = cylLen * 0.15;
    const sH = cylLen * (0.65 - compression * 0.15);
    for (let t = 0; t < springTurns; t++) {
      const sy = sTop + (sH / springTurns) * t;
      ctx.beginPath();
      ctx.moveTo(-cylW * 0.55, sy);
      ctx.lineTo(cylW * 0.55, sy + (sH / springTurns) * 0.55);
      ctx.stroke();
    }
  }

  // 4. Articulated Footpad (Counter-rotates to stay level with ground)
  const padY = cylLen * 0.6 + pistonLen;
  ctx.save();
  ctx.translate(0, padY);
  ctx.rotate(-curAngle); // Level with surface

  drawFootpad(ctx, pw * 0.52 * legScale, footpadType);

  ctx.restore(); // Footpad
  ctx.restore(); // Leg rotation

  // Secondary Diagonal Tension Bracing Strut
  if (progress > 0.1) {
    const strutEndX = pivotX + Math.sin(curAngle) * cylLen * 0.8;
    const strutEndY = pivotY + Math.cos(curAngle) * cylLen * 0.8;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.45, -hh + 4);
    ctx.lineTo(strutEndX, strutEndY);
    ctx.stroke();

    // Lock latch cylinder
    ctx.fillStyle = progress > 0.95 ? '#22c55e' : '#eab308';
    ctx.beginPath();
    ctx.arc(((-hw * 0.45) + strutEndX) / 2, ((-hh + 4) + strutEndY) / 2, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * 2. Heavy Carbon-Composite Falcon Quad Booster Strut
 */
function renderFalconCarbonLandingLeg(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number,
  curAngle: number,
  legScale: number,
  footpadType: string,
  compression: number
) {
  // Upper titanium clevis bracket
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.0;
  const bracketW = pw * 0.5;
  const bracketH = ph * 0.38;
  ctx.beginPath();
  ctx.roundRect(-hw * 0.55, -hh, bracketW, bracketH, 3);
  ctx.fill();
  ctx.stroke();

  // Carbon fiber weave visual indicator
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(-hw * 0.45, -hh + 3, bracketW * 0.65, 2.5);

  const pivotX = -hw * 0.2;
  const pivotY = -hh + bracketH;

  // Main high-torque pivot joint
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 5, 0, Math.PI * 2);
  ctx.fill();

  const retractedLen = ph * 0.65 * legScale;
  const extendedLen = ph * 1.35 * legScale;
  const uncompressedLen = retractedLen + (extendedLen - retractedLen) * progress;
  const curLen = uncompressedLen * (1.0 - compression * 0.18);

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(curAngle);

  // 1. Inverted A-Frame Carbon Fiber Main Strut
  const armW = 10 * legScale;
  const armGrad = ctx.createLinearGradient(-armW / 2, 0, armW / 2, 0);
  armGrad.addColorStop(0, '#020617');
  armGrad.addColorStop(0.3, '#1e293b');
  armGrad.addColorStop(0.7, '#0f172a');
  armGrad.addColorStop(1, '#020617');

  ctx.fillStyle = armGrad;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-armW * 0.5, 0);
  ctx.lineTo(armW * 0.5, 0);
  ctx.lineTo(armW * 0.35, curLen * 0.85);
  ctx.lineTo(-armW * 0.35, curLen * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Carbon fiber diagonal lattice ribs
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 1.0;
  const ribSteps = 5;
  for (let r = 1; r < ribSteps; r++) {
    const ry = (curLen * 0.85 / ribSteps) * r;
    ctx.beginPath();
    ctx.moveTo(-armW * 0.4, ry);
    ctx.lineTo(armW * 0.4, ry + (curLen * 0.85 / ribSteps) * 0.5);
    ctx.stroke();
  }

  // 2. Telescopic Pneumatic Deploy Pusher Cylinder
  const cylLen = curLen * 0.45;
  const cylW = 6 * legScale;
  ctx.fillStyle = '#475569';
  ctx.fillRect(-cylW / 2, curLen * 0.45, cylW, cylLen);

  // Chrome rod extending to footpad
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-cylW * 0.3, curLen * 0.7, cylW * 0.6, curLen * 0.28);

  // 3. Heavy Articulated Footpad
  ctx.save();
  ctx.translate(0, curLen);
  ctx.rotate(-curAngle);

  drawFootpad(ctx, pw * 0.68 * legScale, footpadType === 'Standard' ? 'Heavy' : footpadType);

  ctx.restore();
  ctx.restore();

  // Locking Tension Strut & Over-Center Latch Ring
  if (progress > 0.1) {
    const strutEndX = pivotX + Math.sin(curAngle) * curLen * 0.65;
    const strutEndY = pivotY + Math.cos(curAngle) * curLen * 0.65;

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.5, -hh + 5);
    ctx.lineTo(strutEndX, strutEndY);
    ctx.stroke();

    // Locking ring status indicator
    ctx.fillStyle = progress > 0.95 ? '#22c55e' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(strutEndX, strutEndY, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * 3. Wide Spreader Low-Gravity Outrigger Tripod Strut
 */
function renderWideSpreaderLandingLeg(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number,
  curAngle: number,
  legScale: number,
  footpadType: string,
  compression: number
) {
  // Mounting base
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.8;
  const bracketW = pw * 0.52;
  const bracketH = ph * 0.32;
  ctx.beginPath();
  ctx.roundRect(-hw * 0.5, -hh, bracketW, bracketH, 3);
  ctx.fill();
  ctx.stroke();

  // Emerald low-g indicator
  ctx.fillStyle = '#10b981';
  ctx.fillRect(-hw * 0.4, -hh + 3, bracketW * 0.7, 3);

  const pivotX = -hw * 0.15;
  const pivotY = -hh + bracketH;

  const retractedLen = ph * 0.55 * legScale;
  const extendedLen = ph * 1.25 * legScale;
  const curLen = (retractedLen + (extendedLen - retractedLen) * progress) * (1.0 - compression * 0.2);

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(curAngle);

  // 1. Dual Parallel Scissor Links
  const linkSpread = 7 * legScale;
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3.0 * legScale;
  ctx.beginPath();
  ctx.moveTo(-linkSpread / 2, 0);
  ctx.lineTo(-linkSpread / 2, curLen * 0.7);
  ctx.moveTo(linkSpread / 2, 0);
  ctx.lineTo(linkSpread / 2, curLen * 0.7);
  ctx.stroke();

  // Cross-bracing pins
  ctx.fillStyle = '#e2e8f0';
  for (let i = 1; i <= 3; i++) {
    const y = (curLen * 0.7 / 4) * i;
    ctx.beginPath();
    ctx.arc(0, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Heavy Fluid Reservoir & Shock Damper
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-linkSpread * 0.6, curLen * 0.3, linkSpread * 1.2, curLen * 0.35, 2);
  ctx.fill();
  ctx.stroke();

  // Telescoping lower extension
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(-3 * legScale, curLen * 0.65, 6 * legScale, curLen * 0.35);

  // 3. Footpad - Wide Terrain Rock Claw
  ctx.save();
  ctx.translate(0, curLen);
  ctx.rotate(-curAngle);

  drawFootpad(ctx, pw * 0.75 * legScale, footpadType === 'Standard' ? 'Wide Terrain' : footpadType);

  ctx.restore();
  ctx.restore();

  // Outrigger Cantilever Tie-Rod
  if (progress > 0.1) {
    const strutEndX = pivotX + Math.sin(curAngle) * curLen * 0.55;
    const strutEndY = pivotY + Math.cos(curAngle) * curLen * 0.55;

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.45, -hh + 5);
    ctx.lineTo(strutEndX, strutEndY);
    ctx.stroke();

    ctx.fillStyle = progress > 0.95 ? '#10b981' : '#eab308';
    ctx.beginPath();
    ctx.arc(strutEndX, strutEndY, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 4. Micro-Lander Spring Hopper Strut
 */
function renderMicroHopperLandingLeg(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number,
  curAngle: number,
  legScale: number,
  footpadType: string,
  compression: number
) {
  // Ultra-compact bracket
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.4;
  const bracketW = pw * 0.38;
  const bracketH = ph * 0.28;
  ctx.beginPath();
  ctx.roundRect(-hw * 0.45, -hh, bracketW, bracketH, 2);
  ctx.fill();
  ctx.stroke();

  const pivotX = -hw * 0.15;
  const pivotY = -hh + bracketH;

  const retractedLen = ph * 0.5 * legScale;
  const extendedLen = ph * 1.05 * legScale;
  const curLen = (retractedLen + (extendedLen - retractedLen) * progress) * (1.0 - compression * 0.25);

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(curAngle);

  // Curved Titanium Cantilever Leaf Spring
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2.4 * legScale;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(8 * legScale, curLen * 0.4, 0, curLen * 0.8);
  ctx.stroke();

  // Torsion spring elbow joint at top
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Telescoping spike shaft
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.8 * legScale;
  ctx.beginPath();
  ctx.moveTo(0, curLen * 0.75);
  ctx.lineTo(0, curLen);
  ctx.stroke();

  // Footpad - Harpoon Spike / Dart Tip
  ctx.save();
  ctx.translate(0, curLen);
  ctx.rotate(-curAngle);

  drawFootpad(ctx, pw * 0.42 * legScale, footpadType === 'Standard' ? 'Spike Claw' : footpadType);

  ctx.restore();
  ctx.restore();
}

/**
 * 5. Apollo LEM Pyramidal Tripod Landing Gear (Central Crushable Strut, Swing Arms, Contact Probe)
 */
function renderApolloLemSpiderLandingLeg(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number,
  curAngle: number,
  legScale: number,
  footpadType: string,
  compression: number
) {
  // Mounting clevis plate on descent stage quadrant (Gold foil trimmed)
  const bracketW = pw * 0.48;
  const bracketH = ph * 0.32;
  ctx.fillStyle = '#b45309'; // Gold Kapton base
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-hw * 0.5, -hh, bracketW, bracketH, 2);
  ctx.fill();
  ctx.stroke();

  // MLI thermal blanket texture lines
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.45, -hh + 3);
  ctx.lineTo(-hw * 0.45 + bracketW * 0.85, -hh + 3);
  ctx.moveTo(-hw * 0.45, -hh + 7);
  ctx.lineTo(-hw * 0.45 + bracketW * 0.85, -hh + 7);
  ctx.stroke();

  const pivotX = -hw * 0.15;
  const pivotY = -hh + bracketH;

  // Main high-strength gimbal knuckle
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(pivotX, pivotY, 4, 0, Math.PI * 2);
  ctx.fill();

  const retractedLen = ph * 0.55 * legScale;
  const extendedLen = ph * 1.25 * legScale;
  const uncompressedLen = retractedLen + (extendedLen - retractedLen) * progress;
  const curLen = uncompressedLen * (1.0 - compression * 0.20);

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(curAngle);

  // 1. Central Primary Honeycomb Shock Absorber Strut
  const mainCylW = 7 * legScale;
  const mainCylLen = curLen * 0.72;

  // Gold Kapton thermal wrap on primary cylinder
  const kaptonGrad = ctx.createLinearGradient(-mainCylW / 2, 0, mainCylW / 2, 0);
  kaptonGrad.addColorStop(0, '#78350f');
  kaptonGrad.addColorStop(0.3, '#d97706');
  kaptonGrad.addColorStop(0.6, '#fde047');
  kaptonGrad.addColorStop(1, '#92400e');

  ctx.fillStyle = kaptonGrad;
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-mainCylW / 2, 0, mainCylW, mainCylLen, 1.5);
  ctx.fill();
  ctx.stroke();

  // Foil crinkle wrap bands
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.6)';
  ctx.lineWidth = 0.9;
  const numBands = 6;
  for (let b = 1; b < numBands; b++) {
    const by = (mainCylLen / numBands) * b;
    ctx.beginPath();
    ctx.moveTo(-mainCylW * 0.5, by);
    ctx.lineTo(mainCylW * 0.5, by);
    ctx.stroke();
  }

  // 2. Sliding Deploy Lock Collar
  const collarY = mainCylLen * (0.35 + 0.45 * progress);
  const collarW = mainCylW * 1.4;
  const collarH = 5 * legScale;
  ctx.fillStyle = '#64748b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-collarW / 2, collarY - collarH / 2, collarW, collarH, 1.5);
  ctx.fill();
  ctx.stroke();

  // Lock Pin Status: Amber when unlocking/folding, Bright Green when locked deployed!
  ctx.fillStyle = progress > 0.88 ? '#22c55e' : '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, collarY, 2, 0, Math.PI * 2);
  ctx.fill();

  // 3. Lower Inner Telescoping Piston to Dish Footpad
  const pistonW = 4 * legScale;
  const pistonLen = curLen - mainCylLen;
  ctx.fillStyle = '#e2e8f0';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.fillRect(-pistonW / 2, mainCylLen, pistonW, pistonLen);

  // 4. Inverted Shallow Dish Footpad (Apollo LEM Type)
  ctx.save();
  ctx.translate(0, curLen);
  ctx.rotate(-curAngle); // Level to ground

  const padW = pw * 0.65 * legScale;
  const padH = 6;

  // Gold foil dish underside
  const dishGrad = ctx.createLinearGradient(-padW / 2, 0, padW / 2, 0);
  dishGrad.addColorStop(0, '#92400e');
  dishGrad.addColorStop(0.5, '#fde047');
  dishGrad.addColorStop(1, '#b45309');

  ctx.fillStyle = dishGrad;
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-padW / 2, 0);
  ctx.lineTo(padW / 2, 0);
  ctx.lineTo(padW * 0.35, padH);
  ctx.lineTo(-padW * 0.35, padH);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 5. Lunar Surface Contact Sensor Probe Wire (Apollo 1.5m probe uncoiling below dish)
  // When compression > 0 (touchdown), probe wire bends gracefully to the side!
  if (progress > 0.3) {
    const probeLen = (ph * 0.65 * legScale) * Math.min(1.0, (progress - 0.3) / 0.7);
    const probeBendX = compression * 8;
    ctx.strokeStyle = '#38bdf8'; // Blue spring steel probe
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, padH);
    ctx.quadraticCurveTo(probeBendX * 0.6, padH + probeLen * 0.5, probeBendX, padH + probeLen);
    ctx.stroke();

    // Probe tip ball
    ctx.fillStyle = compression > 0 ? '#22c55e' : '#38bdf8'; // Lights up contact green on touch
    ctx.beginPath();
    ctx.arc(probeBendX, padH + probeLen, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // Footpad
  ctx.restore(); // Leg rotation

  // 6. Dual Pyramidal Side Swing Arms (Forming rigid 3D tripod with central strut)
  if (progress > 0.05) {
    const sideEndX = pivotX + Math.sin(curAngle) * collarY;
    const sideEndY = pivotY + Math.cos(curAngle) * collarY;

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.45, -hh + 3);
    ctx.lineTo(sideEndX, sideEndY);
    ctx.stroke();

    // Pivot pin
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(sideEndX, sideEndY, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renders an articulated terrain footpad
 */
function drawFootpad(ctx: CanvasRenderingContext2D, padW: number, footpadType: string) {
  // Center ball swivel joint
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  const padH = 5;

  if (footpadType.includes('Spike') || footpadType.includes('Claw')) {
    // Harpoon Dart / Ground Spike Tip
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-padW * 0.35, 0);
    ctx.lineTo(padW * 0.35, 0);
    ctx.lineTo(0, padH * 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hardened tungsten dart core
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, padH * 1.2, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (footpadType.includes('Wide')) {
    // Wide Terrain Rock-Crawler Footpad with Dual Articulated Talons
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-padW / 2, 0, padW, padH, 2);
    ctx.fill();
    ctx.stroke();

    // Dual terrain grip claws
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-padW * 0.45, padH);
    ctx.lineTo(-padW * 0.55, padH + 4);
    ctx.lineTo(-padW * 0.35, padH);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(padW * 0.45, padH);
    ctx.lineTo(padW * 0.55, padH + 4);
    ctx.lineTo(padW * 0.35, padH);
    ctx.fill();

    // Center traction cleats
    const teeth = 4;
    for (let th = 0; th < teeth; th++) {
      const tx = -padW * 0.3 + (padW * 0.6 / (teeth + 1)) * (th + 1);
      ctx.fillRect(tx - 1, padH, 2, 2.5);
    }
  } else if (footpadType.includes('Heavy')) {
    // Heavy Carbon-Composite Trapezoidal Footpad
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-padW / 2, 0);
    ctx.lineTo(padW / 2, 0);
    ctx.lineTo(padW * 0.4, padH);
    ctx.lineTo(-padW * 0.4, padH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // High-friction silicone rubber dampener
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(-padW * 0.35, padH, padW * 0.7, 2.5);
  } else {
    // Standard Circular Alloy Dish Footpad
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(-padW / 2, 0, padW, padH, 2);
    ctx.fill();
    ctx.stroke();

    // Ground traction cleats
    ctx.fillStyle = '#f8fafc';
    const teeth = 4;
    for (let th = 0; th < teeth; th++) {
      const tx = -padW / 2 + (padW / (teeth + 1)) * (th + 1);
      ctx.fillRect(tx - 1, padH, 2, 2.5);
    }
  }
}

/**
 * Renders an animated Reaction Control System (RCS) attitude thruster
 * Supports 3 distinct architectures:
 * 1. 'rcs_quad': 4-Way Quad Omni Block (Apollo/Shuttle machined CNC alloy manifold)
 * 2. 'rcs_linear_dual': 2-Way Linear Canted Jet (Falcon/Dragon aerodynamic wedge fairing)
 * 3. 'rcs_heavy_penta': 5-Way Heavy Penta-Cluster (Reinforced octagonal chassis + axial pusher)
 *
 * Includes dynamic animated supersonic thruster plumes with Mach shock diamonds,
 * ceramic throat hotspots, and 3 propellant types (cold_gas, monoprop, hypergolic).
 */
export function renderAnimatedRCS(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  options: RenderPartOptions
) {
  const { widthPx: pw, heightPx: ph } = options;
  const hw = pw / 2;
  const hh = ph / 2;

  const rawType =
    options.rcsThrusterType ||
    def.rcsThrusterType ||
    (def.id.includes('gimbal') ? 'rcs_gimbal_vernier' : 'rcs_3way_cluster');

  // Removed types (rcs_quad, rcs_linear_dual, rcs_heavy_penta, rcs_fixed_single) route to rcs_3way_cluster
  const rcsType =
    (rawType === 'rcs_quad' || rawType === 'rcs_linear_dual' || rawType === 'rcs_heavy_penta' || rawType === 'rcs_fixed_single')
      ? 'rcs_3way_cluster'
      : rawType;

  const propellant = options.rcsPropellantType || def.rcsPropellantType || 'monoprop';

  const rcsScale = options.rcsScale ?? 1.0;
  const thrustKn = options.rcsThrustKn ?? def.rcsThrustKn ?? 1.25;

  const isFiring = Boolean(
    options.rcsFiring ||
    (options.isFlight && options.engineActive) ||
    (options.throttle !== undefined && options.throttle > 0)
  );

  const fireDir = options.rcsFireDirection || 'ALL';

  if (rcsType === 'rcs_gimbal_vernier') {
    renderRCSGimbalVernier(ctx, hw, hh, pw, ph, rcsScale, propellant, thrustKn, isFiring, options.rcsGimbalAngleRad || 0);
  } else {
    renderRCS3WayCluster(ctx, hw, hh, pw, ph, rcsScale, propellant, thrustKn, isFiring, fireDir);
  }
}

/**
 * RCS Type 1: 4-Way Quad Omni Block
 */
function renderRCSQuad(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  rcsScale: number,
  propellant: string,
  thrustKn: number,
  isFiring: boolean,
  fireDir: string
) {
  const blockSize = Math.min(hw, hh) * 0.85 * rcsScale;
  const nozLen = Math.min(hw, hh) * 0.95 * rcsScale;
  const nozW = 4 * rcsScale;

  // 1. CNC Machined Aerospace Aluminum Manifold Body (Chamfered Bevels)
  const bGrad = ctx.createRadialGradient(0, 0, blockSize * 0.2, 0, 0, blockSize);
  bGrad.addColorStop(0, '#64748b');
  bGrad.addColorStop(0.6, '#334155');
  bGrad.addColorStop(1, '#1e293b');

  ctx.fillStyle = bGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // Chamfered octagonal manifold shape
  const c = blockSize * 0.35;
  ctx.moveTo(-blockSize + c, -blockSize);
  ctx.lineTo(blockSize - c, -blockSize);
  ctx.lineTo(blockSize, -blockSize + c);
  ctx.lineTo(blockSize, blockSize - c);
  ctx.lineTo(blockSize - c, blockSize);
  ctx.lineTo(-blockSize + c, blockSize);
  ctx.lineTo(-blockSize, blockSize - c);
  ctx.lineTo(-blockSize, -blockSize + c);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Perimeter titanium mounting hex bolts
  ctx.fillStyle = '#cbd5e1';
  const boltOffsets = [
    [-blockSize * 0.65, -blockSize * 0.65],
    [blockSize * 0.65, -blockSize * 0.65],
    [blockSize * 0.65, blockSize * 0.65],
    [-blockSize * 0.65, blockSize * 0.65],
  ];
  boltOffsets.forEach(([bx, by]) => {
    ctx.beginPath();
    ctx.arc(bx, by, 1.8 * rcsScale, 0, Math.PI * 2);
    ctx.fill();
  });

  // Central plenum seal ring & status LED
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, blockSize * 0.35, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isFiring ? '#22c55e' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, 0, blockSize * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // 2. DeLaval Nozzles in 4 Orthogonal Directions: Left (-X), Right (+X), Up (-Y), Down (+Y)
  const nozzles = [
    { dir: 'LEFT', angle: Math.PI, x: -blockSize, y: 0, nx: -1, ny: 0 },
    { dir: 'RIGHT', angle: 0, x: blockSize, y: 0, nx: 1, ny: 0 },
    { dir: 'UP', angle: -Math.PI / 2, x: 0, y: -blockSize, nx: 0, ny: -1 },
    { dir: 'DOWN', angle: Math.PI / 2, x: 0, y: blockSize, nx: 0, ny: 1 },
  ];

  nozzles.forEach((noz) => {
    ctx.save();
    ctx.translate(noz.x, noz.y);
    ctx.rotate(noz.angle);

    // Combustion chamber collar
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.fillRect(0, -nozW / 2, nozLen * 0.35, nozW);
    ctx.strokeRect(0, -nozW / 2, nozLen * 0.35, nozW);

    // Flared DeLaval bell cone with bronze heat tint
    const bellGrad = ctx.createLinearGradient(nozLen * 0.35, 0, nozLen, 0);
    bellGrad.addColorStop(0, '#b45309');
    bellGrad.addColorStop(0.5, '#d97706');
    bellGrad.addColorStop(1, '#f59e0b');

    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.moveTo(nozLen * 0.35, -nozW / 2);
    ctx.lineTo(nozLen, -nozW * 1.15);
    ctx.lineTo(nozLen, nozW * 1.15);
    ctx.lineTo(nozLen * 0.35, nozW / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dark ceramic throat interior
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(nozLen - 1.5, -nozW * 0.9, 1.5, nozW * 1.8);

    // Animated exhaust plume
    const shouldFire = isFiring && (fireDir === 'ALL' || fireDir === noz.dir);
    if (shouldFire) {
      drawRCSPlume(ctx, nozLen, 0, 0, thrustKn, propellant, rcsScale);
    }

    ctx.restore();
  });
}

/**
 * RCS Type 2: 2-Way Linear Canted Jet (Falcon/Dragon Aerodynamic Fairing)
 */
function renderRCSLinearDual(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  rcsScale: number,
  propellant: string,
  thrustKn: number,
  isFiring: boolean,
  fireDir: string,
  cantAngleDeg: number
) {
  const fairingW = pw * 0.75 * rcsScale;
  const fairingH = ph * 0.7 * rcsScale;

  // Streamlined titanium aerodynamic fairing wedge
  const fGrad = ctx.createLinearGradient(-fairingW / 2, 0, fairingW / 2, 0);
  fGrad.addColorStop(0, '#1e293b');
  fGrad.addColorStop(0.3, '#475569');
  fGrad.addColorStop(0.7, '#334155');
  fGrad.addColorStop(1, '#0f172a');

  ctx.fillStyle = fGrad;
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  // Aerodynamic wedge profile
  ctx.moveTo(-fairingW * 0.45, -fairingH * 0.4);
  ctx.lineTo(fairingW * 0.45, -fairingH * 0.4);
  ctx.lineTo(fairingW * 0.55, fairingH * 0.4);
  ctx.lineTo(-fairingW * 0.55, fairingH * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Heat shield base plate
  ctx.fillStyle = '#020617';
  ctx.fillRect(-fairingW * 0.5, fairingH * 0.35, fairingW, 3 * rcsScale);

  // Status LED
  ctx.fillStyle = isFiring ? '#22c55e' : '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5 * rcsScale, 0, Math.PI * 2);
  ctx.fill();

  // 2 Canted Nozzles (Left and Right outward canted angles)
  const cantRad = (cantAngleDeg * Math.PI) / 180;
  const cantNozzles = [
    { x: -fairingW * 0.28, y: -fairingH * 0.25, angle: -Math.PI / 2 - cantRad, dir: 'LEFT' },
    { x: fairingW * 0.28, y: -fairingH * 0.25, angle: -Math.PI / 2 + cantRad, dir: 'RIGHT' },
  ];

  cantNozzles.forEach((noz) => {
    ctx.save();
    ctx.translate(noz.x, noz.y);
    ctx.rotate(noz.angle);

    const nozLen = 12 * rcsScale;
    const nozW = 4 * rcsScale;

    // Nozzle bell
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -nozW / 2);
    ctx.lineTo(nozLen, -nozW * 1.1);
    ctx.lineTo(nozLen, nozW * 1.1);
    ctx.lineTo(0, nozW / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Plume
    const shouldFire = isFiring && (fireDir === 'ALL' || fireDir === noz.dir || fireDir === 'UP');
    if (shouldFire) {
      drawRCSPlume(ctx, nozLen, 0, 0, thrustKn, propellant, rcsScale);
    }

    ctx.restore();
  });
}

/**
 * RCS Type 3: 5-Way Heavy Orbital Penta-Cluster
 */
function renderRCSHeavyPenta(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  rcsScale: number,
  propellant: string,
  thrustKn: number,
  isFiring: boolean,
  fireDir: string
) {
  const chassisR = Math.min(hw, hh) * 0.85 * rcsScale;

  // Heavy Octagonal CNC Chassis with Gold Foil Kapton Trim
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#ea580c';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const x = Math.cos(a) * chassisR;
    const y = Math.sin(a) * chassisR;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cooling radiator gills along edges
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 4; i++) {
    const gy = -chassisR * 0.45 + i * (chassisR * 0.3);
    ctx.beginPath();
    ctx.moveTo(-chassisR * 0.5, gy);
    ctx.lineTo(chassisR * 0.5, gy);
    ctx.stroke();
  }

  // Center High-Expansion Axial Pusher Nozzle (Prominent, High Thrust)
  const centerNozLen = chassisR * 1.15;
  const centerNozW = 6.5 * rcsScale;

  ctx.save();
  ctx.rotate(-Math.PI / 2); // Pointing forward/upward (-Y)
  ctx.fillStyle = '#ea580c';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(chassisR * 0.4, -centerNozW / 2);
  ctx.lineTo(centerNozLen, -centerNozW * 1.3);
  ctx.lineTo(centerNozLen, centerNozW * 1.3);
  ctx.lineTo(chassisR * 0.4, centerNozW / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (isFiring && (fireDir === 'ALL' || fireDir === 'UP')) {
    drawRCSPlume(ctx, centerNozLen, 0, 0, thrustKn * 1.4, propellant, rcsScale * 1.25);
  }
  ctx.restore();

  // 4 Lateral Attitude Control Nozzles
  const lateralNozzles = [
    { dir: 'LEFT', angle: Math.PI, x: -chassisR * 0.85, y: 0 },
    { dir: 'RIGHT', angle: 0, x: chassisR * 0.85, y: 0 },
    { dir: 'DOWN', angle: Math.PI / 2, x: 0, y: chassisR * 0.85 },
  ];

  lateralNozzles.forEach((noz) => {
    ctx.save();
    ctx.translate(noz.x, noz.y);
    ctx.rotate(noz.angle);

    const nozLen = 10 * rcsScale;
    const nozW = 4 * rcsScale;

    ctx.fillStyle = '#c2410c';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -nozW / 2);
    ctx.lineTo(nozLen, -nozW * 1.1);
    ctx.lineTo(nozLen, nozW * 1.1);
    ctx.lineTo(0, nozW / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (isFiring && (fireDir === 'ALL' || fireDir === noz.dir)) {
      drawRCSPlume(ctx, nozLen, 0, 0, thrustKn, propellant, rcsScale);
    }
    ctx.restore();
  });
}

/**
 * RCS Type 4: Fixed Single-Directional Thruster
 */
function renderRCSFixedSingle(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  rcsScale: number,
  propellant: string,
  thrustKn: number,
  isFiring: boolean,
  fireDir: string
) {
  const mountW = pw * 0.45 * rcsScale;
  const mountH = ph * 0.35 * rcsScale;
  const nozLen = ph * 0.55 * rcsScale;
  const nozW = 5 * rcsScale;

  // Fuselage bracket base
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.fillRect(-mountW / 2, -mountH / 2, mountW, mountH);
  ctx.strokeRect(-mountW / 2, -mountH / 2, mountW, mountH);

  // Single outward-pointing bell nozzle
  ctx.save();
  ctx.translate(0, 0);
  // Default facing outward/upwards
  const bellGrad = ctx.createLinearGradient(0, 0, 0, nozLen);
  bellGrad.addColorStop(0, '#475569');
  bellGrad.addColorStop(0.5, '#d97706');
  bellGrad.addColorStop(1, '#f59e0b');

  ctx.fillStyle = bellGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-nozW / 2, 0);
  ctx.lineTo(-nozW * 1.3, nozLen);
  ctx.lineTo(nozW * 1.3, nozLen);
  ctx.lineTo(nozW / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (isFiring) {
    drawRCSPlume(ctx, 0, nozLen, Math.PI / 2, thrustKn, propellant, rcsScale);
  }
  ctx.restore();
}

/**
 * RCS Type 5: 3-Directional Orthogonal Cluster (Left, Right, Outward)
 */
function renderRCS3WayCluster(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  rcsScale: number,
  propellant: string,
  thrustKn: number,
  isFiring: boolean,
  fireDir: string
) {
  const blockSize = Math.min(hw, hh) * 0.75 * rcsScale;
  const nozLen = Math.min(hw, hh) * 0.85 * rcsScale;
  const nozW = 4 * rcsScale;

  // CNC machined compact manifold block
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(-blockSize, -blockSize, blockSize * 2, blockSize * 2, 3);
  ctx.fill();
  ctx.stroke();

  // Status LED
  ctx.fillStyle = isFiring ? '#22c55e' : '#38bdf8';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5 * rcsScale, 0, Math.PI * 2);
  ctx.fill();

  // 3 Nozzles: Left (-X), Right (+X), Outward/Down (+Y)
  const nozzles = [
    { dir: 'LEFT', angle: Math.PI, x: -blockSize, y: 0 },
    { dir: 'RIGHT', angle: 0, x: blockSize, y: 0 },
    { dir: 'DOWN', angle: Math.PI / 2, x: 0, y: blockSize },
  ];

  nozzles.forEach((noz) => {
    ctx.save();
    ctx.translate(noz.x, noz.y);
    ctx.rotate(noz.angle);

    ctx.fillStyle = '#b45309';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -nozW / 2);
    ctx.lineTo(nozLen, -nozW * 1.15);
    ctx.lineTo(nozLen, nozW * 1.15);
    ctx.lineTo(0, nozW / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (isFiring && (fireDir === 'ALL' || fireDir === noz.dir)) {
      drawRCSPlume(ctx, nozLen, 0, 0, thrustKn, propellant, rcsScale);
    }
    ctx.restore();
  });
}

/**
 * RCS Type 6: Gimbaling Vernier Thruster (Pivots smoothly on dual-axis actuator)
 */
function renderRCSGimbalVernier(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  rcsScale: number,
  propellant: string,
  thrustKn: number,
  isFiring: boolean,
  gimbalAngleRad: number
) {
  const mountW = pw * 0.5 * rcsScale;
  const mountH = ph * 0.28 * rcsScale;
  const nozLen = ph * 0.65 * rcsScale;
  const nozW = 6 * rcsScale;

  // Gimbal mount base bracket
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.4;
  ctx.fillRect(-mountW / 2, -mountH / 2, mountW, mountH);
  ctx.strokeRect(-mountW / 2, -mountH / 2, mountW, mountH);

  // Gimbal pivot knuckle
  ctx.fillStyle = '#64748b';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5 * rcsScale, 0, Math.PI * 2);
  ctx.fill();

  // Dual electro-mechanical linear actuators
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-mountW * 0.4, 0);
  ctx.lineTo(-nozW * 0.6, nozLen * 0.35);
  ctx.moveTo(mountW * 0.4, 0);
  ctx.lineTo(nozW * 0.6, nozLen * 0.35);
  ctx.stroke();

  // Pivoted Nozzle Assembly
  ctx.save();
  ctx.rotate(gimbalAngleRad);

  const bellGrad = ctx.createLinearGradient(0, 0, 0, nozLen);
  bellGrad.addColorStop(0, '#475569');
  bellGrad.addColorStop(0.4, '#d97706');
  bellGrad.addColorStop(0.8, '#f59e0b');
  bellGrad.addColorStop(1, '#fbbf24');

  ctx.fillStyle = bellGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-nozW / 2, 0);
  ctx.lineTo(-nozW * 1.4, nozLen);
  ctx.lineTo(nozW * 1.4, nozLen);
  ctx.lineTo(nozW / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (isFiring) {
    drawRCSPlume(ctx, 0, nozLen, Math.PI / 2, thrustKn, propellant, rcsScale);
  }
  ctx.restore();
}

/**
 * Draws an animated supersonic RCS exhaust plume with shock diamonds & throat hotspot
 */
function drawRCSPlume(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  angleRad: number,
  thrustKn: number,
  propellant: string,
  scale: number
) {
  ctx.save();
  ctx.translate(originX, originY);
  ctx.rotate(angleRad);

  const plumeLen = Math.min(55, (16 + thrustKn * 12) * scale);
  const plumeSpread = Math.min(18, (5 + thrustKn * 4) * scale);

  // Propellant-specific color palettes
  let coreColor = '#ffffff';
  let innerColor = '#e0f2fe';
  let outerColor = '#38bdf8';
  let diamondColor = '#ffffff';

  if (propellant === 'monoprop') {
    // Golden amber Hydrazine Monopropellant
    coreColor = '#ffffff';
    innerColor = '#fef08a';
    outerColor = '#f59e0b';
    diamondColor = '#ffffff';
  } else if (propellant === 'hypergolic') {
    // Deep violet core with fiery orange envelope
    coreColor = '#fdf4ff';
    innerColor = '#c084fc';
    outerColor = '#ea580c';
    diamondColor = '#38bdf8';
  } else {
    // Nitrogen Cold-Gas: Frosty Cyan-White
    coreColor = '#ffffff';
    innerColor = '#e0f2fe';
    outerColor = '#38bdf8';
    diamondColor = '#bae6fd';
  }

  // 1. Ceramic Throat Hotspot Point Glow
  const hotspot = ctx.createRadialGradient(0, 0, 0, 0, 0, plumeSpread * 0.7);
  hotspot.addColorStop(0, '#ffffff');
  hotspot.addColorStop(0.5, innerColor);
  hotspot.addColorStop(1, 'transparent');
  ctx.fillStyle = hotspot;
  ctx.beginPath();
  ctx.arc(0, 0, plumeSpread * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // 2. Supersonic Plume Expansion Envelope
  const pGrad = ctx.createLinearGradient(0, 0, plumeLen, 0);
  pGrad.addColorStop(0, coreColor);
  pGrad.addColorStop(0.3, innerColor);
  pGrad.addColorStop(0.7, outerColor);
  pGrad.addColorStop(1, 'transparent');

  ctx.fillStyle = pGrad;
  ctx.beginPath();
  ctx.moveTo(0, -plumeSpread * 0.35);
  ctx.lineTo(plumeLen * 0.45, -plumeSpread);
  ctx.lineTo(plumeLen, 0);
  ctx.lineTo(plumeLen * 0.45, plumeSpread);
  ctx.lineTo(0, plumeSpread * 0.35);
  ctx.closePath();
  ctx.fill();

  // 3. Supersonic Mach Shock Diamonds along centerline
  const numDiamonds = 3;
  ctx.fillStyle = diamondColor;
  for (let d = 1; d <= numDiamonds; d++) {
    const dx = (plumeLen / (numDiamonds + 1)) * d;
    const dw = (4 - d * 0.8) * scale;
    const dh = (3 - d * 0.6) * scale;

    ctx.beginPath();
    ctx.moveTo(dx - dw, 0);
    ctx.lineTo(dx, -dh);
    ctx.lineTo(dx + dw, 0);
    ctx.lineTo(dx, dh);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Renders an animated planetary exploration rover wheel
 */
export function renderAnimatedRoverWheel(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  options: RenderPartOptions
) {
  const { widthPx: pw, heightPx: ph } = options;
  const hw = pw / 2;
  const hh = ph / 2;

  const steerAngle = options.wheelSteerAngle || 0;
  const wheelRot = options.wheelRotation || 0;
  const isHeavy = def.wheelType === 'rover_heavy';

  // 1. Chassis Mounting Pivot & Trailing-Arm Suspension Strut
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;

  // Upper chassis bracket
  ctx.beginPath();
  ctx.roundRect(-hw * 0.4, -hh, pw * 0.4, ph * 0.3, 2);
  ctx.fill();
  ctx.stroke();

  // Rocker-bogie swingarm
  const hubY = hh * 0.35;
  ctx.strokeStyle = isHeavy ? '#334155' : '#475569';
  ctx.lineWidth = isHeavy ? 4.5 : 3.5;
  ctx.beginPath();
  ctx.moveTo(0, -hh + 6);
  ctx.lineTo(0, hubY);
  ctx.stroke();

  // Heavy coil-over shock absorber spring
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.8;
  const coils = 4;
  const sTop = -hh + ph * 0.15;
  const sBot = hubY - 6;
  const sH = sBot - sTop;
  for (let c = 0; c < coils; c++) {
    const y = sTop + (sH / coils) * c;
    ctx.beginPath();
    ctx.moveTo(-4, y);
    ctx.lineTo(4, y + sH / coils * 0.6);
    ctx.stroke();
  }

  // 2. Wheel Hub with Steering Pivot & Rotation
  ctx.save();
  ctx.translate(0, hubY);
  ctx.rotate(steerAngle);

  // Brushless DC hub motor housing
  const motorR = Math.min(pw, ph) * 0.22;
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, motorR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Wheel Tire Rim
  const wheelR = Math.min(pw, ph) * (isHeavy ? 0.46 : 0.40);

  // Mesh Tire Rim Gradient
  const rimGrad = ctx.createRadialGradient(0, 0, motorR, 0, 0, wheelR);
  rimGrad.addColorStop(0, '#475569');
  rimGrad.addColorStop(0.65, '#334155');
  rimGrad.addColorStop(0.88, '#cbd5e1');
  rimGrad.addColorStop(1, '#0f172a');

  ctx.fillStyle = rimGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Animated Chevron Traction Cleats around tire circumference
  ctx.save();
  ctx.rotate(wheelRot); // Continuous rolling rotation!

  const cleatCount = isHeavy ? 12 : 8;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < cleatCount; i++) {
    const ca = (i * Math.PI * 2) / cleatCount;
    ctx.save();
    ctx.rotate(ca);
    // Chevron V-cleat
    ctx.beginPath();
    ctx.moveTo(-3, wheelR - 4);
    ctx.lineTo(0, wheelR + 1);
    ctx.lineTo(3, wheelR - 4);
    ctx.stroke();
    ctx.restore();
  }

  // Titanium 5-Spoke Wheel Rim
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.4;
  for (let s = 0; s < 5; s++) {
    const sa = (s * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(sa) * (wheelR - 3), Math.sin(sa) * (wheelR - 3));
    ctx.stroke();
  }

  ctx.restore(); // wheelRot

  // Center axle nut
  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // steerAngle
}

/**
 * Renders an Aerodynamic Nose Cone with mathematically pure, fixed-width geometry
 * (Addresses user's issue: cone width remains constant and never distorts unexpectedly)
 */
export function renderFixedOgiveNoseCone(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  options: RenderPartOptions
) {
  const { widthPx: pw, heightPx: ph } = options;
  // Use exact designated half-width: never auto-stretched or altered
  const hw = pw / 2;
  const hh = ph / 2;

  const isSlanted = def.id.includes('slanted');

  if (isSlanted) {
    // Slanted Aerodynamic Booster Nose Cone
    const coneGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
    coneGrad.addColorStop(0, '#94a3b8');
    coneGrad.addColorStop(0.2, '#cbd5e1');
    coneGrad.addColorStop(0.45, '#ffffff');
    coneGrad.addColorStop(0.8, '#cbd5e1');
    coneGrad.addColorStop(1, '#64748b');

    ctx.fillStyle = coneGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;

    ctx.beginPath();
    ctx.moveTo(-hw * 0.35, -hh);
    ctx.quadraticCurveTo(hw * 0.85, -hh * 0.15, hw, hh);
    ctx.lineTo(-hw, hh);
    ctx.quadraticCurveTo(-hw * 0.8, -hh * 0.1, -hw * 0.35, -hh);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Black Ceramic Carbon-Carbon Nose Tip
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-hw * 0.35 - 3, -hh);
    ctx.lineTo(-hw * 0.35 + 3, -hh);
    ctx.lineTo(-hw * 0.35 + 1.5, -hh - 7);
    ctx.lineTo(-hw * 0.35 - 1.5, -hh - 7);
    ctx.closePath();
    ctx.fill();

    // Base Staging Flange Seam
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-hw, hh - 4);
    ctx.lineTo(hw, hh - 4);
    ctx.stroke();
    return;
  }

  // Authentic Tangent Ogive Nose Cone (Standard 2m / 3m)
  const coneGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
  coneGrad.addColorStop(0, '#94a3b8');
  coneGrad.addColorStop(0.18, '#cbd5e1');
  coneGrad.addColorStop(0.45, '#ffffff');
  coneGrad.addColorStop(0.78, '#cbd5e1');
  coneGrad.addColorStop(1, '#64748b');

  ctx.fillStyle = coneGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.8;

  // Pure Tangent Ogive Contour
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.quadraticCurveTo(hw * 0.85, -hh * 0.1, hw, hh);
  ctx.lineTo(-hw, hh);
  ctx.quadraticCurveTo(-hw * 0.85, -hh * 0.1, 0, -hh);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Longitudinal Aerodynamic Specular Highlight Line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.15, -hh + 6);
  ctx.quadraticCurveTo(-hw * 0.15, 0, -hw * 0.15, hh - 6);
  ctx.stroke();

  // Black Ceramic TPS (Thermal Protection System) Nose Cap
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.quadraticCurveTo(hw * 0.3, -hh + 8, hw * 0.3, -hh + 12);
  ctx.lineTo(-hw * 0.3, -hh + 12);
  ctx.quadraticCurveTo(-hw * 0.3, -hh + 8, 0, -hh);
  ctx.closePath();
  ctx.fill();

  // Titanium Pitot-Static Aerodynamic Probe Tube
  ctx.fillStyle = '#475569';
  ctx.fillRect(-1.5, -hh - 8, 3, 8);
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(0, -hh - 8, 2, 0, Math.PI * 2);
  ctx.fill();

  // Base Interstage Ring Seam & Explosive Release Bolts
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-hw, hh - 5);
  ctx.lineTo(hw, hh - 5);
  ctx.stroke();

  // Aero Flush Rivets along base
  ctx.fillStyle = '#64748b';
  const rivets = 5;
  for (let r = 1; r < rivets; r++) {
    const rx = -hw + (pw / rivets) * r;
    ctx.beginPath();
    ctx.arc(rx, hh - 2.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * High-Fidelity Multi-Architecture Animated Parachute System
 * Supports distinct folding & unfolding animations for:
 * 1. Mk16 Main Hemispherical Canopy (Scalloped 12-gore dome with apex vent)
 * 2. High-Speed Supersonic Ribbon Drogue (Annular slotted ribbons & Kevlar bridles)
 * 3. Steerable Ram-Air Parafoil Wing (Multi-cell aerodynamic airfoil with open ram intakes & steering toggles)
 * 4. Apollo Tri-Canopy Recovery Cluster (Three synchronized radial canopies with spreader bridles)
 */
export function renderAnimatedParachute(
  ctx: CanvasRenderingContext2D,
  def: PartDefinition,
  options: RenderPartOptions,
  stage: 'STOWED' | 'PILOT' | 'DROGUE' | 'MAIN' = 'STOWED'
) {
  const { widthPx: pw, heightPx: ph } = options;
  const hw = pw / 2;
  const hh = ph / 2;

  // Compute smooth progress (0.0 = completely folded/stowed, 1.0 = fully blossoming/open)
  let progress = options.deployProgress !== undefined
    ? options.deployProgress
    : (options.deployed ? 1.0 : (stage === 'MAIN' ? 1.0 : stage === 'DROGUE' ? 0.65 : stage === 'PILOT' ? 0.25 : 0.0));
  progress = Math.max(0, Math.min(1, progress));

  const chuteType = options.parachuteType || def.parachuteType || (
    def.id.includes('drogue') ? 'parachute_drogue' :
    def.id.includes('ram') ? 'parachute_ram_air' :
    def.id.includes('cluster') ? 'parachute_tri_cluster' : 'parachute_main'
  );

  // 1. Aerodynamic Parachute Canister Housing (Base attached to spacecraft)
  const packGrad = ctx.createLinearGradient(-hw, 0, hw, 0);
  packGrad.addColorStop(0, '#cbd5e1');
  packGrad.addColorStop(0.3, '#f8fafc');
  packGrad.addColorStop(0.7, '#e2e8f0');
  packGrad.addColorStop(1, '#94a3b8');

  ctx.fillStyle = packGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -hh);
  ctx.quadraticCurveTo(hw * 0.7, -hh * 0.2, hw * 0.8, hh);
  ctx.lineTo(-hw * 0.8, hh);
  ctx.quadraticCurveTo(-hw * 0.7, -hh * 0.2, 0, -hh);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Mortar Tube Rim
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(0, -hh, hw * 0.45, 3, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 2. High-Vis Mortar Cap / Cover (Animates flying off as chute unfolds)
  if (progress < 0.02) {
    // Stowed / Fully Folded: Protective orange mortar cap is clamped shut
    ctx.fillStyle = '#ea580c';
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -hh - 3);
    ctx.quadraticCurveTo(hw * 0.45, -hh * 0.5, hw * 0.5, -hh * 0.2);
    ctx.lineTo(-hw * 0.5, -hh * 0.2);
    ctx.quadraticCurveTo(-hw * 0.45, -hh * 0.5, 0, -hh - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Locking pins
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(-hw * 0.35, -hh * 0.35, 1.5, 0, Math.PI * 2);
    ctx.arc(hw * 0.35, -hh * 0.35, 1.5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Cap jettisons upward and drifts with smoke puff
  if (progress < 0.5) {
    const capDist = -hh - 6 - progress * 40;
    ctx.save();
    ctx.translate(progress * 8, capDist);
    ctx.rotate(progress * 1.8);
    ctx.fillStyle = '#ea580c';
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.ellipse(0, 0, hw * 0.35, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Mortar gas cloud
    ctx.fillStyle = 'rgba(241, 245, 249, 0.4)';
    ctx.beginPath();
    ctx.arc(0, -hh - 4, 3 + progress * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Dispatch to Specific Architecture
  if (chuteType === 'parachute_drogue') {
    renderAnimatedDrogueParachute(ctx, hw, hh, pw, ph, progress);
  } else if (chuteType === 'parachute_ram_air') {
    renderAnimatedRamAirParachute(ctx, hw, hh, pw, ph, progress);
  } else if (chuteType === 'parachute_tri_cluster') {
    renderAnimatedClusterParachute(ctx, hw, hh, pw, ph, progress);
  } else {
    renderAnimatedMainParachute(ctx, hw, hh, pw, ph, progress);
  }
}

/**
 * 1. Mk16 Main Hemispherical Canopy (12-Gore Scalloped Dome with Apex Vent)
 */
function renderAnimatedMainParachute(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number
) {
  // Phase 1: Pilot Chute Extraction (progress 0.02 - 0.3)
  if (progress <= 0.28) {
    const pilotProgress = progress / 0.28;
    const pilotY = -hh - ph * (1.2 + pilotProgress * 2.5);
    const pRadius = pw * (0.15 + pilotProgress * 0.35);

    // Extraction bridle
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(0, pilotY + pRadius);
    ctx.stroke();

    // Pilot chute dome
    const pGrad = ctx.createLinearGradient(-pRadius, pilotY, pRadius, pilotY);
    pGrad.addColorStop(0, '#ea580c');
    pGrad.addColorStop(0.5, '#ffffff');
    pGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = pGrad;
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.arc(0, pilotY, pRadius, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return;
  }

  // Phase 2 & 3: Main Canopy Unfolding & Blossoming (progress 0.28 - 1.0)
  const blossomP = (progress - 0.28) / 0.72; // 0 to 1
  const canopyDist = -hh - ph * (3.5 + blossomP * 4.5);
  const maxRadius = pw * 3.0;
  // Radius expands with a realistic non-linear ballooning curve
  const curRadius = maxRadius * (0.25 + 0.75 * Math.sin(blossomP * Math.PI * 0.5));

  // Catenary Braided Suspension Lines (6 braided pairs)
  const numLines = 6;
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.lineWidth = 1.1;
  for (let i = 0; i <= numLines; i++) {
    const frac = (i / numLines) * 2 - 1; // -1 to 1
    const lineSkirtX = frac * curRadius * 0.95;
    const lineSkirtY = canopyDist + curRadius * 0.25;

    ctx.beginPath();
    ctx.moveTo(frac * hw * 0.5, -hh);
    ctx.lineTo(lineSkirtX, lineSkirtY);
    ctx.stroke();
  }

  // Reefing collar indicator when semi-deployed (progress < 0.75)
  if (progress < 0.75) {
    const reefY = canopyDist + curRadius * 0.28;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, reefY, curRadius * 0.45, 0, Math.PI);
    ctx.stroke();
  }

  // Hemispherical Nylon 12-Gore Canopy
  const mGrad = ctx.createLinearGradient(-curRadius, canopyY(canopyDist), curRadius, canopyY(canopyDist));
  mGrad.addColorStop(0.00, '#dc2626');
  mGrad.addColorStop(0.18, '#f8fafc');
  mGrad.addColorStop(0.36, '#dc2626');
  mGrad.addColorStop(0.50, '#f8fafc');
  mGrad.addColorStop(0.64, '#dc2626');
  mGrad.addColorStop(0.82, '#f8fafc');
  mGrad.addColorStop(1.00, '#dc2626');

  ctx.fillStyle = mGrad;
  ctx.strokeStyle = '#991b1b';
  ctx.lineWidth = 1.8;

  // Dome Outline with Scalloped Skirt
  ctx.beginPath();
  ctx.arc(0, canopyDist + curRadius * 0.1, curRadius, Math.PI, 0, false);

  // Scalloped bottom hemline connecting gores
  const scallops = 8;
  for (let s = scallops; s >= 0; s--) {
    const sx = -curRadius + (curRadius * 2 / scallops) * s;
    const sy = canopyDist + curRadius * 0.1 + Math.sin((s / scallops) * Math.PI) * (curRadius * 0.2);
    if (s === scallops) {
      ctx.lineTo(sx, sy);
    } else {
      ctx.quadraticCurveTo(sx + (curRadius / scallops), sy + 3, sx, sy);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Apex Pressure Relief Vent Hole
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.ellipse(0, canopyDist - curRadius * 0.85, curRadius * 0.18, curRadius * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.0;
  ctx.stroke();
}

function canopyY(y: number): number {
  return y;
}

/**
 * 2. High-Speed Supersonic Ribbon Drogue (Annular Slotted Ribbons & Kevlar Bridles)
 */
function renderAnimatedDrogueParachute(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number
) {
  const drogueY = -hh - ph * (2.0 + progress * 3.5);
  const maxRadius = pw * 1.5;
  const curRadius = maxRadius * (0.2 + 0.8 * progress);

  // High-Tension Kevlar Bridles
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.4, -hh);
  ctx.lineTo(-curRadius * 0.6, drogueY + curRadius * 0.8);
  ctx.moveTo(hw * 0.4, -hh);
  ctx.lineTo(curRadius * 0.6, drogueY + curRadius * 0.8);
  ctx.moveTo(0, -hh);
  ctx.lineTo(0, drogueY + curRadius * 0.8);
  ctx.stroke();

  // Supersonic Conical Ribbon Skirt (5 distinct slotted ribbon bands with open gaps)
  const numRibbons = 5;
  for (let r = 0; r < numRibbons; r++) {
    const rFracTop = r / numRibbons;
    const rFracBot = (r + 0.75) / numRibbons;

    const yTop = drogueY + curRadius * (0.1 + rFracTop * 0.7);
    const yBot = drogueY + curRadius * (0.1 + rFracBot * 0.7);
    const wTop = curRadius * (0.35 + rFracTop * 0.65);
    const wBot = curRadius * (0.35 + rFracBot * 0.65);

    const ribbonGrad = ctx.createLinearGradient(-wBot, yTop, wBot, yTop);
    ribbonGrad.addColorStop(0, '#ea580c');
    ribbonGrad.addColorStop(0.5, r % 2 === 0 ? '#ffffff' : '#f97316');
    ribbonGrad.addColorStop(1, '#ea580c');

    ctx.fillStyle = ribbonGrad;
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(-wTop, yTop);
    ctx.lineTo(wTop, yTop);
    ctx.lineTo(wBot, yBot);
    ctx.lineTo(-wBot, yBot);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Supersonic Center Spike / Vent Spindle
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, drogueY - curRadius * 0.3);
  ctx.lineTo(0, drogueY + curRadius * 0.2);
  ctx.stroke();
}

/**
 * 3. Steerable Ram-Air Parafoil Wing (Multi-Cell Aerofoil with Open Intakes & Control Lines)
 */
function renderAnimatedRamAirParachute(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number
) {
  const wingY = -hh - ph * (3.0 + progress * 4.0);
  const fullSpan = pw * 4.4;
  // Span unfolds accordion-style from center outward
  const curSpan = fullSpan * (0.15 + 0.85 * progress);
  const wingChord = ph * (0.8 + 0.7 * progress);

  // Left and Right Suspension Line Cascades
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.lineWidth = 1.0;
  const numCascade = 5;
  for (let c = 0; c < numCascade; c++) {
    const spanFrac = (c / (numCascade - 1)) * 2 - 1;
    ctx.beginPath();
    ctx.moveTo(spanFrac * hw * 0.6, -hh);
    ctx.lineTo((spanFrac * curSpan * 0.45), wingY + wingChord * 0.4);
    ctx.stroke();
  }

  // Steering Toggle Lines (trailing edge brakes)
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-hw * 0.8, -hh);
  ctx.lineTo(-curSpan * 0.48, wingY + wingChord * 0.6);
  ctx.moveTo(hw * 0.8, -hh);
  ctx.lineTo(curSpan * 0.48, wingY + wingChord * 0.6);
  ctx.stroke();

  // Rectangular Wing Skin (Upper Surface Camber)
  const wingGrad = ctx.createLinearGradient(-curSpan / 2, wingY, curSpan / 2, wingY);
  wingGrad.addColorStop(0, '#0284c7');
  wingGrad.addColorStop(0.25, '#38bdf8');
  wingGrad.addColorStop(0.5, '#ffffff');
  wingGrad.addColorStop(0.75, '#38bdf8');
  wingGrad.addColorStop(1, '#0284c7');

  ctx.fillStyle = wingGrad;
  ctx.strokeStyle = '#0369a1';
  ctx.lineWidth = 1.6;

  // Upper cambered airfoil shape
  ctx.beginPath();
  ctx.moveTo(-curSpan / 2, wingY + wingChord * 0.4);
  ctx.quadraticCurveTo(0, wingY - wingChord * 0.3, curSpan / 2, wingY + wingChord * 0.4);
  ctx.lineTo(curSpan / 2 * 0.95, wingY + wingChord * 0.65);
  ctx.quadraticCurveTo(0, wingY + wingChord * 0.1, -curSpan / 2 * 0.95, wingY + wingChord * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Ram-Air Open Intake Mouth Cells across leading edge (when unfolded > 0.4)
  if (progress > 0.35) {
    const numCells = 7;
    const cellW = (curSpan * 0.9) / numCells;
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < numCells; i++) {
      const cx = -curSpan * 0.45 + i * cellW;
      const cy = wingY + wingChord * 0.15;
      ctx.beginPath();
      ctx.ellipse(cx + cellW * 0.5, cy, cellW * 0.38, 2.5 * progress, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Cell vertical rib partition line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.moveTo(cx + cellW, cy - 3);
      ctx.lineTo(cx + cellW, cy + wingChord * 0.35);
      ctx.stroke();
    }
  }
}

/**
 * 4. Apollo Tri-Canopy Recovery Cluster (Three Synchronized Radial Canopies with Spreader Bridles)
 */
function renderAnimatedClusterParachute(
  ctx: CanvasRenderingContext2D,
  hw: number,
  hh: number,
  pw: number,
  ph: number,
  progress: number
) {
  const clusterDist = -hh - ph * (3.8 + progress * 4.8);
  const singleRadius = pw * 1.8 * (0.2 + 0.8 * progress);

  // Triple Mortar Canister Openings on Base
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(-hw * 0.4, -hh, 2.5, 0, Math.PI * 2);
  ctx.arc(0, -hh - 1, 2.5, 0, Math.PI * 2);
  ctx.arc(hw * 0.4, -hh, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Three canopies: Center (0°), Left (-18°), Right (+18°)
  const canopies = [
    { angle: -0.28, xOffset: -singleRadius * 1.05 * progress, yOffset: 4 },
    { angle: 0.0, xOffset: 0, yOffset: -singleRadius * 0.25 * progress },
    { angle: 0.28, xOffset: singleRadius * 1.05 * progress, yOffset: 4 },
  ];

  canopies.forEach((c) => {
    const cx = c.xOffset;
    const cy = clusterDist + c.yOffset;

    // Suspension Lines for this chute
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(cx * 0.3, -hh);
    ctx.lineTo(cx - singleRadius * 0.8, cy + singleRadius * 0.2);
    ctx.moveTo(cx * 0.3, -hh);
    ctx.lineTo(cx, cy + singleRadius * 0.25);
    ctx.moveTo(cx * 0.3, -hh);
    ctx.lineTo(cx + singleRadius * 0.8, cy + singleRadius * 0.2);
    ctx.stroke();

    // Canopy Dome
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(c.angle * progress);

    const cGrad = ctx.createLinearGradient(-singleRadius, 0, singleRadius, 0);
    cGrad.addColorStop(0, '#ea580c');
    cGrad.addColorStop(0.25, '#ffffff');
    cGrad.addColorStop(0.5, '#ea580c');
    cGrad.addColorStop(0.75, '#ffffff');
    cGrad.addColorStop(1, '#ea580c');

    ctx.fillStyle = cGrad;
    ctx.strokeStyle = '#c2410c';
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    ctx.arc(0, 0, singleRadius, Math.PI, 0, false);
    ctx.quadraticCurveTo(0, singleRadius * 0.35, -singleRadius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Apex hole
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, -singleRadius * 0.82, singleRadius * 0.16, singleRadius * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  // Anti-Collision Spreader Bridle Lines between Canopies
  if (progress > 0.4) {
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Left to center bridle
    ctx.moveTo(canopies[0].xOffset + singleRadius * 0.6, clusterDist + canopies[0].yOffset);
    ctx.lineTo(canopies[1].xOffset - singleRadius * 0.6, clusterDist + canopies[1].yOffset);
    // Center to right bridle
    ctx.moveTo(canopies[1].xOffset + singleRadius * 0.6, clusterDist + canopies[1].yOffset);
    ctx.lineTo(canopies[2].xOffset - singleRadius * 0.6, clusterDist + canopies[2].yOffset);
    ctx.stroke();
  }
}
