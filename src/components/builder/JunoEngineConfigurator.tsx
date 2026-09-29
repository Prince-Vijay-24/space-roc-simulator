import React, { useState, useRef, useEffect } from 'react';
import { 
  JunoEngineConfig, 
  PlacedPart, 
  EngineType, 
  EnginePowerCycle, 
  LiquidFuelType, 
  JunoNozzleStyle,
  SolidFuelGrain,
  NuclearFuelType
} from '../../types';
import { calculateJunoEnginePerformance, DEFAULT_JUNO_ENGINE_CONFIG } from '../../physics/rocketPropulsion';
import { drawPart2D, drawJunoEnginePlume2D } from '../../graphics/partRenderer2D';
import { PART_CATALOG } from '../../data/parts';
import { 
  Flame, Gauge, Sliders, Wind, Zap, Shield, ArrowUpDown, ArrowLeftRight, 
  RotateCw, AlertTriangle, CheckCircle, Activity, Sparkles, Compass,
  Volume2, VolumeX
} from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';

interface JunoEngineConfiguratorProps {
  part: PlacedPart;
  onUpdatePart: (updatedPart: Partial<PlacedPart>) => void;
}

export const JunoEngineConfigurator: React.FC<JunoEngineConfiguratorProps> = ({
  part,
  onUpdatePart,
}) => {
  const config: JunoEngineConfig = part.engineConfig || { ...DEFAULT_JUNO_ENGINE_CONFIG };
  const [activeTab, setActiveTab] = useState<'propellant' | 'chamber' | 'nozzle' | 'teststand'>('propellant');
  const [testAltitudeKm, setTestAltitudeKm] = useState<number>(0);
  const [testThrottle, setTestThrottle] = useState<number>(1.0);
  const [testGimbalAngle, setTestGimbalAngle] = useState<number>(0);
  const [isAutoGimbal, setIsAutoGimbal] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const ignitionStartTimeRef = useRef<number>(performance.now());

  // Dynamic particles for realistic test stand simulation: deluge steam, sparks, cryogenic boiloff vapor, cycle-specific effects
  const particlesRef = useRef<{
    steam: Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number; maxLife: number; life: number }>;
    sparks: Array<{ x: number; y: number; vx: number; vy: number; alpha: number; size: number }>;
    boiloff: Array<{ x: number; y: number; vx: number; vy: number; radius: number; alpha: number }>;
    cycleFx: Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number; maxLife: number; life: number }>;
  }>({
    steam: [],
    sparks: [],
    boiloff: [],
    cycleFx: [],
  });

  // Calculate real-time physical performance using the Juno: New Origins physics model
  const perf = calculateJunoEnginePerformance(config, testAltitudeKm);

  const updateConfig = (patch: Partial<JunoEngineConfig>) => {
    const newConfig = { ...config, ...patch };
    const partUpdates: Partial<PlacedPart> = { engineConfig: newConfig };

    if (patch.powerCycle) {
      ignitionStartTimeRef.current = performance.now();
    }

    const fuelType = (newConfig.engineType === 'Solid')
      ? 'solid'
      : (newConfig.engineType === 'Nuclear Thermal')
      ? 'nuclear'
      : (newConfig.engineType === 'Monopropellant')
      ? 'monoprop'
      : (newConfig.liquidFuel ? newConfig.liquidFuel.toLowerCase() as any : 'kerolox');
    partUpdates.propellantType = fuelType;

    // Solid Rocket Boosters carry internal propellant grain inside the motor casing
    if (newConfig.engineType === 'Solid') {
      const solidFuel = Math.round(((newConfig.engineSizePercent || 50) / 50) * 12.0 * 10) / 10;
      partUpdates.maxFuel = solidFuel;
      if (part.fuelRemaining === undefined || part.fuelRemaining === 0 || part.propellantType !== 'solid' || config.engineType !== 'Solid') {
        partUpdates.fuelRemaining = solidFuel;
      } else if (patch.engineSizePercent !== undefined) {
        const oldMax = part.maxFuel || solidFuel;
        const ratio = oldMax > 0 ? (part.fuelRemaining ?? oldMax) / oldMax : 1.0;
        partUpdates.fuelRemaining = Math.round(solidFuel * ratio * 10) / 10;
      }
    } else if (config.engineType === 'Solid') {
      // Switched away from Solid to Liquid or Nuclear (liquid engines draw from external propellant tanks)
      partUpdates.maxFuel = 0;
      partUpdates.fuelRemaining = 0;
    }

    if (newConfig.nozzleStyle) {
      partUpdates.customNozzleType = newConfig.nozzleStyle.toLowerCase() as any;
    }

    onUpdatePart(partUpdates);
  };

  const handleTriggerIgnition = (targetThrottle: number = 1.0) => {
    ignitionStartTimeRef.current = performance.now();
    setTestThrottle(targetThrottle);
    if (activeTab !== 'teststand') {
      setActiveTab('teststand');
    }
  };

  // Sound Engine synchronization with test stand firing state
  useEffect(() => {
    if (activeTab === 'teststand' && !isSoundMuted && testThrottle > 0.01) {
      soundEngine.init();
      soundEngine.setMuted(false);
      soundEngine.updateTelemetry(testThrottle, true, 0, 0);
    } else {
      soundEngine.updateTelemetry(0, false, 0, 0);
    }

    return () => {
      soundEngine.updateTelemetry(0, false, 0, 0);
    };
  }, [activeTab, isSoundMuted, testThrottle]);

  // High-Fidelity 60 FPS Aerospace Static Test Stand Simulation Canvas Loop
  useEffect(() => {
    if (activeTab !== 'teststand') {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let startTime = performance.now();
    let prevTime = startTime;

    const renderLoop = (currentTime: number) => {
      const dt = Math.min(0.05, (currentTime - prevTime) / 1000);
      prevTime = currentTime;
      const timeSec = (currentTime - startTime) / 1000;

      // Handle auto-gimbal sweep if enabled
      const maxGimbal = config.gimbalRangeDeg || 5.0;
      let effectiveGimbal = testGimbalAngle;
      if (isAutoGimbal && maxGimbal > 0) {
        effectiveGimbal = Math.sin(timeSec * 2.2) * maxGimbal;
      }
      const gimbalRad = (effectiveGimbal * Math.PI) / 180;

      // Resize canvas with devicePixelRatio for razor-sharp crisp graphics
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      const cssWidth = Math.max(260, rect.width);
      const cssHeight = 240;

      if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      // Gas dynamics & expansion calculations
      const pAtm = 101.325 * Math.exp(-Math.min(80, Math.max(0, testAltitudeKm)) / 7.2);
      const pe = perf.exitPressureKPa;
      const pr = pe / Math.max(0.001, pAtm);
      const isAerospike = config.nozzleStyle === 'Aerospike';
      const isSeparated = !isAerospike && pr < 0.35;
      const isOverexpanded = !isAerospike && pr < 0.9;
      const isUnderexpanded = pr > 1.25 || testAltitudeKm > 20;

      // Dynamic test stand vibration jitter scaling with thrust force
      let shakeX = 0;
      let shakeY = 0;
      if (testThrottle > 0.01) {
        const shakeMagnitude = Math.min(2.5, (perf.thrustVac / 1000) * testThrottle * (isSeparated ? 2.2 : 0.9));
        shakeX = (Math.sin(timeSec * 75) + Math.cos(timeSec * 130)) * 0.5 * shakeMagnitude;
        shakeY = (Math.cos(timeSec * 85) + Math.sin(timeSec * 115)) * 0.5 * shakeMagnitude;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // 1. Deep Space Technical Grid Backdrop
      const bgGrad = ctx.createLinearGradient(0, 0, 0, cssHeight);
      bgGrad.addColorStop(0, '#060913');
      bgGrad.addColorStop(0.65, '#090f1e');
      bgGrad.addColorStop(1, '#0c1428');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-5, -5, cssWidth + 10, cssHeight + 10);

      // Engineering grid lines with coordinate calibration ticks
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 1;
      for (let y = 20; y < cssHeight; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cssWidth, y);
        ctx.stroke();
      }
      for (let x = 20; x < cssWidth; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cssHeight);
        ctx.stroke();
      }

      const midX = cssWidth / 2;
      const standGantryY = 32;
      const enginePivotY = standGantryY + 16;
      const engineWidthPx = 68 * (config.engineSizePercent / 50);
      const engineHeightPx = 58 * (config.engineSizePercent / 50) * (0.4 + 0.6 * (config.nozzleLengthPercent / 100));
      const deflectorY = cssHeight - 24;

      // 2. Structural Test Stand Facility (Vertical Heavy Steel Columns & Lattice Truss)
      const colLeftX = midX - Math.max(90, engineWidthPx * 1.5);
      const colRightX = midX + Math.max(90, engineWidthPx * 1.5);
      const colW = 14;

      // Draw Left Column with hazard caution stripes
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(colLeftX - colW / 2, 10, colW, cssHeight - 34);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(colLeftX - colW / 2, 10, colW, cssHeight - 34);

      // Draw Right Column
      ctx.fillRect(colRightX - colW / 2, 10, colW, cssHeight - 34);
      ctx.strokeRect(colRightX - colW / 2, 10, colW, cssHeight - 34);

      // Yellow/Black diagonal hazard warning chevrons on column tops
      for (let cy = 12; cy < 60; cy += 10) {
        ctx.fillStyle = '#eab308';
        ctx.fillRect(colLeftX - colW / 2 + 1, cy, colW - 2, 5);
        ctx.fillRect(colRightX - colW / 2 + 1, cy, colW - 2, 5);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(colLeftX - colW / 2 + 1, cy + 5, colW - 2, 5);
        ctx.fillRect(colRightX - colW / 2 + 1, cy + 5, colW - 2, 5);
      }

      // Diagonal cross-truss structural steel members
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1.5;
      const numTruss = 3;
      const trussSpanH = (deflectorY - standGantryY) / numTruss;
      for (let t = 0; t < numTruss; t++) {
        const ty1 = standGantryY + t * trussSpanH;
        const ty2 = ty1 + trussSpanH;
        // Left side truss
        ctx.beginPath();
        ctx.moveTo(colLeftX, ty1);
        ctx.lineTo(colLeftX + 35, ty2);
        ctx.stroke();
        // Right side truss
        ctx.beginPath();
        ctx.moveTo(colRightX, ty1);
        ctx.lineTo(colRightX - 35, ty2);
        ctx.stroke();
      }

      // Overhead Heavy Gantry Crossbeam
      const gantryGrad = ctx.createLinearGradient(0, standGantryY - 12, 0, standGantryY + 10);
      gantryGrad.addColorStop(0, '#475569');
      gantryGrad.addColorStop(0.5, '#64748b');
      gantryGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = gantryGrad;
      ctx.fillRect(colLeftX, standGantryY - 10, colRightX - colLeftX, 14);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(colLeftX, standGantryY - 10, colRightX - colLeftX, 14);

      // 3-Axis Load Cell Dynamometer Thrust Sensor Puck
      const loadPuckW = 32;
      const loadPuckH = 8;
      const loadPuckX = midX - loadPuckW / 2;
      const loadPuckY = standGantryY + 4;
      const isStrainHot = isSeparated && testThrottle > 0.3;
      ctx.fillStyle = isStrainHot ? '#ef4444' : testThrottle > 0.05 ? '#10b981' : '#0284c7';
      ctx.fillRect(loadPuckX, loadPuckY, loadPuckW, loadPuckH);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1;
      ctx.strokeRect(loadPuckX, loadPuckY, loadPuckW, loadPuckH);

      // Strain gauge telemetry status LEDs
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(loadPuckX + 4, loadPuckY + 2.5, 3, 3);
      ctx.fillRect(loadPuckX + 14, loadPuckY + 2.5, 3, 3);
      ctx.fillRect(loadPuckX + 24, loadPuckY + 2.5, 3, 3);

      // Cryogenic Propellant Feed Umbilicals (Insulated LOX & Fuel Ducts)
      // Left: Cold LOX Line with frosty condensation & boiloff vapor
      ctx.strokeStyle = '#93c5fd';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(colLeftX + colW / 2, standGantryY - 4);
      ctx.lineTo(midX - 16, standGantryY - 4);
      ctx.lineTo(midX - 12, enginePivotY + 4);
      ctx.stroke();
      // White frosty insulation jacket
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Right: High-Pressure Fuel Feed Line
      ctx.strokeStyle = '#fb923c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(colRightX - colW / 2, standGantryY - 4);
      ctx.lineTo(midX + 16, standGantryY - 4);
      ctx.lineTo(midX + 12, enginePivotY + 4);
      ctx.stroke();

      // Cryogenic boil-off vapor venting particles from LOX disconnect valve
      if (Math.random() < 0.35) {
        particlesRef.current.boiloff.push({
          x: midX - 16 + (Math.random() * 4 - 2),
          y: standGantryY - 4,
          vx: -0.8 - Math.random() * 0.8,
          vy: -0.4 - Math.random() * 0.5,
          radius: 2 + Math.random() * 2.5,
          alpha: 0.65,
        });
      }

      // Render boiloff particles
      for (let i = particlesRef.current.boiloff.length - 1; i >= 0; i--) {
        const p = particlesRef.current.boiloff[i];
        p.x += p.vx;
        p.y += p.vy;
        p.radius += 0.12;
        p.alpha -= 0.02;
        if (p.alpha <= 0) {
          particlesRef.current.boiloff.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(224, 242, 254, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // TVC Hydraulic Gimbal Actuators (Pistons extend and compress with gimbal angle!)
      const actuatorPistonLeftLen = 22 + Math.sin(gimbalRad) * 12;
      const actuatorPistonRightLen = 22 - Math.sin(gimbalRad) * 12;

      // Left TVC Actuator cylinder & piston
      ctx.fillStyle = '#475569';
      ctx.fillRect(midX - engineWidthPx * 0.5 - 12, enginePivotY - 4, 16, 4);
      // Chrome hydraulic rod
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(midX - engineWidthPx * 0.5 + 4, enginePivotY - 3, actuatorPistonLeftLen * 0.45, 2);

      // Right TVC Actuator cylinder & piston
      ctx.fillStyle = '#475569';
      ctx.fillRect(midX + engineWidthPx * 0.5 - 4, enginePivotY - 4, 16, 4);
      // Chrome hydraulic rod
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(midX + engineWidthPx * 0.5 - actuatorPistonRightLen * 0.45, enginePivotY - 3, actuatorPistonRightLen * 0.45, 2);

      // 3. Lower Refractory Flame Deflector Bucket & Blast Trench
      const trenchW = Math.max(140, engineWidthPx * 2.4);
      const trenchLeftX = midX - trenchW * 0.45;
      const trenchRightX = midX + trenchW * 0.65;

      // Blast wall refractory curved plate (deflects exhaust horizontally right)
      const bucketGrad = ctx.createLinearGradient(midX - 30, deflectorY - 20, trenchRightX, deflectorY + 15);
      bucketGrad.addColorStop(0, '#1e293b');
      bucketGrad.addColorStop(0.35, testThrottle > 0.5 ? '#991b1b' : '#334155');
      bucketGrad.addColorStop(0.7, testThrottle > 0.1 ? '#ea580c' : '#1e293b');
      bucketGrad.addColorStop(1, '#0f172a');

      ctx.fillStyle = bucketGrad;
      ctx.beginPath();
      ctx.moveTo(trenchLeftX, deflectorY - 16);
      ctx.quadraticCurveTo(midX - 10, deflectorY + 12, trenchRightX, deflectorY + 8);
      ctx.lineTo(trenchRightX, cssHeight);
      ctx.lineTo(trenchLeftX - 20, cssHeight);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // High-pressure water deluge sound suppression injection nozzles
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(midX - 45, deflectorY - 14);
      ctx.lineTo(midX - 15, deflectorY + 2);
      ctx.moveTo(midX - 40, deflectorY - 6);
      ctx.lineTo(midX - 8, deflectorY + 5);
      ctx.stroke();

      // 4. Supersonic Rocket Plume Simulation
      const exitY = enginePivotY + engineHeightPx;
      const exitW = (engineWidthPx * 0.45) * Math.sqrt(perf.expansionRatio / 25);
      const currentTimeMs = performance.now();
      const ignitionAgeSec = (currentTimeMs - ignitionStartTimeRef.current) / 1000;
      const powerCycle = config.powerCycle || (config.engineType === 'Solid' ? 'Booster' : 'Gas Generator II');

      if (testThrottle > 0.01) {
        drawJunoEnginePlume2D(
          ctx,
          config,
          testThrottle,
          midX,
          exitY,
          Math.min(cssWidth * 0.45, exitW),
          testAltitudeKm,
          gimbalRad,
          timeSec,
          perf.exitPressureKPa,
          ignitionAgeSec
        );

        // Power-Cycle-Specific Particle Simulation:
        if (powerCycle === 'Gas Generator I') {
          // A. Gas Generator I: Blinding Emerald TEA-TEB droplets on ignition
          if (ignitionAgeSec < 0.6) {
            for (let g = 0; g < 3; g++) {
              particlesRef.current.cycleFx.push({
                x: midX + (Math.random() - 0.5) * exitW * 1.6,
                y: exitY + Math.random() * 14,
                vx: (Math.random() - 0.5) * 6,
                vy: 1.5 + Math.random() * 4,
                color: Math.random() > 0.3 ? 'rgba(52, 211, 153,' : 'rgba(16, 185, 129,',
                size: 2.2 + Math.random() * 2,
                alpha: 0.95,
                maxLife: 24,
                life: 0,
              });
            }
          }
          // Steady-state: Dark turbopump soot puffs from side exhaust dump pipe
          const dumpX = midX - exitW * 0.68;
          particlesRef.current.cycleFx.push({
            x: dumpX + (Math.random() - 0.5) * 6,
            y: exitY + 8,
            vx: -0.8 - Math.random() * 1.5,
            vy: 2.0 + Math.random() * 3.5,
            color: 'rgba(30, 41, 59,', // Dark soot
            size: 3.5 + Math.random() * 3,
            alpha: 0.75,
            maxLife: 35,
            life: 0,
          });
        } else if (powerCycle === 'Electric') {
          // B. Electric: High-voltage electric arc crackle sparks
          if (Math.random() > 0.35) {
            particlesRef.current.cycleFx.push({
              x: midX + (Math.random() - 0.5) * exitW * 0.9,
              y: exitY - 4 + Math.random() * 10,
              vx: (Math.random() - 0.5) * 3,
              vy: 0.5 + Math.random() * 2.5,
              color: 'rgba(56, 189, 248,',
              size: 1.5 + Math.random() * 1.5,
              alpha: 0.92,
              maxLife: 16,
              life: 0,
            });
          }
        } else if (powerCycle === 'Full Flow Staged') {
          // C. FFSC: Supersonic diamond shock sparkle & dual-torch ignition streaks
          if (ignitionAgeSec < 0.6 || Math.random() > 0.4) {
            particlesRef.current.cycleFx.push({
              x: midX + (Math.random() - 0.5) * exitW * 0.75,
              y: exitY + Math.random() * 25,
              vx: (Math.random() - 0.5) * 2,
              vy: 3.0 + Math.random() * 4,
              color: Math.random() > 0.5 ? 'rgba(232, 121, 249,' : 'rgba(168, 85, 247,',
              size: 1.8 + Math.random() * 1.6,
              alpha: 0.95,
              maxLife: 20,
              life: 0,
            });
          }
        } else if (powerCycle === 'Amateur') {
          // D. Amateur: Erratic dark smoke puffs and sputtering sparks
          particlesRef.current.cycleFx.push({
            x: midX + (Math.random() - 0.5) * exitW * 0.8,
            y: exitY + 10,
            vx: (Math.random() - 0.5) * 4,
            vy: 1.5 + Math.random() * 3,
            color: Math.random() > 0.4 ? 'rgba(71, 85, 105,' : 'rgba(245, 158, 11,',
            size: 3.0 + Math.random() * 3,
            alpha: 0.8,
            maxLife: 30,
            life: 0,
          });
        }

        // Water Deluge Boiling Steam Cloud Generation (swirling white steam rolls out to right)
        const steamGenRate = Math.min(4, Math.floor(testThrottle * 4.5));
        for (let s = 0; s < steamGenRate; s++) {
          particlesRef.current.steam.push({
            x: midX + 8 + Math.random() * 25,
            y: deflectorY + 2 + (Math.random() * 8 - 4),
            vx: 1.5 + Math.random() * 3.2,
            vy: -0.6 - Math.random() * 1.8,
            radius: 5 + Math.random() * 6,
            alpha: 0.75 + Math.random() * 0.2,
            maxLife: 45 + Math.random() * 25,
            life: 0,
          });
        }

        // Impingement sparks rebounding off the curved blast deflector
        const sparkCount = config.engineType === 'Solid' ? 6 : 2;
        for (let sp = 0; sp < sparkCount; sp++) {
          particlesRef.current.sparks.push({
            x: midX + (Math.random() * 20 - 5),
            y: deflectorY + 2,
            vx: 2.0 + Math.random() * 5.0,
            vy: -1.0 - Math.random() * 4.0,
            alpha: 1.0,
            size: 1.2 + Math.random() * 1.8,
          });
        }
      }

      // Render Rebounding Sparks
      for (let i = particlesRef.current.sparks.length - 1; i >= 0; i--) {
        const sp = particlesRef.current.sparks[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.15; // Gravity pull down into trench
        sp.alpha -= 0.035;
        if (sp.alpha <= 0 || sp.x > cssWidth) {
          particlesRef.current.sparks.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(254, 240, 138, ${sp.alpha})`;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Power-Cycle Specific Effect Particles
      for (let i = particlesRef.current.cycleFx.length - 1; i >= 0; i--) {
        const p = particlesRef.current.cycleFx[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha = Math.max(0, p.alpha - 0.035);
        if (p.life >= p.maxLife || p.alpha <= 0) {
          particlesRef.current.cycleFx.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `${p.color} ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Volumetric Water Deluge Steam Clouds
      for (let i = particlesRef.current.steam.length - 1; i >= 0; i--) {
        const st = particlesRef.current.steam[i];
        st.life++;
        st.x += st.vx;
        st.y += st.vy;
        st.radius += 0.35;
        st.alpha = Math.max(0, 0.7 * (1 - st.life / st.maxLife));
        if (st.life >= st.maxLife || st.x > cssWidth + 20) {
          particlesRef.current.steam.splice(i, 1);
          continue;
        }
        const steamGrad = ctx.createRadialGradient(st.x, st.y, st.radius * 0.2, st.x, st.y, st.radius);
        steamGrad.addColorStop(0, `rgba(255, 255, 255, ${st.alpha * 0.9})`);
        steamGrad.addColorStop(0.6, `rgba(226, 232, 240, ${st.alpha * 0.45})`);
        steamGrad.addColorStop(1, 'rgba(203, 213, 225, 0)');
        ctx.fillStyle = steamGrad;
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Procedural 2D Rocket Engine (Swivels on TVC Spherical Gimbal Pivot!)
      ctx.save();
      ctx.translate(midX, enginePivotY + engineHeightPx * 0.45);
      if (gimbalRad !== 0 && config.engineType !== 'Solid') {
        ctx.rotate(gimbalRad);
      }
      const engineDef = PART_CATALOG['modular_rocket_engine'] || Object.values(PART_CATALOG).find((p) => p.category === 'Propulsion');
      if (engineDef) {
        drawPart2D(ctx, engineDef, {
          widthPx: engineWidthPx,
          heightPx: engineHeightPx,
          isSelected: true,
          throttle: testThrottle,
          engineActive: testThrottle > 0.01,
          engineConfig: config,
        });
      }
      ctx.restore();

      // Thrust Vector Line Indicator (vectors along TVC axis)
      if (testThrottle > 0.05 && maxGimbal > 0) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(midX, exitY);
        ctx.lineTo(midX - Math.sin(gimbalRad) * 45, exitY + Math.cos(gimbalRad) * 45);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore(); // Restore vibration transform

      // 6. Real-Time Aerospace Avionics Telemetry Overlay on Canvas
      // Top Status Bar: Facility Status & Throttle
      const isFiring = testThrottle > 0.01;
      const isIgniting = isFiring && ignitionAgeSec < 0.8;
      const statusText = isSeparated
        ? 'WARNING: FLOW SEPARATION / SIDE LOADS'
        : isIgniting
        ? `IGNITION TRANSIENT: ${powerCycle.toUpperCase()}`
        : isFiring
        ? `HOT FIRE TEST: ${powerCycle.toUpperCase()} (STEADY)`
        : 'TEST STAND: COLD STANDBY';

      // Draw Top Status Strip
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(8, 8, cssWidth - 16, 20);
      ctx.strokeStyle = isSeparated ? 'rgba(239, 68, 68, 0.6)' : isIgniting ? 'rgba(234, 179, 8, 0.7)' : 'rgba(51, 65, 85, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, cssWidth - 16, 20);

      // Status indicator LED (blinking if firing/separated)
      const ledColor = isSeparated ? '#ef4444' : isIgniting ? '#eab308' : isFiring ? '#10b981' : '#38bdf8';
      ctx.fillStyle = ledColor;
      ctx.beginPath();
      ctx.arc(18, 18, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isSeparated ? '#fca5a5' : isFiring ? '#6ee7b7' : '#bae6fd';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(statusText, 26, 21);

      // Thrust readout on top right
      const currentThrustKN = Math.round(perf.thrustAtAltitude * testThrottle * 10) / 10;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`F: ${currentThrustKN.toFixed(1)} kN  (${(testThrottle * 100).toFixed(0)}%)`, cssWidth - 14, 21);

      // Left Vertical Altitude Barometer Scale
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(8, 32, 70, 48);
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.strokeRect(8, 32, 70, 48);

      ctx.textAlign = 'left';
      ctx.font = '8px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('BAROMETRIC', 12, 42);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`h: ${testAltitudeKm.toFixed(1)} km`, 12, 54);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '8px monospace';
      ctx.fillText(`P: ${pAtm.toFixed(1)} kPa`, 12, 66);
      ctx.fillStyle = testAltitudeKm > 50 ? '#c084fc' : '#64748b';
      ctx.fillText(testAltitudeKm > 50 ? 'VACUUM' : testAltitudeKm > 10 ? 'STRATO' : 'TROPO', 12, 76);

      // Bottom Avionics Telemetry Ribbon
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(8, cssHeight - 24, cssWidth - 16, 18);
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
      ctx.strokeRect(8, cssHeight - 24, cssWidth - 18, 18);

      // Bottom readouts
      ctx.textAlign = 'left';
      ctx.font = '8px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Isp: ${perf.ispAtAltitude}s`, 14, cssHeight - 12);
      ctx.fillText(`Pe: ${perf.exitPressureKPa} kPa`, 64, cssHeight - 12);
      
      const prText = `Pe/Pa: ${pr.toFixed(2)}`;
      ctx.fillStyle = isSeparated ? '#f87171' : isOverexpanded ? '#fbbf24' : isUnderexpanded ? '#38bdf8' : '#34d399';
      ctx.fillText(prText, 140, cssHeight - 12);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`TVC: ${effectiveGimbal >= 0 ? '+' : ''}${effectiveGimbal.toFixed(1)}°`, cssWidth - 14, cssHeight - 12);

      ctx.restore();

      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [
    activeTab, 
    config, 
    testAltitudeKm, 
    testThrottle, 
    testGimbalAngle, 
    isAutoGimbal, 
    perf.thrustVac, 
    perf.thrustAtAltitude, 
    perf.ispAtAltitude, 
    perf.exitPressureKPa, 
    perf.expansionRatio
  ]);

  // Archetype Presets from Juno: New Origins
  const applyPreset = (presetName: string) => {
    switch (presetName) {
      case 'falcon':
        updateConfig({
          engineType: 'Liquid',
          powerCycle: 'Gas Generator I',
          liquidFuel: 'Kerolox',
          chamberPressureKPa: 11000,
          throatSizePercent: 100,
          nozzleStyle: 'Bell',
          nozzleLengthPercent: 100,
          gimbalRangeDeg: 5,
        });
        break;
      case 'raptor':
        updateConfig({
          engineType: 'Liquid',
          powerCycle: 'Full Flow Staged',
          liquidFuel: 'Methalox',
          chamberPressureKPa: 30000,
          throatSizePercent: 115,
          nozzleStyle: 'Bell',
          nozzleLengthPercent: 110,
          gimbalRangeDeg: 12,
        });
        break;
      case 'rl10':
        updateConfig({
          engineType: 'Liquid',
          powerCycle: 'Gas Generator I',
          liquidFuel: 'Hydrolox',
          chamberPressureKPa: 4500,
          throatSizePercent: 75,
          nozzleStyle: 'Delta',
          nozzleLengthPercent: 140,
          gimbalRangeDeg: 4,
        });
        break;
      case 'srb':
        updateConfig({
          engineType: 'Solid',
          powerCycle: 'Booster',
          solidGrain: 'Steady',
          chamberPressureKPa: 8000,
          throatSizePercent: 140,
          nozzleStyle: 'Cone',
          nozzleLengthPercent: 90,
          gimbalRangeDeg: 0,
        });
        break;
      case 'aerospike':
        updateConfig({
          engineType: 'Liquid',
          powerCycle: 'Staged',
          liquidFuel: 'Hydrolox',
          chamberPressureKPa: 14000,
          throatSizePercent: 95,
          nozzleStyle: 'Aerospike',
          nozzleLengthPercent: 75,
          gimbalRangeDeg: 3,
        });
        break;
      case 'nerva':
        updateConfig({
          engineType: 'Nuclear Thermal',
          nuclearFuel: 'Liquid Hydrogen',
          chamberPressureKPa: 5500,
          throatSizePercent: 105,
          nozzleStyle: 'Delta',
          nozzleLengthPercent: 130,
          gimbalRangeDeg: 3,
        });
        break;
    }
  };

  const chamberPressureBar = Math.round(config.chamberPressureKPa / 100);

  return (
    <div className="space-y-3 pt-2 border-t border-slate-800 font-sans text-xs">
      {/* Juno Header & Performance Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sky-400 font-bold">
          <Flame className="w-4 h-4 text-orange-400" />
          <span>Procedural Engine Tuning</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
          Juno Physics
        </span>
      </div>

      {/* Quick Benchmark Presets */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px] scrollbar-none">
        {[
          { id: 'falcon', label: 'Merlin 1D' },
          { id: 'raptor', label: 'Raptor FF' },
          { id: 'rl10', label: 'RL10 Cryo' },
          { id: 'aerospike', label: 'Aerospike' },
          { id: 'srb', label: 'Solid Booster' },
          { id: 'nerva', label: 'NERVA NTR' },
        ].map((p) => (
          <button
            key={p.id}
            onClick={() => applyPreset(p.id)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 whitespace-nowrap transition cursor-pointer"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Live Physical Performance Dashboard */}
      <div className="grid grid-cols-4 gap-1 p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10px]">
        <div>
          <span className="text-slate-500 block">Thrust (SL/Vac):</span>
          <span className="text-orange-400 font-bold">
            {perf.thrustSL} / {perf.thrustVac} <span className="text-[8px] text-slate-500">kN</span>
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Isp (SL/Vac):</span>
          <span className="text-sky-300 font-bold">
            {perf.ispSL} / {perf.ispVac} <span className="text-[8px] text-slate-500">s</span>
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Mass Flow (ṁ):</span>
          <span className="text-emerald-400 font-bold">
            {perf.fuelUsageKgS} <span className="text-[8px] text-slate-500">kg/s</span>
          </span>
        </div>
        <div>
          <span className="text-slate-500 block">Dry Mass:</span>
          <span className="text-amber-300 font-bold">
            {perf.dryMassTonnes} <span className="text-[8px] text-slate-500">t</span>
          </span>
        </div>
      </div>

      {/* Overexpansion / Flow Separation Warning */}
      {perf.isOverexpandedAtSL && (
        <div className="flex items-center gap-1.5 p-1.5 rounded bg-amber-950/40 border border-amber-500/40 text-[10px] text-amber-300 font-mono">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Overexpanded: Pe ({perf.exitPressureKPa} kPa) &lt; 35 kPa. Flow separation risk at sea level.</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px] font-mono">
        <button
          onClick={() => setActiveTab('propellant')}
          className={`flex-1 py-1 rounded transition cursor-pointer text-center ${
            activeTab === 'propellant' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Propellant
        </button>
        <button
          onClick={() => setActiveTab('chamber')}
          className={`flex-1 py-1 rounded transition cursor-pointer text-center ${
            activeTab === 'chamber' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Chamber
        </button>
        <button
          onClick={() => setActiveTab('nozzle')}
          className={`flex-1 py-1 rounded transition cursor-pointer text-center ${
            activeTab === 'nozzle' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Nozzle
        </button>
        <button
          onClick={() => setActiveTab('teststand')}
          className={`flex-1 py-1 rounded transition cursor-pointer text-center ${
            activeTab === 'teststand' ? 'bg-amber-600 text-white font-bold' : 'text-amber-400 hover:text-amber-200'
          }`}
        >
          Plume Sim
        </button>
      </div>

      {/* TAB 1: PROPELLANT & POWER CYCLE */}
      {activeTab === 'propellant' && (
        <div className="space-y-3">
          {/* Engine Type */}
          <div className="space-y-1.5">
            <span className="text-slate-400 font-medium block">Engine Type:</span>
            <div className="grid grid-cols-3 gap-1">
              {(['Liquid', 'Solid', 'Monopropellant', 'Nuclear Thermal'] as EngineType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => updateConfig({ engineType: t })}
                  className={`p-1.5 rounded text-left border transition cursor-pointer ${
                    config.engineType === t
                      ? 'bg-sky-950/80 border-sky-400 text-sky-200 font-bold'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-[11px] truncate">{t}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Liquid Propellant Chemistry */}
          {config.engineType === 'Liquid' && (
            <>
              <div className="space-y-1.5">
                <span className="text-slate-400 font-medium block">Propellant Chemistry:</span>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'Kerolox', label: 'Kerolox', desc: 'RP-1 + LOX (~1,020 kg/m³)', use: 'Booster 1st stage' },
                    { id: 'Methalox', label: 'Methalox', desc: 'LCH4 + LOX (~830 kg/m³)', use: 'Reusable 1st/2nd' },
                    { id: 'Hydrolox', label: 'Hydrolox', desc: 'LH2 + LOX (~360 kg/m³)', use: 'Upper / High Isp' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => updateConfig({ liquidFuel: f.id as LiquidFuelType })}
                      className={`p-1.5 rounded text-left border transition cursor-pointer ${
                        config.liquidFuel === f.id
                          ? 'bg-sky-950/80 border-sky-400 text-sky-200 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="text-[11px] truncate font-bold">{f.label}</div>
                      <div className="text-[9px] font-mono text-slate-500 truncate">{f.use}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Power Cycle */}
              <div className="space-y-1.5">
                <span className="text-slate-400 font-medium block">Power Cycle:</span>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'Pressure-Fed', label: 'Pressure-Fed', desc: 'Simple tank-driven' },
                    { id: 'Electric', label: 'Electric Pump', desc: 'Battery inverter' },
                    { id: 'Gas Generator I', label: 'Gas Gen I', desc: 'Open single-dump' },
                    { id: 'Gas Generator II', label: 'Gas Gen II', desc: 'Film curtain dump' },
                    { id: 'Staged', label: 'Staged Comb.', desc: 'High Pc closed' },
                    { id: 'Full Flow Staged', label: 'Full Flow', desc: 'Max Pc (Raptor)' },
                    { id: 'Expander', label: 'Expander', desc: 'Cryo bootstrap' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => updateConfig({ powerCycle: c.id as EnginePowerCycle })}
                      className={`p-1.5 rounded text-left border transition cursor-pointer ${
                        config.powerCycle === c.id
                          ? 'bg-sky-950/80 border-sky-400 text-sky-200 font-bold shadow-sm'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] font-bold truncate">{c.label}</div>
                      <div className="text-[8px] font-mono text-slate-500 truncate">{c.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Power-Cycle Flame & Ignition Signature Information Card */}
                <div className="mt-2 p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sky-400 font-bold flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-400" />
                      <span>{config.powerCycle || 'Gas Generator II'} Flame Architecture</span>
                    </span>
                    <button
                      onClick={() => handleTriggerIgnition(1.0)}
                      className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-[9px] cursor-pointer flex items-center gap-1 shadow transition-all active:scale-95"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Test Fire Ignition</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/80">
                      <span className="text-amber-300 font-bold block mb-0.5">Ignition Flame Transient:</span>
                      <p className="text-slate-400 leading-tight">
                        {config.powerCycle === 'Gas Generator I' && 'Emerald green pyrophoric TEA-TEB fireball flash with dense black turbopump puff.'}
                        {config.powerCycle === 'Gas Generator II' && 'Annular curtain bloom wrapping around the nozzle skirt rim.'}
                        {config.powerCycle === 'Electric' && 'High-voltage electric arc crackle with clean blue-white injector ionization.'}
                        {config.powerCycle === 'Full Flow Staged' && 'Dual-torch preburner supersonic detonation snap with instant 7-shock train.'}
                        {config.powerCycle === 'Staged' && 'Razor-sharp incandescent preburner torch needle extending into supersonic core.'}
                        {config.powerCycle === 'Expander' && 'Soft cryogenic bootstrap ramp ballooning smoothly without acoustic shocks.'}
                        {config.powerCycle === 'Pressure-Fed' && 'Soft low-pressure hypergolic puff expanding smoothly outward.'}
                        {!config.powerCycle && 'Dual-phase ignition transient.'}
                      </p>
                    </div>

                    <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/80">
                      <span className="text-cyan-300 font-bold block mb-0.5">Plume & Shock Geometry:</span>
                      <p className="text-slate-400 leading-tight">
                        {config.powerCycle === 'Gas Generator I' && 'Twin Plume: supersonic core + separate auxiliary dark turbopump soot stream.'}
                        {config.powerCycle === 'Gas Generator II' && 'Dual-Layer: supersonic core encased by smoky film-cooling boundary veil.'}
                        {config.powerCycle === 'Electric' && 'Collimated cylinder with 4 cyan Mach diamonds and electric corona.'}
                        {config.powerCycle === 'Full Flow Staged' && '7 crystalline supersonic Mach shock disks with harmonic acoustic flutter.'}
                        {config.powerCycle === 'Staged' && 'Rigid elongated supersonic spear with 5 bright diamond shock intersections.'}
                        {config.powerCycle === 'Expander' && 'Translucent ethereal bell with sliding concentric rarefaction wave rings.'}
                        {config.powerCycle === 'Pressure-Fed' && 'Parabolic rounded bulbous envelope with soft diffuse shock node.'}
                        {!config.powerCycle && 'Standard supersonic shock diamonds.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {config.engineType === 'Solid' && (
            <div className="space-y-2">
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-mono">
                <span className="text-amber-400 font-bold block mb-1">Solid Propellant Rocket Motor</span>
                High-density composite APCP provides massive liftoff thrust without complex turbopumps.
              </div>

              {/* Solid Motor Power Cycle */}
              <div className="space-y-1">
                <span className="text-slate-400 font-medium block text-[11px]">Motor Class & Cycle:</span>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { id: 'Booster', label: 'Aerospace Booster (APCP)', desc: 'Molten aluminum oxide sparks & white smoke' },
                    { id: 'Amateur', label: 'Amateur / Hobbyist', desc: 'Sputtering black powder & erratic flame' },
                  ].map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => updateConfig({ powerCycle: sc.id as EnginePowerCycle })}
                      className={`p-1.5 rounded text-left border text-[10px] cursor-pointer transition ${
                        (config.powerCycle || 'Booster') === sc.id
                          ? 'bg-amber-950/80 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="font-bold">{sc.label}</div>
                      <div className="text-[8px] font-mono text-slate-500">{sc.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-medium block">Grain Profile:</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['Steady', 'Ramp Down', 'Impulse', 'Basic', 'Ramp Up'] as SolidFuelGrain[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => updateConfig({ solidGrain: g })}
                      className={`p-1 rounded text-center border text-[10px] cursor-pointer ${
                        config.solidGrain === g
                          ? 'bg-amber-950/80 border-amber-400 text-amber-200 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {config.engineType === 'Nuclear Thermal' && (
            <div className="space-y-2">
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-mono">
                <span className="text-emerald-400 font-bold block mb-1">Nuclear Thermal Reactor Vessel</span>
                Superheats propellant via solid-core fission reactor. Extreme vacuum Isp with massive core shielding.
              </div>
              <div className="space-y-1">
                <span className="text-slate-400 font-medium block">Reaction Mass:</span>
                <div className="grid grid-cols-2 gap-1">
                  {(['Liquid Hydrogen', 'Water'] as NuclearFuelType[]).map((nf) => (
                    <button
                      key={nf}
                      onClick={() => updateConfig({ nuclearFuel: nf })}
                      className={`p-1.5 rounded text-center border text-[10px] cursor-pointer ${
                        config.nuclearFuel === nf
                          ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200 font-bold'
                          : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                      }`}
                    >
                      {nf}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CHAMBER & THROAT */}
      {activeTab === 'chamber' && (
        <div className="space-y-3">
          {/* Chamber Pressure Slider */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">Chamber Pressure (Pc):</span>
              <span className="font-bold text-sky-400">{chamberPressureBar} bar ({config.chamberPressureKPa} kPa)</span>
            </div>
            <input
              type="range"
              min="10"
              max="320"
              step="5"
              value={chamberPressureBar}
              onChange={(e) => updateConfig({ chamberPressureKPa: parseInt(e.target.value) * 100 })}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>10 bar (Low)</span>
              <span>150 bar (Avg)</span>
              <span>320 bar (Raptor)</span>
            </div>
          </div>

          {/* Throat Size Percentage Slider */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">Throat Size Scale:</span>
              <span className="font-bold text-sky-400">{config.throatSizePercent}% (r: {perf.throatRadiusM.toFixed(3)} m)</span>
            </div>
            <input
              type="range"
              min="50"
              max="150"
              step="2"
              value={config.throatSizePercent}
              onChange={(e) => updateConfig({ throatSizePercent: parseInt(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>50%</span>
              <span>Throat Area: {perf.throatAreaM2} m²</span>
              <span>150%</span>
            </div>
          </div>

          {/* Engine Scale Size Slider */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">Engine Size Scale:</span>
              <span className="font-bold text-sky-400">{config.engineSizePercent}%</span>
            </div>
            <input
              type="range"
              min="25"
              max="175"
              step="5"
              value={config.engineSizePercent}
              onChange={(e) => updateConfig({ engineSizePercent: parseInt(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>25% (Small)</span>
              <span>50% (Standard)</span>
              <span>175% (Massive)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NOZZLE & GIMBAL */}
      {activeTab === 'nozzle' && (
        <div className="space-y-3">
          {/* Nozzle Style */}
          <div className="space-y-1.5">
            <span className="text-slate-400 font-medium block">Nozzle Style:</span>
            <div className="grid grid-cols-4 gap-1">
              {(['Bell', 'Cone', 'Bravo', 'Delta', 'Omega', 'Aerospike', 'Dual Bell'] as JunoNozzleStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateConfig({ nozzleStyle: s })}
                  className={`p-1.5 rounded text-left border transition cursor-pointer ${
                    config.nozzleStyle === s
                      ? 'bg-sky-950/80 border-sky-400 text-sky-200 font-bold'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="text-[11px] font-bold">{s}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Nozzle Length Slider */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">Nozzle Length:</span>
              <span className="font-bold text-sky-400">{config.nozzleLengthPercent}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="200"
              step="5"
              value={config.nozzleLengthPercent}
              onChange={(e) => updateConfig({ nozzleLengthPercent: parseInt(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>20% (Compact)</span>
              <span>Expansion: {perf.expansionRatio}:1</span>
              <span>200% (High Expansion)</span>
            </div>
          </div>

          {/* TVC Gimbal Range */}
          <div className="space-y-1">
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">TVC Gimbal Range:</span>
              <span className="font-bold text-sky-400">±{config.gimbalRangeDeg}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="1"
              value={config.gimbalRangeDeg}
              onChange={(e) => updateConfig({ gimbalRangeDeg: parseInt(e.target.value) })}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>0° (Fixed)</span>
              <span>Exit Dia: {perf.exitDiameterM} m</span>
              <span>±15° (High Agility)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEST STAND & PLUME SIMULATION */}
      {activeTab === 'teststand' && (
        <div className="space-y-2.5">
          {/* Live Aerospace Test Stand Simulation Canvas */}
          <div 
            ref={containerRef}
            className="relative w-full rounded-xl overflow-hidden border border-slate-700/80 bg-[#050811] shadow-2xl flex flex-col items-center select-none"
          >
            <canvas
              ref={canvasRef}
              className="w-full h-[240px] block cursor-crosshair"
            />

            {/* Quick Canvas Sound Action Button */}
            <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10">
              <button
                onClick={() => setIsSoundMuted(!isSoundMuted)}
                title={isSoundMuted ? 'Unmute Rocket Audio' : 'Mute Rocket Audio'}
                className={`p-1 rounded-md border transition-all text-[10px] flex items-center gap-1 cursor-pointer ${
                  !isSoundMuted
                    ? 'bg-orange-600/90 border-orange-400 text-white shadow-lg'
                    : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {!isSoundMuted ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Altitude Expansion Control (Barometric Aerodynamics) */}
          <div className="space-y-1 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <div className="flex justify-between font-mono">
              <span className="text-slate-300 flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-sky-400" />
                <span>Simulated Altitude:</span>
              </span>
              <span className="font-bold text-sky-300">{testAltitudeKm.toFixed(1)} km</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="75.0"
              step="0.5"
              value={testAltitudeKm}
              onChange={(e) => setTestAltitudeKm(parseFloat(e.target.value))}
              className="w-full accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            {/* Quick Altitude Presets */}
            <div className="grid grid-cols-4 gap-1 font-mono text-[9px] pt-0.5">
              <button
                onClick={() => setTestAltitudeKm(0)}
                className={`py-0.5 px-1 rounded border transition-colors cursor-pointer ${
                  testAltitudeKm === 0 ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                0km (Sea Level)
              </button>
              <button
                onClick={() => setTestAltitudeKm(12)}
                className={`py-0.5 px-1 rounded border transition-colors cursor-pointer ${
                  testAltitudeKm === 12 ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                12km (Max-Q)
              </button>
              <button
                onClick={() => setTestAltitudeKm(35)}
                className={`py-0.5 px-1 rounded border transition-colors cursor-pointer ${
                  testAltitudeKm === 35 ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                35km (Staging)
              </button>
              <button
                onClick={() => setTestAltitudeKm(75)}
                className={`py-0.5 px-1 rounded border transition-colors cursor-pointer ${
                  testAltitudeKm === 75 ? 'bg-sky-500/20 border-sky-500 text-sky-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                75km (Vacuum)
              </button>
            </div>
          </div>

          {/* Test Stand Throttle Control */}
          <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-300 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span>Test Stand Throttle:</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleTriggerIgnition(1.0)}
                  className="px-2 py-0.5 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold text-[9px] cursor-pointer flex items-center gap-1 shadow transition-all active:scale-95"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>🔥 Re-Ignite</span>
                </button>
                <span className="font-bold text-orange-400">{(testThrottle * 100).toFixed(0)}%</span>
              </div>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.02"
              value={testThrottle}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (testThrottle <= 0.01 && val > 0.01) {
                  ignitionStartTimeRef.current = performance.now();
                }
                setTestThrottle(val);
              }}
              className="w-full accent-orange-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            {/* Quick Throttle Presets */}
            <div className="grid grid-cols-4 gap-1 font-mono text-[9px] pt-0.5">
              <button
                onClick={() => setTestThrottle(0)}
                className={`py-0.5 px-1 rounded border transition-colors cursor-pointer ${
                  testThrottle === 0 ? 'bg-red-500/20 border-red-500 text-red-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                0% (Cutoff)
              </button>
              <button
                onClick={() => {
                  if (testThrottle <= 0.01) ignitionStartTimeRef.current = performance.now();
                  setTestThrottle(0.35);
                }}
                className={`py-0.5 px-1 rounded border transition-colors cursor-pointer ${
                  testThrottle === 0.35 ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                35% (Idle)
              </button>
              <button
                onClick={() => {
                  if (testThrottle <= 0.01) ignitionStartTimeRef.current = performance.now();
                  setTestThrottle(0.70);
                }}
                className={`py-0.5 px-1 rounded border transition-colors cursor-pointer ${
                  testThrottle === 0.70 ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                70% (Nominal)
              </button>
              <button
                onClick={() => handleTriggerIgnition(1.0)}
                className={`py-0.5 px-1 rounded border transition-colors cursor-pointer ${
                  testThrottle === 1.0 ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                100% (Ignite Max)
              </button>
            </div>

            {/* Active Flame Architecture Telemetry Readout */}
            <div className="mt-2 p-2 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-mono space-y-1">
              <div className="flex justify-between text-slate-400">
                <span className="text-sky-300 font-bold">CYCLE: {config.powerCycle || (config.engineType === 'Solid' ? 'Booster' : 'Gas Gen II')}</span>
                <span className={testThrottle > 0.01 ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {testThrottle > 0.01 ? 'FIRING' : 'STANDBY'}
                </span>
              </div>
              <div className="text-slate-400 text-[9px] leading-tight">
                {config.powerCycle === 'Gas Generator I' && 'Twin Plume: Core Kerolox plume + separate dark turbopump soot dump. Ignition: TEA-TEB Emerald Green Flash.'}
                {config.powerCycle === 'Gas Generator II' && 'Concentric Veil: Core plume with cooler film-cooling shroud dumped at nozzle rim.'}
                {config.powerCycle === 'Electric' && 'Collimated Cylinder: Straight cylindrical beam with cyan glow & high-voltage capacitive ignition.'}
                {config.powerCycle === 'Full Flow Staged' && '7-Mach Shock Train: C2 Swan band radicals with dual preburner torch detonation snap.'}
                {config.powerCycle === 'Staged' && '5-Mach Shock Spear: Ultra-rigid closed-cycle supersonic flame with preburner needle.'}
                {config.powerCycle === 'Expander' && 'Translucent Bell: Ethereal clean cryogenic expansion with traveling rarefaction wave rings.'}
                {config.powerCycle === 'Pressure-Fed' && 'Parabolic Bulbous: Low chamber pressure gentle envelope with soft hypergolic puff.'}
                {config.powerCycle === 'Booster' && 'Serrated Fireball: Turbulent solid APCP flame with molten aluminum oxide spark shower.'}
                {config.powerCycle === 'Amateur' && 'Sputtering Flame: Erratic fluctuating flame with black powder smoke and crackling sparks.'}
                {!config.powerCycle && 'Standard supersonic rocket plume.'}
              </div>
            </div>
          </div>

          {/* TVC Gimbal Hydraulic Vectoring Test */}
          {config.gimbalRangeDeg > 0 && config.engineType !== 'Solid' && (
            <div className="space-y-1 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center font-mono">
                <span className="text-slate-300 flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>TVC Hydraulic Gimbal Test:</span>
                </span>
                <button
                  onClick={() => setIsAutoGimbal(!isAutoGimbal)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all cursor-pointer ${
                    isAutoGimbal
                      ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isAutoGimbal ? 'Sweep Active' : 'Auto Sweep TVC'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={-config.gimbalRangeDeg}
                  max={config.gimbalRangeDeg}
                  step="0.2"
                  disabled={isAutoGimbal}
                  value={testGimbalAngle}
                  onChange={(e) => setTestGimbalAngle(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
                />
                <button
                  onClick={() => {
                    setIsAutoGimbal(false);
                    setTestGimbalAngle(0);
                  }}
                  title="Center Gimbal"
                  className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded font-mono text-[9px] cursor-pointer"
                >
                  0°
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
