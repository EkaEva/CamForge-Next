/**
 * Toast 通知组件
 *
 * 用于移动端显示临时通知消息
 */

import { createSignal, onMount, onCleanup, Show, For } from 'solid-js';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
}

const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
let toastId = 0;

/**
 * 显示 Toast 通知
 *
 * @param message 通知消息
 * @param type 通知类型 (success/error/info)
 * @param duration 显示时长（毫秒），默认 3000ms
 */
export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 3000) {
  const id = ++toastId;
  const toast: ToastMessage = { id, message, type, duration };

  setToasts(prev => [...prev, toast]);

  // 自动移除
  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, duration);
}

/**
 * Toast 容器组件
 *
 * 应放置在 App 根组件中
 */
export function ToastContainer() {
  return (
    <div class="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
      <For each={toasts()}>
        {(toast) => (
          <div
            class="px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium max-w-xs text-center animate-fade-in pointer-events-auto"
            classList={{
              'bg-green-600': toast.type === 'success',
              'bg-red-600': toast.type === 'error',
              'bg-gray-700': toast.type === 'info',
            }}
          >
            {toast.message}
          </div>
        )}
      </For>
    </div>
  );
}
