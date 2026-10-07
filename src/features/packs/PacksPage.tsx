import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Package, Trash2, Upload } from 'lucide-react';
import { NewPackDialog } from './NewPackDialog';
import { Badge, Button, EmptyState } from '@/shared/components/primitives';
import { ConfirmDialog } from '@/shared/components/overlays';
import { BlurFade } from '@/shared/components/motion';
import { formatRelative } from '@/shared/utils/format';
import { useLibraryStore } from '@/state/libraryStore';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { useTranslation } from '@/i18n';
import { importPackFromZip } from '@/services/packs/packBackupService';
import { hapticNotification } from '@/services/native/haptics';

export function PacksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const importedPack = await importPackFromZip(file);
      await refresh();
      void hapticNotification('success');
      showToast(t('packs.importZipSuccess', { name: importedPack.name }), 'success');
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-4 animate-fade-in">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />

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

      <BlurFade durationMs={300}>
        <header className="flex flex-col gap-3">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{t('packs.title')}</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              {t('packs.subtitle', {
                count: packs.length,
                maxPacks: WHATSAPP_LIMITS.MAX_PACKS_PER_APP,
                maxStickers: WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK,
              })}
            </p>
          </div>
          {/* Ações ocupam a largura disponível em telas estreitas — rótulo nunca quebra. */}
          <div className="flex gap-2 sm:hidden">
            <Button
              variant="quiet"
              size="sm"
              loading={importing}
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="size-4 shrink-0" aria-hidden />}
              className="min-w-0 flex-1"
            >
              <span className="truncate">{t('packs.importZip')}</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialogOpen(true)}
              icon={<FolderPlus className="size-4 shrink-0" aria-hidden />}
              className="min-w-0 flex-1"
            >
              <span className="truncate">{t('packs.new')}</span>
            </Button>
          </div>
          {/* sm+: compactos à direita, alinhados com o título */}
          <div className="hidden items-center justify-end gap-2 sm:flex">
            <Button
              variant="quiet"
              size="sm"
              loading={importing}
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="size-4 shrink-0" aria-hidden />}
              className="whitespace-nowrap"
            >
              {t('packs.importZip')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDialogOpen(true)}
              icon={<FolderPlus className="size-4 shrink-0" aria-hidden />}
              className="whitespace-nowrap"
            >
              {t('packs.new')}
            </Button>
          </div>
        </header>
      </BlurFade>

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
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {packs.map((pack, index) => {
            const ready = pack.stickers.length >= WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK;
            return (
              <BlurFade key={pack.id} durationMs={280} delayMs={Math.min(index * 45, 360)}>
                <li
                  className="group flex h-full items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 transition-colors hover:border-focus/30 active:bg-surface-2/70"
                >
                <button
                  type="button"
                  onClick={() => void navigate(`/pacotes/${pack.id}`)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left touch-manipulation"
                >
                  <span className="checkerboard size-14 shrink-0 overflow-hidden rounded-[12px] border border-line transition-colors group-hover:border-focus/40">
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
                  className="flex size-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-danger/12 hover:text-danger touch-manipulation"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
              </BlurFade>
            );
          })}
        </ul>
      )}
    </div>
  );
}
