import { API_ROUTES, type AppReleaseResponse } from '@shappire/contracts';
import { apiRequest } from './client';

let cachedRelease: AppReleaseResponse | null = null;
let inflight: Promise<AppReleaseResponse> | null = null;

export async function fetchAppRelease(): Promise<AppReleaseResponse> {
  if (cachedRelease) return cachedRelease;
  if (inflight) return inflight;

  inflight = apiRequest(API_ROUTES.appRelease)
    .then((res) => {
      cachedRelease = res.body as AppReleaseResponse;
      return cachedRelease;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function resetAppReleaseCache(): void {
  cachedRelease = null;
  inflight = null;
}
