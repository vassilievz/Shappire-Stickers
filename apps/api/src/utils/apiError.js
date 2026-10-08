/**
 * Erro de aplicação com código estável (ver @shappire/contracts → API_ERROR_CODES)
 * e mensagem humana. O errorHandler traduz para o formato de resposta da §28:
 * { "error": "<código>", "message": "<mensagem>" }.
 */
export class ApiError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}
