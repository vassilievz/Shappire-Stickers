import { ExternalLink, Globe, Video, Image as ImageIcon, Music, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/components/primitives';
import { AnimatedShinyText, BlurFade } from '@/shared/components/motion';
import { openExternalLink } from '@/services/native/externalLinks';
import { useTranslation } from '@/i18n';

export const SHAPPIRE_TOOLS_URL = 'https://shappire.tools/';

export function ToolsPage() {
  const { t } = useTranslation();

  const handleOpenSite = () => {
    openExternalLink(SHAPPIRE_TOOLS_URL);
  };

  return (
    <div className="flex flex-col gap-6 pb-12 animate-fade-in">
      {/* Header */}
      <BlurFade delayMs={50}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-accent border border-line">
              <Globe className="size-4" strokeWidth={2.2} />
            </span>
            <AnimatedShinyText className="text-[12px] font-semibold uppercase tracking-wider text-accent">
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

      {/* Main Card */}
      <BlurFade delayMs={90}>
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-xs flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Globe className="size-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-ink">shappire.tools</span>
                <span className="text-xs text-ink-muted">Downloader Web Oficial</span>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500 border border-emerald-500/20">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Online
            </span>
          </div>

          <p className="text-sm leading-relaxed text-ink-soft">
            Baixe vídeos em alta resolução, fotos, carrosséis e áudios de redes sociais como TikTok, Instagram, Twitter/X, Pinterest, YouTube e centenas de plataformas com total facilidade direto pelo nosso site oficial.
          </p>

          {/* Recursos suportados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink">
              <Video className="size-4 text-accent shrink-0" />
              <span>Vídeos sem marca d'água</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink">
              <ImageIcon className="size-4 text-accent shrink-0" />
              <span>Fotos e carrosséis HD</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 p-3 text-xs text-ink">
              <Music className="size-4 text-accent shrink-0" />
              <span>Áudios e MP3</span>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleOpenSite}
              icon={<ExternalLink className="size-4" />}
            >
              Acessar shappire.tools
            </Button>
          </div>
        </div>
      </BlurFade>

      {/* Dica de uso */}
      <BlurFade delayMs={130}>
        <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/60 p-4 text-xs text-ink-muted leading-relaxed">
          <ShieldCheck className="size-4 shrink-0 text-accent mt-0.5" />
          <p>
            Após baixar a foto ou vídeo pelo navegador no <strong className="text-ink">shappire.tools</strong>, você pode abrir o editor do <strong className="text-ink">Shappire Stickers</strong> e importar o arquivo salvo na sua galeria para criar figurinhas instantaneamente.
          </p>
        </div>
      </BlurFade>
    </div>
  );
}
