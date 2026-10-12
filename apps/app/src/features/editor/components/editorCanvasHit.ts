import { elementCenter } from '@/domain/editor/geometry';
import type { TransformableElement } from '@/domain/editor/elements';
import { degToRad } from '@/shared/utils/math';

export interface WorldPoint {
  x: number;
  y: number;
}

export function hitTransformableElement(element: TransformableElement, point: WorldPoint): boolean {
  const center = elementCenter(element);
  const radians = degToRad(-element.rotation);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const localX = dx * Math.cos(radians) - dy * Math.sin(radians);
  const localY = dx * Math.sin(radians) + dy * Math.cos(radians);
  return Math.abs(localX) <= element.width / 2 && Math.abs(localY) <= element.height / 2;
}
