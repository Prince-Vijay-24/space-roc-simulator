import { CelestialBodySpec } from './types';

/**
 * HIGH-FIDELITY PLANETARY SURFACE & CELESTIAL RENDERER
 * Procedural rendering for all 14 celestial bodies and their moons with
 * authentic geological features, atmospheric Rayleigh scattering, day/night terminators,
 * and Saturn/Uranus ring projections.
 */
export function drawPlanetarySurface(
  ctx: CanvasRenderingContext2D,
  spec: CelestialBodySpec,
  cx: number,
  cy: number,
  radius: number,
  sunAngle: number,
  zoom: number,
  missionTime: number,
  isHighDetail: boolean
): void {
  if (!spec) return;

  ctx.save();
  ctx.translate(cx, cy);

  // 1. THE SUN (SOL) - Incandescent Chromosphere, Corona & Prominences
  if (spec.id === 'sun') {
    const pulse = 1 + 0.02 * Math.sin(missionTime * 0.8);
    const coronaR = radius * 2.8 * pulse;

    // Deep Solar Corona Glow
    const coronaGrad = ctx.createRadialGradient(0, 0, radius * 0.7, 0, 0, coronaR);
    coronaGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
    coronaGrad.addColorStop(0.3, 'rgba(249, 115, 22, 0.6)');
    coronaGrad.addColorStop(0.65, 'rgba(239, 68, 68, 0.22)');
    coronaGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(0, 0, coronaR, 0, Math.PI * 2);
    ctx.fill();

    // Solar Prominence / Flare Eruptions
    const flareCount = 12;
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.45)';
    ctx.lineWidth = Math.max(1, 2 * zoom * 1000);
    for (let i = 0; i < flareCount; i++) {
      const angle = (i / flareCount) * Math.PI * 2 + missionTime * 0.05;
      const flareLen = radius * (1.2 + 0.35 * Math.sin(missionTime * 1.5 + i * 2.1));
      const fx = Math.cos(angle) * flareLen;
      const fy = Math.sin(angle) * flareLen;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius * 0.95, Math.sin(angle) * radius * 0.95);
      ctx.lineTo(fx, fy);
      ctx.stroke();
    }

    // Solar Core Disk
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.45, '#fef08a');
    coreGrad.addColorStop(0.85, '#f97316');
    coreGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return;
  }

  // 2. BACK HALF OF RINGS (Saturn, Uranus)
  const hasRings = spec.hasRings && spec.ringInnerRadius && spec.ringOuterRadius;
  const ringScale = radius / (spec.radius || 1);
  const tiltRad = (spec.axialTiltDeg || 26.7) * (Math.PI / 180);
  const ringRatioY = 0.28; // Elliptical perspective aspect ratio

  if (hasRings) {
    drawRingsHalf(ctx, spec, ringScale, tiltRad, ringRatioY, true);
  }

  // 3. BASE PLANET / MOON SPHERE
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip(); // Clip all surface features strictly within the planetary disk

  // Base spherical lighting gradient
  const lightX = Math.cos(sunAngle) * radius * 0.35;
  const lightY = Math.sin(sunAngle) * radius * 0.35;
  const baseGrad = ctx.createRadialGradient(lightX, lightY, radius * 0.05, 0, 0, radius);
  baseGrad.addColorStop(0, spec.primaryColor);
  baseGrad.addColorStop(0.65, spec.secondaryColor);
  baseGrad.addColorStop(1, spec.accentColor || '#090d16');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

  // 4. AUTHENTIC GEOLOGICAL SURFACE FEATURES & CLOUD DECKS
  drawBodySpecificGeology(ctx, spec, radius, missionTime, isHighDetail);

  // 5. RINGS SHADOW ON PLANET BODY
  if (hasRings) {
    ctx.save();
    ctx.rotate(tiltRad);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.fillRect(-radius * 1.1, -radius * 0.12, radius * 2.2, radius * 0.24);
    ctx.restore();
  }

  // 6. DAY / NIGHT TERMINATOR & NIGHTSIDE ILLUMINATION
  // Vector pointing towards dark side is opposite sunAngle
  const darkAngle = sunAngle + Math.PI;
  const darkX = Math.cos(darkAngle) * radius;
  const darkY = Math.sin(darkAngle) * radius;
  const sunX = Math.cos(sunAngle) * radius;
  const sunY = Math.sin(sunAngle) * radius;

  const terminatorGrad = ctx.createLinearGradient(sunX * 0.2, sunY * 0.2, darkX, darkY);
  terminatorGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  terminatorGrad.addColorStop(0.35, 'rgba(2, 6, 23, 0.25)');
  terminatorGrad.addColorStop(0.65, 'rgba(2, 6, 23, 0.75)');
  terminatorGrad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
  ctx.fillStyle = terminatorGrad;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

  // Earth nightside city lights
  if (spec.id === 'earth' && isHighDetail) {
    drawEarthCityLights(ctx, radius, darkAngle);
  }

  ctx.restore(); // End planet sphere clip

  // 7. FRONT HALF OF RINGS
  if (hasRings) {
    drawRingsHalf(ctx, spec, ringScale, tiltRad, ringRatioY, false);
  }

  // 8. ATMOSPHERIC TWILIGHT RIM SCATTERING
  if (spec.hasAtmosphere && radius > 3) {
    ctx.save();
    const atmoRimGrad = ctx.createRadialGradient(0, 0, radius * 0.92, 0, 0, radius * 1.06);
    atmoRimGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    atmoRimGrad.addColorStop(0.6, spec.atmosphereRimColor || 'rgba(125, 211, 252, 0.45)');
    atmoRimGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmoRimGrad;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Draws either the back half or front half of planetary rings with Cassini division
 */
function drawRingsHalf(
  ctx: CanvasRenderingContext2D,
  spec: CelestialBodySpec,
  ringScale: number,
  tiltRad: number,
  ratioY: number,
  isBackHalf: boolean
) {
  const innerR = (spec.ringInnerRadius || 1) * ringScale;
  const outerR = (spec.ringOuterRadius || 2) * ringScale;
  if (outerR <= innerR || outerR < 2) return;

  ctx.save();
  ctx.rotate(tiltRad);

  // Clip to either top half (back) or bottom half (front)
  ctx.beginPath();
  if (isBackHalf) {
    ctx.rect(-outerR * 1.2, -outerR * ratioY * 1.2, outerR * 2.4, outerR * ratioY * 1.2);
  } else {
    ctx.rect(-outerR * 1.2, 0, outerR * 2.4, outerR * ratioY * 1.2);
  }
  ctx.clip();

  // Draw main ring disc
  const ringGrad = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
  ringGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  ringGrad.addColorStop(0.12, spec.ringSecondaryColor || 'rgba(226, 232, 240, 0.45)');
  ringGrad.addColorStop(0.5, spec.ringColor || 'rgba(254, 240, 138, 0.75)');
  ringGrad.addColorStop(0.62, 'rgba(15, 23, 42, 0.1)'); // Cassini Division Gap
  ringGrad.addColorStop(0.72, spec.ringColor || 'rgba(254, 240, 138, 0.65)');
  ringGrad.addColorStop(0.95, spec.ringSecondaryColor || 'rgba(203, 213, 225, 0.35)');
  ringGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.scale(1, ratioY);
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(0, 0, outerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * High-realism distinctive geological formations for every celestial body
 */
function drawBodySpecificGeology(
  ctx: CanvasRenderingContext2D,
  spec: CelestialBodySpec,
  r: number,
  missionTime: number,
  isHighDetail: boolean
) {
  switch (spec.id) {
    case 'earth': {
      // Continents
      ctx.fillStyle = '#15803d'; // Lush continent green
      ctx.beginPath();
      // Africa & Eurasia
      ctx.ellipse(r * 0.15, -r * 0.1, r * 0.38, r * 0.42, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Americas
      ctx.beginPath();
      ctx.ellipse(-r * 0.45, -r * 0.05, r * 0.24, r * 0.55, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Sahara Desert
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath();
      ctx.ellipse(r * 0.15, -r * 0.18, r * 0.22, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      // White Polar Ice Caps
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.88, r * 0.45, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, r * 0.88, r * 0.52, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      // Drifting White Atmospheric Weather Clouds
      if (isHighDetail) {
        const cloudShift = (missionTime * 0.008) % (r * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.2 + (cloudShift % (r * 1.5)), -r * 0.3, r * 0.35, r * 0.1, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.3 - (cloudShift % (r * 1.5)), r * 0.25, r * 0.45, r * 0.12, -0.25, 0, Math.PI * 2);
        ctx.fill();
        // Cyclonic storm swirl
        ctx.beginPath();
        ctx.arc(-r * 0.35, r * 0.15, r * 0.14, 0, Math.PI * 1.6);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = Math.max(1, r * 0.03);
        ctx.stroke();
      }
      break;
    }

    case 'moon': {
      // Lunar Maria (Dark Basalt Plains)
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(-r * 0.22, -r * 0.18, r * 0.32, r * 0.26, -0.3, 0, Math.PI * 2); // Mare Imbrium
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.24, -r * 0.12, r * 0.26, r * 0.2, 0.2, 0, Math.PI * 2); // Mare Tranquillitatis
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-r * 0.38, r * 0.08, r * 0.28, r * 0.34, 0.1, 0, Math.PI * 2); // Oceanus Procellarum
      ctx.fill();
      // Tycho Impact Crater with radiating ejecta rays
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.arc(r * 0.12, r * 0.48, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.35)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const ra = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(r * 0.12, r * 0.48);
        ctx.lineTo(r * 0.12 + Math.cos(ra) * r * 0.45, r * 0.48 + Math.sin(ra) * r * 0.45);
        ctx.stroke();
      }
      break;
    }

    case 'mars': {
      // Dark Basalt Lowlands & Syrtis Major
      ctx.fillStyle = '#7c2d12';
      ctx.beginPath();
      ctx.ellipse(r * 0.15, -r * 0.05, r * 0.35, r * 0.28, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Valles Marineris Canyon System
      ctx.fillStyle = '#431407';
      ctx.beginPath();
      ctx.ellipse(-r * 0.1, r * 0.12, r * 0.42, r * 0.06, -0.15, 0, Math.PI * 2);
      ctx.fill();
      // Olympus Mons Shield Volcano
      ctx.fillStyle = '#9a3412';
      ctx.beginPath();
      ctx.arc(-r * 0.45, -r * 0.15, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#431407'; // Caldera
      ctx.beginPath();
      ctx.arc(-r * 0.45, -r * 0.15, r * 0.035, 0, Math.PI * 2);
      ctx.fill();
      // Northern CO2 Polar Cap
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.9, r * 0.36, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'venus': {
      // Super-rotating Sulfuric Acid Cloud Spirals
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.25, r * 0.85, r * 0.14, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, r * 0.3, r * 0.8, r * 0.16, 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'mercury': {
      // Caloris Basin & Heavy Impact Craters
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.1, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(r * 0.25, r * 0.3, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-r * 0.35, r * 0.35, r * 0.08, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'jupiter': {
      // Alternating Zonal Belts and Zones
      const bands = [
        { y: -0.65, h: 0.18, c: '#b45309' }, // North Polar Belt
        { y: -0.38, h: 0.22, c: '#d97706' }, // North Temperate Belt
        { y: -0.14, h: 0.26, c: '#9a3412' }, // North Equatorial Belt
        { y: 0.15, h: 0.28, c: '#b45309' },  // South Equatorial Belt
        { y: 0.48, h: 0.22, c: '#d97706' },  // South Temperate Belt
      ];
      bands.forEach((b) => {
        ctx.fillStyle = b.c;
        ctx.fillRect(-r, b.y * r - (b.h * r) / 2, r * 2, b.h * r);
      });
      // THE GREAT RED SPOT (Iconic anticyclonic vortex)
      ctx.fillStyle = '#dc2626'; // Deep crimson red spot
      ctx.beginPath();
      ctx.ellipse(r * 0.32, r * 0.22, r * 0.28, r * 0.18, -0.05, 0, Math.PI * 2);
      ctx.fill();
      // Internal vortex eye
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.ellipse(r * 0.32, r * 0.22, r * 0.14, r * 0.08, -0.05, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'saturn': {
      // Subtle Golden Cloud Belts
      const bands = [
        { y: -0.5, h: 0.22, c: '#ca8a04' },
        { y: -0.15, h: 0.28, c: '#d97706' },
        { y: 0.25, h: 0.24, c: '#ca8a04' },
      ];
      bands.forEach((b) => {
        ctx.fillStyle = b.c;
        ctx.fillRect(-r, b.y * r - (b.h * r) / 2, r * 2, b.h * r);
      });
      // North Polar Hexagon Vortex
      ctx.fillStyle = '#854d0e';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.88, r * 0.3, r * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'uranus': {
      // Cyan Aquamarine Methane Haze & Faint Polar Hood
      ctx.fillStyle = 'rgba(165, 243, 252, 0.45)';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.82, r * 0.65, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'neptune': {
      // Azure Storm Bands & Great Dark Spot
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.fillRect(-r, -r * 0.2, r * 2, r * 0.35);
      // Great Dark Spot (anticyclone)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, -r * 0.08, r * 0.26, r * 0.16, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // White Methane Cirrus Clouds ("Scooter")
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(r * 0.18, r * 0.22, r * 0.22, r * 0.05, -0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'europa': {
      // Smooth Bright Water-Ice Shell with Reddish-Brown Lineae (Fracture cracks)
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = Math.max(1, r * 0.035);
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.2);
      ctx.bezierCurveTo(-r * 0.2, -r * 0.5, r * 0.3, 0, r * 0.75, r * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.6);
      ctx.bezierCurveTo(0, r * 0.2, r * 0.4, -r * 0.3, r * 0.65, -r * 0.5);
      ctx.stroke();
      break;
    }

    case 'io': {
      // Volcanic Sulfur Plain with Dark Calderas
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.2, r * 0.1, 0, Math.PI * 2); // Pele Caldera
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.25, r * 0.15, r * 0.14, 0, Math.PI * 2); // Loki Patera
      ctx.fill();
      break;
    }

    case 'titan': {
      // Dense Photochemical Orange Smog & Polar Hydrocarbon Lakes
      ctx.fillStyle = '#0f172a'; // Liquid methane lakes near north pole
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.75, r * 0.32, r * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'pluto': {
      // Nitrogen-Ice Tombaugh Regio ("Pluto's Heart")
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(r * 0.15, r * 0.05, r * 0.35, r * 0.42, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Dark Cthulhu Macula equatorial belt
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.ellipse(-r * 0.45, r * 0.18, r * 0.38, r * 0.22, -0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'charon': {
      // Dark Tholin-Stained North Pole (Mordor Macula)
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.78, r * 0.45, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    default:
      break;
  }
}

/**
 * Renders twinkling city lights on the unlit nightside of Earth
 */
function drawEarthCityLights(ctx: CanvasRenderingContext2D, r: number, darkAngle: number) {
  ctx.save();
  const dx = Math.cos(darkAngle) * r * 0.45;
  const dy = Math.sin(darkAngle) * r * 0.45;
  ctx.fillStyle = '#fef08a';
  ctx.globalAlpha = 0.75;
  // Clusters representing metropolitan centers on nightside
  const clusters = [
    { x: dx - r * 0.1, y: dy - r * 0.05, s: 1.2 },
    { x: dx + r * 0.15, y: dy + r * 0.1, s: 1.5 },
    { x: dx - r * 0.05, y: dy + r * 0.12, s: 1.0 },
    { x: dx + r * 0.05, y: dy - r * 0.12, s: 1.3 },
  ];
  clusters.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.s, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/**
 * HIGH-FIDELITY PROCEDURAL LOCAL TERRAIN SURFACE RENDERER
 * Renders authentic, vast, curved planetary ground contours, subterranean geological strata,
 * surface rock textures, and feature outcroppings for any celestial body when in flight view.
 */
export function drawLocalTerrainSurface(
  ctx: CanvasRenderingContext2D,
  spec: CelestialBodySpec,
  bodyCenterX: number,
  bodyCenterY: number,
  vesselX: number,
  vesselY: number,
  vesselAltitude: number,
  zoom: number,
  _sunAngle: number = -Math.PI * 0.25
): void {
  if (!spec || !spec.radius) return;

  const land = spec.landSurface;
  const bodyR = spec.radius;
  const relX = vesselX - bodyCenterX;
  const relY = vesselY - bodyCenterY;
  const centerAngle = Math.atan2(relY, relX);

  // Determine visible angular arc based on camera zoom and altitude
  const visibleSpanMeters = Math.max(500, 2000 / Math.max(0.0001, zoom));
  const arcSpan = Math.min(Math.PI * 0.85, Math.max(0.02, (visibleSpanMeters * 1.5) / bodyR));
  const halfArc = arcSpan * 0.6;
  const steps = 90;

  // Sample terrain profile
  const surfacePoints: Array<{ x: number; y: number; angle: number; height: number }> = [];
  const subterraneanPoints: Array<{ x: number; y: number }> = [];

  const depthMeters = Math.min(bodyR * 0.4, Math.max(500, 800 / Math.max(0.0001, zoom)));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = centerAngle - halfArc + t * (halfArc * 2);

    let h = 0;
    if (land?.getHeightAtAngle) {
      h = land.getHeightAtAngle(a);
    }

    const rSurface = bodyR + h;
    const rSub = Math.max(10, bodyR + h - depthMeters);

    surfacePoints.push({
      x: bodyCenterX + Math.cos(a) * rSurface,
      y: bodyCenterY + Math.sin(a) * rSurface,
      angle: a,
      height: h,
    });

    subterraneanPoints.push({
      x: bodyCenterX + Math.cos(a) * rSub,
      y: bodyCenterY + Math.sin(a) * rSub,
    });
  }

  if (surfacePoints.length < 2) return;

  const centerSample = land?.getTerrainSample ? land.getTerrainSample(centerAngle) : null;
  const strata = centerSample?.strataColors || [
    land?.crustRockColor || spec.secondaryColor,
    land?.secondaryColor || spec.primaryColor,
    land?.shadowColor || '#0f172a',
    '#020617',
  ];

  ctx.save();

  // 1. Draw Subterranean Bedrock Strata (Multi-layered gradient fill)
  const pStart = surfacePoints[0];
  const pMid = surfacePoints[Math.floor(surfacePoints.length / 2)];
  const pSubMid = subterraneanPoints[Math.floor(subterraneanPoints.length / 2)];

  const strataGrad = ctx.createLinearGradient(pMid.x, pMid.y, pSubMid.x, pSubMid.y);
  strataGrad.addColorStop(0, strata[0] || land?.crustRockColor || '#334155');
  strataGrad.addColorStop(0.3, strata[1] || land?.secondaryColor || '#1e293b');
  strataGrad.addColorStop(0.7, strata[2] || land?.shadowColor || '#0f172a');
  strataGrad.addColorStop(1, strata[3] || '#020617');

  ctx.fillStyle = strataGrad;
  ctx.beginPath();
  ctx.moveTo(pStart.x, pStart.y);
  for (let i = 1; i < surfacePoints.length; i++) {
    ctx.lineTo(surfacePoints[i].x, surfacePoints[i].y);
  }
  for (let i = subterraneanPoints.length - 1; i >= 0; i--) {
    ctx.lineTo(subterraneanPoints[i].x, subterraneanPoints[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // 2. Surface Topsoil & Regolith Crust
  ctx.strokeStyle = centerSample?.surfaceColor || land?.baseColor || spec.primaryColor;
  ctx.lineWidth = Math.max(1.8 / zoom, 2.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pStart.x, pStart.y);
  for (let i = 1; i < surfacePoints.length; i++) {
    ctx.lineTo(surfacePoints[i].x, surfacePoints[i].y);
  }
  ctx.stroke();

  // 3. Subtle Surface Glow / Dust Haze when close to ground
  if (vesselAltitude < 4000) {
    ctx.strokeStyle = land?.soilDustColor || land?.highlightColor || '#cbd5e1';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(0.8 / zoom, 1.2);
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    for (let i = 1; i < surfacePoints.length; i++) {
      ctx.lineTo(surfacePoints[i].x, surfacePoints[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }

  // 4. Micro-Relief Boulders & Terrain Geology when zoomed in
  if (zoom > 0.015 && vesselAltitude < 1500) {
    ctx.fillStyle = land?.crustRockColor || '#475569';
    // Scatter procedural boulders along the local ground
    for (let i = 5; i < surfacePoints.length - 5; i += 3) {
      const pt = surfacePoints[i];
      // Deterministic hash based on angle
      const hash = Math.sin(pt.angle * 12345.67) * 43758.5453;
      const rockSize = (0.3 + (Math.abs(hash) % 1.2)) * Math.min(2.5, 0.4 / zoom);
      if (rockSize > 0.1) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - rockSize * 0.3, rockSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

