import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cx } from '@/shared/utils/cx';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}


export function Field({ label, hint, error, htmlFor, children, className }: FieldProps) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[12px] font-medium tracking-wide text-ink-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] leading-snug text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] leading-snug text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  'w-full rounded-[var(--radius-control)] border border-line bg-surface-2 px-3.5 text-[14px] text-ink placeholder:text-ink-muted transition-colors focus:border-focus/60 focus:bg-surface-3';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextInput({ label, hint, error, className, ...rest }: TextInputProps) {
  const id = rest.name ?? label;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className={cx(CONTROL_CLASS, 'h-11', error && 'border-danger/60', className)}
        {...rest}
      />
    </Field>
  );
}

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextArea({ label, hint, error, className, ...rest }: TextAreaProps) {
  const id = rest.name ?? label;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <textarea
        id={id}
        className={cx(CONTROL_CLASS, 'min-h-[92px] resize-none py-2.5 leading-relaxed', className)}
        {...rest}
      />
    </Field>
  );
}

export interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  onChange: (value: number) => void;
  className?: string;
}

export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  displayValue,
  onChange,
  className,
}: SliderFieldProps) {
  const id = `slider-${label}`;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[12px] font-medium text-ink-muted">
          {label}
        </label>
        <span className="text-[12px] font-medium tabular-nums text-ink-soft">
          {displayValue ?? value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-[var(--sh-focus)]"
      />
    </div>
  );
}

export interface ColorFieldProps {
  label: string;
  value: string;
  presets?: readonly string[];
  onChange: (color: string) => void;
}


export function ColorField({ label, value, presets = [], onChange }: ColorFieldProps) {
  const id = `color-${label}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-[12px] font-medium text-ink-muted">
          {label}
        </label>
        <span className="text-[12px] uppercase tabular-nums text-ink-muted">{value}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Cor ${color}`}
            aria-pressed={value.toUpperCase() === color.toUpperCase()}
            onClick={() => onChange(color)}
            className={cx(
              'size-8 rounded-full border transition-transform active:scale-95',
              value.toUpperCase() === color.toUpperCase()
                ? 'border-focus ring-2 ring-focus/40'
                : 'border-line',
            )}
            style={{ backgroundColor: color }}
          />
        ))}
        <label
          htmlFor={id}
          className="relative flex size-8 cursor-pointer items-center justify-center rounded-full border border-dashed border-line text-ink-muted"
          title="Cor personalizada"
        >
          <span className="text-[15px] leading-none">+</span>
          <input
            id={id}
            type="color"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  label?: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}


export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {label ? (
        <span className="text-[12px] font-medium text-ink-muted">{label}</span>
      ) : null}
      <div
        role="radiogroup"
        aria-label={label}
        className="flex rounded-[var(--radius-control)] border border-line bg-surface-2 p-1"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cx(
                'flex-1 rounded-[9px] px-3 py-2 text-[13px] font-semibold transition-all duration-150',
                active
                  ? 'bg-accent text-on-accent shadow-[0_2px_8px_rgba(255,255,255,0.12)] ring-1 ring-white/20'
                  : 'text-ink-soft hover:text-ink hover:bg-surface-3/50',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface SwitchFieldProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}


export function SwitchField({ label, description, checked, onChange }: SwitchFieldProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-[var(--radius-control)] px-1 py-2.5 text-left transition-colors hover:bg-surface-2/60"
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-ink">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
      <span
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked
            ? 'border-focus bg-focus shadow-[0_0_10px_rgba(255,255,255,0.35)]'
            : 'border-line bg-surface-3',
        )}
      >
        <span
          className={cx(
            'absolute top-[1px] size-5 rounded-full transition-transform duration-200 shadow-md',
            checked ? 'translate-x-[21px] bg-on-accent' : 'translate-x-[1px] bg-ink-muted/80',
          )}
        />
      </span>
    </button>
  );
}
