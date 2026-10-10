import {
  API_ROUTES,
  type CursorPage,
  type PublicationDetail,
  type PublicationSummary,
  type PublicAuthor,
  type PublicProfile,
  type SocialPreferences,
} from '@shappire/contracts';
import { apiRequest, getApiBaseUrl } from './client';
import { getAuthToken } from './client';

type Page<T> = CursorPage<T>;

export async function fetchSocialPreferences(): Promise<SocialPreferences> {
  const { body } = await apiRequest(API_ROUTES.socialPreferences);
  return body as SocialPreferences;
}

export async function updateSocialPreferences(patch: Partial<SocialPreferences>): Promise<SocialPreferences> {
  const { body } = await apiRequest(API_ROUTES.socialPreferences, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return body as SocialPreferences;
}

export async function confirmAdultEligibility(): Promise<SocialPreferences> {
  const { body } = await apiRequest(API_ROUTES.socialAdultEligibility, {
    method: 'POST',
    body: JSON.stringify({ confirmed: true }),
  });
  return body as SocialPreferences;
}

export async function fetchFeed(cursor?: string | null): Promise<Page<PublicationSummary>> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { body } = await apiRequest(`${API_ROUTES.feed}${qs}`);
  return body as Page<PublicationSummary>;
}

export interface SocialSearchResponse {
  publications: Page<PublicationSummary>;
  profiles: { items: PublicAuthor[]; nextCursor: string | null };
}

export async function searchSocial(
  q: string,
  cursor?: string | null,
): Promise<SocialSearchResponse> {
  const params = new URLSearchParams();
  params.set('q', q.trim());
  if (cursor) params.set('cursor', cursor);
  const { body } = await apiRequest(`${API_ROUTES.search}?${params}`, { auth: 'optional' });
  return body as SocialSearchResponse;
}

export async function fetchExplore(
  cursor?: string | null,
  sort: 'recent' | 'likes' | 'collections' = 'recent',
): Promise<Page<PublicationSummary>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (sort !== 'recent') params.set('sort', sort);
  const qs = params.toString() ? `?${params}` : '';
  const { body } = await apiRequest(`${API_ROUTES.explore}${qs}`, { auth: 'optional' });
  return body as Page<PublicationSummary>;
}

export async function fetchPublication(id: string): Promise<PublicationDetail> {
  const { body } = await apiRequest(API_ROUTES.publication(id), { auth: 'optional' });
  return body as PublicationDetail;
}

export async function upsertPublicationDraft(input: Record<string, unknown>): Promise<PublicationDetail> {
  const { body } = await apiRequest(API_ROUTES.publications, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return body as PublicationDetail;
}

export async function publishPublication(id: string): Promise<PublicationDetail> {
  const { body } = await apiRequest(API_ROUTES.publicationPublish(id), { method: 'POST' });
  return body as PublicationDetail;
}

export async function unpublishPublication(id: string): Promise<PublicationDetail> {
  const { body } = await apiRequest(`/api/publications/${id}/unpublish`, { method: 'POST' });
  return body as PublicationDetail;
}

export async function deletePublication(id: string): Promise<void> {
  await apiRequest(API_ROUTES.publication(id), { method: 'DELETE' });
}

export async function uploadPublicationSticker(
  publicationId: string,
  stickerId: string,
  file: Blob,
  meta: Record<string, string | number | boolean | string[]>,
): Promise<PublicationDetail> {
  const token = await getAuthToken();
  const form = new FormData();
  form.append('file', file);
  if (meta.fileName) form.append('fileName', String(meta.fileName));
  if (meta.emojis) form.append('emojis', JSON.stringify(meta.emojis));
  if (meta.accessibilityText) form.append('accessibilityText', String(meta.accessibilityText));
  if (meta.width) form.append('width', String(meta.width));
  if (meta.height) form.append('height', String(meta.height));
  if (meta.isAnimated) form.append('isAnimated', String(meta.isAnimated));
  if (meta.durationMs) form.append('durationMs', String(meta.durationMs));

  const response = await fetch(`${getApiBaseUrl()}${API_ROUTES.publicationSticker(publicationId, stickerId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(typeof payload?.message === 'string' ? payload.message : 'Falha no upload.');
  }
  return (await response.json()) as PublicationDetail;
}

export async function likePublication(id: string): Promise<{ liked: boolean; likeCount: number }> {
  const { body } = await apiRequest(API_ROUTES.like(id), { method: 'POST' });
  return body as { liked: boolean; likeCount: number };
}

export async function unlikePublication(id: string): Promise<{ liked: boolean; likeCount: number }> {
  const { body } = await apiRequest(API_ROUTES.like(id), { method: 'DELETE' });
  return body as { liked: boolean; likeCount: number };
}

export async function collectPublication(id: string): Promise<{ collected: boolean; publication: PublicationDetail }> {
  const { body } = await apiRequest(API_ROUTES.collect(id), { method: 'POST' });
  return body as { collected: boolean; publication: PublicationDetail };
}

export async function fetchComments(publicationId: string, cursor?: string | null) {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { body } = await apiRequest(`${API_ROUTES.comments(publicationId)}${qs}`, { auth: 'optional' });
  return body as Page<{
    id: string;
    body: string;
    createdAt: string | null;
    editedAt: string | null;
    author: PublicProfile;
  }>;
}

export async function postComment(publicationId: string, text: string) {
  const { body } = await apiRequest(API_ROUTES.comments(publicationId), {
    method: 'POST',
    body: JSON.stringify({ body: text }),
  });
  return body;
}

export async function followUser(uid: string) {
  const { body } = await apiRequest(API_ROUTES.follow(uid), { method: 'POST' });
  return body as { following: boolean };
}

export async function unfollowUser(uid: string) {
  const { body } = await apiRequest(API_ROUTES.follow(uid), { method: 'DELETE' });
  return body as { following: boolean };
}

export async function fetchPublicProfile(username: string): Promise<PublicProfile> {
  const { body } = await apiRequest(API_ROUTES.publicUser(username), { auth: 'optional' });
  return body as PublicProfile;
}

export async function submitReport(input: {
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
}) {
  const { body } = await apiRequest(API_ROUTES.report, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return body;
}

export async function blockUser(uid: string) {
  const { body } = await apiRequest(API_ROUTES.block(uid), { method: 'POST' });
  return body;
}

export async function unblockUser(uid: string) {
  const { body } = await apiRequest(API_ROUTES.block(uid), { method: 'DELETE' });
  return body;
}

export async function fetchFollowers(
  uid: string,
  cursor?: string | null,
): Promise<Page<PublicAuthor>> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { body } = await apiRequest(`${API_ROUTES.followers(uid)}${qs}`, { auth: 'optional' });
  return body as Page<PublicAuthor>;
}

export async function fetchFollowing(
  uid: string,
  cursor?: string | null,
): Promise<Page<PublicAuthor>> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const { body } = await apiRequest(`${API_ROUTES.following(uid)}${qs}`, { auth: 'optional' });
  return body as Page<PublicAuthor>;
}
