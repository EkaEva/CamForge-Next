import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { isTauriEnv as checkIsTauriEnv, isMobilePlatform } from '../../utils/platform';
import { useTheme } from '../../stores/settings';
import { t, language, setLang } from '../../i18n';
import { Icon } from '../ui/Icon';

interface TitleBarProps {
  onOpenSettings?: () => void;
  onOpenHelp?: () => void;
}

export function TitleBar(props: TitleBarProps) {
  const [maximized, setMaximized] = createSignal(false);

  const isTauriEnv = checkIsTauriEnv();
  const isMobile = isMobilePlatform();
  const { isDark, toggleTheme } = useTheme();

  onMount(async () => {
    if (!isTauriEnv) return;

    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();

      setMaximized(await win.isMaximized());

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

  const getLanguageButtonText = () => {
    return language() === 'zh' ? '中文' : 'EN';
  };

  // Action buttons shared between Tauri and Web modes
  const actionButtons = (
    <div class="flex items-center gap-0.5 text-chrome-text" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setLang(language() === 'en' ? 'zh' : 'en')}
        class="titlebar-action-btn px-2 h-7 flex items-center justify-center text-chrome-text text-xs font-display"
      >
        {getLanguageButtonText()}
      </button>
      <button
        type="button"
        onClick={toggleTheme}
        class="titlebar-action-btn w-8 h-7 flex items-center justify-center text-chrome-text"
      >
        <Show when={isDark()} fallback={
          <Icon name="dark_mode" size={16} />
        }>
          <Icon name="light_mode" size={16} />
        </Show>
      </button>
      <Show when={props.onOpenSettings}>
        <button
          type="button"
          onClick={props.onOpenSettings}
          class="titlebar-action-btn w-8 h-7 flex items-center justify-center text-chrome-text"
          title={t().settings.title}
        >
          <Icon name="settings" size={16} />
        </button>
      </Show>
      <Show when={props.onOpenHelp}>
        <button
          type="button"
          onClick={props.onOpenHelp}
          class="titlebar-action-btn w-8 h-7 flex items-center justify-center text-chrome-text"
          title={t().help.title}
        >
          <Icon name="help" size={16} />
        </button>
      </Show>
    </div>
  );

  // Mobile: no title bar
  if (isMobile) {
    return null;
  }

  // Tauri desktop: drag region + action buttons + window controls
  if (isTauriEnv) {
    return (
      <div
        class="h-8 flex items-center justify-end px-3 bg-chrome-bg border-b border-chrome-border select-none"
        data-tauri-drag-region
      >
        <div class="flex-1 h-full" data-tauri-drag-region />
        {actionButtons}
        <div class="border-l border-chrome-border mx-1 h-5" />
        <div class="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleMinimize}
            class="w-10 h-7 flex items-center justify-center hover:bg-chrome-surface-hover text-chrome-text transition-colors rounded"
          >
            <Icon name="remove" size={16} />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            class="w-10 h-7 flex items-center justify-center hover:bg-chrome-surface-hover text-chrome-text transition-colors rounded"
          >
            <Show when={maximized()} fallback={
              <Icon name="crop_square" size={16} />
            }>
              <Icon name="filter_none" size={16} />
            </Show>
          </button>
          <button
            type="button"
            onClick={handleClose}
            class="w-10 h-7 flex items-center justify-center hover:bg-red-500 hover:text-white text-chrome-text transition-colors rounded"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Web: lightweight header bar with app name + action buttons (hidden on mobile, mobile header in App.tsx handles it)
  return (
    <div class="h-8 hidden md:flex items-center justify-between px-4 bg-chrome-bg border-b border-chrome-border select-none">
      <span class="font-display text-sm font-semibold text-chrome-text-active tracking-tight">CamForge</span>
      {actionButtons}
    </div>
  );
}
