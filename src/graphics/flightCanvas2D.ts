import { CELESTIAL_BODIES, PART_CATALOG, getPartHeight, getPartWidth } from '../data/parts';
import { SOLAR_SYSTEM_BODIES, drawPlanetarySurface, drawLocalTerrainSurface } from '../data/planets';
import { OrbitalMath } from '../physics/orbitalMath';
import { physicsEngine } from '../physics/physicsEngine';
import { DebrisObject, OrbitParameters, PlacedPart, VesselState, JunoEngineConfig } from '../types';
import { drawInterstageShroudDirect, drawPart2D, drawJunoEnginePlume2D } from './partRenderer2D';
import { calculateJunoEnginePerformance, DEFAULT_JUNO_ENGINE_CONFIG } from '../physics/rocketPropulsion';

// Canvas roundRect polyfill
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

export type CameraFocusTarget = 'vessel' | 'earth' | 'moon' | 'system';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  secondaryColor?: string;
  shape?: 'circle' | 'diamond' | 'streak' | 'ring' | 'spark' | 'smoke_puff';
  life: number;
  maxLife: number;
  growth?: number;
  drag?: number;
}

interface ExplosionShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface ReentryVaporParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxSize: number;
  alpha: number;
  color: string;
  isPlasma: boolean;
  life: number;
  maxLife: number;
  turbX: number;
  turbY: number;
}

export class FlightCanvas2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement | null = null;
  private isDestroyed = false;

  // Camera & Viewport
  public zoom = 6.0; // Pixels per meter in Flight mode
  public targetZoom = 6.0;
  public cameraX = 0;
  public cameraY = 0;
  public cameraRotation = 0; // Flight mode camera rotation to keep land on bottom
  public manualPanOffsetX = 0;
  public manualPanOffsetY = 0;
  private flightPanOffsetX = 0;
  private flightPanOffsetY = 0;
  private mapPanOffsetX = 0;
  private mapPanOffsetY = 0;
  public isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private hasDragged = false;

  // Display Mode
  public isMapMode = false;
  public focusTarget: CameraFocusTarget = 'vessel';

  // Particle systems
  private flameParticles: Particle[] = [];
  private smokeParticles: Particle[] = [];
  private sparkParticles: Particle[] = [];
  private rcsParticles: Particle[] = [];
  private explosionParticles: Particle[] = [];
  private shockwaves: ExplosionShockwave[] = [];
  private reentryVaporParticles: ReentryVaporParticle[] = [];

  // Starfield and Deep Space Background
  private stars: { x: number; y: number; size: number; brightness: number; color: string; speed: number }[] = [];
  // Volumetric Troposphere Clouds
  private clouds: { x: number; y: number; width: number; height: number; speed: number; opacity: number }[] = [];

  // Cache
  private currentVessel: VesselState | null = null;
  public onPartClick?: (partUid: string) => void;
  private engineIgnitionTimes: Map<string, number> = new Map();

  public constructor(container: HTMLElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'flight-canvas-2d';
    this.canvas.className = 'w-full h-full block select-none cursor-grab active:cursor-grabbing';
    container.appendChild(this.canvas);

    const context = this.canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get 2D canvas context');
    this.ctx = context;

    this.initStarfield();
    this.initClouds();
    this.handleResize();
    this.attachEventListeners();
  }

  private initStarfield() {
    this.stars = [];
    const colors = ['#ffffff', '#f8fafc', '#bae6fd', '#fef08a', '#fed7aa', '#f43f5e'];
    for (let i = 0; i < 900; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.stars.push({
        x: Math.random() * 3000 - 1500,
        y: Math.random() * 3000 - 1500,
        size: Math.random() * 1.8 + 0.3,
        brightness: Math.random() * 0.75 + 0.25,
        color,
        speed: Math.random() * 0.00003 + 0.00001,
      });
    }
  }

  private initClouds() {
    this.clouds = [];
    const earthR = physicsEngine.earth.radius;
    // Distribute clouds between 1200m and 3200m altitude
    for (let i = 0; i < 45; i++) {
      this.clouds.push({
        x: (Math.random() - 0.5) * 50000,
        y: earthR + 1200 + Math.random() * 2200,
        width: Math.random() * 800 + 400,
        height: Math.random() * 180 + 90,
        speed: (Math.random() - 0.5) * 6 + 4, // Eastward tropospheric prevailing wind
        opacity: Math.random() * 0.35 + 0.55,
      });
    }
  }

  private attachEventListeners() {
    window.addEventListener('resize', this.handleResize);
    this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('click', this.handleClick);
  }

  private handleResize = () => {
    if (this.isDestroyed || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.scale(dpr, dpr);
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.8 : 1.25;
    if (this.isMapMode) {
      this.targetZoom = Math.max(0.000002, Math.min(0.05, this.targetZoom * zoomFactor));
    } else {
      this.targetZoom = Math.max(0.05, Math.min(80, this.targetZoom * zoomFactor));
    }
  };

  private handleMouseDown = (e: MouseEvent) => {
    this.isPanning = true;
    this.hasDragged = false;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isPanning) return;
    const dist = Math.hypot(e.clientX - this.panStartX, e.clientY - this.panStartY);
    if (dist > 4) {
      this.hasDragged = true;
    }
    const screenDx = (e.clientX - this.panStartX) / this.zoom;
    const screenDy = (e.clientY - this.panStartY) / this.zoom;
    let dx = screenDx;
    let dy = screenDy;
    if (!this.isMapMode && this.cameraRotation !== 0) {
      const cosR = Math.cos(this.cameraRotation);
      const sinR = Math.sin(this.cameraRotation);
      dx = screenDx * cosR + screenDy * sinR;
      dy = -screenDx * sinR + screenDy * cosR;
    }
    this.manualPanOffsetX -= dx;
    this.manualPanOffsetY += dy;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
  };

  private handleMouseUp = () => {
    this.isPanning = false;
  };

  private handleClick = (e: MouseEvent) => {
    if (this.hasDragged || this.isMapMode || !this.currentVessel) return;

    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = rect.width;
    const height = rect.height;

    // Convert Screen (clickX, clickY) to World (wx, wy)
    const screenCenterOffsetX = clickX - width / 2;
    const screenCenterOffsetY = clickY - height / 2;

    let unscaledX = screenCenterOffsetX / this.zoom;
    let unscaledY = -screenCenterOffsetY / this.zoom;
    if (!this.isMapMode && this.cameraRotation !== 0) {
      const cosR = Math.cos(-this.cameraRotation);
      const sinR = Math.sin(-this.cameraRotation);
      const rx = unscaledX * cosR - unscaledY * sinR;
      const ry = unscaledX * sinR + unscaledY * cosR;
      unscaledX = rx;
      unscaledY = ry;
    }

    const worldX = this.cameraX + unscaledX;
    const worldY = this.cameraY + unscaledY;

    // Transform world coord into vessel local space
    const v = this.currentVessel;
    const dx = worldX - v.x;
    const dy = worldY - v.y;

    const cosA = Math.cos(v.angle);
    const sinA = Math.sin(v.angle);

    const localX = dx * cosA + dy * sinA;
    const localY = -dx * sinA + dy * cosA;

    // Hit test against parts
    for (const part of v.parts) {
      const def = PART_CATALOG[part.partId];
      if (!def) continue;

      const partW = getPartWidth(part, def);
      const partH = getPartHeight(part, def);
      const halfW = partW / 2;
      const halfH = partH / 2;

      const dpx = localX - part.x;
      const dpy = localY - part.y;

      const partRotRad = ((part.rotation || 0) * Math.PI) / 180;
      const cosP = Math.cos(partRotRad);
      const sinP = Math.sin(partRotRad);

      const px = dpx * cosP + dpy * sinP;
      const py = -dpx * sinP + dpy * cosP;

      if (Math.abs(px) <= halfW && Math.abs(py) <= halfH) {
        if (this.onPartClick) {
          this.onPartClick(part.uid);
        }
        break;
      }
    }
  };

  public setZoom(z: number) {
    this.targetZoom = Math.max(this.isMapMode ? 0.000002 : 0.05, Math.min(this.isMapMode ? 0.05 : 80, z));
  }

  public setMapMode(map: boolean) {
    if (this.isMapMode === map) return;
    if (map) {
      this.flightPanOffsetX = this.manualPanOffsetX;
      this.flightPanOffsetY = this.manualPanOffsetY;
      this.manualPanOffsetX = this.mapPanOffsetX;
      this.manualPanOffsetY = this.mapPanOffsetY;
      this.targetZoom = 0.0008;
      this.zoom = 0.0008;
    } else {
      this.mapPanOffsetX = this.manualPanOffsetX;
      this.mapPanOffsetY = this.manualPanOffsetY;
      this.manualPanOffsetX = this.flightPanOffsetX;
      this.manualPanOffsetY = this.flightPanOffsetY;
      this.targetZoom = 6.0;
      this.zoom = 6.0;
    }
    this.isMapMode = map;
  }

  public resetCameraToVessel() {
    this.manualPanOffsetX = 0;
    this.manualPanOffsetY = 0;
    this.focusTarget = 'vessel';
  }

  public resetCameraFocus() {
    this.resetCameraToVessel();
  }

  public setFocusTarget(target: CameraFocusTarget) {
    this.focusTarget = target;
    this.manualPanOffsetX = 0;
    this.manualPanOffsetY = 0;
    if (this.isMapMode) {
      if (target === 'system') {
        this.targetZoom = 0.00018;
      } else if (target === 'moon') {
        this.targetZoom = 0.0014;
      } else if (target === 'earth') {
        this.targetZoom = 0.0007;
      } else if (target === 'vessel') {
        this.targetZoom = 0.0008;
      }
    }
  }

  public fitOrbit(vessel: VesselState, orbit: OrbitParameters) {
    if (!this.container) return;
    const rect = this.container.getBoundingClientRect();
    const minDim = Math.min(rect.width, rect.height);

    const earthR = physicsEngine.earth.radius;
    const moonR = physicsEngine.moon.orbitRadius;

    let span = earthR * 2.5;

    if (this.focusTarget === 'moon' || vessel.soi === 'moon') {
      const moonRadius = physicsEngine.moon.radius;
      const ap = orbit.apoapsis > 0 ? orbit.apoapsis : moonRadius;
      span = Math.max(physicsEngine.moon.soiRadius * 2.2, (moonRadius + ap) * 2.4);
    } else if (this.focusTarget === 'system' || (orbit.closestApproachMoon && orbit.closestApproachMoon.intersectsSOI)) {
      span = (moonR + physicsEngine.moon.soiRadius) * 2.4;
    } else if (orbit.isOrbiting && orbit.apoapsis > 0) {
      span = (earthR + orbit.apoapsis) * 2.3;
    } else if (orbit.apoapsis > 0) {
      span = Math.max(earthR * 2.2, (earthR + orbit.apoapsis) * 2.3);
    } else {
      span = (earthR + vessel.altitude) * 2.2;
    }

    const calculatedZoom = Math.max(0.00001, Math.min(0.01, (minDim * 0.85) / span));
    this.targetZoom = calculatedZoom;
    this.zoom = calculatedZoom;
    this.manualPanOffsetX = 0;
    this.manualPanOffsetY = 0;
  }

  /**
   * Spawns multi-layered explosive fireball & debris shockwaves
   */
  public triggerExplosion(worldX: number, worldY: number) {
    this.shockwaves.push({
      x: worldX,
      y: worldY,
      radius: 2,
      maxRadius: 45,
      alpha: 1.0,
      life: 0,
      maxLife: 0.85,
    });

    for (let i = 0; i < 75; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 45 + 10;
      this.explosionParticles.push({
        x: worldX + (Math.random() - 0.5) * 4,
        y: worldY + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2.8 + 1.2,
        alpha: 1.0,
        color: Math.random() > 0.6 ? '#ffffff' : Math.random() > 0.3 ? '#f97316' : '#ef4444',
        life: 0,
        maxLife: Math.random() * 1.2 + 0.6,
        growth: Math.random() * 4.0 + 2.0,
        drag: 0.94,
      });
    }

    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 60 + 20;
      this.sparkParticles.push({
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 0.45 + 0.25,
        alpha: 1.0,
        color: '#fef08a',
        life: 0,
        maxLife: Math.random() * 1.5 + 0.8,
        drag: 0.96,
      });
    }
  }

  /**
   * Spawns explosive decoupler separation flash and sparks
   */
  public triggerStagingEffect(worldX: number, worldY: number, angle: number) {
    this.shockwaves.push({
      x: worldX,
      y: worldY,
      radius: 1,
      maxRadius: 18,
      alpha: 0.9,
      life: 0,
      maxLife: 0.45,
    });

    const perpX = Math.cos(angle);
    const perpY = Math.sin(angle);

    for (let i = 0; i < 28; i++) {
      const side = (Math.random() - 0.5) * 2;
      const speed = Math.random() * 22 + 8;
      this.sparkParticles.push({
        x: worldX + perpX * side * 1.5,
        y: worldY + perpY * side * 1.5,
        vx: perpX * side * speed + (Math.random() - 0.5) * 8,
        vy: perpY * side * speed + (Math.random() - 0.5) * 8,
        size: Math.random() * 0.35 + 0.2,
        alpha: 1.0,
        color: Math.random() > 0.4 ? '#fef08a' : '#f97316',
        life: 0,
        maxLife: Math.random() * 0.6 + 0.3,
        drag: 0.92,
      });
    }
  }

  public render(vessel: VesselState, orbit: OrbitParameters, dt: number) {
    if (this.isDestroyed || !this.container) return;
    this.currentVessel = vessel;

    const rect = this.container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Smooth zoom interpolation
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1.0, dt * 12);
    const minZoom = this.isMapMode ? 0.000002 : 0.05;
    if (isNaN(this.zoom) || !isFinite(this.zoom) || this.zoom < minZoom) {
      this.zoom = minZoom;
    }

    // Calculate local vertical angle (Local UP vector) relative to central celestial body
    let bodyCenterX = 0;
    let bodyCenterY = 0;
    if (vessel.soi === 'moon') {
      bodyCenterX = physicsEngine.moonX;
      bodyCenterY = physicsEngine.moonY;
    }

    const relBodyX = vessel.x - bodyCenterX;
    const relBodyY = vessel.y - bodyCenterY;
    const localUpAngle = Math.atan2(relBodyY, relBodyX);

    // In Flight Mode, orient camera so that Local UP is always pointing UP on screen (surface on bottom)
    if (!this.isMapMode) {
      const targetCamRot = Math.PI / 2 - localUpAngle;
      let angleDiff = targetCamRot - this.cameraRotation;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.cameraRotation += angleDiff * Math.min(1.0, dt * 7.0);
    } else {
      // In Map Mode, keep North-Up inertial orientation
      this.cameraRotation += (0 - this.cameraRotation) * Math.min(1.0, dt * 8.0);
    }

    // Smooth camera tracking of rocket or celestial target
    let baseCamX = vessel.x;
    let baseCamY = vessel.y;
    if (this.focusTarget === 'earth') {
      baseCamX = 0;
      baseCamY = 0;
    } else if (this.focusTarget === 'moon') {
      baseCamX = physicsEngine.moonX;
      baseCamY = physicsEngine.moonY;
    } else if (this.focusTarget === 'system') {
      baseCamX = physicsEngine.moonX * 0.5;
      baseCamY = physicsEngine.moonY * 0.5;
    }

    const targetCamX = baseCamX + this.manualPanOffsetX;
    const targetCamY = baseCamY + this.manualPanOffsetY;
    this.cameraX = targetCamX;
    this.cameraY = targetCamY;

    const ctx = this.ctx;

    // 1. Draw Dynamic Atmospheric Sky, Sun, Starfield & Deep Space
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawSkyAndAtmosphere(ctx, width, height, vessel);

    // 2. Set Up Main Simulation World Camera Transform
    ctx.translate(width / 2, height / 2);

    // Dynamic Camera Screen Shake during liftoff / Max-Q
    if (!this.isMapMode && vessel.throttle > 0.01 && !vessel.isCrashed) {
      const padShake = vessel.altitude < 120 ? (1 - vessel.altitude / 120) * 2.8 : 0;
      const maxQShake = vessel.isMaxQ ? 2.0 : 0;
      const shakeAmt = vessel.throttle * 0.8 + padShake + maxQShake;
      if (shakeAmt > 0.05) {
        ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
      }
    }

    ctx.scale(this.zoom, -this.zoom); // Flip Y so positive is up
    if (!this.isMapMode && Math.abs(this.cameraRotation) > 0.0001) {
      ctx.rotate(this.cameraRotation);
    }
    ctx.translate(-this.cameraX, -this.cameraY);

    // 2.5 In Map Mode, draw orbital distance range rings
    if (this.isMapMode) {
      this.drawMapRangeRings(ctx);
    }

    // 3. Draw Celestial Bodies (Earth, Moon, Atmospheres)
    this.drawCelestialBodies(ctx, vessel, orbit);

    // 4. Draw Launchpad ground infrastructure & Florida coastline when near Earth surface
    if (vessel.soi === 'earth' && vessel.altitude < 10000 && !this.isMapMode) {
      this.drawLaunchpadInfrastructure(ctx);
    }

    // 5. Draw Troposphere Volumetric Clouds
    if (vessel.soi === 'earth' && !this.isMapMode && vessel.altitude < 25000) {
      this.drawClouds(ctx, dt);
    }

    // 6. Draw Orbit / Trajectory Conics
    this.drawTrajectory(ctx, vessel, orbit);

    // 7. Draw Separated Staging Debris
    this.drawDebris(ctx, vessel.debris);

    // 8. Draw Rocket Vessel Parts & Dynamic Particle FX
    if (!this.isMapMode) {
      this.spawnAndRenderParticles(ctx, vessel, dt);
      this.drawVessel(ctx, vessel, dt);
      this.renderShockwavesAndOverlays(ctx, dt);
    } else {
      this.drawMapIcon(ctx, vessel);
    }

    ctx.restore();

    // 9. In Map Mode, render dynamic distance scale ruler and navigation compass in screen space
    if (this.isMapMode) {
      this.drawMapScreenHUD(ctx, width, height, vessel);
    }
  }

  private drawSkyAndAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number, vessel: VesselState) {
    const isEarth = vessel.soi === 'earth';
    const alt = vessel.altitude;
    const atmoH = physicsEngine.earth.atmosphereHeight; // 30,000m

    if (this.isMapMode || !isEarth) {
      // Deep Space Void & Multi-colored Twinkling Stars
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);
      this.drawDeepSpaceSky(ctx, width, height, 1.0);
      return;
    }

    // Atmospheric Rayleigh & Mie Scattering Sky Dome
    const altRatio = Math.max(0, Math.min(1, alt / atmoH));

    if (altRatio < 0.99) {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);

      if (alt < 4000) {
        // Daytime Troposphere: Cerulean to Azure to Horizon Haze
        skyGrad.addColorStop(0, '#0284c7'); // Zenith: Rich Sky Blue
        skyGrad.addColorStop(0.55, '#38bdf8'); // Mid: Light Azure
        skyGrad.addColorStop(1, '#bae6fd'); // Horizon: Bright Atmospheric Scattering Haze
      } else if (alt < 15000) {
        // Stratosphere: Deep Cobalt Indigo
        skyGrad.addColorStop(0, '#0f172a'); // Space nearing
        skyGrad.addColorStop(0.45, '#1e3a8a'); // Cobalt
        skyGrad.addColorStop(1, '#0284c7'); // Bright atmospheric rim
      } else {
        // Mesosphere into Vacuum: Black with vivid blue limb
        skyGrad.addColorStop(0, '#020617'); // Cosmic black
        skyGrad.addColorStop(0.7, '#0f172a'); // Faint blue haze
        skyGrad.addColorStop(1, '#1e40af'); // Vibrant blue atmospheric curve
      }

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Radiant Sun disc with golden corona & anamorphic lens flare
      this.drawSun(ctx, width, height, 1.0 - altRatio);

      // Stars appear above 10,000m
      const starAlpha = Math.max(0, Math.min(1, (alt - 10000) / 12000));
      if (starAlpha > 0.01) {
        this.drawDeepSpaceSky(ctx, width, height, starAlpha);
      }
    } else {
      // Pure Space Vacuum
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);
      this.drawSun(ctx, width, height, 0);
      this.drawDeepSpaceSky(ctx, width, height, 1.0);
    }
  }

  private drawSun(ctx: CanvasRenderingContext2D, width: number, height: number, atmoDensity: number) {
    ctx.save();
    // Sun position in sky
    const sunX = width * 0.72;
    const sunY = height * 0.18;

    // Golden Coronal Glow
    const coronaR = 90 + atmoDensity * 60;
    const coronaGrad = ctx.createRadialGradient(sunX, sunY, 12, sunX, sunY, coronaR);
    coronaGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    coronaGrad.addColorStop(0.18, 'rgba(254, 240, 138, 0.7)');
    coronaGrad.addColorStop(0.5, 'rgba(251, 146, 60, 0.25)');
    coronaGrad.addColorStop(1, 'rgba(251, 146, 60, 0)');

    ctx.fillStyle = coronaGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, coronaR, 0, Math.PI * 2);
    ctx.fill();

    // Brilliant White Sun Disc
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 16, 0, Math.PI * 2);
    ctx.fill();

    // Subtle Anamorphic Horizontal Flare Streak
    const flareGrad = ctx.createLinearGradient(sunX - 160, sunY, sunX + 160, sunY);
    flareGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    flareGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
    flareGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

    ctx.fillStyle = flareGrad;
    ctx.fillRect(sunX - 160, sunY - 1.5, 320, 3);

    ctx.restore();
  }

  private drawDeepSpaceSky(ctx: CanvasRenderingContext2D, width: number, height: number, opacity: number) {
    if (opacity <= 0.001) return;
    ctx.save();
    ctx.globalAlpha = opacity;

    // Faint Milky Way Galactic Dust Ribbon
    const mwGrad = ctx.createLinearGradient(0, 0, width, height);
    mwGrad.addColorStop(0.2, 'rgba(99, 102, 241, 0)');
    mwGrad.addColorStop(0.48, 'rgba(129, 140, 248, 0.07)');
    mwGrad.addColorStop(0.55, 'rgba(192, 132, 252, 0.09)');
    mwGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = mwGrad;
    ctx.fillRect(0, 0, width, height);

    // Multi-colored Stars with subtle twinkle
    this.stars.forEach((star) => {
      const sx = ((star.x + 10000 + this.cameraX * star.speed) % width + width) % width;
      const sy = ((star.y + 10000 - this.cameraY * star.speed) % height + height) % height;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  private drawClouds(ctx: CanvasRenderingContext2D, dt: number) {
    ctx.save();
    this.clouds.forEach((cloud) => {
      cloud.x += cloud.speed * dt;
      if (cloud.x > 30000) cloud.x = -30000;
      if (cloud.x < -30000) cloud.x = 30000;

      // Draw puffy cumulus cloud mass in world space
      const cx = cloud.x;
      const cy = cloud.y;
      const w = cloud.width;
      const h = cloud.height;

      // Soft cloud gradient with sun highlights on top and shaded base
      const grad = ctx.createLinearGradient(cx, cy + h / 2, cx, cy - h / 2);
      grad.addColorStop(0, `rgba(255, 255, 255, ${cloud.opacity})`);
      grad.addColorStop(0.65, `rgba(241, 245, 249, ${cloud.opacity * 0.85})`);
      grad.addColorStop(1, `rgba(203, 213, 225, ${cloud.opacity * 0.4})`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, w * 0.5, h * 0.38, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - w * 0.25, cy + h * 0.1, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + w * 0.22, cy + h * 0.08, w * 0.32, h * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(cx - w * 0.1, cy + h * 0.22, w * 0.25, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  private drawMapRangeRings(ctx: CanvasRenderingContext2D) {
    const earthR = physicsEngine.earth.radius;
    const rings = [
      { r: earthR + 100000, label: 'LEO 100 km' },
      { r: earthR + 500000, label: 'Orbit 500 km' },
      { r: earthR + 1000000, label: '1,000 km' },
      { r: earthR + 2000000, label: '2,000 km' },
    ];

    ctx.save();
    ctx.translate(0, 0);

    rings.forEach((ring) => {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1 / this.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
      ctx.stroke();

      // Label on ring at angle ~35 deg
      ctx.save();
      const angle = Math.PI * 0.22;
      const lx = ring.r * Math.cos(angle);
      const ly = ring.r * Math.sin(angle);
      ctx.translate(lx, ly);
      ctx.scale(1 / this.zoom, -1 / this.zoom);
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.textAlign = 'center';
      ctx.fillText(ring.label, 0, 0);
      ctx.restore();
    });

    ctx.restore();
  }

  private drawCelestialBodies(ctx: CanvasRenderingContext2D, vessel: VesselState, orbit: OrbitParameters) {
    const earth = physicsEngine.earth;
    const moon = physicsEngine.moon;

    // --- EARTH ---
    ctx.save();
    ctx.translate(0, 0);

    // Moon Orbit Ring around Earth in Map Mode
    if (this.isMapMode) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1.2 / this.zoom;
      ctx.setLineDash([14 / this.zoom, 10 / this.zoom]);
      ctx.beginPath();
      ctx.arc(0, 0, moon.orbitRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Direction arrows along Moon Orbit
      const curMoonAng = Math.atan2(physicsEngine.moonY, physicsEngine.moonX);
      const arrowAngles = [curMoonAng + 0.6, curMoonAng + 1.8, curMoonAng + 3.0, curMoonAng + 4.2];
      arrowAngles.forEach((ang) => {
        const ax = Math.cos(ang) * moon.orbitRadius;
        const ay = Math.sin(ang) * moon.orbitRadius;
        const forwardAng = ang + Math.PI * 0.5; // counter-clockwise orbit
        const al = 12 / this.zoom;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(forwardAng);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
        ctx.lineWidth = 1.5 / this.zoom;
        ctx.beginPath();
        ctx.moveTo(-al * 0.6, -al * 0.4);
        ctx.lineTo(0, 0);
        ctx.lineTo(-al * 0.6, al * 0.4);
        ctx.stroke();
        ctx.restore();
      });

      // Orbit Label
      ctx.save();
      const lblAng = curMoonAng + 0.3;
      ctx.translate(Math.cos(lblAng) * moon.orbitRadius, Math.sin(lblAng) * moon.orbitRadius);
      ctx.scale(1 / this.zoom, -1 / this.zoom);
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(203, 213, 225, 0.65)';
      ctx.textAlign = 'center';
      ctx.fillText('Moon Orbit: 3,000 km | 569 m/s', 0, -6);
      ctx.restore();
    }

    if (this.isMapMode) {
      // Earth Atmosphere Multi-layered Haze Gradient
      const earthAtmoR = earth.radius + earth.atmosphereHeight;
      const atmoGrad = ctx.createRadialGradient(0, 0, earth.radius - 1000, 0, 0, earthAtmoR);
      atmoGrad.addColorStop(0, '#0284c7');
      atmoGrad.addColorStop(0.35, '#38bdf8');
      atmoGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.25)');
      atmoGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');

      ctx.fillStyle = atmoGrad;
      ctx.beginPath();
      ctx.arc(0, 0, earthAtmoR, 0, Math.PI * 2);
      ctx.fill();

      // Earth Continents / Ocean Glow
      const earthSurfGrad = ctx.createRadialGradient(0, 0, earth.radius * 0.5, 0, 0, earth.radius);
      earthSurfGrad.addColorStop(0, '#0284c7');
      earthSurfGrad.addColorStop(0.6, '#0369a1');
      earthSurfGrad.addColorStop(1, '#075985');
      ctx.fillStyle = earthSurfGrad;
      ctx.beginPath();
      ctx.arc(0, 0, earth.radius, 0, Math.PI * 2);
      ctx.fill();

      // Vector Continents
      ctx.save();
      ctx.fillStyle = '#15803d'; // Rich terrestrial emerald
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5 / this.zoom;

      // Americas
      ctx.beginPath();
      ctx.arc(0, 0, earth.radius * 0.99, 0.15, 1.25);
      ctx.lineTo(earth.radius * 0.92 * Math.cos(1.2), earth.radius * 0.92 * Math.sin(1.2));
      ctx.lineTo(earth.radius * 0.94 * Math.cos(0.7), earth.radius * 0.94 * Math.sin(0.7));
      ctx.lineTo(earth.radius * 0.91 * Math.cos(0.3), earth.radius * 0.91 * Math.sin(0.3));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Eurasia & Africa
      ctx.beginPath();
      ctx.arc(0, 0, earth.radius * 0.99, 1.85, 3.1);
      ctx.lineTo(earth.radius * 0.91 * Math.cos(2.8), earth.radius * 0.91 * Math.sin(2.8));
      ctx.lineTo(earth.radius * 0.93 * Math.cos(2.4), earth.radius * 0.93 * Math.sin(2.4));
      ctx.lineTo(earth.radius * 0.89 * Math.cos(2.0), earth.radius * 0.89 * Math.sin(2.0));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // East Asia & Australia
      ctx.beginPath();
      ctx.arc(0, 0, earth.radius * 0.99, 3.65, 4.8);
      ctx.lineTo(earth.radius * 0.92 * Math.cos(4.5), earth.radius * 0.92 * Math.sin(4.5));
      ctx.lineTo(earth.radius * 0.94 * Math.cos(4.1), earth.radius * 0.94 * Math.sin(4.1));
      ctx.lineTo(earth.radius * 0.9 * Math.cos(3.8), earth.radius * 0.9 * Math.sin(3.8));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Polar Ice Shields
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, 0, earth.radius * 0.995, Math.PI * 0.44, Math.PI * 0.56);
      ctx.lineTo(0, earth.radius * 0.94);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, earth.radius * 0.995, Math.PI * 1.44, Math.PI * 1.56);
      ctx.lineTo(0, -earth.radius * 0.94);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Day/Night Terminator (Sun angle = -45 deg, from top-left)
      const sunAngle = -Math.PI * 0.25;
      ctx.save();
      const nightGrad = ctx.createLinearGradient(
        Math.cos(sunAngle) * earth.radius * 0.3,
        Math.sin(sunAngle) * earth.radius * 0.3,
        -Math.cos(sunAngle) * earth.radius,
        -Math.sin(sunAngle) * earth.radius
      );
      nightGrad.addColorStop(0, 'rgba(2, 6, 23, 0)');
      nightGrad.addColorStop(0.4, 'rgba(2, 6, 23, 0.45)');
      nightGrad.addColorStop(1, 'rgba(2, 6, 23, 0.82)');
      ctx.fillStyle = nightGrad;
      ctx.beginPath();
      ctx.arc(0, 0, earth.radius, 0, Math.PI * 2);
      ctx.fill();

      // Twinkling City Lights on the night hemisphere
      const nightAngleStart = sunAngle + Math.PI * 0.6;
      const cityAngles = [nightAngleStart + 0.2, nightAngleStart + 0.5, nightAngleStart + 0.8, nightAngleStart + 1.1, nightAngleStart + 1.4, nightAngleStart + 1.8];
      ctx.fillStyle = '#fde047';
      cityAngles.forEach((a, idx) => {
        const r = earth.radius * (0.94 + (idx % 3) * 0.02);
        ctx.globalAlpha = 0.5 + (idx % 4) * 0.15;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, Math.min(25, 2.5 / this.zoom), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;
      ctx.restore();
    } else {
      // Flight Mode: Clean Planetary Horizon & Atmospheric Limb
      const relX = vessel.x;
      const relY = vessel.y;
      const centerAngle = Math.atan2(relY, relX);
      const visibleSpanMeters = Math.max(1200, 3000 / Math.max(0.0001, this.zoom));
      const arcSpan = Math.min(Math.PI * 0.85, Math.max(0.06, (visibleSpanMeters * 2.2) / earth.radius));
      const halfArc = arcSpan * 0.65;
      const steps = 60;
      const atmoTopR = earth.radius + earth.atmosphereHeight;

      // 1. Atmosphere Limb Glow
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = centerAngle - halfArc + (i / steps) * (halfArc * 2);
        const px = Math.cos(a) * atmoTopR;
        const py = Math.sin(a) * atmoTopR;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = steps; i >= 0; i--) {
        const a = centerAngle - halfArc + (i / steps) * (halfArc * 2);
        const px = Math.cos(a) * earth.radius;
        const py = Math.sin(a) * earth.radius;
        ctx.lineTo(px, py);
      }
      ctx.closePath();

      const atmoGrad = ctx.createLinearGradient(
        Math.cos(centerAngle) * earth.radius,
        Math.sin(centerAngle) * earth.radius,
        Math.cos(centerAngle) * atmoTopR,
        Math.sin(centerAngle) * atmoTopR
      );
      atmoGrad.addColorStop(0, '#0284c7');
      atmoGrad.addColorStop(0.35, 'rgba(56, 189, 248, 0.65)');
      atmoGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.2)');
      atmoGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = atmoGrad;
      ctx.fill();
      ctx.restore();

      // 2. Planet Surface Crust Fill
      const depthMeters = Math.min(earth.radius * 0.25, Math.max(1500, 4000 / Math.max(0.0001, this.zoom)));
      const subR = Math.max(100, earth.radius - depthMeters);

      ctx.save();
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = centerAngle - halfArc + (i / steps) * (halfArc * 2);
        const px = Math.cos(a) * earth.radius;
        const py = Math.sin(a) * earth.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      for (let i = steps; i >= 0; i--) {
        const a = centerAngle - halfArc + (i / steps) * (halfArc * 2);
        const px = Math.cos(a) * subR;
        const py = Math.sin(a) * subR;
        ctx.lineTo(px, py);
      }
      ctx.closePath();

      const surfGrad = ctx.createLinearGradient(
        Math.cos(centerAngle) * earth.radius,
        Math.sin(centerAngle) * earth.radius,
        Math.cos(centerAngle) * subR,
        Math.sin(centerAngle) * subR
      );
      surfGrad.addColorStop(0, '#0369a1');
      surfGrad.addColorStop(0.2, '#0f172a');
      surfGrad.addColorStop(1, '#020617');
      ctx.fillStyle = surfGrad;
      ctx.fill();

      // Horizon line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(1.5 / this.zoom, 1.5);
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const a = centerAngle - halfArc + (i / steps) * (halfArc * 2);
        const px = Math.cos(a) * earth.radius;
        const py = Math.sin(a) * earth.radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.restore();

      // 3. Local Procedural Terrain Overlay (active up to 35,000m with smooth alpha fade)
      if (vessel.soi === 'earth' && vessel.altitude < 35000 && SOLAR_SYSTEM_BODIES.earth) {
        const terrainAlpha = vessel.altitude > 20000 ? Math.max(0, 1 - (vessel.altitude - 20000) / 15000) : 1.0;
        ctx.save();
        ctx.globalAlpha = terrainAlpha;
        drawLocalTerrainSurface(
          ctx,
          SOLAR_SYSTEM_BODIES.earth,
          0,
          0,
          vessel.x,
          vessel.y,
          vessel.altitude,
          this.zoom,
          -Math.PI * 0.25
        );
        ctx.restore();
      }
    }

    // Atmosphere Karman Line (30 km) Indicator in Map View
    if (this.isMapMode) {
      const earthAtmoR = earth.radius + earth.atmosphereHeight;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1.2 / this.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, earthAtmoR, 0, Math.PI * 2);
      ctx.stroke();

      // Earth Info Badge
      ctx.save();
      ctx.translate(0, -earth.radius - 22 / this.zoom);
      ctx.scale(1 / this.zoom, -1 / this.zoom);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      const earthText = `🌍 EARTH | R = ${(earth.radius / 1000).toFixed(0)} km`;
      ctx.font = 'bold 10px monospace';
      const ew = ctx.measureText(earthText).width;
      ctx.beginPath();
      ctx.roundRect(-ew / 2 - 6, -9, ew + 12, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      ctx.textAlign = 'center';
      ctx.fillText(earthText, 0, 4);
      ctx.restore();

      // Launchpad LC-39A Marker in Map View (at (0, earth.radius))
      ctx.save();
      ctx.translate(0, earth.radius);
      // Pulse ring
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, 7 / this.zoom, 0, Math.PI * 2);
      ctx.stroke();

      // Center dot
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(0, 0, 3.5 / this.zoom, 0, Math.PI * 2);
      ctx.fill();

      // Offset label to the left so it never collides with ascending rocket or earth badge
      ctx.translate(-18 / this.zoom, 0);
      ctx.scale(1 / this.zoom, -1 / this.zoom);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.2;
      const padText = 'LC-39A Pad';
      ctx.font = 'bold 9px monospace';
      const padW = ctx.measureText(padText).width;
      ctx.beginPath();
      ctx.roundRect(-padW - 8, -8, padW + 8, 16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#6ee7b7';
      ctx.textAlign = 'right';
      ctx.fillText(padText, -4, 4);
      ctx.restore();
    }
    ctx.restore();

    // Lunar Intercept Ghost Moon at Encounter
    if (this.isMapMode && orbit.closestApproachMoon?.intersectsSOI && orbit.closestApproachMoon.moonAtEncounter) {
      const mEnc = orbit.closestApproachMoon.moonAtEncounter;
      ctx.save();
      ctx.translate(mEnc.x, mEnc.y);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.75)';
      ctx.lineWidth = 1.5 / this.zoom;
      ctx.setLineDash([8 / this.zoom, 6 / this.zoom]);
      ctx.beginPath();
      ctx.arc(0, 0, moon.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ghost Moon Tag
      ctx.scale(1 / this.zoom, -1 / this.zoom);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      const gText = `Moon at Encounter (T+${orbit.closestApproachMoon.timeToClosest.toFixed(0)}s)`;
      ctx.font = 'bold 9px monospace';
      const gw = ctx.measureText(gText).width;
      ctx.beginPath();
      ctx.roundRect(-gw / 2 - 5, -22, gw + 10, 16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.fillText(gText, 0, -10);
      ctx.restore();
    }

    // --- MOON ---
    ctx.save();
    ctx.translate(physicsEngine.moonX, physicsEngine.moonY);

    // Moon SOI Bubble in Map View
    if (this.isMapMode) {
      // Translucent SOI gradient
      const soiGrad = ctx.createRadialGradient(0, 0, moon.radius, 0, 0, moon.soiRadius);
      soiGrad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
      soiGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.04)');
      soiGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = soiGrad;
      ctx.beginPath();
      ctx.arc(0, 0, moon.soiRadius, 0, Math.PI * 2);
      ctx.fill();

      // SOI Boundary Ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1.2 / this.zoom;
      ctx.setLineDash([12 / this.zoom, 8 / this.zoom]);
      ctx.beginPath();
      ctx.arc(0, 0, moon.soiRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // SOI Tag
      ctx.save();
      ctx.translate(0, -moon.soiRadius);
      ctx.scale(1 / this.zoom, -1 / this.zoom);
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(`Moon SOI (${(moon.soiRadius / 1000).toFixed(0)} km)`, 0, -6);
      ctx.restore();

      // High-contrast Moon Info Badge
      ctx.save();
      ctx.translate(0, -moon.radius - 18 / this.zoom);
      ctx.scale(1 / this.zoom, -1 / this.zoom);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.2;
      const moonText = `🌕 MOON (Luna) | R = ${(moon.radius / 1000).toFixed(0)} km`;
      ctx.font = 'bold 10px monospace';
      const mw = ctx.measureText(moonText).width;
      ctx.beginPath();
      ctx.roundRect(-mw / 2 - 6, -9, mw + 12, 18, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(moonText, 0, 4);
      ctx.restore();
    }

    // Moon Solid Body
    const moonGrad = ctx.createRadialGradient(-moon.radius * 0.25, moon.radius * 0.25, 100, 0, 0, moon.radius);
    moonGrad.addColorStop(0, '#cbd5e1');
    moonGrad.addColorStop(0.5, '#94a3b8');
    moonGrad.addColorStop(1, '#475569');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(0, 0, moon.radius, 0, Math.PI * 2);
    ctx.fill();

    // Lunar Maria (Dark Basalt Basins)
    ctx.fillStyle = '#334155';
    // Mare Tranquillitatis
    ctx.beginPath();
    ctx.ellipse(moon.radius * 0.22, moon.radius * 0.15, moon.radius * 0.28, moon.radius * 0.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Mare Imbrium
    ctx.beginPath();
    ctx.ellipse(-moon.radius * 0.25, moon.radius * 0.28, moon.radius * 0.32, moon.radius * 0.26, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Oceanus Procellarum
    ctx.beginPath();
    ctx.ellipse(-moon.radius * 0.35, -moon.radius * 0.05, moon.radius * 0.28, moon.radius * 0.35, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Tycho Ray Crater with radiating bright ejecta rays
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.arc(moon.radius * 0.1, -moon.radius * 0.45, moon.radius * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.35)';
    ctx.lineWidth = 1 / this.zoom;
    for (let r = 0; r < 8; r++) {
      const ra = (r / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(moon.radius * 0.1, -moon.radius * 0.45);
      ctx.lineTo(moon.radius * 0.1 + Math.cos(ra) * moon.radius * 0.3, -moon.radius * 0.45 + Math.sin(ra) * moon.radius * 0.3);
      ctx.stroke();
    }

    // Day/Night Terminator matching Sun angle
    const moonSunAngle = -Math.PI * 0.25;
    const moonNightGrad = ctx.createLinearGradient(
      Math.cos(moonSunAngle) * moon.radius * 0.3,
      Math.sin(moonSunAngle) * moon.radius * 0.3,
      -Math.cos(moonSunAngle) * moon.radius,
      -Math.sin(moonSunAngle) * moon.radius
    );
    moonNightGrad.addColorStop(0, 'rgba(2, 6, 23, 0)');
    moonNightGrad.addColorStop(0.35, 'rgba(2, 6, 23, 0.45)');
    moonNightGrad.addColorStop(1, 'rgba(2, 6, 23, 0.88)');
    ctx.fillStyle = moonNightGrad;
    ctx.beginPath();
    ctx.arc(0, 0, moon.radius, 0, Math.PI * 2);
    ctx.fill();

    // Procedural Local Lunar Terrain Surface & Subterranean Anorthosite/Basalt Strata (Flight Mode)
    if (!this.isMapMode && vessel.soi === 'moon' && vessel.altitude < 35000 && SOLAR_SYSTEM_BODIES.moon) {
      drawLocalTerrainSurface(
        ctx,
        SOLAR_SYSTEM_BODIES.moon,
        0,
        0,
        vessel.x - physicsEngine.moonX,
        vessel.y - physicsEngine.moonY,
        vessel.altitude,
        this.zoom,
        moonSunAngle
      );
    }

    ctx.restore();
  }

  private drawLaunchpadInfrastructure(ctx: CanvasRenderingContext2D) {
    const earthR = physicsEngine.earth.radius;
    ctx.save();
    ctx.translate(0, earthR);

    // 1. Coastal Florida Landscape & Atlantic Ocean (East / +X)
    // Sandy coastal dunes on the left (-X) and pad center
    const duneGrad = ctx.createLinearGradient(-600, 0, -600, -80);
    duneGrad.addColorStop(0, '#15803d'); // Coastal dune grass
    duneGrad.addColorStop(0.4, '#166534');
    duneGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = duneGrad;
    ctx.beginPath();
    ctx.rect(-600, -80, 700, 80);
    ctx.fill();

    // Atlantic Ocean shoreline on the right (+X > 70m)
    const oceanGrad = ctx.createLinearGradient(70, 0, 800, 0);
    oceanGrad.addColorStop(0, '#06b6d4'); // Turquoise coastal shallows
    oceanGrad.addColorStop(0.2, '#0284c7'); // Azure surf
    oceanGrad.addColorStop(0.6, '#0369a1'); // Deep ocean
    oceanGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = oceanGrad;
    ctx.beginPath();
    ctx.rect(70, -80, 750, 80);
    ctx.fill();

    // Foamy white ocean surf waves
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillRect(68, -4, 12, 3);
    ctx.fillRect(110, -3, 35, 2);
    ctx.fillRect(180, -2.5, 45, 1.8);

    // Dual-track Crawler-Transporter gravel roadway
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-120, -3, 90, 3);
    ctx.fillStyle = '#475569'; // Dual crushed-stone tracks
    ctx.fillRect(-120, -2.2, 90, 0.8);
    ctx.fillRect(-120, -0.8, 90, 0.8);

    // 2. Concrete Launch Mount Pedestal (LC-39A style blast mound)
    const moundGrad = ctx.createLinearGradient(-35, 0, 35, 0);
    moundGrad.addColorStop(0, '#334155');
    moundGrad.addColorStop(0.5, '#475569');
    moundGrad.addColorStop(1, '#334155');
    ctx.fillStyle = moundGrad;
    ctx.beginPath();
    ctx.moveTo(-35, -12);
    ctx.lineTo(-24, 0);
    ctx.lineTo(24, 0);
    ctx.lineTo(35, -12);
    ctx.closePath();
    ctx.fill();

    // Steel Flame Trench (Cutout channelling exhaust away)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-16, -10);
    ctx.lineTo(16, -10);
    ctx.lineTo(12, 0);
    ctx.closePath();
    ctx.fill();

    // Water-cooled Stainless Steel Flame Deflector Wedge
    const wedgeGrad = ctx.createLinearGradient(-8, -10, 8, -10);
    wedgeGrad.addColorStop(0, '#475569');
    wedgeGrad.addColorStop(0.5, '#94a3b8');
    wedgeGrad.addColorStop(1, '#475569');
    ctx.fillStyle = wedgeGrad;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(-10, -10);
    ctx.lineTo(10, -10);
    ctx.closePath();
    ctx.fill();

    // Reinforced Launch Table & Hold-Down Clamps
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-14, -0.6, 28, 1.6);
    // Yellow hazard caution stripes on launch table edge
    ctx.fillStyle = '#eab308';
    for (let x = -13; x < 13; x += 3) {
      ctx.fillRect(x, -0.6, 1.5, 0.4);
    }

    // Hold-down explosive release clamp posts
    ctx.fillStyle = '#334155';
    ctx.fillRect(-5.5, 0, 1.4, 1.8);
    ctx.fillRect(4.1, 0, 1.4, 1.8);

    // 3. 65-Meter Launch Umbilical Tower (LUT) & Mobile Launcher
    const towerX = 10;
    const towerW = 5.5;
    const towerH = 64;

    // Steel Structural Lattice Truss
    ctx.fillStyle = '#b91c1c'; // Iconic red-orange aerospace steel
    ctx.fillRect(towerX, 0, 0.6, towerH);
    ctx.fillRect(towerX + towerW - 0.6, 0, 0.6, towerH);

    // Work platforms every 6 meters with safety handrails
    for (let y = 6; y < towerH; y += 6) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(towerX - 1.5, y, towerW + 3, 0.6);
      // Yellow handrails
      ctx.fillStyle = '#eab308';
      ctx.fillRect(towerX - 1.5, y + 0.6, towerW + 3, 0.4);
    }

    // Structural Cross Bracing (X-truss)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 0.25;
    for (let y = 0; y < towerH; y += 6) {
      ctx.beginPath();
      ctx.moveTo(towerX, y);
      ctx.lineTo(towerX + towerW, y + 6);
      ctx.moveTo(towerX + towerW, y);
      ctx.lineTo(towerX, y + 6);
      ctx.stroke();
    }

    // Personnel Elevator Shaft
    ctx.fillStyle = '#475569';
    ctx.fillRect(towerX + 1.2, 0, 1.8, towerH);

    // Retractable Umbilical Service Arms
    // Lower Stage Fuel/LOX Feed Arm
    ctx.fillStyle = '#64748b';
    ctx.fillRect(towerX - 6.5, 14, 6.5, 1.2);
    ctx.fillStyle = '#38bdf8'; // Cryogenic pipe insulation
    ctx.fillRect(towerX - 6.5, 14.3, 6.5, 0.6);

    // Interstage Electrical Umbilical Arm
    ctx.fillStyle = '#64748b';
    ctx.fillRect(towerX - 5.5, 28, 5.5, 1.0);

    // Crew Access Arm (CAA) with White Clean Room Enclosure at 46m
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(towerX - 8.5, 46, 8.5, 2.4);
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 0.3;
    ctx.strokeRect(towerX - 8.5, 46, 8.5, 2.4);
    // NASA / Aerospace blue stripe
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(towerX - 8.5, 46.8, 8.5, 0.5);

    // Rooftop Hammerhead Construction Crane
    ctx.fillStyle = '#eab308';
    ctx.fillRect(towerX - 3, towerH, towerW + 10, 1.8);
    ctx.fillRect(towerX + 2, towerH + 1.8, 2, 4);

    // 16-Meter Lightning Protection Fiberglass Mast
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(towerX + towerW * 0.5, towerH + 5.8);
    ctx.lineTo(towerX + towerW * 0.5, towerH + 22);
    ctx.stroke();

    // High-Intensity Xenon Floodlight Beams
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.moveTo(towerX - 1, 35);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, 45);
    ctx.closePath();
    ctx.fill();

    // 4. Cryogenic LOX Storage Dewar Spheres
    ctx.save();
    ctx.translate(-45, 0);
    const sphereGrad = ctx.createRadialGradient(-2, 7, 1, 0, 6, 7);
    sphereGrad.addColorStop(0, '#ffffff');
    sphereGrad.addColorStop(0.5, '#cbd5e1');
    sphereGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(0, 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.3;
    ctx.stroke();

    // Support legs
    ctx.fillStyle = '#334155';
    ctx.fillRect(-4, 0, 0.8, 4);
    ctx.fillRect(3.2, 0, 0.8, 4);

    // Propellant piping truss
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(6, 4);
    ctx.lineTo(25, 4);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  private drawTrajectory(ctx: CanvasRenderingContext2D, vessel: VesselState, orbit: OrbitParameters) {
    if (!this.isMapMode && vessel.altitude < 15000 && orbit.isSuborbital) return;

    const activeBody = vessel.soi === 'moon' ? physicsEngine.moon : physicsEngine.earth;
    const bodyOffset = vessel.soi === 'moon'
      ? { x: physicsEngine.moonX, y: physicsEngine.moonY, vx: physicsEngine.moonVx, vy: physicsEngine.moonVy }
      : { x: 0, y: 0, vx: 0, vy: 0 };

    const trajPoints = OrbitalMath.getConicTrajectoryPoints(vessel, orbit, activeBody, 360, bodyOffset);
    if (trajPoints.length < 2) return;

    ctx.save();
    ctx.translate(bodyOffset.x, bodyOffset.y);

    // Pass 1: Soft Outer Glow Line for high orbital clarity
    ctx.lineWidth = Math.max(5.0 / this.zoom, 3.5);
    ctx.strokeStyle = orbit.isOrbiting ? 'rgba(56, 189, 248, 0.22)' : 'rgba(52, 211, 153, 0.22)';
    ctx.beginPath();
    for (let i = 0; i < trajPoints.length; i++) {
      const p = trajPoints[i];
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Pass 2: High-contrast inner trajectory core with atmospheric and underground transitions
    ctx.lineWidth = Math.max(2.0 / this.zoom, 1.5);
    for (let i = 0; i < trajPoints.length - 1; i++) {
      const p1 = trajPoints[i];
      const p2 = trajPoints[i + 1];

      if (p1.isUnderground || p2.isUnderground) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.setLineDash([8 / this.zoom, 6 / this.zoom]);
      } else if (p1.inAtmosphere || p2.inAtmosphere) {
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.9)';
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = orbit.isOrbiting ? '#38bdf8' : '#34d399';
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Directional chevron arrows along orbit indicating motion direction
    if (orbit.isOrbiting && trajPoints.length > 30) {
      const arrowIndices = [
        Math.floor(trajPoints.length * 0.25),
        Math.floor(trajPoints.length * 0.5),
        Math.floor(trajPoints.length * 0.75),
      ];
      arrowIndices.forEach((idx) => {
        if (idx < trajPoints.length - 1) {
          const pt = trajPoints[idx];
          const nextPt = trajPoints[idx + 1];
          const dirAng = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x);
          const al = 10 / this.zoom;
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(dirAng);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5 / this.zoom;
          ctx.beginPath();
          ctx.moveTo(-al * 0.7, -al * 0.4);
          ctx.lineTo(0, 0);
          ctx.lineTo(-al * 0.7, al * 0.4);
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // Find peak (Apoapsis) and surface impact point along trajectory
    let maxDist = 0;
    let apPoint: { x: number; y: number } | null = null;
    let impactPoint: { x: number; y: number } | null = null;

    for (let i = 0; i < trajPoints.length; i++) {
      const p = trajPoints[i];
      const dist = Math.hypot(p.x, p.y);
      if (dist > maxDist) {
        maxDist = dist;
        apPoint = p;
      }
      if (p.isUnderground && !impactPoint) {
        impactPoint = p;
      }
    }

    if (orbit.isOrbiting && orbit.eccentricity < 0.98) {
      const { eccentricity: e, semiMajorAxis: a, argumentOfPeriapsis: omega } = orbit;
      if (!isNaN(e) && a > 0) {
        const ra = a * (1 + e);
        const rp = a * (1 - e);

        const peX = rp * Math.cos(omega);
        const peY = rp * Math.sin(omega);

        const apX = ra * Math.cos(omega + Math.PI);
        const apY = ra * Math.sin(omega + Math.PI);

        if (orbit.apoapsis > 0 && orbit.apoapsis < 50000000) {
          this.drawOrbitNodeBadge(ctx, apX, apY, 'Ap', orbit.apoapsis, '#38bdf8');
        }

        if (orbit.periapsis > activeBody.atmosphereHeight && orbit.periapsis < 50000000) {
          this.drawOrbitNodeBadge(ctx, peX, peY, 'Pe', orbit.periapsis, '#34d399');
        } else if (orbit.periapsis > 0 && orbit.periapsis <= activeBody.atmosphereHeight) {
          this.drawOrbitNodeBadge(ctx, peX, peY, 'Pe (Atmo)', orbit.periapsis, '#f59e0b');
        } else if (impactPoint) {
          this.drawImpactNodeBadge(ctx, impactPoint.x, impactPoint.y);
        }
      }
    } else {
      // Suborbital or Launch ascent: Place Ap badge at predicted ballistic peak
      if (apPoint && orbit.apoapsis > 500) {
        this.drawOrbitNodeBadge(ctx, apPoint.x, apPoint.y, 'Ap', orbit.apoapsis, '#38bdf8');
      }
      if (impactPoint && Math.hypot(vessel.vx, vessel.vy) > 15) {
        this.drawImpactNodeBadge(ctx, impactPoint.x, impactPoint.y);
      }
    }

    // Lunar Intercept Node on vessel trajectory
    if (orbit.closestApproachMoon?.intersectsSOI && orbit.closestApproachMoon.encounterPoint) {
      const ep = orbit.closestApproachMoon.encounterPoint;
      this.drawOrbitNodeBadge(ctx, ep.x - bodyOffset.x, ep.y - bodyOffset.y, 'Lunar Encounter', orbit.closestApproachMoon.distance, '#10b981');
    }

    ctx.restore();
  }

  private drawImpactNodeBadge(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(0, 0, 4 / this.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(1 / this.zoom, -1 / this.zoom);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.4;

    const text = 'Impact Site';
    ctx.font = 'bold 10px sans-serif';
    const textWidth = ctx.measureText(text).width;

    ctx.beginPath();
    ctx.roundRect(-textWidth / 2 - 5, -24, textWidth + 10, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fca5a5';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, -12);

    ctx.restore();
  }

  private drawOrbitNodeBadge(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    label: string,
    alt: number,
    color: string
  ) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 5 / this.zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(1 / this.zoom, -1 / this.zoom);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;

    const text = `${label}: ${alt >= 1000 ? (alt / 1000).toFixed(1) + ' km' : alt.toFixed(0) + ' m'}`;
    ctx.font = 'bold 11px sans-serif';
    const textWidth = ctx.measureText(text).width;

    ctx.beginPath();
    ctx.roundRect(-textWidth / 2 - 6, -26, textWidth + 12, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(text, 0, -13);

    ctx.restore();
  }

  private drawDebris(ctx: CanvasRenderingContext2D, debris: DebrisObject[]) {
    if (!debris || !Array.isArray(debris)) return;

    debris.forEach((deb) => {
      if (!deb || typeof deb.x !== 'number' || typeof deb.y !== 'number') return;
      ctx.save();
      ctx.translate(deb.x, deb.y);

      if (this.isMapMode) {
        // Map mode diamond icon for jettisoned stages / debris
        ctx.fillStyle = '#94a3b8';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1 / this.zoom;
        const dSize = 5 / this.zoom;
        ctx.beginPath();
        ctx.moveTo(0, dSize);
        ctx.lineTo(dSize, 0);
        ctx.lineTo(0, -dSize);
        ctx.lineTo(-dSize, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.rotate(deb.angle || 0);
        if (Array.isArray(deb.parts)) {
          deb.parts.forEach((p) => {
            if (!p || !p.partId) return;
            const def = PART_CATALOG[p.partId];
            if (!def) return;
            ctx.save();
            ctx.translate(p.x || 0, p.y || 0);
            ctx.rotate(((p.rotation || 0) * Math.PI) / 180);

            const w = getPartWidth(p, def);
            const h = getPartHeight(p, def);

            // Render authentic procedural part for falling/tumbling debris
            const pw = w * this.zoom;
            const ph = h * this.zoom;
            ctx.scale(1 / this.zoom, -1 / this.zoom);

            const topW = p.adapterTopWidth ? p.adapterTopWidth * this.zoom : (p.partId === 'structural_adapter' ? pw * 0.8 : undefined);
            const botW = p.adapterBottomWidth ? p.adapterBottomWidth * this.zoom : (p.partId === 'structural_adapter' ? pw * 1.25 : undefined);
            const adShape: 'cone_cylinder' | 'straight' | undefined = (p.adapterShape === 'cone_cylinder' || p.adapterShape === 'straight')
              ? p.adapterShape
              : ((topW && botW && Math.abs(topW - botW) > 2) || (p.partId === 'structural_adapter') ? 'cone_cylinder' : undefined);

            drawPart2D(ctx, def, {
              widthPx: pw,
              heightPx: ph,
              rotation: 0,
              isSelected: false,
              isHovered: false,
              isFlight: true,
              deployed: p.deployed ?? false,
              deployProgress: p.deployProgress ?? 0,
              wheelSteerAngle: p.wheelSteerAngle,
              wheelRotation: p.wheelRotation,
              throttle: 0,
              engineActive: false,
              engineConfig: p.engineConfig,
              customNozzleType: p.customNozzleType,
              propellantType: p.propellantType,
              tankSkin: p.tankSkin,
              topWidthPx: topW,
              bottomWidthPx: botW,
              adapterShape: adShape,
            });

            ctx.restore();
          });
        }
      }

      ctx.restore();
    });
  }

  /**
   * Spawns authentic engine-specific exhaust plumes, ground trench billows, and RCS bursts
   */
  private spawnAndRenderParticles(ctx: CanvasRenderingContext2D, vessel: VesselState, dt: number) {
    const activeBody = vessel.soi === 'moon' ? physicsEngine.moon : physicsEngine.earth;
    const atmoHeight = activeBody.atmosphereHeight;
    const atmoDensity = atmoHeight > 0 ? Math.max(0, 1 - vessel.altitude / atmoHeight) : 0;
    const inVacuum = atmoDensity < 0.05;

    // 1. Spawning Engine Exhaust Plumes & Launch Smoke
    if (vessel.throttle > 0.01 && !vessel.isCrashed) {
      // Find all active engines that have available propellant
      const activeEngines = vessel.parts.filter((p) => {
        const def = PART_CATALOG[p.partId];
        if (!def || def.maxThrust <= 0) return false;
        const isEngOn = p.isEngineOn === true || (p.isEngineOn !== false && p.stage === vessel.activeStageIndex);
        if (!isEngOn) return false;

        if (def.isSRB) {
          const srbFuel = p.fuelRemaining !== undefined ? p.fuelRemaining : def.fuelMass;
          return srbFuel > 0.001;
        }

        // Liquid engine: check propellant anywhere on craft
        const hasFuel = vessel.parts.some(
          (t) => !PART_CATALOG[t.partId]?.isSRB && t.fuelRemaining !== undefined && t.fuelRemaining > 0.001
        );
        return hasFuel;
      });

      const noseX = -Math.sin(vessel.angle);
      const noseY = Math.cos(vessel.angle);

      const cosA = Math.cos(vessel.angle);
      const sinA = Math.sin(vessel.angle);

      activeEngines.forEach((eng) => {
        const def = PART_CATALOG[eng.partId];
        if (!def) return;

        // Nozzle bottom in world coordinates
        const localX = eng.x;
        const localY = eng.y - def.height * 0.5;

        const nozzleWorldX = vessel.x + (localX * cosA - localY * sinA);
        const nozzleWorldY = vessel.y + (localX * sinA + localY * cosA);

        const cfg = eng.engineConfig;
        const fuelType = (cfg?.engineType === 'Solid' || eng.propellantType === 'solid')
          ? 'solid'
          : (cfg?.engineType === 'Nuclear Thermal' || eng.propellantType === 'nuclear')
          ? 'nuclear'
          : (cfg?.engineType === 'Monopropellant' || eng.propellantType === 'monoprop')
          ? 'monoprop'
          : cfg?.liquidFuel
          ? cfg.liquidFuel.toLowerCase()
          : eng.propellantType
          || def.fuelType
          || 'kerolox';

        const powerCycle = cfg?.powerCycle || (def.isSRB ? 'Booster' : 'Gas Generator II');

        const isSRB = fuelType === 'solid' || def.isSRB || def.id === 'engine_srb';
        const isNuclear = fuelType === 'nuclear' || def.id === 'engine_nuclear_nerva';
        const isMethalox = fuelType === 'methalox' || (cfg?.liquidFuel === 'Methalox') || def.id === 'engine_raptor';
        const isHydrolox = fuelType === 'hydrolox' || (cfg?.liquidFuel === 'Hydrolox') || def.id === 'engine_frontier';
        const isMonoprop = fuelType === 'monoprop' || def.isRCS;
        const isHypergolic = fuelType === 'hypergolic';
        const isIon = def.id === 'engine_ion' || ((cfg?.engineType as string) === 'Electric');
        const isTitan = def.id === 'engine_titan';
        const isFullFlow = powerCycle === 'Full Flow Staged';
        const isStaged = powerCycle === 'Staged' || powerCycle === 'Full Flow Staged';
        const isGasGen = powerCycle === 'Gas Generator I' || powerCycle === 'Gas Generator II';
        const isPressureFed = powerCycle === 'Pressure-Fed';
        const isAerospike = cfg?.nozzleStyle === 'Aerospike';

        // Plume speed by power cycle (Full Flow Staged = fastest/hottest, Pressure-Fed = slowest)
        const basePlumeSpeed = (isIon) ? 22 + vessel.throttle * 80
          : isSRB ? 25 + vessel.throttle * 48
          : isNuclear ? 30 + vessel.throttle * 60
          : isFullFlow ? 32 + vessel.throttle * 68
          : isStaged ? 30 + vessel.throttle * 58
          : isGasGen ? 28 + vessel.throttle * 52
          : isPressureFed ? 20 + vessel.throttle * 35
          : 28.0 + vessel.throttle * 55.0;

        const spreadFactor = (inVacuum ? 14.0 : 5.0) * (isFullFlow ? 1.6 : isSRB ? 1.4 : isPressureFed ? 0.6 : 1.0);

        // Take TVC gimbal angle into account for exhaust plume direction
        const thrustAngle = vessel.angle + (def.isSRB ? 0 : (vessel.gimbalAngle || 0));
        const engNoseX = -Math.sin(thrustAngle);
        const engNoseY = Math.cos(thrustAngle);
        const perpX = Math.cos(thrustAngle);
        const perpY = Math.sin(thrustAngle);

        const exhaustVx = vessel.vx - engNoseX * basePlumeSpeed + (Math.random() - 0.5) * spreadFactor;
        const exhaustVy = vessel.vy - engNoseY * basePlumeSpeed + (Math.random() - 0.5) * spreadFactor;

        // Particle color/size/life/shape by fuel type AND power cycle
        let pColor = '#f97316';
        let pSecondaryColor: string | undefined = undefined;
        let pShape: Particle['shape'] = 'circle';
        let pSize = (Math.random() * 0.4 + 0.35) * (isTitan ? 1.5 : isSRB ? 1.45 : isFullFlow ? 1.2 : 1.0);
        let pLife = (0.18 + vessel.throttle * 0.26) * (inVacuum ? 1.5 : 1.0) * (isFullFlow ? 1.2 : isGasGen ? 1.1 : isPressureFed ? 0.8 : 1.0);

        if (isIon) {
          pColor = Math.random() > 0.35 ? '#22d3ee' : Math.random() > 0.5 ? '#7dd3fc' : '#06b6d4';
          pSecondaryColor = '#ffffff';
          pShape = Math.random() > 0.6 ? 'ring' : 'streak';
          pSize = Math.random() * 0.2 + 0.1;
          pLife = 0.12 + vessel.throttle * 0.2;
        } else if (isNuclear) {
          pColor = Math.random() > 0.45 ? '#34d399' : Math.random() > 0.25 ? '#6ee7b7' : '#a7f3d0';
          pSecondaryColor = '#10b981';
          pShape = Math.random() > 0.5 ? 'streak' : 'circle';
          pSize = Math.random() * 0.32 + 0.22;
          pLife = 0.22 + vessel.throttle * 0.32;
        } else if (isMethalox) {
          pColor = isFullFlow
            ? (Math.random() > 0.5 ? '#c4b5fd' : Math.random() > 0.3 ? '#7c3aed' : '#ffffff')
            : (Math.random() > 0.45 ? '#c084fc' : Math.random() > 0.2 ? '#7c3aed' : '#ffffff');
          pSecondaryColor = isFullFlow ? '#38bdf8' : '#e9d5ff';
          pShape = isFullFlow ? (Math.random() > 0.4 ? 'diamond' : 'streak') : 'circle';
          pSize = Math.random() * 0.38 + 0.28;
        } else if (isHydrolox) {
          pColor = inVacuum
            ? (Math.random() > 0.5 ? '#bae6fd' : '#38bdf8')
            : (Math.random() > 0.6 ? '#f8fafc' : '#e0f2fe');
          pSecondaryColor = '#818cf8';
          pShape = powerCycle === 'Expander' ? (Math.random() > 0.5 ? 'ring' : 'streak') : 'circle';
          pSize = Math.random() * 0.3 + 0.22;
          pLife = (0.14 + vessel.throttle * 0.2) * (inVacuum ? 1.3 : 1.0);
        } else if (isSRB) {
          pColor = Math.random() > 0.5 ? '#ffffff' : Math.random() > 0.3 ? '#fef08a' : '#f97316';
          pShape = 'spark';
          pSize = Math.random() * 0.5 + 0.38;
          pLife = (0.22 + vessel.throttle * 0.32) * (inVacuum ? 1.2 : 1.0);
        } else if (isMonoprop) {
          pColor = Math.random() > 0.4 ? '#fde68a' : '#f59e0b';
          pShape = 'circle';
          pSize = Math.random() * 0.22 + 0.15;
          pLife = 0.14 + vessel.throttle * 0.2;
        } else if (isHypergolic) {
          pColor = Math.random() > 0.45 ? '#f87171' : Math.random() > 0.2 ? '#dc2626' : '#fca5a5';
          pShape = 'circle';
          pSize = Math.random() * 0.32 + 0.2;
        } else {
          // Kerolox / Standard Liquid - specifically tuned by Power Cycle
          if (powerCycle === 'Full Flow Staged') {
            pColor = Math.random() > 0.5 ? '#c084fc' : Math.random() > 0.3 ? '#38bdf8' : '#ffffff';
            pSecondaryColor = '#e879f9';
            pShape = Math.random() > 0.4 ? 'diamond' : 'streak';
            pSize = Math.random() * 0.38 + 0.28;
            pLife = 0.22 + vessel.throttle * 0.28;
          } else if (powerCycle === 'Staged') {
            pColor = Math.random() > 0.55 ? '#ffffff' : Math.random() > 0.3 ? '#fef08a' : '#f97316';
            pSecondaryColor = '#ea580c';
            pShape = Math.random() > 0.4 ? 'streak' : 'circle';
            pSize = Math.random() * 0.35 + 0.25;
            pLife = 0.2 + vessel.throttle * 0.24;
          } else if (powerCycle === 'Gas Generator I') {
            pColor = Math.random() > 0.45 ? '#f97316' : Math.random() > 0.2 ? '#fb923c' : '#fef08a';
            pShape = 'circle';
            pSize = Math.random() * 0.42 + 0.3;
            pLife = 0.18 + vessel.throttle * 0.26;
          } else if (powerCycle === 'Gas Generator II') {
            pColor = Math.random() > 0.45 ? '#ea580c' : Math.random() > 0.2 ? '#f97316' : '#dc2626';
            pShape = 'circle';
            pSize = Math.random() * 0.44 + 0.32;
            pLife = 0.19 + vessel.throttle * 0.28;
          } else if (powerCycle === 'Expander') {
            pColor = Math.random() > 0.5 ? '#67e8f9' : Math.random() > 0.25 ? '#38bdf8' : '#ffffff';
            pSecondaryColor = '#c084fc';
            pShape = Math.random() > 0.5 ? 'ring' : 'streak';
            pSize = Math.random() * 0.32 + 0.2;
            pLife = 0.16 + vessel.throttle * 0.22;
          } else if (powerCycle === 'Pressure-Fed') {
            pColor = Math.random() > 0.5 ? '#fdba74' : '#f97316';
            pShape = 'circle';
            pSize = Math.random() * 0.3 + 0.18;
            pLife = 0.14 + vessel.throttle * 0.18;
          } else {
            pColor = Math.random() > 0.4 ? '#fef08a' : '#f97316';
            pShape = 'circle';
            pSize = Math.random() * 0.4 + 0.28;
          }
        }

        // Spawn Primary Flame Particle
        this.flameParticles.push({
          x: nozzleWorldX,
          y: nozzleWorldY,
          vx: exhaustVx,
          vy: exhaustVy,
          size: pSize,
          alpha: 1.0,
          color: pColor,
          secondaryColor: pSecondaryColor,
          shape: pShape,
          life: 0,
          maxLife: pLife,
          growth: isIon ? 0.3 : inVacuum ? (powerCycle === 'Full Flow Staged' ? 5.8 : powerCycle === 'Expander' ? 6.2 : 4.0) : (isSRB ? 2.5 : powerCycle === 'Full Flow Staged' ? 2.8 : 1.8),
        });

        // 1. Full Flow Staged Supersonic Mach Diamond Particles
        if (powerCycle === 'Full Flow Staged' && Math.random() > 0.35) {
          const diamondDist = Math.random() * 2.2 + 0.4;
          const dX = nozzleWorldX - engNoseX * diamondDist;
          const dY = nozzleWorldY - engNoseY * diamondDist;
          this.flameParticles.push({
            x: dX,
            y: dY,
            vx: vessel.vx - engNoseX * (basePlumeSpeed * 1.15),
            vy: vessel.vy - engNoseY * (basePlumeSpeed * 1.15),
            size: Math.random() * 0.32 + 0.18,
            alpha: 0.9,
            color: Math.random() > 0.5 ? '#e9d5ff' : '#38bdf8',
            secondaryColor: '#ffffff',
            shape: 'diamond',
            life: 0,
            maxLife: pLife * 0.75,
            growth: 0.8,
          });
        }

        // 2. Gas Generator I: Asymmetric turbopump exhaust dump specifically on left side (-perpX)
        if (powerCycle === 'Gas Generator I' && Math.random() > 0.4 && !isSRB) {
          const dumpOffset = -0.75;
          this.smokeParticles.push({
            x: nozzleWorldX + perpX * dumpOffset,
            y: nozzleWorldY + perpY * dumpOffset,
            vx: vessel.vx + perpX * -4.0 + (Math.random() - 0.5) * 3,
            vy: vessel.vy + perpY * -4.0 - engNoseY * 12 + (Math.random() - 0.5) * 3,
            size: Math.random() * 0.45 + 0.25,
            alpha: 0.65,
            color: '#1e293b', // Dense black turbopump soot
            shape: 'smoke_puff',
            life: 0,
            maxLife: 0.7 + Math.random() * 0.5,
            growth: 2.4,
            drag: 0.92,
          });
        }

        // 3. Gas Generator II: Dual flanking turbopump exhaust ducts (+/- perpX)
        if (powerCycle === 'Gas Generator II' && Math.random() > 0.45 && !isSRB) {
          const side = Math.random() > 0.5 ? 0.75 : -0.75;
          this.smokeParticles.push({
            x: nozzleWorldX + perpX * side,
            y: nozzleWorldY + perpY * side,
            vx: vessel.vx + perpX * side * 4 + (Math.random() - 0.5) * 3,
            vy: vessel.vy + perpY * side * 4 - engNoseY * 14 + (Math.random() - 0.5) * 3,
            size: Math.random() * 0.4 + 0.2,
            alpha: 0.6,
            color: '#334155',
            shape: 'smoke_puff',
            life: 0,
            maxLife: 0.65 + Math.random() * 0.4,
            growth: 2.2,
            drag: 0.93,
          });
        }

        // 4. Expander Cycle: Pristine translucent condensation vapor rings
        if (powerCycle === 'Expander' && Math.random() > 0.5) {
          this.smokeParticles.push({
            x: nozzleWorldX + (Math.random() - 0.5) * 0.8,
            y: nozzleWorldY + (Math.random() - 0.5) * 0.8,
            vx: vessel.vx - engNoseX * 18 + (Math.random() - 0.5) * 4,
            vy: vessel.vy - engNoseY * 18 + (Math.random() - 0.5) * 4,
            size: Math.random() * 0.4 + 0.25,
            alpha: 0.45,
            color: '#bae6fd',
            shape: 'ring',
            life: 0,
            maxLife: 0.5 + Math.random() * 0.3,
            growth: 3.5,
            drag: 0.95,
          });
        }

        // 5. Booster / SRB: Heavy torrent of incandescent molten aluminum sparks & dense smoke
        if (isSRB || powerCycle === 'Booster') {
          const sparkSpread = (Math.random() - 0.5) * 16;
          for (let s = 0; s < 2; s++) {
            this.sparkParticles.push({
              x: nozzleWorldX,
              y: nozzleWorldY,
              vx: exhaustVx * 0.85 + sparkSpread,
              vy: exhaustVy * 0.85 + sparkSpread,
              size: Math.random() * 0.45 + 0.25,
              alpha: 1.0,
              color: Math.random() > 0.4 ? '#ffffff' : '#fef08a',
              life: 0,
              maxLife: Math.random() * 0.6 + 0.35,
              drag: 0.94,
            });
          }
        } else if (isTitan || (def.maxThrust > 800 && Math.random() > 0.65)) {
          // Occasional spark for high-thrust liquid engines
          const sparkSpread = (Math.random() - 0.5) * 10;
          this.sparkParticles.push({
            x: nozzleWorldX,
            y: nozzleWorldY,
            vx: exhaustVx * 0.9 + sparkSpread,
            vy: exhaustVy * 0.9 + sparkSpread,
            size: Math.random() * 0.3 + 0.15,
            alpha: 0.9,
            color: '#fef08a',
            life: 0,
            maxLife: Math.random() * 0.4 + 0.2,
            drag: 0.95,
          });
        }

        // Launchpad deluge water steam billows & ground trench smoke (under 120m)
        if (vessel.altitude < 120 && !isIon && atmoDensity > 0.2) {
          const trenchDir = Math.random() > 0.5 ? 1 : -1;
          this.smokeParticles.push({
            x: nozzleWorldX + (Math.random() - 0.5) * 6.0,
            y: nozzleWorldY - 1.0,
            vx: trenchDir * (Math.random() * 32 + 16),
            vy: Math.random() * 8 + 3,
            size: Math.random() * 2.2 + 1.2,
            alpha: 0.75,
            color: Math.random() > 0.4 ? '#f8fafc' : '#e2e8f0',
            life: 0,
            maxLife: Math.random() * 2.8 + 1.8,
            growth: 7.0,
            drag: 0.93,
          });
        }

        // Persistent Smoke & Condensation Trail: active from liftoff all the way up to 30 km (30,000m)
        // In the troposphere and stratosphere up to 30km, chemical rocket exhausts create persistent smoke trails.
        // As altitude climbs towards 30km, atmospheric pressure drops, causing exhaust plumes to expand wide (twilight effect).
        if (!isIon && vessel.altitude <= 30000) {
          const expansion = Math.min(1.0, vessel.altitude / 30000); // 0 at sea level, 1.0 at 30km
          const baseSpread = 0.8 + expansion * 3.5;
          const particleLife = 2.5 + Math.random() * 1.8; // 2.5s to 4.3s lingering trail
          const particleGrowth = 3.5 + expansion * 7.0; // wider expansion in thin air

          const sAlpha = isSRB ? 0.82 : isHydrolox ? 0.45 : isMethalox ? 0.30 : isNuclear ? 0.22 : isMonoprop ? 0.28 : isHypergolic ? 0.60 : 0.66;
          let sColor = '#e2e8f0';
          if (isSRB) {
            sColor = Math.random() > 0.5 ? '#cbd5e1' : Math.random() > 0.25 ? '#94a3b8' : '#f1f5f9';
          } else if (isHydrolox) {
            sColor = Math.random() > 0.4 ? '#ffffff' : '#f8fafc';
          } else if (isMethalox) {
            sColor = Math.random() > 0.5 ? '#f8fafc' : '#ede9fe';
          } else if (isNuclear) {
            sColor = Math.random() > 0.5 ? '#a7f3d0' : '#d1fae5';
          } else if (isMonoprop) {
            sColor = Math.random() > 0.5 ? '#fde68a' : '#e2e8f0';
          } else if (isHypergolic) {
            sColor = Math.random() > 0.4 ? '#fca5a5' : '#94a3b8'; // reddish-brown toxic smoke
          } else {
            // Kerolox carbon soot
            sColor = Math.random() > 0.4 ? '#64748b' : Math.random() > 0.2 ? '#475569' : '#94a3b8';
          }

          this.smokeParticles.push({
            x: nozzleWorldX + (Math.random() - 0.5) * baseSpread,
            y: nozzleWorldY + (Math.random() - 0.5) * baseSpread,
            vx: vessel.vx * 0.15 + (Math.random() - 0.5) * (2.5 + expansion * 5.0),
            vy: vessel.vy * 0.15 + (Math.random() - 0.5) * (2.5 + expansion * 5.0),
            size: (Math.random() * 1.0 + 0.8) * (1.0 + expansion * 2.2),
            alpha: sAlpha,
            color: sColor,
            life: 0,
            maxLife: particleLife,
            growth: particleGrowth,
            drag: 0.96,
          });

          // Extra solid particulate for SRBs (thick alumina smoke trail)
          if (isSRB && Math.random() > 0.3) {
            this.smokeParticles.push({
              x: nozzleWorldX + (Math.random() - 0.5) * (baseSpread * 0.8),
              y: nozzleWorldY + (Math.random() - 0.5) * (baseSpread * 0.8),
              vx: vessel.vx * 0.1 + (Math.random() - 0.5) * 2.0,
              vy: vessel.vy * 0.1 + (Math.random() - 0.5) * 2.0,
              size: Math.random() * 1.2 + 0.9,
              alpha: 0.7,
              color: '#f8fafc',
              life: 0,
              maxLife: particleLife * 1.2,
              growth: particleGrowth * 1.1,
              drag: 0.95,
            });
          }
        }
      });

      // Keep smoke particle pool healthy and bounded for 60fps performance
      if (this.smokeParticles.length > 750) {
        this.smokeParticles.splice(0, this.smokeParticles.length - 750);
      }
    }

    // Pre-launch Cryogenic Venting (Liquid Oxygen Boil-off Vapors)
    if (vessel.altitude < 10 && vessel.throttle < 0.05 && !vessel.isCrashed && vessel.soi === 'earth') {
      if (Math.random() < 0.3) {
        this.smokeParticles.push({
          x: vessel.x + 1.2 + (Math.random() - 0.5) * 0.4,
          y: vessel.y + 8.0 + (Math.random() - 0.5) * 4.0,
          vx: -3.5 - Math.random() * 4.0,
          vy: (Math.random() - 0.5) * 1.5,
          size: Math.random() * 0.45 + 0.25,
          alpha: 0.5,
          color: '#ffffff',
          life: 0,
          maxLife: 1.4,
          growth: 2.5,
          drag: 0.96,
        });
      }
    }

    // 2. Spawn Positional RCS Thruster bursts (Grounded in real per-part physics vectors)
    if (vessel.rcsActive && (
      Math.abs(vessel.rcsPitchCommand || 0) > 0.02 ||
      Math.abs(vessel.rcsTranslationX || 0) > 0.02 ||
      Math.abs(vessel.rcsTranslationY || 0) > 0.02 ||
      Math.abs(vessel.angularVelocity) > 0.03
    )) {
      const rcsParts = vessel.parts.filter((p) => PART_CATALOG[p.partId]?.isRCS);
      const cosA = Math.cos(vessel.angle);
      const sinA = Math.sin(vessel.angle);
      const liveCoMX = vessel.liveCoMX ?? 0;
      const liveCoMY = vessel.liveCoMY ?? 0;

      rcsParts.forEach((rcs) => {
        const def = PART_CATALOG[rcs.partId];
        if (!def) return;

        // Position of the RCS block in world space
        const rx = vessel.x + (rcs.x * cosA - rcs.y * sinA);
        const ry = vessel.y + (rcs.x * sinA + rcs.y * cosA);

        // Compute commanded thrust vector for this thruster from physics state
        let thrustBodyX = rcs.lastThrustFx || 0;
        let thrustBodyY = rcs.lastThrustFy || 0;

        // Fallback if lastThrust was not recorded on part: compute from demand
        if (Math.hypot(thrustBodyX, thrustBodyY) < 0.01) {
          const dx = rcs.x - liveCoMX;
          const dy = rcs.y - liveCoMY;
          const pitch = vessel.rcsPitchCommand || (vessel.angularVelocity > 0.02 ? -1 : vessel.angularVelocity < -0.02 ? 1 : 0);
          const transX = vessel.rcsTranslationX || 0;
          const transY = vessel.rcsTranslationY || 0;

          // Tangential torque vector + translational command
          const dist = Math.hypot(dx, dy) || 1;
          thrustBodyX = transX + (pitch * (-dy / dist)) * 0.7;
          thrustBodyY = transY + (pitch * (dx / dist)) * 0.7;
        }

        const thrustMag = Math.hypot(thrustBodyX, thrustBodyY);
        if (thrustMag < 0.05) return;

        // Transform thruster force vector to world frame
        const thrustWorldX = thrustBodyX * cosA - thrustBodyY * sinA;
        const thrustWorldY = thrustBodyX * sinA + thrustBodyY * cosA;

        // Exhaust ejects opposite to thruster force
        const exDirX = -thrustWorldX / thrustMag;
        const exDirY = -thrustWorldY / thrustMag;
        const exhaustSpeed = 16 + Math.random() * 8;

        const prop = rcs.rcsPropellantType || def.rcsPropellantType || 'cold_gas';
        const color = prop === 'hypergolic' ? '#fb923c' : prop === 'monoprop' ? '#f1f5f9' : '#38bdf8';

        this.rcsParticles.push({
          x: rx,
          y: ry,
          vx: vessel.vx + exDirX * exhaustSpeed + (Math.random() - 0.5) * 2.5,
          vy: vessel.vy + exDirY * exhaustSpeed + (Math.random() - 0.5) * 2.5,
          size: Math.random() * 0.28 + 0.16,
          alpha: 0.9,
          color,
          life: 0,
          maxLife: 0.16,
          growth: 1.4,
        });
      });
    }

    // 2.5 Spawn Reentry Condensation Vapor Trails & Hypersonic Plasma Wake
    const speed = Math.hypot(vessel.vx, vessel.vy);
    const reentryIntensity = (vessel.reentryVapor && vessel.reentryVapor > 0.03)
      || vessel.heatFlux > 0.015
      || (speed > 220 && atmoDensity > 0.02);

    if (reentryIntensity && speed > 50 && vessel.altitude < (atmoHeight || 35000)) {
      const uVx = vessel.vx / speed;
      const uVy = vessel.vy / speed;
      const pVx = -uVy;
      const pVy = uVx;

      // Hypersonic Shock Plasma & Ionized Wake Streamers
      if (vessel.heatFlux > 0.015 || speed > 380) {
        const plasmaCount = Math.min(6, Math.max(2, Math.floor((vessel.heatFlux || 0) * 12 + (speed / 300))));
        for (let k = 0; k < plasmaCount; k++) {
          const lateral = (Math.random() - 0.5) * 5.5;
          const lead = 3.0 + Math.random() * 5.0;
          const spawnX = vessel.x + uVx * lead + pVx * lateral;
          const spawnY = vessel.y + uVy * lead + pVy * lateral;

          const dragBack = speed * (0.04 + Math.random() * 0.12);
          const pVxFinal = vessel.vx * 0.12 - uVx * dragBack + (Math.random() - 0.5) * 4.0;
          const pVyFinal = vessel.vy * 0.12 - uVy * dragBack + (Math.random() - 0.5) * 4.0;

          const heat = Math.min(1.0, (vessel.heatFlux || 0) * 1.6 + (speed - 380) / 900);
          const color = heat > 0.6 ? '#ffffff' : heat > 0.3 ? '#fef08a' : '#f97316';

          this.reentryVaporParticles.push({
            x: spawnX,
            y: spawnY,
            vx: pVxFinal,
            vy: pVyFinal,
            size: Math.random() * 2.0 + 1.2,
            maxSize: Math.random() * 18.0 + 10.0,
            alpha: 0.85,
            color,
            isPlasma: true,
            life: 0,
            maxLife: Math.random() * 0.9 + 0.5,
            turbX: (Math.random() - 0.5) * 3.0,
            turbY: (Math.random() - 0.5) * 3.0,
          });
        }
      }

      // Real-life Dense Condensation Reentry Vapor Trails (Ribbons drifting in the upper atmosphere)
      const vaporAmt = vessel.reentryVapor || (speed > 220 && atmoDensity > 0.02 ? Math.min(1.0, (speed - 220) / 250) * atmoDensity : 0);
      if (vaporAmt > 0.04) {
        const vaporCount = Math.min(8, Math.max(3, Math.floor(vaporAmt * 8 + 2)));
        for (let k = 0; k < vaporCount; k++) {
          const lat = (Math.random() - 0.5) * 7.5;
          const trailDist = -2.0 - Math.random() * 6.0;
          const spawnX = vessel.x + pVx * lat + uVx * trailDist;
          const spawnY = vessel.y + pVy * lat + uVy * trailDist;

          const atmSlow = 0.06 + Math.random() * 0.10;
          const vvx = vessel.vx * atmSlow + (Math.random() - 0.5) * 3.5;
          const vvy = vessel.vy * atmSlow + (Math.random() - 0.5) * 3.5;

          this.reentryVaporParticles.push({
            x: spawnX,
            y: spawnY,
            vx: vvx,
            vy: vvy,
            size: Math.random() * 3.2 + 2.5,
            maxSize: Math.random() * 40.0 + 22.0,
            alpha: Math.min(0.85, vaporAmt * 0.85 + 0.15),
            color: Math.random() > 0.2 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(224, 242, 254, 0.85)',
            isPlasma: false,
            life: 0,
            maxLife: Math.random() * 3.5 + 2.0, // Billows and hangs in the sky for seconds!
            turbX: (Math.random() - 0.5) * 4.0,
            turbY: (Math.random() - 0.5) * 4.0,
          });
        }
      }
    }

    // Keep reentry particle pool bounded for 60fps performance
    if (this.reentryVaporParticles.length > 900) {
      this.reentryVaporParticles.splice(0, this.reentryVaporParticles.length - 900);
    }

    // 2.8 Render Reentry Vapor Ribbons & Hypersonic Plasma Wake
    for (let i = this.reentryVaporParticles.length - 1; i >= 0; i--) {
      const vp = this.reentryVaporParticles[i];
      vp.life += dt;
      if (vp.life >= vp.maxLife) {
        this.reentryVaporParticles.splice(i, 1);
        continue;
      }

      vp.vx *= 0.985;
      vp.vy *= 0.985;
      vp.x += (vp.vx + vp.turbX) * dt;
      vp.y += (vp.vy + vp.turbY) * dt;

      const progress = vp.life / vp.maxLife;
      const curSize = vp.size + (vp.maxSize - vp.size) * Math.sin(progress * Math.PI * 0.5);
      const curAlpha = vp.alpha * (1 - progress);

      ctx.save();
      if (vp.isPlasma) {
        const grad = ctx.createRadialGradient(vp.x, vp.y, 0, vp.x, vp.y, curSize);
        grad.addColorStop(0, vp.color);
        grad.addColorStop(0.35, 'rgba(249, 115, 22, 0.6)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = curAlpha;
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, curSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const grad = ctx.createRadialGradient(vp.x, vp.y, curSize * 0.1, vp.x, vp.y, curSize);
        grad.addColorStop(0, `rgba(255, 255, 255, ${curAlpha * 0.65})`);
        grad.addColorStop(0.55, `rgba(241, 245, 249, ${curAlpha * 0.45})`);
        grad.addColorStop(1, 'rgba(203, 213, 225, 0)');
        ctx.fillStyle = grad;
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, curSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Render Flame Particles
    for (let i = this.flameParticles.length - 1; i >= 0; i--) {
      const p = this.flameParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.flameParticles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * (p.growth || 2.0);
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);

      if (p.shape === 'diamond') {
        const dW = p.size * 0.75;
        const dH = p.size * 1.5;
        const vAngle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(vAngle);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.moveTo(0, -dH);
        ctx.lineTo(dW, 0);
        ctx.lineTo(0, dH);
        ctx.lineTo(-dW, 0);
        ctx.closePath();
        ctx.fill();

        if (p.secondaryColor) {
          ctx.fillStyle = p.secondaryColor;
          ctx.beginPath();
          ctx.moveTo(0, -dH * 0.45);
          ctx.lineTo(dW * 0.45, 0);
          ctx.lineTo(0, dH * 0.45);
          ctx.lineTo(-dW * 0.45, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else if (p.shape === 'streak') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.6, p.size * 0.5);
        ctx.globalAlpha = p.alpha;
        const speed = Math.hypot(p.vx, p.vy);
        const len = Math.min(p.size * 5, speed * 0.08);
        const normX = p.vx / (speed || 1);
        const normY = p.vy / (speed || 1);
        ctx.beginPath();
        ctx.moveTo(p.x - normX * len, p.y - normY * len);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (p.shape === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.4, p.size * 0.2);
        ctx.globalAlpha = p.alpha * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Render Sparks & Hot Embers
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkParticles[i];
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        this.sparkParticles.splice(i, 1);
        continue;
      }
      if (sp.drag) {
        sp.vx *= sp.drag;
        sp.vy *= sp.drag;
      }
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.alpha = Math.max(0, 1 - sp.life / sp.maxLife);

      if (sp.shape === 'spark' || Math.random() > 0.45) {
        ctx.strokeStyle = sp.color;
        ctx.lineWidth = 0.8;
        ctx.globalAlpha = sp.alpha;
        const rad = sp.size * 1.5;
        ctx.beginPath();
        ctx.moveTo(sp.x - rad, sp.y);
        ctx.lineTo(sp.x + rad, sp.y);
        ctx.moveTo(sp.x, sp.y - rad);
        ctx.lineTo(sp.x, sp.y + rad);
        ctx.stroke();
      } else {
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.alpha;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 5. Render RCS Puffs
    for (let i = this.rcsParticles.length - 1; i >= 0; i--) {
      const r = this.rcsParticles[i];
      r.life += dt;
      if (r.life >= r.maxLife) {
        this.rcsParticles.splice(i, 1);
        continue;
      }
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.size += dt * (r.growth || 1.0);
      r.alpha = Math.max(0, 1 - r.life / r.maxLife);

      ctx.fillStyle = r.color;
      ctx.globalAlpha = r.alpha * 0.75;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Render Smoke Trails
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const s = this.smokeParticles[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        this.smokeParticles.splice(i, 1);
        continue;
      }
      if (s.drag) {
        s.vx *= s.drag;
        s.vy *= s.drag;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.size += dt * (s.growth || 3.0);
      s.alpha = Math.max(0, (1 - s.life / s.maxLife) * 0.55);

      if (s.shape === 'ring') {
        ctx.strokeStyle = s.color;
        ctx.lineWidth = Math.max(0.5, s.size * 0.18);
        ctx.globalAlpha = s.alpha * 0.8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.shape === 'smoke_puff') {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.alpha * 0.65;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.arc(s.x + s.size * 0.35, s.y - s.size * 0.25, s.size * 0.7, 0, Math.PI * 2);
        ctx.arc(s.x - s.size * 0.35, s.y + s.size * 0.25, s.size * 0.65, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 7. Render Explosions
    for (let i = this.explosionParticles.length - 1; i >= 0; i--) {
      const ep = this.explosionParticles[i];
      ep.life += dt;
      if (ep.life >= ep.maxLife) {
        this.explosionParticles.splice(i, 1);
        continue;
      }
      if (ep.drag) {
        ep.vx *= ep.drag;
        ep.vy *= ep.drag;
      }
      ep.x += ep.vx * dt;
      ep.y += ep.vy * dt;
      ep.size += dt * (ep.growth || 2.5);
      ep.alpha = 1 - ep.life / ep.maxLife;

      ctx.fillStyle = ep.color;
      ctx.globalAlpha = ep.alpha;
      ctx.beginPath();
      ctx.arc(ep.x, ep.y, ep.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;
  }

  /**
   * Renders shockwaves and ground reflections
   */
  private renderShockwavesAndOverlays(ctx: CanvasRenderingContext2D, dt: number) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = sw.life / sw.maxLife;
      sw.radius = sw.maxRadius * Math.sin((progress * Math.PI) / 2);
      sw.alpha = 1 - progress;

      ctx.save();
      ctx.strokeStyle = `rgba(255, 237, 213, ${sw.alpha * 0.8})`;
      ctx.lineWidth = Math.max(0.4, (1 - progress) * 2.5);
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawVessel(ctx: CanvasRenderingContext2D, vessel: VesselState, dt: number) {
    if (vessel.isCrashed) return;
    const activeBody = vessel.soi === 'moon' ? physicsEngine.moon : physicsEngine.earth;
    const atmoHeight = activeBody.atmosphereHeight;
    const atmoDensity = atmoHeight > 0 ? Math.max(0, 1 - vessel.altitude / atmoHeight) : 0;
    const speed = Math.hypot(vessel.vx, vessel.vy);

    ctx.save();
    ctx.translate(vessel.x, vessel.y);
    ctx.rotate(vessel.angle);

    // --- 1. REENTRY HYPERSONIC SHOCKWAVE PLASMA GLOW & ABLATOR SPARKS ---
    // Compute local relative airflow direction
    const cosA = Math.cos(vessel.angle);
    const sinA = Math.sin(vessel.angle);
    const relVx = -vessel.vx;
    const relVy = -vessel.vy;
    const localWindX = relVx * cosA + relVy * sinA;
    const localWindY = -relVx * sinA + relVy * cosA;
    const windDist = Math.hypot(localWindX, localWindY);
    const localWindAngle = Math.atan2(localWindY, localWindX);

    // Vessel vertical bounds in local space
    let minPy = -2;
    let maxPy = 4;
    let maxPx = 1.5;
    vessel.parts.forEach((p) => {
      const def = PART_CATALOG[p.partId];
      const h = def ? getPartHeight(p, def) : 2;
      const w = def ? getPartWidth(p, def) : 2;
      minPy = Math.min(minPy, p.y - h / 2);
      maxPy = Math.max(maxPy, p.y + h / 2);
      maxPx = Math.max(maxPx, Math.abs(p.x) + w / 2);
    });

    const leadX = windDist > 1 ? (localWindX / windDist) * (maxPx * 0.9) : 0;
    const leadY = windDist > 1 ? (localWindY / windDist) * (localWindY >= 0 ? maxPy : Math.abs(minPy)) : (localWindY >= 0 ? maxPy : minPy);

    if (vessel.heatFlux > 0.015 || (speed > 400 && atmoDensity > 0.02)) {
      ctx.save();
      const heatIntensity = Math.min(1.0, vessel.heatFlux * 1.5 + (speed - 400) / 700);
      const plasmaAlpha = Math.min(0.95, Math.max(0.2, heatIntensity));

      ctx.translate(leadX, leadY);
      ctx.rotate(localWindAngle);

      // Incandescent Bow Shock Cap (wrapping around the windward edge)
      const shockRadius = maxPx * 1.8;
      const plasmaGrad = ctx.createRadialGradient(0, 0, shockRadius * 0.1, 0, 0, shockRadius);
      plasmaGrad.addColorStop(0, `rgba(255, 255, 255, ${plasmaAlpha})`);
      plasmaGrad.addColorStop(0.3, `rgba(254, 240, 138, ${plasmaAlpha * 0.9})`);
      plasmaGrad.addColorStop(0.65, `rgba(249, 115, 22, ${plasmaAlpha * 0.6})`);
      plasmaGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = plasmaGrad;
      ctx.beginPath();
      ctx.arc(0, 0, shockRadius, -Math.PI * 0.65, Math.PI * 0.65);
      ctx.lineTo(-shockRadius * 1.5, shockRadius * 0.8);
      ctx.lineTo(-shockRadius * 1.5, -shockRadius * 0.8);
      ctx.closePath();
      ctx.fill();

      // Hypersonic Ionized Plasma Wake Sheath (trailing downstream along airflow)
      const wakeGrad = ctx.createLinearGradient(0, 0, -shockRadius * 3.5, 0);
      wakeGrad.addColorStop(0, `rgba(254, 215, 170, ${plasmaAlpha * 0.75})`);
      wakeGrad.addColorStop(0.35, `rgba(249, 115, 22, ${plasmaAlpha * 0.45})`);
      wakeGrad.addColorStop(0.75, `rgba(239, 68, 68, ${plasmaAlpha * 0.2})`);
      wakeGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = wakeGrad;
      ctx.beginPath();
      ctx.moveTo(0, shockRadius * 0.7);
      ctx.lineTo(-shockRadius * 3.5, shockRadius * 1.8);
      ctx.lineTo(-shockRadius * 3.5, -shockRadius * 1.8);
      ctx.lineTo(0, -shockRadius * 0.7);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // --- 2. TRANSONIC & SUPERSONIC CONDENSATION VAPOR CONE (Mach Shock Collar) ---
    // Occurs between Mach 0.85 and Mach 1.8 (~280 - 620 m/s) in dense atmosphere
    if (speed >= 260 && speed <= 650 && atmoDensity > 0.08) {
      const machIntensity = Math.min(1.0, 1.0 - Math.abs(speed - 380) / 220) * atmoDensity;
      if (machIntensity > 0.04) {
        ctx.save();
        const midY = (minPy + maxPy) * 0.5;
        ctx.translate(0, midY);
        ctx.rotate(localWindAngle);

        const vaporAlpha = machIntensity * 0.65;
        const coneWidth = maxPx * 3.2;
        const coneLength = maxPx * 4.5;

        // Vapor Cone Shimmer Collar
        const coneGrad = ctx.createLinearGradient(0, 0, -coneLength, 0);
        coneGrad.addColorStop(0, `rgba(255, 255, 255, ${vaporAlpha * 0.95})`);
        coneGrad.addColorStop(0.4, `rgba(241, 245, 249, ${vaporAlpha * 0.6})`);
        coneGrad.addColorStop(1, 'rgba(241, 245, 249, 0)');

        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-coneLength, coneWidth);
        ctx.lineTo(-coneLength * 1.2, coneWidth * 0.8);
        ctx.lineTo(-coneLength * 1.2, -coneWidth * 0.8);
        ctx.lineTo(-coneLength, -coneWidth);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 255, 255, ${vaporAlpha * 0.9})`;
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(-coneLength, -coneWidth);
        ctx.lineTo(0, 0);
        ctx.lineTo(-coneLength, coneWidth);
        ctx.stroke();

        ctx.restore();
      }
    }

    // --- 3. DRAW ROCKET PARTS & INTEGRATED ENGINE PLUMES ---
    vessel.parts.forEach((part) => {
      const def = PART_CATALOG[part.partId];
      if (!def) return;

      const isSelectedTank = vessel.selectedTankUids.includes(part.uid);

      ctx.save();
      try {
        ctx.translate(part.x, part.y);
        ctx.rotate((part.rotation * Math.PI) / 180);

        const partW = getPartWidth(part, def);
        const partH = getPartHeight(part, def);
        const hw = partW / 2;
        const hh = partH / 2;

        const isEngineActive = part.isEngineOn === true || (part.isEngineOn !== false && part.stage === vessel.activeStageIndex);
        const hasFuel = vessel.parts.some(
          (t) => !PART_CATALOG[t.partId]?.isSRB && t.fuelRemaining !== undefined && t.fuelRemaining > 0.001
        );
        const isFiring =
          isEngineActive &&
          vessel.throttle > 0.01 &&
          (def.isSRB ? (part.fuelRemaining ?? def.fuelMass) > 0.001 : hasFuel);

        // 1. Draw Part Vector Geometry using high-fidelity aerospace 2D renderer
        ctx.save();
        try {
          // Scale from world meters to crisp 1:1 screen pixels, and invert Y so -hh points UP towards space (+Y)
          ctx.scale(1 / this.zoom, -1 / this.zoom);

          const pw = partW * this.zoom;
          const ph = partH * this.zoom;

          let shroudHeightPx = 0;
          if (def.isDecoupler && !def.isSideSeparator && !part.activated) {
            const engineAbove = vessel.parts.find((other) => {
              if (other.uid === part.uid) return false;
              const oDef = PART_CATALOG[other.partId];
              if (!oDef || (oDef.category !== 'Propulsion' && !oDef.isSRB && oDef.maxThrust <= 0)) return false;
              const dx = Math.abs(other.x - part.x);
              if (dx > 0.8) return false;
              const oH = getPartHeight(other, oDef);
              const otherBottom = other.y - oH / 2;
              const myTop = part.y + partH / 2;
              return other.y > part.y && otherBottom <= myTop + 2.5 && (myTop + 3.5) >= other.y;
            });
            if (engineAbove) {
              const oDef = PART_CATALOG[engineAbove.partId];
              const engH = getPartHeight(engineAbove, oDef);
              const shroudH = Math.max(engH, (engineAbove.y + engH / 2) - (part.y + partH / 2));
              shroudHeightPx = shroudH * this.zoom;
            }
          }

          // Supersonic Engine Exhaust Plume & Shock Diamonds (1:1 with Juno Engine Configurator preview)
          const isPropulsion = def.category === 'Propulsion' || def.isSRB || def.maxThrust > 0;
          if (isFiring && isPropulsion) {
            if (!this.engineIgnitionTimes.has(part.uid)) {
              this.engineIgnitionTimes.set(part.uid, performance.now());
            }
          } else {
            this.engineIgnitionTimes.delete(part.uid);
          }

          if (isFiring && isPropulsion) {
            const engineConfig: JunoEngineConfig = part.engineConfig || {
              ...DEFAULT_JUNO_ENGINE_CONFIG,
              engineType: def.isSRB ? 'Solid' : def.id === 'engine_nuclear_nerva' ? 'Nuclear Thermal' : 'Liquid',
              powerCycle: def.isSRB ? 'Booster' : 'Gas Generator II',
              liquidFuel: def.fuelType === 'hydrolox' ? 'Hydrolox' : def.fuelType === 'methalox' ? 'Methalox' : 'Kerolox',
            };

            const altitudeKm = Math.max(0, vessel.altitude / 1000);
            const perf = calculateJunoEnginePerformance(engineConfig, altitudeKm);
            const ignStart = this.engineIgnitionTimes.get(part.uid);
            const ignitionAgeSec = ignStart !== undefined ? (performance.now() - ignStart) / 1000 : 999;

            const lengthFactor = Math.max(0.2, Math.min(2.0, (engineConfig.nozzleLengthPercent || 100) / 100));
            const mountH = ph * 0.22;
            const throatY = -ph * 0.5 + mountH + ph * 0.10;
            const nozzleH = Math.max(ph * 0.35, ph * 0.62 * lengthFactor);
            const exitY = Math.min(ph * 0.5 + 12, throatY + nozzleH);
            const pivotY = -ph * 0.5 + mountH;
            const nozzleL = exitY - pivotY;

            let baseExitW = (pw * 0.5) * 0.85 * Math.sqrt(lengthFactor);
            if (engineConfig.nozzleStyle === 'Cone') baseExitW = (pw * 0.5) * 0.72 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Bravo') baseExitW = (pw * 0.5) * 0.95 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Delta') baseExitW = (pw * 0.5) * 1.28 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Omega') baseExitW = (pw * 0.5) * 1.12 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Dual Bell') baseExitW = (pw * 0.5) * 1.20 * Math.sqrt(lengthFactor);
            else if (engineConfig.nozzleStyle === 'Aerospike') baseExitW = (pw * 0.5) * 0.88;

            const mountCount = part.engineMountCount || 1;
            const mountSlots =
              mountCount === 1
                ? [0]
                : mountCount === 2
                ? [-pw * 0.25, pw * 0.25]
                : [-pw * 0.32, 0, pw * 0.32];
            const slotExitW = baseExitW / Math.sqrt(mountCount);
            const gimbal = def.isSRB ? 0 : (vessel.gimbalAngle || 0);

            mountSlots.forEach((slotX) => {
              ctx.save();
              ctx.translate(slotX, pivotY);
              if (gimbal !== 0 && engineConfig.engineType !== 'Solid') {
                ctx.rotate(gimbal);
              }
              drawJunoEnginePlume2D(
                ctx,
                engineConfig,
                vessel.throttle,
                0,
                nozzleL,
                slotExitW,
                altitudeKm,
                0,
                performance.now() * 0.001,
                perf.exitPressureKPa,
                ignitionAgeSec
              );
              ctx.restore();
            });
          }

          // Calculate Adaptive Adapter Dimensions (cone + cylinder transition) in flight
          let topWidthPx: number | undefined;
          let bottomWidthPx: number | undefined;
          let adapterShape: 'cone_cylinder' | 'straight' | undefined = (part.adapterShape === 'cone_cylinder' || part.adapterShape === 'straight')
            ? part.adapterShape
            : undefined;

          const isSeparationOrAdapter = (def.isDecoupler && !def.isSideSeparator) || 
            part.partId === 'structural_adapter' || 
            part.partId.includes('adapter') || 
            part.partId.includes('decoupler');

          if (isSeparationOrAdapter) {
            const partBelow = vessel.parts.find((other) => {
              if (other.uid === part.uid) return false;
              const oDef = PART_CATALOG[other.partId];
              if (!oDef) return false;
              const oH = getPartHeight(other, oDef);
              const otherTop = other.y + oH / 2;
              const myBottom = part.y - partH / 2;
              return Math.abs(other.x - part.x) < 0.8 && Math.abs(otherTop - myBottom) < 0.65;
            });

            const partAbove = vessel.parts.find((other) => {
              if (other.uid === part.uid) return false;
              const oDef = PART_CATALOG[other.partId];
              if (!oDef) return false;
              const oH = getPartHeight(other, oDef);
              const otherBottom = other.y - oH / 2;
              const myTop = part.y + partH / 2;
              return Math.abs(other.x - part.x) < 0.8 && Math.abs(otherBottom - myTop) < 0.65;
            });

            const defaultBot = part.partId === 'structural_adapter' ? 3.0 : partW;
            const defaultTop = part.partId === 'structural_adapter' ? 2.0 : partW;

            const wBelow = part.adapterBottomWidth ?? (partBelow ? getPartWidth(partBelow, PART_CATALOG[partBelow.partId]) : (partAbove ? undefined : defaultBot));
            let wAbove = part.adapterTopWidth;

            if (!wAbove && partAbove) {
              const oDef = PART_CATALOG[partAbove.partId];
              if (oDef.category === 'Propulsion') {
                const oH = getPartHeight(partAbove, oDef);
                const tankAboveEng = vessel.parts.find((t) => {
                  if (t.uid === partAbove.uid || t.uid === part.uid) return false;
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
            if (!wAbove && !partBelow && part.partId === 'structural_adapter') {
              wAbove = defaultTop;
            }

            const effBot = wBelow ?? (wAbove !== undefined && wAbove > 1.8 ? wAbove * 1.35 : (part.partId === 'structural_adapter' ? defaultBot : partW));
            const effTop = wAbove ?? (wBelow !== undefined && wBelow > 1.8 ? wBelow * 0.75 : (part.partId === 'structural_adapter' ? defaultTop : partW));
            bottomWidthPx = effBot * this.zoom;
            topWidthPx = effTop * this.zoom;
            if (Math.abs(effBot - effTop) > 0.05 || part.partId === 'structural_adapter') {
              adapterShape = 'cone_cylinder';
            }
          }

          drawPart2D(ctx, def, {
            widthPx: pw,
            heightPx: ph,
            rotation: 0,
            isSelected: isSelectedTank,
            isHovered: false,
            isFlight: true,
            deployed: part.deployed !== undefined
              ? part.deployed
              : (
                (def.isParachute && vessel.parachutesDeployed) ||
                (def.isLandingLeg && vessel.landingLegsDeployed) ||
                (def.isSolarPanel && vessel.solarPanelsDeployed)
              ),
            deployProgress: part.deployProgress !== undefined
              ? part.deployProgress
              : (
                (def.isLandingLeg && (part.deployed !== undefined ? part.deployed : vessel.landingLegsDeployed)) ||
                (def.isSolarPanel && (part.deployed !== undefined ? part.deployed : vessel.solarPanelsDeployed))
                  ? 1.0
                  : 0.0
              ),
            solarPanelType: part.solarPanelType,
            solarGridN: part.solarGridN,
            solarGridM: part.solarGridM,
            solarScale: part.solarScale,
            solarBoomLengthM: part.solarBoomLengthM,
            solarCellWidthM: part.solarCellWidthM,
            solarCellHeightM: part.solarCellHeightM,
            solarPanelStyle: part.solarPanelStyle,
            solarSectors: part.solarSectors,
            solarHexRings: part.solarHexRings,
            solarEfficiency: part.solarEfficiency,
            landingLegType: part.landingLegType || def.landingLegType,
            legSuspensionStiffness: part.legSuspensionStiffness || def.springStiffness,
            legSuspensionDamping: part.legSuspensionDamping || def.suspensionDamping,
            legDeployAngleDeg: part.legDeployAngleDeg,
            legFootpadType: part.legFootpadType || def.legFootpadType,
            legScale: part.legScale,
            suspensionCompression: (part.isLegGrounded || vessel.isLanded) ? (vessel.landingGearCompression || 0.25) : 0,
            rcsThrusterType: part.rcsThrusterType || def.rcsThrusterType,
            rcsNozzleCount: part.rcsNozzleCount || def.rcsNozzleCount,
            rcsThrustKn: part.rcsThrustKn || def.rcsThrustKn,
            rcsPropellantType: part.rcsPropellantType || def.rcsPropellantType,
            rcsCantAngleDeg: part.rcsCantAngleDeg,
            rcsScale: part.rcsScale,
            rcsGimbalAngleRad: part.rcsGimbalAngleRad,
            rcsFiring: vessel.rcsActive && (
              Math.abs(vessel.rcsLateralCommand || 0) > 0.05 ||
              Math.abs(vessel.rcsPitchCommand || 0) > 0.05 ||
              Math.abs(vessel.rcsTranslationX || 0) > 0.05 ||
              Math.abs(vessel.rcsTranslationY || 0) > 0.05
            ),
            wheelSteerAngle: part.wheelSteerAngle,
            wheelRotation: part.wheelRotation,
            throttle: isFiring ? vessel.throttle : 0,
            engineActive: isEngineActive,
            showSnapPoints: false,
            fuelPercent: part.maxFuel && part.maxFuel > 0 ? (part.fuelRemaining ?? part.maxFuel) / part.maxFuel : 1.0,
            gimbalAngle: def.isSRB ? 0 : (vessel.gimbalAngle || 0),
            shroudHeightPx,
            topWidthPx,
            bottomWidthPx,
            adapterShape,
            engineConfig: part.engineConfig,
            customNozzleType: part.customNozzleType,
            propellantType: part.propellantType,
            tankSkin: part.tankSkin,
            engineMountCount: part.engineMountCount,
          });
        } finally {
          ctx.restore();
        }

        // 3. Deployed Parachute Canopy in Atmospheric Flight
        if (def.isParachute && vessel.parachutesDeployed) {
          this.drawDeployedParachute(ctx, hw, hh, vessel.altitude, part);
        }

        // 4. Selected Tank Sleek Halo in World Coordinates
        if (isSelectedTank) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 0.15;
          ctx.strokeRect(-hw - 0.05, -hh - 0.05, partW + 0.1, partH + 0.1);
        }
      } finally {
        ctx.restore();
      }
    });

    // --- 3.1 DRAW PROTECTIVE INTERSTAGE SHROUDS OVER NEXT STAGE ENGINES ---
    // The separator covers and protects the engine of the next stage.
    // When activated, the shroud is discarded, revealing the upper engine.
    vessel.parts.forEach((part) => {
      const def = PART_CATALOG[part.partId];
      if (!def || !def.isDecoupler || def.isSideSeparator || part.activated) return;

      const partW = getPartWidth(part, def);
      const partH = getPartHeight(part, def);

      const engineAbove = vessel.parts.find((other) => {
        if (other.uid === part.uid) return false;
        const oDef = PART_CATALOG[other.partId];
        if (!oDef || (oDef.category !== 'Propulsion' && !oDef.isSRB && oDef.maxThrust <= 0)) return false;
        if (other.stage <= part.stage) return false;
        const dx = Math.abs(other.x - part.x);
        if (dx > 0.6) return false;
        const oH = getPartHeight(other, oDef);
        const otherBottom = other.y - oH / 2;
        const myTop = part.y + partH / 2;
        return otherBottom >= myTop - 0.5 && otherBottom <= myTop + 1.2;
      });

      if (engineAbove) {
        const oDef = PART_CATALOG[engineAbove.partId];
        const engH = getPartHeight(engineAbove, oDef);
        const shroudHeightPx = engH * this.zoom;
        const pw = partW * this.zoom;
        const ph = partH * this.zoom;

        ctx.save();
        ctx.translate(part.x, part.y);
        ctx.rotate((part.rotation * Math.PI) / 180);
        ctx.scale(1 / this.zoom, -1 / this.zoom);
        drawInterstageShroudDirect(ctx, 0, -ph / 2, pw, shroudHeightPx, false, false, true);
        ctx.restore();
      }
    });

    ctx.restore();
  }

  private drawDeployedParachute(ctx: CanvasRenderingContext2D, hw: number, hh: number, altitude: number = 0, part?: PlacedPart) {
    const deployAlt = part?.parachuteDeployAltitudeM ?? 1500;
    const reefingAlt = part?.parachuteReefingCutAltM ?? 800;
    const baseDiameter = part?.parachuteCanopyDiameterM ?? 14;

    // Use part's simulated 4-stage parachuteState if set by physicsEngine, or evaluate from altitude
    let stage: 'PILOT' | 'DROGUE' | 'MAIN' = part?.parachuteState === 'PILOT' || part?.parachuteState === 'DROGUE' || part?.parachuteState === 'MAIN'
      ? part.parachuteState
      : (altitude > deployAlt * 0.75 ? 'PILOT' : altitude > reefingAlt ? 'DROGUE' : 'MAIN');

    ctx.save();

    // If vessel has touched down and is landed, the parachute realistically deflates and collapses to the side
    const isLanded = altitude <= 0.5;
    if (isLanded) {
      const deflateSide = 1.0;
      const drapeX = (baseDiameter * 0.45) * deflateSide;
      const drapeY = hh + 0.8;

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.quadraticCurveTo(drapeX * 0.5, hh + 1.2, drapeX, drapeY);
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.ellipse(drapeX, drapeY, baseDiameter * 0.35, 0.4, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.ellipse(drapeX - 0.5, drapeY + 0.1, baseDiameter * 0.18, 0.25, 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (stage === 'PILOT') {
      // Stage 1: Mortar Extraction & Pilot Chute
      const canopyY = hh + 9;
      const r = Math.max(1.4, (baseDiameter * 0.14) / 2);

      // Pilot riser line
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(0, hh);
      ctx.lineTo(0, canopyY);
      ctx.stroke();

      // Pilot canopy
      const pGrad = ctx.createLinearGradient(-r, canopyY, r, canopyY);
      pGrad.addColorStop(0, '#ea580c');
      pGrad.addColorStop(0.5, '#ffffff');
      pGrad.addColorStop(1, '#ea580c');
      ctx.fillStyle = pGrad;
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.arc(0, canopyY + 0.6, r, Math.PI, 0, false);
      ctx.fill();
      ctx.stroke();
    } else if (stage === 'DROGUE') {
      // Stage 2: Reefed High-Speed Deceleration Drogue
      const canopyY = hh + 14;
      const r = Math.max(2.8, (baseDiameter * 0.35) / 2);

      // Triple suspension bridle
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 0.09;
      ctx.beginPath();
      ctx.moveTo(-hw * 0.5, hh);
      ctx.lineTo(-r * 0.5, canopyY);
      ctx.moveTo(hw * 0.5, hh);
      ctx.lineTo(r * 0.5, canopyY);
      ctx.moveTo(0, hh);
      ctx.lineTo(0, canopyY);
      ctx.stroke();

      // Conical reefed drogue canopy with aerodynamic vents
      const dGrad = ctx.createLinearGradient(-r, canopyY, r, canopyY);
      dGrad.addColorStop(0, '#f97316');
      dGrad.addColorStop(0.3, '#ffffff');
      dGrad.addColorStop(0.5, '#ea580c');
      dGrad.addColorStop(0.7, '#ffffff');
      dGrad.addColorStop(1, '#f97316');
      ctx.fillStyle = dGrad;
      ctx.strokeStyle = '#c2410c';
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.moveTo(-r, canopyY + r * 0.25);
      ctx.quadraticCurveTo(0, canopyY - r * 0.5, r, canopyY + r * 0.25);
      ctx.lineTo(r * 0.45, canopyY + r * 0.65);
      ctx.lineTo(-r * 0.45, canopyY + r * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Reefing ring band
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      ctx.arc(0, canopyY + r * 0.55, r * 0.45, 0, Math.PI);
      ctx.stroke();
    } else {
      // Stage 3 & 4: Reefing Cut & Full Blossoming Main Canopy
      const chuteType = (part?.parachuteChuteType || 'Main').toLowerCase();

      if (chuteType.includes('cluster')) {
        // Apollo Tri-Canopy Recovery Cluster (3 synchronized radial domes)
        const clusterY = hh + Math.max(16, baseDiameter * 1.3);
        const subR = Math.max(3.0, (baseDiameter * 0.65) / 2);

        const subCanopies = [
          { angle: -0.22, xOff: -subR * 1.05, yOff: 1.0 },
          { angle: 0.0, xOff: 0, yOff: -subR * 0.2 },
          { angle: 0.22, xOff: subR * 1.05, yOff: 1.0 },
        ];

        subCanopies.forEach((sc) => {
          ctx.save();
          ctx.translate(sc.xOff, clusterY + sc.yOff);
          ctx.rotate(sc.angle);

          // Riser cords
          ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
          ctx.lineWidth = 0.08;
          ctx.beginPath();
          ctx.moveTo(-sc.xOff * 0.3, -clusterY - sc.yOff + hh);
          ctx.lineTo(-subR * 0.7, 0);
          ctx.moveTo(-sc.xOff * 0.3, -clusterY - sc.yOff + hh);
          ctx.lineTo(0, 0);
          ctx.moveTo(-sc.xOff * 0.3, -clusterY - sc.yOff + hh);
          ctx.lineTo(subR * 0.7, 0);
          ctx.stroke();

          // Canopy
          const cGrad = ctx.createLinearGradient(-subR, 0, subR, 0);
          cGrad.addColorStop(0, '#ea580c');
          cGrad.addColorStop(0.25, '#ffffff');
          cGrad.addColorStop(0.5, '#ea580c');
          cGrad.addColorStop(0.75, '#ffffff');
          cGrad.addColorStop(1, '#ea580c');

          ctx.fillStyle = cGrad;
          ctx.strokeStyle = '#c2410c';
          ctx.lineWidth = 0.12;
          ctx.beginPath();
          ctx.arc(0, 0, subR, Math.PI, 0, false);
          ctx.quadraticCurveTo(0, subR * 0.35, -subR, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Apex vent
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.ellipse(0, -subR * 0.8, subR * 0.16, subR * 0.06, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        });

        // Spreader bridles
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(subCanopies[0].xOff + subR * 0.5, clusterY);
        ctx.lineTo(subCanopies[1].xOff - subR * 0.5, clusterY);
        ctx.moveTo(subCanopies[1].xOff + subR * 0.5, clusterY);
        ctx.lineTo(subCanopies[2].xOff - subR * 0.5, clusterY);
        ctx.stroke();
      } else if (chuteType.includes('ram')) {
        // Steerable Ram-Air Parafoil Wing
        const wingY = hh + Math.max(14, baseDiameter * 1.2);
        const span = Math.max(8.0, baseDiameter * 1.3);
        const chord = Math.max(2.5, baseDiameter * 0.35);

        // Lines cascade
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
        ctx.lineWidth = 0.08;
        for (let c = 0; c < 5; c++) {
          const frac = (c / 4) * 2 - 1;
          ctx.beginPath();
          ctx.moveTo(frac * hw * 0.6, hh);
          ctx.lineTo(frac * span * 0.45, wingY);
          ctx.stroke();
        }

        // Cambered Parafoil Wing
        const wGrad = ctx.createLinearGradient(-span / 2, wingY, span / 2, wingY);
        wGrad.addColorStop(0, '#0284c7');
        wGrad.addColorStop(0.25, '#38bdf8');
        wGrad.addColorStop(0.5, '#ffffff');
        wGrad.addColorStop(0.75, '#38bdf8');
        wGrad.addColorStop(1, '#0284c7');

        ctx.fillStyle = wGrad;
        ctx.strokeStyle = '#0369a1';
        ctx.lineWidth = 0.14;
        ctx.beginPath();
        ctx.moveTo(-span / 2, wingY);
        ctx.quadraticCurveTo(0, wingY + chord * 0.8, span / 2, wingY);
        ctx.lineTo(span * 0.46, wingY - chord * 0.4);
        ctx.quadraticCurveTo(0, wingY + chord * 0.3, -span * 0.46, wingY - chord * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cell rib lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 0.06;
        const numCells = 6;
        for (let i = 1; i < numCells; i++) {
          const cx = -span * 0.45 + (span * 0.9 / numCells) * i;
          ctx.beginPath();
          ctx.moveTo(cx, wingY - chord * 0.3);
          ctx.lineTo(cx, wingY + chord * 0.6);
          ctx.stroke();
        }
      } else {
        // Standard Mk16 Hemispherical Gore Canopy
        const canopyY = hh + Math.max(16, baseDiameter * 1.4);
        const r = Math.max(4.5, baseDiameter / 2);

        // Multi-point braided suspension cords
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
        ctx.lineWidth = 0.09;
        ctx.beginPath();
        ctx.moveTo(-hw * 0.85, hh);
        ctx.lineTo(-r * 0.88, canopyY);
        ctx.moveTo(-hw * 0.35, hh);
        ctx.lineTo(-r * 0.32, canopyY);
        ctx.moveTo(hw * 0.35, hh);
        ctx.lineTo(r * 0.32, canopyY);
        ctx.moveTo(hw * 0.85, hh);
        ctx.lineTo(r * 0.88, canopyY);
        ctx.stroke();

        // Main canopy hemispherical shell with authentic multi-gore pattern
        const mGrad = ctx.createLinearGradient(-r, canopyY, r, canopyY);
        if (chuteType.includes('drogue')) {
          mGrad.addColorStop(0.00, '#ea580c');
          mGrad.addColorStop(0.50, '#ffffff');
          mGrad.addColorStop(1.00, '#ea580c');
        } else {
          // Apollo / Dragon alternating red & white sectors
          mGrad.addColorStop(0.00, '#dc2626');
          mGrad.addColorStop(0.20, '#f8fafc');
          mGrad.addColorStop(0.40, '#dc2626');
          mGrad.addColorStop(0.60, '#f8fafc');
          mGrad.addColorStop(0.80, '#dc2626');
          mGrad.addColorStop(1.00, '#f8fafc');
        }

        ctx.fillStyle = mGrad;
        ctx.strokeStyle = '#991b1b';
        ctx.lineWidth = 0.16;
        ctx.beginPath();
        ctx.arc(0, canopyY + r * 0.12, r, Math.PI, 0, false);
        ctx.quadraticCurveTo(0, canopyY + r * 0.38, -r, canopyY + r * 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Canopy apex vent hole
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, canopyY - r * 0.84, r * 0.18, r * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Unique Engine Plumes, Mach Shock Diamonds & Visual Trails by Power Type & Propellant
   */
  private drawEnginePlume(
    ctx: CanvasRenderingContext2D,
    def: (typeof PART_CATALOG)[string],
    throttle: number,
    hw: number,
    hh: number,
    atmoDensity: number,
    gimbalAngle: number = 0,
    part?: PlacedPart
  ) {
    const cfg = part?.engineConfig;
    const fuelType = (cfg?.engineType === 'Solid' || part?.propellantType === 'solid')
      ? 'solid'
      : (cfg?.engineType === 'Nuclear Thermal' || part?.propellantType === 'nuclear')
      ? 'nuclear'
      : (cfg?.engineType === 'Monopropellant' || part?.propellantType === 'monoprop')
      ? 'monoprop'
      : cfg?.liquidFuel
      ? cfg.liquidFuel.toLowerCase()
      : part?.propellantType
      || def.fuelType
      || 'kerolox';

    const nozzleStyle = cfg?.nozzleStyle || (part?.customNozzleType === 'aerospike' ? 'Aerospike' : part?.customNozzleType === 'vac' ? 'Delta' : part?.customNozzleType === 'cone' ? 'Cone' : def.nozzleType === 'aerospike' ? 'Aerospike' : def.nozzleType === 'vac' ? 'Delta' : 'Bell');
    const isAerospike = nozzleStyle === 'Aerospike' || def.id === 'engine_aerospike' || def.nozzleType === 'aerospike';

    const isSRB = fuelType === 'solid' || def.isSRB || def.id.includes('srb') || def.id === 'launch_escape_tower' || def.id === 'engine_sepratron';
    const isIon = def.id === 'engine_ion' || (cfg?.engineType as string) === 'Electric';
    const isNuclear = fuelType === 'nuclear' || def.id === 'engine_nuclear_nerva';
    const isMethalox = fuelType === 'methalox' || def.id === 'engine_raptor';
    const isHydrolox = fuelType === 'hydrolox' || def.id === 'engine_frontier';
    const isMonoprop = fuelType === 'monoprop' || def.isRCS;
    const isHypergolic = fuelType === 'hypergolic';

    const powerCycle = cfg?.powerCycle || (isSRB ? 'Booster' : isIon ? 'Electric' : isNuclear ? 'Nuclear' : isMethalox ? 'Full Flow Staged' : 'Gas Generator II');

    const now = performance.now() * 0.001;

    // Vacuum expansion expands the plume width in upper atmosphere / space
    const vacuumExpansion = 1.0 + (1.0 - atmoDensity) * (isHydrolox ? 2.8 : isIon ? 0.3 : isMethalox ? 2.2 : isAerospike ? 1.05 : 1.6);
    const plumeLen = Math.max(1.0, (def.height || 1.8) * (1.8 + throttle * 4.2));
    const plumeWidth = hw * (0.8 + throttle * 0.7) * vacuumExpansion;

    ctx.save();

    // Deflect exhaust plume with engine gimbal angle
    if (gimbalAngle !== 0 && !def.isSRB) {
      ctx.translate(0, -hh);
      ctx.rotate(-gimbalAngle);
      ctx.translate(0, hh);
    }

    // 1. Engine Nozzle Thermal Heat Glow
    const glowPulse = 0.95 + Math.sin(now * 12) * 0.05;
    ctx.fillStyle = isIon ? 'rgba(56, 189, 248, 0.5)' : isNuclear ? 'rgba(52, 211, 153, 0.6)' : isMethalox ? 'rgba(168, 85, 247, 0.5)' : `rgba(255, 120, 30, ${(0.4 + throttle * 0.5) * glowPulse})`;
    ctx.beginPath();
    ctx.arc(0, -hh, hw * 0.8 * glowPulse, 0, Math.PI * 2);
    ctx.fill();

    // 2. POWER-CYCLE SPECIFIC PLUME VISUAL ARCHITECTURES
    if (isIon || powerCycle === 'Electric') {
      // --- ELECTRIC / ION PROPULSION: Laser-straight Collimated Xenon Jet with Pulsing Micro-Rings ---
      const ionGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      ionGrad.addColorStop(0, '#ffffff');
      ionGrad.addColorStop(0.2, '#22d3ee');
      ionGrad.addColorStop(0.6, '#06b6d4');
      ionGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');

      ctx.fillStyle = ionGrad;
      ctx.beginPath();
      ctx.moveTo(-plumeWidth * 0.45, -hh);
      ctx.lineTo(-plumeWidth * 0.55, -hh - plumeLen);
      ctx.lineTo(plumeWidth * 0.55, -hh - plumeLen);
      ctx.lineTo(plumeWidth * 0.45, -hh);
      ctx.closePath();
      ctx.fill();

      // Glowing lens flare core
      ctx.fillStyle = 'rgba(165, 243, 252, 0.85)';
      ctx.beginPath();
      ctx.arc(0, -hh - 0.2, 0.45 * throttle * (1 + Math.sin(now * 20) * 0.08), 0, Math.PI * 2);
      ctx.fill();

      // Ion electrostatic emission ring wavelets sliding down the beam axis
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.65)';
      ctx.lineWidth = 0.08;
      for (let r = 1; r <= 4; r++) {
        const ringProgress = ((now * 1.6 + r * 0.25) % 1);
        const ry = -hh - plumeLen * ringProgress;
        const rw = plumeWidth * (0.35 + ringProgress * 0.3);
        ctx.beginPath();
        ctx.ellipse(0, ry, rw, 0.12, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (isNuclear) {
      // --- NUCLEAR THERMAL (Cyan-Emerald Hydrogen Glow & High-Temp Core) ---
      const nucGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      nucGrad.addColorStop(0, '#ffffff');
      nucGrad.addColorStop(0.2, '#34d399');
      nucGrad.addColorStop(0.6, '#059669');
      nucGrad.addColorStop(1, 'rgba(5, 150, 105, 0)');

      const nucW = plumeWidth * (1 + Math.sin(now * 14) * 0.04);
      ctx.fillStyle = nucGrad;
      ctx.beginPath();
      ctx.moveTo(-nucW, -hh);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.6, 0, -hh - plumeLen);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.6, nucW, -hh);
      ctx.closePath();
      ctx.fill();

      const coreGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen * 0.5);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.4, '#6ee7b7');
      coreGrad.addColorStop(1, 'rgba(110, 231, 183, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.moveTo(-nucW * 0.4, -hh);
      ctx.lineTo(0, -hh - plumeLen * 0.5);
      ctx.lineTo(nucW * 0.4, -hh);
      ctx.closePath();
      ctx.fill();
    } else if (isAerospike) {
      // --- AEROSPIKE: Annular Flow Compressing Inward on Center Spike ---
      const spikeGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      spikeGrad.addColorStop(0, '#ffffff');
      spikeGrad.addColorStop(0.2, '#38bdf8');
      spikeGrad.addColorStop(0.6, '#818cf8');
      spikeGrad.addColorStop(1, 'rgba(129, 140, 248, 0)');

      ctx.fillStyle = spikeGrad;
      ctx.beginPath();
      ctx.moveTo(-plumeWidth * 0.9, -hh);
      ctx.quadraticCurveTo(-plumeWidth * 0.2, -hh - plumeLen * 0.4, 0, -hh - plumeLen);
      ctx.quadraticCurveTo(plumeWidth * 0.2, -hh - plumeLen * 0.4, plumeWidth * 0.9, -hh);
      ctx.closePath();
      ctx.fill();

      // Centered supersonic compression mach spear
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.25, -hh);
      ctx.lineTo(0, -hh - plumeLen * 0.7);
      ctx.lineTo(hw * 0.25, -hh);
      ctx.closePath();
      ctx.fill();
    } else if (powerCycle === 'Full Flow Staged') {
      // --- FULL FLOW STAGED COMBUSTION: Neon Violet/Magenta Plume + Pulsing Mach Shock Disks ---
      const ffGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      ffGrad.addColorStop(0, '#ffffff');
      ffGrad.addColorStop(0.12, '#e879f9');
      ffGrad.addColorStop(0.4, '#a855f7');
      ffGrad.addColorStop(0.75, '#6b21a8');
      ffGrad.addColorStop(1, 'rgba(107, 33, 168, 0)');

      const ffJitter = Math.sin(now * 45) * 0.03;
      const ffW = plumeWidth * (1 + ffJitter);

      ctx.fillStyle = ffGrad;
      ctx.beginPath();
      ctx.moveTo(-ffW, -hh);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.6, 0, -hh - plumeLen);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.6, ffW, -hh);
      ctx.closePath();
      ctx.fill();

      // Ultra-clean high-temp cyan core
      const coreGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen * 0.55);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, '#38bdf8');
      coreGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.moveTo(-ffW * 0.42, -hh);
      ctx.lineTo(0, -hh - plumeLen * 0.55);
      ctx.lineTo(ffW * 0.42, -hh);
      ctx.closePath();
      ctx.fill();

      // 5 Sharp Mach Shock Diamonds with High-Frequency Harmonic Vibration
      if (throttle > 0.3) {
        ctx.fillStyle = 'rgba(240, 171, 252, 0.95)';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.08;
        for (let d = 1; d <= 5; d++) {
          const diamondPulse = 1.0 + Math.sin(now * 36 + d * 1.5) * 0.08;
          const dy = -hh - (plumeLen * 0.72 * d) / 6;
          const dw = (ffW * 0.28 * (6 - d) * diamondPulse) / 5;
          const dh = 0.38 * throttle * diamondPulse;
          ctx.beginPath();
          ctx.moveTo(0, dy - dh);
          ctx.lineTo(dw, dy);
          ctx.lineTo(0, dy + dh);
          ctx.lineTo(-dw, dy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    } else if (powerCycle === 'Staged') {
      // --- STAGED COMBUSTION: High Chamber Pressure, Razor-Sharp Supersonic Boundary & Bright Incandescent Flame ---
      const stgGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      stgGrad.addColorStop(0, '#ffffff');
      stgGrad.addColorStop(0.15, '#fed7aa');
      stgGrad.addColorStop(0.45, '#f97316');
      stgGrad.addColorStop(0.8, '#ea580c');
      stgGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');

      const stgW = plumeWidth * 0.95;
      ctx.fillStyle = stgGrad;
      ctx.beginPath();
      ctx.moveTo(-stgW, -hh);
      ctx.lineTo(-stgW * 0.8, -hh - plumeLen * 0.6);
      ctx.lineTo(0, -hh - plumeLen);
      ctx.lineTo(stgW * 0.8, -hh - plumeLen * 0.6);
      ctx.lineTo(stgW, -hh);
      ctx.closePath();
      ctx.fill();

      // Pure white central combustion core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-stgW * 0.35, -hh);
      ctx.lineTo(0, -hh - plumeLen * 0.48);
      ctx.lineTo(stgW * 0.35, -hh);
      ctx.closePath();
      ctx.fill();

      // 4 Mach shock diamonds
      if (throttle > 0.35) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 0.08;
        for (let d = 1; d <= 4; d++) {
          const dy = -hh - (plumeLen * 0.68 * d) / 5;
          const dw = (stgW * 0.3 * (5 - d)) / 4;
          const dh = 0.36 * throttle;
          ctx.beginPath();
          ctx.moveTo(0, dy - dh);
          ctx.lineTo(dw, dy);
          ctx.lineTo(0, dy + dh);
          ctx.lineTo(-dw, dy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    } else if (powerCycle === 'Gas Generator I') {
      // --- GAS GENERATOR I: Classic Open-Cycle Kerolox with Asymmetrical Turbopump Dump Plume on Left ---
      const ggGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      ggGrad.addColorStop(0, '#ffffff');
      ggGrad.addColorStop(0.15, '#fef08a');
      ggGrad.addColorStop(0.4, '#f97316');
      ggGrad.addColorStop(0.75, '#ea580c');
      ggGrad.addColorStop(1, 'rgba(234, 88, 12, 0)');

      const turbWave = Math.sin(now * 18) * plumeWidth * 0.06;
      ctx.fillStyle = ggGrad;
      ctx.beginPath();
      ctx.moveTo(-plumeWidth, -hh);
      ctx.quadraticCurveTo(turbWave, -hh - plumeLen * 0.5, 0, -hh - plumeLen);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.5, plumeWidth, -hh);
      ctx.closePath();
      ctx.fill();

      // Distinct black turbopump exhaust trail dumping from left nozzle rim with undulating flow
      const dumpSootWave = Math.sin(now * 14) * 0.12;
      ctx.fillStyle = 'rgba(30, 41, 59, 0.72)';
      ctx.beginPath();
      ctx.moveTo(-plumeWidth * 0.85, -hh);
      ctx.quadraticCurveTo(-plumeWidth * (0.95 + dumpSootWave), -hh - plumeLen * 0.4, -plumeWidth * 0.7, -hh - plumeLen * 0.7);
      ctx.lineTo(-plumeWidth * 0.55, -hh - plumeLen * 0.65);
      ctx.quadraticCurveTo(-plumeWidth * 0.7, -hh - plumeLen * 0.3, -plumeWidth * 0.65, -hh);
      ctx.closePath();
      ctx.fill();

      // 3 Central Mach diamonds
      if (throttle > 0.4) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.9)';
        ctx.lineWidth = 0.08;
        for (let d = 1; d <= 3; d++) {
          const dy = -hh - (plumeLen * 0.62 * d) / 4;
          const dw = (plumeWidth * 0.32 * (4 - d)) / 3;
          const dh = 0.35 * throttle;
          ctx.beginPath();
          ctx.moveTo(0, dy - dh);
          ctx.lineTo(dw, dy);
          ctx.lineTo(0, dy + dh);
          ctx.lineTo(-dw, dy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    } else if (powerCycle === 'Gas Generator II') {
      // --- GAS GENERATOR II: Dual Turbopump Exhaust Ducts Flanking Both Sides of Flame ---
      const gg2Grad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      gg2Grad.addColorStop(0, '#ffffff');
      gg2Grad.addColorStop(0.12, '#fef08a');
      gg2Grad.addColorStop(0.4, '#ea580c');
      gg2Grad.addColorStop(0.8, '#dc2626');
      gg2Grad.addColorStop(1, 'rgba(220, 38, 38, 0)');

      ctx.fillStyle = gg2Grad;
      ctx.beginPath();
      ctx.moveTo(-plumeWidth, -hh);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.5, 0, -hh - plumeLen);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.5, plumeWidth, -hh);
      ctx.closePath();
      ctx.fill();

      // Dual flanking dark turbopump soot streams with dynamic undulating flare
      const sootPulse = Math.sin(now * 15) * 0.08;
      ctx.fillStyle = 'rgba(51, 65, 85, 0.68)';
      // Left stream
      ctx.beginPath();
      ctx.moveTo(-plumeWidth * 0.8, -hh);
      ctx.lineTo(-plumeWidth * (0.7 + sootPulse), -hh - plumeLen * 0.6);
      ctx.lineTo(-plumeWidth * 0.55, -hh - plumeLen * 0.55);
      ctx.lineTo(-plumeWidth * 0.65, -hh);
      ctx.closePath();
      ctx.fill();
      // Right stream
      ctx.beginPath();
      ctx.moveTo(plumeWidth * 0.8, -hh);
      ctx.lineTo(plumeWidth * (0.7 + sootPulse), -hh - plumeLen * 0.6);
      ctx.lineTo(plumeWidth * 0.55, -hh - plumeLen * 0.55);
      ctx.lineTo(plumeWidth * 0.65, -hh);
      ctx.closePath();
      ctx.fill();
    } else if (powerCycle === 'Expander' || isHydrolox) {
      // --- EXPANDER CYCLE: Ethereal Ghostly Vacuum Hydrolox/Methalox Plume with Travelling Sonic Waves ---
      const expGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      expGrad.addColorStop(0, '#ffffff');
      expGrad.addColorStop(0.2, '#67e8f9');
      expGrad.addColorStop(0.55, '#3b82f6');
      expGrad.addColorStop(0.85, '#a855f7');
      expGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');

      const expW = plumeWidth * (1.1 + Math.sin(now * 8) * 0.05);
      ctx.fillStyle = expGrad;
      ctx.beginPath();
      ctx.moveTo(-expW, -hh);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.65, 0, -hh - plumeLen);
      ctx.quadraticCurveTo(0, -hh - plumeLen * 0.65, expW, -hh);
      ctx.closePath();
      ctx.fill();

      // Brilliant turquoise core spear
      const inGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen * 0.55);
      inGrad.addColorStop(0, '#ffffff');
      inGrad.addColorStop(0.5, '#bae6fd');
      inGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
      ctx.fillStyle = inGrad;
      ctx.beginPath();
      ctx.moveTo(-expW * 0.4, -hh);
      ctx.lineTo(0, -hh - plumeLen * 0.55);
      ctx.lineTo(expW * 0.4, -hh);
      ctx.closePath();
      ctx.fill();

      // Translucent expanding rarefaction wave rings
      ctx.strokeStyle = 'rgba(165, 243, 252, 0.4)';
      ctx.lineWidth = 0.06;
      for (let w = 1; w <= 3; w++) {
        const waveP = ((now * 1.2 + w * 0.33) % 1);
        const wy = -hh - plumeLen * 0.7 * waveP;
        const ww = expW * (0.3 + waveP * 0.6);
        ctx.beginPath();
        ctx.ellipse(0, wy, ww, 0.16, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (powerCycle === 'Pressure-Fed' || isMonoprop || isHypergolic) {
      // --- PRESSURE-FED: Soft Parabolic Bulbous Flame with Warm Reddish Thermal Envelope, Gentle Low-Frequency Throb ---
      const throb = 1.0 + Math.sin(now * 16) * 0.05;
      const pfGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen * 0.85 * throb);
      pfGrad.addColorStop(0, '#ffffff');
      pfGrad.addColorStop(0.2, isHypergolic ? '#f87171' : '#fb923c');
      pfGrad.addColorStop(0.6, isHypergolic ? '#ef4444' : '#ea580c');
      pfGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

      ctx.fillStyle = pfGrad;
      ctx.beginPath();
      // Rounded bulbous shape (low expansion velocity)
      ctx.ellipse(0, -hh - (plumeLen * 0.45 * throb), plumeWidth * 0.8 * throb, plumeLen * 0.45 * throb, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // --- BOOSTER / SRB: Fiery Jagged Orange-White Plume with Molten Sparks & Smoke ---
      const srbGrad = ctx.createLinearGradient(0, -hh, 0, -hh - plumeLen);
      srbGrad.addColorStop(0, '#ffffff');
      srbGrad.addColorStop(0.18, '#fef08a');
      srbGrad.addColorStop(0.5, '#f97316');
      srbGrad.addColorStop(0.8, '#dc2626');
      srbGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');

      const sawJitter = Math.sin(now * 65) * 0.08;
      ctx.fillStyle = srbGrad;
      ctx.beginPath();
      ctx.moveTo(-plumeWidth, -hh);
      ctx.lineTo(-plumeWidth * (0.8 + sawJitter), -hh - plumeLen * 0.4);
      ctx.lineTo(0, -hh - plumeLen * (1 + sawJitter * 0.5));
      ctx.lineTo(plumeWidth * (0.8 - sawJitter), -hh - plumeLen * 0.4);
      ctx.lineTo(plumeWidth, -hh);
      ctx.closePath();
      ctx.fill();

      // White incandescent combustion core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-plumeWidth * 0.45, -hh);
      ctx.lineTo(0, -hh - plumeLen * 0.5);
      ctx.lineTo(plumeWidth * 0.45, -hh);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawMapIcon(ctx: CanvasRenderingContext2D, vessel: VesselState) {
    ctx.save();
    ctx.translate(vessel.x, vessel.y);

    const iconRadius = 14 / this.zoom; // Exactly 14 screen pixels regardless of zoom

    // Pulsing radar beacon circle
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.5 / this.zoom;
    ctx.beginPath();
    ctx.arc(0, 0, iconRadius * 1.6, 0, Math.PI * 2);
    ctx.stroke();

    // Prograde Velocity Vector Ray
    const speed = Math.hypot(vessel.vx, vessel.vy);
    if (speed > 5) {
      const vLen = Math.min(70 / this.zoom, (speed * 0.06) / this.zoom);
      const vAngle = Math.atan2(vessel.vy, vessel.vx);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2 / this.zoom;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(vAngle) * vLen, Math.sin(vAngle) * vLen);
      ctx.stroke();
    }

    // Spacecraft Chevron Glyph rotated by vessel orientation angle
    ctx.save();
    ctx.rotate(vessel.angle);

    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8 / this.zoom;

    ctx.beginPath();
    ctx.moveTo(0, iconRadius * 1.2); // Nose pointing forward
    ctx.lineTo(iconRadius * 0.75, -iconRadius * 0.8); // Right wing tip
    ctx.lineTo(0, -iconRadius * 0.35); // Center engine notch
    ctx.lineTo(-iconRadius * 0.75, -iconRadius * 0.8); // Left wing tip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing engine ignition dot
    if (vessel.throttle > 0.05) {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(0, -iconRadius * 0.4, 3 / this.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Telemetry Callout Badge in Map Mode
    ctx.save();
    ctx.scale(1 / this.zoom, -1 / this.zoom);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.2;

    const altStr = vessel.altitude >= 1000 ? `${(vessel.altitude / 1000).toFixed(1)} km` : `${vessel.altitude.toFixed(0)} m`;
    const spdStr = `${speed.toFixed(0)} m/s`;
    const label = `ROCKET | ${altStr} | ${spdStr}`;
    ctx.font = 'bold 10px monospace';
    const lw = ctx.measureText(label).width;

    ctx.beginPath();
    ctx.roundRect(16, -10, lw + 10, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e0f2fe';
    ctx.textAlign = 'left';
    ctx.fillText(label, 21, 3);
    ctx.restore();

    ctx.restore();
  }

  private drawMapScreenHUD(ctx: CanvasRenderingContext2D, width: number, height: number, vessel: VesselState) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 1. Dynamic Metric Scale Ruler (Bottom Left, offset above bottom bar)
    const targetPx = 120;
    const rawDist = targetPx / this.zoom; // in meters
    // Round to 1, 2, or 5 * 10^n
    const power = Math.pow(10, Math.floor(Math.log10(rawDist)));
    const fraction = rawDist / power;
    let roundFactor = 1;
    if (fraction >= 5) roundFactor = 5;
    else if (fraction >= 2) roundFactor = 2;
    const rulerWorldDist = Math.max(1, roundFactor * power);
    const rulerPx = Math.max(20, rulerWorldDist * this.zoom);

    const rulerX = 24;
    const rulerY = height - 42;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(rulerX - 8, rulerY - 24, rulerPx + 16, 32, 6);
    ctx.fill();
    ctx.stroke();

    // Ruler line with end ticks
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(rulerX, rulerY - 6);
    ctx.lineTo(rulerX, rulerY);
    ctx.lineTo(rulerX + rulerPx, rulerY);
    ctx.lineTo(rulerX + rulerPx, rulerY - 6);
    ctx.stroke();

    const distLabel = rulerWorldDist >= 1000000 
      ? `${(rulerWorldDist / 1000000).toLocaleString()} Mm`
      : rulerWorldDist >= 1000 
      ? `${(rulerWorldDist / 1000).toLocaleString()} km` 
      : `${rulerWorldDist.toFixed(0)} m`;

    ctx.fillStyle = '#f0f9ff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(distLabel, rulerX + rulerPx / 2, rulerY - 9);

    // 2. Navigation Compass & Inertial Frame Badge (Top Left under top HUD)
    const compassX = 36;
    const compassY = 86;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(compassX, compassY, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // North Needle
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(compassX, compassY - 14);
    ctx.lineTo(compassX - 4, compassY);
    ctx.lineTo(compassX + 4, compassY);
    ctx.closePath();
    ctx.fill();

    // South Needle
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(compassX, compassY + 14);
    ctx.lineTo(compassX - 4, compassY);
    ctx.lineTo(compassX + 4, compassY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('N', compassX, compassY - 16);

    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('INERTIAL 2D', compassX + 26, compassY - 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.fillText(`CAM: ${this.focusTarget.toUpperCase()}`, compassX + 26, compassY + 10);

    ctx.restore();
  }

  public destroy() {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    if (this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
  }
}
