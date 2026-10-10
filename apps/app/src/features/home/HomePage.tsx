import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ChevronRight,
  ExternalLink,
  EyeOff,
  FolderOpen,
  FolderPlus,
  MessageSquare,
  MoreVertical,
  Package,
  PenLine,
  Plus,
  RotateCcw,
  PenSquare,
  Trash2,
} from 'lucide-react';
import { NewPackDialog } from '@/features/packs/NewPackDialog';
import { Badge, Button, EmptyState, IconButton } from '@/shared/components/primitives';
import { BottomSheet, ConfirmDialog } from '@/shared/components/overlays';
import {
  PackWhatsAppProgressBar,
  WhatsAppPackRequirementCallout,
} from '@/shared/components/WhatsAppPackRequirement';
import { APP_INFO, APP_LIMITS } from '@/config/app';
import { WHATSAPP_LIMITS } from '@/config/whatsapp';
import { formatRelative } from '@/shared/utils/format';
import { useEditorStore } from '@/features/editor/store/editorStore';
import type { ProjectSummary } from '@/services/storage/projectRepository';
import { projectOperationErrorMessage } from '@/services/projects/projectService';
import { useLibraryStore } from '@/state/libraryStore';
import { showToast } from '@/state/toastStore';
import { useTranslation } from '@/i18n';

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [menuProject, setMenuProject] = useState<ProjectSummary | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const projects = useLibraryStore((state) => state.projects);
  const hiddenProjects = useLibraryStore((state) => state.hiddenProjects);
  const packs = useLibraryStore((state) => state.packs);
  const packPreviews = useLibraryStore((state) => state.packPreviews);
  const refresh = useLibraryStore((state) => state.refresh);
  const hideProject = useLibraryStore((state) => state.hideProject);
  const restoreProject = useLibraryStore((state) => state.restoreProject);
  const removeProject = useLibraryStore((state) => state.removeProject);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startNewSticker = () => {
    useEditorStore.getState().openNewProject();
    void navigate('/editor');
  };

  const recentProjects = projects.slice(0, APP_LIMITS.recentProjects);

  const handleHide = async (project: ProjectSummary) => {
    setMenuProject(null);
    setBusy(true);
    try {
      await hideProject(project.id);
      showToast(t('home.projectHidden'), 'success');
    } catch (error) {
      showToast(projectOperationErrorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (project: ProjectSummary) => {
    setBusy(true);
    try {
      await restoreProject(project.id);
      showToast(t('home.projectRestored'), 'success');
    } catch (error) {
      showToast(projectOperationErrorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const project = pendingDelete;
    if (!project) return;
    setBusy(true);
    try {
      await removeProject(project.id);
      showToast(t('home.projectDeleted'), 'success');
    } catch (error) {
      showToast(projectOperationErrorMessage(error), 'error');
    } finally {
      setBusy(false);
      setPendingDelete(null);
      setMenuProject(null);
    }
  };

  const openProject = (project: ProjectSummary) => {
    setMenuProject(null);
    void navigate(`/editor/${project.id}`);
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      <NewPackDialog
        open={packDialogOpen}
        onClose={() => setPackDialogOpen(false)}
        onCreated={(pack) => void navigate(`/pacotes/${pack.id}`)}
      />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {t('home.brandSubtitle')}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[26px]">
            {t('home.heroTitle')}
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-ink-muted">
            {t('home.heroDescription')}
          </p>
        </div>
        <span className="shrink-0 self-start">
          <Badge tone="neutral">v{APP_INFO.version}</Badge>
        </span>
      </header>

      <WhatsAppPackRequirementCallout />

      <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={startNewSticker}
          icon={<PenSquare className="size-4" aria-hidden />}
        >
          {t('home.createSticker')}
        </Button>
        <p className="text-center text-[12px] leading-relaxed text-ink-muted px-1">
          {t('home.createStickerHint')}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setPackDialogOpen(true)}
            icon={<FolderPlus className="size-4" aria-hidden />}
          >
            {t('home.newPack')}
          </Button>
          <Button
            variant="quiet"
            fullWidth
            onClick={() => void navigate('/pacotes')}
            icon={<Package className="size-4" aria-hidden />}
          >
            {t('home.myPacks')}
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-2 px-0.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{t('home.recentProjects')}</h2>
            {projects.length > 0 ? (
              <p className="mt-0.5 text-[12px] text-ink-muted">{t('home.recentProjectsDesc')}</p>
            ) : null}
          </div>
          {hiddenProjects.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setArchivedOpen(true)}
              icon={<Archive className="size-4" aria-hidden />}
            >
              {t('home.archivedCount', { count: hiddenProjects.length })}
            </Button>
          ) : null}
        </div>
          {recentProjects.length === 0 ? (
            <EmptyState
              icon={<PenLine className="size-6" aria-hidden />}
              title={t('home.noProjectsTitle')}
              description={t('home.noProjectsDesc')}
              action={
                <Button
                  variant="primary"
                  fullWidth
                  onClick={startNewSticker}
                  icon={<Plus className="size-4" aria-hidden />}
                >
                  {t('home.startNow')}
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {recentProjects.map((project) => (
                <li key={project.id} className="transition-transform duration-150 active:scale-[0.985]">
                  <div className="flex items-center gap-1 rounded-[16px] border border-line bg-surface pl-3 pr-1 transition-colors hover:bg-surface-2">
                    <button
                      type="button"
                      onClick={() => openProject(project)}
                      aria-label={`${t('home.openProject')}: ${project.name}`}
                      className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-2 text-left"
                    >
                      <span className="checkerboard size-12 shrink-0 overflow-hidden rounded-[10px] border border-line">
                        {project.thumbnail ? (
                          <img
                            src={project.thumbnail}
                            alt=""
                            className="size-full object-cover"
                            loading="lazy"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-ink">
                          {project.name}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-ink-muted">
                          {project.elementCount === 0
                            ? t('home.noElements')
                            : project.elementCount === 1
                              ? t('home.elementCount_one')
                              : t('home.elementCount_other', { count: project.elementCount })}
                          {' · '}
                          {formatRelative(project.updatedAt)}
                        </span>
                      </span>
                    </button>
                    <IconButton
                      label={`${t('home.projectActions')}: ${project.name}`}
                      size="sm"
                      onClick={() => setMenuProject(project)}
                    >
                      <MoreVertical className="size-4" aria-hidden />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <h2 className="text-[15px] font-semibold text-ink">{t('home.packsSection')}</h2>
          {packs.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => void navigate('/pacotes')}>
              {t('home.viewAll')}
            </Button>
          ) : null}
        </div>
          {packs.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-line px-4 py-5 text-center">
              <p className="text-[13px] leading-relaxed text-ink-muted">
                {t('home.noPacksDesc')}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setPackDialogOpen(true)}
                icon={<FolderPlus className="size-4" aria-hidden />}
              >
                {t('home.newPack')}
              </Button>
            </div>
          ) : (
            <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
              {packs.slice(0, 6).map((pack) => {
                const count = pack.stickers.length;
                const ready = count >= WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK;
                return (
                  <li
                    key={pack.id}
                    className="w-[min(100%,168px)] shrink-0 snap-start sm:w-auto sm:shrink"
                  >
                    <button
                      type="button"
                      onClick={() => void navigate(`/pacotes/${pack.id}`)}
                      className="flex h-full w-full min-h-[44px] flex-col rounded-[var(--radius-card)] border border-line bg-surface p-3 text-left transition-colors hover:border-focus/30 hover:bg-surface-2 active:bg-surface-3 touch-manipulation"
                    >
                      <span className="checkerboard block aspect-square w-full overflow-hidden rounded-[12px] border border-line">
                        {packPreviews[pack.id] ? (
                          <img
                            src={packPreviews[pack.id]}
                            alt=""
                            className="size-full object-contain"
                            loading="lazy"
                          />
                        ) : null}
                      </span>
                      <span className="mt-2 flex items-center gap-1.5">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                          {pack.name}
                        </span>
                        <Badge tone={ready ? 'success' : 'warning'}>
                          {ready
                            ? t('packs.ready')
                            : `${count}/${WHATSAPP_LIMITS.MIN_STICKERS_PER_PACK}`}
                        </Badge>
                      </span>
                      <PackWhatsAppProgressBar count={count} className="mt-2" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="px-0.5 text-[15px] font-semibold text-ink">{t('home.communityTitle')}</h2>
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-accent">
              <MessageSquare className="size-4" strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Discord Shappire</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{t('home.communityDesc')}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            className="w-full shrink-0 sm:w-auto"
            onClick={() => window.open(APP_INFO.discordCommunityUrl, '_blank', 'noopener,noreferrer')}
            icon={<ExternalLink className="size-4" aria-hidden />}
          >
            {t('home.communityButton')}
          </Button>
        </div>
      </section>

      {}
      <BottomSheet
        open={menuProject !== null}
        title={menuProject?.name}
        onClose={() => setMenuProject(null)}
      >
        <div className="flex flex-col gap-1.5 pb-2">
          <MenuRow
            icon={<FolderOpen className="size-4" aria-hidden />}
            label={t('home.openProject')}
            disabled={busy}
            onClick={() => menuProject && openProject(menuProject)}
          />
          <MenuRow
            icon={<EyeOff className="size-4" aria-hidden />}
            label={t('home.hideProject')}
            description={t('home.hideProjectDesc')}
            disabled={busy}
            onClick={() => menuProject && void handleHide(menuProject)}
          />
          <MenuRow
            icon={<Trash2 className="size-4" aria-hidden />}
            label={t('home.deleteProject')}
            tone="danger"
            disabled={busy}
            onClick={() => {
              const project = menuProject;
              setMenuProject(null);
              setPendingDelete(project);
            }}
          />
        </div>
      </BottomSheet>

      {}
      <BottomSheet
        open={archivedOpen}
        title={t('home.archivedProjects')}
        onClose={() => setArchivedOpen(false)}
      >
        {hiddenProjects.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-muted">{t('home.archivedEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-2 pb-2">
            {hiddenProjects.map((project) => (
              <li
                key={project.id}
                className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-ink">
                    {project.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-ink-muted">
                    {formatRelative(project.updatedAt)}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleRestore(project)}
                  icon={<RotateCcw className="size-3.5" aria-hidden />}
                >
                  {t('home.restoreProject')}
                </Button>
                <IconButton
                  label={`${t('home.deleteProject')}: ${project.name}`}
                  size="sm"
                  tone="danger"
                  disabled={busy}
                  onClick={() => setPendingDelete(project)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </BottomSheet>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t('home.deleteProjectTitle')}
        message={t('home.deleteProjectMessage', { name: pendingDelete?.name ?? '' })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        loading={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

function MenuRow({
  icon,
  label,
  description,
  tone = 'default',
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        'flex min-h-[48px] w-full items-center gap-3 rounded-[14px] border border-line px-3.5 py-3 text-left transition-colors disabled:opacity-50 touch-manipulation ' +
        (tone === 'danger'
          ? 'bg-danger/8 text-danger hover:bg-danger/15 active:bg-danger/20'
          : 'bg-surface text-ink hover:bg-surface-2 active:bg-surface-3')
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] text-ink-muted">{description}</span>
        ) : null}
      </span>
      <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden />
    </button>
  );
}
