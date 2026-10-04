import { AppError } from '@/shared/errors';
import type { FileEntryInfo, FileStatInfo, FileSystemGateway } from './fileSystemGateway';


interface MemoryEntry {
  type: 'file' | 'directory';
  
  base64: string;
  mtime: number;
}

function normalize(path: string): string {
  const cleaned = path
    .replace(/\\/g, '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.')
    .join('/');
  return cleaned;
}

export function createMemoryFileSystemGateway(seed: Record<string, string> = {}): FileSystemGateway {
  const entries = new Map<string, MemoryEntry>();

  function ensureParentDirectories(path: string): void {
    const segments = path.split('/');
    segments.pop();
    let current = '';
    for (const segment of segments) {
      current = current === '' ? segment : `${current}/${segment}`;
      if (!entries.has(current)) {
        entries.set(current, { type: 'directory', base64: '', mtime: Date.now() });
      }
    }
  }

  for (const [rawPath, content] of Object.entries(seed)) {
    const path = normalize(rawPath);
    ensureParentDirectories(path);
    entries.set(path, { type: 'file', base64: content, mtime: Date.now() });
  }

  function requireFile(path: string, operation: string): MemoryEntry {
    const entry = entries.get(path);
    if (!entry || entry.type !== 'file') {
      throw new AppError('NOT_FOUND', `Arquivo não encontrado: ${path}`, { details: { operation } });
    }
    return entry;
  }

  function encodeUtf8(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64');
  }

  function decodeUtf8(value: string): string {
    return Buffer.from(value, 'base64').toString('utf8');
  }

  return {
    kind: 'memory',

    async readTextFile(path) {
      const entry = requireFile(normalize(path), 'readTextFile');
      return decodeUtf8(entry.base64);
    },

    async writeTextFile(path, data) {
      const normalized = normalize(path);
      ensureParentDirectories(normalized);
      entries.set(normalized, { type: 'file', base64: encodeUtf8(data), mtime: Date.now() });
    },

    async readBinaryFile(path) {
      const entry = requireFile(normalize(path), 'readBinaryFile');
      return { base64: entry.base64, sizeBytes: Buffer.from(entry.base64, 'base64').length };
    },

    async writeBinaryFile(path, base64) {
      const normalized = normalize(path);
      ensureParentDirectories(normalized);
      entries.set(normalized, { type: 'file', base64, mtime: Date.now() });
    },

    async deleteFile(path) {
      const normalized = normalize(path);
      const entry = entries.get(normalized);
      if (entry?.type === 'file') entries.delete(normalized);
    },

    async deleteDirectory(path, recursive = true) {
      const normalized = normalize(path);
      if (recursive) {
        for (const key of [...entries.keys()]) {
          if (key === normalized || key.startsWith(`${normalized}/`)) {
            entries.delete(key);
          }
        }
        return;
      }
      entries.delete(normalized);
    },

    async mkdir(path) {
      const normalized = normalize(path);
      ensureParentDirectories(normalized);
      if (!entries.has(normalized)) {
        entries.set(normalized, { type: 'directory', base64: '', mtime: Date.now() });
      }
    },

    async readDir(path) {
      const normalized = normalize(path);
      const prefix = normalized === '' ? '' : `${normalized}/`;
      const result = new Map<string, FileEntryInfo>();
      for (const [key, entry] of entries.entries()) {
        if (!key.startsWith(prefix) || key === normalized) continue;
        const rest = key.slice(prefix.length);
        if (rest === '' || rest.includes('/')) continue;
        result.set(rest, {
          name: rest,
          type: entry.type,
          sizeBytes: Buffer.from(entry.base64, 'base64').length,
        });
      }
      return [...result.values()];
    },

    async stat(path) {
      const normalized = normalize(path);
      const entry = entries.get(normalized);
      if (!entry) return null;
      const info: FileStatInfo = {
        type: entry.type,
        sizeBytes: Buffer.from(entry.base64, 'base64').length,
        mtime: entry.mtime,
        uri: `memory://${normalized}`,
      };
      return info;
    },

    async exists(path) {
      return entries.has(normalize(path));
    },

    async getFileUri(path) {
      return `memory://${normalize(path)}`;
    },

    async getDirectoryUri(path) {
      return `memory://${normalize(path)}`;
    },
  };
}


export function normalizeMemoryPath(path: string): string {
  return normalize(path);
}
