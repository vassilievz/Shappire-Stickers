import {
  Copy,
  Crop,
  Eraser,
  Hand,
  ImagePlus,
  Layers,
  MessageSquare,
  MousePointer2,
  Paintbrush,
  RotateCcw,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
} from 'lucide-react';
import { EDITOR_CONFIG, QUICK_COLORS, type EditorTool } from '@/config/editor';
import { Button, IconButton } from '@/shared/components/primitives';
import { SliderField } from '@/shared/components/inputs';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

const TOOL_ICONS: Record<EditorTool, typeof MousePointer2> = {
  select: MousePointer2,
  text: Type,
  draw: Paintbrush,
  erase: Eraser,
  mask: Scissors,
  restore: RotateCcw,
  pan: Hand,
};

const TOOL_KEYS: EditorTool[] = ['select', 'text', 'draw', 'erase', 'mask', 'restore', 'pan'];

export interface EditorToolbarProps {
  activeTool: EditorTool;
  brushSize: number;
  brushColor: string;
  maskBrushSize: number;
  hasSelection: boolean;
  hasImageSelection?: boolean;
  hasDrawing: boolean;
  onSelectTool: (tool: EditorTool) => void;
  onBrushSizeChange: (size: number) => void;
  onBrushColorChange: (color: string) => void;
  onMaskBrushSizeChange: (size: number) => void;
  onImportImage: () => void;
  onOpenCropper?: () => void;
  onOpenEnhancer?: () => void;
  onOpenTemplates?: () => void;
  onOpenProperties: () => void;
  onOpenLayers: () => void;
  onClearDrawing: () => void;
  onUndoStroke: () => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
}

export function EditorToolbar({
  activeTool,
  brushSize,
  brushColor,
  maskBrushSize,
  hasSelection,
  hasImageSelection,
  hasDrawing,
  onSelectTool,
  onBrushSizeChange,
  onBrushColorChange,
  onMaskBrushSizeChange,
  onImportImage,
  onOpenCropper,
  onOpenEnhancer,
  onOpenTemplates,
  onOpenProperties,
  onOpenLayers,
  onClearDrawing,
  onUndoStroke,
  onDuplicateSelected,
  onDeleteSelected,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const showBrushSize = activeTool === 'draw' || activeTool === 'erase';
  const showMaskSize = activeTool === 'mask' || activeTool === 'restore';

  return (
    <div className="safe-bottom border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto w-full max-w-[768px] px-2 pt-1.5">
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          {TOOL_KEYS.map((toolId) => {
            const Icon = TOOL_ICONS[toolId];
            const active = activeTool === toolId;
            const label = t(`editor.tools.${toolId}`);
            return (
              <button
                key={toolId}
                type="button"
                aria-pressed={active}
                aria-label={label}
                title={label}
                onClick={() => onSelectTool(toolId)}
                className={cx(
                  'flex min-w-[52px] flex-1 flex-col items-center gap-1 rounded-[12px] px-1 py-2 transition-all duration-150 touch-manipulation',
                  active
                    ? 'bg-surface-3 text-ink shadow-[0_2px_8px_rgba(255,255,255,0.06)] ring-1 ring-white/15'
                    : 'text-ink-muted hover:text-ink-soft hover:bg-surface-2/60',
                )}
              >
                <Icon className="size-[19px]" aria-hidden />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pb-2 pt-1">
          {showBrushSize ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {QUICK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={t('editor.toolbar.brushColor', { color })}
                    aria-pressed={brushColor.toUpperCase() === color.toUpperCase()}
                    onClick={() => onBrushColorChange(color)}
                    className={cx(
                      'size-7 shrink-0 rounded-full border transition-transform active:scale-95 touch-manipulation relative after:absolute after:-inset-1.5 after:content-[""]',
                      brushColor.toUpperCase() === color.toUpperCase()
                        ? 'border-focus ring-2 ring-focus/40'
                        : 'border-line',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <SliderField
                label={activeTool === 'erase' ? t('editor.toolbar.eraserSize') : t('editor.toolbar.brushSize')}
                value={brushSize}
                min={Math.min(...EDITOR_CONFIG.brushSizes)}
                max={Math.max(...EDITOR_CONFIG.brushSizes)}
                step={1}
                displayValue={`${brushSize}px`}
                onChange={onBrushSizeChange}
              />
            </div>
          ) : null}

          {showMaskSize ? (
            <SliderField
              label={t('editor.toolbar.maskSize')}
              value={maskBrushSize}
              min={Math.min(...EDITOR_CONFIG.maskBrushSizes)}
              max={Math.max(...EDITOR_CONFIG.maskBrushSizes)}
              step={1}
              displayValue={`${maskBrushSize}px`}
              onChange={onMaskBrushSizeChange}
            />
          ) : null}

          {activeTool === 'pan' ? (
            <p className="px-1 text-[12px] leading-snug text-ink-muted">
              {t('editor.toolbar.panHint')}
            </p>
          ) : null}

          {activeTool === 'draw' || activeTool === 'erase' ? (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={onUndoStroke}
                disabled={!hasDrawing}
                icon={<Undo2 className="size-4" aria-hidden />}
              >
                {t('editor.toolbar.lastStroke')}
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={onClearDrawing}
                disabled={!hasDrawing}
                icon={<Trash2 className="size-4" aria-hidden />}
              >
                {t('editor.toolbar.clearDrawings')}
              </Button>
            </div>
          ) : null}

          {activeTool === 'select' ? (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={onImportImage}
                icon={<ImagePlus className="size-4" aria-hidden />}
              >
                {t('editor.toolbar.image')}
              </Button>
              {onOpenTemplates ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onOpenTemplates}
                  icon={<MessageSquare className="size-4" aria-hidden />}
                >
                  {t('editor.tools.templates')}
                </Button>
              ) : null}
              {hasImageSelection && onOpenCropper ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onOpenCropper}
                  icon={<Crop className="size-4" aria-hidden />}
                >
                  {t('editor.toolbar.crop')}
                </Button>
              ) : null}
              {hasImageSelection && onOpenEnhancer ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onOpenEnhancer}
                  icon={<Sparkles className="size-4 text-accent" aria-hidden />}
                >
                  {t('editor.properties.enhanceButton')}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenProperties}
                disabled={!hasSelection}
                icon={<SlidersHorizontal className="size-4" aria-hidden />}
              >
                {t('editor.toolbar.adjustments')}
              </Button>
              <IconButton
                label={t('editor.toolbar.duplicate')}
                size="sm"
                onClick={onDuplicateSelected}
                disabled={!hasSelection}
              >
                <Copy className="size-4" aria-hidden />
              </IconButton>
              <IconButton
                label={t('editor.toolbar.delete')}
                size="sm"
                tone="danger"
                onClick={onDeleteSelected}
                disabled={!hasSelection}
              >
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
              <IconButton label={t('editor.toolbar.layers')} size="sm" onClick={onOpenLayers}>
                <Layers className="size-4" aria-hidden />
              </IconButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
