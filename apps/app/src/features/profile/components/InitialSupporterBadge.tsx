import type { SVGProps } from 'react';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';

interface InitialSupporterBadgeProps extends SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
}

const SIZE_MAP = {
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-6',
  xl: 'size-8',
};

/**
 * Ícone / Insígnia oficial de Apoiador Inicial do Shappire Stickers.
 * Exibe as duas formas estreladas/geométricas originais com gradiente vibrante.
 */
export function InitialSupporterIcon({
  size = 'md',
  className,
  ...props
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
} & SVGProps<SVGSVGElement>) {
  const gradientId = `initial-supporter-grad-${size}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={`url(#${gradientId})`}
      className={cx(SIZE_MAP[size], 'shrink-0 transition-transform duration-200', className)}
      {...props}
    >
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="45%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <path d="M5.7401 16C5.8501 15.51 5.6501 14.81 5.3001 14.46L2.8701 12.03C2.1101 11.27 1.8101 10.46 2.0301 9.76C2.2601 9.06 2.9701 8.58 4.0301 8.4L7.1501 7.88C7.6001 7.8 8.1501 7.4 8.3601 6.99L10.0801 3.54C10.5801 2.55 11.2601 2 12.0001 2C12.7401 2 13.4201 2.55 13.9201 3.54L15.6401 6.99C15.7701 7.25 16.0401 7.5 16.3301 7.67L5.5601 18.44C5.4201 18.58 5.1801 18.45 5.2201 18.25L5.7401 16Z" />
      <path d="M18.7 14.4599C18.34 14.8199 18.14 15.5099 18.26 15.9999L18.95 19.0099C19.24 20.2599 19.06 21.1999 18.44 21.6499C18.19 21.8299 17.89 21.9199 17.54 21.9199C17.03 21.9199 16.43 21.7299 15.77 21.3399L12.84 19.5999C12.38 19.3299 11.62 19.3299 11.16 19.5999L8.23005 21.3399C7.12005 21.9899 6.17005 22.0999 5.56005 21.6499C5.33005 21.4799 5.16005 21.2499 5.05005 20.9499L17.21 8.7899C17.67 8.3299 18.32 8.1199 18.95 8.2299L19.96 8.3999C21.02 8.5799 21.73 9.0599 21.96 9.7599C22.18 10.4599 21.88 11.2699 21.12 12.0299L18.7 14.4599Z" />
    </svg>
  );
}

/**
 * Componente completo com acessibilidade e pill/tag opcional.
 */
export function InitialSupporterBadge({
  size = 'md',
  showLabel = false,
  className,
  ...props
}: InitialSupporterBadgeProps) {
  const { t } = useTranslation();
  const label = t('donations.supporterBadge');

  if (showLabel) {
    return (
      <span
        title={label}
        aria-label={label}
        className={cx(
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
          'border border-line bg-surface-2 text-ink-soft',
          className,
        )}
      >
        <InitialSupporterIcon size={size === 'xl' ? 'lg' : 'sm'} {...props} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span title={label} aria-label={label} className="inline-flex shrink-0 items-center justify-center">
      <InitialSupporterIcon size={size} className={className} {...props} />
    </span>
  );
}
