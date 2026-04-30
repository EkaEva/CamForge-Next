import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { useTheme, useExportSettings } from '../../stores/settings';
import { isMobilePlatform, isTauriEnv } from '../../utils/platform';
import { t, language, setLang } from '../../i18n';
import { Icon } from '../ui/Icon';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { theme, setThemeMode } = useTheme();
  const { settings, updateSettings } = useExportSettings();

  const isMobile = isMobilePlatform();
  const isTauri = isTauriEnv();

  const [pos, setPos] = createSignal({ x: 0, y: 0 });
  const [dragging, setDragging] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [initialized, setInitialized] = createSignal(false);

  const resetPosition = () => {
    const w = Math.min(520, window.innerWidth - 40);
    const h = Math.min(560, window.innerHeight - 80);
    setPos({
      x: Math.max(20, (window.innerWidth - w) / 2),
      y: Math.max(20, (window.innerHeight - h) / 2),
    });
    setInitialized(true);
  };

  onMount(() => {
    if (props.isOpen) resetPosition();
  });

  const handleMouseDown = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setDragging(true);
    setDragOffset({ x: e.clientX - pos().x, y: e.clientY - pos().y });
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging()) return;
    const newX = Math.max(0, Math.min(window.innerWidth - 200, e.clientX - dragOffset().x));
    const newY = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffset().y));
    setPos({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  onMount(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  });

  createEffect(() => {
    if (props.isOpen && !initialized()) resetPosition();
  });

  const handleSelectDownloadDir = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        directory: true,
        multiple: false,
        title: t().settings.selectDownloadDir,
      });
      if (selected) {
        updateSettings({ downloadDir: selected as string });
      }
    } catch (e) {
      console.error('Failed to select directory:', e);
    }
  };

  const handleClearDir = () => {
    updateSettings({ downloadDir: '' });
  };

  const optionBtn = (isActive: boolean) =>
    `settings-option-btn flex-1 px-3 py-2 text-sm rounded-lg border font-display ` +
    (isActive
      ? 'bg-chrome-active border-chrome-text-active text-chrome-text-active'
      : 'bg-surface-container border-outline-variant text-on-surface-variant');

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed z-50 flex flex-col border border-chrome-border rounded-lg overflow-hidden"
        classList={{ 'cursor-grabbing select-none': dragging(), 'cursor-grab': !dragging() }}
        style={{
          left: `${pos().x}px`,
          top: `${pos().y}px`,
          width: '520px',
          'max-width': 'calc(100vw - 40px)',
          'max-height': 'calc(100vh - 80px)',
          'background-color': 'var(--chrome-surface)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar - draggable */}
        <div
          class="flex items-center justify-between px-4 h-10 border-b border-chrome-border flex-shrink-0"
          style={{ 'background-color': 'var(--chrome-bg)' }}
          onMouseDown={handleMouseDown}
        >
          <div class="flex items-center gap-2">
            <Icon name="settings" size={16} class="text-chrome-text" />
            <span class="text-sm font-semibold text-chrome-text-active font-display">{t().settings.title}</span>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-chrome-surface-hover active:bg-chrome-active text-chrome-text transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5 camforge-scrollbar">
          {/* Language */}
          <div class="space-y-3">
            <h3 class="font-display text-xs uppercase tracking-wider text-on-surface-variant">
              {t().settings.language}
            </h3>
            <div class="flex gap-2">
              {(['zh', 'en'] as const).map((lang) => (
                <button
                  type="button"
                  onClick={() => setLang(lang)}
                  class={optionBtn(language() === lang)}
                >
                  {lang === 'zh' ? '中文' : 'English'}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div class="space-y-3">
            <h3 class="font-display text-xs uppercase tracking-wider text-on-surface-variant">
              {t().settings.theme}
            </h3>
            <div class="flex gap-2">
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <button
                  type="button"
                  onClick={() => setThemeMode(mode)}
                  class={optionBtn(theme() === mode)}
                >
                  {mode === 'light' ? t().settings.themeLight :
                   mode === 'dark' ? t().settings.themeDark :
                   t().settings.themeSystem}
                </button>
              ))}
            </div>
          </div>

          {/* Export DPI */}
          <div class="space-y-3">
            <h3 class="font-display text-xs uppercase tracking-wider text-on-surface-variant">
              {t().settings.defaultDpi}
            </h3>
            <div class="flex gap-2">
              {[150, 300, 600].map((dpi) => (
                <button
                  type="button"
                  onClick={() => updateSettings({ defaultDpi: dpi })}
                  class={optionBtn(settings().defaultDpi === dpi)}
                >
                  {dpi}
                </button>
              ))}
            </div>
          </div>

          {/* Export Format */}
          <div class="space-y-3">
            <h3 class="font-display text-xs uppercase tracking-wider text-on-surface-variant">
              {t().settings.defaultFormat}
            </h3>
            <div class="flex gap-2">
              {(['png', 'tiff', 'svg'] as const).map((format) => (
                <button
                  type="button"
                  onClick={() => updateSettings({ defaultFormat: format })}
                  class={optionBtn(settings().defaultFormat === format) + ' uppercase'}
                >
                  {format}
                </button>
              ))}
            </div>
          </div>

          {/* Download Directory */}
          <Show when={isTauri}>
            <div class="space-y-3">
              <h3 class="font-display text-xs uppercase tracking-wider text-on-surface-variant">
                {t().settings.downloadDir}
              </h3>
              <div class="flex gap-2">
                <input
                  type="text"
                  value={settings().downloadDir}
                  readOnly
                  placeholder={t().settings.downloadDirPlaceholder}
                  class="flex-1 px-3 py-2 text-sm bg-surface-container border border-outline-variant rounded-lg text-on-surface font-display"
                />
                <button
                  type="button"
                  onClick={handleSelectDownloadDir}
                  class="px-3 py-2 text-sm bg-chrome-run-bg hover:opacity-90 active:opacity-80 active:scale-95 text-chrome-run-text rounded-lg transition-all duration-150 font-display"
                >
                  {t().settings.select}
                </button>
                <Show when={settings().downloadDir}>
                  <button
                    type="button"
                    onClick={handleClearDir}
                    class="px-3 py-2 text-sm bg-chrome-surface-hover hover:opacity-90 active:opacity-80 active:scale-95 text-chrome-text rounded-lg border border-chrome-border transition-all duration-150 font-display"
                  >
                    {t().settings.clear}
                  </button>
                </Show>
              </div>
              <p class="text-xs text-on-surface-variant font-display">
                {t().settings.downloadDirHint}
              </p>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
