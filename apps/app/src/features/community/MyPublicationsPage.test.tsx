import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MyPublicationsPage } from './MyPublicationsPage';

vi.mock('@/services/api/socialApi', () => ({
  fetchMyPublications: vi.fn(),
}));

import { fetchMyPublications } from '@/services/api/socialApi';

describe('MyPublicationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra estado vazio quando não há publicações', async () => {
    vi.mocked(fetchMyPublications).mockResolvedValue({ items: [], nextCursor: null });

    render(
      <MemoryRouter>
        <MyPublicationsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/not published any albums|nenhum álbum/i)).toBeInTheDocument();
    });
  });

  it('lista publicações retornadas pela API', async () => {
    vi.mocked(fetchMyPublications).mockResolvedValue({
      items: [
        {
          id: 'p1',
          ownerUid: 'u1',
          title: 'Meu álbum',
          description: 'Desc',
          cover: null,
          stickerCount: 5,
          visibility: 'public',
          isAdultContent: false,
          publishedAt: '2025-01-01T00:00:00.000Z',
          likeCount: 0,
          commentCount: 0,
          collectionCount: 0,
        },
      ],
      nextCursor: null,
    });

    render(
      <MemoryRouter>
        <MyPublicationsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Meu álbum')).toBeInTheDocument();
    });
  });
});
