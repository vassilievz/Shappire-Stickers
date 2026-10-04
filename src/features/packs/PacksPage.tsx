import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Package, Trash2 } from 'lucide-react';
import { NewPackDialog } from './NewPackDialog';
import { Badge, Button, EmptyState } from '@/shared/components/primitives';
import { ConfirmDialog } from '@/shared/components/overlays';
import { formatRelative } from '@/shared/utils/format';
import { useLibraryStore } from '@/state/libraryStore';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { useTranslation } from '@/i18n';

export function PacksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const packs = useLibraryStore((state) => state.packs);
  const previews = useLibraryStore((state) => state.packPreviews);
  const refresh = useLibraryStore((state) => state.refresh);
  const removePack = useLibraryStore((state) => state.removePack);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pendingDelete = useMemo(
    () => packs.find((pack) => pack.id === pendingDeleteId) ?? null,
    [packs, pendingDeleteId],
  );

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await removePack(pendingDeleteId);
      showToast(t('packs.deletedSuccess'), 'success');
      setPendingDeleteId(null);
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-4 animate-fade-in">
      <NewPackDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('packs.deleteConfirmTitle')}
        message={t('packs.deleteConfirmMessage', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDeleteId(null)}
      />

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{t('packs.title')}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            {t('packs.subtitle', {
              count: packs.length,
              maxPacks: WHATSAPP_LIMITS.MAX_PACKS_PER_APP,
              maxStickers: WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK,
            })}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDialogOpen(true)}
          icon={<FolderPlus className="size-4" aria-hidden />}
        >
          {t('packs.new')}
        </Button>
      </header>

      {packs.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" aria-hidden />}
          title={t('packs.emptyTitle')}
          description={t('packs.emptyDesc')}
          action={
            <Button
              variant="primary"
              fullWidth
              onClick={() => setDialogOpen(true)}
              icon={<FolderPlus className="size-4" aria-hidden />}
            >
              {t('packs.createFirst')}
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {packs.map((pack) => {
            const ready = pack.stickers.length >= WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK;
            return (
              <li
                key={pack.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3"
              >
                <button
                  type="button"
                  onClick={() => void navigate(`/pacotes/${pack.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="checkerboard size-14 shrink-0 overflow-hidden rounded-[12px] border border-line">
                    {previews[pack.id] ? (
                      <img
                        src={previews[pack.id]}
                        alt=""
                        className="size-full object-contain"
                        loading="lazy"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-medium text-ink">{pack.name}</span>
                      {pack.stickerType === 'animated' ? <Badge tone="neutral">{t('packs.gifBadge')}</Badge> : null}
                      <Badge tone={ready ? 'success' : 'warning'}>
                        {ready ? t('packs.ready') : t('packs.incomplete')}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                      {pack.publisher} · {t('packDetail.stickersCount', { count: pack.stickers.length })}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-muted">
                      {t('packDetail.updated', { time: formatRelative(pack.updatedAt) })}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`${t('common.delete')} ${pack.name}`}
                  onClick={() => setPendingDeleteId(pack.id)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-danger/12 hover:text-danger"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
