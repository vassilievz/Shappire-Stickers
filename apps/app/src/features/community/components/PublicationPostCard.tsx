import { memo, useState } from 'react';
import { Heart, MessageCircle, Plus, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PublicationSummary } from '@shappire/contracts';
import { Button } from '@/shared/components/primitives';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';
import { SocialOverflowMenu } from './SocialOverflowMenu';
import { PublicationOwnerMenu } from './PublicationOwnerMenu';
import { CreatorHeader } from './CreatorHeader';
import { ReportSheet } from './ReportSheet';
import { ConfirmDialog } from '@/shared/components/overlays';
import { blockUser } from '@/services/api/socialApi';
import { useAuthStore } from '@/state/authStore';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';

export interface PublicationPostCardProps {
  album: PublicationSummary;
  layout?: 'timeline' | 'compact';
  priorityCover?: boolean;
  onLike?: () => void;
  onCollect?: () => void;
  onBlocked?: (authorUid: string) => void;
}

function PublicationPostCardInner({
  album,
  layout = 'timeline',
  priorityCover = false,
  onLike,
  onCollect,
  onBlocked,
}: PublicationPostCardProps) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUid = useAuthStore((s) => s.user?.uid);
  const author = album.author;
  const cover = album.cover?.url;
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const authorUid = author?.uid ?? album.ownerUid;
  const isOwner = Boolean(isAuthenticated && currentUid && authorUid === currentUid);
  const canModerate = isAuthenticated && authorUid && authorUid !== currentUid;

  const confirmBlock = async () => {
    if (!authorUid) return;
    setBlocking(true);
    try {
      await blockUser(authorUid);
      showToast(t('community.blockSuccess'), 'success');
      onBlocked?.(authorUid);
      setBlockOpen(false);
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    } finally {
      setBlocking(false);
    }
  };

  return (
    <article
      className={cx(
        layout === 'timeline'
          ? 'min-w-0 w-full border-b border-line py-4 first:pt-0 last:border-b-0'
          : 'min-w-0 w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface',
      )}
    >
      <header className="flex min-w-0 items-start gap-2 px-0">
        <CreatorHeader author={author} ownerUid={album.ownerUid} publishedAt={album.publishedAt} />
        {isOwner ? (
          <PublicationOwnerMenu
            publicationId={album.id}
            visibility={album.visibility}
            publishedAt={album.publishedAt}
          />
        ) : canModerate ? (
          <SocialOverflowMenu
            actions={[
              { id: 'report', label: t('community.report'), onClick: () => setReportOpen(true) },
              {
                id: 'block',
                label: t('community.blockUser'),
                danger: true,
                onClick: () => setBlockOpen(true),
              },
            ]}
          />
        ) : null}
      </header>

      <div className={cx('mt-3 space-y-2', layout === 'compact' && 'px-3')}>
        <Link to={`/comunidade/album/${album.id}`} className="block space-y-1">
          <h2 className="text-[15px] font-semibold leading-snug text-ink">{album.title}</h2>
          {album.description ? (
            <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-muted">{album.description}</p>
          ) : null}
        </Link>

        <Link
          to={`/comunidade/album/${album.id}`}
          className={cx(
            'relative block w-full overflow-hidden rounded-[var(--radius-control)] bg-surface-2',
            layout === 'timeline' ? 'aspect-[16/10] max-h-[280px]' : 'aspect-square',
          )}
        >
          {cover ? (
            <img
              src={cover}
              alt=""
              className="size-full object-contain"
              loading={priorityCover ? 'eager' : 'lazy'}
              decoding="async"
            />
          ) : (
            <div className="flex size-full min-h-[120px] items-center justify-center text-ink-muted">
              <UserRound className="size-8" aria-hidden />
            </div>
          )}
          {album.isAdultContent ? (
            <span className="absolute left-2 top-2 rounded-full border border-line bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-ink">
              +18
            </span>
          ) : null}
          <span className="absolute bottom-2 right-2 rounded-full border border-line bg-surface/90 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ink-muted">
            {t('community.stickerCountShort', { count: album.stickerCount })}
          </span>
        </Link>
      </div>

      <footer
        className={cx(
          'mt-3 flex min-w-0 flex-wrap items-center gap-1',
          layout === 'compact' && 'px-3 pb-3',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 min-w-[44px] px-2.5"
          onClick={onLike}
          aria-pressed={album.likedByMe}
        >
          <Heart className={cx('size-4', album.likedByMe && 'fill-accent text-accent')} aria-hidden />
          <span className="text-[13px] tabular-nums">{album.likeCount}</span>
        </Button>
        <Link
          to={`/comunidade/album/${album.id}#comments`}
          className="inline-flex h-9 min-w-[44px] items-center gap-1.5 rounded-full px-2.5 text-ink-muted hover:bg-surface-2"
        >
          <MessageCircle className="size-4" aria-hidden />
          <span className="text-[13px] tabular-nums">{album.commentCount}</span>
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="ml-auto h-9 min-h-[44px] max-w-full min-w-0 shrink"
          onClick={onCollect}
        >
          <Plus className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate text-[12px]">{t('community.addToCollection')}</span>
        </Button>
      </footer>

      <ReportSheet
        open={reportOpen}
        target={{ targetType: 'publication', targetId: album.id }}
        onClose={() => setReportOpen(false)}
      />
      <ConfirmDialog
        open={blockOpen}
        title={t('community.blockTitle')}
        message={t('community.blockDesc')}
        danger
        loading={blocking}
        confirmLabel={t('community.blockConfirm')}
        onConfirm={() => void confirmBlock()}
        onCancel={() => setBlockOpen(false)}
      />
    </article>
  );
}

export const PublicationPostCard = memo(PublicationPostCardInner);
