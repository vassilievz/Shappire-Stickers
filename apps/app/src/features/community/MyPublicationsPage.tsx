import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Layers, UserRound } from 'lucide-react';
import { PUBLICATION_VISIBILITY, type PublicationSummary } from '@shappire/contracts';
import { Button, EmptyState, Spinner } from '@/shared/components/primitives';
import { useTranslation } from '@/i18n';
import { fetchMyPublications } from '@/services/api/socialApi';
import { friendlyMessage } from '@/shared/errors';
import { formatDate } from '@/shared/utils/format';
import { PublicationOwnerMenu } from './components/PublicationOwnerMenu';
import { useCommunityStore } from '@/state/communityStore';

function publicationStatusLabel(
  album: PublicationSummary,
  t: (key: string) => string,
): string {
  if (album.visibility === PUBLICATION_VISIBILITY.public && album.publishedAt) {
    return t('community.myPublications.statusPublic');
  }
  if (album.publishedAt) {
    return t('community.myPublications.statusPrivate');
  }
  return t('community.myPublications.statusDraft');
}

export function MyPublicationsPage() {
  const { t } = useTranslation();
  const listVersion = useCommunityStore((s) => s.listVersion);
  const [items, setItems] = useState<PublicationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (append: boolean, pageCursor?: string | null) => {
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const page = await fetchMyPublications(pageCursor ?? undefined);
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setCursor(page.nextCursor);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(false);
  }, [loadPage, listVersion]);

  const removeFromList = (publicationId: string) => {
    setItems((prev) => prev.filter((p) => p.id !== publicationId));
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        <Link
          to="/perfil"
          className="inline-flex min-h-[44px] items-center gap-2 text-[13px] text-ink-muted"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('common.back')}
        </Link>
      </div>

      <header>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
          {t('community.myPublications.title')}
        </h1>
        <p className="mt-1 text-[14px] text-ink-muted">{t('community.myPublications.subtitle')}</p>
      </header>

      {error && items.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" aria-hidden />}
          title={t('community.myPublications.loadErrorTitle')}
          description={error}
          action={
            <Button variant="secondary" onClick={() => void loadPage(false)}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : null}

      {!error && items.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" aria-hidden />}
          title={t('community.myPublications.emptyTitle')}
          description={t('community.myPublications.emptyDesc')}
          action={
            <Link
              to="/pacotes"
              className="inline-flex min-h-[44px] w-full max-w-xs items-center justify-center rounded-full bg-accent px-5 text-[14px] font-semibold text-on-accent"
            >
              {t('community.myPublications.goToPacks')}
            </Link>
          }
        />
      ) : null}

      {items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((album) => {
            const cover = album.cover?.url;
            const status = publicationStatusLabel(album, t);
            const dateSource = album.publishedAt ?? null;
            return (
              <li
                key={album.id}
                className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface"
              >
                <div className="flex items-start gap-2 p-3">
                  <Link
                    to={`/comunidade/album/${album.id}`}
                    className="flex min-w-0 flex-1 gap-3"
                  >
                    <div className="size-16 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-surface-2">
                      {cover ? (
                        <img src={cover} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex size-full items-center justify-center text-ink-muted">
                          <UserRound className="size-6" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-[15px] font-semibold text-ink">{album.title}</h2>
                      {album.description ? (
                        <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-muted">{album.description}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-ink-muted">
                        {t('community.stickerCountShort', { count: album.stickerCount })}
                        {dateSource ? ` · ${formatDate(dateSource)}` : null}
                      </p>
                      <span className="mt-1.5 inline-block rounded-full border border-line px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                        {status}
                      </span>
                    </div>
                  </Link>
                  <PublicationOwnerMenu
                    publicationId={album.id}
                    visibility={album.visibility}
                    publishedAt={album.publishedAt}
                    onDeleted={() => removeFromList(album.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {nextCursor ? (
        <Button
          variant="secondary"
          fullWidth
          loading={loadingMore}
          onClick={() => void loadPage(true, cursor)}
        >
          {t('community.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
