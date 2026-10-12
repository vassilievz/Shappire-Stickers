import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { Button, EmptyState } from '@/shared/components/primitives';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import type { StickerRecord } from '@/domain/stickerPack';
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
  openWhatsAppStorePage,
  validatePackForWhatsApp,
} from '@/services/whatsapp/whatsappService';
import { usePackWhatsAppState } from '@/features/packs/hooks/usePackWhatsAppState';
import { pickImagesFromGallery, pickSingleImage } from '@/services/native/imagePicker';
import { shareStickerFile } from '@/services/native/shareService';
import { packStickerPath } from '@/services/storage/paths';
import { downloadPackZip } from '@/services/packs/packBackupService';
import { hapticNotification } from '@/services/native/haptics';
import { friendlyMessage } from '@/shared/errors';
import { useLibraryStore } from '@/state/libraryStore';
import { showToast } from '@/state/toastStore';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { useSettingsStore } from '@/state/settingsStore';
import { PackDetailAddSheet, PackDetailStickerSheet } from './components/PackDetailSheets';
import {
  PackDetailMetaDialog,
  PackDetailRemoveConfirm,
  PackDetailRenameDialog,
} from './components/PackDetailDialogs';
import { PackDetailHeader } from './components/PackDetailHeader';
import { PackDetailStatsCard } from './components/PackDetailStatsCard';
import { PackDetailWhatsAppSection } from './components/PackDetailWhatsAppSection';
import { PackDetailStickerGrid } from './components/PackDetailStickerGrid';

type SheetAction = 'none' | 'sticker' | 'add';

export function PackDetailPage() {
  const { t } = useTranslation();
  const { packId = '' } = useParams();
  const navigate = useNavigate();
  const authorDisplayName = useSettingsStore((state) => state.settings.authorDisplayName);
  const pack = useLibraryStore((state) => state.packs.find((item) => item.id === packId));
  const refresh = useLibraryStore((state) => state.refresh);

  const [sheet, setSheet] = useState<SheetAction>('none');
  const [activeSticker, setActiveSticker] = useState<StickerRecord | null>(null);
  const { capabilities, addedState, reloadWhatsAppState } = usePackWhatsAppState(packId);
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      showToast(t('packDetail.packUpdated'), 'success');
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
      void hapticNotification('success');
      showToast(t('packDetail.stickerImported'), 'success');
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
      setSheet('none');
    }
  };

  const handleBatchImport = async () => {
    const remainingSlots = WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK - pack.stickers.length;
    if (remainingSlots <= 0) {
      showToast(t('packDetail.fullPack'), 'warning');
      return;
    }

    setBusy(true);
    try {
      const images = await pickImagesFromGallery({ maxImages: remainingSlots });
      if (images.length === 0) return;

      let importedCount = 0;
      for (const img of images) {
        try {
          await addExistingImageToPack({
            packId: pack.id,
            dataUrl: img.dataUrl,
            accessibilityText: img.fileName,
          });
          importedCount++;
        } catch (itemErr) {
          console.warn('Erro ao importar imagem individual do lote:', itemErr);
        }
      }

      await refresh();
      void hapticNotification('success');
      showToast(t('packDetail.batchImportSuccess', { count: importedCount }), 'success');
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
      setSheet('none');
    }
  };

  const handleExportZip = async () => {
    setBusy(true);
    try {
      await downloadPackZip(pack.id);
      void hapticNotification('success');
      showToast(t('packDetail.exportZipSuccess'), 'success');
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setBusy(false);
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
            ? t('packDetail.verifySuccessNative')
            : t('packDetail.verifySuccessRules'),
          'success',
        );
        setNativeValidation([]);
      } else {
        setNativeValidation(all);
        showToast(t('packDetail.issuesFound', { count: all.length }), 'warning');
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
        showToast(t('packDetail.addedToWhatsApp'), 'success');
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
      <PackDetailRenameDialog
        open={renaming}
        busy={busy}
        name={renameValue.name}
        onNameChange={(name) => setRenameValue({ name })}
        onClose={() => setRenaming(false)}
        onSave={() => void handleRename()}
      />

      <PackDetailMetaDialog
        open={metaEditor !== null}
        busy={busy}
        emojis={metaValue.emojis}
        onEmojisChange={(emojis) => setMetaValue({ emojis })}
        onClose={() => setMetaEditor(null)}
        onSave={() => void handleSaveMeta()}
      />

      <PackDetailRemoveConfirm
        open={pendingRemove !== null}
        busy={busy}
        onConfirm={() => void handleRemoveSticker()}
        onCancel={() => setPendingRemove(null)}
      />

      <PackDetailStickerSheet
        open={sheet === 'sticker'}
        pack={pack}
        sticker={activeSticker}
        authorDisplayName={authorDisplayName}
        onClose={() => setSheet('none')}
        onUseAsTray={(sticker) => void handleUseAsTray(sticker)}
        onEditMeta={(sticker) => openMetaEditor(sticker)}
        onShare={(sticker) => void handleShareSticker(sticker)}
        onMoveLeft={(sticker) => void handleMove(sticker, -1)}
        onMoveRight={(sticker) => void handleMove(sticker, 1)}
        onRemove={(stickerId) => {
          setPendingRemove(stickerId);
          setSheet('none');
        }}
      />

      <PackDetailAddSheet
        open={sheet === 'add'}
        busy={busy}
        onClose={() => setSheet('none')}
        onCreateInEditor={() => {
          useEditorStore.getState().openNewProject();
          useEditorStore.getState().setPackId(pack.id);
          setSheet('none');
          void navigate(`/editor?pack=${pack.id}`);
        }}
        onImportImage={() => void handleImportImage()}
        onBatchImport={() => void handleBatchImport()}
      />

      <PackDetailHeader
        pack={pack}
        onBack={() => void navigate('/pacotes')}
        onExportZip={() => void handleExportZip()}
        onRename={openRename}
      />

      <PackDetailStatsCard pack={pack} packReady={packReady} rulesValidation={rulesValidation} />

      <PackDetailWhatsAppSection
        capabilities={capabilities}
        whatsappInstalled={whatsappInstalled}
        packReady={packReady}
        nativeValidation={nativeValidation}
        addedState={addedState}
        busy={busy}
        onValidate={() => void handleValidate()}
        onAddToWhatsApp={() => void handleAddToWhatsApp()}
        onOpenWhatsAppStore={() => void handleOpenWhatsAppStore()}
      />

      <PackDetailStickerGrid
        pack={pack}
        onAdd={() => setSheet('add')}
        onSelectSticker={(sticker) => {
          setActiveSticker(sticker);
          setSheet('sticker');
        }}
      />
    </div>
  );
}
