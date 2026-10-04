import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Transformer,
} from 'react-konva';
import { EDITOR_CONFIG } from '@/config/editor';
import { elementCenter } from '@/domain/editor/geometry';
import {
  isTransformable,
  type DrawingStroke,
  type EditorElement,
  type ImageElement,
  type TransformableElement,
} from '@/domain/editor/elements';
import type { RasterEntry } from '@/services/imaging/rasterCache';
import { clamp, degToRad } from '@/shared/utils/math';
import { getEditorRasters, useEditorStore } from '@/features/editor/store/editorStore';
import {
  beginDrawingStroke,
  beginMaskStroke,
  endDrawingStroke,
  endMaskStroke,
  extendDrawingStroke,
  extendMaskStroke,
  resolveMaskTargetId,
  updateTextElement,
} from '@/features/editor/store/editorInteractions';

const CANVAS = EDITOR_CONFIG.canvasSize;
const ERASE_HINT_COLOR = 'rgba(255, 120, 120, 0.55)';

interface WorldPoint {
  x: number;
  y: number;
}

export interface EditorCanvasProps {
  rasterNonce: number;
}

export function EditorCanvas({ rasterNonce }: EditorCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const groupRef = useRef<Konva.Group | null>(null);
  const layerRef = useRef<Konva.Layer | null>(null);
  const trRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef(new Map<string, Konva.Node>());
  const fitRef = useRef<{ projectId: string | null; size: number }>({ projectId: null, size: 0 });
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);

  const [size, setSize] = useState(0);

  const elements = useEditorStore((state) => state.history.present);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const activeTool = useEditorStore((state) => state.activeTool);
  const viewport = useEditorStore((state) => state.viewport);
  const activeStroke = useEditorStore((state) => state.activeStroke);
  const activeMask = useEditorStore((state) => state.activeMask);
  const setViewport = useEditorStore((state) => state.setViewport);
  const projectId = useEditorStore((state) => state.projectId);

  const rasters = getEditorRasters();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const rect = container.getBoundingClientRect();
      setSize(Math.max(0, Math.min(rect.width, rect.height)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  useEffect(() => {
    if (size <= 0) return;
    if (fitRef.current.projectId === projectId && fitRef.current.size === size) return;
    const zoom = clamp((size * 0.88) / CANVAS, EDITOR_CONFIG.minZoom, EDITOR_CONFIG.maxZoom);
    fitRef.current = { projectId, size };
    setViewport({
      zoom,
      offsetX: (size - CANVAS * zoom) / 2,
      offsetY: (size - CANVAS * zoom) / 2,
    });
  }, [size, projectId, setViewport]);

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
  }, [selectedIds, activeTool, elements, rasterNonce]);

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
        (element) => isTransformable(element) && element.visible && hitElement(element, world),
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 2) return;
      const distance = touchDistance(event.touches);
      pinchRef.current = { distance, zoom: useEditorStore.getState().viewport.zoom };
    };

    const onTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length !== 2) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const distance = touchDistance(event.touches);
      const ratio = distance / Math.max(1, pinch.distance);
      const current = useEditorStore.getState().viewport;
      const zoom = clamp(
        pinch.zoom * ratio,
        EDITOR_CONFIG.minZoom,
        EDITOR_CONFIG.maxZoom,
      );
      const mid = touchMidpoint(event.touches, rect);
      const worldX = (mid.x - current.offsetX) / current.zoom;
      const worldY = (mid.y - current.offsetY) / current.zoom;
      useEditorStore.getState().setViewport({
        zoom,
        offsetX: mid.x - worldX * zoom,
        offsetY: mid.y - worldY * zoom,
      });
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
    };
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

              {elements.map((element) => (
                <ElementNode
                  key={element.id}
                  element={element}
                  rasters={rasters}
                  rasterNonce={rasterNonce}
                  selected={selectedSet.has(element.id)}
                  interactive={interactive}
                  showMaskHint={activeTool === 'mask' || activeTool === 'restore'}
                  registerNode={registerNode}
                  onSelect={(id) => {
                    if (activeTool === 'select') useEditorStore.getState().selectOnly(id);
                  }}
                />
              ))}

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

interface ElementNodeProps {
  element: EditorElement;
  rasters: ReturnType<typeof getEditorRasters>;
  rasterNonce: number;
  selected: boolean;
  interactive: boolean;
  showMaskHint: boolean;
  registerNode: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string) => void;
}

function ElementNode({
  element,
  rasters,
  rasterNonce,
  selected,
  interactive,
  showMaskHint,
  registerNode,
  onSelect,
}: ElementNodeProps) {
  const raster: RasterEntry | null = useMemo(() => {
    void rasterNonce;
    if (element.kind === 'image') return rasters.getImageRaster(element);
    if (element.kind === 'text') return rasters.getTextRaster(element);
    return rasters.getDrawingRaster(element);
  }, [element, rasters, rasterNonce]);

  if (!element.visible || !raster) return null;

  if (element.kind === 'drawing') {
    return (
      <KonvaImage
        ref={(node) => registerNode(element.id, node)}
        id={element.id}
        image={raster.canvas}
        x={0}
        y={0}
        width={CANVAS}
        height={CANVAS}
        listening={false}
      />
    );
  }

  const center = elementCenter(element);
  const maskActive = showMaskHint && element.kind === 'image' && selected;

  return (
    <>
      {maskActive ? (
        <Rect
          x={center.x}
          y={center.y}
          offsetX={element.width / 2}
          offsetY={element.height / 2}
          width={element.width}
          height={element.height}
          rotation={element.rotation}
          listening={false}
          stroke="rgba(92,124,250,0.85)"
          dash={[10, 6]}
          strokeWidth={2}
        />
      ) : null}
      <KonvaImage
        ref={(node) => registerNode(element.id, node)}
        id={element.id}
        name="editor-element"
        image={raster.canvas}
        x={center.x}
        y={center.y}
        offsetX={element.width / 2}
        offsetY={element.height / 2}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        opacity={element.opacity}
        listening={interactive && !element.locked}
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
        onDragEnd={(event) => {
          const node = event.target;
          node.scaleX(1);
          node.scaleY(1);
          useEditorStore.getState().updateElement(element.id, {
            x: node.x() - element.width / 2,
            y: node.y() - element.height / 2,
          });
        }}
        onTransformEnd={(event) => {
          const node = event.target;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);

          if (element.kind === 'text') {
            const scale = (scaleX + scaleY) / 2;
            const fontSize = clamp(element.fontSize * scale, 12, 240);
            updateTextElement(element.id, { fontSize, rotation: node.rotation() });
            return;
          }

          const width = Math.max(16, Math.round(element.width * scaleX));
          const height = Math.max(16, Math.round(element.height * scaleY));
          useEditorStore.getState().updateElement(element.id, {
            width,
            height,
            rotation: node.rotation(),
            x: node.x() - width / 2,
            y: node.y() - height / 2,
          });
        }}
      />
    </>
  );
}

function MaskHintLayer({
  elements,
  points,
}: {
  elements: readonly EditorElement[];
  points: number[];
}) {
  const mask = useEditorStore((state) => state.activeMask);
  const brushSize = useEditorStore((state) => state.maskBrushSize);
  const target = mask ? elements.find((element) => element.id === mask.targetId) : undefined;

  const worldPoints = useMemo(() => {
    if (!target || target.kind !== 'image') return points;
    const center = elementCenter(target);
    const radians = degToRad(target.rotation);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const out: number[] = [];
    for (let index = 0; index + 1 < points.length; index += 2) {
      const localX = points[index];
      const localY = points[index + 1];
      if (localX === undefined || localY === undefined) break;
      const dx = localX - target.width / 2;
      const dy = localY - target.height / 2;
      out.push(center.x + dx * cos - dy * sin, center.y + dx * sin + dy * cos);
    }
    return out;
  }, [points, target]);

  if (worldPoints.length < 2) return null;
  return (
    <Line
      points={worldPoints}
      stroke={mask?.mode === 'restore' ? 'rgba(99, 217, 138, 0.6)' : ERASE_HINT_COLOR}
      strokeWidth={brushSize}
      lineCap="round"
      lineJoin="round"
      listening={false}
      opacity={0.7}
    />
  );
}

function ActiveStrokeLayer({ stroke }: { stroke: DrawingStroke }) {
  const color = stroke.mode === 'erase' ? ERASE_HINT_COLOR : stroke.color;
  if (stroke.points.length === 2) {
    const x = stroke.points[0];
    const y = stroke.points[1];
    if (x === undefined || y === undefined) return null;
    return <Circle x={x} y={y} radius={stroke.width / 2} fill={color} listening={false} />;
  }
  return (
    <Line
      points={stroke.points}
      stroke={color}
      strokeWidth={stroke.width}
      lineCap="round"
      lineJoin="round"
      listening={false}
    />
  );
}

function hitElement(element: TransformableElement, point: WorldPoint): boolean {
  const center = elementCenter(element);
  const radians = degToRad(-element.rotation);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= element.width / 2 && Math.abs(localY) <= element.height / 2;
}

function touchDistance(touches: TouchList): number {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function touchMidpoint(touches: TouchList, rect: DOMRect): WorldPoint {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return { x: 0, y: 0 };
  return {
    x: (first.clientX + second.clientX) / 2 - rect.left,
    y: (first.clientY + second.clientY) / 2 - rect.top,
  };
}
