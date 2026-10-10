/**
 * Contratos compartilhados entre o app Shappire Stickers (apps/app) e a API
 * Shappire (apps/api). Fonte única de verdade para limites, formatos, rotas e
 * códigos de erro — evita que os dois lados driftam.
 */

export const USERNAME_MIN_LENGTH: number;
export const USERNAME_MAX_LENGTH: number;
export const USERNAME_PATTERN: RegExp;

/** Remove espaços, acentos e converte para minúsculas (mesma regra do app). */
export function normalizeUsername(value: string): string;

export const MAX_DISPLAY_NAME_LENGTH: number;
export const MAX_BIO_LENGTH: number;
export const MAX_ALBUM_DESCRIPTION_LENGTH: number;
export const MAX_COMMENT_LENGTH: number;
export const MAX_REPORT_DETAILS_LENGTH: number;
export const PUBLICATION_SEARCH_MAX_LENGTH: number;
export const PUBLICATION_STICKER_MAX_BYTES: number;
export const PUBLICATION_COVER_MAX_BYTES: number;
export const PUBLICATION_MIN_STICKERS: number;
export const PUBLICATION_MAX_STICKERS: number;

export const PUBLICATION_VISIBILITY: {
  readonly public: 'public';
  readonly private: 'private';
};

export type PublicationVisibility = (typeof PUBLICATION_VISIBILITY)[keyof typeof PUBLICATION_VISIBILITY];

export const REPORT_REASONS: readonly string[];
export const REPORT_TARGET_TYPES: {
  readonly publication: 'publication';
  readonly comment: 'comment';
  readonly user: 'user';
};

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[keyof typeof REPORT_TARGET_TYPES];

export interface ProfileImageMaxBytes {
  readonly avatar: number;
  readonly banner: number;
}
export const PROFILE_IMAGE_MAX_BYTES: ProfileImageMaxBytes;

export const PROFILE_IMAGE_MIME_TYPES: readonly string[];

export const INITIAL_SUPPORTER_BADGE = 'initial_supporter';
export const DONATION_AMOUNTS: readonly number[];
export const DONATION_MIN_AMOUNT: number;
export const DONATION_MAX_AMOUNT: number;

export interface ApiRoutes {
  readonly health: '/health';
  readonly profile: '/api/profile';
  readonly avatar: '/api/profile/avatar';
  readonly banner: '/api/profile/banner';
  readonly donations: '/api/donations';
  readonly myDonations: '/api/donations/me';
  readonly socialPreferences: '/api/social/preferences';
  readonly socialAdultEligibility: '/api/social/preferences/adult-eligibility';
  readonly publications: '/api/publications';
  readonly publicationsMine: '/api/publications/mine';
  publication(id: string): string;
  publicationPublish(id: string): string;
  publicationSticker(id: string, stickerId: string): string;
  publicationCover(id: string): string;
  readonly feed: '/api/social/feed';
  readonly explore: '/api/social/explore';
  readonly search: '/api/social/search';
  follow(uid: string): string;
  followers(uid: string): string;
  following(uid: string): string;
  publicUser(username: string): string;
  like(publicationId: string): string;
  comments(publicationId: string): string;
  comment(publicationId: string, commentId: string): string;
  collect(publicationId: string): string;
  readonly report: '/api/social/reports';
  block(uid: string): string;
}
export const API_ROUTES: ApiRoutes;

export const API_ERROR_CODES: readonly string[];

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'PROFILE_NOT_FOUND'
  | 'USERNAME_TAKEN'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UPLOAD_FAILED'
  | 'INTERNAL_ERROR'
  | 'DONATION_NOT_FOUND'
  | 'PAYMENT_GATEWAY_ERROR'
  | 'INVALID_AMOUNT'
  | 'PUBLICATION_NOT_FOUND'
  | 'COMMENT_NOT_FOUND'
  | 'ALREADY_COLLECTED'
  | 'BLOCKED'
  | 'ADULT_CONTENT_RESTRICTED'
  | 'CONFLICT';

/** Corpo de erro padrão devolvido pela API. */
export interface ApiErrorBody {
  error: ApiErrorCode;
  message: string;
}

/** Metadados de imagem hospedada no V0X persistidos no MongoDB. */
export interface HostedImageMeta {
  fileId: string;
  url: string;
  mimeType: string;
}

export type DonationStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'FAILED';

export interface DonationCreateResponse {
  donationId: string;
  amount: number;
  copyPaste: string;
  expiresAt: string | null;
  status: DonationStatus;
}

export interface DonationStatusResponse {
  donationId: string;
  status: DonationStatus;
  paidAt: string | null;
  badgeGranted: boolean;
}

export interface SocialPreferences {
  showAdultContent: boolean;
  adultContentEligible: boolean;
}

export interface PublicationStickerMeta {
  id: string;
  fileName: string;
  emojis: string[];
  accessibilityText: string;
  width: number;
  height: number;
  sizeBytes: number;
  isAnimated?: boolean;
  durationMs?: number;
}

export interface PublicationSummary {
  id: string;
  ownerUid: string;
  title: string;
  description: string;
  cover: HostedImageMeta | null;
  stickerCount: number;
  visibility: PublicationVisibility;
  isAdultContent: boolean;
  publishedAt: string | null;
  likeCount: number;
  commentCount: number;
  collectionCount: number;
  likedByMe?: boolean;
  collectedByMe?: boolean;
  author?: PublicAuthor;
}

export interface PublicationDetail extends PublicationSummary {
  stickers: Array<PublicationStickerMeta & HostedImageMeta>;
  localPackId: string | null;
}

export interface PublicAuthor {
  uid: string;
  displayName: string;
  username: string | null;
  avatar: HostedImageMeta | null;
  badges: string[];
}

export interface PublicProfile extends PublicAuthor {
  bio: string;
  followerCount: number;
  followingCount: number;
  publicationCount: number;
  createdAt: string | null;
  isFollowing?: boolean;
  isBlockedByMe?: boolean;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
