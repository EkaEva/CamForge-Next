import { onMount, onCleanup } from 'solid-js';
import { TitleBar, Sidebar, MainCanvas, StatusBar } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initTheme } from './stores/settings';
import { undoParams, redoParams, canUndo, canRedo } from './stores/simulation';
import './index.css';

// 初始化主题
initTheme();

function App() {
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
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  return (
    <ErrorBoundary>
      <div class="h-screen flex flex-col bg-white dark:bg-gray-900">
        <TitleBar />
        <div class="flex-1 flex overflow-hidden">
          <Sidebar />
          <MainCanvas />
        </div>
        <StatusBar />
      </div>
    </ErrorBoundary>
  );
}

export default App;