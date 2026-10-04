import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryFileSystemGateway } from './memoryFileSystem';
import { getFileSystemGateway, setFileSystemGateway } from './gateway';
import { savePacks } from './packRepository';
import { saveProject } from './projectRepository';
import { computeStorageBreakdown, cleanAbandonedFiles, cleanRecreatableCache } from './storageStats';
import { createStickerPack } from '@/domain/stickerPack';
import { createProject } from '@/domain/project';
import { packStickerPath } from './paths';

const FIVE_BYTES = 'QUJDREU=';
const THREE_BYTES = 'QUJD';

async function seed(): Promise<{ projectId: string; packId: string }> {
  const gateway = getFileSystemGateway();
  const project = createProject('Real');
  await saveProject(project);
  await gateway.writeBinaryFile(`projects/${project.id}/assets/a.bin`, FIVE_BYTES);

  const pack = createStickerPack({ name: 'Pack' });
  await savePacks([pack]);
  await gateway.writeBinaryFile(packStickerPath(pack.id, 's.webp'), THREE_BYTES);

  await gateway.writeBinaryFile('projects/orphan/leak.bin', THREE_BYTES);
  await gateway.writeBinaryFile('sticker_packs/orphan_pack/x.webp', THREE_BYTES);
  await gateway.writeBinaryFile('cache/thumbnails/t.webp', THREE_BYTES);
  await gateway.writeBinaryFile('tmp/draft.bin', THREE_BYTES);

  return { projectId: project.id, packId: pack.id };
}

beforeEach(() => {
  setFileSystemGateway(createMemoryFileSystemGateway());
});

describe('storageStats', () => {
  it('mede cada categoria a partir dos arquivos reais', async () => {
    await seed();
    const breakdown = await computeStorageBreakdown();

    expect(breakdown.measured).toBe(true);
    expect(breakdown.projectsBytes).toBeGreaterThanOrEqual(5);
    expect(breakdown.packsBytes).toBe(6);
    expect(breakdown.cacheBytes).toBe(3);
    expect(breakdown.tempBytes).toBe(3);
    expect(breakdown.libraryBytes).toBeGreaterThan(0);
    expect(breakdown.totalBytes).toBe(
      breakdown.projectsBytes +
        breakdown.packsBytes +
        breakdown.cacheBytes +
        breakdown.tempBytes +
        breakdown.libraryBytes,
    );
  });

  it('limpa apenas o cache recriável e é idempotente', async () => {
    const { projectId, packId } = await seed();
    const gateway = getFileSystemGateway();

    const first = await cleanRecreatableCache();
    expect(first.freedBytes).toBe(3);
    expect(await gateway.exists('cache/thumbnails/t.webp')).toBe(false);
    expect(await gateway.exists(`projects/${projectId}/assets/a.bin`)).toBe(true);
    expect(await gateway.exists(packStickerPath(packId, 's.webp'))).toBe(true);

    const second = await cleanRecreatableCache();
    expect(second.freedBytes).toBe(0);
  });

  it('remove temporários e diretórios órfãos, preservando itens indexados', async () => {
    const { projectId, packId } = await seed();
    const gateway = getFileSystemGateway();

    const result = await cleanAbandonedFiles();

    expect(result.freedBytes).toBeGreaterThanOrEqual(6);
    expect(await gateway.exists('tmp/draft.bin')).toBe(false);
    expect(await gateway.exists('projects/orphan/leak.bin')).toBe(false);
    expect(await gateway.exists('sticker_packs/orphan_pack/x.webp')).toBe(false);
    expect(await gateway.exists(`projects/${projectId}/assets/a.bin`)).toBe(true);
    expect(await gateway.exists(packStickerPath(packId, 's.webp'))).toBe(true);

    const again = await cleanAbandonedFiles();
    expect(again.freedBytes).toBe(0);
  });
});
