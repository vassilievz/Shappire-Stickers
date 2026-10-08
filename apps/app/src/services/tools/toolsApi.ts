import { getToolsApiBaseUrl } from './config';
import type { DownloadApiResponse, DownloadSuccessResult, RequestDownloadOptions } from './types';

export class ToolsApiError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message || code);
    this.name = 'ToolsApiError';
  }
}

export function resolveToolsUrl(url: string, baseUrl = getToolsApiBaseUrl()): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
}

export async function requestMediaDownload(
  options: RequestDownloadOptions,
): Promise<DownloadSuccessResult> {
  const baseUrl = getToolsApiBaseUrl();
  const payload = {
    url: options.url.trim(),
    downloadMode: options.downloadMode || 'auto',
    videoQuality: options.videoQuality || '1080',
    audioFormat: options.audioFormat || 'mp3',
    audioBitrate: options.audioBitrate || '128',
    filenameStyle: options.filenameStyle || 'pretty',
    convertGif: options.convertGif ?? true,
    disableMetadata: options.disableMetadata ?? false,
    tiktokFullAudio: options.tiktokFullAudio ?? false,
    alwaysProxy: options.alwaysProxy ?? false,
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    throw new ToolsApiError(
      'error.api.connection',
      error instanceof Error ? error.message : 'Network error connecting to Shappire Tools',
    );
  }

  let data: DownloadApiResponse | null = null;
  try {
    data = (await response.json()) as DownloadApiResponse;
  } catch {
    // Non-JSON response
  }

  if (!response.ok || !data || data.status === 'error') {
    const errorCode =
      data && data.status === 'error' && typeof data.error?.code === 'string'
        ? data.error.code
        : response.status === 502
          ? 'error.api.upstream.unavailable'
          : response.status === 429
            ? 'error.api.rate_limited'
            : 'error.api.generic';

    throw new ToolsApiError(errorCode);
  }

  return data;
}

export function triggerBrowserDownload(url: string, filename?: string): void {
  const resolvedUrl = resolveToolsUrl(url);
  const anchor = document.createElement('a');
  anchor.href = resolvedUrl;
  if (filename) {
    anchor.download = filename;
  }
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  const resolved = resolveToolsUrl(imageUrl);
  const response = await fetch(resolved);
  if (!response.ok) {
    throw new ToolsApiError('error.media.fetch_failed', `Failed to fetch image: ${response.status}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new ToolsApiError('error.media.conversion_failed', 'Failed to convert blob to data URL'));
      }
    };
    reader.onerror = () => {
      reject(new ToolsApiError('error.media.conversion_failed', 'Failed to read image blob'));
    };
    reader.readAsDataURL(blob);
  });
}
