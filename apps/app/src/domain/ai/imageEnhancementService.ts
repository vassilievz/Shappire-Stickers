import * as ort from 'onnxruntime-web';
import { getModelById, type ModelMetadata } from './modelCatalog';
import { modelManager } from './modelManager';
import { createLogger } from '@/services/logging/logger';
import { createSurface } from '@/services/imaging/canvas';

const log = createLogger('image-enhancement');

// Configuração do caminho dos arquivos WebAssembly do ONNX Runtime
try {
  ort.env.wasm.wasmPaths = {
    wasm: './onnx/ort-wasm-simd-threaded.wasm',
  };
  // Limita threads para evitar esgotar memória e bateria em dispositivos móveis
  ort.env.wasm.numThreads = 2;
  ort.env.wasm.proxy = false;
} catch (e) {
  log.warn('Falha ao configurar opções ort.env.wasm', e);
}

export interface EnhancementProgress {
  stage: 'loading_model' | 'preprocessing' | 'inference' | 'postprocessing';
  progressPercentage: number;
  message?: string;
}

export interface EnhancementResult {
  enhancedDataUrl: string;
  width: number;
  height: number;
  scale: number;
  modelId: string;
  modelName: string;
  durationMs: number;
}

/**
 * Redimensiona a imagem antes da inferência se ultrapassar os limites seguros de memória
 * de smartphones móveis (máx 512px no maior lado).
 */
function getConstrainedDimensions(
  width: number,
  height: number,
  maxDimension = 512,
): { width: number; height: number; downscaled: boolean } {
  const maxSide = Math.max(width, height);
  if (maxSide <= maxDimension) {
    return { width, height, downscaled: false };
  }
  const ratio = maxDimension / maxSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    downscaled: true,
  };
}

/**
 * Converte ImageData (RGBA) para Float32Array planar (RGB) em formato NCHW [1, 3, H, W]
 * com normalização [0, 1].
 */
export function imageToRgbTensorData(
  imageData: ImageData,
  width: number,
  height: number,
): Float32Array {
  const pixelCount = width * height;
  const tensorData = new Float32Array(3 * pixelCount);
  const rgba = imageData.data;

  const rOffset = 0;
  const gOffset = pixelCount;
  const bOffset = 2 * pixelCount;

  for (let i = 0; i < pixelCount; i++) {
    const srcIndex = i * 4;
    tensorData[rOffset + i] = (rgba[srcIndex] ?? 0) / 255.0;
    tensorData[gOffset + i] = (rgba[srcIndex + 1] ?? 0) / 255.0;
    tensorData[bOffset + i] = (rgba[srcIndex + 2] ?? 0) / 255.0;
  }

  return tensorData;
}

/**
 * Converte o tensor de saída NCHW [1, 3, outH, outW] de volta para ImageData,
 * preservando o canal Alfa original redimensionado via interpolação bicúbica/bilinear.
 */
export function rgbTensorDataToImageData(
  tensorData: Float32Array,
  outWidth: number,
  outHeight: number,
  alphaChannel: Uint8ClampedArray | null,
): ImageData {
  const pixelCount = outWidth * outHeight;
  const outputArray = new Uint8ClampedArray(pixelCount * 4);

  const rOffset = 0;
  const gOffset = pixelCount;
  const bOffset = 2 * pixelCount;

  for (let i = 0; i < pixelCount; i++) {
    const dstIndex = i * 4;
    const rVal = tensorData[rOffset + i] ?? 0;
    const gVal = tensorData[gOffset + i] ?? 0;
    const bVal = tensorData[bOffset + i] ?? 0;

    const r = Math.min(255, Math.max(0, Math.round(rVal * 255.0)));
    const g = Math.min(255, Math.max(0, Math.round(gVal * 255.0)));
    const b = Math.min(255, Math.max(0, Math.round(bVal * 255.0)));
    const a = alphaChannel ? (alphaChannel[i] ?? 255) : 255;

    outputArray[dstIndex] = r;
    outputArray[dstIndex + 1] = g;
    outputArray[dstIndex + 2] = b;
    outputArray[dstIndex + 3] = a;
  }

  return new ImageData(outputArray, outWidth, outHeight);
}

/**
 * Extrai o canal alfa redimensionado para as dimensões ampliadas (outWidth x outHeight)
 * para garantir que transparências de figurinhas não fiquem com fundos pretos ou halos.
 */
function extractScaledAlphaChannel(
  sourceCanvas: HTMLCanvasElement,
  outWidth: number,
  outHeight: number,
): Uint8ClampedArray {
  const { ctx } = createSurface(outWidth, outHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, outWidth, outHeight);
  const upscaledImageData = ctx.getImageData(0, 0, outWidth, outHeight);

  const pixelCount = outWidth * outHeight;
  const alphaArray = new Uint8ClampedArray(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    alphaArray[i] = upscaledImageData.data[i * 4 + 3] ?? 255;
  }
  return alphaArray;
}

export class ImageEnhancementService {
  private currentSession: ort.InferenceSession | null = null;
  private currentSessionModelId: string | null = null;

  async getSession(model: ModelMetadata): Promise<ort.InferenceSession> {
    if (this.currentSession && this.currentSessionModelId === model.id) {
      return this.currentSession;
    }

    if (this.currentSession) {
      await this.release();
    }

    log.info(`Carregando pesos ONNX do modelo ${model.name}...`);
    const modelBytes = await modelManager.loadModelBytes(model.id);

    const session = await ort.InferenceSession.create(modelBytes.buffer, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });

    this.currentSession = session;
    this.currentSessionModelId = model.id;
    return session;
  }

  async release(): Promise<void> {
    if (this.currentSession) {
      try {
        await this.currentSession.release();
      } catch (e) {
        log.warn('Erro ao liberar sessão ONNX', e);
      }
      this.currentSession = null;
      this.currentSessionModelId = null;
    }
  }

  /**
   * Executa a melhoria de imagem com a IA local.
   */
  async enhanceImage(
    sourceDataUrl: string,
    modelId: string,
    onProgress?: (progress: EnhancementProgress) => void,
  ): Promise<EnhancementResult> {
    const startTime = performance.now();
    const model = getModelById(modelId);
    if (!model) {
      throw new Error(`Modelo ${modelId} não encontrado no catálogo.`);
    }

    onProgress?.({
      stage: 'loading_model',
      progressPercentage: 15,
      message: 'Carregando modelo de IA...',
    });

    const session = await this.getSession(model);

    onProgress?.({
      stage: 'preprocessing',
      progressPercentage: 35,
      message: 'Preparando imagem e ajustando proporção...',
    });

    // 1. Carrega imagem em um HTMLImageElement
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Falha ao decodificar imagem para processamento.'));
      image.src = sourceDataUrl;
    });

    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    // 2. Limita dimensões para respeitar limites de memória RAM móvel
    const { width: procWidth, height: procHeight } = getConstrainedDimensions(
      origWidth,
      origHeight,
      512,
    );

    const { canvas: inputCanvas, ctx: inputCtx } = createSurface(procWidth, procHeight);
    inputCtx.drawImage(img, 0, 0, procWidth, procHeight);
    const inputImageData = inputCtx.getImageData(0, 0, procWidth, procHeight);

    let tensorInput: ort.Tensor | null = null;
    let outputTensor: ort.Tensor | null = null;

    try {
      // 3. Converte para tensor NCHW
      const rgbTensorData = imageToRgbTensorData(inputImageData, procWidth, procHeight);
      tensorInput = new ort.Tensor('float32', rgbTensorData, [1, 3, procHeight, procWidth]);

      onProgress?.({
        stage: 'inference',
        progressPercentage: 65,
        message: 'Executando inferência neural...',
      });

      // 4. Executa a inferência
      const feeds: Record<string, ort.Tensor> = {
        [model.inputNodeName]: tensorInput,
      };

      const results = await session.run(feeds);
      outputTensor = (results[model.outputNodeName] ?? Object.values(results)[0]) as ort.Tensor;

      if (!outputTensor) {
        throw new Error('Nenhum tensor retornado pelo modelo ONNX.');
      }

      onProgress?.({
        stage: 'postprocessing',
        progressPercentage: 85,
        message: 'Reconstruindo canais e preservando transparência...',
      });

      // 5. Dimensões de saída da rede
      const outH = outputTensor.dims[2] ?? procHeight * model.scale;
      const outW = outputTensor.dims[3] ?? procWidth * model.scale;
      const outputData = outputTensor.data as Float32Array;

      // 6. Preserva canal alfa redimensionado
      const scaledAlpha = extractScaledAlphaChannel(inputCanvas, outW, outH);

      // 7. Gera ImageData final
      const finalImageData = rgbTensorDataToImageData(outputData, outW, outH, scaledAlpha);

      const { canvas: outputCanvas, ctx: outputCtx } = createSurface(outW, outH);
      outputCtx.putImageData(finalImageData, 0, 0);

      const enhancedDataUrl = outputCanvas.toDataURL('image/png');
      const durationMs = Math.round(performance.now() - startTime);

      onProgress?.({
        stage: 'postprocessing',
        progressPercentage: 100,
        message: 'Concluído!',
      });

      return {
        enhancedDataUrl,
        width: outW,
        height: outH,
        scale: model.scale,
        modelId: model.id,
        modelName: model.name,
        durationMs,
      };
    } finally {
      // Libera explicitamente referências para coleta de lixo rápida em dispositivos móveis
      tensorInput = null;
      outputTensor = null;
    }
  }
}

export const imageEnhancementService = new ImageEnhancementService();
