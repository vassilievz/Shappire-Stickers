import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { BottomSheet } from '@/shared/components/overlays';
import { Button, Spinner } from '@/shared/components/primitives';
import { DecoratedAvatar } from '@/shared/components/DecoratedAvatar';
import { DecorationThumb } from '@/shared/components/DecorationThumb';
import { useTranslation } from '@/i18n';
import { useProfileStore } from '@/state/profileStore';
import {
  fetchAvatarDecorationCatalog,
  peekAvatarDecorationCatalog,
} from '@/services/api/avatarDecorationApi';
import type { AvatarDecorationCatalogItem } from '@shappire/contracts';
import { showToast } from '@/state/toastStore';
import { Link } from 'react-router-dom';
import { preloadDecorationImage } from '@/services/avatarDecorations/decorationImageCache';

export function AvatarDecorationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const profile = useProfileStore((s) => s.profile);
  const equipAvatarDecoration = useProfileStore((s) => s.equipAvatarDecoration);
  const decorationSaving = useProfileStore((s) => s.decorationSaving);

  const [items, setItems] = useState<AvatarDecorationCatalogItem[]>(() =>
    peekAvatarDecorationCatalog()?.items ?? [],
  );
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewRequestRef = useRef(0);

  const activeDonor = Boolean(profile?.monthlyDonor?.active);
  const savedId = profile?.avatarDecorationId ?? profile?.avatarDecoration?.id ?? null;

  useEffect(() => {
    if (!open) {
      setPreviewId(null);
      return;
    }
    setPreviewId(savedId);

    const cached = peekAvatarDecorationCatalog();
    if (cached?.items?.length) {
      setItems(cached.items);
    }

    setCatalogRefreshing(!cached?.items?.length);
    void fetchAvatarDecorationCatalog()
      .then((catalog) => setItems(catalog.items))
      .catch(() => {
        if (!peekAvatarDecorationCatalog()?.items?.length) {
          showToast(t('avatarDecorations.loadError'), 'error');
        }
      })
      .finally(() => setCatalogRefreshing(false));
  }, [open, savedId, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.id.includes(q));
  }, [items, query]);

  const selectedId = previewId ?? savedId;
  const previewItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  const avatarSrc = profile?.avatar?.url ?? profile?.photoURL ?? null;

  const handleSelect = useCallback(
    (id: string) => {
      setPreviewId(id);
      const item = items.find((entry) => entry.id === id);
      if (!item) return;
      const requestId = ++previewRequestRef.current;
      void preloadDecorationImage(item.url).then(() => {
        if (previewRequestRef.current !== requestId) return;
      });
    },
    [items],
  );

  const handleSave = useCallback(async () => {
    const id = previewId ?? savedId;
    if (!id) return;
    if (!activeDonor) {
      showToast(t('avatarDecorations.premiumRequired'), 'info');
      return;
    }
    const item = items.find((entry) => entry.id === id);
    if (!item) return;

    const ok = await equipAvatarDecoration({
      decorationId: id,
      decoration: {
        id: item.id,
        url: item.url,
        label: item.label,
        overlay: item.overlay,
      },
    });

    if (ok) {
      showToast(t('avatarDecorations.saved'), 'success');
      onClose();
      return;
    }

    const err = useProfileStore.getState().saveError;
    const code = err?.code ?? 'UNKNOWN';
    if (code === 'MONTHLY_DONOR_REQUIRED') {
      showToast(t('avatarDecorations.premiumRequired'), 'info');
    } else {
      showToast(t('avatarDecorations.saveError'), 'error');
    }
  }, [activeDonor, equipAvatarDecoration, items, onClose, previewId, savedId, t]);

  const previewDecoration = previewItem
    ? {
        id: previewItem.id,
        url: previewItem.url,
        label: previewItem.label,
        overlay: previewItem.overlay,
      }
    : profile?.avatarDecoration ?? null;

  const isPreviewOnly = Boolean(previewId && previewId !== savedId);
  const isEquipped = Boolean(selectedId && selectedId === savedId && !decorationSaving);

  return (
    <BottomSheet open={open} title={t('avatarDecorations.title')} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-4">
        <p className="text-[13px] text-ink-muted">{t('avatarDecorations.description')}</p>

        <div className="flex justify-center py-2">
          <DecoratedAvatar
            src={avatarSrc}
            size="xl"
            decoration={previewDecoration}
            decorationPriority
          />
        </div>
        {decorationSaving ? (
          <p className="text-center text-[12px] text-ink-muted">{t('avatarDecorations.saving')}</p>
        ) : isPreviewOnly ? (
          <p className="text-center text-[12px] text-accent">{t('avatarDecorations.previewNote')}</p>
        ) : isEquipped ? (
          <p className="text-center text-[12px] text-ink-muted">{t('avatarDecorations.equippedNote')}</p>
        ) : null}

        <label className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('avatarDecorations.search')}
            className="w-full rounded-[var(--radius-control)] border border-line bg-surface-2 py-2.5 pl-10 pr-3 text-sm text-ink"
          />
        </label>

        <div className="scroll-fade-y relative max-h-[36dvh] min-h-[120px] overflow-y-auto overscroll-contain">
          {catalogRefreshing && items.length === 0 ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <ul className="grid grid-cols-3 gap-2 pb-1 sm:grid-cols-4">
              {filtered.map((item) => (
                <li key={item.id}>
                  <DecorationThumb
                    url={item.url}
                    overlay={item.overlay}
                    label={item.label}
                    selected={selectedId === item.id}
                    onSelect={() => handleSelect(item.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur">
        {!activeDonor ? (
          <div className="rounded-xl border border-line bg-surface-2/80 p-4 text-center">
            <Sparkles className="mx-auto mb-2 size-5 text-accent" aria-hidden />
            <p className="text-sm font-semibold text-ink">{t('avatarDecorations.lockTitle')}</p>
            <p className="mt-1 text-[13px] text-ink-muted">{t('avatarDecorations.lockDesc')}</p>
            <Link to="/doador-mensal" className="mt-3 inline-block" onClick={onClose}>
              <Button variant="primary" size="sm">{t('avatarDecorations.unlockButton')}</Button>
            </Link>
          </div>
        ) : (
          <Button
            variant="primary"
            fullWidth
            loading={decorationSaving}
            disabled={!selectedId || selectedId === savedId}
            onClick={() => void handleSave()}
          >
            {t('avatarDecorations.apply')}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
