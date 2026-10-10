import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { BottomSheet } from '@/shared/components/overlays';
import { Button, Spinner } from '@/shared/components/primitives';
import { DecoratedAvatar } from '@/shared/components/DecoratedAvatar';
import { useTranslation } from '@/i18n';
import { useProfileStore } from '@/state/profileStore';
import {
  fetchAvatarDecorationCatalog,
  saveAvatarDecoration,
} from '@/services/api/avatarDecorationApi';
import type { AvatarDecorationCatalogItem } from '@shappire/contracts';
import { showToast } from '@/state/toastStore';
import { AppError } from '@/shared/errors';
import { Link } from 'react-router-dom';

export function AvatarDecorationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const profile = useProfileStore((s) => s.profile);
  const hydrate = useProfileStore((s) => s.hydrate);

  const [items, setItems] = useState<AvatarDecorationCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeDonor = Boolean(profile?.monthlyDonor?.active);
  const savedId = profile?.avatarDecorationId ?? profile?.avatarDecoration?.id ?? null;
  const previewItem = useMemo(
    () => items.find((item) => item.id === (previewId ?? savedId)) ?? null,
    [items, previewId, savedId],
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void fetchAvatarDecorationCatalog()
      .then((catalog) => setItems(catalog.items))
      .catch(() => showToast(t('avatarDecorations.loadError'), 'error'))
      .finally(() => setLoading(false));
  }, [open, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q) || item.id.includes(q));
  }, [items, query]);

  const avatarSrc = profile?.avatar?.url ?? profile?.photoURL ?? null;

  const handleSave = useCallback(async () => {
    const id = previewId ?? savedId;
    if (!id) return;
    if (!activeDonor) {
      showToast(t('avatarDecorations.premiumRequired'), 'info');
      return;
    }
    setSaving(true);
    try {
      await saveAvatarDecoration(id);
      await hydrate();
      showToast(t('avatarDecorations.saved'), 'success');
      onClose();
    } catch (error) {
      const code = AppError.is(error) ? error.code : 'UNKNOWN';
      if (code === 'MONTHLY_DONOR_REQUIRED') {
        showToast(t('avatarDecorations.premiumRequired'), 'info');
      } else {
        showToast(t('avatarDecorations.saveError'), 'error');
      }
    } finally {
      setSaving(false);
    }
  }, [activeDonor, hydrate, onClose, previewId, savedId, t]);

  const previewDecoration = previewItem
    ? { id: previewItem.id, url: previewItem.url, label: previewItem.label, overlay: previewItem.overlay }
    : profile?.avatarDecoration ?? null;

  return (
    <BottomSheet open={open} title={t('avatarDecorations.title')} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-4">
        <p className="text-[13px] text-ink-muted">{t('avatarDecorations.description')}</p>

        <div className="flex justify-center py-2">
          <DecoratedAvatar src={avatarSrc} size="xl" decoration={previewDecoration} />
        </div>
        {previewId && previewId !== savedId ? (
          <p className="text-center text-[12px] text-accent">{t('avatarDecorations.previewNote')}</p>
        ) : null}

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('avatarDecorations.search')}
            className="w-full rounded-[var(--radius-control)] border border-line bg-surface-2 py-2.5 pl-10 pr-3 text-sm text-ink"
          />
        </label>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <ul className="grid max-h-[40dvh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {filtered.map((item) => {
              const selected = (previewId ?? savedId) === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setPreviewId(item.id)}
                    className={`flex w-full flex-col items-center gap-1 rounded-xl border p-2 text-center transition-colors ${
                      selected ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:bg-surface-2'
                    }`}
                  >
                    <DecoratedAvatar
                      src={avatarSrc}
                      size="sm"
                      decoration={{ id: item.id, url: item.url, label: item.label, overlay: item.overlay }}
                    />
                    <span className="line-clamp-2 text-[10px] leading-tight text-ink-muted">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

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
          <Button variant="primary" fullWidth loading={saving} onClick={() => void handleSave()}>
            {t('avatarDecorations.apply')}
          </Button>
        )}
      </div>
    </BottomSheet>
  );
}
