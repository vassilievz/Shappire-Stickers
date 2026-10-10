import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCursor = {
  docs: [],
  async *[Symbol.asyncIterator]() {
    for (const doc of this.docs) yield doc;
  },
};

vi.mock('../models/Publication.js', () => {
  const cursorFactory = () => mockCursor;
  return {
    Publication: {
      find: vi.fn(() => ({
        select: vi.fn(() => ({
          cursor: cursorFactory,
        })),
      })),
      updateOne: vi.fn(async () => ({ acknowledged: true })),
    },
  };
});

import { Publication } from '../models/Publication.js';
import { reconcilePublicationStickerCounts } from './reconcilePublicationStickerCounts.js';

describe('reconcilePublicationStickerCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCursor.docs = [];
  });

  it('atualiza stickerCount quando diverge do array materializado', async () => {
    mockCursor.docs = [
      { _id: 'id1', stickerCount: 1, stickers: [{ id: 'a', fileId: 'f1' }, { id: 'b', fileId: 'f2' }] },
    ];
    const result = await reconcilePublicationStickerCounts();
    expect(result.updated).toBe(1);
    expect(Publication.updateOne).toHaveBeenCalledWith(
      { _id: 'id1' },
      { $set: { stickerCount: 2 } },
    );
  });

  it('é idempotente quando já está coerente', async () => {
    mockCursor.docs = [
      { _id: 'id2', stickerCount: 2, stickers: [{ id: 'a', fileId: 'f1' }, { id: 'b', fileId: 'f2' }] },
    ];
    const first = await reconcilePublicationStickerCounts();
    const second = await reconcilePublicationStickerCounts();
    expect(first.updated).toBe(0);
    expect(second.updated).toBe(0);
    expect(Publication.updateOne).not.toHaveBeenCalled();
  });

  it('corrige stickerCount positivo incorreto com quatro stickers', async () => {
    mockCursor.docs = [
      {
        _id: 'id3',
        stickerCount: 1,
        stickers: [
          { id: '1', fileId: 'f1' },
          { id: '2', fileId: 'f2' },
          { id: '3', fileId: 'f3' },
          { id: '4', fileId: 'f4' },
        ],
      },
    ];
    await reconcilePublicationStickerCounts();
    expect(Publication.updateOne).toHaveBeenCalledWith(
      { _id: 'id3' },
      { $set: { stickerCount: 4 } },
    );
  });
});
