import { onMount, onCleanup, createSignal } from 'solid-js';
import { TitleBar, Sidebar, MainCanvas, StatusBar } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTheme } from './stores/settings';
import { undoParams, redoParams, canUndo, canRedo } from './stores/simulation';
import './index.css';

// 初始化主题
initTheme();

function App() {
  // 移动端菜单状态
  const [isMobileMenuOpen, setIsMobileMenuOpen] = createSignal(false);
  const [isMobile, setIsMobile] = createSignal(false);

  // 检测移动端
  const checkMobile = () => {
    setIsMobile(window.innerWidth < 768);
  };

  // 键盘快捷键处理
  const handleKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Z 或 Cmd+Z: 撤销
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) {
        undoParams();
      }
    }
    // Ctrl+Y 或 Cmd+Shift+Z: 重做
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

  return (
    <ErrorBoundary>
      <div class="h-screen h-[100dvh] flex flex-col bg-white dark:bg-gray-900">
        <TitleBar />
        {/* 移动端顶部导航栏 */}
        {isMobile() && (
          <header class="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-4 md:hidden flex-shrink-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen())}
              class="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
              aria-label="打开菜单"
            >
              <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 class="ml-3 text-lg font-semibold text-gray-900 dark:text-white">CamForge</h1>
            {/* 移动端撤销/重做按钮 */}
            <div class="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={undoParams}
                disabled={!canUndo()}
                class="w-11 h-11 flex items-center justify-center rounded-lg disabled:opacity-40 active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
                aria-label="撤销"
              >
                <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={redoParams}
                disabled={!canRedo()}
                class="w-11 h-11 flex items-center justify-center rounded-lg disabled:opacity-40 active:bg-gray-200 dark:active:bg-gray-600 transition-colors"
                aria-label="重做"
              >
                <svg class="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
                </svg>
              </button>
            </div>
          </header>
        )}
        {/* 移动端遮罩层 */}
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
          <MainCanvas />
        </div>
        <StatusBar />
      </div>
    </ErrorBoundary>
  );
}

export default App;