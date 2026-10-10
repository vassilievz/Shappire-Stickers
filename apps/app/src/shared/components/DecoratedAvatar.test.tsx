import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DecoratedAvatar } from './DecoratedAvatar';

describe('DecoratedAvatar', () => {
  it('renderiza avatar e camada de decoração', () => {
    const { container } = render(
      <DecoratedAvatar
        src="https://example.com/a.jpg"
        decoration={{
          id: '1',
          url: 'https://example.com/frame.png',
          label: 'Frame',
        }}
      />,
    );
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });
});
