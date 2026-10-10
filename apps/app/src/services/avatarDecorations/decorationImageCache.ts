type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface Entry {
  state: LoadState;
  promise?: Promise<void>;
}

const entries = new Map<string, Entry>();

function entryFor(url: string): Entry {
  let entry = entries.get(url);
  if (!entry) {
    entry = { state: 'idle' };
    entries.set(url, entry);
  }
  return entry;
}

/**
 * Pré-carrega uma imagem de decoração (deduplica requisições simultâneas).
 * Usa Image() para aproveitar cache HTTP do WebView.
 */
export function preloadDecorationImage(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return Promise.resolve();

  const entry = entryFor(trimmed);
  if (entry.state === 'loaded') return Promise.resolve();
  if (entry.state === 'loading' && entry.promise) return entry.promise;

  entry.state = 'loading';
  entry.promise = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    const finish = (state: LoadState) => {
      entry.state = state;
      entry.promise = undefined;
      resolve();
    };
    img.onload = () => finish('loaded');
    img.onerror = () => finish('error');
    img.src = trimmed;
  });

  return entry.promise;
}

export function getDecorationLoadState(url: string | null | undefined): LoadState {
  if (!url) return 'idle';
  return entryFor(url.trim()).state;
}

export function markDecorationLoaded(url: string): void {
  const entry = entryFor(url.trim());
  entry.state = 'loaded';
}

export function resetDecorationImageCache(): void {
  entries.clear();
}
