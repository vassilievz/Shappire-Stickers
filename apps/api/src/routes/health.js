import { Router } from 'express';
import { mongoState } from '../config/mongodb.js';
import { v0xConfig } from '../config/v0x.js';

export const healthRouter = Router();

/**
 * GET /health — estado do serviço sem expor credenciais (§27).
 * V0X informa apenas se está configurado: um health check não deve gastar
 * limite de requisição do provedor nem depender da rede dele.
 */
healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'shappire-api',
    mongodb: mongoState(),
    v0x: v0xConfig.apiKey ? 'configured' : 'not_configured',
  });
});
