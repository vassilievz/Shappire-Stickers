
export const EDITOR_CONFIG = {
  
  canvasSize: 512,
  
  historyLimit: 40,
  
  minZoom: 0.4,
  maxZoom: 6,
  
  transparencyGridSize: 16,
  
  rasterScale: 2,
  
  maxImportedImageDimension: 1600,
  
  nudgeStep: 1,
  
  brushSizes: [4, 8, 14, 24, 40] as const,
  maskBrushSizes: [10, 20, 34, 50, 80] as const,
  
  fontSizes: [24, 32, 40, 48, 64, 80, 104, 128] as const,
} as const;


export const EDITOR_FONTS = [
  { id: 'sans', label: 'Sem serifa', family: 'Roboto, "Helvetica Neue", Arial, sans-serif' },
  { id: 'serif', label: 'Com serifa', family: '"Noto Serif", Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Monoespaçada', family: '"Roboto Mono", "Courier New", monospace' },
  { id: 'cursive', label: 'Manuscrita', family: '"Dancing Script", "Comic Sans MS", cursive' },
  { id: 'condensed', label: 'Condensada', family: '"Roboto Condensed", "Arial Narrow", sans-serif' },
] as const;

export type EditorFontId = (typeof EDITOR_FONTS)[number]['id'];

export const DEFAULT_FONT_ID: EditorFontId = 'sans';


export const QUICK_COLORS = [
  '#FFFFFF',
  '#000000',
  '#111827',
  '#6B7280',
  '#EF4444',
  '#F97316',
  '#FACC15',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
] as const;


export const EDITOR_TOOLS = [
  'select',
  'text',
  'draw',
  'erase',
  'mask',
  'restore',
  'pan',
] as const;

export type EditorTool = (typeof EDITOR_TOOLS)[number];

export const EDITOR_TOOL_LABELS: Record<EditorTool, string> = {
  select: 'Selecionar',
  text: 'Texto',
  draw: 'Desenhar',
  erase: 'Borracha',
  mask: 'Recortar',
  restore: 'Restaurar',
  pan: 'Mover',
};
