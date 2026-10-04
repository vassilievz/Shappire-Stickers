import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryFileSystemGateway } from './memoryFileSystem';
import { getFileSystemGateway, setFileSystemGateway } from './gateway';
import { readJson, writeJson } from './jsonStore';
import {
  deletePack,
  getPack,
  loadPacks,
  savePacks,
  upsertPack,
} from './packRepository';
import {
  deleteProject,
  loadProject,
  loadProjectSummaries,
  readAssetDataUrlByPath,
  saveProject,
  setProjectHidden,
  writeProjectAsset,
} from './projectRepository';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settingsRepository';
import { createStickerPack } from '@/domain/stickerPack';
import { createProject } from '@/domain/project';
import { packStickerPath } from './paths';

beforeEach(() => {
  setFileSystemGateway(createMemoryFileSystemGateway());
});

describe('jsonStore', () => {
  it('devolve null para arquivo inexistente (primeira execução)', async () => {
    const result = await readJson<{ a: number }>('inexistente.json');
    expect(result).toEqual({ data: null, corrupted: false });
  });

  it('lê e grava documentos JSON', async () => {
    await writeJson('x.json', { a: 1 });
    const result = await readJson<{ a: number }>('x.json');
    expect(result.data).toEqual({ a: 1 });
  });

  it('sinaliza arquivo corrompido em vez de lançar', async () => {
    await getFileSystemGateway().writeTextFile('broken.json', '{ não é json');
    const result = await readJson('broken.json');
    expect(result.corrupted).toBe(true);
    expect(result.data).toBeNull();
  });
});

describe('packRepository', () => {
  it('persiste e recupera pacotes', async () => {
    const pack = createStickerPack({ name: 'Memes' });
    await savePacks([pack]);

    const loaded = await loadPacks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe(pack.id);
    expect(await getPack(pack.id)).toMatchObject({ name: 'Memes' });
  });

  it('faz upsert atualizando o pacote existente', async () => {
    const pack = createStickerPack({ name: 'A' });
    await upsertPack(pack);
    await upsertPack({ ...pack, name: 'B' });
    const loaded = await loadPacks();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe('B');
  });

  it('ignora registros inválidos no índice', async () => {
    await getFileSystemGateway().writeTextFile(
      'library/packs.json',
      JSON.stringify({ schemaVersion: 1, updatedAt: '', packs: [{ nope: true }, { id: 'x' }] }),
    );
    expect(await loadPacks()).toHaveLength(0);
  });

  it('exclui o pacote e apaga o diretório de arquivos', async () => {
    const gateway = getFileSystemGateway();
    const pack = createStickerPack({ name: 'Memes' });
    await savePacks([pack]);
    await gateway.writeBinaryFile(packStickerPath(pack.id, 'sticker_01.webp'), 'AAAA');
    expect(await gateway.exists(packStickerPath(pack.id, 'sticker_01.webp'))).toBe(true);

    await deletePack(pack.id);
    expect(await loadPacks()).toHaveLength(0);
    expect(await gateway.exists(packStickerPath(pack.id, 'sticker_01.webp'))).toBe(false);
  });
});

describe('projectRepository', () => {
  it('salva o documento completo e o resumo leve', async () => {
    const project = createProject('Minha figurinha');
    await saveProject(project);

    expect(await loadProject(project.id)).toMatchObject({ id: project.id, name: 'Minha figurinha' });
    const summaries = await loadProjectSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: project.id, elementCount: 0 });
  });

  it('grava e lê assets do projeto como data URL', async () => {
    const project = createProject('Projeto');
    const path = await writeProjectAsset(project.id, 'foto.png', 'QUJD');
    expect(path).toBe(`projects/${project.id}/assets/foto.png`);

    const dataUrl = await readAssetDataUrlByPath(path);
    expect(dataUrl).toBe('data:image/png;base64,QUJD');
  });

  it('reconhece webp e jpeg pelo caminho', async () => {
    const project = createProject('Projeto');
    const webp = await writeProjectAsset(project.id, 'a.webp', 'QUJD');
    const jpeg = await writeProjectAsset(project.id, 'b.jpeg', 'QUJD');
    expect(await readAssetDataUrlByPath(webp)).toContain('data:image/webp');
    expect(await readAssetDataUrlByPath(jpeg)).toContain('data:image/jpeg');
  });

  it('exclui projeto do índice e remove seus arquivos', async () => {
    const gateway = getFileSystemGateway();
    const project = createProject('Projeto');
    await saveProject(project);
    await writeProjectAsset(project.id, 'foto.png', 'QUJD');

    await deleteProject(project.id);
    expect(await loadProjectSummaries()).toHaveLength(0);
    expect(await gateway.exists(`projects/${project.id}/assets/foto.png`)).toBe(false);
  });

  it('arquiva e restaura um projeto preservando os arquivos', async () => {
    const gateway = getFileSystemGateway();
    const project = createProject('Arquivável');
    await saveProject(project);
    const assetPath = await writeProjectAsset(project.id, 'foto.png', 'QUJD');

    await setProjectHidden(project.id, true);
    const hidden = await loadProjectSummaries();
    expect(hidden[0]?.hidden).toBe(true);
    expect(await gateway.exists(assetPath)).toBe(true);

    await setProjectHidden(project.id, false);
    expect((await loadProjectSummaries())[0]?.hidden).toBe(false);
  });

  it('preserva o estado de arquivamento ao salvar o projeto novamente', async () => {
    const project = createProject('Arquivado');
    await saveProject(project);
    await setProjectHidden(project.id, true);
    await saveProject({ ...project, name: 'Arquivado v2' });
    const summaries = await loadProjectSummaries();
    expect(summaries[0]?.hidden).toBe(true);
    expect(summaries[0]?.name).toBe('Arquivado v2');
  });
});

describe('settingsRepository', () => {
  it('devolve os padrões quando não há arquivo', async () => {
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('persiste e recupera as configurações', async () => {
    await saveSettings({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      confirmDestructiveActions: false,
    });
    const settings = await loadSettings();
    expect(settings).toMatchObject({ theme: 'light', confirmDestructiveActions: false });
  });

  it('saneia valores inválidos e ignora campos de autoria antigos', async () => {
    await getFileSystemGateway().writeTextFile(
      'library/settings.json',
      JSON.stringify({ schemaVersion: 1, settings: { theme: 'neon', authorName: 'Ana' } }),
    );
    const settings = await loadSettings();
    expect(settings.theme).toBe('dark');
    expect('authorName' in settings).toBe(false);
  });
});
