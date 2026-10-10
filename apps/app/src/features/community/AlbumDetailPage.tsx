import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Plus } from 'lucide-react';
import { SocialOverflowMenu } from './components/SocialOverflowMenu';
import { ReportSheet } from './components/ReportSheet';
import { ConfirmDialog } from '@/shared/components/overlays';
import { blockUser } from '@/services/api/socialApi';
import { Button, Spinner } from '@/shared/components/primitives';
import { TextArea } from '@/shared/components/inputs';
import { useTranslation } from '@/i18n';
import {
  fetchComments,
  fetchPublication,
  likePublication,
  postComment,
  unlikePublication,
} from '@/services/api/socialApi';
import type { PublicationDetail } from '@shappire/contracts';
import { friendlyMessage } from '@/shared/errors';
import { showToast } from '@/state/toastStore';
import { importPublicationToLibrary } from '@/services/community/importPublicationService';
import { useLibraryStore } from '@/state/libraryStore';
import { useAuthStore } from '@/state/authStore';

export function AlbumDetailPage() {
  const { publicationId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const refreshLibrary = useLibraryStore((s) => s.refresh);
  const [album, setAlbum] = useState<PublicationDetail | null>(null);
  const [comments, setComments] = useState<
    { id: string; body: string; author?: { displayName: string }; createdAt: string | null }[]
  >([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<{ targetType: 'publication' | 'comment'; targetId: string } | null>(
    null,
  );
  const [blockOpen, setBlockOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const currentUid = useAuthStore((s) => s.user?.uid);

  useEffect(() => {
    void (async () => {
      try {
        const detail = await fetchPublication(publicationId);
        setAlbum(detail);
        const page = await fetchComments(publicationId);
        setComments(page.items);
      } catch (err) {
        showToast(friendlyMessage(err), 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [publicationId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (!album) return null;

  const toggleLike = async () => {
    if (!isAuthenticated) {
      showToast(t('community.signInRequired'), 'info');
      return;
    }
    const res = album.likedByMe ? await unlikePublication(album.id) : await likePublication(album.id);
    setAlbum({ ...album, likedByMe: res.liked, likeCount: res.likeCount });
  };

  const sendComment = async () => {
    if (!isAuthenticated) {
      showToast(t('community.signInRequired'), 'info');
      return;
    }
    try {
      const created = await postComment(album.id, commentText);
      setComments((prev) => [created as typeof comments[0], ...prev]);
      setCommentText('');
      setAlbum({ ...album, commentCount: album.commentCount + 1 });
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    }
  };

  const collect = async () => {
    try {
      const result = await importPublicationToLibrary(album);
      await refreshLibrary();
      showToast(t('community.importSuccess'), 'success');
      navigate(`/pacotes/${result.packId}`);
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    }
  };

  const authorUid = album.author?.uid ?? album.ownerUid;
  const canModerateAuthor = isAuthenticated && authorUid && authorUid !== currentUid;

  const confirmBlock = async () => {
    if (!authorUid) return;
    setBlocking(true);
    try {
      await blockUser(authorUid);
      showToast(t('community.blockSuccess'), 'success');
      navigate('/comunidade?tab=explore', { replace: true });
    } catch (err) {
      showToast(friendlyMessage(err), 'error');
    } finally {
      setBlocking(false);
      setBlockOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
          <ArrowLeft className="size-4" aria-hidden />
          {t('common.back')}
        </button>
        {canModerateAuthor ? (
          <SocialOverflowMenu
            actions={[
              { id: 'report-pub', label: t('community.report'), onClick: () => setReportTarget({ targetType: 'publication', targetId: album.id }) },
              { id: 'block', label: t('community.blockUser'), danger: true, onClick: () => setBlockOpen(true) },
            ]}
          />
        ) : null}
      </div>
      {album.cover?.url ? (
        <img src={album.cover.url} alt="" className="aspect-square w-full rounded-[var(--radius-card)] object-cover" />
      ) : null}
      <div>
        <h1 className="text-lg font-semibold text-ink">{album.title}</h1>
        {album.author ? (
          <Link
            to={album.author.username ? `/comunidade/criador/${album.author.username}` : '#'}
            className="text-[13px] text-ink-muted"
          >
            {album.author.displayName}
          </Link>
        ) : null}
        {album.description ? <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{album.description}</p> : null}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={() => void toggleLike()}>
          <Heart className={album.likedByMe ? 'fill-accent text-accent' : ''} aria-hidden />
          {album.likeCount}
        </Button>
        <Button type="button" variant="secondary" onClick={() => void collect()}>
          <Plus aria-hidden />
          {t('community.addToCollection')}
        </Button>
      </div>
      <section id="comments" className="space-y-3 border-t border-line pt-4">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <MessageCircle className="size-4" aria-hidden />
          {t('community.comments')}
        </h2>
        {isAuthenticated ? (
          <div className="space-y-2">
            <TextArea
              label={t('community.commentPlaceholder')}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
            />
            <Button type="button" onClick={() => void sendComment()} disabled={!commentText.trim()}>
              {t('community.postComment')}
            </Button>
          </div>
        ) : null}
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-3 text-[13px] text-ink-soft">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-ink">{c.author?.displayName ?? '—'}</p>
                {isAuthenticated && c.id ? (
                  <SocialOverflowMenu
                    actions={[
                      {
                        id: 'report-comment',
                        label: t('community.report'),
                        onClick: () => setReportTarget({ targetType: 'comment', targetId: c.id }),
                      },
                    ]}
                  />
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <ReportSheet open={Boolean(reportTarget)} target={reportTarget} onClose={() => setReportTarget(null)} />
      <ConfirmDialog
        open={blockOpen}
        title={t('community.blockTitle')}
        message={t('community.blockDesc')}
        danger
        loading={blocking}
        confirmLabel={t('community.blockConfirm')}
        onConfirm={() => void confirmBlock()}
        onCancel={() => setBlockOpen(false)}
      />
    </div>
  );
}
