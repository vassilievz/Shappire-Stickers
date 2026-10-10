import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUBLICATION_VISIBILITY } from '@shappire/contracts';

const pubId = '507f1f77bcf86cd799439011';

function makeDoc() {
  const stickers = [
    { id: '1', fileId: 'f1', url: 'https://cdn/1.png' },
    { id: '2', fileId: 'f2', url: 'https://cdn/2.png' },
    { id: '3', fileId: 'f3', url: 'https://cdn/3.png' },
    { id: '4', fileId: 'f4', url: 'https://cdn/4.png' },
  ];
  return {
    _id: pubId,
    ownerUid: 'creator-1',
    status: 'active',
    visibility: PUBLICATION_VISIBILITY.private,
    publishedAt: null,
    stickers,
    stickerCount: 0,
    title: 'Quatro stickers',
    description: '',
    likeCount: 0,
    commentCount: 0,
    collectionCount: 0,
    save: vi.fn(async function save() {
      return this;
    }),
  };
}

vi.mock('../models/Publication.js', () => {
  class Publication {}
  Publication.findById = vi.fn();
  return { Publication };
});

vi.mock('../models/Like.js', () => ({ Like: { find: vi.fn(async () => []) } }));
vi.mock('../models/CollectionEntry.js', () => ({ CollectionEntry: { find: vi.fn(async () => []) } }));
vi.mock('./v0xService.js', () => ({}));
vi.mock('./socialAccessService.js', () => ({
  canViewAdultContent: vi.fn(async () => true),
  getBlockedUidSet: vi.fn(async () => new Set()),
  loadAuthorsByUid: vi.fn(async (uids) => {
    const map = new Map();
    for (const uid of uids) {
      map.set(uid, {
        uid,
        displayName: 'Criador Teste',
        username: 'criador_teste',
        avatar: { url: 'https://cdn/avatar.png' },
        badges: [],
      });
    }
    return map;
  }),
  encodeCursor: vi.fn(),
  decodeCursor: vi.fn(),
  applyPublishedCursor: vi.fn((q) => q),
  basePublicPublicationFilter: vi.fn(() => ({})),
}));

import { Publication } from '../models/Publication.js';
import { publishPublication, getPublicationById, effectiveStickerCount } from './publicationService.js';

describe('publication lifecycle (mocked persistence)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publicar pacote com quatro figurinhas corrige stickerCount e expõe galeria completa', async () => {
    const doc = makeDoc();
    Publication.findById.mockResolvedValue(doc);

    const published = await publishPublication('creator-1', pubId);
    expect(doc.stickerCount).toBe(4);
    expect(published.stickerCount).toBe(4);
    expect(published.stickers).toHaveLength(4);
    expect(published.stickers.map((s) => s.id)).toEqual(['1', '2', '3', '4']);

    doc.visibility = PUBLICATION_VISIBILITY.public;
    doc.publishedAt = new Date();
    const detail = await getPublicationById(pubId, null);
    expect(detail.stickerCount).toBe(4);
    expect(detail.author?.username).toBe('criador_teste');
    expect(effectiveStickerCount(doc)).toBe(4);
  });
});
