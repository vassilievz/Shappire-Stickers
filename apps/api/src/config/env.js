import 'dotenv/config';

/**
 * Carrega e valida o ambiente da API. Falha rápido (fail-fast) na inicialização
 * se algo essencial estiver ausente — nunca em runtime, nunca silenciosamente.
 * Valores nunca são logados.
 */

const REQUIRED_VARS = [
  'MONGODB_URI',
  'V0X_API',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
];

function extractDatabaseName(uri) {
  let pathname = '';
  try {
    ({ pathname } = new URL(uri));
  } catch {
    return null;
  }
  const name = pathname.replace(/^\//, '').split('?')[0];
  return name || null;
}

export const env = (() => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Variáveis obrigatórias ausentes no ambiente da API: ${missing.join(', ')}. ` +
        'Preencha o apps/api/.env (veja apps/api/.env.example).',
    );
  }

  const mongodbUri = process.env.MONGODB_URI;
  const databaseName = extractDatabaseName(mongodbUri);
  if (!databaseName) {
    throw new Error(
      'MONGODB_URI precisa terminar explicitamente com o nome do banco, ex.: ' +
        'mongodb+srv://USUARIO:SENHA@cluster.mongodb.net/shappirestickers?retryWrites=true&w=majority',
    );
  }

  const corsOrigin = process.env.CORS_ORIGIN?.trim() ?? '';
  if (nodeEnv === 'production' && (corsOrigin === '' || corsOrigin === '*')) {
    throw new Error(
      'CORS_ORIGIN é obrigatório em produção e não pode ser "*" — informe as origens permitidas separadas por vírgula.',
    );
  }

  const corsOrigins = corsOrigin === '' || corsOrigin === '*'
    ? true
    : corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

  // §8: DNS explícito do ambiente de execução (nunca dentro da MONGODB_URI).
  const dnsServers = (process.env.DNS_SERVERS ?? '')
    .split(',')
    .map((server) => server.trim())
    .filter(Boolean);

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number(process.env.PORT ?? 8080),
    mongodbUri,
    databaseName,
    v0xApiKey: process.env.V0X_API,
    dnsServers,
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Service accounts costumam chegar com "\n" literal — normaliza para quebras reais.
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    corsOrigins,
    trustProxy: process.env.TRUST_PROXY === 'true',
  };
})();
