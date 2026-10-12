import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Group, Layer, Line, Rect, Stage, Transformer } from 'react-konva';
import { EDITOR_CONFIG } from '@/config/editor';
import { calculateCenterSnap, elementCenter } from '@/domain/editor/geometry';
import { isTransformable, type ImageElement } from '@/domain/editor/elements';
import { clamp, degToRad } from '@/shared/utils/math';
import { useEditorStageSize } from '@/features/editor/hooks/useEditorStageSize';
import { useEditorPinchZoom } from '@/features/editor/hooks/useEditorPinchZoom';
import {
  ActiveStrokeLayer,
  EditorElementNode,
  MaskHintLayer,
} from '@/features/editor/components/EditorElementNode';
import { hitTransformableElement, type WorldPoint } from '@/features/editor/components/editorCanvasHit';
import { hapticSelection } from '@/services/native/haptics';
import { useEditorStore } from '@/features/editor/store/editorStore';
import {
  beginDrawingStroke,
  beginMaskStroke,
  endDrawingStroke,
  endMaskStroke,
  extendDrawingStroke,
  extendMaskStroke,
  resolveMaskTargetId,
} from '@/features/editor/store/editorInteractions';

const CANVAS = EDITOR_CONFIG.canvasSize;

export interface EditorCanvasProps {
  showSafeArea?: boolean;
}

export function EditorCanvas({ showSafeArea = false }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const groupRef = useRef<Konva.Group | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const [activeSnapLines, setActiveSnapLines] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const snappedRef = useRef<{ x: boolean; y: boolean }>({ x: false, y: false });

  const elements = useEditorStore((state) => state.history.present);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const activeTool = useEditorStore((state) => state.activeTool);
  const viewport = useEditorStore((state) => state.viewport);
  const activeStroke = useEditorStore((state) => state.activeStroke);
  const activeMask = useEditorStore((state) => state.activeMask);
  const assetsRevision = useEditorStore((state) => state.assetsRevision);

  const size = useEditorStageSize(containerRef);
  useEditorPinchZoom(containerRef);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const maskTargetId = useMemo(() => {
    if (activeTool !== 'mask' && activeTool !== 'restore') return null;
    return resolveMaskTargetId(elements);
  }, [activeTool, elements]);

  const screenToWorld = useCallback(
    (point: WorldPoint | null): WorldPoint | null => {
      if (!point) return null;
      return {
        x: (point.x - viewport.offsetX) / viewport.zoom,
        y: (point.y - viewport.offsetY) / viewport.zoom,
      };
    },
    [viewport],
  );

  const pointerWorld = useCallback((): WorldPoint | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    return screenToWorld(stage.getPointerPosition());
  }, [screenToWorld]);

  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    if (activeTool !== 'select') {
      tr.nodes([]);
      return;
    }
    const nodes = selectedIds
      .map((id) => nodeRefs.current.get(id))
      .filter((node): node is Konva.Node => node !== undefined);
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, activeTool, elements, assetsRevision]);

  const worldToElementLocal = useCallback((element: ImageElement, world: WorldPoint): WorldPoint => {
    const center = elementCenter(element);
    const radians = degToRad(-element.rotation);
    const dx = world.x - center.x;
    const dy = world.y - center.y;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
      x: dx * cos - dy * sin + element.width / 2,
      y: dx * sin + dy * cos + element.height / 2,
    };
  }, []);

  const handlePointerDown = useCallback(() => {
    const world = pointerWorld();
    if (!world) return;

    if (activeTool === 'text') {
      const store = useEditorStore.getState();
      store.addText('Nova frase', { x: world.x, y: world.y });
      store.setTool('select');
      return;
    }

    if (activeTool === 'draw' || activeTool === 'erase') {
      beginDrawingStroke([world.x, world.y], activeTool === 'erase' ? 'erase' : 'paint');
      return;
    }

    if ((activeTool === 'mask' || activeTool === 'restore') && maskTargetId) {
      const target = elements.find(
        (element): element is ImageElement => element.kind === 'image' && element.id === maskTargetId,
      );
      if (!target) return;
      beginMaskStroke(
        target.id,
        worldToElementLocal(target, world),
        activeTool === 'mask' ? 'erase' : 'restore',
      );
      return;
    }

    if (activeTool === 'select') {
      const clickedEmpty = !elements.some(
        (element) => isTransformable(element) && element.visible && hitTransformableElement(element, world),
      );
      if (clickedEmpty) useEditorStore.getState().clearSelection();
    }
  }, [activeTool, elements, maskTargetId, pointerWorld, worldToElementLocal]);

  const handlePointerMove = useCallback(() => {
    if (!activeStroke && !activeMask) return;
    const world = pointerWorld();
    if (!world) return;
    if (activeStroke) {
      extendDrawingStroke([world.x, world.y]);
      return;
    }
    const mask = useEditorStore.getState().activeMask;
    if (!mask) return;
    const target = elements.find(
      (element): element is ImageElement => element.kind === 'image' && element.id === mask.targetId,
    );
    if (!target) return;
    extendMaskStroke(worldToElementLocal(target, world));
  }, [activeStroke, activeMask, elements, pointerWorld, worldToElementLocal]);

  const handlePointerUp = useCallback(() => {
    if (useEditorStore.getState().activeStroke) endDrawingStroke();
    if (useEditorStore.getState().activeMask) endMaskStroke();
  }, []);

  const handleWheel = useCallback(
    (event: Konva.KonvaEventObject<WheelEvent>) => {
      event.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const current = useEditorStore.getState().viewport;
      const factor = event.evt.deltaY > 0 ? 0.92 : 1.08;
      const zoom = clamp(current.zoom * factor, EDITOR_CONFIG.minZoom, EDITOR_CONFIG.maxZoom);
      const worldX = (pointer.x - current.offsetX) / current.zoom;
      const worldY = (pointer.y - current.offsetY) / current.zoom;
      useEditorStore.getState().setViewport({
        zoom,
        offsetX: pointer.x - worldX * zoom,
        offsetY: pointer.y - worldY * zoom,
      });
    },
    [],
  );

  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  }, []);

  const interactive = activeTool === 'select';

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden rounded-[14px] border border-line bg-surface"
      style={{ touchAction: 'none' }}
    >
      {}
      {size > 0 ? (
        <div
          aria-hidden
          className="checkerboard pointer-events-none absolute"
          style={{
            left: viewport.offsetX,
            top: viewport.offsetY,
            width: CANVAS * viewport.zoom,
            height: CANVAS * viewport.zoom,
          }}
        />
      ) : null}

      {size > 0 ? (
        <Stage
          ref={stageRef}
          width={size}
          height={size}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
          style={{ touchAction: 'none' }}
        >
          <Layer ref={layerRef}>
            <Group
              ref={groupRef}
              x={viewport.offsetX}
              y={viewport.offsetY}
              scaleX={viewport.zoom}
              scaleY={viewport.zoom}
            >
              {}
              <Rect
                x={0}
                y={0}
                width={CANVAS}
                height={CANVAS}
                stroke="rgba(255,255,255,0.16)"
                strokeWidth={1 / viewport.zoom}
                listening={false}
              />

              {/* WhatsApp Safe Area overlay (16px inset boundary = 480x480 at 16,16) */}
              {showSafeArea ? (
                <Rect
                  x={16}
                  y={16}
                  width={CANVAS - 32}
                  height={CANVAS - 32}
                  stroke="#25D366"
                  strokeWidth={1.5 / viewport.zoom}
                  dash={[6 / viewport.zoom, 4 / viewport.zoom]}
                  listening={false}
                  opacity={0.85}
                />
              ) : null}

              {elements.map((element) => (
                <EditorElementNode
                  key={element.id}
                  element={element}
                  assetsRevision={assetsRevision}
                  selected={selectedSet.has(element.id)}
                  interactive={interactive}
                  showMaskHint={activeTool === 'mask' || activeTool === 'restore'}
                  registerNode={registerNode}
                  onSelect={(id) => {
                    if (activeTool === 'select') useEditorStore.getState().selectOnly(id);
                  }}
                  onDragMove={(el, node) => {
                    const snap = calculateCenterSnap(
                      node.x() - el.width / 2,
                      node.y() - el.height / 2,
                      el.width,
                      el.height,
                      CANVAS,
                      8,
                    );
                    if (snap.snapX) node.x(snap.x + el.width / 2);
                    if (snap.snapY) node.y(snap.y + el.height / 2);

                    const newlySnapped = (snap.snapX && !snappedRef.current.x) || (snap.snapY && !snappedRef.current.y);
                    if (newlySnapped) {
                      hapticSelection();
                    }
                    snappedRef.current = { x: snap.snapX, y: snap.snapY };
                    setActiveSnapLines({ x: snap.snapX, y: snap.snapY });
                  }}
                  onDragEnd={(el, node) => {
                    setActiveSnapLines({ x: false, y: false });
                    snappedRef.current = { x: false, y: false };
                    const snap = calculateCenterSnap(
                      node.x() - el.width / 2,
                      node.y() - el.height / 2,
                      el.width,
                      el.height,
                      CANVAS,
                      8,
                    );
                    node.scaleX(1);
                    node.scaleY(1);
                    useEditorStore.getState().updateElement(el.id, {
                      x: snap.x,
                      y: snap.y,
                    });
                  }}
                />
              ))}

              {/* Center Magnetic Snap Lines */}
              {activeSnapLines.x ? (
                <Line
                  points={[CANVAS / 2, 0, CANVAS / 2, CANVAS]}
                  stroke="#FF4B4B"
                  strokeWidth={1.5 / viewport.zoom}
                  dash={[4 / viewport.zoom, 4 / viewport.zoom]}
                  listening={false}
                />
              ) : null}
              {activeSnapLines.y ? (
                <Line
                  points={[0, CANVAS / 2, CANVAS, CANVAS / 2]}
                  stroke="#FF4B4B"
                  strokeWidth={1.5 / viewport.zoom}
                  dash={[4 / viewport.zoom, 4 / viewport.zoom]}
                  listening={false}
                />
              ) : null}

              {activeMask ? <MaskHintLayer elements={elements} points={activeMask.points} /> : null}

              {activeStroke ? (
                <ActiveStrokeLayer stroke={activeStroke} />
              ) : null}

              {interactive ? (
                <Transformer
                  ref={trRef}
                  rotateEnabled
                  keepRatio
                  borderStroke="#5c7cfa"
                  borderStrokeWidth={1.5 / viewport.zoom}
                  anchorStroke="#5c7cfa"
                  anchorFill="#0a0b0d"
                  anchorSize={9 / viewport.zoom}
                  rotateAnchorOffset={22 / viewport.zoom}
                  boundBoxFunc={(oldBox, newBox) =>
                    newBox.width < 16 || newBox.height < 16 ? oldBox : newBox
                  }
                />
              ) : null}
            </Group>
          </Layer>
        </Stage>
      ) : null}
    </div>
  );
}
