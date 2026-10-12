import { useEffect } from 'react';
import { ScanLine } from 'lucide-react';
import { isTransformable, type ImageElement } from '@/domain/editor/elements';
import { Button } from '@/shared/components/primitives';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { clearMaskOfElement } from '@/features/editor/store/editorInteractions';
import { useTranslation } from '@/i18n';
import {
  DrawingSection,
  ImageFiltersSection,
  LayerActions,
  OrderSection,
  PositionSection,
  SectionTitle,
  StrokeSection,
  TextSection,
  TransformSection,
} from './editorPropertySections';

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
