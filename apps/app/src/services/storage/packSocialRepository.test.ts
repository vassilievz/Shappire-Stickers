import { describe, expect, it } from 'vitest';
import { isImportedPackSocial } from './packSocialRepository';

describe('packSocialRepository', () => {
  it('isImportedPackSocial identifica cópias importadas', () => {
    expect(
      isImportedPackSocial({
        publicationId: 'p1',
        visibility: 'public',
        lastSyncedAt: '2025-01-01T00:00:00.000Z',
        importedAt: '2025-01-02T00:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      isImportedPackSocial({
        publicationId: 'p1',
        visibility: 'public',
        lastSyncedAt: '2025-01-01T00:00:00.000Z',
        sourceAuthorName: 'Criador',
      }),
    ).toBe(true);
    expect(
      isImportedPackSocial({
        publicationId: 'p1',
        visibility: 'public',
        lastSyncedAt: '2025-01-01T00:00:00.000Z',
      }),
    ).toBe(false);
  });
});
