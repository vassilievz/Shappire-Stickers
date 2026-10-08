import { describe, it, expect } from 'vitest';
import { detectImageMimetype } from './magicBytes.js';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 0, 1]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const gif = Buffer.from('GIF89a' + '0000000000');
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

describe('detectImageMimetype', () => {
  it('detecta jpeg', () => {
    expect(detectImageMimetype(jpeg)).toBe('image/jpeg');
  });

  it('detecta png', () => {
    expect(detectImageMimetype(png)).toBe('image/png');
  });

  it('detecta gif (89a)', () => {
    expect(detectImageMimetype(gif)).toBe('image/gif');
  });

  it('detecta gif (87a)', () => {
    const gif87 = Buffer.concat([Buffer.from('GIF87a'), Buffer.alloc(6)]);
    expect(detectImageMimetype(gif87)).toBe('image/gif');
  });

  it('detecta webp', () => {
    expect(detectImageMimetype(webp)).toBe('image/webp');
  });

  it('retorna null para conteúdo arbitrário', () => {
    expect(detectImageMimetype(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(detectImageMimetype(Buffer.alloc(32, 0x41))).toBeNull();
  });

  it('retorna null para buffer curto, não-buffer ou vazio', () => {
    expect(detectImageMimetype(Buffer.from('GIF89a'))).toBeNull();
    expect(detectImageMimetype(null)).toBeNull();
    expect(detectImageMimetype(Buffer.alloc(0))).toBeNull();
    expect(detectImageMimetype('não é buffer')).toBeNull();
  });
});
