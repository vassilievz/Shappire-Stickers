import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Info,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Share2,
} from 'lucide-react';
import { Badge, Button, EmptyState, SectionTitle } from '@/shared/components/primitives';
import { BottomSheet, ConfirmDialog, Modal } from '@/shared/components/overlays';
import { TextInput } from '@/shared/components/inputs';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { STICKER_AUTHOR, type StickerRecord } from '@/domain/stickerPack';
import {
  validateMetadataText,
  validateStickerPack,
  type ValidationResult,
} from '@/domain/validation/whatsappRules';
import { useTranslation } from '@/i18n';
import {
  addExistingImageToPack,
  removeStickerFromPack,
  reorderStickers,
  setTrayFromSticker,
  updateStickerMeta,
} from '@/services/packs/packService';
import {
  addPackToWhatsApp,
  getPackAddedState,
  getWhatsAppCapabilities,
  openWhatsAppStorePage,
  validatePackForWhatsApp,
  type WhatsAppCapabilities,
} from '@/services/whatsapp/whatsappService';
import { pickSingleImage } from '@/services/native/imagePicker';
import { shareStickerFile } from '@/services/native/shareService';
import { packStickerPath } from '@/services/storage/paths';
import { friendlyMessage } from '@/shared/errors';
import { formatBytes, formatRelative } from '@/shared/utils/format';
import { useLibraryStore } from '@/state/libraryStore';
import { showToast } from '@/state/toastStore';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { cx } from '@/shared/utils/cx';
import { StickerPreview } from './StickerPreview';

type SheetAction = 'none' | 'sticker' | 'add';

export function PackDetailPage() {
  const { t } = useTranslation();
  const { packId = '' } = useParams();
  const navigate = useNavigate();

  const pack = useLibraryStore((state) => state.packs.find((item) => item.id === packId));
  const refresh = useLibraryStore((state) => state.refresh);

  const [sheet, setSheet] = useState<SheetAction>('none');
  const [activeSticker, setActiveSticker] = useState<StickerRecord | null>(null);
  const [capabilities, setCapabilities] = useState<WhatsAppCapabilities | null>(null);
  const [addedState, setAddedState] = useState<{ consumer: boolean | null; business: boolean | null } | null>(null);
  const [nativeValidation, setNativeValidation] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState({ name: '' });
  const [metaEditor, setMetaEditor] = useState<{ sticker: StickerRecord } | null>(null);
  const [metaValue, setMetaValue] = useState({ emojis: '' });
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  const rulesValidation: ValidationResult | null = useMemo(
    () => (pack ? validateStickerPack(pack) : null),
    [pack],
  );

  const reloadWhatsAppState = useCallback(async () => {
    const caps = await getWhatsAppCapabilities();
    setCapabilities(caps);
    if (caps.nativeAvailable) {
      setAddedState(await getPackAddedState(packId));
    }
  }, [packId]);

  useEffect(() => {
    void refresh();
    void (async () => {
      await reloadWhatsAppState();
    })();
  }, [refresh, reloadWhatsAppState]);

  if (!pack) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <Button variant="ghost" onClick={() => void navigate('/pacotes')} icon={<ArrowLeft className="size-4" aria-hidden />}>
          {t('common.back')}
        </Button>
        <EmptyState
          icon={<Info className="size-6" aria-hidden />}
          title={t('packDetail.notFoundTitle')}
          description={t('packDetail.notFoundDesc')}
        />
      </div>
    );
  }

  const openRename = () => {
    setRenameValue({ name: pack.name });
    setRenaming(true);
  };

  const handleRename = async () => {
    const firstError = validateMetadataText(renameValue.name, 'name')[0];
    if (firstError) {
      showToast(firstError.message, 'error');
      return;
    }
    setBusy(true);
    try {
      await useLibraryStore.getState().renamePack(pack.id, { name: renameValue.name });
      showToast('Pacote atualizado.', 'success');
      setRenaming(false);
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleImportImage = async () => {
    setBusy(true);
    try {
      const image = await pickSingleImage();
      await addExistingImageToPack({
        packId: pack.id,
        dataUrl: image.dataUrl,
        accessibilityText: image.fileName,
      });
      await refresh();
      showToast('Figurinha importada para o pacote.', 'success');
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
      setSheet('none');
    }
  };

  const handleValidate = async () => {
    setBusy(true);
    setNativeValidation(null);
    try {
      const result = await validatePackForWhatsApp(pack);
      const errors = result.native?.errors.map((issue) => issue.message) ?? null;
      const rulesErrors = result.rules.errors.map((issue) => issue.message);
      const all = [...rulesErrors, ...(errors ?? [])];
      if (all.length === 0) {
        showToast(
          result.native
            ? 'Pacote válido: arquivos conferidos no dispositivo.'
            : 'Pacote válido segundo as regras do WhatsApp.',
          'success',
        );
        setNativeValidation([]);
      } else {
        setNativeValidation(all);
        showToast(`${all.length} pendência(s) encontrada(s).`, 'warning');
      }
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleAddToWhatsApp = async () => {
    setBusy(true);
    try {
      const result = await addPackToWhatsApp(pack);
      if (result.outcome === 'added') {
        showToast('Pacote adicionado ao WhatsApp.', 'success');
      } else if (result.outcome === 'already_added') {
        showToast(t('packDetail.alreadyAddedConsumer'), 'info');
      } else if (result.outcome === 'cancelled') {
        showToast(t('common.cancel'), 'info');
      } else {
        showToast(result.message || t('packDetail.whatsAppIncomplete'), 'warning');
      }
      await reloadWhatsAppState();
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleOpenWhatsAppStore = async () => {
    const opened = await openWhatsAppStorePage();
    if (!opened) showToast(t('packDetail.openStoreError'), 'error');
  };

  const handleRemoveSticker = async () => {
    if (!pendingRemove) return;
    setBusy(true);
    try {
      await removeStickerFromPack(pack.id, pendingRemove);
      await refresh();
      setPendingRemove(null);
      showToast(t('packDetail.stickerRemoved'), 'success');
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleUseAsTray = async (sticker: StickerRecord) => {
    setBusy(true);
    try {
      await setTrayFromSticker(pack.id, sticker.id);
      await refresh();
      showToast(t('packDetail.trayUpdated'), 'success');
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
      setSheet('none');
    }
  };

  const handleShareSticker = async (sticker: StickerRecord) => {
    try {
      await shareStickerFile(packStickerPath(pack.id, sticker.fileName));
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setSheet('none');
    }
  };

  const handleMove = async (sticker: StickerRecord, direction: -1 | 1) => {
    const index = pack.stickers.findIndex((item) => item.id === sticker.id);
    const target = index + direction;
    if (target < 0 || target >= pack.stickers.length) return;
    const ids = pack.stickers.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    if (moved === undefined) return;
    ids.splice(target, 0, moved);
    try {
      await reorderStickers(pack.id, ids);
      await refresh();
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    }
  };

  const openMetaEditor = (sticker: StickerRecord) => {
    setMetaValue({ emojis: sticker.emojis.join(' ') });
    setMetaEditor({ sticker });
  };

  const handleSaveMeta = async () => {
    if (!metaEditor) return;
    const emojis = metaValue.emojis.trim().split(/\s+/).filter(Boolean);
    if (emojis.length < 1 || emojis.length > WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER) {
      showToast(
        t('packDetail.emojisValidationError', { max: WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER }),
        'error',
      );
      return;
    }
    setBusy(true);
    try {
      await updateStickerMeta(pack.id, metaEditor.sticker.id, { emojis });
      await refresh();
      setMetaEditor(null);
      showToast(t('packDetail.stickerUpdated'), 'success');
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const whatsappInstalled =
    capabilities === null
      ? false
      : capabilities.consumerInstalled || capabilities.businessInstalled;
  const packReady = rulesValidation?.valid ?? false;

  return (
    <div className="flex flex-col gap-6 pb-6 animate-fade-in">
      <Modal
        open={renaming}
        title={t('packDetail.editPackTitle')}
        description={t('packDetail.editPackDesc')}
        onClose={() => setRenaming(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleRename()} loading={busy}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextInput
            label={t('packDetail.packNameLabel')}
            name="rename-name"
            value={renameValue.name}
            maxLength={128}
            onChange={(event) =>
              setRenameValue((current) => ({ ...current, name: event.target.value }))
            }
          />
        </div>
      </Modal>

      <Modal
        open={metaEditor !== null}
        title={t('packDetail.editInfo')}
        description={t('packDetail.emojisHint')}
        onClose={() => setMetaEditor(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMetaEditor(null)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSaveMeta()} loading={busy}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <TextInput
            label={t('packDetail.emojisLabel')}
            name="sticker-emojis"
            value={metaValue.emojis}
            placeholder="😀 😂 ✨"
            onChange={(event) =>
              setMetaValue((current) => ({ ...current, emojis: event.target.value }))
            }
          />
          <div className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 py-2.5">
            <span className="text-[11px] font-medium tracking-wide uppercase text-ink-muted">
              {t('packDetail.creatorCreditLabel')}
            </span>
            <span className="text-[13px] font-medium text-ink select-all">
              {STICKER_AUTHOR}
            </span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingRemove !== null}
        title={t('packDetail.removeConfirmTitle')}
        message={t('packDetail.removeConfirmMessage')}
        confirmLabel={t('common.delete')}
        danger
        loading={busy}
        onConfirm={() => void handleRemoveSticker()}
        onCancel={() => setPendingRemove(null)}
      />

      <BottomSheet
        open={sheet === 'sticker'}
        title={activeSticker ? t('packDetail.sheetStickerTitle') : undefined}
        onClose={() => setSheet('none')}
      >
        {activeSticker ? (
          <div className="flex flex-col gap-2 pb-2">
            <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 py-2 text-[11px] text-ink-muted">
              <span>{t('packDetail.creatorCreditLabel')}</span>
              <span className="font-medium text-ink select-all">{STICKER_AUTHOR}</span>
            </div>
            <ul className="flex flex-col gap-1">
              <SheetActionRow
                label={t('packDetail.useAsTray')}
                onClick={() => void handleUseAsTray(activeSticker)}
              />
              <SheetActionRow
                label={t('packDetail.editInfo')}
                onClick={() => openMetaEditor(activeSticker)}
              />
              <SheetActionRow
                label={t('packDetail.shareSticker')}
                onClick={() => void handleShareSticker(activeSticker)}
              />
              <SheetActionRow
                label={t('packDetail.moveLeft')}
                onClick={() => void handleMove(activeSticker, -1)}
              />
              <SheetActionRow
                label={t('packDetail.moveRight')}
                onClick={() => void handleMove(activeSticker, 1)}
              />
              <SheetActionRow
                label={t('packDetail.removeFromPack')}
                tone="danger"
                onClick={() => {
                  setPendingRemove(activeSticker.id);
                  setSheet('none');
                }}
              />
            </ul>
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={sheet === 'add'}
        title={t('packDetail.addStickers')}
        onClose={() => setSheet('none')}
      >
        <div className="flex flex-col gap-2 pb-3">
          <Button
            variant="primary"
            fullWidth
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => {
              useEditorStore.getState().openNewProject();
              useEditorStore.getState().setPackId(pack.id);
              setSheet('none');
              void navigate(`/editor?pack=${pack.id}`);
            }}
          >
            {t('packDetail.createInEditor')}
          </Button>
          <Button
            variant="secondary"
            fullWidth
            icon={<ImagePlus className="size-4" aria-hidden />}
            onClick={() => void handleImportImage()}
            loading={busy}
          >
            {t('packDetail.importFromGallery')}
          </Button>
        </div>
      </BottomSheet>

      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={() => void navigate('/pacotes')}
          className="flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-2"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-semibold tracking-[-0.02em] text-ink">
            {pack.name}
          </h1>
          <p className="truncate text-[12px] text-ink-muted">
            {pack.publisher} · {t('packDetail.updated', { time: formatRelative(pack.updatedAt) })}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('packDetail.editPackTitle')}
          onClick={openRename}
          className="flex size-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-2"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      </header>

      <section className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4">
        <span className="checkerboard size-16 shrink-0 overflow-hidden rounded-[12px] border border-line">
          {pack.trayImage ? (
            <StickerPreview
              packId={pack.id}
              fileName={pack.trayImage.fileName}
              className="size-full object-contain"
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{t('packDetail.stickersBadge', { count: pack.stickers.length })}</Badge>
            {pack.stickerType === 'animated' ? <Badge tone="neutral">{t('packDetail.animatedBadge')}</Badge> : null}
            <Badge tone="neutral">v{pack.imageDataVersion}</Badge>
            <Badge tone={packReady ? 'success' : 'warning'}>
              {packReady ? t('packDetail.readyToSend') : t('packDetail.pending')}
            </Badge>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            {packReady
              ? t('packDetail.meetsRequirements')
              : (rulesValidation?.errors[0]?.message ?? t('packDetail.pending'))}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          title={t('packDetail.sendToWhatsApp')}
          description={
            capabilities && !capabilities.nativeAvailable
              ? t('packDetail.nativeOnly')
              : undefined
          }
        />

        {nativeValidation && nativeValidation.length > 0 ? (
          <ul className="rounded-[var(--radius-control)] border border-warning/30 bg-warning/10 px-3.5 py-3">
            {nativeValidation.map((message) => (
              <li key={message} className="text-[12px] leading-relaxed text-warning">
                • {message}
              </li>
            ))}
          </ul>
        ) : null}

        {capabilities && !whatsappInstalled ? (
          <div className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
            <p className="text-[13px] leading-relaxed text-ink-soft">
              {t('packDetail.whatsAppNotInstalled')}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleOpenWhatsAppStore()}
              icon={<MessageCircle className="size-4" aria-hidden />}
            >
              {t('packDetail.installWhatsApp')}
            </Button>
          </div>
        ) : null}

        {addedState && (addedState.consumer || addedState.business) ? (
          <p className="flex items-center gap-2 text-[12px] text-success">
            <Check className="size-3.5" aria-hidden />
            {addedState.consumer && addedState.business
              ? t('packDetail.alreadyAddedBoth')
              : addedState.consumer
                ? t('packDetail.alreadyAddedConsumer')
                : t('packDetail.alreadyAddedBusiness')}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => void handleValidate()}
            loading={busy}
            icon={<RefreshCw className="size-4" aria-hidden />}
          >
            {t('packDetail.verify')}
          </Button>
          <Button
            variant="primary"
            onClick={() => void handleAddToWhatsApp()}
            loading={busy}
            disabled={!packReady || (capabilities !== null && !whatsappInstalled)}
            icon={<Share2 className="size-4" aria-hidden />}
          >
            {t('packDetail.add')}
          </Button>
        </div>
        {!packReady ? (
          <p className="text-[12px] leading-relaxed text-ink-muted">
            {t('packDetail.minStickersHint', { min: WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK })}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle
          title={t('packDetail.stickersSection')}
          description={`${pack.stickers.length} / ${WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK}`}
          action={
            <Button variant="secondary" size="sm" onClick={() => setSheet('add')}>
              <Plus className="size-4" aria-hidden />
              {t('packDetail.add')}
            </Button>
          }
        />

        {pack.stickers.length === 0 ? (
          <EmptyState
            icon={<ImagePlus className="size-6" aria-hidden />}
            title={t('packDetail.emptyTitle')}
            description={t('packDetail.emptyDesc')}
            action={
              <Button variant="primary" fullWidth onClick={() => setSheet('add')}>
                {t('packDetail.addStickers')}
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-3 gap-2.5">
            {pack.stickers.map((sticker, index) => (
              <li key={sticker.id} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSticker(sticker);
                    setSheet('sticker');
                  }}
                  className="group block w-full text-left"
                >
                  <span className="checkerboard block aspect-square w-full overflow-hidden rounded-[12px] border border-line transition-colors group-hover:border-focus/50">
                    <StickerPreview
                      packId={pack.id}
                      fileName={sticker.fileName}
                      isAnimated={sticker.isAnimated}
                      className="size-full object-contain"
                    />
                  </span>
                  <span className="mt-1 block text-center text-[11px] tabular-nums text-ink-muted">
                    {index + 1} · {formatBytes(sticker.sizeBytes)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SheetActionRow({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cx(
          'w-full rounded-[12px] px-3 py-3.5 text-left text-[14px] transition-colors',
          tone === 'danger'
            ? 'text-danger hover:bg-danger/10 active:bg-danger/15'
            : 'text-ink hover:bg-surface-2 active:bg-surface-3',
        )}
      >
        {label}
      </button>
    </li>
  );
}
