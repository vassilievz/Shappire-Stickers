import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Download,
  Film,
  Globe,
  Headphones,
  Image as ImageIcon,
  MessageCircle,
  RefreshCw,
  Sparkles,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/primitives';
import { AnimatedShinyText, BlurFade } from '@/shared/components/motion';
import { showToast } from '@/state/toastStore';
import { useTranslation } from '@/i18n';
import { cx } from '@/shared/utils/cx';
import { addImageFromDataUrlToCanvas } from '@/features/editor/store/editorAsyncActions';
import { readClipboardText } from '@/services/native/clipboard';
import {
  ToolsApiError,
  fetchImageAsDataUrl,
  requestMediaDownload,
  resolveToolsUrl,
  triggerBrowserDownload,
} from '@/services/tools/toolsApi';
import type { DownloadMode, DownloadPickerItem, DownloadSuccessResult } from '@/services/tools/types';
import { SUPPORTED_PLATFORMS, type SupportedPlatform } from './platforms';

function isImageUrl(url: string, filename?: string): boolean {
  const target = (filename || url).toLowerCase();
  return (
    target.endsWith('.png') ||
    target.endsWith('.jpg') ||
    target.endsWith('.jpeg') ||
    target.endsWith('.webp') ||
    target.endsWith('.gif') ||
    target.includes('format=jpg') ||
    target.includes('format=png') ||
    target.includes('format=webp')
  );
}

function getPlatformIcon(category: SupportedPlatform['category']) {
  switch (category) {
    case 'video':
      return Film;
    case 'audio':
      return Headphones;
    case 'photo':
      return ImageIcon;
    case 'social':
      return MessageCircle;
    default:
      return Globe;
  }
}

export function ToolsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [url, setUrl] = useState('');
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('auto');
  const [loading, setLoading] = useState(false);
  const [importingToEditor, setImportingToEditor] = useState<string | null>(null);
  const [result, setResult] = useState<DownloadSuccessResult | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handlePaste = useCallback(async () => {
    const res = await readClipboardText();
    if (res.success && res.text) {
      setUrl(res.text);
      showToast(t('tools.clipboardPasted'), 'success');
    } else if (res.error === 'empty') {
      showToast(t('tools.clipboardEmpty'), 'warning');
    } else if (res.error === 'permission_denied') {
      showToast(t('tools.clipboardPermissionDenied'), 'error');
    } else {
      showToast(t('tools.clipboardEmpty'), 'warning');
    }
  }, [t]);

  const handleClear = useCallback(() => {
    setUrl('');
    setResult(null);
    setErrorKey(null);
  }, []);

  const handleSelectPlatform = useCallback((platform: SupportedPlatform) => {
    setSelectedPlatform((current) => (current === platform.id ? null : platform.id));
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmedUrl = url.trim();
      if (!trimmedUrl) {
        showToast(t('tools.invalidUrl'), 'warning');
        return;
      }

      if (!isOnline) {
        showToast(t('tools.offlineWarning'), 'error');
        return;
      }

      setLoading(true);
      setErrorKey(null);
      setResult(null);

      try {
        const data = await requestMediaDownload({
          url: trimmedUrl,
          downloadMode,
        });
        setResult(data);
      } catch (err) {
        if (err instanceof ToolsApiError) {
          if (err.code === 'error.api.connection') {
            setErrorKey(t('tools.errors.connection'));
          } else if (err.code === 'error.api.upstream.unavailable') {
            setErrorKey(t('tools.errors.upstreamUnavailable'));
          } else if (err.code === 'error.api.rate_limited') {
            setErrorKey(t('tools.errors.rateLimited'));
          } else if (err.code === 'error.api.download.expired') {
            setErrorKey(t('tools.errors.expired'));
          } else {
            setErrorKey(t('tools.errors.generic'));
          }
        } else {
          setErrorKey(t('tools.errors.generic'));
        }
      } finally {
        setLoading(false);
      }
    },
    [url, downloadMode, isOnline, t],
  );

  const handleImportImageToEditor = useCallback(
    async (imageUrl: string, filename?: string) => {
      setImportingToEditor(imageUrl);
      try {
        const dataUrl = await fetchImageAsDataUrl(imageUrl);
        const name = filename || 'shappire-tool-image';
        const added = await addImageFromDataUrlToCanvas(dataUrl, name);
        if (added) {
          showToast(t('tools.addedToEditor'), 'success');
          navigate('/editor');
        } else {
          showToast(t('tools.errors.fetchFailed'), 'error');
        }
      } catch {
        showToast(t('tools.errors.fetchFailed'), 'error');
      } finally {
        setImportingToEditor(null);
      }
    },
    [navigate, t],
  );

  const handleDownloadFile = useCallback(
    (fileUrl: string, filename?: string) => {
      try {
        triggerBrowserDownload(fileUrl, filename);
        showToast(t('tools.downloadStarted'), 'success');
      } catch {
        showToast(t('common.error'), 'error');
      }
    },
    [t],
  );

  const currentPlaceholder = selectedPlatform
    ? t('tools.urlPlaceholderSelected', {
        platform:
          SUPPORTED_PLATFORMS.find((p) => p.id === selectedPlatform)?.name || '',
      })
    : t('tools.urlPlaceholder');

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <BlurFade delayMs={50}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-ink border border-line">
              <Wrench className="size-4" strokeWidth={2.2} />
            </span>
            <AnimatedShinyText className="text-[12px] font-semibold uppercase tracking-wider">
              {t('tools.tagline')}
            </AnimatedShinyText>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {t('tools.title')}
          </h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            {t('tools.subtitle')}
          </p>
        </div>
      </BlurFade>

      {/* Offline banner */}
      {!isOnline && (
        <BlurFade delayMs={80}>
          <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 p-4 text-ink">
            <WifiOff className="size-5 shrink-0 text-danger mt-0.5" />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-danger">{t('tools.offlineTitle')}</span>
              <p className="text-ink-muted text-[13px]">{t('tools.offlineWarning')}</p>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Input Form Card */}
      <BlurFade delayMs={100}>
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5 shadow-xs">
          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 border border-line/60">
            <button
              type="button"
              onClick={() => setDownloadMode('auto')}
              className={cx(
                'flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all',
                downloadMode === 'auto'
                  ? 'bg-surface-3 text-ink shadow-xs font-semibold'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <Film className="size-3.5" />
              <span>{t('tools.modeAuto')}</span>
            </button>
            <button
              type="button"
              onClick={() => setDownloadMode('audio')}
              className={cx(
                'flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all',
                downloadMode === 'audio'
                  ? 'bg-surface-3 text-ink shadow-xs font-semibold'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <Headphones className="size-3.5" />
              <span>{t('tools.modeAudio')}</span>
            </button>
          </div>

          {/* URL Input */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="relative flex items-center">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={currentPlaceholder}
                disabled={loading}
                className="w-full h-12 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 pr-20 text-[14px] text-ink placeholder:text-ink-muted focus:border-focus/60 focus:bg-surface-3 transition-colors outline-none"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {url ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    title={t('tools.clear')}
                    className="flex size-8 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePaste}
                    title={t('tools.paste')}
                    className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-soft hover:text-ink hover:bg-surface-3 transition-colors"
                  >
                    <Clipboard className="size-3.5" />
                    <span>{t('tools.paste')}</span>
                  </button>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              disabled={loading || !url.trim() || !isOnline}
              fullWidth
              icon={loading ? undefined : <Sparkles className="size-4" />}
            >
              {loading ? t('tools.processing') : t('tools.process')}
            </Button>
          </form>

          {/* Supported platforms with shadcn scroll-fade-x */}
          <div className="flex flex-col gap-2 pt-1 border-t border-line/40">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide uppercase text-ink-muted">
                {t('tools.supportedPlatforms')} ({SUPPORTED_PLATFORMS.length})
              </span>
              {selectedPlatform && (
                <button
                  type="button"
                  onClick={() => setSelectedPlatform(null)}
                  className="text-[11px] text-ink-muted hover:text-ink transition-colors"
                >
                  {t('tools.clearFilter')}
                </button>
              )}
            </div>

            <div
              tabIndex={0}
              aria-label={t('tools.supportedPlatforms')}
              className="scroll-fade-x no-scrollbar overflow-x-auto flex items-center gap-1.5 py-1.5 -mx-1 px-1 touch-pan-x"
            >
              {SUPPORTED_PLATFORMS.map((platform) => {
                const isSelected = selectedPlatform === platform.id;
                const Icon = getPlatformIcon(platform.category);
                return (
                  <button
                    key={platform.id}
                    type="button"
                    onClick={() => handleSelectPlatform(platform)}
                    className={cx(
                      'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none active:scale-95',
                      isSelected
                        ? 'bg-surface-3 text-ink border-ink/40 shadow-xs'
                        : 'bg-surface-2 text-ink-muted border-line/60 hover:text-ink hover:bg-surface-3',
                    )}
                  >
                    <Icon className="size-3 shrink-0" />
                    <span>{platform.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Error state */}
      {errorKey && (
        <BlurFade delayMs={120}>
          <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-danger/30 bg-danger/10 p-4 text-ink">
            <AlertCircle className="size-5 shrink-0 text-danger mt-0.5" />
            <div className="flex flex-1 flex-col gap-2 text-sm">
              <span className="font-semibold text-danger">{t('common.error')}</span>
              <p className="text-ink-soft text-[13px]">{errorKey}</p>
              <div className="pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSubmit()}
                  icon={<RefreshCw className="size-3.5" />}
                >
                  {t('common.retry')}
                </Button>
              </div>
            </div>
          </div>
        </BlurFade>
      )}

      {/* Result Section: Single Media (Redirect / Tunnel) */}
      {result && (result.status === 'redirect' || result.status === 'tunnel') && result.url && (
        <BlurFade delayMs={140}>
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-line/40 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-accent" />
                <span className="font-semibold text-sm text-ink">{t('tools.resultTitle')}</span>
              </div>
              {result.filename && (
                <span className="text-xs text-ink-muted truncate max-w-[180px]">
                  {result.filename}
                </span>
              )}
            </div>

            {/* Image Preview / Direct Sticker Import */}
            {isImageUrl(result.url, result.filename) ? (
              <div className="flex flex-col gap-4 items-center">
                <div className="relative max-h-72 w-full overflow-hidden rounded-xl border border-line bg-surface-2 flex items-center justify-center p-2">
                  <img
                    src={resolveToolsUrl(result.url)}
                    alt={result.filename || 'preview'}
                    className="max-h-64 object-contain rounded-lg"
                    crossOrigin="anonymous"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                  <Button
                    variant="primary"
                    size="md"
                    loading={importingToEditor === result.url}
                    onClick={() => handleImportImageToEditor(result.url!, result.filename)}
                    icon={<Sparkles className="size-4" />}
                  >
                    {importingToEditor === result.url
                      ? t('tools.addingToEditor')
                      : t('tools.useInStickers')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => handleDownloadFile(result.url!, result.filename)}
                    icon={<Download className="size-4" />}
                  >
                    {t('tools.saveMedia')}
                  </Button>
                </div>
              </div>
            ) : (
              /* Non-image media (video or audio) */
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-ink">
                    {downloadMode === 'audio' ? (
                      <Headphones className="size-5" />
                    ) : (
                      <Film className="size-5" />
                    )}
                  </span>
                  <div className="flex flex-1 flex-col min-w-0">
                    <span className="text-sm font-medium text-ink truncate">
                      {result.filename || t('tools.unknownMedia')}
                    </span>
                    <span className="text-xs text-ink-muted">
                      {downloadMode === 'audio' ? 'Áudio MP3' : 'Vídeo'}
                    </span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleDownloadFile(result.url!, result.filename)}
                  icon={<Download className="size-4" />}
                  fullWidth
                >
                  {downloadMode === 'audio' ? t('tools.saveAudio') : t('tools.saveMedia')}
                </Button>
              </div>
            )}
          </div>
        </BlurFade>
      )}

      {/* Result Section: Picker (Carrossel / Álbum) */}
      {result && result.status === 'picker' && result.picker && (
        <BlurFade delayMs={140}>
          <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-line/40 pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-accent" />
                <span className="font-semibold text-sm text-ink">
                  {t('tools.carouselTitle', { count: result.picker.length })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.picker.map((item: DownloadPickerItem, idx: number) => {
                const isPhoto = item.type === 'photo';
                const previewSrc = resolveToolsUrl(item.thumb || item.url);

                return (
                  <div
                    key={`${item.url}-${idx}`}
                    className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2 p-3 overflow-hidden"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-3 flex items-center justify-center">
                      <img
                        src={previewSrc}
                        alt={`item-${idx + 1}`}
                        className="size-full object-cover"
                        crossOrigin="anonymous"
                      />
                      <span className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-medium bg-black/70 backdrop-blur-xs text-white">
                        {isPhoto
                          ? t('tools.photoItem', { index: idx + 1 })
                          : t('tools.videoItem', { index: idx + 1 })}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      {isPhoto && (
                        <Button
                          variant="primary"
                          size="sm"
                          loading={importingToEditor === item.url}
                          onClick={() => handleImportImageToEditor(item.url, `photo-${idx + 1}.jpg`)}
                          icon={<Sparkles className="size-3.5" />}
                          fullWidth
                        >
                          {importingToEditor === item.url
                            ? t('tools.addingToEditor')
                            : t('tools.useInStickers')}
                        </Button>
                      )}
                      <Button
                        variant={isPhoto ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() =>
                          handleDownloadFile(
                            item.url,
                            isPhoto ? `photo-${idx + 1}.jpg` : `video-${idx + 1}.mp4`,
                          )
                        }
                        icon={<Download className="size-3.5" />}
                        fullWidth
                      >
                        {t('tools.saveMedia')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optional Audio in Picker */}
            {result.audio && (
              <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 p-3.5 mt-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-surface-3 text-ink">
                    <Headphones className="size-4" />
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-ink">{t('tools.audioTrack')}</span>
                    <span className="text-xs text-ink-muted">
                      {result.audioFilename || 'audio.mp3'}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownloadFile(result.audio!, result.audioFilename)}
                  icon={<Download className="size-3.5" />}
                >
                  {t('tools.saveAudio')}
                </Button>
              </div>
            )}
          </div>
        </BlurFade>
      )}
    </div>
  );
}
