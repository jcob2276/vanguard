export type ToastType = 'info' | 'success' | 'error';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
}

type ToastListener = (items: ToastItem[]) => void;
type ConfirmListener = (open: boolean, message: string) => void;

let toasts: ToastItem[] = [];
const toastListeners = new Set<ToastListener>();

let confirmOpen = false;
let confirmMessage = '';
let confirmResolve: ((value: boolean) => void) | null = null;
const confirmListeners = new Set<ConfirmListener>();

function emitToasts() {
  const snapshot = [...toasts];
  toastListeners.forEach((l) => l(snapshot));
}

function emitConfirm() {
  confirmListeners.forEach((l) => l(confirmOpen, confirmMessage));
}

export function subscribeToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  listener([...toasts]);
  return () => toastListeners.delete(listener);
}

export function subscribeConfirm(listener: ConfirmListener): () => void {
  confirmListeners.add(listener);
  listener(confirmOpen, confirmMessage);
  return () => confirmListeners.delete(listener);
}

export function notify(
  message: string,
  type: ToastType = 'info',
  opts?: { action?: { label: string; onClick: () => void }; duration?: number },
): string {
  const id = crypto.randomUUID();
  toasts = [...toasts, { id, type, message, action: opts?.action }];
  emitToasts();
  window.setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emitToasts();
  }, opts?.duration ?? 4200);
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

export function confirmDialog(message: string): Promise<boolean> {
  if (confirmOpen) return Promise.resolve(false);
  confirmMessage = message;
  confirmOpen = true;
  emitConfirm();
  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

export function resolveConfirm(value: boolean) {
  confirmOpen = false;
  confirmMessage = '';
  emitConfirm();
  confirmResolve?.(value);
  confirmResolve = null;
}
