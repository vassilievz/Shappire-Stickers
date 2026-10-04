import { beforeEach, describe, expect, it, vi } from 'vitest';

const filesystem = vi.hoisted(() => ({
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  rmdir: vi.fn(),
  mkdir: vi.fn(),
  readdir: vi.fn(),
  getUri: vi.fn(),
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: filesystem,
  Directory: { Data: 'DATA', Documents: 'DOCUMENTS', Cache: 'CACHE', External: 'EXTERNAL' },
  Encoding: { UTF8: 'utf8' },
}));

import {
  createCapacitorFileSystemGateway,
  isAlreadyExistsError,
  isNotFoundError,
} from './fileSystemGateway';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classificação de erros do plugin', () => {
  it('reconhece "não existe" pelo código nativo do Android', () => {
    expect(isNotFoundError({ code: 'OS-PLUG-FILE-0008' })).toBe(true);
    expect(isNotFoundError({ code: 'OS-PLUG-FILE-0006' })).toBe(true);
  });

  it('reconhece "não existe" pela mensagem usada no Web', () => {
    expect(isNotFoundError(new Error('File does not exist.'))).toBe(true);
    expect(isNotFoundError(new Error('Entry does not exist.'))).toBe(true);
    expect(isNotFoundError(new Error('Folder does not exist.'))).toBe(true);
    expect(isNotFoundError(new Error('Erro genérico'))).toBe(false);
  });

  it('reconhece "já existe"', () => {
    expect(isAlreadyExistsError({ code: 'OS-PLUG-FILE-0010' })).toBe(true);
    expect(isAlreadyExistsError(new Error('Current directory does already exist.'))).toBe(true);
    expect(isAlreadyExistsError(new Error('Falha de rede'))).toBe(false);
  });
});

describe('createCapacitorFileSystemGateway', () => {
  it('stat devolve null (e não lança) para arquivo inexistente', async () => {
    filesystem.stat.mockRejectedValue(new Error('Entry does not exist.'));
    const gateway = createCapacitorFileSystemGateway();
    expect(await gateway.stat('library/packs.json')).toBeNull();
  });

  it('exists é falso para arquivo inexistente (primeira execução)', async () => {
    filesystem.stat.mockRejectedValue(new Error('Entry does not exist.'));
    const gateway = createCapacitorFileSystemGateway();
    expect(await gateway.exists('library/packs.json')).toBe(false);
  });

  it('readTextFile lança AppError NOT_FOUND quando o arquivo não existe', async () => {
    filesystem.readFile.mockRejectedValue(new Error('File does not exist.'));
    const gateway = createCapacitorFileSystemGateway();
    await expect(gateway.readTextFile('library/packs.json')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('readDir devolve lista vazia quando a pasta não existe', async () => {
    filesystem.readdir.mockRejectedValue(new Error('Folder does not exist.'));
    const gateway = createCapacitorFileSystemGateway();
    expect(await gateway.readDir('sticker_packs')).toEqual([]);
  });

  it('deleteFile ignora arquivo ausente e propaga outros erros', async () => {
    const gateway = createCapacitorFileSystemGateway();
    filesystem.deleteFile.mockRejectedValueOnce(new Error('File does not exist.'));
    await expect(gateway.deleteFile('x.webp')).resolves.toBeUndefined();

    filesystem.deleteFile.mockRejectedValueOnce(new Error('disco cheio'));
    await expect(gateway.deleteFile('x.webp')).rejects.toMatchObject({
      code: 'STORAGE_WRITE_FAILED',
    });
  });

  it('mkdir considera pasta já existente como sucesso', async () => {
    const gateway = createCapacitorFileSystemGateway();
    filesystem.stat.mockRejectedValue(new Error('Entry does not exist.'));
    filesystem.mkdir.mockRejectedValue(new Error('Current directory does already exist.'));
    await expect(gateway.mkdir('sticker_packs')).resolves.toBeUndefined();
  });

  it('lê e grava arquivos com o diretório de dados do app', async () => {
    const gateway = createCapacitorFileSystemGateway();
    filesystem.writeFile.mockResolvedValue(undefined);
    await gateway.writeTextFile('library/x.json', '{}');
    expect(filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'library/x.json', directory: 'DATA', recursive: true }),
    );

    filesystem.readFile.mockResolvedValue({ data: '{}' });
    expect(await gateway.readTextFile('library/x.json')).toBe('{}');
  });
});
