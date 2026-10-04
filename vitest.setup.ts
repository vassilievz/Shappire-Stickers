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
