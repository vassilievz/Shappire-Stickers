import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, UserRound, UsersRound } from 'lucide-react';
import { Button, EmptyState, Spinner } from '@/shared/components/primitives';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/state/authStore';
import {
  fetchExplore,
  likePublication,
  searchSocial,
  unlikePublication,
} from '@/services/api/socialApi';
import type { PublicationSummary, PublicAuthor } from '@shappire/contracts';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';
import { PublicationPostCard } from './components/PublicationPostCard';
import { importPublicationToLibrary } from '@/services/community/importPublicationService';
import { fetchPublication } from '@/services/api/socialApi';
import { useLibraryStore } from '@/state/libraryStore';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { PUBLICATION_SEARCH_MAX_LENGTH } from '@shappire/contracts';
import { useCommunityStore } from '@/state/communityStore';

const SEARCH_MIN = 2;

function mergePublications(prev: PublicationSummary[], next: PublicationSummary[]) {
  if (!prev.length) return next;
  const seen = new Set(prev.map((p) => p.id));
  return [...prev, ...next.filter((p) => !seen.has(p.id))];
}

export function CommunityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshLibrary = useLibraryStore((s) => s.refresh);
  const listVersion = useCommunityStore((s) => s.listVersion);
  const removedIds = useCommunityStore((s) => s.removedPublicationIds);

  const [items, setItems] = useState<PublicationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim().slice(0, PUBLICATION_SEARCH_MAX_LENGTH), 400);
  const [sort, setSort] = useState<'recent' | 'likes' | 'collections'>('recent');
  const loadRequestId = useRef(0);

  const [searchAlbums, setSearchAlbums] = useState<PublicationSummary[]>([]);
  const [searchProfiles, setSearchProfiles] = useState<PublicAuthor[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestId = useRef(0);

  const isSearchMode = debouncedSearch.length >= SEARCH_MIN;

  const filterRemoved = useCallback(
    (list: PublicationSummary[]) => {
      if (!removedIds.length) return list;
      const blocked = new Set(removedIds);
      return list.filter((p) => !blocked.has(p.id));
    },
    [removedIds],
  );

  const load = useCallback(
    async (reset: boolean) => {
      const requestId = ++loadRequestId.current;
      setError(null);
      if (reset) setLoading(true);
      else setLoadingMore(true);
      const cursorForRequest = reset ? null : cursor;
      try {
        const page = await fetchExplore(cursorForRequest, sort);
        if (requestId !== loadRequestId.current) return;
        setItems((prev) => {
          const merged = reset ? page.items : mergePublications(prev, page.items);
          return filterRemoved(merged);
        });
        setCursor(page.nextCursor);
      } catch (err) {
        if (requestId !== loadRequestId.current) return;
        setError(friendlyMessage(err));
      } finally {
        if (requestId === loadRequestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [cursor, sort, filterRemoved],
  );

  const runSearch = useCallback(
    async (reset: boolean) => {
      if (!isSearchMode) return;
      const requestId = ++searchRequestId.current;
      setSearchError(null);
      if (reset) {
        setSearchLoading(true);
        setSearchCursor(null);
      } else setSearchLoadingMore(true);
      try {
        const result = await searchSocial(debouncedSearch, reset ? null : searchCursor);
        if (requestId !== searchRequestId.current) return;
        setSearchAlbums((prev) =>
          filterRemoved(reset ? result.publications.items : mergePublications(prev, result.publications.items)),
        );
        setSearchProfiles((prev) => {
          const merged = reset ? result.profiles.items : [...prev, ...result.profiles.items];
          const seen = new Set<string>();
          return merged.filter((p) => {
            if (seen.has(p.uid)) return false;
            seen.add(p.uid);
            return true;
          });
        });
        setSearchCursor(result.publications.nextCursor);
      } catch (err) {
        if (requestId !== searchRequestId.current) return;
        setSearchError(friendlyMessage(err));
      } finally {
        if (requestId === searchRequestId.current) {
          setSearchLoading(false);
          setSearchLoadingMore(false);
        }
      }
    },
    [debouncedSearch, isSearchMode, searchCursor, filterRemoved],
  );

  useEffect(() => {
    if (isSearchMode) {
      setSearchAlbums([]);
      setSearchProfiles([]);
      void runSearch(true);
      return;
    }
    setSearchAlbums([]);
    setSearchProfiles([]);
    setSearchError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, isSearchMode]);

  useEffect(() => {
    if (isSearchMode) return;
    setCursor(null);
    setItems([]);
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, isSearchMode, listVersion]);

  useEffect(() => {
    setItems((prev) => filterRemoved(prev));
    setSearchAlbums((prev) => filterRemoved(prev));
  }, [filterRemoved]);

  const patchAlbum = (album: PublicationSummary, patch: Partial<PublicationSummary>) => {
    const apply = (item: PublicationSummary) => (item.id === album.id ? { ...item, ...patch } : item);
    setItems((prev) => prev.map(apply));
    setSearchAlbums((prev) => prev.map(apply));
  };

  const toggleLike = async (album: PublicationSummary) => {
    if (!isAuthenticated) {
      showToast(t('community.signInRequired'), 'info');
      return;
    }
    const optimistic = {
      likedByMe: !album.likedByMe,
      likeCount: Math.max(0, album.likeCount + (album.likedByMe ? -1 : 1)),
    };
    patchAlbum(album, optimistic);
    try {
      const res = album.likedByMe ? await unlikePublication(album.id) : await likePublication(album.id);
      patchAlbum(album, { likedByMe: res.liked, likeCount: res.likeCount });
    } catch (err) {
      patchAlbum(album, { likedByMe: album.likedByMe, likeCount: album.likeCount });
      showToast(friendlyMessage(err), 'error');
    }
  };

  const collect = async (album: PublicationSummary) => {
    if (!isAuthenticated) {
      showToast(t('community.signInRequired'), 'info');
      return;
    }
    try {
      const detail = await fetchPublication(album.id);
      if (!detail.stickers?.length) {
        showToast(t('community.importUnavailable'), 'error');
        return;
      }
      const result = await importPublicationToLibrary(detail);
      await refreshLibrary();
      showToast(t('community.importSuccess'), 'success');
      navigate(`/pacotes/${result.packId}`);
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    }
  };

  const onBlockedUser = (uid: string) => {
    setItems((prev) => prev.filter((a) => a.author?.uid !== uid && a.ownerUid !== uid));
    setSearchAlbums((prev) => prev.filter((a) => a.author?.uid !== uid && a.ownerUid !== uid));
    setSearchProfiles((prev) => prev.filter((p) => p.uid !== uid));
  };

  const timeline = (
    <div role="feed" aria-label={t('community.title')} className="flex flex-col">
      {items.map((album, index) => (
        <PublicationPostCard
          key={album.id}
          album={album}
          layout="timeline"
          priorityCover={index === 0}
          onLike={() => void toggleLike(album)}
          onCollect={() => void collect(album)}
          onBlocked={onBlockedUser}
        />
      ))}
    </div>
  );

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-5 pb-2">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">{t('community.title')}</h1>
        <p className="text-[13px] text-ink-muted">{t('community.unifiedSubtitle')}</p>
      </header>

      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('community.searchPlaceholder')}
            maxLength={PUBLICATION_SEARCH_MAX_LENGTH}
            aria-busy={searchLoading}
            className="h-11 w-full rounded-[var(--radius-control)] border border-line bg-surface-2 pl-9 pr-3 text-[14px] text-ink"
          />
        </div>
        {!isSearchMode ? (
          <div className="flex w-full min-w-0 gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(['recent', 'likes', 'collections'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSort(key)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] min-h-[36px] ${
                  sort === key ? 'border-accent text-ink' : 'border-line text-ink-muted'
                }`}
              >
                {t(`community.sort.${key}`)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {isSearchMode ? (
        searchLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : searchError ? (
          <EmptyState
            icon={<Search className="size-6" aria-hidden />}
            title={t('community.searchErrorTitle')}
            description={searchError}
            action={
              <Button type="button" className="w-full" onClick={() => void runSearch(true)}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : searchAlbums.length === 0 && searchProfiles.length === 0 ? (
          <EmptyState
            icon={<Search className="size-6" aria-hidden />}
            title={t('community.searchEmptyTitle')}
            description={t('community.searchEmptyDesc')}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {searchProfiles.length > 0 ? (
              <section className="space-y-2">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
                  {t('community.searchCreators')}
                </h2>
                <ul className="space-y-1">
                  {searchProfiles.map((profile) => (
                    <li key={profile.uid}>
                      <Link
                        to={profile.username ? `/comunidade/criador/${profile.username}` : '#'}
                        className="flex min-h-[48px] items-center gap-3 rounded-[var(--radius-control)] px-2 hover:bg-surface-2"
                      >
                        {profile.avatar?.url ? (
                          <img src={profile.avatar.url} alt="" className="size-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-full bg-surface-2">
                            <UserRound className="size-5 text-ink-muted" aria-hidden />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-ink">{profile.displayName}</p>
                          {profile.username ? (
                            <p className="text-[12px] text-ink-muted">@{profile.username}</p>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {searchAlbums.length > 0 ? (
              <section className="space-y-3">
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
                  {t('community.searchAlbums')}
                </h2>
                <div className="flex flex-col">
                  {searchAlbums.map((album) => (
                    <PublicationPostCard
                      key={album.id}
                      album={album}
                      layout="timeline"
                      onLike={() => void toggleLike(album)}
                      onCollect={() => void collect(album)}
                      onBlocked={onBlockedUser}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {searchCursor ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={searchLoadingMore}
                onClick={() => void runSearch(false)}
              >
                {searchLoadingMore ? t('common.loading') : t('community.loadMore')}
              </Button>
            ) : null}
          </div>
        )
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : error ? (
        <EmptyState
          icon={<UsersRound className="size-6" aria-hidden />}
          title={t('community.errorTitle')}
          description={error}
          action={
            <Button type="button" className="w-full" onClick={() => void load(true)}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-6" aria-hidden />}
          title={t('community.exploreEmptyTitle')}
          description={t('community.unifiedEmptyDesc')}
          action={
            isAuthenticated ? (
              <Button type="button" className="w-full" onClick={() => navigate('/pacotes')}>
                {t('community.publishCta')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        timeline
      )}

      {!isSearchMode && cursor && !loading ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={loadingMore}
          onClick={() => void load(false)}
        >
          {loadingMore ? t('common.loading') : t('community.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
