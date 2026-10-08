import { useEffect, useState, type ReactNode } from 'react';
import { ImageOff, RotateCcw, Smartphone, Trash2, UserRound } from 'lucide-react';
import { BottomSheet, ConfirmDialog } from '@/shared/components/overlays';
import { Button } from '@/shared/components/primitives';
import { TextArea, TextInput } from '@/shared/components/inputs';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';
import { useProfileStore } from '@/state/profileStore';
import { showToast } from '@/state/toastStore';
import { pickSingleImage } from '@/services/native/imagePicker';
import type { ProfileDraft, ProfileImageAction } from '@/services/profile/profileService';
import type { ProfileImage } from '@/domain/profile';
import {
  MAX_BIO_LENGTH,
  MAX_DISPLAY_NAME_LENGTH,
  USERNAME_MAX_LENGTH,
  validateBio,
  validateDisplayName,
  validateUsername,
} from '@/domain/profile';
import { AppError, friendlyMessage } from '@/shared/errors';

function imageChanged(action: ProfileImageAction, current: ProfileImage | null): boolean {
  if (action.kind === 'keep') return false;
  if (action.kind === 'remove') return current !== null;
  return true;
}

function SlotPreview({
  src,
  alt,
  className,
  icon,
  failureNote,
}: {
  src: string | null;
  alt: string;
  className: string;
  icon: ReactNode;
  failureNote?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <div
      className={cx(
        'relative overflow-hidden border border-line bg-surface-2',
        failed && src && 'border-dashed',
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-ink-muted">
          {failed && failureNote ? (
            <span className="text-[10px] leading-tight">{failureNote}</span>
          ) : (
            icon
          )}
        </div>
      )}
    </div>
  );
}

function ImageSlotEditor({
  action,
  current,
  label,
  rounded,
  icon,
  onChange,
  onPickDevice,
}: {
  action: ProfileImageAction;
  current: ProfileImage | null;
  label: string;
  rounded: boolean;
  icon: ReactNode;
  onChange: (next: ProfileImageAction) => void;
  onPickDevice: () => void;
}) {
  const { t } = useTranslation();

  const hasContent = current !== null || action.kind === 'device';
  const previewSrc =
    action.kind === 'device' ? action.dataUrl : action.kind === 'keep' ? current?.url ?? null : null;

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[12px] font-medium tracking-wide text-ink-muted">{label}</span>

      <div className="flex items-center gap-3">
        <SlotPreview
          src={previewSrc}
          alt={t('profile.edit.imagePreview')}
          className={cx('shrink-0', rounded ? 'size-20 rounded-full' : 'h-20 w-32 rounded-[12px]')}
          icon={icon}
          failureNote={t('profile.edit.previewUnavailable')}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {action.kind !== 'keep' ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => onChange({ kind: 'keep' })}
              icon={<RotateCcw className="size-3.5" aria-hidden />}
            >
              {t('common.cancel')}
            </Button>
          ) : null}
          <p className="text-[11px] leading-snug text-ink-muted">
            {t('profile.edit.imageHint')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={onPickDevice}
          icon={<Smartphone className="size-3.5" aria-hidden />}
        >
          {t('profile.edit.chooseFromDevice')}
        </Button>
        {hasContent ? (
          <Button
            variant="danger"
            size="sm"
            onClick={() => onChange({ kind: 'remove' })}
            icon={<Trash2 className="size-3.5" aria-hidden />}
          >
            {t('profile.edit.removeImage', { label })}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function EditProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const profile = useProfileStore((state) => state.profile);
  const isSaving = useProfileStore((state) => state.isSaving);
  const saveError = useProfileStore((state) => state.saveError);
  const save = useProfileStore((state) => state.save);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarAction, setAvatarAction] = useState<ProfileImageAction>({ kind: 'keep' });
  const [bannerAction, setBannerAction] = useState<ProfileImageAction>({ kind: 'keep' });
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open || !profile) return;
    setDisplayName(profile.displayName);
    setUsername(profile.username ?? '');
    setBio(profile.bio);
    setAvatarAction({ kind: 'keep' });
    setBannerAction({ kind: 'keep' });
  }, [open, profile]);

  const usernameValidation = username.trim() === '' ? null : validateUsername(username);
  const usernameInvalid = usernameValidation !== null && !usernameValidation.valid;

  const displayNameInvalid = displayName.trim() !== '' && !validateDisplayName(displayName);
  const bioInvalid = !validateBio(bio);

  const dirty =
    !!profile &&
    (displayName.trim() !== profile.displayName ||
      username.trim() !== (profile.username ?? '') ||
      bio !== profile.bio ||
      imageChanged(avatarAction, profile.avatar) ||
      imageChanged(bannerAction, profile.banner));

  const canSave =
    !!profile &&
    displayName.trim() !== '' &&
    !displayNameInvalid &&
    !bioInvalid &&
    !usernameInvalid &&
    !isSaving;

  const saveErrorMessage = (() => {
    if (!saveError) return null;
    const details = (saveError.details ?? {}) as { field?: string; reason?: string };
    if (details.field === 'username' && details.reason === 'USERNAME_TAKEN') {
      return t('profile.edit.usernameTaken', { username: username.trim().toLowerCase() });
    }
    return friendlyMessage(saveError);
  })();

  const pickFromDevice = async (slot: 'avatar' | 'banner') => {
    try {
      const picked = await pickSingleImage();
      const next: ProfileImageAction = {
        kind: 'device',
        dataUrl: picked.dataUrl,
        mimeType: picked.mimeType,
      };
      if (slot === 'avatar') setAvatarAction(next);
      else setBannerAction(next);
    } catch (error) {
      if (AppError.is(error) && error.code === 'CANCELLED') return;
      showToast(friendlyMessage(error), 'error');
    }
  };

  const handleSave = async () => {
    if (!profile || !canSave) return;
    const draft: ProfileDraft = {
      displayName: displayName.trim(),
      username: username.trim(),
      bio,
      avatar: avatarAction,
      banner: bannerAction,
    };
    const ok = await save(draft);
    if (ok) {
      showToast(t('profile.edit.saved'), 'success');
      onClose();
    }
  };

  const requestClose = () => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  if (!profile) return null;

  return (
    <>
      <BottomSheet open={open} title={t('profile.edit.title')} onClose={requestClose}>
        <div className="flex flex-col gap-5 pb-2">
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {t('profile.edit.description')}
          </p>

          <TextInput
            name="profile-display-name"
            value={displayName}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
            autoComplete="name"
            label={t('profile.edit.displayNameLabel')}
            hint={t('profile.edit.displayNameHint')}
            error={displayNameInvalid ? t('validation.metadataTooLong', { field: t('profile.edit.displayNameLabel'), max: MAX_DISPLAY_NAME_LENGTH }) : undefined}
            onChange={(event) => setDisplayName(event.target.value)}
          />

          <TextInput
            name="profile-username"
            value={username}
            maxLength={USERNAME_MAX_LENGTH}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            label={`@${t('profile.edit.usernameLabel')}`}
            hint={t('profile.edit.usernameHint')}
            error={usernameInvalid ? t('profile.edit.usernameInvalid') : undefined}
            onChange={(event) => setUsername(event.target.value)}
          />

          <TextArea
            name="profile-bio"
            value={bio}
            maxLength={MAX_BIO_LENGTH}
            label={t('profile.edit.bioLabel')}
            hint={t('profile.edit.bioHint', { max: MAX_BIO_LENGTH })}
            error={bioInvalid ? t('profile.edit.bioTooLong', { max: MAX_BIO_LENGTH }) : undefined}
            onChange={(event) => setBio(event.target.value)}
          />

          <ImageSlotEditor
            action={avatarAction}
            current={profile.avatar}
            label={t('profile.edit.avatarLabel')}
            rounded
            icon={<UserRound className="size-6" aria-hidden />}
            onChange={setAvatarAction}
            onPickDevice={() => void pickFromDevice('avatar')}
          />

          <ImageSlotEditor
            action={bannerAction}
            current={profile.banner}
            label={t('profile.edit.bannerLabel')}
            rounded={false}
            icon={<ImageOff className="size-5" aria-hidden />}
            onChange={setBannerAction}
            onPickDevice={() => void pickFromDevice('banner')}
          />

          {saveErrorMessage ? (
            <p className="rounded-[12px] border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-[13px] leading-snug text-danger">
              {saveErrorMessage}
            </p>
          ) : null}
          {dirty && !saveErrorMessage ? (
            <p className="text-[12px] text-ink-muted">{t('profile.edit.unsavedChanges')}</p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={requestClose} disabled={isSaving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleSave()}
              loading={isSaving}
              disabled={!canSave}
            >
              {isSaving ? t('profile.edit.saving') : t('profile.edit.save')}
            </Button>
          </div>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmDiscard}
        title={t('profile.edit.title')}
        message={t('profile.edit.unsavedChanges')}
        confirmLabel={t('common.close')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </>
  );
}
