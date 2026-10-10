import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PublicationPostCard } from './PublicationPostCard';
import type { PublicationSummary } from '@shappire/contracts';

vi.mock('@/state/authStore', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean; user: { uid: string } }) => unknown) =>
    selector({ isAuthenticated: true, user: { uid: 'owner-1' } }),
}));

const album: PublicationSummary = {
  id: 'pub-1',
  ownerUid: 'owner-1',
  title: 'Pack social',
  description: '',
  cover: null,
  stickerCount: 3,
  visibility: 'public',
  isAdultContent: false,
  publishedAt: '2025-01-01T00:00:00.000Z',
  likeCount: 0,
  commentCount: 0,
  collectionCount: 0,
  author: {
    uid: 'owner-1',
    displayName: 'Eu',
    username: 'eu',
    avatar: null,
    badges: [],
  },
};

describe('PublicationPostCard owner menu', () => {
  it('exibe menu de gerenciamento para o proprietário', () => {
    render(
      <MemoryRouter>
        <PublicationPostCard album={album} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /more actions|mais ações/i })).toBeInTheDocument();
  });
});
