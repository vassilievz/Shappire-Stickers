import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Download,
  Trash2,
  CheckCircle2,
  Image as ImageIcon,
  HardDrive,
  Cpu,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/shared/components/primitives';
import { BlurFade, AnimatedShinyText } from '@/shared/components/motion';
import { AI_MODELS_CATALOG, type ModelMetadata } from '@/domain/ai/modelCatalog';
import {
  modelManager,
  type ModelInstallStatus,
  type ModelDownloadProgress,
} from '@/domain/ai/modelManager';
import { ImageEnhancerModal } from '@/features/editor/components/ImageEnhancerModal';
import { pickImagesFromGallery } from '@/services/native/imagePicker';
import { addImageFromDataUrlToCanvas } from '@/features/editor/store/editorAsyncActions';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';
import { useTranslation } from '@/i18n';

export function AiModelsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const defaultAiModelId = useSettingsStore(
    (state) => state.settings.defaultAiModelId || AI_MODELS_CATALOG[0]?.id || 'realesr-anime-v3-4x',
  );
  const updateSettings = useSettingsStore((state) => state.update);

  const [modelsStatus, setModelsStatus] = useState<ModelInstallStatus[]>([]);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadProgressDetails, setDownloadProgressDetails] = useState<{
    loaded: string;
    total: string;
  }>({ loaded: '0 MB', total: '0 MB' });

  // Modal de aprimoramento rápido direto pela página de IA
  const [enhancerOpen, setEnhancerOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);

  const loadStatuses = useCallback(async () => {
    try {
      const statuses = await modelManager.listModelsStatus();
      setModelsStatus(statuses);
    } catch {
      // Ignora erro de leitura inicial
    }
  }, []);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  const handleDownload = async (model: ModelMetadata) => {
    setDownloadingModelId(model.id);
    setDownloadProgress(0);
    setDownloadProgressDetails({
      loaded: '0 MB',
      total: model.formattedSize,
    });

    try {
      await modelManager.downloadModel(model.id, (prog: ModelDownloadProgress) => {
        setDownloadProgress(prog.percentage);
        setDownloadProgressDetails({
          loaded: `${(prog.loadedBytes / (1024 * 1024)).toFixed(1)} MB`,
          total: `${(prog.totalBytes / (1024 * 1024)).toFixed(1)} MB`,
        });
      });
      showToast(t('aiEnhancer.downloadSuccess', { name: model.name }), 'success');
      await loadStatuses();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      showToast(msg, 'error');
    } finally {
      setDownloadingModelId(null);
      setDownloadProgress(0);
    }
  };

  const handleCancelDownload = (modelId: string) => {
    modelManager.cancelDownload(modelId);
    setDownloadingModelId(null);
    setDownloadProgress(0);
    showToast(t('aiEnhancer.cancelDownload'), 'info');
  };

  const handleRemove = async (modelId: string) => {
    try {
      await modelManager.removeModel(modelId);
      showToast(t('aiEnhancer.modelRemoved'), 'info');
      await loadStatuses();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error');
      showToast(msg, 'error');
    }
  };

  const handleSetDefault = async (modelId: string) => {
    await updateSettings({ defaultAiModelId: modelId });
    showToast(t('aiEnhancer.defaultUpdated'), 'info');
  };

  const handlePickAndEnhance = async () => {
    try {
      const picked = await pickImagesFromGallery({ maxImages: 1 });
      if (picked.length > 0 && picked[0]) {
        setSelectedImageSrc(picked[0].dataUrl);
        setEnhancerOpen(true);
      }
    } catch {
      // Usuário cancelou ou fechou galeria
    }
  };

  const handleApplyToEditor = async (enhancedUrl: string) => {
    try {
      const added = await addImageFromDataUrlToCanvas(enhancedUrl, 'ia_enhanced');
      if (added) {
        showToast(t('tools.addedToEditor'), 'success');
        navigate('/editor');
      }
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setEnhancerOpen(false);
      setSelectedImageSrc(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fade-in">
      {/* Header */}
      <BlurFade delayMs={50}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-accent border border-line">
              <Sparkles className="size-4" strokeWidth={2.2} />
            </span>
            <AnimatedShinyText className="text-[12px] font-semibold uppercase tracking-wider text-accent">
              {t('aiModels.tagline')}
            </AnimatedShinyText>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {t('aiModels.title')}
          </h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            {t('aiModels.subtitle')}
          </p>
        </div>
      </BlurFade>

      {/* Ação de Aprimorar Imagem Instantânea */}
      <BlurFade delayMs={80}>
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <ImageIcon className="size-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">{t('aiModels.quickEnhanceTitle')}</h2>
                <p className="text-xs text-ink-muted">{t('aiModels.quickEnhanceSubtitle')}</p>
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={handlePickAndEnhance}
            icon={<Sparkles className="size-4" aria-hidden />}
          >
            {t('aiModels.pickAndEnhanceButton')}
          </Button>
        </div>
      </BlurFade>

      {/* Banner de Privacidade e Execução Local */}
      <BlurFade delayMs={110}>
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/60 p-4 text-xs text-ink-muted">
          <ShieldCheck className="size-4 shrink-0 text-accent mt-0.5" />
          <div className="flex flex-col gap-1 leading-relaxed">
            <span className="font-semibold text-ink">{t('aiModels.offlineGuaranteeTitle')}</span>
            <p>{t('aiModels.offlineGuaranteeDesc')}</p>
          </div>
        </div>
      </BlurFade>

      {/* Lista de Modelos ONNX do Catálogo */}
      <BlurFade delayMs={140}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {t('aiModels.catalogTitle')}
            </h2>
            <span className="text-xs text-ink-muted">
              {modelsStatus.filter((s) => s.installed).length} / {AI_MODELS_CATALOG.length} {t('aiModels.installedCount')}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {AI_MODELS_CATALOG.map((model) => {
              const status = modelsStatus.find((s) => s.model.id === model.id);
              const isInstalled = status?.installed ?? false;
              const isDefault = defaultAiModelId === model.id;
              const isDownloading = downloadingModelId === model.id;

              return (
                <div
                  key={model.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition-all ${
                    isDefault
                      ? 'border-accent/40 bg-surface ring-1 ring-accent/30'
                      : 'border-line bg-surface'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-ink">{model.name}</span>
                        <span className="text-[11px] text-accent font-medium">
                          {model.recommendedFor === 'anime_illustration'
                            ? t('aiEnhancer.recommendedAnime')
                            : t('aiEnhancer.recommendedPhoto')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isDefault && (
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                            {t('aiEnhancer.defaultModelBadge')}
                          </span>
                        )}
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted font-mono">
                          {model.scale}x
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-ink-muted leading-relaxed">
                      {model.description}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-ink-muted pt-1 border-t border-line/40">
                      <span className="flex items-center gap-1">
                        <HardDrive className="size-3" />
                        {model.formattedSize}
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu className="size-3" />
                        ONNX (WASM)
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="size-3" />
                        {model.license}
                      </span>
                    </div>

                    {isDownloading && (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex items-center justify-between text-xs text-ink-soft">
                          <span>{t('aiEnhancer.downloadProgress', { loaded: downloadProgressDetails.loaded, total: downloadProgressDetails.total })}</span>
                          <span className="font-semibold">{downloadProgress}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <div
                            className="h-full bg-accent transition-all duration-200"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-line/50 flex flex-col gap-2">
                    {isDownloading ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => handleCancelDownload(model.id)}
                      >
                        {t('aiEnhancer.cancelDownload')}
                      </Button>
                    ) : isInstalled ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-1.5 text-xs font-medium text-emerald-500">
                          <CheckCircle2 className="size-4" />
                          <span>{t('aiEnhancer.installedBadge')}</span>
                        </div>
                        {!isDefault && (
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={() => void handleSetDefault(model.id)}
                          >
                            {t('aiEnhancer.setDefault')}
                          </Button>
                        )}
                        <Button
                          variant="quiet"
                          size="sm"
                          onClick={() => void handleRemove(model.id)}
                          icon={<Trash2 className="size-3.5 text-danger" />}
                        />
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => void handleDownload(model)}
                        icon={<Download className="size-3.5" />}
                      >
                        {t('aiEnhancer.downloadButton')}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </BlurFade>

      {/* Modal Interativo de Melhoria de Imagem */}
      <ImageEnhancerModal
        open={enhancerOpen}
        sourceImageSrc={selectedImageSrc}
        onApply={(enhanced) => void handleApplyToEditor(enhanced)}
        onClose={() => {
          setEnhancerOpen(false);
          setSelectedImageSrc(null);
        }}
      />
    </div>
  );
}
