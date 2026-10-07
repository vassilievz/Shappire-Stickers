import { APP_LIMITS } from '@/config/app';
import { EDITOR_CONFIG } from '@/config/editor';
import type { StickerProject } from '@/domain/project';
import type { EditorElement, ImageElement } from '@/domain/editor/elements';
import { dataUrlToBase64 } from '@/services/imaging/canvas';
import { createBrowserImageEncoder } from '@/services/imaging/encoder';
import {
  exportStickerArtwork,
  renderStickerThumbnailDataUrl,
} from '@/services/imaging/exportSticker';
import { decodeImageFromDataUrl } from '@/services/imaging/imageLoader';
import { pickImagesFromGallery, type PickedImage } from '@/services/native/imagePicker';
import { addStickerToPack } from '@/services/packs/packService';
import { measure } from '@/services/diagnostics/perf';
import { createLogger } from '@/services/logging/logger';
import {
  loadProject,
  readAssetDataUrlByPath,
  saveProject,
  writeProjectAsset,
} from '@/services/storage/projectRepository';
import { friendlyMessage, toAppError } from '@/shared/errors';
import { createId } from '@/shared/utils/id';
import { useLibraryStore } from '@/state/libraryStore';
import { showToast } from '@/state/toastStore';
import { t } from '@/i18n';
import { getEditorAssets, getEditorRasters, useEditorStore } from './editorStore';

const log = createLogger('editor-actions');


export function currentProjectDocument(): StickerProject | null {
  const state = useEditorStore.getState();
  if (!state.projectId) return null;
  return {
    id: state.projectId,
    name: state.projectName,
    createdAt: state.createdAt,
    updatedAt: new Date().toISOString(),
    canvas: { width: EDITOR_CONFIG.canvasSize, height: EDITOR_CONFIG.canvasSize },
    elements: state.history.present,
    thumbnail: state.thumbnail,
    packId: state.packId,
  };
}


export async function openProjectById(projectId: string): Promise<boolean> {
  const project = await loadProject(projectId);
  if (!project) {
    showToast('Não foi possível encontrar este projeto.', 'error');
    return false;
  }
  const store = useEditorStore.getState();
  store.hydrateProject(project);
  try {
    await ensureAssetsLoaded(project.elements);
  } catch (error) {
    log.warn('Falha ao carregar imagens do projeto', error);
    showToast('Algumas imagens não puderam ser carregadas.', 'warning');
  }
  return true;
}


export async function saveCurrentProject(
  options: { silent?: boolean } = {},
): Promise<StickerProject | null> {
  const store = useEditorStore.getState();
  const project = currentProjectDocument();
  if (!project) return null;

  store.setSaveStatus('saving');
  try {
    if (project.elements.length > 0) {
      const thumbnail = await measure(
        'save.thumbnail',
        () =>
          renderStickerThumbnailDataUrl(
            { elements: project.elements, resources: getEditorRasters() },
            APP_LIMITS.projectThumbnailSize,
          ),
        { elements: project.elements.length },
      );
      project.thumbnail = thumbnail;
      store.setThumbnail(thumbnail);
    }
    await measure('save.document', () => saveProject(project), {
      elements: project.elements.length,
    });
    store.markSaved();
    if (!options.silent) showToast(t('editor.header.saved'), 'success');
    await useLibraryStore.getState().refreshProjects();
    return project;
  } catch (error) {
    log.warn('Falha ao salvar projeto', error);
    store.setSaveStatus('error');
    showToast(friendlyMessage(error), 'error');
    return null;
  }
}

function extensionFromMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  return 'png';
}


export async function importImagesToCanvas(maxImages = 4): Promise<number> {
  const store = useEditorStore.getState();
  if (!store.projectId) {
    store.openNewProject();
  }
  const projectId = useEditorStore.getState().projectId;
  if (!projectId) return 0;

  let picked: PickedImage[];
  try {
    picked = await pickImagesFromGallery({ maxImages });
  } catch (error) {
    const appError = toAppError(error);
    if (appError.code !== 'CANCELLED') showToast(friendlyMessage(appError), 'error');
    return 0;
  }

  const assets = getEditorAssets();
  const encoder = createBrowserImageEncoder();
  let added = 0;

  for (const image of picked) {
    try {
      if (image.isAnimated) {
        showToast(
          'GIF animado detectado. Ele vira figurinha animada quando adicionado diretamente a um pacote.',
          'info',
        );
        continue;
      }
      const decoded = await measure('import.decode', () => decodeImageFromDataUrl(image.dataUrl));
      let base64 = dataUrlToBase64(image.dataUrl);
      let extension = extensionFromMime(image.mimeType);
      if (decoded.resized) {
        const png = await measure('import.encode', () => encoder.encode(decoded.canvas, 'image/png', 1));
        base64 = png.base64;
        extension = 'png';
      }
      const fileName = `${createId('asset')}.${extension}`;
      const assetPath = await writeProjectAsset(projectId, fileName, base64);
      assets.set(assetPath, decoded.canvas);
      useEditorStore.getState().addImage({
        assetPath,
        naturalWidth: decoded.originalWidth,
        naturalHeight: decoded.originalHeight,
        name: image.fileName,
      });
      added += 1;
      if (image.resized) {
        showToast('A imagem foi reduzida para caber na memória do aparelho.', 'info');
      }
    } catch (error) {
      log.warn('Falha ao importar imagem', error);
      showToast(friendlyMessage(error), 'error');
    }
  }

  if (added > 0) {
    useEditorStore.getState().setTool('select');
    await saveCurrentProject({ silent: true });
  }
  return added;
}


export async function ensureAssetsLoaded(elements: readonly EditorElement[]): Promise<void> {
  const assets = getEditorAssets();
  const imagePaths = elements
    .filter((element): element is ImageElement => element.kind === 'image')
    .map((element) => element.assetPath);

  await Promise.all(
    imagePaths.map((path) =>
      assets.ensure(path, async (assetPath) => {
        const dataUrl = await readAssetDataUrlByPath(assetPath);
        const decoded = await decodeImageFromDataUrl(dataUrl);
        return decoded.canvas;
      }),
    ),
  );
}

export interface StickerExportResult {
  packId: string;
  packName: string;
  fileName: string;
  sizeBytes: number;
  quality: number;
  warnings: string[];
}


export async function exportStickerToPack(
  packId: string,
  meta: {
    emojis?: string[];
    accessibilityText?: string;
  } = {},
): Promise<StickerExportResult> {
  const store = useEditorStore.getState();
  const elements = store.history.present;
  store.setExporting(true);
  try {
    const artwork = await measure(
      'export.artwork',
      () =>
        exportStickerArtwork(
          {
            elements,
            resources: getEditorRasters(),
          },
          {},
        ),
      { elements: elements.length },
    );
    const { pack, sticker } = await addStickerToPack({
      packId,
      artwork,
      emojis: meta.emojis,
      accessibilityText: meta.accessibilityText,
      projectId: store.projectId,
      hasDrawing: elements.some(
        (element) => element.kind === 'drawing' && element.strokes.length > 0,
      ),
    });
    store.setPackId(pack.id);
    await saveCurrentProject({ silent: true });
    showToast(
      t('editor.export.success', {
        name: pack.name,
        size: Math.ceil(sticker.sizeBytes / 1024),
      }),
      'success',
    );
    return {
      packId: pack.id,
      packName: pack.name,
      fileName: sticker.fileName,
      sizeBytes: sticker.sizeBytes,
      quality: artwork.quality,
      warnings: artwork.warnings,
    };
  } catch (error) {
    const appError = toAppError(error);
    log.warn('Falha na exportação', appError);
    showToast(friendlyMessage(appError), 'error');
    throw appError;
  } finally {
    useEditorStore.getState().setExporting(false);
  }
}


export async function applyCroppedImageToElement(
  elementId: string,
  cropResult: { dataUrl: string; width: number; height: number },
): Promise<void> {
  const store = useEditorStore.getState();
  const projectId = store.projectId;
  if (!projectId) return;

  const base64 = dataUrlToBase64(cropResult.dataUrl);
  const fileName = `${createId('cropped')}.png`;
  const assetPath = await writeProjectAsset(projectId, fileName, base64);

  const decoded = await decodeImageFromDataUrl(cropResult.dataUrl);
  getEditorAssets().set(assetPath, decoded.canvas);

  store.updateElement(elementId, {
    assetPath,
    naturalWidth: cropResult.width,
    naturalHeight: cropResult.height,
  });
  await saveCurrentProject({ silent: true });
}


export function releaseEditorResources(): void {
  getEditorAssets().clear();
  getEditorRasters().clear();
}

export async function addImageFromDataUrlToCanvas(
  dataUrl: string,
  name = 'Elemento',
): Promise<boolean> {
  const store = useEditorStore.getState();
  const projectId = store.projectId;
  if (!projectId) return false;

  const assets = getEditorAssets();
  const decoded = await decodeImageFromDataUrl(dataUrl);
  const base64 = dataUrlToBase64(dataUrl);
  const fileName = `${createId('asset')}.png`;
  const assetPath = await writeProjectAsset(projectId, fileName, base64);
  assets.set(assetPath, decoded.canvas);
  store.addImage({
    assetPath,
    naturalWidth: decoded.originalWidth,
    naturalHeight: decoded.originalHeight,
    name,
  });
  store.setTool('select');
  await saveCurrentProject({ silent: true });
  return true;
}

