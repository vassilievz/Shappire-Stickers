import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InitialSupporterBadge, InitialSupporterIcon } from './InitialSupporterBadge';

describe('InitialSupporterBadge', () => {
  it('renderiza o ícone SVG com acessibilidade e gradiente', () => {
    const { container } = render(<InitialSupporterBadge size="md" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(screen.getByLabelText(/Apoiador Inicial|Initial Supporter/i)).toBeInTheDocument();
  });

  it('renderiza com texto quando showLabel é true', () => {
    render(<InitialSupporterBadge showLabel size="sm" />);
    expect(screen.getByText(/Apoiador Inicial|Initial Supporter/i)).toBeInTheDocument();
  });

  it('InitialSupporterIcon renderiza ambos os paths com geometria correta', () => {
    const { container } = render(<InitialSupporterIcon size="lg" />);
    const paths = container.querySelectorAll('path');
    expect(paths).toHaveLength(2);
    expect(paths[0]?.getAttribute('d')).toContain('M5.7401 16');
    expect(paths[1]?.getAttribute('d')).toContain('M18.7 14.4599');
  });
});
