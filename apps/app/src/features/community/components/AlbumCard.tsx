import { useState } from 'react';
import { Heart, MessageCircle, Plus, UserRound } from 'lucide-react';
import type { PublicationSummary } from '@shappire/contracts';
import { Button } from '@/shared/components/primitives';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';
import { Link } from 'react-router-dom';
import { SocialOverflowMenu } from './SocialOverflowMenu';
import { ReportSheet } from './ReportSheet';
import { ConfirmDialog } from '@/shared/components/overlays';
import { blockUser } from '@/services/api/socialApi';
import { useAuthStore } from '@/state/authStore';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';

interface AlbumCardProps {
  album: PublicationSummary;
  onLike?: () => void;
  onCollect?: () => void;
  onBlocked?: (authorUid: string) => void;
  compact?: boolean;
}

export function AlbumCard({ album, onLike, onCollect, onBlocked, compact }: AlbumCardProps) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentUid = useAuthStore((s) => s.user?.uid);
  const author = album.author;
  const cover = album.cover?.url;
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const authorUid = author?.uid ?? album.ownerUid;
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
    <article className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <Link to={`/comunidade/album/${album.id}`} className="block">
        <div className={cx('relative w-full bg-surface-2', compact ? 'aspect-[4/3]' : 'aspect-square')}>
          {cover ? (
            <img src={cover} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex size-full items-center justify-center text-ink-muted">
              <UserRound className="size-8" aria-hidden />
            </div>
          )}
          {album.isAdultContent ? (
            <span className="absolute left-2 top-2 rounded-full border border-line bg-surface/90 px-2 py-0.5 text-[10px] font-semibold text-ink">
              +18
            </span>
          ) : null}
        </div>
      </Link>
      <div className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/comunidade/album/${album.id}`} className="line-clamp-1 text-[14px] font-semibold text-ink">
              {album.title}
            </Link>
            {author ? (
              <Link
                to={author.username ? `/comunidade/criador/${author.username}` : '#'}
                className="mt-0.5 line-clamp-1 text-[12px] text-ink-muted hover:text-ink-soft"
              >
                {author.displayName}
              </Link>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <span className="text-[11px] text-ink-muted">{album.stickerCount}</span>
            {canModerate ? (
              <SocialOverflowMenu
                actions={[
                  {
                    id: 'report',
                    label: t('community.report'),
                    onClick: () => setReportOpen(true),
                  },
                  {
                    id: 'block',
                    label: t('community.blockUser'),
                    danger: true,
                    onClick: () => setBlockOpen(true),
                  },
                ]}
              />
            ) : null}
          </div>
        </div>
        {album.description ? (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{album.description}</p>
        ) : null}
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onLike} aria-pressed={album.likedByMe}>
            <Heart className={cx('size-4', album.likedByMe && 'fill-accent text-accent')} aria-hidden />
            <span className="text-[12px] tabular-nums">{album.likeCount}</span>
          </Button>
          <Link
            to={`/comunidade/album/${album.id}#comments`}
            className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-ink-muted hover:bg-surface-2"
          >
            <MessageCircle className="size-4" aria-hidden />
            <span className="text-[12px] tabular-nums">{album.commentCount}</span>
          </Link>
          <Button type="button" variant="secondary" size="sm" className="ml-auto h-8" onClick={onCollect}>
            <Plus className="size-3.5" aria-hidden />
            {t('community.addToCollection')}
          </Button>
        </div>
      </div>
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
