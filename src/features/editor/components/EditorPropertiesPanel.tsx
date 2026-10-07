import { useEffect, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  ScanLine,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { EDITOR_CONFIG, EDITOR_FONTS, QUICK_COLORS, type EditorFontId } from '@/config/editor';
import {
  isTransformable,
  type EditorElement,
  type ImageElement,
  type ImageFilters,
  DEFAULT_IMAGE_FILTERS,
  type StrokeStyle,
  type TextElement,
} from '@/domain/editor/elements';
import { ColorField, SegmentedControl, SliderField, SwitchField, TextArea } from '@/shared/components/inputs';
import { Button } from '@/shared/components/primitives';
import { useEditorStore } from '@/features/editor/store/editorStore';
import {
  clearDrawingLayer,
  clearMaskOfElement,
  nudgeElement,
  undoLastDrawingStroke,
  updateTextElement,
} from '@/features/editor/store/editorInteractions';
import { useTranslation } from '@/i18n';

export function EditorPropertiesPanel({
  onAddText,
  onImportImage,
  onOpenCropper,
}: {
  onAddText: () => void;
  onImportImage: () => void;
  onOpenCropper?: (element: ImageElement) => void;
}) {
  const { t } = useTranslation();
  const elements = useEditorStore((state) => state.history.present);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const selectedId = selectedIds[0];
  const element = selectedId
    ? (elements.find((item) => item.id === selectedId) ?? null)
    : null;

  const textId = element?.kind === 'text' ? element.id : null;

  useEffect(() => {
    if (!textId) return undefined;
    useEditorStore.getState().beginTextEdit(textId);
    return () => {
      useEditorStore.getState().endTextEdit();
    };
  }, [textId]);

  if (!element) {
    return (
      <div className="flex flex-col items-center gap-3 px-1 pb-3 pt-4 text-center">
        <p className="text-[13px] leading-relaxed text-ink-muted">
          {t('editor.properties.noSelection')}
        </p>
        <div className="flex w-full max-w-[320px] flex-col gap-2">
          <Button variant="secondary" fullWidth onClick={onAddText}>
            {t('editor.tools.text')}
          </Button>
          <Button variant="secondary" fullWidth onClick={onImportImage}>
            {t('home.importImage')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-3">
      {isTransformable(element) ? (
        <>
          <TransformSection element={element} />
          <PositionSection element={element} />
          <OrderSection element={element} />
        </>
      ) : null}

      {element.kind === 'text' ? <TextSection element={element} /> : null}

      {element.kind === 'image' ? (
        <>
          <section className="flex flex-col gap-2">
            <SectionTitle>{t('editor.properties.cropAndFrameSection')}</SectionTitle>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => onOpenCropper?.(element)}
              icon={<ScanLine className="size-4" aria-hidden />}
            >
              {t('editor.properties.cropAndFrameButton')}
            </Button>
          </section>

          <StrokeSection
            stroke={element.stroke}
            onChange={(stroke) => useEditorStore.getState().updateElement(element.id, { stroke })}
          />
          <ImageFiltersSection
            element={element}
            onChange={(filters) => useEditorStore.getState().updateElement(element.id, { filters })}
          />
          {element.maskStrokes.length > 0 ? (
            <Button
              variant="quiet"
              fullWidth
              onClick={() => clearMaskOfElement(element.id)}
              icon={<ScanLine className="size-4" aria-hidden />}
            >
              {t('editor.properties.restoreCutouts')}
            </Button>
          ) : null}
        </>
      ) : null}

      {element.kind === 'drawing' ? <DrawingSection hasStrokes={element.strokes.length > 0} /> : null}

      <LayerActions element={element} />
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{children}</h3>
  );
}

function TransformSection({ element }: { element: ImageElement | TextElement }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t('editor.properties.transformSection')}</SectionTitle>
      <SliderField
        label={t('editor.properties.opacity')}
        value={Math.round(element.opacity * 100)}
        min={10}
        max={100}
        step={5}
        displayValue={`${Math.round(element.opacity * 100)}%`}
        onChange={(value) =>
          useEditorStore.getState().updateElement(element.id, { opacity: value / 100 })
        }
      />
      <SliderField
        label={t('editor.properties.rotation')}
        value={Math.round(element.rotation)}
        min={-180}
        max={180}
        step={1}
        displayValue={`${Math.round(element.rotation)}°`}
        onChange={(value) => useEditorStore.getState().updateElement(element.id, { rotation: value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="quiet"
          size="sm"
          onClick={() => useEditorStore.getState().updateElement(element.id, { rotation: 0 })}
        >
          {t('editor.properties.resetRotation')}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => useEditorStore.getState().updateElement(element.id, { rotation: -90 })}
        >
          {t('editor.properties.rotate90')}
        </Button>
      </div>
    </section>
  );
}

function PositionSection({ element }: { element: ImageElement | TextElement }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t('editor.properties.positionSection')}</SectionTitle>
      <div className="mx-auto grid w-[168px] grid-cols-3 gap-1.5">
        <span />
        <NudgeButton label={t('editor.properties.nudgeUp')} onClick={() => nudgeElement(element.id, 0, -1)}>
          <ArrowUp className="size-4" aria-hidden />
        </NudgeButton>
        <span />
        <NudgeButton label={t('editor.properties.nudgeLeft')} onClick={() => nudgeElement(element.id, -1, 0)}>
          <ArrowLeft className="size-4" aria-hidden />
        </NudgeButton>
        <NudgeButton
          label={t('editor.properties.centerCanvas')}
          onClick={() =>
            useEditorStore.getState().updateElement(element.id, {
              x: Math.round((EDITOR_CONFIG.canvasSize - element.width) / 2),
              y: Math.round((EDITOR_CONFIG.canvasSize - element.height) / 2),
            })
          }
        >
          <span className="text-[10px] font-semibold">{t('editor.properties.center')}</span>
        </NudgeButton>
        <NudgeButton label={t('editor.properties.nudgeRight')} onClick={() => nudgeElement(element.id, 1, 0)}>
          <ArrowRight className="size-4" aria-hidden />
        </NudgeButton>
        <span />
        <NudgeButton label={t('editor.properties.nudgeDown')} onClick={() => nudgeElement(element.id, 0, 1)}>
          <ArrowDown className="size-4" aria-hidden />
        </NudgeButton>
        <span />
      </div>
      <p className="text-center text-[11px] text-ink-muted">
        {Math.round(element.x)}, {Math.round(element.y)} · {Math.round(element.width)} ×{' '}
        {Math.round(element.height)} px
      </p>
    </section>
  );
}

function NudgeButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-11 min-h-[44px] items-center justify-center rounded-[10px] border border-line bg-surface-2 text-ink-soft transition-colors hover:bg-surface-3 active:scale-95 touch-manipulation"
    >
      {children}
    </button>
  );
}

function OrderSection({ element }: { element: EditorElement }) {
  const { t } = useTranslation();
  const reorder = useEditorStore((state) => state.reorder);
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t('editor.properties.orderSection')}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="quiet"
          size="sm"
          onClick={() => reorder(element.id, 'forward')}
          icon={<ChevronUp className="size-4" aria-hidden />}
        >
          {t('editor.properties.forward')}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => reorder(element.id, 'backward')}
          icon={<ChevronDown className="size-4" aria-hidden />}
        >
          {t('editor.properties.backward')}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => reorder(element.id, 'front')}>
          {t('editor.properties.front')}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => reorder(element.id, 'back')}>
          {t('editor.properties.back')}
        </Button>
      </div>
    </section>
  );
}

function TextSection({ element }: { element: TextElement }) {
  const { t } = useTranslation();
  const apply = (patch: Partial<Omit<TextElement, 'kind' | 'id'>>) =>
    updateTextElement(element.id, patch, { transient: true });

  const alignOptions = [
    { value: 'left', label: t('editor.properties.alignLeft') },
    { value: 'center', label: t('editor.properties.alignCenter') },
    { value: 'right', label: t('editor.properties.alignRight') },
  ] as const;

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>{t('editor.properties.textSection')}</SectionTitle>
      <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface-2 p-3">
        <div>
          <p className="text-[13px] font-semibold text-ink">{t('editor.properties.memePreset')}</p>
          <p className="text-[11px] text-ink-muted">{t('editor.properties.memePresetDesc')}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            apply({
              text: element.text.toUpperCase(),
              color: '#FFFFFF',
              stroke: { enabled: true, color: '#000000', width: 8 },
              shadow: { enabled: true, color: 'rgba(0,0,0,0.8)', blur: 4, offsetX: 2, offsetY: 2 },
              align: 'center',
            });
          }}
          icon={<Sparkles className="size-3.5" aria-hidden />}
        >
          {t('editor.properties.memePreset')}
        </Button>
      </div>

      <TextArea
        label={t('editor.properties.textContent')}
        name="editor-text"
        value={element.text}
        rows={3}
        placeholder={t('editor.properties.textPlaceholder')}
        onChange={(event) => apply({ text: event.target.value })}
        hint={t('editor.properties.textHint')}
      />

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-medium tracking-wide text-ink-muted">
          {t('editor.properties.font')}
        </span>
        <select
          value={element.fontId}
          onChange={(event) => apply({ fontId: event.target.value as EditorFontId })}
          className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 text-[14px] text-ink transition-colors focus:border-focus/60"
        >
          {EDITOR_FONTS.map((font) => (
            <option key={font.id} value={font.id}>
              {font.label}
            </option>
          ))}
        </select>
      </label>

      <SliderField
        label={t('editor.properties.fontSize')}
        value={element.fontSize}
        min={16}
        max={200}
        step={2}
        displayValue={`${element.fontSize}px`}
        onChange={(fontSize) => apply({ fontSize })}
      />

      <ColorField
        label={t('editor.properties.fontColor')}
        value={element.color}
        presets={QUICK_COLORS}
        onChange={(color) => apply({ color })}
      />

      <SegmentedControl
        label={t('editor.properties.alignment')}
        value={element.align}
        options={alignOptions}
        onChange={(align) => apply({ align })}
      />

      <SliderField
        label={t('editor.properties.lineSpacing')}
        value={element.lineHeight}
        min={0.9}
        max={2}
        step={0.05}
        displayValue={element.lineHeight.toFixed(2).replace('.', ',')}
        onChange={(lineHeight) => apply({ lineHeight })}
      />

      <StrokeSection stroke={element.stroke} onChange={(stroke) => apply({ stroke })} />

      <section className="flex flex-col gap-3">
        <SectionTitle>{t('editor.properties.textShadow')}</SectionTitle>
        <SwitchField
          label={t('editor.properties.textShadow')}
          description={t('editor.properties.textShadowDesc')}
          checked={element.shadow.enabled}
          onChange={(enabled) => apply({ shadow: { ...element.shadow, enabled } })}
        />
        {element.shadow.enabled ? (
          <SliderField
            label={t('editor.properties.shadowBlur')}
            value={element.shadow.blur}
            min={0}
            max={24}
            step={1}
            displayValue={`${element.shadow.blur}px`}
            onChange={(blur) => apply({ shadow: { ...element.shadow, blur } })}
          />
        ) : null}
      </section>
    </section>
  );
}

function StrokeSection({
  stroke,
  onChange,
}: {
  stroke: StrokeStyle;
  onChange: (stroke: StrokeStyle) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t('editor.properties.outlineSection')}</SectionTitle>
      <SwitchField
        label={t('editor.properties.enableOutline')}
        description={t('editor.properties.outlineDesc')}
        checked={stroke.enabled}
        onChange={(enabled) =>
          onChange({ ...stroke, enabled, width: enabled && stroke.width === 0 ? 8 : stroke.width })
        }
      />
      {stroke.enabled ? (
        <>
          <ColorField
            label={t('editor.properties.outlineColor')}
            value={stroke.color}
            presets={QUICK_COLORS}
            onChange={(color) => onChange({ ...stroke, color })}
          />
          <SliderField
            label={t('editor.properties.outlineWidth')}
            value={stroke.width}
            min={1}
            max={24}
            step={1}
            displayValue={`${stroke.width}px`}
            onChange={(width) => onChange({ ...stroke, width })}
          />
        </>
      ) : null}
    </section>
  );
}

function ImageFiltersSection({
  element,
  onChange,
}: {
  element: ImageElement;
  onChange: (filters: ImageFilters) => void;
}) {
  const { t } = useTranslation();
  const filters: ImageFilters = element.filters ?? DEFAULT_IMAGE_FILTERS;

  const update = (patch: Partial<ImageFilters>) => {
    onChange({ ...filters, ...patch });
  };

  const hasAdjustments =
    filters.brightness !== 0 ||
    filters.contrast !== 0 ||
    filters.saturation !== 0 ||
    filters.grayscale ||
    filters.sepia ||
    filters.invert;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionTitle>{t('editor.properties.filtersSection')}</SectionTitle>
        {hasAdjustments && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_IMAGE_FILTERS)}
            className="text-[11px] font-medium text-accent hover:underline"
          >
            {t('editor.properties.resetFilters')}
          </button>
        )}
      </div>

      <SliderField
        label={t('editor.properties.brightness')}
        value={filters.brightness}
        min={-50}
        max={50}
        step={2}
        displayValue={`${filters.brightness > 0 ? `+${filters.brightness}` : filters.brightness}%`}
        onChange={(brightness) => update({ brightness })}
      />

      <SliderField
        label={t('editor.properties.contrast')}
        value={filters.contrast}
        min={-50}
        max={50}
        step={2}
        displayValue={`${filters.contrast > 0 ? `+${filters.contrast}` : filters.contrast}%`}
        onChange={(contrast) => update({ contrast })}
      />

      <SliderField
        label={t('editor.properties.saturation')}
        value={filters.saturation}
        min={-50}
        max={50}
        step={2}
        displayValue={`${filters.saturation > 0 ? `+${filters.saturation}` : filters.saturation}%`}
        onChange={(saturation) => update({ saturation })}
      />

      <div className="grid grid-cols-3 gap-1.5 pt-1">
        <Button
          variant={filters.grayscale ? 'primary' : 'quiet'}
          size="sm"
          onClick={() => update({ grayscale: !filters.grayscale })}
        >
          {t('editor.properties.grayscale')}
        </Button>
        <Button
          variant={filters.sepia ? 'primary' : 'quiet'}
          size="sm"
          onClick={() => update({ sepia: !filters.sepia })}
        >
          {t('editor.properties.sepia')}
        </Button>
        <Button
          variant={filters.invert ? 'primary' : 'quiet'}
          size="sm"
          onClick={() => update({ invert: !filters.invert })}
        >
          {t('editor.properties.invert')}
        </Button>
      </div>
    </section>
  );
}

function DrawingSection({ hasStrokes }: { hasStrokes: boolean }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t('editor.properties.drawingSection')}</SectionTitle>
      <div className="flex flex-col gap-2">
        <Button
          variant="quiet"
          fullWidth
          disabled={!hasStrokes}
          onClick={undoLastDrawingStroke}
          icon={<Eraser className="size-4" aria-hidden />}
        >
          {t('editor.properties.undoStroke')}
        </Button>
        <Button variant="quiet" fullWidth disabled={!hasStrokes} onClick={clearDrawingLayer}>
          {t('editor.properties.clearStrokes')}
        </Button>
      </div>
    </section>
  );
}

function LayerActions({ element }: { element: EditorElement }) {
  const { t } = useTranslation();
  const toggleVisibility = useEditorStore((state) => state.toggleVisibility);
  const toggleLock = useEditorStore((state) => state.toggleLock);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const removeElements = useEditorStore((state) => state.removeElements);

  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="quiet"
          size="sm"
          onClick={() => toggleVisibility(element.id)}
          icon={element.visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
        >
          {element.visible ? t('editor.properties.hide') : t('editor.properties.show')}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          onClick={() => toggleLock(element.id)}
          icon={element.locked ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />}
        >
          {element.locked ? t('editor.properties.unlock') : t('editor.properties.lock')}
        </Button>
        <Button
          variant="quiet"
          size="sm"
          disabled={!isTransformable(element)}
          onClick={duplicateSelected}
          icon={<Copy className="size-4" aria-hidden />}
        >
          {t('editor.properties.duplicate')}
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={() => removeElements([element.id])}
          icon={<Trash2 className="size-4" aria-hidden />}
        >
          {t('editor.properties.delete')}
        </Button>
      </div>
    </section>
  );
}
