import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import type { PublicAuthor } from '@shappire/contracts';
import { BottomSheet } from '@/shared/components/overlays';
import { Button, Spinner } from '@/shared/components/primitives';
import { useTranslation } from '@/i18n';
import { fetchFollowers, fetchFollowing, followUser, unfollowUser } from '@/services/api/socialApi';
import { useAuthStore } from '@/state/authStore';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';

type ListKind = 'followers' | 'following';

interface FollowListSheetProps {
  open: boolean;
  kind: ListKind;
  userUid: string;
  onClose: () => void;
}

export function FollowListSheet({ open, kind, userUid, onClose }: FollowListSheetProps) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [items, setItems] = useState<PublicAuthor[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followingUids, setFollowingUids] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (reset: boolean) => {
      if (!open || !userUid) return;
      setError(null);
      if (reset) {
        setLoading(true);
        setCursor(null);
      } else setLoadingMore(true);
      try {
        const page =
          kind === 'followers'
            ? await fetchFollowers(userUid, reset ? null : cursor)
            : await fetchFollowing(userUid, reset ? null : cursor);
        setItems((prev) => {
          const merged = reset ? page.items : [...prev, ...page.items];
          const seen = new Set<string>();
          return merged.filter((u) => {
            if (seen.has(u.uid)) return false;
            seen.add(u.uid);
            return true;
          });
        });
        setCursor(page.nextCursor);
      } catch (err) {
        setError(friendlyMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [open, userUid, kind, cursor],
  );

  useEffect(() => {
    if (!open) {
      setItems([]);
      setCursor(null);
      setError(null);
      return;
    }
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, userUid]);

  const toggleFollow = async (author: PublicAuthor) => {
    if (!isAuthenticated) {
      showToast(t('community.signInRequired'), 'info');
      return;
    }
    const wasFollowing = followingUids.has(author.uid);
    try {
      if (wasFollowing) await unfollowUser(author.uid);
      else await followUser(author.uid);
      setFollowingUids((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.delete(author.uid);
        else next.add(author.uid);
        return next;
      });
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    }
  };

  const title = kind === 'followers' ? t('community.followersTitle') : t('community.followingTitle');

  return (
    <BottomSheet open={open} title={title} onClose={onClose}>
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-[13px] text-ink-muted">{error}</p>
          <Button type="button" onClick={() => void load(true)}>{t('common.retry')}</Button>
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-ink-muted">{t('community.followListEmpty')}</p>
      ) : (
        <ul className="max-h-[60dvh] space-y-1 overflow-y-auto pb-2">
          {items.map((user) => (
            <li
              key={user.uid}
              className="flex min-h-[52px] items-center gap-3 rounded-[var(--radius-control)] px-1"
            >
              {user.avatar?.url ? (
                <img src={user.avatar.url} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <div className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                  <UserRound className="size-5" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {user.username ? (
                  <Link
                    to={`/comunidade/criador/${user.username}`}
                    onClick={onClose}
                    className="block truncate text-[14px] font-medium text-ink"
                  >
                    {user.displayName}
                  </Link>
                ) : (
                  <span className="block truncate text-[14px] font-medium text-ink">{user.displayName}</span>
                )}
                {user.username ? (
                  <span className="text-[12px] text-ink-muted">@{user.username}</span>
                ) : null}
              </div>
              {isAuthenticated ? (
                <Button
                  type="button"
                  size="sm"
                  variant={followingUids.has(user.uid) ? 'secondary' : 'primary'}
                  onClick={() => void toggleFollow(user)}
                >
                  {followingUids.has(user.uid) ? t('community.unfollow') : t('community.follow')}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {cursor && !loading ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-2 w-full"
          disabled={loadingMore}
          onClick={() => void load(false)}
        >
          {loadingMore ? t('common.loading') : t('community.loadMore')}
        </Button>
      ) : null}
    </BottomSheet>
  );
}
