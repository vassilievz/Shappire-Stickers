import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Download,
  Trash2,
  Check,
  CheckCircle2,
  Clock,
  X,
  AlertCircle,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { Button, IconButton } from '@/shared/components/primitives';
import { useTranslation } from '@/i18n';
import {
  AI_MODELS_CATALOG,
} from '@/domain/ai/modelCatalog';
import {
  modelManager,
  type ModelInstallStatus,
  type ModelDownloadProgress,
} from '@/domain/ai/modelManager';
import {
  imageEnhancementService,
  type EnhancementProgress,
  type EnhancementResult,
} from '@/domain/ai/imageEnhancementService';
import { useSettingsStore } from '@/state/settingsStore';
import { showToast } from '@/state/toastStore';

export interface ImageEnhancerModalProps {
  open: boolean;
  sourceImageSrc: string | null;
  onClose: () => void;
  onApply: (enhancedDataUrl: string) => void;
}

type ViewMode = 'split' | 'original' | 'enhanced';

export function ImageEnhancerModal({
  open,
  sourceImageSrc,
  onClose,
  onApply,
}: ImageEnhancerModalProps) {
  const { t } = useTranslation();
  const defaultAiModelId = useSettingsStore(
    (state) => state.settings.defaultAiModelId || AI_MODELS_CATALOG[0]?.id || 'realesr-anime-v3-4x',
  );
  const updateSettings = useSettingsStore((state) => state.update);

  const [modelsStatus, setModelsStatus] = useState<ModelInstallStatus[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>(defaultAiModelId);

  // Download states
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  // Processing states
  const [processing, setProcessing] = useState(false);
  const [enhancementProgress, setEnhancementProgress] = useState<EnhancementProgress | null>(null);
  const [enhancementResult, setEnhancementResult] = useState<EnhancementResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Comparison view
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [splitPosition, setSplitPosition] = useState<number>(50);

  const loadStatuses = useCallback(async () => {
    try {
      const list = await modelManager.listModelsStatus();
      setModelsStatus(list);
    } catch {
      // Ignora erro de listagem
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    void loadStatuses();
    setErrorMessage(null);
    setEnhancementResult(null);
    setProcessing(false);

    // Bloqueia a rolagem do fundo (background scroll lock)
    const prevOverflow = document.body.style.overflow;
    const prevPosition = document.body.style.position;
    const prevWidth = document.body.style.width;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.position = prevPosition;
      document.body.style.width = prevWidth;
    };
  }, [open, loadStatuses]);

  const selectedStatus = modelsStatus.find((s) => s.model.id === selectedModelId);
  const isSelectedInstalled = selectedStatus?.installed ?? false;

  const handleDownload = async (modelId: string) => {
    setDownloadingModelId(modelId);
    setDownloadProgress(0);
    setErrorMessage(null);

    try {
      await modelManager.downloadModel(modelId, (progress: ModelDownloadProgress) => {
        setDownloadProgress(progress.percentage);
      });
      showToast('Modelo instalado! Pronto para uso offline localmente.', 'success');
      await loadStatuses();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha no download.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setDownloadingModelId(null);
    }
  };

  const handleCancelDownload = (modelId: string) => {
    modelManager.cancelDownload(modelId);
    setDownloadingModelId(null);
  };

  const handleRemove = async (modelId: string) => {
    try {
      await modelManager.removeModel(modelId);
      if (enhancementResult?.modelId === modelId) {
        setEnhancementResult(null);
      }
      showToast('Modelo removido com sucesso.', 'info');
      await loadStatuses();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao remover.';
      showToast(msg, 'error');
    }
  };

  const handleSetDefault = async (modelId: string) => {
    await updateSettings({ defaultAiModelId: modelId });
    showToast('Modelo padrão atualizado.', 'info');
  };

  const handleProcess = async () => {
    if (!sourceImageSrc) return;
    setProcessing(true);
    setErrorMessage(null);

    try {
      const result = await imageEnhancementService.enhanceImage(
        sourceImageSrc,
        selectedModelId,
        (progress) => setEnhancementProgress(progress),
      );
      setEnhancementResult(result);
      setViewMode('split');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro na inferência.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setProcessing(false);
      setEnhancementProgress(null);
    }
  };

  const handleApply = () => {
    if (!enhancementResult) return;
    onApply(enhancementResult.enhancedDataUrl);
    onClose();
  };

  if (!open) return null;

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-enhancer-title"
      className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center sm:items-center bg-black/85 backdrop-blur-md overflow-hidden"
    >
      <div className="relative flex flex-col w-full h-[100dvh] sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl bg-surface sm:rounded-2xl border-0 sm:border sm:border-line shadow-2xl overflow-hidden">
        {/* Header Fixo */}
        <div className="shrink-0 flex items-center justify-between border-b border-line bg-surface/95 backdrop-blur px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] sm:pt-3.5 sm:px-5 sm:py-3.5 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 id="ai-enhancer-title" className="text-sm sm:text-base font-semibold text-ink truncate">
                {t('aiEnhancer.modalTitle')}
              </h2>
              <p className="text-[11px] sm:text-xs text-ink-muted truncate">{t('aiEnhancer.subtitle')}</p>
            </div>
          </div>
          <IconButton
            label={t('aiEnhancer.closeButton')}
            onClick={onClose}
            disabled={processing}
          >
            <X className="size-5" />
          </IconButton>
        </div>

        {/* Content Body com Scroll Interno */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-5 space-y-4">
          {/* Aviso de privacidade e IA local */}
          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/80 p-2.5 sm:p-3 text-[11px] sm:text-xs text-ink-muted">
            <ShieldCheck className="size-4 shrink-0 text-accent mt-0.5" />
            <p className="leading-relaxed">{t('aiEnhancer.disclaimer')}</p>
          </div>

          {/* Seleção do Modelo */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {t('aiEnhancer.availableModels')}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {AI_MODELS_CATALOG.map((model) => {
                const status = modelsStatus.find((s) => s.model.id === model.id);
                const isInstalled = status?.installed ?? false;
                const isSelected = selectedModelId === model.id;
                const isDefault = defaultAiModelId === model.id;
                const isDownloading = downloadingModelId === model.id;

                return (
                  <div
                    key={model.id}
                    onClick={() => !processing && setSelectedModelId(model.id)}
                    className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-accent bg-accent/5 ring-1 ring-accent'
                        : 'border-line bg-surface-2 hover:bg-surface-3'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm text-ink">{model.name}</span>
                        <div className="flex items-center gap-1.5">
                          {isDefault && (
                            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent">
                              {t('aiEnhancer.defaultModelBadge')}
                            </span>
                          )}
                          {isInstalled ? (
                            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-500">
                              <CheckCircle2 className="size-3.5" />
                              {t('aiEnhancer.installedBadge')}
                            </span>
                          ) : (
                            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-muted">
                              {model.formattedSize}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">
                        {model.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5">
                      <span className="text-[11px] font-medium text-ink-soft">
                        {t('aiEnhancer.scaleFactor', { scale: model.scale })}
                      </span>

                      <div className="flex items-center gap-1">
                        {!isInstalled && !isDownloading && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDownload(model.id);
                            }}
                            icon={<Download className="size-3.5" />}
                          >
                            {t('aiEnhancer.downloadButton')}
                          </Button>
                        )}

                        {isDownloading && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-accent">
                              {downloadProgress}%
                            </span>
                            <Button
                              variant="quiet"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelDownload(model.id);
                              }}
                            >
                              <X className="size-3.5 text-danger" />
                            </Button>
                          </div>
                        )}

                        {isInstalled && (
                          <div className="flex items-center gap-1">
                            {!isDefault && (
                              <button
                                type="button"
                                title={t('aiEnhancer.setDefault')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleSetDefault(model.id);
                                }}
                                className="text-[11px] text-accent hover:underline mr-1"
                              >
                                {t('aiEnhancer.setDefault')}
                              </button>
                            )}
                            <IconButton
                              size="sm"
                              label={t('aiEnhancer.deleteModel')}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleRemove(model.id);
                              }}
                            >
                              <Trash2 className="size-3.5 text-ink-muted hover:text-danger" />
                            </IconButton>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progresso de inferência ou erro */}
          {processing && enhancementProgress && (
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-ink">
                <span>{enhancementProgress.message}</span>
                <span>{enhancementProgress.progressPercentage}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full bg-accent transition-all duration-300"
                  style={{ width: `${enhancementProgress.progressPercentage}%` }}
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Área de Visualização e Comparação */}
          {sourceImageSrc && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {enhancementResult
                      ? t('aiEnhancer.comparisonTitle')
                      : t('aiEnhancer.originalTab')}
                  </span>
                  {enhancementResult && (
                    <span className="flex items-center gap-1 rounded bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink">
                      <Clock className="size-3 text-accent" />
                      {t('aiEnhancer.timeElapsed', {
                        time: (enhancementResult.durationMs / 1000).toFixed(1),
                      })}
                    </span>
                  )}
                </div>

                {enhancementResult && (
                  <div className="flex rounded-lg border border-line bg-surface-2 p-0.5">
                    <button
                      type="button"
                      onClick={() => setViewMode('split')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                        viewMode === 'split' ? 'bg-surface-1 text-ink shadow-sm' : 'text-ink-muted'
                      }`}
                    >
                      {t('aiEnhancer.splitTab')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('original')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                        viewMode === 'original'
                          ? 'bg-surface-1 text-ink shadow-sm'
                          : 'text-ink-muted'
                      }`}
                    >
                      {t('aiEnhancer.originalTab')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('enhanced')}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded ${
                        viewMode === 'enhanced'
                          ? 'bg-surface-1 text-ink shadow-sm'
                          : 'text-ink-muted'
                      }`}
                    >
                      {t('aiEnhancer.enhancedTab')}
                    </button>
                  </div>
                )}
              </div>

              {/* Quadro de Imagem com fundo xadrez (transparência) */}
              <div className="relative mx-auto flex h-44 sm:h-64 w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-[linear-gradient(45deg,#1f2228_25%,transparent_25%),linear-gradient(-45deg,#1f2228_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#1f2228_75%),linear-gradient(-45deg,transparent_75%,#1f2228_75%)] bg-[size:16px_16px] bg-[#14161a]">
                {!enhancementResult || viewMode === 'original' ? (
                  <img
                    src={sourceImageSrc}
                    alt="Original"
                    className="max-h-full max-w-full object-contain p-2"
                  />
                ) : viewMode === 'enhanced' ? (
                  <img
                    src={enhancementResult.enhancedDataUrl}
                    alt="Enhanced"
                    className="max-h-full max-w-full object-contain p-2"
                  />
                ) : (
                  /* Modo Divisão (Split Slider) */
                  <div className="relative h-full w-full select-none">
                    {/* Imagem Original (fundo) */}
                    <img
                      src={sourceImageSrc}
                      alt="Original"
                      className="absolute inset-0 h-full w-full object-contain p-2"
                    />

                    {/* Imagem Melhorada (sobreposição cortada) */}
                    <div
                      className="absolute inset-0 h-full w-full overflow-hidden"
                      style={{ clipPath: `inset(0 0 0 ${splitPosition}%)` }}
                    >
                      <img
                        src={enhancementResult.enhancedDataUrl}
                        alt="Enhanced"
                        className="h-full w-full object-contain p-2"
                      />
                    </div>

                    {/* Linha divisória interativa */}
                    <div
                      className="absolute top-0 bottom-0 z-10 w-0.5 bg-accent cursor-ew-resize"
                      style={{ left: `${splitPosition}%` }}
                    >
                      <div className="absolute top-1/2 -left-2.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-white shadow-md">
                        <Layers className="size-3" />
                      </div>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={splitPosition}
                      onChange={(e) => setSplitPosition(Number(e.target.value))}
                      className="absolute inset-0 z-20 h-full w-full opacity-0 cursor-ew-resize"
                      aria-label="Controle de comparação antes e depois"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Fixo Sempre Visível no Rodapé, acima de qualquer barra */}
        <div className="shrink-0 flex items-center justify-between border-t border-line bg-surface/98 backdrop-blur px-4 py-3 sm:px-5 sm:py-3.5 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] sm:pb-3.5 z-20">
          <div>
            {enhancementResult ? (
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setEnhancementResult(null)}
                disabled={processing}
              >
                {t('aiEnhancer.discardButton')}
              </Button>
            ) : (
              <Button variant="quiet" size="sm" onClick={onClose} disabled={processing}>
                {t('aiEnhancer.cancelButton')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!enhancementResult ? (
              <Button
                variant="primary"
                size="sm"
                disabled={!isSelectedInstalled || processing || !sourceImageSrc}
                onClick={() => void handleProcess()}
                icon={<Sparkles className="size-4" />}
              >
                {processing
                  ? t('aiEnhancer.processingButton', {
                      progress: enhancementProgress?.progressPercentage ?? 0,
                    })
                  : t('aiEnhancer.processButton')}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleApply}
                icon={<Check className="size-4" />}
              >
                {t('aiEnhancer.applyButton')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
