/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // MD3 Surface tokens
        'surface-container-lowest': 'var(--surface-container-lowest)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container': 'var(--surface-container)',
        'surface-container-high': 'var(--surface-container-high)',
        'surface-container-highest': 'var(--surface-container-highest)',
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        'outline': 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',
        'primary': 'var(--primary)',
        'surface-bright': 'var(--surface-bright)',
        'error': 'var(--error)',
        // Chrome tokens
        'chrome-bg': 'var(--chrome-bg)',
        'chrome-surface': 'var(--chrome-surface)',
        'chrome-surface-hover': 'var(--chrome-surface-hover)',
        'chrome-active': 'var(--chrome-active)',
        'chrome-text': 'var(--chrome-text)',
        'chrome-text-active': 'var(--chrome-text-active)',
        'chrome-border': 'var(--chrome-border)',
        'chrome-run-bg': 'var(--chrome-run-bg)',
        'chrome-run-text': 'var(--chrome-run-text)',
        // Semantic
        'success': 'var(--success)',
        'warning': 'var(--warning)',
      },
      fontFamily: {
        'display': ['"Space Grotesk"', 'monospace'],
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
