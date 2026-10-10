import catalogJson from '@shappire/contracts/avatar-decoration-catalog.json' with { type: 'json' };

const catalogById = new Map();

function normalizeOverlay(raw) {
  if (!raw || typeof raw !== 'object') {
    return { scale: 1.18, offsetX: 0, offsetY: 0, fit: 'contain' };
  }
  const scale = Number(raw.scale);
  const offsetX = Number(raw.offsetX);
  const offsetY = Number(raw.offsetY);
  const fit = raw.fit === 'cover' ? 'cover' : 'contain';
  return {
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1.18,
    offsetX: Number.isFinite(offsetX) ? offsetX : 0,
    offsetY: Number.isFinite(offsetY) ? offsetY : 0,
    fit,
  };
}

function validateItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? '').trim();
  const url = String(raw.url ?? '').trim();
  const label = String(raw.label ?? '').trim() || id;
  const category = String(raw.category ?? 'decorations').trim() || 'decorations';
  if (!id || !url.startsWith('https://')) return null;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    return null;
  }
  const item = { id, url, label, category, overlay: normalizeOverlay(raw.overlay) };
  if (typeof raw.emoji === 'string' && raw.emoji.trim()) {
    item.emoji = raw.emoji.trim();
  }
  return item;
}

function buildIndex() {
  catalogById.clear();
  const items = Array.isArray(catalogJson.items) ? catalogJson.items : [];
  for (const raw of items) {
    const item = validateItem(raw);
    if (!item || catalogById.has(item.id)) continue;
    catalogById.set(item.id, item);
  }
}

buildIndex();

export function getCatalogResponse() {
  const items = [...catalogById.values()].sort((a, b) => a.label.localeCompare(b.label));
  return {
    version: Number(catalogJson.version) || 1,
    itemCount: items.length,
    licenseNote: String(catalogJson.licenseNote ?? ''),
    items,
  };
}

export function getDecorationById(decorationId) {
  if (!decorationId) return null;
  return catalogById.get(String(decorationId)) ?? null;
}

export function isKnownDecorationId(decorationId) {
  return catalogById.has(String(decorationId ?? ''));
}

export function toActiveDecoration(decorationId) {
  const item = getDecorationById(decorationId);
  if (!item) return null;
  return {
    id: item.id,
    url: item.url,
    label: item.label,
    overlay: item.overlay,
  };
}

/** Expõe validação para testes sem depender do JSON completo. */
export function parseCatalogItem(raw) {
  return validateItem(raw);
}
