import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Boxes, ImagePlus, Layers, Minus, Plus, Type } from 'lucide-react';
import { EDITOR_CONFIG } from '@/config/editor';
import { Button, IconButton } from '@/shared/components/primitives';
import { BottomSheet, Modal } from '@/shared/components/overlays';
import { TextInput } from '@/shared/components/inputs';
import { EditorCanvas } from './components/EditorCanvas';
import { EditorHeader } from './components/EditorHeader';
import { EditorToolbar } from './components/EditorToolbar';
import { EditorLayersPanel } from './components/EditorLayersPanel';
import { EditorPropertiesPanel } from './components/EditorPropertiesPanel';
import { EditorExportSheet } from './components/EditorExportSheet';
import { ImageCropperModal } from './components/ImageCropperModal';
import {
  applyCroppedImageToElement,
  importImagesToCanvas,
  openProjectById,
  releaseEditorResources,
  saveCurrentProject,
} from './store/editorAsyncActions';
import { clearDrawingLayer, undoLastDrawingStroke } from './store/editorInteractions';
import { useEditorStore } from './store/editorStore';
import { showToast } from '@/state/toastStore';
import { clamp } from '@/shared/utils/math';
import { readAssetDataUrlByPath } from '@/services/storage/projectRepository';
import type { ImageElement } from '@/domain/editor/elements';
import { useTranslation } from '@/i18n';

const CANVAS = EDITOR_CONFIG.canvasSize;

export function EditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();

  const [rasterNonce, setRasterNonce] = useState(0);
  const [layersOpen, setLayersOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [cropperTargetElementId, setCropperTargetElementId] = useState<string | null>(null);

  const history = useEditorStore((state) => state.history);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const activeTool = useEditorStore((state) => state.activeTool);
  const brushSize = useEditorStore((state) => state.brushSize);
  const brushColor = useEditorStore((state) => state.brushColor);
  const maskBrushSize = useEditorStore((state) => state.maskBrushSize);
  const viewport = useEditorStore((state) => state.viewport);
  const projectName = useEditorStore((state) => state.projectName);
  const dirty = useEditorStore((state) => state.dirty);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const exporting = useEditorStore((state) => state.exporting);

  const setViewport = useEditorStore((state) => state.setViewport);
  const setTool = useEditorStore((state) => state.setTool);
  const setBrushSize = useEditorStore((state) => state.setBrushSize);
  const setBrushColor = useEditorStore((state) => state.setBrushColor);
  const setMaskBrushSize = useEditorStore((state) => state.setMaskBrushSize);
  const setProjectName = useEditorStore((state) => state.setProjectName);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const removeElements = useEditorStore((state) => state.removeElements);

  const elements = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const hasDrawing = elements.some(
    (element) => element.kind === 'drawing' && element.strokes.length > 0,
  );
  const selectedElement = useMemo(
    () => elements.find((element) => element.id === selectedIds[0]) ?? null,
    [elements, selectedIds],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const store = useEditorStore.getState();
      try {
        if (projectId) {
          const opened = await openProjectById(projectId);
          if (!opened) store.openNewProject();
        } else if (!store.projectId) {
          store.openNewProject();
        }
        const packParam = new URLSearchParams(location.search).get('pack');
        if (packParam) useEditorStore.getState().setPackId(packParam);
      } finally {
        if (!cancelled) {
          setRasterNonce((value) => value + 1);
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [projectId, location.search]);

  useEffect(() => () => releaseEditorResources(), []);

  const save = useCallback(async () => {
    await saveCurrentProject({ silent: false });
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'hidden') return;
      const store = useEditorStore.getState();
      if (store.projectId && store.dirty) void saveCurrentProject({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const handleBack = useCallback(async () => {
    const store = useEditorStore.getState();
    if (store.projectId && store.dirty) {
      await saveCurrentProject({ silent: true });
    }
    void navigate('/');
  }, [navigate]);

  const handleImport = useCallback(async () => {
    const added = await importImagesToCanvas(4);
    if (added > 0) setRasterNonce((value) => value + 1);
  }, []);

  const handleAddText = useCallback(() => {
    const store = useEditorStore.getState();
    store.addText('Nova frase');
    store.setTool('select');
    setRasterNonce((value) => value + 1);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    removeElements(selectedIds);
    setRasterNonce((value) => value + 1);
  }, [removeElements, selectedIds]);

  const handleDuplicate = useCallback(() => {
    duplicateSelected();
    setRasterNonce((value) => value + 1);
  }, [duplicateSelected]);

  const zoomBy = useCallback(
    (factor: number) => {
      const current = useEditorStore.getState().viewport;
      const zoom = clamp(current.zoom * factor, EDITOR_CONFIG.minZoom, EDITOR_CONFIG.maxZoom);
      const world = CANVAS / 2;
      setViewport({
        zoom,
        offsetX: current.offsetX + world * current.zoom - world * zoom,
        offsetY: current.offsetY + world * current.zoom - world * zoom,
      });
    },
    [setViewport],
  );

  const openRename = useCallback(() => {
    setRenameValue(useEditorStore.getState().projectName);
    setRenaming(true);
  }, []);

  const handleRename = useCallback(() => {
    const value = renameValue.trim();
    if (value === '') {
      showToast(t('editor.renameModal.nameRequired'), 'warning');
      return;
    }
    setProjectName(value);
    setRenaming(false);
  }, [renameValue, setProjectName, t]);

  const handleOpenCropper = useCallback(async (element: ImageElement) => {
    try {
      const dataUrl = await readAssetDataUrlByPath(element.assetPath);
      setCropperImageSrc(dataUrl);
      setCropperTargetElementId(element.id);
      setCropperOpen(true);
      setPropertiesOpen(false);
    } catch {
      showToast(t('editor.cropper.loadError'), 'error');
    }
  }, [t]);

  const handleCropperConfirm = useCallback(
    async (cropResult: { dataUrl: string; width: number; height: number }) => {
      if (cropperTargetElementId) {
        await applyCroppedImageToElement(cropperTargetElementId, cropResult);
        setRasterNonce((value) => value + 1);
        showToast(t('editor.cropper.cropApplied'), 'success');
      }
      setCropperOpen(false);
      setCropperImageSrc(null);
      setCropperTargetElementId(null);
    },
    [cropperTargetElementId, t],
  );

  const isEmpty = elements.length === 0;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-app">
      <EditorHeader
        projectName={projectName}
        dirty={dirty}
        saveStatus={saveStatus}
        canUndo={canUndo}
        canRedo={canRedo}
        exporting={exporting}
        onBack={() => void handleBack()}
        onRename={openRename}
        onUndo={undo}
        onRedo={redo}
        onSave={() => void save()}
        onExport={() => setExportOpen(true)}
      />

      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2">
        <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-1 py-0.5">
          <IconButton label={t('editor.toolbar.zoomOut')} size="sm" onClick={() => zoomBy(1 / 1.25)}>
            <Minus className="size-4" aria-hidden />
          </IconButton>
          <span className="min-w-[46px] text-center text-[12px] font-medium tabular-nums text-ink-soft">
            {Math.round(viewport.zoom * 100)}%
          </span>
          <IconButton label={t('editor.toolbar.zoomIn')} size="sm" onClick={() => zoomBy(1.25)}>
            <Plus className="size-4" aria-hidden />
          </IconButton>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setLayersOpen(true)}
            icon={<Layers className="size-4" aria-hidden />}
          >
            {t('editor.toolbar.layers')}
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setPropertiesOpen(true)}
            icon={<Boxes className="size-4" aria-hidden />}
          >
            {t('editor.toolbar.adjustments')}
          </Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col p-3">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-ink-muted">
            {t('editor.preparing')}
          </div>
        ) : (
          <EditorCanvas rasterNonce={rasterNonce} />
        )}

        {!loading && isEmpty && activeTool !== 'text' ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
            <div className="pointer-events-auto flex max-w-[280px] flex-col items-center gap-3 rounded-[18px] border border-line bg-surface/95 px-5 py-6 text-center backdrop-blur">
              <p className="text-[13px] leading-relaxed text-ink-soft">
                {t('editor.emptyPrompt')}
              </p>
              <div className="flex w-full flex-col gap-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => void handleImport()}
                  icon={<ImagePlus className="size-4" aria-hidden />}
                >
                  {t('home.importImage')}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={handleAddText}
                  icon={<Type className="size-4" aria-hidden />}
                >
                  {t('editor.tools.text')}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <EditorToolbar
        activeTool={activeTool}
        brushSize={brushSize}
        brushColor={brushColor}
        maskBrushSize={maskBrushSize}
        hasSelection={selectedElement !== null}
        hasImageSelection={selectedElement?.kind === 'image'}
        hasDrawing={hasDrawing}
        onSelectTool={setTool}
        onBrushSizeChange={setBrushSize}
        onBrushColorChange={setBrushColor}
        onMaskBrushSizeChange={setMaskBrushSize}
        onImportImage={() => void handleImport()}
        onOpenCropper={() => {
          if (selectedElement?.kind === 'image') {
            void handleOpenCropper(selectedElement);
          }
        }}
        onOpenProperties={() => setPropertiesOpen(true)}
        onOpenLayers={() => setLayersOpen(true)}
        onClearDrawing={clearDrawingLayer}
        onUndoStroke={undoLastDrawingStroke}
        onDuplicateSelected={handleDuplicate}
        onDeleteSelected={handleDeleteSelected}
      />

      <BottomSheet open={layersOpen} title={t('editor.layersPanel.title')} onClose={() => setLayersOpen(false)}>
        <EditorLayersPanel />
      </BottomSheet>

      <BottomSheet
        open={propertiesOpen}
        title={selectedElement ? t('editor.properties.elementTitle') : t('editor.properties.title')}
        onClose={() => setPropertiesOpen(false)}
      >
        <EditorPropertiesPanel
          onAddText={handleAddText}
          onImportImage={() => void handleImport()}
          onOpenCropper={(el) => void handleOpenCropper(el)}
        />
      </BottomSheet>

      <EditorExportSheet open={exportOpen} onClose={() => setExportOpen(false)} />

      <ImageCropperModal
        open={cropperOpen}
        imageSrc={cropperImageSrc}
        onCropComplete={handleCropperConfirm}
        onClose={() => {
          setCropperOpen(false);
          setCropperImageSrc(null);
          setCropperTargetElementId(null);
        }}
      />

      <Modal
        open={renaming}
        title={t('editor.renameModal.title')}
        description={t('editor.renameModal.description')}
        onClose={() => setRenaming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={handleRename}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <TextInput
          label={t('packDetail.packNameLabel')}
          name="project-name"
          value={renameValue}
          maxLength={60}
          autoComplete="off"
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleRename();
          }}
        />
      </Modal>
    </div>
  );
}
