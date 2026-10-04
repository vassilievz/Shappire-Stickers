import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryFileSystemGateway } from '@/services/storage/memoryFileSystem';
import { getFileSystemGateway, setFileSystemGateway } from '@/services/storage/gateway';
import { loadPacks, savePacks } from '@/services/storage/packRepository';
import { loadProjectSummaries, saveProject, setProjectHidden } from '@/services/storage/projectRepository';
import { createStickerPack, type StickerPack, type StickerRecord } from '@/domain/stickerPack';
import { createProject } from '@/domain/project';
import {
  clearProjectReferences,
  countProjectReferences,
  removeProjectPermanently,
} from './projectService';

function sticker(id: string, projectId: string | null): StickerRecord {
  return {
    id,
    fileName: `${id}.webp`,
    width: 512,
    height: 512,
    sizeBytes: 1024,
    emojis: ['✨'],
    accessibilityText: '',
    createdAt: new Date().toISOString(),
    projectId,
    hasDrawing: false,
  };
}

function packWithStickers(id: string, stickers: StickerRecord[]): StickerPack {
  return { ...createStickerPack({ name: id }), id, stickers };
}

beforeEach(() => {
  setFileSystemGateway(createMemoryFileSystemGateway());
});

describe('projectService', () => {
  it('conta e limpa referências de figurinhas ao projeto', async () => {
    const project = createProject('Origem');
    await savePacks([packWithStickers('pack_a', [sticker('s1', project.id), sticker('s2', null)])]);

    expect(await countProjectReferences(project.id)).toBe(1);
    const cleared = await clearProjectReferences(project.id);
    expect(cleared).toBe(1);

    const packs = await loadPacks();
    expect(packs[0]?.stickers.find((s) => s.id === 's1')?.projectId).toBeNull();
  });

  it('exclui o projeto, limpa referências e preserva o pacote', async () => {
    const gateway = getFileSystemGateway();
    const project = createProject('Excluir');
    await saveProject(project);
    await gateway.writeBinaryFile(`projects/${project.id}/assets/foto.png`, 'QUJD');
    await savePacks([packWithStickers('pack_b', [sticker('s1', project.id)])]);

    const remaining = await removeProjectPermanently(project.id);

    expect(remaining).toHaveLength(0);
    expect(await gateway.exists(`projects/${project.id}`)).toBe(false);
    const packs = await loadPacks();
    expect(packs).toHaveLength(1);
    expect(packs[0]?.stickers[0]?.projectId).toBeNull();
  });

  it('é idempotente: excluir duas vezes não lança', async () => {
    const project = createProject('Duplo');
    await saveProject(project);
    await removeProjectPermanently(project.id);
    await expect(removeProjectPermanently(project.id)).resolves.toEqual([]);
  });

  it('mantém arquivamento e restauração sem tocar arquivos', async () => {
    const project = createProject('Arquivo');
    await saveProject(project);
    await setProjectHidden(project.id, true);
    expect((await loadProjectSummaries())[0]?.hidden).toBe(true);
    await setProjectHidden(project.id, false);
    expect((await loadProjectSummaries())[0]?.hidden).toBe(false);
  });
});
