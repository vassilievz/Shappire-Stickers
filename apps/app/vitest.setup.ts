import '@testing-library/jest-dom/vitest';

/**
 * Ambiente de teste: o jsdom não implementa `canvas.getContext('2d')`.
 * Os módulos de imagem do app nunca dependem de um contexto real nos testes:
 * eles recebem uma fábrica de canvas (`CanvasFactory`) injetável.
 * Ainda assim, garantimos que a chamada devolva `null` de forma previsível em
 * vez de lançar erro em testes que apenas verificam caminhos de falha.
 */
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];
}

if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    colorSpace: PredefinedColorSpace = 'srgb';
    constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, maybeHeight?: number) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = maybeHeight ?? (dataOrWidth.length / (4 * widthOrHeight));
      }
    }
  } as unknown as typeof ImageData;
}

