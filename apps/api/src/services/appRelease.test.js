import { describe, expect, it } from 'vitest';
import { getAppReleasePayload } from './appRelease.js';

describe('appRelease', () => {
  it('expõe metadados Android com URL da Play Store', () => {
    const payload = getAppReleasePayload();
    expect(payload.android.playStoreUrl).toContain('com.shappire.stickers');
    expect(payload.android.latestVersion).toMatch(/\d+\.\d+\.\d+/);
  });
});
