import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FolderPlus, Package, Send } from 'lucide-react';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { validateEmojis } from '@/domain/validation/whatsappRules';
import { Badge, Button } from '@/shared/components/primitives';
import { BottomSheet } from '@/shared/components/overlays';
import { TextInput } from '@/shared/components/inputs';
import { NewPackDialog } from '@/features/packs/NewPackDialog';
import { exportStickerToPack } from '@/features/editor/store/editorAsyncActions';
import { useEditorStore } from '@/features/editor/store/editorStore';
import { useLibraryStore } from '@/state/libraryStore';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';
import { friendlyMessage } from '@/shared/errors';
import { formatBytes } from '@/shared/utils/format';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';
import { formatAuthorAttribution } from '@/config/attribution';

export interface EditorExportSheetProps {
  open: boolean;
  onClose: () => void;
  onExportSuccess?: (packId: string) => void;
}

export function EditorExportSheet({ open, onClose, onExportSuccess }: EditorExportSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const packs = useLibraryStore((state) => state.packs);
  const refresh = useLibraryStore((state) => state.refresh);
  const settings = useSettingsStore((state) => state.settings);
  const defaultPackId = settings.defaultPackId;
  const currentPackId = useEditorStore((state) => state.packId);
  const exporting = useEditorStore((state) => state.exporting);
  const elementCount = useEditorStore((state) => state.history.present.length);

  const [packId, setPackId] = useState<string | null>(null);
  const [emojis, setEmojis] = useState('✨');
  const [createOpen, setCreateOpen] = useState(false);

  const effectivePackId =
    packId ??
    currentPackId ??
    defaultPackId ??
    packs[0]?.id ??
    null;

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.id === effectivePackId) ?? null,
    [packs, effectivePackId],
  );

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleExport = async () => {
    if (!selectedPack) {
      showToast(t('editor.export.choosePack'), 'warning');
      return;
    }
    const emojiList = emojis.trim().split(/\s+/).filter(Boolean);
    const firstError = validateEmojis(emojiList)[0];
    if (firstError) {
      showToast(
        t('packDetail.emojisValidationError', { max: WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER }),
        'error',
      );
      return;
    }

    try {
      const result = await exportStickerToPack(selectedPack.id, {
        emojis: emojiList,
      });
      if (result.warnings.length > 0) {
        showToast(result.warnings[0] ?? '', 'info');
      }
      onClose();
      if (onExportSuccess) {
        onExportSuccess(selectedPack.id);
      } else {
        void navigate(`/pacotes/${selectedPack.id}`);
      }
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    }
  };

  return (
    <>
      <NewPackDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(pack) => {
          setPackId(pack.id);
          useEditorStore.getState().setPackId(pack.id);
        }}
      />

      <BottomSheet open={open} title={t('editor.export.title')} onClose={onClose}>
        {elementCount === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-ink-muted">
            {t('editor.export.emptyCanvasPrompt')}
          </p>
        ) : packs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-1 py-6 text-center">
            <Package className="size-6 text-ink-muted" aria-hidden />
            <p className="max-w-[34ch] text-[13px] leading-relaxed text-ink-muted">
              {t('editor.export.noPacksDesc')}
            </p>
            <Button
              variant="primary"
              onClick={() => setCreateOpen(true)}
              icon={<FolderPlus className="size-4" aria-hidden />}
            >
              {t('newPack.submit')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-2">
            <ul className="flex flex-col gap-2">
              {packs.map((pack) => {
                const active = pack.id === effectivePackId;
                const ready = pack.stickers.length >= WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK;
                const full = pack.stickers.length >= WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK;
                return (
                  <li key={pack.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      disabled={full}
                      onClick={() => {
                        setPackId(pack.id);
                        useEditorStore.getState().setPackId(pack.id);
                      }}
                      className={cx(
                        'flex w-full items-center gap-3 rounded-[14px] border px-3 py-3 text-left transition-all duration-150',
                        active
                          ? 'border-focus bg-surface-2 shadow-[0_0_12px_rgba(255,255,255,0.08)] ring-1 ring-focus/40'
                          : 'border-line bg-surface hover:bg-surface-2/70',
                        full && 'opacity-50',
                      )}
                    >
                      <span
                        className={cx(
                          'flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                          active ? 'border-focus bg-focus text-on-accent' : 'border-line bg-surface-2',
                        )}
                      >
                        {active ? <Check className="size-3.5 stroke-[3]" aria-hidden /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink">{pack.name}</span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                          {pack.stickers.length} / {WHATSAPP_LIMITS.MAX_STICKERS_PER_PACK}
                          {full ? ` · ${t('editor.export.full')}` : ` · ${formatBytes(pack.stickers.reduce((sum, s) => sum + s.sizeBytes, 0))}`}
                        </span>
                      </span>
                      <Badge tone={ready ? 'success' : 'warning'}>
                        {ready ? t('editor.export.ready') : t('editor.export.incomplete')}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>

            <Button
              variant="quiet"
              fullWidth
              onClick={() => setCreateOpen(true)}
              icon={<FolderPlus className="size-4" aria-hidden />}
            >
              {t('editor.export.createNewPack')}
            </Button>

            <TextInput
              label={t('editor.export.emojisLabel', { max: WHATSAPP_LIMITS.MAX_EMOJIS_PER_STICKER })}
              name="editor-export-emojis"
              value={emojis}
              placeholder="😀 ✨"
              onChange={(event) => setEmojis(event.target.value)}
              hint={t('packDetail.emojisHint')}
            />

            {/* Autoria: exibida apenas na tela de detalhe (abaixo da figurinha) — nunca gravada na imagem. */}
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
              <span className="text-[12px] leading-relaxed text-ink-muted">{t('editor.export.attributionNote')}</span>
              <span className="shrink-0 font-mono text-[11px] text-ink-soft">
                {formatAuthorAttribution(settings.authorDisplayName)}
              </span>
            </div>

            <div className="rounded-[var(--radius-control)] border border-line bg-surface px-3.5 py-3">
              <p className="text-[12px] leading-relaxed text-ink-muted">
                {t('editor.export.webpNotice')}
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={exporting}
              disabled={!selectedPack}
              onClick={() => void handleExport()}
              icon={<Send className="size-4" aria-hidden />}
            >
              {t('editor.export.submit')}
            </Button>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
