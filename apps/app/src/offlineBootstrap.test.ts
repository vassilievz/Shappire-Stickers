import { describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)));

describe('offline bootstrap', () => {
  it('não mantém cliente HTTP da API no código-fonte', () => {
    expect(existsSync(path.join(srcRoot, 'services', 'api'))).toBe(false);
    expect(existsSync(path.join(srcRoot, 'services', 'firebase'))).toBe(false);
  });

  it('analytics local é no-op', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { logAnalyticsEvent } = await import('@/services/logging/analytics');
    await logAnalyticsEvent('test_event');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
