import { deletePublication } from '@/services/api/socialApi';
import { findPackIdByPublicationId, removePackSocial } from '@/services/storage/packSocialRepository';
import { useCommunityStore } from '@/state/communityStore';

/** Removes the remote publication only; local pack files stay on device. */
export async function removeSocialPublication(publicationId: string): Promise<void> {
  await deletePublication(publicationId);
  useCommunityStore.getState().markPublicationRemoved(publicationId);
  const packId = await findPackIdByPublicationId(publicationId);
  if (packId) {
    await removePackSocial(packId);
  }
}
