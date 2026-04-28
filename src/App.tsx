import { onMount, onCleanup, createSignal } from 'solid-js';
import { TitleBar, Sidebar, MainCanvas } from './components/layout';
import { SettingsPanel } from './components/layout/SettingsPanel';
import { HelpPanel } from './components/layout/HelpPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ui/Toast';
import { initTheme } from './stores/settings';
import { undoParams, redoParams, canUndo, canRedo, runSimulation } from './stores/simulation';
import { Icon } from './components/ui/Icon';
import './index.css';

initTheme();

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
      <div class="h-screen h-[100dvh] flex flex-col bg-surface-container-low">
        <TitleBar onOpenSettings={handleOpenSettings} onOpenHelp={handleOpenHelp} />
        {isMobile() && (
          <header class="h-14 bg-chrome-bg border-b border-chrome-border flex items-center px-4 md:hidden flex-shrink-0" style={{ 'margin-top': 'env(safe-area-inset-top)' }}>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
              class="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
              aria-label="打开菜单"
            >
              <Icon name="menu" size={24} class="text-chrome-text-active" />
            </button>
            <h1 class="ml-3 text-lg font-semibold text-chrome-text-active font-display">CamForge</h1>
            <div class="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={undoParams}
                disabled={!canUndo()}
                class="w-11 h-11 flex items-center justify-center rounded-lg disabled:opacity-40 active:bg-chrome-active transition-colors"
                aria-label="撤销"
              >
                <Icon name="undo" size={20} class="text-chrome-text" />
              </button>
              <button
                type="button"
                onClick={redoParams}
                disabled={!canRedo()}
                class="w-11 h-11 flex items-center justify-center rounded-lg disabled:opacity-40 active:bg-chrome-active transition-colors"
                aria-label="重做"
              >
                <Icon name="redo" size={20} class="text-chrome-text" />
              </button>
              <button
                type="button"
                onClick={handleOpenSettings}
                class="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
                aria-label="设置"
              >
                <Icon name="settings" size={20} class="text-chrome-text" />
              </button>
              <button
                type="button"
                onClick={handleOpenHelp}
                class="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-chrome-surface-hover active:bg-chrome-active transition-colors"
                aria-label="帮助"
              >
                <Icon name="help" size={20} class="text-chrome-text" />
              </button>
            </div>
          </header>
        )}
        {isMobile() && isMobileMenuOpen() && (
          <div
            class="fixed inset-0 bg-black/50 z-40 md:hidden"
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