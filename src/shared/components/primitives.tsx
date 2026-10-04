import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cx } from '@/shared/utils/cx';


type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  trailingIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:opacity-90 active:opacity-80',
  secondary:
    'bg-surface-2 text-ink border border-line hover:bg-surface-3 active:bg-surface-3',
  ghost: 'bg-transparent text-ink-soft hover:bg-surface-2 active:bg-surface-3',
  danger: 'bg-danger/12 text-danger border border-danger/30 hover:bg-danger/20',
  quiet: 'bg-surface text-ink-soft border border-line hover:bg-surface-2',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-[10px]',
  md: 'h-11 px-4 text-sm gap-2 rounded-[var(--radius-control)]',
  lg: 'h-13 min-h-[52px] px-5 text-[15px] gap-2.5 rounded-[14px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  trailingIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-[background-color,opacity,transform] duration-150 select-none',
        'disabled:opacity-45 disabled:pointer-events-none active:scale-[0.985]',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        icon
      )}
      {children}
      {trailingIcon}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger';
  size?: 'sm' | 'md';
}


export function IconButton({
  label,
  active = false,
  tone = 'default',
  size = 'md',
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        'inline-flex items-center justify-center rounded-[10px] transition-colors duration-150',
        size === 'sm' ? 'size-9' : 'size-11',
        active
          ? 'bg-accent text-on-accent'
          : tone === 'danger'
            ? 'text-danger hover:bg-danger/12 active:bg-danger/20'
            : 'text-ink-soft hover:bg-surface-2 active:bg-surface-3',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cx('size-4 animate-spin', className)} aria-hidden />;
}

type CardProps = HTMLAttributes<HTMLDivElement>;


export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cx('bg-surface border border-line rounded-[var(--radius-card)]', className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'focus';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-2 text-ink-soft border-line',
    success: 'bg-success/12 text-success border-success/30',
    warning: 'bg-warning/12 text-warning border-warning/30',
    danger: 'bg-danger/12 text-danger border-danger/30',
    focus: 'bg-focus/14 text-focus border-focus/30',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center animate-fade-in">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-line bg-surface text-ink-muted">
        {icon}
      </div>
      <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-ink-muted">{description}</p>
      {action ? <div className="mt-5 w-full max-w-[280px]">{action}</div> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx('h-px w-full bg-line', className)} />;
}
