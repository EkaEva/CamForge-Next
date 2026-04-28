import { JSX, ParentComponent, createSignal, onCleanup, onMount } from 'solid-js';
import { Icon } from './ui/Icon';

interface ErrorBoundaryProps {
  fallback?: JSX.Element;
  onError?: (error: Error, errorInfo: { componentStack?: string }) => void;
}

export const ErrorBoundary: ParentComponent<ErrorBoundaryProps> = (props) => {
  const [hasError, setHasError] = createSignal(false);
  const [error, setError] = createSignal<Error | null>(null);

  const handleError = (event: ErrorEvent) => {
    setHasError(true);
    setError(event.error);
    if (props.onError) {
      props.onError(event.error, { componentStack: undefined });
    }
    event.preventDefault();
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    setHasError(true);
    setError(event.reason);
    if (props.onError) {
      props.onError(event.reason, { componentStack: undefined });
    }
    event.preventDefault();
  };

  onMount(() => {
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
  });

  onCleanup(() => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
  });

  const handleReload = () => {
    setHasError(false);
    setError(null);
    window.location.reload();
  };

  const handleDismiss = () => {
    setHasError(false);
    setError(null);
  };

  if (hasError()) {
    return (
      props.fallback || (
        <div class="flex items-center justify-center min-h-screen bg-surface-container-low p-4">
          <div class="max-w-md w-full bg-surface-container-lowest rounded-lg border border-outline-variant p-6">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-10 h-10 rounded-full bg-error/15 flex items-center justify-center">
                <Icon name="warning" size={24} class="text-error" fill />
              </div>
              <h2 class="text-lg font-semibold text-on-surface font-display">
                Error
              </h2>
            </div>

            <p class="text-sm text-on-surface-variant mb-4">
              An unexpected error occurred. Please try reloading.
            </p>

            {error() && (
              <div class="mb-4 p-3 bg-surface-container rounded text-xs font-mono text-on-surface-variant overflow-auto max-h-32">
                {error()?.message || 'Unknown error'}
              </div>
            )}

            <div class="flex gap-3">
              <button
                class="flex-1 px-4 py-2 bg-error hover:opacity-90 text-surface-container-lowest rounded-lg font-medium transition-colors font-display"
                onClick={handleReload}
              >
                Reload
              </button>
              <button
                class="px-4 py-2 bg-surface-container-high hover:opacity-90 text-on-surface rounded-lg font-medium transition-colors font-display"
                onClick={handleDismiss}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )
    );
  }

  return <>{props.children}</>;
};

export default ErrorBoundary;
