import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { t } from '../../i18n';
import { Icon } from '../ui/Icon';
import { isTauriEnv } from '../../utils/platform';

interface HelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpPanel(props: HelpPanelProps) {
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

  const openExternal = async (url: string) => {
    if (isTauriEnv()) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        openUrl(url);
      } catch {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  };

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
            <Icon name="help" size={16} class="text-chrome-text" />
            <span class="text-sm font-semibold text-chrome-text-active font-display">{t().help.title}</span>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-chrome-surface-hover text-chrome-text transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5 camforge-scrollbar">
          {/* Keyboard Shortcuts */}
          <div class="space-y-3">
            <h3 class="font-display text-xs uppercase tracking-wider text-on-surface-variant">
              {t().help.keyboardShortcuts}
            </h3>
            <div class="space-y-1.5">
              <div class="flex items-center justify-between py-1.5 px-3 bg-surface-container-lowest rounded-md">
                <span class="text-sm text-on-surface-variant font-display">{t().help.undo}</span>
                <kbd class="px-2 py-0.5 bg-surface-container rounded text-xs text-on-surface font-mono border border-outline-variant">Ctrl+Z</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5 px-3 bg-surface-container-lowest rounded-md">
                <span class="text-sm text-on-surface-variant font-display">{t().help.redo}</span>
                <kbd class="px-2 py-0.5 bg-surface-container rounded text-xs text-on-surface font-mono border border-outline-variant">Ctrl+Shift+Z</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5 px-3 bg-surface-container-lowest rounded-md">
                <span class="text-sm text-on-surface-variant font-display">{t().help.playPause}</span>
                <kbd class="px-2 py-0.5 bg-surface-container rounded text-xs text-on-surface font-mono border border-outline-variant">Space</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5 px-3 bg-surface-container-lowest rounded-md">
                <span class="text-sm text-on-surface-variant font-display">{t().help.stepForward}</span>
                <kbd class="px-2 py-0.5 bg-surface-container rounded text-xs text-on-surface font-mono border border-outline-variant">→</kbd>
              </div>
              <div class="flex items-center justify-between py-1.5 px-3 bg-surface-container-lowest rounded-md">
                <span class="text-sm text-on-surface-variant font-display">{t().help.stepBackward}</span>
                <kbd class="px-2 py-0.5 bg-surface-container rounded text-xs text-on-surface font-mono border border-outline-variant">←</kbd>
              </div>
            </div>
            <p class="text-xs text-on-surface-variant font-display">{t().help.shortcutsNote}</p>
          </div>

          {/* About */}
          <div class="space-y-3">
            <h3 class="font-display text-xs uppercase tracking-wider text-on-surface-variant">
              {t().help.about}
            </h3>
            <div class="py-3 px-4 bg-surface-container-lowest rounded-md space-y-2">
              <div class="flex items-center gap-3">
                <img src="/logo.png" alt="CamForge" width="32" height="32" class="h-8 w-auto" />
                <button
                  type="button"
                  onClick={() => openExternal('https://github.com/EkaEva/CamForge-Next')}
                  class="text-sm font-semibold text-on-surface font-display hover:text-primary hover:tracking-wider underline underline-offset-4 decoration-primary/0 hover:decoration-primary transition-all duration-300"
                >
                  CamForge-Next
                </button>
              </div>
              <p class="text-sm text-on-surface-variant font-display leading-relaxed">{t().help.aboutDesc}</p>
              <p class="text-xs text-on-surface-variant font-display">
                {t().help.techStack} Tauri + Solid.js + Rust
              </p>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
