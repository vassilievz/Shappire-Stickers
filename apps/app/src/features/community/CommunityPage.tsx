import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Compass, Rss, Search, UserRound, UsersRound } from 'lucide-react';
import { Button, EmptyState, Spinner } from '@/shared/components/primitives';
import { useTranslation } from '@/i18n';
import { useAuthStore } from '@/state/authStore';
import {
  fetchExplore,
  fetchFeed,
  likePublication,
  searchSocial,
  unlikePublication,
} from '@/services/api/socialApi';
import type { PublicationSummary, PublicAuthor } from '@shappire/contracts';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';
import { AlbumCard } from './components/AlbumCard';
import { importPublicationToLibrary } from '@/services/community/importPublicationService';
import { fetchPublication } from '@/services/api/socialApi';
import { useLibraryStore } from '@/state/libraryStore';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { PUBLICATION_SEARCH_MAX_LENGTH } from '@shappire/contracts';

type Tab = 'feed' | 'explore';

const SEARCH_MIN = 2;

export function CommunityPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') === 'explore' ? 'explore' : 'feed') as Tab;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshLibrary = useLibraryStore((s) => s.refresh);

  const [items, setItems] = useState<PublicationSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim().slice(0, PUBLICATION_SEARCH_MAX_LENGTH), 400);
  const [exploreSort, setExploreSort] = useState<'recent' | 'likes' | 'collections'>('recent');

  const [searchAlbums, setSearchAlbums] = useState<PublicationSummary[]>([]);
  const [searchProfiles, setSearchProfiles] = useState<PublicAuthor[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestId = useRef(0);

  const isSearchMode = tab === 'explore' && debouncedSearch.length >= SEARCH_MIN;

  const load = useCallback(
    async (reset: boolean) => {
      if (tab === 'feed' && !isAuthenticated) {
        setItems([]);
        setLoading(false);
        return;
      }
      setError(null);
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const page =
          tab === 'feed'
            ? await fetchFeed(reset ? null : cursor)
            : await fetchExplore(reset ? null : cursor, exploreSort);
        setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
        setCursor(page.nextCursor);
      } catch (err) {
        setError(friendlyMessage(err));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tab, isAuthenticated, cursor, exploreSort],
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
        setSearchAlbums((prev) => (reset ? result.publications.items : [...prev, ...result.publications.items]));
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
    [debouncedSearch, isSearchMode, searchCursor],
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
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAuthenticated, exploreSort, isSearchMode]);

  const setTab = (next: Tab) => {
    setParams(next === 'explore' ? { tab: 'explore' } : {});
  };

  const toggleLike = async (album: PublicationSummary) => {
    if (!isAuthenticated) {
      showToast(t('community.signInRequired'), 'info');
      return;
    }
    try {
      const res = album.likedByMe ? await unlikePublication(album.id) : await likePublication(album.id);
      const patch = { likedByMe: res.liked, likeCount: res.likeCount };
      setItems((prev) => prev.map((item) => (item.id === album.id ? { ...item, ...patch } : item)));
      setSearchAlbums((prev) => prev.map((item) => (item.id === album.id ? { ...item, ...patch } : item)));
    } catch (err) {
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

  const renderAlbumGrid = (albums: PublicationSummary[]) => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {albums.map((album) => (
        <AlbumCard
          key={album.id}
          album={album}
          onLike={() => void toggleLike(album)}
          onCollect={() => void collect(album)}
          onBlocked={onBlockedUser}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-5 pb-4">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">{t('community.title')}</h1>
        <p className="text-[13px] text-ink-muted">{t('community.subtitle')}</p>
      </header>

      <div className="flex gap-2 rounded-full border border-line bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab('feed')}
          className={`flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-full text-[13px] font-medium ${
            tab === 'feed' ? 'bg-surface-3 text-ink' : 'text-ink-muted'
          }`}
        >
          <Rss className="size-4" aria-hidden />
          {t('community.feed')}
        </button>
        <button
          type="button"
          onClick={() => setTab('explore')}
          className={`flex flex-1 min-h-[40px] items-center justify-center gap-1.5 rounded-full text-[13px] font-medium ${
            tab === 'explore' ? 'bg-surface-3 text-ink' : 'text-ink-muted'
          }`}
        >
          <Compass className="size-4" aria-hidden />
          {t('community.explore')}
        </button>
      </div>

      {tab === 'explore' ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
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
            <div className="flex gap-2 overflow-x-auto pb-1">
              {(['recent', 'likes', 'collections'] as const).map((sort) => (
                <button
                  key={sort}
                  type="button"
                  onClick={() => setExploreSort(sort)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] ${
                    exploreSort === sort ? 'border-accent text-ink' : 'border-line text-ink-muted'
                  }`}
                >
                  {t(`community.sort.${sort}`)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

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
                {renderAlbumGrid(searchAlbums)}
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
          title={tab === 'feed' ? t('community.feedEmptyTitle') : t('community.exploreEmptyTitle')}
          description={tab === 'feed' ? t('community.feedEmptyDesc') : t('community.exploreEmptyDesc')}
          action={
            tab === 'feed' ? (
              <Button type="button" className="w-full" onClick={() => setTab('explore')}>
                {t('community.goExplore')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        renderAlbumGrid(items)
      )}

      {!isSearchMode && cursor && !loading ? (
        <Button type="button" variant="secondary" className="w-full" disabled={loadingMore} onClick={() => void load(false)}>
          {loadingMore ? t('common.loading') : t('community.loadMore')}
        </Button>
      ) : null}
    </div>
  );
}
