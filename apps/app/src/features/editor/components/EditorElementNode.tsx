import { useMemo } from 'react';
import { Circle, Image as KonvaImage, Line, Rect } from 'react-konva';
import { EDITOR_CONFIG } from '@/config/editor';
import { elementCenter } from '@/domain/editor/geometry';
import {
  type DrawingStroke,
  type EditorElement,
  type TransformableElement,
} from '@/domain/editor/elements';
import type { RasterEntry } from '@/services/imaging/rasterCache';
import { degToRad, clamp } from '@/shared/utils/math';
import { getEditorRasters, useEditorStore } from '@/features/editor/store/editorStore';
import { updateTextElement } from '@/features/editor/store/editorInteractions';

const CANVAS = EDITOR_CONFIG.canvasSize;
const ERASE_HINT_COLOR = 'rgba(255, 120, 120, 0.55)';

export interface EditorElementNodeProps {
  element: EditorElement;
  assetsRevision: number;
  selected: boolean;
  interactive: boolean;
  showMaskHint: boolean;
  registerNode: (id: string, node: import('konva/lib/Node').Node | null) => void;
  onSelect: (id: string) => void;
  onDragMove?: (element: TransformableElement, node: import('konva/lib/Node').Node) => void;
  onDragEnd?: (element: TransformableElement, node: import('konva/lib/Node').Node) => void;
}

export function EditorElementNode({
  element,
  assetsRevision,
  selected,
  interactive,
  showMaskHint,
  registerNode,
  onSelect,
  onDragMove,
  onDragEnd,
}: EditorElementNodeProps) {
  const rasters = getEditorRasters();
  const raster: RasterEntry | null = useMemo(() => {
    void assetsRevision;
    if (element.kind === 'image') return rasters.getImageRaster(element);
    if (element.kind === 'text') return rasters.getTextRaster(element);
    return rasters.getDrawingRaster(element);
  }, [element, rasters, assetsRevision]);

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
        draggable={interactive && !element.locked}
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
        onDragMove={(event) => {
          onDragMove?.(element, event.target);
        }}
        onDragEnd={(event) => {
          const node = event.target;
          if (onDragEnd) {
            onDragEnd(element, node);
          } else {
            node.scaleX(1);
            node.scaleY(1);
            useEditorStore.getState().updateElement(element.id, {
              x: node.x() - element.width / 2,
              y: node.y() - element.height / 2,
            });
          }
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

export function MaskHintLayer({
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

export function ActiveStrokeLayer({ stroke }: { stroke: DrawingStroke }) {
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
