import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../utils/apiError.js';

vi.mock('../models/Publication.js', () => {
  class Publication {
    constructor(data) {
      Object.assign(this, data);
      this._id = data._id ?? 'pub1';
      this.stickers = data.stickers ?? [];
      this.save = vi.fn(async () => this);
    }
  }
  Publication.findById = vi.fn();
  Publication.find = vi.fn();
  Publication.findOne = vi.fn();
  Publication.countDocuments = vi.fn();
  Publication.updateOne = vi.fn();
  return { Publication };
});

vi.mock('../models/Like.js', () => ({ Like: { find: vi.fn() } }));
vi.mock('../models/CollectionEntry.js', () => ({ CollectionEntry: { find: vi.fn() } }));
vi.mock('./v0xService.js', () => ({ uploadFile: vi.fn() }));
vi.mock('./socialAccessService.js', () => ({
  canViewAdultContent: vi.fn(async () => true),
  getBlockedUidSet: vi.fn(async () => new Set()),
  loadAuthorsByUid: vi.fn(async () => new Map()),
  encodeCursor: vi.fn(),
  decodeCursor: vi.fn(),
  applyPublishedCursor: vi.fn((q) => q),
  basePublicPublicationFilter: vi.fn(() => ({})),
  adultContentMongoFilter: vi.fn(() => ({})),
}));

import { Publication } from '../models/Publication.js';
import { createOrUpdateDraft, publishPublication, searchPublications } from './publicationService.js';

describe('publicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejeita título vazio ao criar rascunho', async () => {
    await expect(createOrUpdateDraft('uid-1', { title: '   ' })).rejects.toBeInstanceOf(ApiError);
  });

  it('rejeita busca com termo curto', async () => {
    await expect(searchPublications(null, { q: 'a' })).rejects.toBeInstanceOf(ApiError);
  });

  it('exige mínimo de figurinhas para publicar', async () => {
    const pubId = '507f1f77bcf86cd799439011';
    Publication.findById.mockResolvedValue({
      _id: pubId,
      ownerUid: 'uid-1',
      status: 'active',
      stickers: [{ id: 'a' }, { id: 'b' }],
      save: vi.fn(),
    });
    await expect(publishPublication('uid-1', pubId)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
