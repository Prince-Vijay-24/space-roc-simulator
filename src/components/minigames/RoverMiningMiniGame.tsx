import React, { useState, useEffect, useRef } from 'react';
import { Pickaxe, CheckCircle, RotateCcw, Battery, Compass, Award } from 'lucide-react';

interface RoverMiningMiniGameProps {
  onClose: () => void;
  onSuccess?: (reward: number) => void;
}

export const RoverMiningMiniGame: React.FC<RoverMiningMiniGameProps> = ({ onClose, onSuccess }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [roverX, setRoverX] = useState<number>(50); // meters along terrain
  const [roverSpeed, setRoverSpeed] = useState<number>(0);
  const [battery, setBattery] = useState<number>(100);
  const [cargoOre, setCargoOre] = useState<number>(0);
  const [drillingActive, setDrillingActive] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const keysRef = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!isCompleted) {
        const keys = keysRef.current;

        // Drive controls
        if (battery > 0) {
          if (keys['KeyA'] || keys['ArrowLeft']) {
            setRoverSpeed((s) => Math.max(-12, s - dt * 15));
            setBattery((b) => Math.max(0, b - dt * 1.5));
          } else if (keys['KeyD'] || keys['ArrowRight']) {
            setRoverSpeed((s) => Math.min(12, s + dt * 15));
            setBattery((b) => Math.max(0, b - dt * 1.5));
          } else {
            setRoverSpeed((s) => s * 0.92);
          }

          // Drilling control
          if (keys['Space']) {
            setDrillingActive(true);
            setBattery((b) => Math.max(0, b - dt * 3.5));
            setCargoOre((o) => Math.min(250, o + dt * 18));
          } else {
            setDrillingActive(false);
          }
        } else {
          setRoverSpeed((s) => s * 0.92);
          setDrillingActive(false);
        }

        setRoverX((x) => Math.max(10, Math.min(950, x + roverSpeed * dt)));

        if (cargoOre >= 250) {
          setIsCompleted(true);
          const earned = Math.round(1500 + cargoOre * 4 + battery * 10);
          if (onSuccess) onSuccess(earned);
        }
      }

      // Render
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
          const height = (canvas.height = canvas.parentElement?.clientHeight || 450);

          // Deep Space Sky & Earthrise
          ctx.fillStyle = '#020617';
          ctx.fillRect(0, 0, width, height);

          // Earth in lunar sky
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(width * 0.8, height * 0.25, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(width * 0.82, height * 0.23, 10, 0, Math.PI * 2);
          ctx.fill();

          // Lunar Surface Terrain Profile
          const groundY = height * 0.72;
          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.moveTo(0, height);
          ctx.lineTo(0, groundY);

          for (let x = 0; x <= width; x += 10) {
            const worldX = roverX + (x - width / 2);
            const hillY = groundY + Math.sin(worldX * 0.02) * 18 + Math.cos(worldX * 0.05) * 8;
            ctx.lineTo(x, hillY);
          }
          ctx.lineTo(width, height);
          ctx.closePath();
          ctx.fill();

          // Mineral Hotspot Deposit
          ctx.fillStyle = '#f59e0b';
          const hotspotWorldX = 350;
          const hotspotScreenX = width / 2 + (hotspotWorldX - roverX);
          if (hotspotScreenX > -50 && hotspotScreenX < width + 50) {
            ctx.beginPath();
            ctx.arc(hotspotScreenX, groundY + 12, 35, 0, Math.PI * 2);
            ctx.fill();
          }

          // Rover Character
          const rx = width / 2;
          const ry = groundY - 12;

          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(rx - 22, ry - 14, 44, 20, 4);
          ctx.fill();
          ctx.stroke();

          // Rover Wheels
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(rx - 16, ry + 8, 8, 0, Math.PI * 2);
          ctx.arc(rx + 16, ry + 8, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Active Drill Effect
          if (drillingActive) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(rx, ry + 6);
            ctx.lineTo(rx, ry + 22);
            ctx.stroke();

            // Sparkles
            ctx.fillStyle = '#fef08a';
            for (let i = 0; i < 5; i++) {
              ctx.fillRect(rx + (Math.random() - 0.5) * 16, ry + 20 + Math.random() * 6, 2, 2);
            }
          }
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [roverX, roverSpeed, battery, cargoOre, drillingActive, isCompleted, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Top Header */}
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Pickaxe className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Lunar Surface Rover Mining Operations</h2>
              <p className="text-xs text-slate-400">Drive rover across regolith craters, locate Helium-3 deposits, and extract 250 kg raw ore</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 h-[460px]">
          <div className="md:col-span-3 bg-slate-950 relative border-r border-slate-800 flex items-center justify-center">
            <canvas ref={canvasRef} className="w-full h-full block" />

            {isCompleted && (
              <div className="absolute inset-0 bg-amber-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
                <CheckCircle className="w-16 h-16 text-amber-400 animate-bounce" />
                <h3 className="text-2xl font-black text-white">MINING EXTRACTION COMPLETE!</h3>
                <p className="text-sm text-amber-200">Cargo capacity 250 kg regolith ore collected. Transferred to base storage!</p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-lg cursor-pointer"
                >
                  Return to Base
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-900 p-4 space-y-4 text-xs font-mono border-t md:border-t-0 border-slate-800 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="font-bold text-amber-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <span>Rover Telemetry</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Ore Collected:</span>
                <span className="font-bold text-sm text-amber-300">{cargoOre.toFixed(0)} / 250 kg</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Drive Speed:</span>
                <span className="font-bold text-sm text-sky-300">{Math.abs(roverSpeed).toFixed(1)} m/s</span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1"><Battery className="w-3.5 h-3.5 text-amber-400" /> Power:</span>
                  <span className="font-bold text-amber-400">{battery.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-amber-500 transition-all duration-150"
                    style={{ width: `${battery}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
              <div className="font-bold text-slate-200">Controls:</div>
              <div><span className="text-amber-300 font-bold">A / D</span>: Drive Left / Right</div>
              <div><span className="text-amber-300 font-bold">SPACE</span>: Hold to Drill Ore</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
