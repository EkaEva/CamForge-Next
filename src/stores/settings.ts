import { createSignal } from 'solid-js';

type Theme = 'light' | 'dark' | 'system';

const [theme, setTheme] = createSignal<Theme>('system');
const [isDark, setIsDark] = createSignal(false);

// 导出设置
interface ExportSettings {
  defaultDpi: number;
  defaultFormat: 'png' | 'tiff' | 'svg';
  downloadDir: string;
}

const [exportSettings, setExportSettings] = createSignal<ExportSettings>({
  defaultDpi: 300,
  defaultFormat: 'tiff',
  downloadDir: '',
});

// 更新暗色模式状态
function updateDarkMode() {
  const currentTheme = theme();
  let dark = false;

  if (currentTheme === 'dark') {
    dark = true;
  } else if (currentTheme === 'light') {
    dark = false;
  } else {
    // system
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  setIsDark(dark);

  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// 初始化主题
export function initTheme() {
  // 从 localStorage 读取主题设置
  const savedTheme = localStorage.getItem('theme') as Theme | null;
  if (savedTheme) {
    setTheme(savedTheme);
  }
  updateDarkMode();

  // 从 localStorage 读取导出设置
  const savedExportSettings = localStorage.getItem('exportSettings');
  if (savedExportSettings) {
    try {
      const parsed = JSON.parse(savedExportSettings);
      setExportSettings({
        defaultDpi: parsed.defaultDpi || 300,
        defaultFormat: parsed.defaultFormat || 'tiff',
        downloadDir: parsed.downloadDir || '',
      });
    } catch {
      // 忽略解析错误
    }
  }

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateDarkMode);
}

// 切换主题
export function toggleTheme() {
  const currentTheme = theme();
  let newTheme: Theme;

  if (currentTheme === 'light') {
    newTheme = 'dark';
  } else if (currentTheme === 'dark') {
    newTheme = 'system';
  } else {
    newTheme = 'light';
  }

  setTheme(newTheme);
  localStorage.setItem('theme', newTheme);
  updateDarkMode();
}

// 设置主题
export function setThemeMode(mode: Theme) {
  setTheme(mode);
  localStorage.setItem('theme', mode);
  updateDarkMode();
}

// 更新导出设置
export function updateExportSettings(settings: Partial<ExportSettings>) {
  setExportSettings(prev => {
    const newSettings = { ...prev, ...settings };
    localStorage.setItem('exportSettings', JSON.stringify(newSettings));
    return newSettings;
  });
}

// 获取下载目录
export function getDownloadDir(): string {
  return exportSettings().downloadDir;
}

// 设置下载目录
export function setDownloadDir(dir: string) {
  updateExportSettings({ downloadDir: dir });
}

// 导出
export function useTheme() {
  return {
    theme: theme(),
    isDark: isDark(),
    toggleTheme,
    setThemeMode,
  };
}

export function useExportSettings() {
  return {
    settings: exportSettings(),
    updateSettings: updateExportSettings,
    getDownloadDir,
    setDownloadDir,
  };
}

export { theme, isDark, exportSettings };
