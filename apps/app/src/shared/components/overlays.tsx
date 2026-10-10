import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, X, XCircle } from 'lucide-react';
import { Button } from './primitives';
import { useToastStore, type ToastKind } from '@/state/toastStore';
import { cx } from '@/shared/utils/cx';
import { useTranslation } from '@/i18n';
import { lockBodyScroll, unlockBodyScroll } from '@/shared/utils/bodyScrollLock';

function useOverlayBehavior(open: boolean, onClose?: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    lockBodyScroll();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
    };
  }, [open]);
}

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, description, onClose, children, footer }: ModalProps) {
  const { t } = useTranslation();
  useOverlayBehavior(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <button
        type="button"
        aria-label={t('common.close')}
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[90dvh] w-full max-w-[440px] overflow-y-auto overscroll-contain rounded-[20px] border border-line bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.6)] animate-fade-in-up"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-surface/95 px-5 pt-5 pb-2 backdrop-blur">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="-mr-1.5 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink active:scale-95 touch-manipulation"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 pb-5 pt-2">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-line bg-surface/95 px-5 py-3.5 backdrop-blur">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      title={title}
      description={message}
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {danger ? (
        <div className="flex items-start gap-3 rounded-[14px] border border-danger/25 bg-danger/8 px-3.5 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <p className="text-[13px] leading-relaxed text-ink-soft">
            {t('common.irreversibleAction')}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

export interface BottomSheetProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const { t } = useTranslation();
  useOverlayBehavior(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end animate-fade-in">
      <button
        type="button"
        aria-label={t('common.close')}
        className="absolute inset-0 bg-black/75 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t('common.panel')}
        className="relative max-h-[88dvh] w-full max-w-[720px] mx-auto overflow-y-auto overscroll-contain rounded-t-[22px] border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom,0px)+24px)] shadow-[0_-12px_36px_rgba(0,0,0,0.5)] animate-fade-in-up"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur px-5 pb-3 pt-3">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-surface-3" aria-hidden />
          {title ? (
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 hover:text-ink active:scale-95 touch-manipulation"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
        </div>
        <div className="px-5 pb-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const TOAST_TONES: Record<ToastKind, string> = {
  info: 'border-line bg-surface-2 text-ink',
  success: 'border-white/20 bg-surface-3 text-ink',
  warning: 'border-warning/30 bg-surface-2 text-ink',
  error: 'border-danger/30 bg-surface-2 text-ink',
};

export function ToastHost() {
  const { t } = useTranslation();
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  const timersRef = useRef(new Map<string, number>());

  useEffect(() => {
    const timers = timersRef.current;
    for (const toast of toasts) {
      if (timers.has(toast.id)) continue;
      const handle = window.setTimeout(() => {
        timers.delete(toast.id);
        dismiss(toast.id);
      }, toast.durationMs);
      timers.set(toast.id, handle);
    }
    for (const [id, handle] of [...timers.entries()]) {
      if (!toasts.some((toast) => toast.id === id)) {
        window.clearTimeout(handle);
        timers.delete(id);
      }
    }
  }, [toasts, dismiss]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const handle of timers.values()) window.clearTimeout(handle);
      timers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+20px)] z-[70] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          aria-label={
            toast.kind === 'info'
              ? t('common.toastInfo')
              : toast.kind === 'success'
                ? t('common.toastSuccess')
                : toast.kind === 'warning'
                  ? t('common.toastWarning')
                  : t('common.toastError')
          }
          className={cx(
            'pointer-events-auto flex w-full max-w-[440px] items-start gap-2.5 rounded-[14px] border px-3.5 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.5)] animate-toast-in',
            TOAST_TONES[toast.kind],
          )}
        >
          <span className="mt-0.5 shrink-0">
            {toast.kind === 'success' ? (
              <Check className="size-4 text-ink" aria-hidden />
            ) : toast.kind === 'error' ? (
              <XCircle className="size-4 text-danger" aria-hidden />
            ) : toast.kind === 'warning' ? (
              <AlertTriangle className="size-4 text-warning" aria-hidden />
            ) : (
              <Info className="size-4 text-ink-muted" aria-hidden />
            )}
          </span>
          <p className="flex-1 text-[13px] leading-snug text-ink">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            aria-label={t('common.dismissNotice')}
            className="-mr-1 -mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-current opacity-70 hover:opacity-100 active:scale-95 touch-manipulation relative after:absolute after:-inset-1 after:content-['']"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}
