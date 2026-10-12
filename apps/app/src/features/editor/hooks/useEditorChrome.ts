import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/features/editor/store/editorStore';

export function useEditorChrome() {
  const state = useEditorStore(
    useShallow((s) => ({
      history: s.history,
      selectedIds: s.selectedIds,
      activeTool: s.activeTool,
      brushSize: s.brushSize,
      brushColor: s.brushColor,
      maskBrushSize: s.maskBrushSize,
      viewport: s.viewport,
      projectName: s.projectName,
      dirty: s.dirty,
      saveStatus: s.saveStatus,
      exporting: s.exporting,
      setViewport: s.setViewport,
      setTool: s.setTool,
      setBrushSize: s.setBrushSize,
      setBrushColor: s.setBrushColor,
      setMaskBrushSize: s.setMaskBrushSize,
      setProjectName: s.setProjectName,
      undo: s.undo,
      redo: s.redo,
      duplicateSelected: s.duplicateSelected,
      removeElements: s.removeElements,
    })),
  );

  const elements = state.history.present;
  const canUndo = state.history.past.length > 0;
  const canRedo = state.history.future.length > 0;
  const hasDrawing = elements.some(
    (element) => element.kind === 'drawing' && element.strokes.length > 0,
  );
  const selectedElement = useMemo(
    () => elements.find((element) => element.id === state.selectedIds[0]) ?? null,
    [elements, state.selectedIds],
  );

  return {
    ...state,
    elements,
    canUndo,
    canRedo,
    hasDrawing,
    selectedElement,
  };
}
