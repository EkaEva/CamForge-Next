import { onMount, onCleanup, createSignal } from 'solid-js';
import { TitleBar, Sidebar, MainCanvas } from './components/layout';
import { SettingsPanel } from './components/layout/SettingsPanel';
import { HelpPanel } from './components/layout/HelpPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ui/Toast';
import { initTheme } from './stores/settings';
import { undoParams, redoParams, canUndo, canRedo, runSimulation } from './stores/simulation';
import { toggleTheme, isDark } from './stores/settings';
import { language, setLang, t } from './i18n';
import { Icon } from './components/ui/Icon';
import './index.css';

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);
  const [showSettings, setShowSettings] = createSignal(false);
  const [activeTab, setActiveTab] = createSignal<'simulation' | 'export'>('simulation');
  const [showHelp, setShowHelp] = createSignal(false);

  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) {
        undoParams();
      }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (canRedo()) {
        redoParams();
      }
    }
  };

  onMount(() => {
    initTheme();
    checkMobile();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', checkMobile);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', checkMobile);
  });

  const handleOpenSettings = () => setShowSettings(true);
  const handleOpenHelp = () => setShowHelp(true);

  onMount(() => {
    runSimulation();
  });

  return (
    <ErrorBoundary>
      <div class="h-screen h-[100dvh] flex flex-col bg-surface-container-low overflow-x-hidden">
        <TitleBar onOpenSettings={handleOpenSettings} onOpenHelp={handleOpenHelp} />
        {isMobile() && (
          <header class="h-14 bg-chrome-bg border-b border-chrome-border flex items-center px-3 md:hidden flex-shrink-0 overflow-x-hidden" style={{ 'margin-top': 'env(safe-area-inset-top)' }}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
              class="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
              aria-label={t().aria.menu}
            >
              <Icon name="menu" size={24} class="text-chrome-text-active" />
            </button>
            <div class="ml-auto flex items-center gap-px">
              <button
                type="button"
                onClick={undoParams}
                disabled={!canUndo()}
                class="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-30 hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
                aria-label={t().aria.undo}
              >
                <Icon name="undo" size={18} class="text-chrome-text" />
              </button>
              <button
                type="button"
                onClick={redoParams}
                disabled={!canRedo()}
                class="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-30 hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
                aria-label={t().aria.redo}
              >
                <Icon name="redo" size={18} class="text-chrome-text" />
              </button>
              <button
                type="button"
                onClick={() => setLang(language() === 'en' ? 'zh' : 'en')}
                class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
                aria-label={t().aria.language}
              >
                <span class="text-xs font-display text-chrome-text">{language() === 'zh' ? '中文' : 'EN'}</span>
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
                aria-label={t().aria.toggleTheme}
              >
                <Icon name={isDark() ? 'light_mode' : 'dark_mode'} size={18} class="text-chrome-text" />
              </button>
              <button
                type="button"
                onClick={handleOpenSettings}
                class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
                aria-label={t().aria.settings}
              >
                <Icon name="settings" size={18} class="text-chrome-text" />
              </button>
              <button
                type="button"
                onClick={handleOpenHelp}
                class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
                aria-label={t().aria.help}
              >
                <Icon name="help" size={18} class="text-chrome-text" />
              </button>
            </div>
          </header>
        )}
        {isMobile() && isMobileMenuOpen() && (
          <div
            class="fixed inset-y-0 right-0 z-40"
            style={{ left: '18rem', 'padding-top': 'env(safe-area-inset-top)' }}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        <div class="flex-1 flex overflow-hidden relative">
          <Sidebar
            isMobile={isMobile()}
            isOpen={isMobile() ? isMobileMenuOpen() : true}
            onClose={() => setIsMobileMenuOpen(false)}
          />
          <MainCanvas activeTab={activeTab()} onTabChange={setActiveTab} />
        </div>
        <SettingsPanel isOpen={showSettings()} onClose={() => setShowSettings(false)} />
        <HelpPanel isOpen={showHelp()} onClose={() => setShowHelp(false)} />
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;