import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { PublicAuthor } from '@shappire/contracts';
import { CreatorHeader } from './CreatorHeader';
function renderHeader(author: PublicAuthor) {
  return render(
    <MemoryRouter>
      <CreatorHeader author={author} publishedAt="2025-01-01T12:00:00.000Z" />
    </MemoryRouter>,
  );
}

describe('CreatorHeader', () => {
  it('links avatar and identity to public profile when username exists', () => {
    renderHeader({
      uid: 'u1',
      displayName: 'Ana',
      username: 'ana_criador',
      avatar: { url: 'https://example.com/a.png', fileId: 'av1', mimeType: 'image/png' },
      badges: [],
    });
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/comunidade/criador/ana_criador');
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('@ana_criador')).toBeInTheDocument();
  });

  it('renders without link when username is missing', () => {
    renderHeader({
      uid: 'u2',
      displayName: 'Sem username',
      username: null,
      avatar: null,
      badges: [],
    });
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Sem username')).toBeInTheDocument();
  });
});
