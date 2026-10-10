import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';
import { APP_INFO, APP_LIMITS } from './app';
import { EDITOR_CONFIG } from './editor';
import { WHATSAPP_LIMITS } from './whatsapp';

describe('configuração do aplicativo', () => {
  it('mantém a versão sincronizada com o package.json', () => {
    expect(APP_INFO.version).toBe(packageJson.version);
  });

  it('respeita os limites oficiais do WhatsApp', () => {
    expect(WHATSAPP_LIMITS.STICKER_DIMENSION).toBe(512);
    expect(WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK).toBe(3);
    expect(WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK).toBe(30);
    expect(WHATSAPP_LIMITS.STATIC_STICKER_MAX_BYTES).toBe(100 * 1024);
    expect(WHATSAPP_LIMITS.TRAY_IMAGE_SIZE).toBe(96);
    expect(WHATSAPP_LIMITS.TRAY_IMAGE_MAX_BYTES).toBe(50 * 1024);
  });

  it('mantém o canvas do editor no tamanho exigido (512x512)', () => {
    expect(EDITOR_CONFIG.canvasSize).toBe(WHATSAPP_LIMITS.STICKER_DIMENSION);
  });

  it('permite manter projetos suficientes para a tela inicial', () => {
    expect(APP_LIMITS.maxStoredProjects).toBeGreaterThan(APP_LIMITS.recentProjects);
  });

  it('possui o link oficial do Discord da comunidade configurado', () => {
    expect(APP_INFO.discordCommunityUrl).toBe('https://discord.gg/ncT9S6TZ9e');
    expect(APP_INFO.publicDownloadUrl).toBe('https://shappire.tools/stickers');
  });
});
