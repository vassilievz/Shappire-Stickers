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
  Sparkles,
  Trash2,
} from 'lucide-react';
import { NewPackDialog } from '@/features/packs/NewPackDialog';
import { Badge, Button, EmptyState, IconButton, SectionTitle } from '@/shared/components/primitives';
import { BottomSheet, ConfirmDialog } from '@/shared/components/overlays';
import { AnimatedShinyText, BlurFade, ShimmerButton } from '@/shared/components/motion';
import { APP_INFO, APP_LIMITS } from '@/config/app';
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
    <div className="flex flex-col gap-8 pb-4">
      <NewPackDialog
        open={packDialogOpen}
        onClose={() => setPackDialogOpen(false)}
        onCreated={(pack) => void navigate(`/pacotes/${pack.id}`)}
      />

      <BlurFade delayMs={0} durationMs={320}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-muted">
              <AnimatedShinyText>Shappire Stickers OTA</AnimatedShinyText>
            </p>
            <h1 className="mt-1 text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-1.5 max-w-[36ch] text-[14px] leading-relaxed text-ink-muted">
              {t('home.heroDescription')}
            </p>
          </div>
          <Badge tone="neutral">v{APP_INFO.version}</Badge>
        </header>
      </BlurFade>

      <BlurFade delayMs={80} durationMs={320}>
        <section className="flex flex-col gap-3">
          <ShimmerButton
            fullWidth
            onClick={startNewSticker}
            icon={<Sparkles className="size-5" aria-hidden />}
          >
            {t('home.createSticker')}
          </ShimmerButton>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="secondary"
              onClick={() => setPackDialogOpen(true)}
              icon={<FolderPlus className="size-4" aria-hidden />}
            >
              {t('home.newPack')}
            </Button>
            <Button
              variant="quiet"
              onClick={() => void navigate('/pacotes')}
              icon={<Package className="size-4" aria-hidden />}
            >
              {t('home.myPacks')}
            </Button>
          </div>
        </section>
      </BlurFade>

      <BlurFade delayMs={140} durationMs={320}>
        <section className="flex flex-col gap-3">
          <SectionTitle
            title={t('home.recentProjects')}
            description={projects.length > 0 ? t('home.recentProjectsDesc') : undefined}
            action={
              hiddenProjects.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setArchivedOpen(true)}
                  icon={<Archive className="size-4" aria-hidden />}
                >
                  {t('home.archivedCount', { count: hiddenProjects.length })}
                </Button>
              ) : undefined
            }
          />
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
      </BlurFade>

      <BlurFade delayMs={200} durationMs={320}>
        <section className="flex flex-col gap-3">
          <SectionTitle
            title={t('home.packsSection')}
            action={
              packs.length > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => void navigate('/pacotes')}>
                  {t('home.viewAll')}
                </Button>
              ) : undefined
            }
          />
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
            <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 no-scrollbar sm:-mx-6 sm:px-6">
              {packs.slice(0, 8).map((pack) => (
                <li key={pack.id} className="shrink-0 transition-transform duration-150 active:scale-[0.96]">
                  <button
                    type="button"
                    onClick={() => void navigate(`/pacotes/${pack.id}`)}
                    className="w-[132px] rounded-[16px] border border-line bg-surface p-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="checkerboard block aspect-square w-full overflow-hidden rounded-[10px] border border-line transition-colors group-hover:border-focus/40">
                      {packPreviews[pack.id] ? (
                        <img
                          src={packPreviews[pack.id]}
                          alt=""
                          className="size-full object-contain"
                          loading="lazy"
                        />
                      ) : null}
                    </span>
                    <span className="mt-2 block truncate text-[13px] font-medium text-ink">
                      {pack.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-muted">
                      {t('home.stickersCount', { count: pack.stickers.length })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </BlurFade>

      <BlurFade delayMs={240} durationMs={320}>
        <section className="flex flex-col gap-3">
          <SectionTitle title={t('home.communityTitle')} />
          <div className="relative overflow-hidden rounded-[20px] border border-line bg-surface p-4.5 sm:p-5 shadow-xs transition-colors hover:border-line-focus">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/25">
                  <MessageSquare className="size-5" aria-hidden />
                </span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                      Discord Shappire
                    </span>
                    <Badge tone="focus">Oficial</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                    {t('home.communityDesc')}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.open(APP_INFO.discordCommunityUrl, '_blank', 'noopener,noreferrer')}
                icon={<ExternalLink className="size-3.5" aria-hidden />}
              >
                {t('home.communityButton')}
              </Button>
            </div>
          </div>
        </section>
      </BlurFade>

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
