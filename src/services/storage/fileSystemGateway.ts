import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { AppError, toAppError } from '@/shared/errors';
import { createLogger } from '@/services/logging/logger';


export interface FileEntryInfo {
  name: string;
  type: 'file' | 'directory';
  sizeBytes: number;
}

export interface FileStatInfo {
  type: 'file' | 'directory';
  sizeBytes: number;
  mtime: number;
  uri: string;
}

export interface FileSystemGateway {
  readonly kind: 'capacitor' | 'memory';
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, data: string): Promise<void>;
  readBinaryFile(path: string): Promise<{ base64: string; sizeBytes: number }>;
  writeBinaryFile(path: string, base64: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  deleteDirectory(path: string, recursive?: boolean): Promise<void>;
  mkdir(path: string): Promise<void>;
  readDir(path: string): Promise<FileEntryInfo[]>;
  stat(path: string): Promise<FileStatInfo | null>;
  exists(path: string): Promise<boolean>;
  
  getFileUri(path: string): Promise<string>;
  getDirectoryUri(path: string): Promise<string>;
}

const log = createLogger('filesystem');


const NOT_FOUND_CODES = new Set(['OS-PLUG-FILE-0008', 'OS-PLUG-FILE-0006', 'OS-PLUG-FILE-0002']);
const EXISTS_CODES = new Set(['OS-PLUG-FILE-0010']);

export function capacitorErrorCode(error: unknown): string {
  const raw = error as { code?: unknown };
  return typeof raw?.code === 'string' ? raw.code : '';
}

function capacitorErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const raw = error as { message?: unknown };
  return typeof raw?.message === 'string' ? raw.message : '';
}


export function isNotFoundError(error: unknown): boolean {
  if (NOT_FOUND_CODES.has(capacitorErrorCode(error))) return true;
  const text = capacitorErrorMessage(error).toLowerCase();
  return (
    text.includes('does not exist') ||
    text.includes('not exist') ||
    text.includes('not found') ||
    text.includes('não encontrad')
  );
}


export function isAlreadyExistsError(error: unknown): boolean {
  if (EXISTS_CODES.has(capacitorErrorCode(error))) return true;
  const text = capacitorErrorMessage(error).toLowerCase();
  return text.includes('already exist') || text.includes('já existe');
}

function mapCapacitorError(error: unknown, operation: string, path: string): AppError {
  if (isNotFoundError(error)) {
    return new AppError('NOT_FOUND', `Arquivo não encontrado: ${path}`, {
      cause: error,
      details: { operation },
    });
  }
  return new AppError('STORAGE_WRITE_FAILED', `Falha em "${operation}" para ${path}`, {
    cause: error,
    details: { code: capacitorErrorCode(error) },
  });
}


export function createCapacitorFileSystemGateway(): FileSystemGateway {
  const root = Directory.Data;

  async function statSafe(path: string): Promise<FileStatInfo | null> {
    try {
      const result = await Filesystem.stat({ path, directory: root });
      return {
        type: result.type === 'directory' ? 'directory' : 'file',
        sizeBytes: result.size ?? 0,
        mtime: result.mtime ?? 0,
        uri: result.uri,
      };
    } catch (error) {
      if (isNotFoundError(error)) return null;
      throw mapCapacitorError(error, 'stat', path);
    }
  }

  return {
    kind: 'capacitor',

    async readTextFile(path) {
      try {
        const result = await Filesystem.readFile({ path, directory: root, encoding: Encoding.UTF8 });
        return typeof result.data === 'string' ? result.data : await result.data.text();
      } catch (error) {
        const appError = mapCapacitorError(error, 'readTextFile', path);
        if (appError.code !== 'NOT_FOUND') log.warn(appError.message);
        throw appError;
      }
    },

    async writeTextFile(path, data) {
      try {
        await Filesystem.writeFile({
          path,
          data,
          directory: root,
          encoding: Encoding.UTF8,
          recursive: true,
        });
      } catch (error) {
        throw mapCapacitorError(error, 'writeTextFile', path);
      }
    },

    async readBinaryFile(path) {
      try {
        const result = await Filesystem.readFile({ path, directory: root });
        const base64 = typeof result.data === 'string' ? result.data : '';
        const stat = await statSafe(path);
        return { base64, sizeBytes: stat?.sizeBytes ?? Math.floor((base64.length * 3) / 4) };
      } catch (error) {
        throw mapCapacitorError(error, 'readBinaryFile', path);
      }
    },

    async writeBinaryFile(path, base64) {
      try {
        await Filesystem.writeFile({ path, data: base64, directory: root, recursive: true });
      } catch (error) {
        throw mapCapacitorError(error, 'writeBinaryFile', path);
      }
    },

    async deleteFile(path) {
      try {
        await Filesystem.deleteFile({ path, directory: root });
      } catch (error) {
        if (isNotFoundError(error)) return;
        throw mapCapacitorError(error, 'deleteFile', path);
      }
    },

    async deleteDirectory(path, recursive = true) {
      try {
        const stat = await statSafe(path);
        if (!stat) return;
        await Filesystem.rmdir({ path, directory: root, recursive });
      } catch (error) {
        if (isNotFoundError(error)) return;
        throw mapCapacitorError(error, 'deleteDirectory', path);
      }
    },

    async mkdir(path) {
      try {
        const stat = await statSafe(path);
        if (stat?.type === 'directory') return;
        await Filesystem.mkdir({ path, directory: root, recursive: true });
      } catch (error) {
        if (isAlreadyExistsError(error)) return;
        throw mapCapacitorError(error, 'mkdir', path);
      }
    },

    async readDir(path) {
      try {
        const result = await Filesystem.readdir({ path, directory: root });
        return result.files.map((file) => ({
          name: file.name,
          type: file.type === 'directory' ? 'directory' : 'file',
          sizeBytes: file.size ?? 0,
        }));
      } catch (error) {
        if (isNotFoundError(error)) return [];
        throw mapCapacitorError(error, 'readDir', path);
      }
    },

    stat: statSafe,

    async exists(path) {
      return (await statSafe(path)) !== null;
    },

    async getFileUri(path) {
      try {
        const result = await Filesystem.getUri({ path, directory: root });
        return result.uri;
      } catch (error) {
        throw toAppError(error, 'STORAGE_NOT_AVAILABLE');
      }
    },

    async getDirectoryUri(path) {
      try {
        const result = await Filesystem.getUri({ path, directory: root });
        return result.uri;
      } catch (error) {
        throw toAppError(error, 'STORAGE_NOT_AVAILABLE');
      }
    },
  };
}
