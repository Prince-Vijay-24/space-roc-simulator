import React, { useState, useEffect, useRef } from 'react';
import { Crosshair, RotateCcw, CheckCircle, ShieldAlert, Radio } from 'lucide-react';

interface DockingMiniGameProps {
  onClose: () => void;
  onSuccess?: (reward: number) => void;
}

export const DockingMiniGame: React.FC<DockingMiniGameProps> = ({ onClose, onSuccess }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Vessel State
  const [posX, setPosX] = useState<number>(-120); // Relative X meters
  const [posY, setPosY] = useState<number>(140);  // Relative Y meters
  const [vx, setVx] = useState<number>(1.8);       // m/s
  const [vy, setVy] = useState<number>(-1.2);      // m/s
  const [angle, setAngle] = useState<number>(0.35); // Radians
  const [angularVelocity, setAngularVelocity] = useState<number>(-0.08); // Rad/s
  const [rcsFuel, setRcsFuel] = useState<number>(100); // 0-100%
  const [dockState, setDockState] = useState<'APPROACHING' | 'DOCKED' | 'CRASHED'>('APPROACHING');
  const [score, setScore] = useState<number>(0);

  // Controls input ref
  const keysRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Simulation Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (dockState === 'APPROACHING') {
        const keys = keysRef.current;
        let mainFuelCost = 0;

        let ax = 0;
        let ay = 0;
        let alpha = 0;

        const thrust = 12.0; // Acceleration m/s^2
        const rotThrust = 1.5; // Rad/s^2

        if (rcsFuel > 0) {
          // Translation (WASD / Arrows)
          if (keys['KeyA'] || keys['ArrowLeft']) { ax -= thrust; mainFuelCost += dt * 4; }
          if (keys['KeyD'] || keys['ArrowRight']) { ax += thrust; mainFuelCost += dt * 4; }
          if (keys['KeyW'] || keys['ArrowUp']) { ay += thrust; mainFuelCost += dt * 4; }
          if (keys['KeyS'] || keys['ArrowDown']) { ay -= thrust; mainFuelCost += dt * 4; }

          // Rotation (Q/E)
          if (keys['KeyQ']) { alpha -= rotThrust; mainFuelCost += dt * 3; }
          if (keys['KeyE']) { alpha += rotThrust; mainFuelCost += dt * 3; }

          if (mainFuelCost > 0) {
            setRcsFuel((prev) => Math.max(0, prev - mainFuelCost));
          }
        }

        setPosX((px) => {
          const nextX = px + vx * dt + 0.5 * ax * dt * dt;
          return nextX;
        });

        setPosY((py) => {
          const nextY = py + vy * dt + 0.5 * ay * dt * dt;
          return nextY;
        });

        setVx((v) => v + ax * dt);
        setVy((v) => v + ay * dt);

        setAngle((a) => {
          let nextA = a + angularVelocity * dt + 0.5 * alpha * dt * dt;
          while (nextA > Math.PI) nextA -= Math.PI * 2;
          while (nextA < -Math.PI) nextA += Math.PI * 2;
          return nextA;
        });

        setAngularVelocity((av) => av + alpha * dt);

        // Check Docking Latch Condition
        setPosX((curX) => {
          setPosY((curY) => {
            const dist = Math.hypot(curX, curY);
            const speed = Math.hypot(vx, vy);
            const angErr = Math.abs(angle);

            if (dist < 8.0) {
              if (speed < 1.5 && angErr < 0.25) {
                setDockState('DOCKED');
                const earned = Math.round(1000 + rcsFuel * 15 - speed * 200);
                setScore(earned);
                if (onSuccess) onSuccess(earned);
              } else if (speed >= 3.0) {
                setDockState('CRASHED');
              }
            }
            return curY;
          });
          return curX;
        });
      }

      // Canvas Rendering
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
          const height = (canvas.height = canvas.parentElement?.clientHeight || 450);

          // Deep Space Void Background
          ctx.fillStyle = '#020617';
          ctx.fillRect(0, 0, width, height);

          // Grid Crosshair Lines
          const centerX = width / 2;
          const centerY = height / 2;
          const scale = 1.5; // Screen pixels per meter

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(centerX, 0);
          ctx.lineTo(centerX, height);
          ctx.moveTo(0, centerY);
          ctx.lineTo(0, centerY);
          ctx.stroke();

          // Concentric Distance Range Rings
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.setLineDash([6, 6]);
          [20, 50, 100, 150].forEach((r) => {
            ctx.beginPath();
            ctx.arc(centerX, centerY, r * scale, 0, Math.PI * 2);
            ctx.stroke();
          });
          ctx.setLineDash([]);

          // 1. DOCKING TARGET STATION PORT (At Center 0, 0)
          ctx.save();
          ctx.translate(centerX, centerY);

          // Station Hull
          ctx.fillStyle = '#334155';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-25, -25, 50, 50, 6);
          ctx.fill();
          ctx.stroke();

          // Target Docking Ring
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 18, 0, Math.PI * 2);
          ctx.stroke();

          // Green Target Alignment Crosshair
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-22, 0); ctx.lineTo(22, 0);
          ctx.moveTo(0, -22); ctx.lineTo(0, 22);
          ctx.stroke();

          ctx.restore();

          // 2. APPROACHING PLAYER SPACECRAFT
          const scX = centerX + posX * scale;
          const scY = centerY - posY * scale; // Invert Y

          ctx.save();
          ctx.translate(scX, scY);
          ctx.rotate(-angle);

          // Capsule Body
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, -16);
          ctx.lineTo(12, 12);
          ctx.lineTo(-12, 12);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Nose Docking Cone
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(0, -16, 4, 0, Math.PI * 2);
          ctx.fill();

          // Active RCS Bursts Visual
          const keys = keysRef.current;
          if (rcsFuel > 0) {
            ctx.fillStyle = '#38bdf8';
            if (keys['KeyA']) { ctx.fillRect(12, -2, 8, 4); }
            if (keys['KeyD']) { ctx.fillRect(-20, -2, 8, 4); }
            if (keys['KeyW']) { ctx.fillRect(-2, 12, 4, 8); }
            if (keys['KeyS']) { ctx.fillRect(-2, -22, 4, 8); }
          }

          ctx.restore();

          // 3. VELOCITY VECTOR ARROW
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(scX, scY);
          ctx.lineTo(scX + vx * 12, scY - vy * 12);
          ctx.stroke();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [posX, posY, vx, vy, angle, angularVelocity, rcsFuel, dockState, onSuccess]);

  const relDistance = Math.hypot(posX, posY);
  const relSpeed = Math.hypot(vx, vy);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-sky-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crosshair className="w-5 h-5 text-sky-400 animate-pulse" />
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Orbital Space Station Docking Simulator</h2>
              <p className="text-xs text-slate-400">Align RCS attitude, dampen relative velocity, and achieve hard-latch lock</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Main Game Layout */}
        <div className="grid grid-cols-1 md:grid-cols-4 h-[460px]">
          {/* Canvas Viewport */}
          <div className="md:col-span-3 bg-slate-950 relative border-r border-slate-800 flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {/* Overlays */}
            {dockState === 'DOCKED' && (
              <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-emerald-400 animate-bounce" />
                <h3 className="text-2xl font-black text-white">HARD-LATCH LOCK SUCCESSFUL!</h3>
                <p className="text-sm text-emerald-200">Space station pressurized docking complete. Earned {score} Credits!</p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg cursor-pointer"
                >
                  Return to Mission Control
                </button>
              </div>
            )}

            {dockState === 'CRASHED' && (
              <div className="absolute inset-0 bg-red-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
                <ShieldAlert className="w-16 h-16 text-red-400 animate-bounce" />
                <h3 className="text-2xl font-black text-white">COLLISION ALERT! HIGH IMPACT</h3>
                <p className="text-sm text-red-200">Docking velocity exceeded 1.5 m/s safety limit. Structural damage sustained.</p>
                <button
                  onClick={() => {
                    setPosX(-120);
                    setPosY(140);
                    setVx(1.8);
                    setVy(-1.2);
                    setAngle(0.35);
                    setAngularVelocity(-0.08);
                    setRcsFuel(100);
                    setDockState('APPROACHING');
                  }}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry Docking
                </button>
              </div>
            )}
          </div>

          {/* Telemetry Control Panel */}
          <div className="bg-slate-900 p-4 space-y-4 text-xs font-mono border-t md:border-t-0 border-slate-800 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="font-bold text-sky-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Radio className="w-4 h-4 text-sky-400" />
                <span>Telemetry Readout</span>
              </div>

              {/* Distance */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Distance:</span>
                <span className={`font-bold text-sm ${relDistance < 10 ? 'text-emerald-400' : 'text-sky-300'}`}>
                  {relDistance.toFixed(1)} m
                </span>
              </div>

              {/* Relative Speed */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Rel Speed:</span>
                <span className={`font-bold text-sm ${relSpeed > 1.5 ? 'text-red-400 font-bold' : 'text-emerald-400'}`}>
                  {relSpeed.toFixed(2)} m/s
                </span>
              </div>

              {/* Alignment Error */}
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Angle Error:</span>
                <span className="font-bold text-amber-300">
                  {((Math.abs(angle) * 180) / Math.PI).toFixed(1)}°
                </span>
              </div>

              {/* RCS Fuel */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span>RCS Propellant:</span>
                  <span className="font-bold text-sky-400">{rcsFuel.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-sky-500 transition-all duration-150"
                    style={{ width: `${rcsFuel}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Keyboard Controls Guide */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
              <div className="font-bold text-slate-200">Controls:</div>
              <div><span className="text-sky-300 font-bold">W / A / S / D</span>: Translation Thrusters</div>
              <div><span className="text-sky-300 font-bold">Q / E</span>: Yaw Rotation</div>
              <div className="text-emerald-400 text-[10px] pt-1">Safe Dock: Speed &lt; 1.5 m/s & Angle &lt; 14°</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
