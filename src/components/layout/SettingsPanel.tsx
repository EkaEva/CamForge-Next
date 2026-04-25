/**
 * 设置面板组件
 *
 * 提供应用设置配置界面
 */

import { createSignal, Show } from 'solid-js';
import { useTheme, useExportSettings } from '../../stores/settings';
import { isMobilePlatform, isTauriEnv } from '../../utils/platform';
import { t, language, setLang } from '../../i18n';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const { theme, setThemeMode } = useTheme();
  const { settings, updateSettings } = useExportSettings();
  const [selectingDir, setSelectingDir] = createSignal(false);

  const currentT = t();
  const isMobile = isMobilePlatform();
  const isTauri = isTauriEnv();

  // 选择下载目录
  const handleSelectDir = async () => {
    if (!isTauri || isMobile) return;

    try {
      setSelectingDir(true);
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selectedDir = await open({
        directory: true,
        multiple: false,
        title: currentT.settings.selectDownloadDir,
      });
      if (selectedDir) {
        updateSettings({ downloadDir: selectedDir as string });
      }
    } catch (e) {
      console.error('Select directory error:', e);
    } finally {
      setSelectingDir(false);
    }
  };

  // 清除下载目录
  const handleClearDir = () => {
    updateSettings({ downloadDir: '' });
  };

  if (!props.isOpen) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        class="absolute inset-0 bg-black/50"
        onClick={props.onClose}
      />

      {/* 设置面板 */}
      <div class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
        {/* 标题栏 */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {currentT.settings.title}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 设置内容 */}
        <div class="p-4 space-y-6">
          {/* 语言设置 */}
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {currentT.settings.language}
            </h3>
            <div class="flex gap-2">
              <button
                type="button"
                onClick={() => setLang('zh')}
                classList={{
                  'px-4 py-2 rounded-lg text-sm transition-colors': true,
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400': language() === 'zh',
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600': language() !== 'zh',
                }}
              >
                中文
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                classList={{
                  'px-4 py-2 rounded-lg text-sm transition-colors': true,
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400': language() === 'en',
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600': language() !== 'en',
                }}
              >
                English
              </button>
            </div>
          </div>

          {/* 主题设置 */}
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {currentT.settings.theme}
            </h3>
            <div class="flex gap-2">
              <button
                type="button"
                onClick={() => setThemeMode('light')}
                classList={{
                  'px-4 py-2 rounded-lg text-sm transition-colors': true,
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400': theme === 'light',
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600': theme !== 'light',
                }}
              >
                {currentT.settings.themeLight}
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('dark')}
                classList={{
                  'px-4 py-2 rounded-lg text-sm transition-colors': true,
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400': theme === 'dark',
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600': theme !== 'dark',
                }}
              >
                {currentT.settings.themeDark}
              </button>
              <button
                type="button"
                onClick={() => setThemeMode('system')}
                classList={{
                  'px-4 py-2 rounded-lg text-sm transition-colors': true,
                  'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400': theme === 'system',
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600': theme !== 'system',
                }}
              >
                {currentT.settings.themeSystem}
              </button>
            </div>
          </div>

          {/* 导出设置 */}
          <div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {currentT.settings.exportSettings}
            </h3>

            {/* 默认 DPI */}
            <div class="mb-3">
              <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                {currentT.settings.defaultDpi}
              </label>
              <select
                value={settings.defaultDpi}
                onChange={(e) => updateSettings({ defaultDpi: parseInt(e.currentTarget.value) })}
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="150">150 DPI</option>
                <option value="300">300 DPI</option>
                <option value="600">600 DPI</option>
              </select>
            </div>

            {/* 默认格式 */}
            <div class="mb-3">
              <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                {currentT.settings.defaultFormat}
              </label>
              <select
                value={settings.defaultFormat}
                onChange={(e) => updateSettings({ defaultFormat: e.currentTarget.value as 'png' | 'tiff' | 'svg' })}
                class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="tiff">TIFF</option>
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </select>
            </div>

            {/* 下载目录（仅桌面端） */}
            <Show when={isTauri && !isMobile}>
              <div>
                <label class="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                  {currentT.settings.downloadDir}
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={settings.downloadDir}
                    readonly
                    placeholder={currentT.settings.downloadDirPlaceholder}
                    class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSelectDir}
                    disabled={selectingDir()}
                    class="px-3 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white text-sm transition-colors"
                  >
                    {selectingDir() ? '...' : currentT.settings.select}
                  </button>
                  <Show when={settings.downloadDir}>
                    <button
                      type="button"
                      onClick={handleClearDir}
                      class="px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 text-sm transition-colors"
                    >
                      {currentT.settings.clear}
                    </button>
                  </Show>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {currentT.settings.downloadDirHint}
                </p>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
