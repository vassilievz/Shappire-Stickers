import { useEffect, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import { DotPattern } from '@/shared/components/motion';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

export interface AppSplashScreenProps {
  /** true quando os dados locais já foram hidratados (configurações + biblioteca). */
  isReady: boolean;
}

/**
 * AppSplashScreen — sequência de boot e tela de carregamento do Shappire Stickers.
 *
 * Comportamento:
 * - Esconde o splash nativo assim que o WebView está pronto (transição visual contínua,
 *   ambas as telas compartilham o mesmo fundo #08090b, sem flash).
 * - Animação de carregamento 100% em código/CSS/SVG, sem imagens estáticas (zero PNG/GIF/HTTP).
 * - Emblema Shappire central com pulso suave e anel orbital de carregamento GPU-friendly.
 * - Wordmark com blur-fade e tracking amplo; linha de luz varre a barra inferior.
 * - Sem delay artificial: assim que `isReady` + janela estética mínima (~700ms para o
 *   reveal completo), faz fade-out de 320ms e libera o app.
 * - `prefers-reduced-motion`: respeita desativação de animações via motion-reduce e CSS global.
 */
export function AppSplashScreen({ isReady }: AppSplashScreenProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    // Esconde o splash nativo assim que o React monta (fundos idênticos = transição invisível).
    void SplashScreen.hide().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isReady) return undefined;
    // Janela estética mínima: garante que a animação inicial seja perceptível
    // sem impor espera quando a hidratação é rápida.
    const timer = window.setTimeout(() => setFadingOut(true), 700);
    return () => window.clearTimeout(timer);
  }, [isReady]);

  useEffect(() => {
    if (!fadingOut) return undefined;
    const timer = window.setTimeout(() => setVisible(false), 340);
    return () => window.clearTimeout(timer);
  }, [fadingOut]);

  if (!visible) return null;

  return (
    <aside
      aria-label={t('common.loadingApp')}
      className={cx(
        'fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#08090b] select-none',
        'transition-[opacity,transform] duration-[320ms] ease-out',
        fadingOut && 'pointer-events-none scale-[1.02] opacity-0',
      )}
    >
      <DotPattern className="opacity-20" />

      <div className="relative flex flex-col items-center gap-5">
        {/* Emblema vetorial e animação de carregamento (100% código/CSS, sem PNG/GIF) */}
        <div className="relative flex size-20 items-center justify-center">
          {/* Halo sutil de iluminação de fundo */}
          <div
            aria-hidden
            className="absolute -inset-4 rounded-full bg-white/[0.04] blur-xl animate-[splash-halo_2.4s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
          />

          {/* Anel orbital suave de carregamento em rotação contínua */}
          <svg
            viewBox="0 0 64 64"
            className="size-20 animate-spin motion-reduce:animate-none [animation-duration:2.8s]"
            aria-hidden
          >
            <circle
              cx="32"
              cy="32"
              r="27"
              className="stroke-white/10"
              strokeWidth="1.5"
              fill="none"
            />
            <circle
              cx="32"
              cy="32"
              r="27"
              className="stroke-white/85"
              strokeWidth="2"
              strokeDasharray="42 128"
              strokeLinecap="round"
              fill="none"
            />
          </svg>

          {/* Cristal Shappire lapidado minimalista com pulso sutil */}
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center animate-[splash-pulse_2s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
          >
            <svg
              viewBox="0 0 32 32"
              className="size-7 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 7L23 7L28 14L16 27L4 14L9 7Z"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
              <path
                d="M4 14H28"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeOpacity="0.5"
              />
              <path
                d="M9 7L13 14L16 27L19 14L23 7"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeOpacity="0.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Wordmark */}
        <div className="animate-blur-fade flex flex-col items-center gap-1.5 text-center [animation-delay:120ms]">
          <h1 className="text-[17px] font-bold uppercase tracking-[0.24em] text-[#f5f6f8]">
            Shappire Stickers
          </h1>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.2em] text-[#757b86]">
            {t('app.tagline')}
          </p>
        </div>

        {/* Linha de luz monocromática */}
        <div className="mt-3 h-[2px] w-24 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full -translate-x-full animate-[shimmer-sweep_1.4s_linear_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent motion-reduce:animate-none" />
        </div>
      </div>
    </aside>
  );
}
