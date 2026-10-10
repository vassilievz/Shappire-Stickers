import { useState } from 'react';
import { Button } from '@/shared/components/primitives';
import { Modal } from '@/shared/components/overlays';
import { SegmentedControl, TextInput } from '@/shared/components/inputs';
import { validateMetadataText } from '@/domain/validation/whatsappRules';
import type { StickerPack, StickerType } from '@/domain/stickerPack';
import { useLibraryStore } from '@/state/libraryStore';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';
import { useTranslation } from '@/i18n';
import { WhatsAppPackRequirementCallout } from '@/shared/components/WhatsAppPackRequirement';

export interface NewPackDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (pack: StickerPack) => void;
}


export function NewPackDialog({ open, onClose, onCreated }: NewPackDialogProps) {
  const { t } = useTranslation();
  const createPack = useLibraryStore((state) => state.createPack);

  const [name, setName] = useState('');
  const [stickerType, setStickerType] = useState<StickerType>('static');
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const [lastOpen, setLastOpen] = useState(false);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setName('');
      setStickerType('static');
      setTouched(false);
      setSubmitting(false);
    }
  }

  const nameErrors = touched ? validateMetadataText(name, 'name') : [];
  const isValid = validateMetadataText(name, 'name').length === 0;

  const handleSubmit = async () => {
    setTouched(true);
    if (!isValid) return;
    setSubmitting(true);
    try {
      const pack = await createPack({ name, stickerType });
      showToast(t('newPack.createdSuccess', { name: pack.name }), 'success');
      onCreated?.(pack);
      onClose();
    } catch (error) {
      showToast(friendlyMessage(error), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('newPack.title')}
      description={t('newPack.description')}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => void handleSubmit()} loading={submitting}>
            {t('newPack.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <WhatsAppPackRequirementCallout variant="compact" />
        <SegmentedControl<StickerType>
          label={t('newPack.formatLabel')}
          value={stickerType}
          options={[
            { value: 'static', label: t('newPack.formatStatic') },
            { value: 'animated', label: t('newPack.formatAnimated') },
          ]}
          onChange={(type) => setStickerType(type)}
        />
        <TextInput
          label={t('newPack.nameLabel')}
          name="pack-name"
          value={name}
          maxLength={128}
          placeholder={t('newPack.namePlaceholder')}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => setTouched(true)}
          error={nameErrors[0]?.message}
          autoComplete="off"
        />
      </div>
    </Modal>
  );
}
