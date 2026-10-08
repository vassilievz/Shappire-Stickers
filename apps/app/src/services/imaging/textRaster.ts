import { EDITOR_CONFIG, EDITOR_FONTS, type EditorFontId } from '@/config/editor';
import type { ShadowStyle, StrokeStyle } from '@/domain/editor/elements';
import { hashObject } from '@/shared/utils/hash';
import { type CanvasFactory, defaultCanvasFactory, getContext2D } from './canvas';


export interface TextRasterInput {
  text: string;
  fontId: EditorFontId;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  stroke: StrokeStyle;
  shadow: ShadowStyle;
}

export interface TextLayout {
  lines: string[];
  lineWidths: number[];
  blockWidth: number;
  lineHeightPx: number;
  blockHeight: number;
  padding: number;
}

export interface TextRasterResult extends TextLayout {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export function fontFamilyFor(fontId: EditorFontId): string {
  return EDITOR_FONTS.find((font) => font.id === fontId)?.family ?? EDITOR_FONTS[0].family;
}

export function textFontString(input: Pick<TextRasterInput, 'fontId' | 'fontSize'>): string {
  return `${Math.max(1, Math.round(input.fontSize))}px ${fontFamilyFor(input.fontId)}`;
}

function computePadding(input: TextRasterInput): number {
  const strokePad = input.stroke.enabled ? input.stroke.width : 0;
  const shadowPad = input.shadow.enabled
    ? input.shadow.blur + Math.max(Math.abs(input.shadow.offsetX), Math.abs(input.shadow.offsetY))
    : 0;
  return Math.ceil(strokePad + shadowPad + input.fontSize * 0.08);
}


export function layoutText(ctx: CanvasRenderingContext2D, input: TextRasterInput): TextLayout {
  ctx.font = textFontString(input);
  const rawLines = input.text.split('\n');
  const lines = rawLines.length > 0 ? rawLines : [''];
  const lineWidths = lines.map((line) => Math.max(1, ctx.measureText(line === '' ? ' ' : line).width));
  const blockWidth = Math.max(1, ...lineWidths);
  const lineHeightPx = Math.max(1, input.fontSize * input.lineHeight);
  const padding = computePadding(input);
  return {
    lines,
    lineWidths,
    blockWidth,
    lineHeightPx,
    blockHeight: Math.max(1, lineHeightPx * lines.length),
    padding,
  };
}

export interface RasterizeTextOptions {
  factory?: CanvasFactory;
  scale?: number;
}

export function rasterizeText(
  input: TextRasterInput,
  options: RasterizeTextOptions = {},
): TextRasterResult {
  const factory = options.factory ?? defaultCanvasFactory;
  const scale = options.scale ?? EDITOR_CONFIG.rasterScale;

  const measureCanvas = factory(1, 1);
  const measureCtx = getContext2D(measureCanvas);
  const layout = layoutText(measureCtx, input);

  const width = Math.ceil(layout.blockWidth + layout.padding * 2);
  const height = Math.ceil(layout.blockHeight + layout.padding * 2);
  const canvas = factory(width * scale, height * scale);
  const ctx = getContext2D(canvas, { willReadFrequently: true });
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);

  ctx.font = textFontString(input);
  ctx.textBaseline = 'top';
  ctx.textAlign = input.align;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  if (input.shadow.enabled) {
    ctx.shadowColor = input.shadow.color;
    ctx.shadowBlur = input.shadow.blur;
    ctx.shadowOffsetX = input.shadow.offsetX;
    ctx.shadowOffsetY = input.shadow.offsetY;
  }

  const x = input.align === 'left' ? layout.padding : input.align === 'right' ? width - layout.padding : width / 2;

  layout.lines.forEach((line, index) => {
    const y = layout.padding + index * layout.lineHeightPx;
    if (input.stroke.enabled && input.stroke.width > 0) {
      ctx.lineWidth = input.stroke.width;
      ctx.strokeStyle = input.stroke.color;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = input.color;
    ctx.fillText(line, x, y);
  });

  return { ...layout, canvas, width, height };
}


export function textRevision(input: TextRasterInput, scale: number = EDITOR_CONFIG.rasterScale): string {
  return hashObject({ ...input, scale });
}
