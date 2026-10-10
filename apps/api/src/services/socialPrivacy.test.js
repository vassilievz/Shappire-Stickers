import { describe, it, expect } from 'vitest';
import { PUBLICATION_VISIBILITY } from '@shappire/contracts';
import { basePublicPublicationFilter, adultContentMongoFilter } from './socialAccessService.js';

describe('social privacy filters', () => {
  it('basePublicPublicationFilter exclui adulto quando não permitido', () => {
    const filter = basePublicPublicationFilter('viewer', {
      allowAdult: false,
      blockedUids: new Set(['blocked-uid']),
    });
    expect(filter.visibility).toBe(PUBLICATION_VISIBILITY.public);
    expect(filter.status).toBe('active');
    expect(filter.isAdultContent).toEqual({ $ne: true });
    expect(filter.ownerUid).toEqual({ $nin: ['blocked-uid'] });
  });

  it('adultContentMongoFilter vazio quando adulto permitido', () => {
    expect(adultContentMongoFilter(true)).toEqual({});
  });
});
