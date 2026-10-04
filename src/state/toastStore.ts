import { create } from 'zustand';
import { createId } from '@/shared/utils/id';

export type ToastKind = 'info' | 'success' | 'error' | 'warning';

export interface ToastItem {
  id: string;
  kind: ToastKind;
  message: string;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id' | 'durationMs'> & { durationMs?: number }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULT_DURATION: Record<ToastKind, number> = {
  info: 3500,
  success: 3500,
  warning: 5000,
  error: 6000,
};

const MAX_VISIBLE_TOASTS = 3;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  push: (toast) => {
    const id = createId('toast');
    const item: ToastItem = {
      id,
      kind: toast.kind,
      message: toast.message,
      durationMs: toast.durationMs ?? DEFAULT_DURATION[toast.kind],
    };
    set((state) => ({
      toasts: [...state.toasts, item].slice(-MAX_VISIBLE_TOASTS),
    }));
    return id;
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  clear: () => set({ toasts: [] }),
}));


export function showToast(
  message: string,
  kind: ToastKind = 'info',
  durationMs?: number,
): string {
  return useToastStore.getState().push({ message, kind, durationMs });
}

export function dismissToast(id: string): void {
  useToastStore.getState().dismiss(id);
}
