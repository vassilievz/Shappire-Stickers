import { useState } from 'react';
import { MAX_ALBUM_DESCRIPTION_LENGTH } from '@shappire/contracts';
import type { StickerPack } from '@/domain/stickerPack';
import { BottomSheet } from '@/shared/components/overlays';
import { Button } from '@/shared/components/primitives';
import { SwitchField, TextArea } from '@/shared/components/inputs';
import { useTranslation } from '@/i18n';
import {
  syncPackToPublication,
  type PublishProgress,
} from '@/services/community/publicationSyncService';
import { savePackSocial } from '@/services/storage/packSocialRepository';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';

interface PublishPackSheetProps {
  open: boolean;
  onClose: () => void;
  pack: StickerPack;
  publicationId?: string | null;
}

export function PublishPackSheet({ open, onClose, pack, publicationId }: PublishPackSheetProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [isAdult, setIsAdult] = useState(false);
  const [makePublic, setMakePublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PublishProgress | null>(null);

  const canPublish = pack.stickers.length >= WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK;

  const handlePublish = async () => {
    if (!canPublish) {
      showToast(t('community.minStickers'), 'error');
      return;
    }
    if (busy) return;
    setBusy(true);
    setProgress({ phase: 'draft' });
    try {
      const result = await syncPackToPublication({
        pack,
        description,
        isAdultContent: isAdult,
        makePublic,
        publicationId,
        onProgress: setProgress,
      });
      await savePackSocial(pack.id, {
        publicationId: result.id,
        visibility: makePublic ? 'public' : 'private',
        lastSyncedAt: new Date().toISOString(),
      });
      showToast(makePublic ? t('community.publishSuccess') : t('community.draftSaved'), 'success');
      onClose();
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const progressLabel = (() => {
    if (!progress) return null;
    if (progress.phase === 'draft') return t('community.publishProgress.draft');
    if (progress.phase === 'upload' && progress.total) {
      return t('community.publishProgress.upload', {
        current: progress.completed ?? 0,
        total: progress.total,
      });
    }
    if (progress.phase === 'publish') return t('community.publishProgress.publish');
    if (progress.phase === 'done') return t('community.publishProgress.done');
    return null;
  })();

  return (
    <BottomSheet open={open} onClose={onClose} title={t('community.publishTitle')}>
      <div className="space-y-4 px-4 pb-6">
        <p className="text-[13px] text-ink-muted">{t('community.publishHint')}</p>
        <p className="text-[12px] leading-relaxed text-ink-muted">{t('community.importCopyNotice')}</p>
        <TextArea
          label={t('community.albumDescription')}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_ALBUM_DESCRIPTION_LENGTH))}
          hint={`${description.length}/${MAX_ALBUM_DESCRIPTION_LENGTH}`}
          rows={4}
        />
        <SwitchField
          label={t('community.adultContent')}
          description={t('community.adultContentHint')}
          checked={isAdult}
          onChange={setIsAdult}
        />
        <SwitchField
          label={t('community.makePublic')}
          description={t('community.makePublicHint')}
          checked={makePublic}
          onChange={setMakePublic}
        />
        {progressLabel ? (
          <p className="text-center text-[12px] text-ink-muted" role="status" aria-live="polite">
            {progressLabel}
          </p>
        ) : null}
        <Button type="button" fullWidth loading={busy} disabled={busy} onClick={() => void handlePublish()}>
          {makePublic ? t('community.confirmPublish') : t('community.saveDraft')}
        </Button>
      </div>
    </BottomSheet>
  );
}
