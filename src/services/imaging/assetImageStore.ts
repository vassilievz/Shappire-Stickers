import { toAppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';
import { disposeCanvas } from './canvas';

const log = createLogger('asset-store');

export type AssetLoader = (assetPath: string) => Promise<HTMLCanvasElement>;


export class AssetImageStore {
  private readonly images = new Map<string, HTMLCanvasElement>();

  private readonly pending = new Map<string, Promise<HTMLCanvasElement>>();

  get(assetPath: string): HTMLCanvasElement | undefined {
    return this.images.get(assetPath);
  }

  has(assetPath: string): boolean {
    return this.images.has(assetPath);
  }

  set(assetPath: string, canvas: HTMLCanvasElement): void {
    const existing = this.images.get(assetPath);
    if (existing) disposeCanvas(existing);
    this.images.set(assetPath, canvas);
  }

  
  async ensure(assetPath: string, loader: AssetLoader): Promise<HTMLCanvasElement> {
    const cached = this.images.get(assetPath);
    if (cached) return cached;
    const inFlight = this.pending.get(assetPath);
    if (inFlight) return inFlight;

    const promise = loader(assetPath)
      .then((canvas) => {
        this.images.set(assetPath, canvas);
        return canvas;
      })
      .catch((error: unknown) => {
        log.warn(`Falha ao carregar asset ${assetPath}`, error);
        throw toAppError(error, 'STORAGE_READ_FAILED');
      })
      .finally(() => {
        this.pending.delete(assetPath);
      });

    this.pending.set(assetPath, promise);
    return promise;
  }

  remove(assetPath: string): void {
    const canvas = this.images.get(assetPath);
    if (canvas) disposeCanvas(canvas);
    this.images.delete(assetPath);
  }

  clear(): void {
    for (const canvas of this.images.values()) disposeCanvas(canvas);
    this.images.clear();
    this.pending.clear();
  }

  size(): number {
    return this.images.size;
  }
}
