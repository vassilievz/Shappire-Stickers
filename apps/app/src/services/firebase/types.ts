/**
 * Tipos e contratos da camada Firebase do Shappire Stickers.
 */

import type { ProfileImage } from '@/domain/profile';
import type { ActiveAvatarDecoration, MonthlyDonorStatus } from '@shappire/contracts';

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  emailVerified?: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  username: string | null;
  bio: string;
  avatar: ProfileImage | null;
  banner: ProfileImage | null;
  badges?: string[];
  avatarDecorationId?: string | null;
  avatarDecoration?: ActiveAvatarDecoration | null;
  monthlyDonor?: MonthlyDonorStatus;
  inviteCode?: string | null;
  publicId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type AnalyticsEventName =
  | 'app_open'
  | 'sticker_created'
  | 'sticker_exported'
  | 'pack_created'
  | 'pack_exported'
  | 'image_imported'
  | 'zip_imported'
  | 'whatsapp_export'
  | 'donation_completed'
  | 'login_started'
  | 'login_completed'
  | 'logout';

export type AnalyticsParams = Record<string, string | number | boolean | undefined>;
