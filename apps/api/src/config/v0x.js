import { env } from './env.js';

/**
 * Configuração central de toda a comunicação com a API V0X.
 * A chave (V0X_API) existe SOMENTE aqui, no ambiente do backend.
 * Ela nunca é logada, retornada ou exposta de qualquer forma.
 */
export const v0xConfig = {
  baseUrl: 'https://api.v0x.lol/api/v1',
  apiKey: env.v0xApiKey,
  timeouts: {
    upload: 30_000,
    request: 10_000,
  },
};
