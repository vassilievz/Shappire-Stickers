import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DonationsPage } from './DonationsPage';
import { useAuthStore } from '@/state/authStore';
import * as donationApi from '@/services/api/donationApi';

vi.mock('@/services/api/donationApi', () => ({
  createDonation: vi.fn(),
  getDonationStatus: vi.fn(),
  getMyDonations: vi.fn(),
}));

vi.mock('@/services/native/clipboard', () => ({
  writeClipboardText: vi.fn().mockResolvedValue(undefined),
  readClipboardText: vi.fn().mockResolvedValue(''),
}));

vi.mock('@/services/firebase', () => ({
  logAnalyticsEvent: vi.fn(),
}));

describe('DonationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exibe solicitação de login se usuário não estiver autenticado', () => {
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      profile: null,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <DonationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Faça login para apoiar|Sign in to support/i)).toBeInTheDocument();
  });

  it('exibe seletor de valores e botão para usuário autenticado', () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        uid: 'user-1',
        email: 'user1@example.com',
        displayName: 'Test User',
        photoURL: null,
      },
      profile: {
        uid: 'user-1',
        email: 'user1@example.com',
        displayName: 'Test User',
        photoURL: null,
        username: 'testuser',
        bio: '',
        avatar: null,
        banner: null,
        badges: [],
      },
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <DonationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Apoiar o Shappire|Support Shappire/i)).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar para o PIX|Continue to PIX/i })).toBeInTheDocument();
  });

  it('inicia doação e renderiza o QR Code e código copia e cola', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      user: {
        uid: 'user-1',
        email: 'user1@example.com',
        displayName: 'Test User',
        photoURL: null,
      },
      profile: null,
      isLoading: false,
    });

    vi.mocked(donationApi.createDonation).mockResolvedValue({
      donationId: 'don-123',
      amount: 20,
      copyPaste: '00020126580014br.gov.bcb.pix...',
      expiresAt: '2026-10-11T00:00:00Z',
      status: 'PENDING',
    });

    render(
      <MemoryRouter>
        <DonationsPage />
      </MemoryRouter>,
    );

    const submitBtn = screen.getByRole('button', { name: /Continuar para o PIX|Continue to PIX/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(donationApi.createDonation).toHaveBeenCalledWith(20);
    });

    // Deve exibir instruções do PIX e botão de copiar
    expect(await screen.findByText(/Copiar código PIX|Copy PIX code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/QR Code PIX para pagamento|PIX QR Code for payment/i)).toBeInTheDocument();
  });
});
