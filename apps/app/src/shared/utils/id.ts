

const HEX = '0123456789abcdef';

function randomHex(length: number): string {
  const cryptoApi = globalThis.crypto;
  const bytes = new Uint8Array(length);
  if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (const byte of bytes) {
    out += HEX[(byte & 0x0f) as number];
    out += HEX[(byte >> 4) as number];
  }
  return out.slice(0, length);
}


export function createId(prefix = 'id'): string {
  return `${prefix}_${randomHex(12)}`;
}


export function createPackIdentifier(): string {
  return `shappire_${randomHex(8)}`;
}


export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
