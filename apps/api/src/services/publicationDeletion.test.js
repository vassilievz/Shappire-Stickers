import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../utils/apiError.js';
import { PUBLICATION_VISIBILITY } from '@shappire/contracts';

const pubId = '507f1f77bcf86cd799439011';

function activePub(overrides = {}) {
  return {
    _id: pubId,
    ownerUid: 'owner-1',
    status: 'active',
    visibility: PUBLICATION_VISIBILITY.public,
    publishedAt: new Date('2025-06-01T00:00:00.000Z'),
    stickers: [
      { id: 's1', fileId: 'f1', url: 'https://x/1.png' },
      { id: 's2', fileId: 'f2', url: 'https://x/2.png' },
      { id: 's3', fileId: 'f3', url: 'https://x/3.png' },
    ],
    stickerCount: 3,
    title: 'Album',
    description: '',
    likeCount: 0,
    commentCount: 0,
    collectionCount: 0,
    save: vi.fn(async function save() {
      return this;
    }),
    ...overrides,
  };
}

vi.mock('../models/Publication.js', () => {
  class Publication {}
  Publication.findById = vi.fn();
  Publication.find = vi.fn();
  Publication.findOne = vi.fn();
  return { Publication };
});

vi.mock('../models/Like.js', () => ({ Like: { find: vi.fn(async () => []) } }));
vi.mock('../models/CollectionEntry.js', () => ({ CollectionEntry: { find: vi.fn(async () => []) } }));
vi.mock('../models/Follow.js', () => ({ Follow: { find: vi.fn(async () => []) } }));
vi.mock('./v0xService.js', () => ({}));

vi.mock('./socialAccessService.js', () => ({
  canViewAdultContent: vi.fn(async () => true),
  getBlockedUidSet: vi.fn(async () => new Set()),
  loadAuthorsByUid: vi.fn(async () => new Map()),
  encodeCursor: vi.fn(() => 'cursor'),
  decodeCursor: vi.fn(() => null),
  applyPublishedCursor: vi.fn((q) => q),
  basePublicPublicationFilter: vi.fn(() => ({
    visibility: PUBLICATION_VISIBILITY.public,
    status: 'active',
    publishedAt: { $ne: null },
  })),
}));

import { Publication } from '../models/Publication.js';
import {
  deletePublication,
  getPublicationById,
  getExplore,
  searchPublications,
  listOwnerPublications,
} from './publicationService.js';

describe('publication removal and public queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletePublication marca removido e só o proprietário pode excluir', async () => {
    const doc = activePub();
    Publication.findById.mockResolvedValue(doc);

    await deletePublication('owner-1', pubId);
    expect(doc.status).toBe('removed');
    expect(doc.visibility).toBe(PUBLICATION_VISIBILITY.private);
    expect(doc.publishedAt).toBeNull();
    expect(doc.save).toHaveBeenCalled();

    Publication.findById.mockResolvedValue(activePub());
    await expect(deletePublication('other-user', pubId)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });

  it('deletePublication é idempotente quando já removida', async () => {
    const doc = activePub({ status: 'removed' });
    Publication.findById.mockResolvedValue(doc);

    const result = await deletePublication('owner-1', pubId);
    expect(result).toEqual({ ok: true });
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('getPublicationById retorna 404 para publicação removida', async () => {
    Publication.findById.mockResolvedValue(activePub({ status: 'removed' }));
    await expect(getPublicationById(pubId, null)).rejects.toMatchObject({
      code: 'PUBLICATION_NOT_FOUND',
    });
  });

  it('getExplore não inclui publicações removidas (filtro status active)', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    Publication.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean }),
        }),
      }),
    });

    await getExplore(null, { limit: 20 });
    expect(Publication.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', visibility: PUBLICATION_VISIBILITY.public }),
    );
  });

  it('searchPublications usa o mesmo filtro público com status active', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    Publication.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean }),
        }),
      }),
    });

    await searchPublications(null, { q: 'album' });
    expect(Publication.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'active',
        $text: { $search: 'album' },
      }),
      expect.anything(),
    );
  });

  it('listOwnerPublications para o proprietário lista só documentos active do owner', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    Publication.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean }),
        }),
      }),
    });

    await listOwnerPublications('owner-1', 'owner-1', {});
    expect(Publication.find).toHaveBeenCalledWith(
      expect.objectContaining({ ownerUid: 'owner-1', status: 'active' }),
    );
  });

  it('listOwnerPublications para visitante usa filtro público (sem removidos)', async () => {
    const lean = vi.fn().mockResolvedValue([]);
    Publication.find.mockReturnValue({
      select: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ lean }),
        }),
      }),
    });

    await listOwnerPublications('owner-1', 'visitor-1', {});
    expect(Publication.find).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', ownerUid: 'owner-1' }),
    );
  });
});
