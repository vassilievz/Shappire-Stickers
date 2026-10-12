import { STICKER_AUTHOR } from '@/domain/stickerPack';
import { Button } from '@/shared/components/primitives';
import { ConfirmDialog, Modal } from '@/shared/components/overlays';
import { TextInput } from '@/shared/components/inputs';
import { useTranslation } from '@/i18n';

export function PackDetailRenameDialog({
  open,
  busy,
  name,
  onNameChange,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  name: string;
  onNameChange: (name: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      title={t('packDetail.editPackTitle')}
      description={t('packDetail.editPackDesc')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={onSave} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          label={t('packDetail.packNameLabel')}
          name="rename-name"
          value={name}
          maxLength={128}
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>
    </Modal>
  );
}

export function PackDetailMetaDialog({
  open,
  busy,
  emojis,
  onEmojisChange,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  emojis: string;
  onEmojisChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      title={t('packDetail.editInfo')}
      description={t('packDetail.emojisHint')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={onSave} loading={busy}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          label={t('packDetail.emojisLabel')}
          name="sticker-emojis"
          value={emojis}
          placeholder="😀 😂 ✨"
          onChange={(event) => onEmojisChange(event.target.value)}
        />
        <div className="flex flex-col gap-1 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 py-2.5">
          <span className="text-[11px] font-medium tracking-wide uppercase text-ink-muted">
            {t('packDetail.creatorCreditLabel')}
          </span>
          <span className="text-[13px] font-medium text-ink select-all">{STICKER_AUTHOR}</span>
        </div>
      </div>
    </Modal>
  );
}

export function PackDetailRemoveConfirm({
  open,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <ConfirmDialog
      open={open}
      title={t('packDetail.removeConfirmTitle')}
      message={t('packDetail.removeConfirmMessage')}
      confirmLabel={t('common.delete')}
      danger
      loading={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
