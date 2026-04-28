import { createSignal, onMount, onCleanup } from 'solid-js';

export function useWindowSize() {
  const [size, setSize] = createSignal({ width: window.innerWidth, height: window.innerHeight });

  onMount(() => {
    const handler = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handler);
    onCleanup(() => window.removeEventListener('resize', handler));
  });

  return size;
}
