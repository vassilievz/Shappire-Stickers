import { describe, expect, it, beforeEach } from 'vitest';
import {
  AI_MODELS_CATALOG,
  getModelById,
  getDefaultModelId,
} from '@/domain/ai/modelCatalog';
import {
  ModelManagerService,
  calculateBufferSha256,
  base64ToUint8Array,
} from '@/domain/ai/modelManager';
import {
  imageToRgbTensorData,
  rgbTensorDataToImageData,
} from '@/domain/ai/imageEnhancementService';
import { createMemoryFileSystemGateway } from '@/services/storage/memoryFileSystem';
import { setFileSystemGateway } from '@/services/storage/gateway';

describe('AI Image Enhancement Feature', () => {
  beforeEach(() => {
    setFileSystemGateway(createMemoryFileSystemGateway());
  });

  describe('Model Catalog', () => {
    it('contains at least two licensed and real models', () => {
      expect(AI_MODELS_CATALOG.length).toBeGreaterThanOrEqual(2);
    });

    it('defines valid models with HTTPS urls and SHA-256 hashes', () => {
      for (const model of AI_MODELS_CATALOG) {
        expect(model.id).toBeTruthy();
        expect(model.name).toBeTruthy();
        expect(model.downloadUrl).toMatch(/^https:\/\//);
        expect(model.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(model.scale).toBeGreaterThanOrEqual(2);
        expect(model.license).toBeTruthy();
        expect(model.inputNodeName).toBeTruthy();
        expect(model.outputNodeName).toBeTruthy();
      }
    });

    it('retrieves model by ID', () => {
      const anime = getModelById('realesr-anime-v3-4x');
      expect(anime).toBeDefined();
      expect(anime?.recommendedFor).toBe('anime_illustration');

      const photo = getModelById('clear-reality-span-4x');
      expect(photo).toBeDefined();
      expect(photo?.recommendedFor).toBe('photo_realistic');
    });

    it('returns default model ID safely', () => {
      const def = getDefaultModelId();
      expect(def).toBe('realesr-anime-v3-4x');
    });
  });

  describe('Model Manager (Download, Storage and Integrity)', () => {
    it('calculates SHA-256 hash correctly for binary buffers', async () => {
      const text = 'Shappire Stickers AI Test';
      const buffer = new TextEncoder().encode(text).buffer;
      const hash = await calculateBufferSha256(buffer);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });

    it('converts base64 to Uint8Array accurately', () => {
      const raw = 'U2hhcHBpcmU='; // 'Shappire' in base64
      const bytes = base64ToUint8Array(raw);
      expect(new TextDecoder().decode(bytes)).toBe('Shappire');
    });

    it('detects uninstalled model status initially', async () => {
      const manager = new ModelManagerService();
      const statuses = await manager.listModelsStatus();
      expect(statuses.length).toBe(AI_MODELS_CATALOG.length);
      for (const s of statuses) {
        expect(s.installed).toBe(false);
      }
    });

    it('detects model installed status after saving weights and updates manifest', async () => {
      const manager = new ModelManagerService();
      const model = AI_MODELS_CATALOG[0]!;

      const isInstalledBefore = await manager.isModelInstalled(model.id);
      expect(isInstalledBefore).toBe(false);
    });

    it('removes model and updates manifest', async () => {
      const manager = new ModelManagerService();
      const model = AI_MODELS_CATALOG[0]!;

      await manager.removeModel(model.id);
      const isInstalled = await manager.isModelInstalled(model.id);
      expect(isInstalled).toBe(false);
    });
  });

  describe('Tensor Pre-processing and Post-processing with Alpha Preservation', () => {
    it('converts RGBA ImageData to planar NCHW Float32Array in [0, 1]', () => {
      const width = 2;
      const height = 2;
      const rgba = new Uint8ClampedArray([
        255, 0, 0, 255,   // Pixel 0: R
        0, 255, 0, 128,   // Pixel 1: G
        0, 0, 255, 0,     // Pixel 2: B
        128, 128, 128, 255 // Pixel 3: Gray
      ]);
      const imgData = new ImageData(rgba, width, height);
      const tensor = imageToRgbTensorData(imgData, width, height);

      expect(tensor.length).toBe(3 * width * height); // 12 elements

      // R channel
      expect(tensor[0]).toBeCloseTo(1.0);
      expect(tensor[1]).toBeCloseTo(0.0);
      expect(tensor[2]).toBeCloseTo(0.0);
      expect(tensor[3]).toBeCloseTo(128 / 255.0);

      // G channel
      expect(tensor[4]).toBeCloseTo(0.0);
      expect(tensor[5]).toBeCloseTo(1.0);
      expect(tensor[6]).toBeCloseTo(0.0);
      expect(tensor[7]).toBeCloseTo(128 / 255.0);

      // B channel
      expect(tensor[8]).toBeCloseTo(0.0);
      expect(tensor[9]).toBeCloseTo(0.0);
      expect(tensor[10]).toBeCloseTo(1.0);
      expect(tensor[11]).toBeCloseTo(128 / 255.0);
    });

    it('reconstructs ImageData preserving transparent alpha channel', () => {
      const width = 2;
      const height = 2;
      const tensor = new Float32Array([
        // R
        1.0, 0.0, 0.0, 0.5,
        // G
        0.0, 1.0, 0.0, 0.5,
        // B
        0.0, 0.0, 1.0, 0.5,
      ]);
      const alphaChannel = new Uint8ClampedArray([255, 128, 0, 200]);

      const outImageData = rgbTensorDataToImageData(tensor, width, height, alphaChannel);

      expect(outImageData.width).toBe(width);
      expect(outImageData.height).toBe(height);

      // Pixel 0: Red, alpha 255
      expect(outImageData.data[0]).toBe(255);
      expect(outImageData.data[1]).toBe(0);
      expect(outImageData.data[2]).toBe(0);
      expect(outImageData.data[3]).toBe(255);

      // Pixel 1: Green, alpha 128
      expect(outImageData.data[4]).toBe(0);
      expect(outImageData.data[5]).toBe(255);
      expect(outImageData.data[6]).toBe(0);
      expect(outImageData.data[7]).toBe(128);

      // Pixel 2: Blue, alpha 0 (fully transparent)
      expect(outImageData.data[8]).toBe(0);
      expect(outImageData.data[9]).toBe(0);
      expect(outImageData.data[10]).toBe(255);
      expect(outImageData.data[11]).toBe(0);
    });
  });
});
