/**
 * Catálogo e definições oficiais dos modelos de melhoria por IA do Shappire Stickers.
 *
 * Todos os modelos possuem licenças permissivas (BSD-3-Clause / Apache-2.0 / MIT),
 * pesos em formato ONNX padrão e hashes SHA-256 fixos para validação de integridade.
 */

export type ModelTargetType = 'anime_illustration' | 'photo_realistic' | 'general';

export interface ModelMetadata {
  id: string;
  name: string;
  description: string;
  recommendedFor: ModelTargetType;
  scale: number;
  sizeBytes: number;
  formattedSize: string;
  version: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  downloadUrl: string;
  sha256: string;
  inputNodeName: string;
  outputNodeName: string;
  normalization: 'zero_to_one' | 'div255_sub_mean';
  mean?: [number, number, number];
  limitations: string;
}

export const AI_MODELS_CATALOG: readonly ModelMetadata[] = [
  {
    id: 'realesr-anime-v3-4x',
    name: 'Real-ESRGAN Anime 4x',
    description: 'Especializado em figurinhas de anime, desenhos, ilustrações, vetores e memes com traços nítidos.',
    recommendedFor: 'anime_illustration',
    scale: 4,
    sizeBytes: 2496535,
    formattedSize: '2.4 MB',
    version: 'v3.0.0',
    license: 'BSD-3-Clause',
    licenseUrl: 'https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE',
    sourceUrl: 'https://huggingface.co/xiaojiaenen/lingtuan-sr-models',
    downloadUrl:
      'https://huggingface.co/xiaojiaenen/lingtuan-sr-models/resolve/main/realesr-animevideov3-x4.onnx',
    sha256: '14114520123405712c92c2b266a49e906f03b595335e53e3604cdc03c5a408e4',
    inputNodeName: 'input',
    outputNodeName: 'output',
    normalization: 'zero_to_one',
    limitations:
      'Otimizado para traços gráficos e desenhos. Pode suavizar excessivamente texturas hiper-realistas de peles ou paisagens.',
  },
  {
    id: 'clear-reality-span-4x',
    name: 'ClearReality SPAN 4x',
    description: 'Ultraleve baseado em SPAN para fotos reais, retratos de pessoas, animais de estimação e fotografias em geral.',
    recommendedFor: 'photo_realistic',
    scale: 4,
    sizeBytes: 1721421,
    formattedSize: '1.7 MB',
    version: 'v1.0.0',
    license: 'Apache-2.0',
    licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    sourceUrl: 'https://huggingface.co/notaneimu/onnx-image-models',
    downloadUrl:
      'https://huggingface.co/notaneimu/onnx-image-models/resolve/main/4x-ClearRealityV1.onnx',
    sha256: '48b3d2c862e8325fab5041e6eaca6c307acb5ce11c9e683ea1b0796c17600595',
    inputNodeName: 'image',
    outputNodeName: 'output',
    normalization: 'zero_to_one',
    limitations:
      'Otimizado para fotos e redução de ruídos de compressão. Em desenhos com traços muito pretos, o Real-ESRGAN Anime oferece nitidez superior.',
  },
] as const;

export function getModelById(id: string): ModelMetadata | undefined {
  return AI_MODELS_CATALOG.find((m) => m.id === id);
}

export function getDefaultModelId(): string {
  const first = AI_MODELS_CATALOG[0];
  return first ? first.id : 'realesr-anime-v3-4x';
}
