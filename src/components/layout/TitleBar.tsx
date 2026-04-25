import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { isMobilePlatform } from '../../utils/platform';

export function TitleBar() {
  const [maximized, setMaximized] = createSignal(false);

  // 直接检测 Tauri 环境（同步）
  const isTauriEnv = typeof window !== 'undefined' && '__TAURI__' in window;

  // 检测是否为移动端平台（Android/iOS）
  const isMobile = isMobilePlatform();

  onMount(async () => {
    if (!isTauriEnv) return;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();

      // 初始化时获取当前状态
      setMaximized(await win.isMaximized());

      // 监听窗口状态变化
      const unlisten = win.onResized(async () => {
        setMaximized(await win.isMaximized());
      });

      onCleanup(() => {
        unlisten.then(fn => fn());
      });
    } catch (e) {
      console.error('TitleBar init error:', e);
    }
  });

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      getCurrentWindow().minimize();
    } catch (e) {
      console.error('Minimize error:', e);
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      await win.toggleMaximize();
    } catch (e) {
      console.error('Maximize error:', e);
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      getCurrentWindow().close();
    } catch (e) {
      console.error('Close error:', e);
    }
  };

  // 非 Tauri 环境或移动端平台不显示标题栏
  // 移动端使用系统原生导航，不需要自定义窗口控制按钮
  if (!isTauriEnv || isMobile) {
    return null;
  }

  return (
    <div
      class="h-8 flex items-center justify-end px-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 select-none"
      data-tauri-drag-region
    >
      <div class="flex-1 h-full" data-tauri-drag-region />

      <div class="flex items-center gap-1">
        <button
          type="button"
          onClick={handleMinimize}
          class="w-10 h-7 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors rounded"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" d="M20 12H4" />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          class="w-10 h-7 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors rounded"
        >
          <Show when={maximized()} fallback={
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="1" />
            </svg>
          }>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <rect x="6" y="2" width="12" height="12" rx="1" />
              <rect x="2" y="6" width="12" height="12" rx="1" />
            </svg>
          </Show>
        </button>
        <button
          type="button"
          onClick={handleClose}
          class="w-10 h-7 flex items-center justify-center hover:bg-red-500 hover:text-white text-gray-500 dark:text-gray-400 transition-colors rounded"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}