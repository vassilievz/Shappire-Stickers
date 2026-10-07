import { createSurface } from './canvas';

export type BubbleType = 'speech' | 'thought' | 'shout';

export interface SpeechBubbleOptions {
  type: BubbleType;
  width?: number;
  height?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface StampPreset {
  id: string;
  text: string;
  color: string;
}

export const STAMP_PRESETS: ReadonlyArray<StampPreset> = [
  { id: 'top', text: 'TOP', color: '#10B981' },
  { id: 'aprovado', text: 'APROVADO', color: '#059669' },
  { id: 'eita', text: 'EITA!', color: '#F59E0B' },
  { id: 'urgente', text: 'URGENTE', color: '#EF4444' },
  { id: 'cem', text: '100%', color: '#8B5CF6' },
  { id: 'cancelado', text: 'CANCELADO', color: '#DC2626' },
  { id: 'perfeito', text: 'PERFEITO', color: '#3B82F6' },
  { id: 'meme', text: 'CONFIA', color: '#EC4899' },
];

/**
 * Generates a speech bubble graphic as a transparent canvas.
 */
export function generateSpeechBubbleCanvas(options: SpeechBubbleOptions): HTMLCanvasElement {
  const width = options.width ?? 400;
  const height = options.height ?? 260;
  const fillColor = options.fillColor ?? '#FFFFFF';
  const strokeColor = options.strokeColor ?? '#1A1A1A';
  const strokeWidth = options.strokeWidth ?? 10;

  const { canvas, ctx } = createSurface(width, height);
  if (!ctx) return canvas;

  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const pad = strokeWidth * 1.5;

  if (options.type === 'speech') {
    // Rounded rect with speech tail pointing towards bottom-left
    const boxW = width - pad * 2;
    const boxH = height - pad * 2 - 40;
    const radius = 32;

    ctx.beginPath();
    ctx.moveTo(pad + radius, pad);
    ctx.lineTo(pad + boxW - radius, pad);
    ctx.quadraticCurveTo(pad + boxW, pad, pad + boxW, pad + radius);
    ctx.lineTo(pad + boxW, pad + boxH - radius);
    ctx.quadraticCurveTo(pad + boxW, pad + boxH, pad + boxW - radius, pad + boxH);

    // Tail start
    ctx.lineTo(pad + 120, pad + boxH);
    ctx.lineTo(pad + 30, height - pad);
    ctx.lineTo(pad + 70, pad + boxH);

    ctx.lineTo(pad + radius, pad + boxH);
    ctx.quadraticCurveTo(pad, pad + boxH, pad, pad + boxH - radius);
    ctx.lineTo(pad, pad + radius);
    ctx.quadraticCurveTo(pad, pad, pad + radius, pad);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();
  } else if (options.type === 'thought') {
    // Cloud thought bubble
    const cx = width / 2;
    const cy = (height - 50) / 2;
    const rx = (width - pad * 2) / 2;
    const ry = (height - pad * 2 - 50) / 2;

    ctx.beginPath();
    const arcs = 8;
    for (let i = 0; i < arcs; i++) {
      const angle = (i * 2 * Math.PI) / arcs;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      ctx.arc(x, y, 36, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // Thought bubbles trailing down
    const bubbles = [
      { x: cx - rx * 0.4, y: height - 44, r: 16 },
      { x: cx - rx * 0.6, y: height - 18, r: 10 },
    ];
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    // Shout / manga explosion bubble
    const cx = width / 2;
    const cy = height / 2;
    const points = 14;
    const outerR = Math.min(width, height) / 2 - pad;
    const innerR = outerR * 0.65;

    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  return canvas;
}

/**
 * Generates an angled, rubber-stamp graphic with bold text and double borders.
 */
export function generateStampCanvas(
  text: string,
  color = '#EF4444',
  width = 380,
  height = 160,
): HTMLCanvasElement {
  const { canvas, ctx } = createSurface(width, height);
  if (!ctx) return canvas;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate((-8 * Math.PI) / 180); // Slight stamp tilt

  const boxW = width - 40;
  const boxH = height - 40;

  // Outer border
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.lineJoin = 'round';
  ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

  // Inner border
  ctx.lineWidth = 3;
  ctx.strokeRect(-boxW / 2 + 8, -boxH / 2 + 8, boxW - 16, boxH - 16);

  // Text
  ctx.fillStyle = color;
  ctx.font = '900 46px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 0, 2);

  ctx.restore();
  return canvas;
}
