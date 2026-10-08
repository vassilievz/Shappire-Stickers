import { AppError, toAppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';
import { getFileSystemGateway } from './gateway';

const log = createLogger('json-store');

export interface JsonReadResult<T> {
  data: T | null;
  
  corrupted: boolean;
}


export async function readJson<T>(path: string): Promise<JsonReadResult<T>> {
  const gateway = getFileSystemGateway();
  try {
    const raw = await gateway.readTextFile(path);
    if (raw.trim() === '') return { data: null, corrupted: false };
    return { data: JSON.parse(raw) as T, corrupted: false };
  } catch (error) {
    if (AppError.is(error) && error.code === 'NOT_FOUND') {
      return { data: null, corrupted: false };
    }
    log.warn(`Falha ao ler ${path}`, error);
    return { data: null, corrupted: true };
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  const gateway = getFileSystemGateway();
  try {
    await gateway.writeTextFile(path, JSON.stringify(data, null, 2));
  } catch (error) {
    throw toAppError(error, 'STORAGE_WRITE_FAILED');
  }
}


export async function removeFile(path: string): Promise<void> {
  const gateway = getFileSystemGateway();
  try {
    await gateway.deleteFile(path);
  } catch (error) {
    const appError = toAppError(error, 'STORAGE_DELETE_FAILED');
    if (appError.code === 'NOT_FOUND') return;
    throw appError;
  }
}
