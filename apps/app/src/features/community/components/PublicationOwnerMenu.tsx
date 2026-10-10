import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PUBLICATION_VISIBILITY, type PublicationVisibility } from '@shappire/contracts';
import { SocialOverflowMenu, type SocialMenuAction } from './SocialOverflowMenu';
import { ConfirmDialog } from '@/shared/components/overlays';
import { useTranslation } from '@/i18n';
import { removeSocialPublication } from '@/services/community/removeSocialPublicationService';
import { unpublishPublication } from '@/services/api/socialApi';
import { findPackIdByPublicationId } from '@/services/storage/packSocialRepository';
import { useCommunityStore } from '@/state/communityStore';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';

export interface PublicationOwnerMenuProps {
  publicationId: string;
  localPackId?: string | null;
  visibility: PublicationVisibility;
  publishedAt: string | null;
  onDeleted?: () => void;
  afterDeleteNavigateTo?: string;
}

export function PublicationOwnerMenu({
  publicationId,
  localPackId,
  visibility,
  publishedAt,
  onDeleted,
  afterDeleteNavigateTo,
}: PublicationOwnerMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const bumpListVersion = useCommunityStore((s) => s.bumpListVersion);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  const isPublic = visibility === PUBLICATION_VISIBILITY.public && Boolean(publishedAt);

  const openManagePack = async () => {
    const packId = localPackId ?? (await findPackIdByPublicationId(publicationId));
    if (packId) {
      navigate(`/pacotes/${packId}`);
      return;
    }
    navigate(`/comunidade/album/${publicationId}`);
  };

  const confirmUnpublish = async () => {
    if (unpublishing) return;
    setUnpublishing(true);
    try {
      await unpublishPublication(publicationId);
      bumpListVersion();
      showToast(t('community.myPublications.unpublishSuccess'), 'success');
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    } finally {
      setUnpublishing(false);
    }
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await removeSocialPublication(publicationId);
      showToast(t('community.myPublications.deleteSuccess'), 'success');
      setDeleteOpen(false);
      onDeleted?.();
      if (afterDeleteNavigateTo) {
        navigate(afterDeleteNavigateTo, { replace: true });
      }
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const actions: SocialMenuAction[] = [
    {
      id: 'view',
      label: t('community.myPublications.viewAlbum'),
      onClick: () => navigate(`/comunidade/album/${publicationId}`),
    },
    {
      id: 'manage',
      label: t('community.managePublication'),
      onClick: () => void openManagePack(),
    },
  ];

  if (isPublic) {
    actions.push({
      id: 'unpublish',
      label: t('community.myPublications.makePrivate'),
      onClick: () => void confirmUnpublish(),
    });
  }

  actions.push({
    id: 'delete',
    label: t('community.myPublications.deletePublication'),
    danger: true,
    onClick: () => setDeleteOpen(true),
  });

  return (
    <>
      <SocialOverflowMenu actions={actions} />
      <ConfirmDialog
        open={deleteOpen}
        title={t('community.myPublications.deleteTitle')}
        message={t('community.myPublications.deleteMessage')}
        danger
        loading={deleting}
        confirmLabel={t('community.myPublications.deleteConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
