import type { JSX } from 'solid-js';

interface ToggleProps {
  label: string;
  checked: () => boolean;
  onChange: (val: boolean) => void;
}

export function Toggle(props: ToggleProps): JSX.Element {
  return (
    <div class="group flex items-center justify-between py-1">
      <div class="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={props.checked()}
          onClick={() => props.onChange(!props.checked())}
          class="relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 ease-out flex-shrink-0 active:scale-95 group-hover:shadow-md"
          style={{
            'background-color': props.checked() ? 'var(--on-surface-variant)' : 'var(--surface-container-highest)',
          }}
        >
          <span
            class="inline-block h-3.5 w-3.5 rounded-full transition-all duration-300 ease-out shadow-sm group-hover:shadow-md group-hover:scale-110"
            style={{
              'background-color': 'var(--surface-container-lowest)',
              transform: props.checked() ? 'translateX(1.25rem) scale(0.85)' : 'translateX(0.125rem) scale(1)',
            }}
          />
        </button>
        <span class="text-xs transition-all duration-300 group-hover:translate-x-0.5" style={{ color: 'var(--on-surface-variant)' }}>{props.label}</span>
      </div>
    </div>
  );
}
