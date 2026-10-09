import { getFileSystemGateway } from '@/services/storage/gateway';
import {
  modelsDirectory,
  modelWeightsPath,
  modelTempWeightsPath,
  modelManifestPath,
} from '@/services/storage/paths';
import { AI_MODELS_CATALOG, getModelById, type ModelMetadata } from '@/domain/ai/modelCatalog';
import { createLogger } from '@/services/logging/logger';

const log = createLogger('model-manager');

export interface ModelInstallStatus {
  model: ModelMetadata;
  installed: boolean;
  sizeOnDisk?: number;
}

export interface ModelDownloadProgress {
  modelId: string;
  loadedBytes: number;
  totalBytes: number;
  percentage: number;
}

export interface StoredModelManifest {
  installedModelIds: string[];
  installedAt: Record<string, string>;
  sha256Verified: Record<string, string>;
}

/**
 * Calcula o hash SHA-256 de um ArrayBuffer no navegador / ambiente Capacitor.
 */
export async function calculateBufferSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Converte Uint8Array para base64 em pedaços para evitar estouro de pilha.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Converte base64 para Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class ModelManagerService {
  private activeAbortControllers = new Map<string, AbortController>();

  async getManifest(): Promise<StoredModelManifest> {
    const gateway = getFileSystemGateway();
    try {
      const exists = await gateway.exists(modelManifestPath());
      if (!exists) {
        return { installedModelIds: [], installedAt: {}, sha256Verified: {} };
      }
      const raw = await gateway.readTextFile(modelManifestPath());
      const parsed = JSON.parse(raw) as Partial<StoredModelManifest>;
      return {
        installedModelIds: Array.isArray(parsed.installedModelIds) ? parsed.installedModelIds : [],
        installedAt: parsed.installedAt ?? {},
        sha256Verified: parsed.sha256Verified ?? {},
      };
    } catch {
      return { installedModelIds: [], installedAt: {}, sha256Verified: {} };
    }
  }

  private async saveManifest(manifest: StoredModelManifest): Promise<void> {
    const gateway = getFileSystemGateway();
    await gateway.mkdir(modelsDirectory());
    await gateway.writeTextFile(modelManifestPath(), JSON.stringify(manifest, null, 2));
  }

  async listModelsStatus(): Promise<ModelInstallStatus[]> {
    const gateway = getFileSystemGateway();
    const manifest = await this.getManifest();
    const statuses: ModelInstallStatus[] = [];

    for (const model of AI_MODELS_CATALOG) {
      const filePath = modelWeightsPath(model.id);
      const existsOnDisk = await gateway.exists(filePath);
      const inManifest = manifest.installedModelIds.includes(model.id);

      if (existsOnDisk && inManifest) {
        const stat = await gateway.stat(filePath);
        statuses.push({
          model,
          installed: true,
          sizeOnDisk: stat?.sizeBytes ?? model.sizeBytes,
        });
      } else {
        statuses.push({
          model,
          installed: false,
        });
      }
    }

    return statuses;
  }

  async isModelInstalled(modelId: string): Promise<boolean> {
    const gateway = getFileSystemGateway();
    const manifest = await this.getManifest();
    if (!manifest.installedModelIds.includes(modelId)) return false;
    return gateway.exists(modelWeightsPath(modelId));
  }

  async loadModelBytes(modelId: string): Promise<Uint8Array> {
    const model = getModelById(modelId);
    if (!model) {
      throw new Error(`Modelo não encontrado no catálogo: ${modelId}`);
    }
    const gateway = getFileSystemGateway();
    const filePath = modelWeightsPath(modelId);
    const exists = await gateway.exists(filePath);
    if (!exists) {
      throw new Error(`Modelo ${model.name} não está baixado no dispositivo.`);
    }

    const { base64 } = await gateway.readBinaryFile(filePath);
    return base64ToUint8Array(base64);
  }

  cancelDownload(modelId: string): void {
    const controller = this.activeAbortControllers.get(modelId);
    if (controller) {
      controller.abort();
      this.activeAbortControllers.delete(modelId);
      log.info(`Download do modelo ${modelId} cancelado pelo usuário.`);
    }
  }

  async downloadModel(
    modelId: string,
    onProgress?: (progress: ModelDownloadProgress) => void,
  ): Promise<void> {
    const model = getModelById(modelId);
    if (!model) {
      throw new Error(`Modelo inválido: ${modelId}`);
    }

    if (await this.isModelInstalled(modelId)) {
      log.info(`Modelo ${model.name} já instalado.`);
      return;
    }

    const abortController = new AbortController();
    this.activeAbortControllers.set(modelId, abortController);

    try {
      log.info(`Iniciando download do modelo ${model.name} de ${model.downloadUrl}`);
      const response = await fetch(model.downloadUrl, {
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Falha ao baixar modelo (HTTP ${response.status}): ${response.statusText}`,
        );
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : model.sizeBytes;

      let buffer: ArrayBuffer;

      if (response.body && typeof ReadableStream !== 'undefined') {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let loadedBytes = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loadedBytes += value.length;
            if (onProgress) {
              const percentage = Math.min(100, Math.round((loadedBytes / totalBytes) * 100));
              onProgress({
                modelId,
                loadedBytes,
                totalBytes,
                percentage,
              });
            }
          }
        }

        const combined = new Uint8Array(loadedBytes);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        buffer = combined.buffer;
      } else {
        buffer = await response.arrayBuffer();
        if (onProgress) {
          onProgress({
            modelId,
            loadedBytes: buffer.byteLength,
            totalBytes: buffer.byteLength,
            percentage: 100,
          });
        }
      }

      // Validação de integridade SHA-256
      log.info(`Validando integridade SHA-256 do modelo ${model.name}...`);
      const computedHash = await calculateBufferSha256(buffer);
      if (computedHash.toLowerCase() !== model.sha256.toLowerCase()) {
        throw new Error(
          `Integridade do modelo violada. Hash esperado: ${model.sha256}, obtido: ${computedHash}`,
        );
      }

      // Gravação segura no armazenamento local do dispositivo via arquivo temporário
      const gateway = getFileSystemGateway();
      await gateway.mkdir(modelsDirectory());
      const tempPath = modelTempWeightsPath(model.id);
      const finalPath = modelWeightsPath(model.id);
      const base64 = uint8ArrayToBase64(new Uint8Array(buffer));

      // Grava no caminho temporário primeiro
      await gateway.writeBinaryFile(tempPath, base64);

      // Promove para o caminho definitivo
      await gateway.writeBinaryFile(finalPath, base64);

      // Remove temporário
      if (await gateway.exists(tempPath)) {
        await gateway.deleteFile(tempPath);
      }

      // Atualiza manifesto
      const manifest = await this.getManifest();
      if (!manifest.installedModelIds.includes(model.id)) {
        manifest.installedModelIds.push(model.id);
      }
      manifest.installedAt[model.id] = new Date().toISOString();
      manifest.sha256Verified[model.id] = computedHash;
      await this.saveManifest(manifest);

      log.info(`Modelo ${model.name} instalado e verificado com sucesso.`);
    } catch (error) {
      // Limpeza de arquivo temporário se houver falha
      try {
        const gateway = getFileSystemGateway();
        const tempPath = modelTempWeightsPath(model.id);
        if (await gateway.exists(tempPath)) {
          await gateway.deleteFile(tempPath);
        }
      } catch {
        // Ignora erro secundário de limpeza
      }

      if (abortController.signal.aborted) {
        throw new Error('Download cancelado pelo usuário.');
      }
      throw error;
    } finally {
      this.activeAbortControllers.delete(modelId);
    }
  }

  async removeModel(modelId: string): Promise<void> {
    const gateway = getFileSystemGateway();
    const filePath = modelWeightsPath(modelId);

    if (await gateway.exists(filePath)) {
      await gateway.deleteFile(filePath);
    }

    const manifest = await this.getManifest();
    manifest.installedModelIds = manifest.installedModelIds.filter((id) => id !== modelId);
    delete manifest.installedAt[modelId];
    delete manifest.sha256Verified[modelId];
    await this.saveManifest(manifest);

    log.info(`Modelo ${modelId} removido do armazenamento local.`);
  }
}

export const modelManager = new ModelManagerService();
