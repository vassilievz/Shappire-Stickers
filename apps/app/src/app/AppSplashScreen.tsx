import { useEffect, useState } from 'react';
import { SplashScreen } from '@capacitor/splash-screen';
import logoImg from '@/assets/logo.png';
import { DotPattern } from '@/shared/components/motion';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

export interface AppSplashScreenProps {
  /** true quando os dados locais já foram hidratados (configurações + biblioteca). */
  isReady: boolean;
}

/**
 * AppSplashScreen — sequência de boot do Shappire Stickers.
 *
 * Comportamento:
 * - Esconde o splash nativo assim que o WebView está pronto (transição visual contínua,
 *   ambas as telas compartilham o mesmo fundo #08090b, sem flash).
 * - Revela o emblema com blur-to-sharp e escala sutil (0.96 → 1) — 100% CSS, GPU-friendly.
 * - Wordmark com blur-fade e tracking amplo; linha de luz varre a barra inferior.
 * - Sem delay artificial: assim que `isReady` + janela estética mínima (~700ms para o
 *   reveal completo), faz fade-out de 320ms e libera o app.
 * - `prefers-reduced-motion`: todas as animações são reduzidas pela regra global do CSS.
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
    // Janela estética mínima: garante que o reveal do logo (0.9s) seja perceptível
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
        {/* Emblema: blur-to-sharp + escala sutil */}
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden
            className="absolute -inset-6 rounded-full bg-white/[0.04] blur-2xl animate-[splash-halo_2.4s_ease-in-out_infinite_alternate]"
          />
          <img
            src={logoImg}
            alt=""
            aria-hidden
            className="size-20 object-contain drop-shadow-[0_8px_32px_rgba(255,255,255,0.1)] animate-[splash-pulse_0.9s_cubic-bezier(0.23,1,0.32,1)_both]"
          />
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
          <div className="h-full w-full -translate-x-full animate-[shimmer-sweep_1.4s_linear_infinite] bg-gradient-to-r from-transparent via-white/70 to-transparent" />
        </div>
      </div>
    </aside>
  );
}
