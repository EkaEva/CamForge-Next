import { Show } from 'solid-js';
import { simulationData, isLoading } from '../../stores/simulation';
import { useTheme } from '../../stores/settings';
import { t, language, setLang } from '../../i18n';

export function StatusBar() {
  const { isDark, toggleTheme } = useTheme();

  const getStatus = () => {
    const currentT = t();
    if (isLoading()) return currentT.status.running;
    const data = simulationData();
    if (data) return currentT.status.pointsComputed.replace('{n}', String(data.s.length));
    return currentT.status.ready;
  };

  const getLanguageButtonText = () => {
    return language() === 'zh' ? '中文' : 'EN';
  };

  const currentT = t();

  return (
    <footer class="h-8 flex items-center justify-between px-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
      <div class="flex items-center gap-2">
        <Show when={isLoading()}>
          <div class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </Show>
        <span>{getStatus()}</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLang(language() === 'en' ? 'zh' : 'en')}
          class="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
        >
          {getLanguageButtonText()}
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          class="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <Show when={isDark} fallback={
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          }>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </Show>
        </button>
        <span class="text-xs text-gray-400 dark:text-gray-500">v0.2.0</span>
      </div>
    </footer>
  );
}