import { createSignal, For } from 'solid-js';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
}

const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
let toastId = 0;

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) {
  const id = ++toastId;
  const toast: ToastMessage = { id, message, type, duration };

  setToasts(prev => [...prev, toast]);

  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, duration);
}

export function ToastContainer() {
  return (
    <div role="status" aria-live="polite" aria-atomic="true" class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={toasts()}>
        {(toast) => (
          <div
            class="px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-md text-center animate-fade-in pointer-events-auto break-all font-display"
            classList={{
              'bg-success text-surface-container-lowest': toast.type === 'success',
              'bg-error text-surface-container-lowest': toast.type === 'error',
              'bg-surface-container-high text-on-surface border border-outline-variant': toast.type === 'info',
            }}
          >
            {toast.message}
          </div>
        )}
      </For>
    </div>
  );
}
