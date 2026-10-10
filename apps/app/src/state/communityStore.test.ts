import { describe, expect, it, beforeEach } from 'vitest';
import { useCommunityStore } from './communityStore';

describe('communityStore', () => {
  beforeEach(() => {
    useCommunityStore.setState({ listVersion: 0, removedPublicationIds: [] });
  });

  it('markPublicationRemoved impede reintrodução lógica na lista', () => {
    const id = 'pub-removed';
    useCommunityStore.getState().markPublicationRemoved(id);
    const blocked = new Set(useCommunityStore.getState().removedPublicationIds);
    const merged = [
      { id: 'a' },
      { id },
      { id: 'b' },
    ].filter((p) => !blocked.has(p.id));
    expect(merged.map((p) => p.id)).toEqual(['a', 'b']);
    expect(useCommunityStore.getState().listVersion).toBeGreaterThan(0);
  });

  it('clearRemoved permite recarregar após nova publicação', () => {
    const id = 'pub-1';
    useCommunityStore.getState().markPublicationRemoved(id);
    useCommunityStore.getState().clearRemoved(id);
    expect(useCommunityStore.getState().removedPublicationIds).not.toContain(id);
  });
});
