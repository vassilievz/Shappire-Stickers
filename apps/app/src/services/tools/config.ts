const DEFAULT_TOOLS_API_URL = 'https://api.shappire.tools';

export function getToolsApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_SHAPPIRE_TOOLS_API_URL;
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_TOOLS_API_URL;
}
