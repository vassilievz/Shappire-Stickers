import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx } from '@/shared/utils/cx';

/**
 * BlurFade - Componente de revelação com desfoque e fade-in suave.
 * Inspirado nas melhores práticas do Magic UI, adaptado para modo estritamente monocromático.
 */
export interface BlurFadeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  delayMs?: number;
  durationMs?: number;
  className?: string;
}

export function BlurFade({
  children,
  delayMs = 0,
  durationMs = 320,
  className,
  style,
  ...rest
}: BlurFadeProps) {
  return (
    <div
      className={cx('animate-blur-fade', className)}
      style={{
        animationDelay: `${delayMs}ms`,
        animationDuration: `${durationMs}ms`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * AnimatedShinyText - Texto com varredura sutil de brilho monocromático.
 */
export interface AnimatedShinyTextProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  className?: string;
}

export function AnimatedShinyText({
  children,
  className,
  ...rest
}: AnimatedShinyTextProps) {
  return (
    <span
      className={cx(
        'inline-block bg-[linear-gradient(110deg,var(--sh-ink-muted)_25%,var(--sh-ink)_50%,var(--sh-ink-muted)_75%)] bg-[length:200%_auto] bg-clip-text text-transparent animate-shimmer select-none',
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/**
 * ShimmerButton - Botão de ação primária com brilho sutil monocromático e resposta tátil.
 */
export interface ShimmerButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
}

export function ShimmerButton({
  children,
  loading = false,
  icon,
  trailingIcon,
  fullWidth = false,
  className,
  disabled,
  type = 'button',
  ...rest
}: ShimmerButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[14px] bg-ink px-5 h-12 text-[14px] font-semibold text-on-accent transition-[opacity,transform] duration-150 select-none touch-manipulation whitespace-nowrap shrink-0 active:scale-[0.985] disabled:opacity-45 disabled:pointer-events-none shadow-[0_2px_12px_rgba(255,255,255,0.06)] ring-1 ring-white/15',
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {/* Varredura de brilho monocromática */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer-sweep_3s_infinite_linear] bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      {loading ? (
        <LoaderCircle className="size-4 animate-spin shrink-0" aria-hidden />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span className="relative z-10">{children}</span>
      {trailingIcon && <span className="shrink-0">{trailingIcon}</span>}
    </button>
  );
}

/**
 * DotPattern - Padrão decorativo minimalista de pontos para fundos.
 */
export function DotPattern({
  width = 20,
  height = 20,
  cxPos = 1,
  cyPos = 1,
  cr = 1,
  className,
}: {
  width?: number;
  height?: number;
  cxPos?: number;
  cyPos?: number;
  cr?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={cx(
        'pointer-events-none absolute inset-0 size-full fill-white/[0.04]',
        className,
      )}
    >
      <defs>
        <pattern
          id="shappire-dot-pattern"
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
          x="0"
          y="0"
        >
          <circle id="pattern-circle" cx={cxPos} cy={cyPos} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#shappire-dot-pattern)" />
    </svg>
  );
}
