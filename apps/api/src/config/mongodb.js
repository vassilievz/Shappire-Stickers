import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

mongoose.connection.on('error', (error) => {
  console.error('[mongo] erro de conexão:', error.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[mongo] desconectado');
});

export async function connectMongo() {
  await mongoose.connect(env.mongodbUri, {
    serverSelectionTimeoutMS: 10_000,
  });
  console.log(`[mongo] conectado — banco: ${env.databaseName}`);
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

export function mongoState() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}
