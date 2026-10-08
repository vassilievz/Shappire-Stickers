import { useState, useMemo, useCallback } from 'react';
import { Search, X, Check, Globe } from 'lucide-react';
import { BottomSheet } from '@/shared/components/overlays';
import { ALL_SUPPORTED_SITES, type SupportedSiteItem } from './platforms';
import { useTranslation } from '@/i18n';
import { cx } from '@/shared/utils/cx';

export interface SupportedPlatformsSheetProps {
  open: boolean;
  onClose: () => void;
  selectedPlatform: string | null;
  onSelectPlatform: (platformName: string) => void;
}

const PAGE_SIZE = 60;

export function SupportedPlatformsSheet({
  open,
  onClose,
  selectedPlatform,
  onSelectPlatform,
}: SupportedPlatformsSheetProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filteredSites = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_SUPPORTED_SITES;
    return ALL_SUPPORTED_SITES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.desc && s.desc.toLowerCase().includes(q)),
    );
  }, [search]);

  const displayedSites = useMemo(() => {
    return filteredSites.slice(0, visibleCount);
  }, [filteredSites, visibleCount]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight < 250) {
        if (visibleCount < filteredSites.length) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredSites.length));
        }
      }
    },
    [visibleCount, filteredSites.length],
  );

  const handleSelect = (site: SupportedSiteItem) => {
    onSelectPlatform(site.name);
    onClose();
  };

  const handleClearSearch = () => {
    setSearch('');
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <BottomSheet
      open={open}
      title={t('tools.supportedPlatforms')}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3 pb-4">
        {/* Subtitle / Counter */}
        <div className="flex items-center justify-between text-xs text-ink-muted">
          <span>
            {t('tools.supportedPlatformsCount', { count: ALL_SUPPORTED_SITES.length })}
          </span>
          {search.trim() ? (
            <span>
              {t('tools.searchResultsCount', { count: filteredSites.length })}
            </span>
          ) : null}
        </div>

        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 size-4 text-ink-muted pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            placeholder={t('tools.searchPlatformsPlaceholder')}
            className="w-full h-10 rounded-xl border border-line bg-surface-2 pl-9 pr-8 text-sm text-ink placeholder:text-ink-muted focus:border-focus/60 focus:bg-surface-3 transition-colors outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 flex size-6 items-center justify-center rounded-full text-ink-muted hover:text-ink hover:bg-surface-3"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable list of all platforms */}
        <div
          onScroll={handleScroll}
          className="max-h-[55vh] min-h-[260px] overflow-y-auto overscroll-contain pr-1 -mr-1 space-y-1.5 touch-pan-y"
        >
          {displayedSites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-ink-muted">
              <Globe className="size-8 opacity-40 mb-2" />
              <p className="text-sm font-medium">{t('tools.noPlatformsFound')}</p>
            </div>
          ) : (
            displayedSites.map((site) => {
              const isSelected =
                selectedPlatform?.toLowerCase() === site.name.toLowerCase();
              return (
                <button
                  key={site.name}
                  type="button"
                  onClick={() => handleSelect(site)}
                  className={cx(
                    'w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors',
                    isSelected
                      ? 'bg-surface-3 border-ink/40 text-ink shadow-xs'
                      : 'bg-surface-2/60 border-line/40 text-ink hover:bg-surface-2 hover:border-line',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-ink truncate">
                        {site.name}
                      </span>
                    </div>
                    {site.desc ? (
                      <p className="text-[11px] text-ink-muted line-clamp-1 mt-0.5">
                        {site.desc}
                      </p>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <Check className="size-4 text-primary shrink-0" />
                  ) : (
                    <span className="text-[11px] text-ink-muted shrink-0">
                      {t('tools.selectPlatform')}
                    </span>
                  )}
                </button>
              );
            })
          )}

          {visibleCount < filteredSites.length && (
            <div className="pt-2 pb-1 text-center">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + PAGE_SIZE, filteredSites.length),
                  )
                }
                className="text-xs text-primary font-medium hover:underline py-1 px-3"
              >
                {t('tools.loadMore', {
                  remaining: filteredSites.length - visibleCount,
                })}
              </button>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
