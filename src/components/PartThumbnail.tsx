import React, { useRef, useEffect } from 'react';
import { PartDefinition } from '../types';
import { drawPart2D } from '../graphics/partRenderer2D';

interface PartThumbnailProps {
  part: PartDefinition;
  width?: number;
  height?: number;
  className?: string;
}

export const PartThumbnail: React.FC<PartThumbnailProps> = ({
  part,
  width = 80,
  height = 80,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Subtle dark blueprint background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Subtle mini grid lines
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.6)';
    ctx.lineWidth = 0.5;
    const gridSpacing = 16;
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Calculate aspect fit sizing for the part
    // Add padding so part doesn't touch edges
    const padding = 12;
    const availW = width - padding * 2;
    const availH = height - padding * 2;

    const scaleX = availW / part.width;
    const scaleY = availH / part.height;
    const scale = Math.min(scaleX, scaleY);

    const pw = Math.max(16, part.width * scale);
    const ph = Math.max(16, part.height * scale);

    // Translate to center
    ctx.translate(width / 2, height / 2);

    drawPart2D(ctx, part, {
      widthPx: pw,
      heightPx: ph,
      rotation: 0,
      isSelected: false,
      isHovered: false,
      isFlight: false,
      showSnapPoints: false,
      solarPanelType: part.solarPanelType,
      solarGridN: part.solarGridN,
      solarGridM: part.solarGridM,
      solarPanelStyle: part.solarPanelStyle,
      landingLegType: part.landingLegType,
      legDeployAngleDeg: part.legDeployAngleDeg,
      legFootpadType: part.legFootpadType,
      rcsThrusterType: part.rcsThrusterType,
      rcsPropellantType: part.rcsPropellantType,
      rcsThrustKn: part.rcsThrustKn,
      tankSkin: (part as any).tankSkin,
    });

    ctx.restore();
  }, [part, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`rounded-lg overflow-hidden border border-slate-800 shadow-inner block ${className}`}
    />
  );
};
