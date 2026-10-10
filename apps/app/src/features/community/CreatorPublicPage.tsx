import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, UserRound } from 'lucide-react';
import { Button, EmptyState, Spinner } from '@/shared/components/primitives';
import { useTranslation } from '@/i18n';
import {
  fetchPublicProfile,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
} from '@/services/api/socialApi';
import type { PublicProfile, PublicationSummary } from '@shappire/contracts';
import { apiRequest } from '@/services/api/client';
import { AlbumCard } from './components/AlbumCard';
import { useAuthStore } from '@/state/authStore';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';
import { FollowListSheet } from './components/FollowListSheet';
import { ReportSheet } from './components/ReportSheet';
import { ConfirmDialog } from '@/shared/components/overlays';
import { SocialOverflowMenu } from './components/SocialOverflowMenu';

export function CreatorPublicPage() {
  const { username = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUid = useAuthStore((s) => s.user?.uid);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [albums, setAlbums] = useState<PublicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [listKind, setListKind] = useState<'followers' | 'following' | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const p = await fetchPublicProfile(username);
        setProfile(p);
        const { body } = await apiRequest(`/api/social/users/${encodeURIComponent(username)}/publications`, {
          auth: 'optional',
        });
        const page = body as { items: PublicationSummary[] };
        setAlbums(page.items ?? []);
      } catch (err) {
        showToast(friendlyMessage(err), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  const toggleFollow = async () => {
    if (!profile || !isAuthenticated) {
      showToast(t('community.signInRequired'), 'info');
      return;
    }
    try {
      if (profile.isFollowing) await unfollowUser(profile.uid);
      else await followUser(profile.uid);
      setProfile({
        ...profile,
        isFollowing: !profile.isFollowing,
        followerCount: profile.followerCount + (profile.isFollowing ? -1 : 1),
      });
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    }
  };

  const toggleBlock = async () => {
    if (!profile) return;
    setBlocking(true);
    try {
      if (profile.isBlockedByMe) {
        await unblockUser(profile.uid);
        setProfile({ ...profile, isBlockedByMe: false });
        showToast(t('community.unblockSuccess'), 'success');
      } else {
        await blockUser(profile.uid);
        showToast(t('community.blockSuccess'), 'success');
        navigate('/comunidade?tab=explore', { replace: true });
      }
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    } finally {
      setBlocking(false);
      setBlockOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (!profile) {
    return (
      <EmptyState
        icon={<UserRound className="size-6" aria-hidden />}
        title={t('community.profileNotFound')}
        description={t('community.profileNotFoundDesc')}
      />
    );
  }

  const canModerate = isAuthenticated && profile.uid !== currentUid;

  return (
    <div className="flex flex-col gap-5 pb-8">
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
        <ArrowLeft className="size-4" aria-hidden />
        {t('common.back')}
      </button>
      <div className="flex items-center gap-4">
        {profile.avatar?.url ? (
          <img src={profile.avatar.url} alt="" className="size-16 rounded-full object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
            <UserRound aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-ink">{profile.displayName}</h1>
          {profile.username ? <p className="text-[13px] text-ink-muted">@{profile.username}</p> : null}
          <p className="mt-2 flex flex-wrap gap-3 text-[12px] text-ink-muted">
            <button type="button" className="hover:text-ink" onClick={() => setListKind('followers')}>
              {profile.followerCount} {t('community.followers')}
            </button>
            <button type="button" className="hover:text-ink" onClick={() => setListKind('following')}>
              {profile.followingCount} {t('community.following')}
            </button>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {canModerate ? (
            <>
              <Button type="button" variant={profile.isFollowing ? 'secondary' : 'primary'} onClick={() => void toggleFollow()}>
                {profile.isFollowing ? t('community.unfollow') : t('community.follow')}
              </Button>
              <SocialOverflowMenu
                actions={[
                  { id: 'report', label: t('community.report'), onClick: () => setReportOpen(true) },
                  {
                    id: 'block',
                    label: profile.isBlockedByMe ? t('community.unblockUser') : t('community.blockUser'),
                    danger: !profile.isBlockedByMe,
                    onClick: () => (profile.isBlockedByMe ? void toggleBlock() : setBlockOpen(true)),
                  },
                ]}
              />
            </>
          ) : null}
        </div>
      </div>
      {profile.bio ? <p className="whitespace-pre-wrap text-[14px] text-ink-soft">{profile.bio}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {albums.map((album) => (
          <AlbumCard
            key={album.id}
            album={{ ...album, author: profile }}
            compact
            onBlocked={() => navigate('/comunidade?tab=explore', { replace: true })}
          />
        ))}
      </div>
      <FollowListSheet
        open={listKind !== null}
        kind={listKind ?? 'followers'}
        userUid={profile.uid}
        onClose={() => setListKind(null)}
      />
      <ReportSheet
        open={reportOpen}
        target={{ targetType: 'user', targetId: profile.uid }}
        onClose={() => setReportOpen(false)}
      />
      <ConfirmDialog
        open={blockOpen}
        title={t('community.blockTitle')}
        message={t('community.blockDesc')}
        danger
        loading={blocking}
        confirmLabel={t('community.blockConfirm')}
        onConfirm={() => void toggleBlock()}
        onCancel={() => setBlockOpen(false)}
      />
    </div>
  );
}
