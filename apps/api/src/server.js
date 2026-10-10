import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { connectMongo, disconnectMongo } from './config/mongodb.js';
import { healthRouter } from './routes/health.js';
import { profileRouter } from './routes/profile.js';
import { donationRouter } from './routes/donation.js';
import { publicationsRouter } from './routes/publications.js';
import { socialRouter } from './routes/social.js';
import { avatarDecorationsRouter } from './routes/avatarDecorations.js';
import { monthlyDonorRouter } from './routes/monthlyDonor.js';
import { invitesRouter } from './routes/invites.js';
import { avatarDecorationProfileRouter } from './routes/avatarDecorationProfile.js';
import { appReleaseRouter } from './routes/appRelease.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.trustProxy) {
    app.set('trust proxy', 1);
  }
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use(express.json({ limit: '128kb' }));
  app.use(healthRouter);
  app.use(profileRouter);
  app.use(donationRouter);
  app.use(publicationsRouter);
  app.use(socialRouter);
  app.use(avatarDecorationsRouter);
  app.use(monthlyDonorRouter);
  app.use(invitesRouter);
  app.use(avatarDecorationProfileRouter);
  app.use(appReleaseRouter);
  app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Rota não encontrada.' });
  });
  app.use(errorHandler);
  return app;
}

async function start() {
  // §8: configuração explícita de DNS do ambiente de execução (nunca na URI).
  // Necessário quando o resolvedor do sistema (ex.: proxy local em 127.0.0.1)
  // recusa as consultas SRV que o driver do MongoDB faz via c-ares.
  if (env.dnsServers.length > 0) {
    dns.setServers(env.dnsServers);
    console.log(`[api] DNS explícito configurado: ${env.dnsServers.join(', ')}`);
  }

  try {
    await connectMongo();
  } catch (error) {
    console.error('[api] falha ao conectar no MongoDB:', error.message);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log(`[api] Shappire API escutando na porta ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`[api] recebido ${signal}, encerrando...`);
    server.close(async () => {
      await disconnectMongo();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

const invoked = process.argv[1];
if (invoked && path.resolve(invoked) === fileURLToPath(import.meta.url)) {
  start();
}
