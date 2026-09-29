import React, { useState, useEffect, useRef } from 'react';
import { Sun, CheckCircle, RotateCw, Zap, Award } from 'lucide-react';

interface SolarAlignmentMiniGameProps {
  onClose: () => void;
  onSuccess?: (reward: number) => void;
}

export const SolarAlignmentMiniGame: React.FC<SolarAlignmentMiniGameProps> = ({ onClose, onSuccess }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [panelAngle, setPanelAngle] = useState<number>(0.2); // Current angle
  const [targetSunAngle, setTargetSunAngle] = useState<number>(2.4); // Sun position
  const [solarFluxPercent, setSolarFluxPercent] = useState<number>(0);
  const [chargeProgress, setChargeProgress] = useState<number>(0); // 0 to 100%
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Rotate panel manually
  const handleRotate = (dir: number) => {
    if (isCompleted) return;
    setPanelAngle((a) => {
      let nextA = a + dir * 0.15;
      while (nextA > Math.PI * 2) nextA -= Math.PI * 2;
      while (nextA < 0) nextA += Math.PI * 2;
      return nextA;
    });
  };

  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // Slowly drift Sun position across orbital plane
      setTargetSunAngle((sa) => (sa + dt * 0.05) % (Math.PI * 2));

      // Calculate Solar Flux % (dot product / angle alignment)
      const diff = Math.abs(panelAngle - targetSunAngle);
      const minDiff = Math.min(diff, Math.PI * 2 - diff);
      const flux = Math.max(0, Math.cos(minDiff)) * 100;
      setSolarFluxPercent(flux);

      if (!isCompleted && flux > 85) {
        setChargeProgress((cp) => {
          const nextCp = Math.min(100, cp + dt * 18);
          if (nextCp >= 100) {
            setIsCompleted(true);
            if (onSuccess) onSuccess(1200);
          }
          return nextCp;
        });
      }

      // Render Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const width = (canvas.width = canvas.parentElement?.clientWidth || 600);
          const height = (canvas.height = canvas.parentElement?.clientHeight || 450);

          ctx.fillStyle = '#020617';
          ctx.fillRect(0, 0, width, height);

          const centerX = width / 2;
          const centerY = height / 2;

          // Sun Ray Rays
          const sunDist = 180;
          const sunX = centerX + Math.cos(targetSunAngle) * sunDist;
          const sunY = centerY + Math.sin(targetSunAngle) * sunDist;

          // Sun Body
          ctx.fillStyle = '#f59e0b';
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 25;
          ctx.beginPath();
          ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Sunlight Rays pointing to Satellite Center
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(sunX, sunY);
          ctx.lineTo(centerX, centerY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Satellite Central Core
          ctx.fillStyle = '#334155';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Articulated Solar Array Wings (Rotating with panelAngle)
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(panelAngle);

          // Deep Blue Photovoltaic Wings
          ctx.fillStyle = '#1d4ed8';
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.5;

          // Left Wing
          ctx.beginPath();
          ctx.roundRect(-110, -14, 80, 28, 3);
          ctx.fill();
          ctx.stroke();

          // Right Wing
          ctx.beginPath();
          ctx.roundRect(30, -14, 80, 28, 3);
          ctx.fill();
          ctx.stroke();

          ctx.restore();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [panelAngle, targetSunAngle, isCompleted, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sun className="w-5 h-5 text-amber-400 animate-spin" />
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Solar Array Sun-Tracking & Power Calibration</h2>
              <p className="text-xs text-slate-400">Rotate solar wing vector to align directly with orbiting Sun for &gt;85% power flux</p>
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
                <h3 className="text-2xl font-black text-white">SOLAR ARRAY FULLY CALIBRATED!</h3>
                <p className="text-sm text-amber-200">Satellite battery banks 100% charged. Earned 1,200 Credits!</p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-lg cursor-pointer"
                >
                  Return to Mission Control
                </button>
              </div>
            )}
          </div>

          <div className="bg-slate-900 p-4 space-y-4 text-xs font-mono border-t md:border-t-0 border-slate-800 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="font-bold text-amber-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Power Flux Matrix</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Solar Flux:</span>
                <span className={`font-bold text-sm ${solarFluxPercent > 85 ? 'text-emerald-400 font-bold' : 'text-amber-400'}`}>
                  {solarFluxPercent.toFixed(0)}%
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Battery Charge:</span>
                  <span className="font-bold text-sky-400">{chargeProgress.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-sky-500 transition-all duration-150"
                    style={{ width: `${chargeProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Manual Rotation Controls */}
            <div className="space-y-2">
              <div className="font-bold text-slate-200">Rotate Solar Array:</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleRotate(-1)}
                  className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-slate-700"
                >
                  <RotateCw className="w-4 h-4 transform -scale-x-100" /> Rotate CCW
                </button>
                <button
                  onClick={() => handleRotate(1)}
                  className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold flex items-center justify-center gap-1 transition cursor-pointer border border-slate-700"
                >
                  <RotateCw className="w-4 h-4" /> Rotate CW
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
