import { create } from 'zustand';
import { EDITOR_CONFIG, type EditorTool } from '@/config/editor';
import { nowIso } from '@/shared/utils/format';
import {
  createImageElement,
  createTextElement,
  type DrawingStroke,
  type EditorElement,
} from '@/domain/editor/elements';
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  replacePresent,
  undoHistory,
  type HistoryState,
} from '@/domain/editor/history';
import * as layers from '@/domain/editor/layers';
import { createProject, type StickerProject } from '@/domain/project';
import { AssetImageStore } from '@/services/imaging/assetImageStore';
import { EditorRasterCache } from '@/services/imaging/rasterCache';
import { centerInCanvas, fitInsideBox } from '@/domain/editor/geometry';


const assets = new AssetImageStore();
const rasters = new EditorRasterCache(assets);

export function getEditorAssets(): AssetImageStore {
  return assets;
}

export function getEditorRasters(): EditorRasterCache {
  return rasters;
}

export interface EditorViewport {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditorState {
  
  projectId: string | null;
  projectName: string;
  createdAt: string;
  packId: string | null;
  thumbnail: string | null;
  dirty: boolean;
  saveStatus: SaveStatus;
  
  history: HistoryState<EditorElement[]>;
  selectedIds: string[];
  activeTool: EditorTool;
  brushSize: number;
  brushColor: string;
  maskBrushSize: number;
  
  textEditingId: string | null;
  
  textEditBaseline: EditorElement[] | null;
  
  activeStroke: DrawingStroke | null;
  
  activeMask: { targetId: string; points: number[]; mode: 'erase' | 'restore' } | null;
  viewport: EditorViewport;
  exporting: boolean;
}

export type ElementMutation = (
  elements: readonly EditorElement[],
) => EditorElement[];

interface EditorActions {
  openNewProject: (name?: string) => void;
  hydrateProject: (project: StickerProject) => void;
  resetEditor: () => void;

  
  commit: (mutation: ElementMutation) => void;
  
  transient: (mutation: ElementMutation) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  select: (ids: readonly string[]) => void;
  selectOnly: (id: string) => void;
  clearSelection: () => void;

  setTool: (tool: EditorTool) => void;
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;
  setMaskBrushSize: (size: number) => void;
  setViewport: (viewport: Partial<EditorViewport>) => void;
  setTextEditingId: (id: string | null) => void;
  setActiveStroke: (stroke: DrawingStroke | null) => void;
  setActiveMask: (mask: EditorState['activeMask']) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setThumbnail: (thumbnail: string | null) => void;
  setProjectName: (name: string) => void;
  setExporting: (exporting: boolean) => void;
  setPackId: (packId: string | null) => void;
  markSaved: () => void;
  
  beginTextEdit: (id: string) => void;
  
  endTextEdit: () => void;

  
  addText: (text?: string, center?: { x: number; y: number }) => void;
  addImage: (input: {
    assetPath: string;
    naturalWidth: number;
    naturalHeight: number;
    name?: string;
  }) => void;
  updateElement: (id: string, patch: Partial<EditorElement>, options?: { transient?: boolean }) => void;
  removeElements: (ids: readonly string[]) => void;
  duplicateSelected: () => void;
  reorder: (id: string, direction: 'forward' | 'backward' | 'front' | 'back') => void;
  toggleVisibility: (id: string) => void;
  toggleLock: (id: string) => void;
}

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  projectId: null,
  projectName: 'Nova figurinha',
  createdAt: nowIso(),
  packId: null,
  thumbnail: null,
  dirty: false,
  saveStatus: 'idle',
  history: createHistory([]),
  selectedIds: [],
  activeTool: 'select',
  brushSize: 8,
  brushColor: '#FFFFFF',
  maskBrushSize: 34,
  textEditingId: null,
  textEditBaseline: null,
  activeStroke: null,
  activeMask: null,
  viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
  exporting: false,

  openNewProject: (name) => {
    const project = createProject(name ?? '');
    rasters.clear();
    set({
      projectId: project.id,
      projectName: project.name,
      createdAt: project.createdAt,
      packId: project.packId,
      thumbnail: null,
      dirty: false,
      saveStatus: 'idle',
      history: createHistory(project.elements),
      selectedIds: [],
      textEditingId: null,
      textEditBaseline: null,
      activeStroke: null,
      activeMask: null,
      activeTool: 'select',
      viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
    });
  },

  hydrateProject: (project) => {
    rasters.clear();
    set({
      projectId: project.id,
      projectName: project.name,
      createdAt: project.createdAt,
      packId: project.packId,
      thumbnail: project.thumbnail,
      dirty: false,
      saveStatus: 'idle',
      history: createHistory(project.elements),
      selectedIds: [],
      textEditingId: null,
      textEditBaseline: null,
      activeStroke: null,
      activeMask: null,
      activeTool: 'select',
      viewport: { zoom: 1, offsetX: 0, offsetY: 0 },
    });
  },

  resetEditor: () => {
    rasters.clear();
    assets.clear();
    set({
      projectId: null,
      projectName: 'Nova figurinha',
      createdAt: nowIso(),
      packId: null,
      thumbnail: null,
      dirty: false,
      saveStatus: 'idle',
      history: createHistory([]),
      selectedIds: [],
      textEditingId: null,
      textEditBaseline: null,
      activeStroke: null,
      activeMask: null,
      activeTool: 'select',
      exporting: false,
    });
  },

  commit: (mutation) =>
    set((state) => {
      const next = mutation(state.history.present);
      if (next === state.history.present) return state;
      return { history: pushHistory(state.history, next), dirty: true, saveStatus: 'idle' };
    }),

  transient: (mutation) =>
    set((state) => ({
      history: replacePresent(state.history, mutation(state.history.present)),
      dirty: true,
    })),

  undo: () =>
    set((state) => {
      if (!canUndo(state.history)) return state;
      const history = undoHistory(state.history);
      return {
        history,
        dirty: true,
        selectedIds: state.selectedIds.filter((id) =>
          history.present.some((element) => element.id === id),
        ),
      };
    }),

  redo: () =>
    set((state) => {
      if (!canRedo(state.history)) return state;
      const history = redoHistory(state.history);
      return {
        history,
        dirty: true,
        selectedIds: state.selectedIds.filter((id) =>
          history.present.some((element) => element.id === id),
        ),
      };
    }),

  canUndo: () => canUndo(get().history),
  canRedo: () => canRedo(get().history),

  select: (ids) => set({ selectedIds: [...ids] }),
  selectOnly: (id) => set({ selectedIds: [id] }),
  clearSelection: () => set({ selectedIds: [], textEditingId: null }),

  setTool: (tool) => set({ activeTool: tool, textEditingId: null }),
  setBrushSize: (size) => set({ brushSize: size }),
  setBrushColor: (color) => set({ brushColor: color }),
  setMaskBrushSize: (size) => set({ maskBrushSize: size }),
  setViewport: (viewport) => set((state) => ({ viewport: { ...state.viewport, ...viewport } })),
  setTextEditingId: (id) =>
    set({ textEditingId: id, selectedIds: id ? [id] : get().selectedIds }),
  setActiveStroke: (stroke) => set({ activeStroke: stroke }),
  setActiveMask: (mask) => set({ activeMask: mask }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setThumbnail: (thumbnail) => set({ thumbnail }),
  setProjectName: (name) => set({ projectName: name, dirty: true }),
  setExporting: (exporting) => set({ exporting }),
  setPackId: (packId) => set({ packId, dirty: true }),
  markSaved: () => set({ dirty: false, saveStatus: 'saved' }),

  beginTextEdit: (id) =>
    set((state) => ({
      textEditingId: id,
      selectedIds: [id],
      textEditBaseline: state.history.present,
    })),

  endTextEdit: () =>
    set((state) => {
      const baseline = state.textEditBaseline;
      const changed =
        baseline !== null &&
        JSON.stringify(baseline) !== JSON.stringify(state.history.present);
      if (changed && baseline !== null) {
        return {
          history: pushHistory(
            { ...state.history, present: baseline, future: [] },
            state.history.present,
          ),
          textEditingId: null,
          textEditBaseline: null,
          dirty: true,
        };
      }
      return { textEditingId: null, textEditBaseline: null };
    }),


  addText: (text = 'Nova frase', center) => {
    const base = createTextElement({ text, x: 0, y: 0, width: 320, height: 110, fontSize: 64 });
    const raster = rasters.getTextRaster(base);
    const width = raster?.width ?? base.width;
    const height = raster?.height ?? base.height;
    const position = center
      ? { x: Math.round(center.x - width / 2), y: Math.round(center.y - height / 2) }
      : centerInCanvas(width, height);
    const element = { ...base, x: position.x, y: position.y, width, height };
    get().commit((elements) => [...elements, element]);
    get().selectOnly(element.id);
    get().setTextEditingId(element.id);
  },

  addImage: (input) => {
    const fitted = fitInsideBox(
      input.naturalWidth,
      input.naturalHeight,
      EDITOR_CONFIG.canvasSize,
      0.9,
    );
    const position = centerInCanvas(fitted.width, fitted.height);
    const element = createImageElement({
      assetPath: input.assetPath,
      naturalWidth: input.naturalWidth,
      naturalHeight: input.naturalHeight,
      x: position.x,
      y: position.y,
      width: fitted.width,
      height: fitted.height,
      name: input.name,
    });
    get().commit((elements) => [...elements, element]);
    get().selectOnly(element.id);
  },

  updateElement: (id, patch, options) => {
    const mutation: ElementMutation = (elements) =>
      elements.map((element) =>
        element.id === id ? ({ ...element, ...patch } as EditorElement) : element,
      );
    if (options?.transient) get().transient(mutation);
    else get().commit(mutation);
  },

  removeElements: (ids) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    get().commit((elements) => elements.filter((element) => !idSet.has(element.id)));
    get().clearSelection();
  },

  duplicateSelected: () => {
    const id = get().selectedIds[0];
    if (!id) return;
    get().commit((elements) => layers.duplicateElement(elements, id).elements);
  },

  reorder: (id, direction) => {
    const mutation: ElementMutation = (elements) => {
      switch (direction) {
        case 'forward':
          return layers.bringForward(elements, id);
        case 'backward':
          return layers.sendBackward(elements, id);
        case 'front':
          return layers.bringToFront(elements, id);
        case 'back':
          return layers.sendToBack(elements, id);
      }
    };
    get().commit(mutation);
  },

  toggleVisibility: (id) => get().commit((elements) => layers.toggleVisibility(elements, id)),

  toggleLock: (id) => get().commit((elements) => layers.toggleLock(elements, id)),
}));
