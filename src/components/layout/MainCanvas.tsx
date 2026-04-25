import { createSignal, Show, Switch, Match, For, createEffect, onCleanup } from 'solid-js';
import { simulationData, isLoading, lastRunTime, paramsChanged, validationErrors, params, generateDXF, generateCSV, generateSVG, generateHighResPNG, generateRealTIFF, generateGIF, generatePresetJSON, generateExcel, saveFile, getCurrentLang, getExportFilename, exportStatus, setExportStatus, paramsUpdated, setParamsUpdated } from '../../stores/simulation';
import { t } from '../../i18n';
import { CamAnimation } from '../animation';
import { MotionCurves, GeometryChart, CurvatureChart } from '../charts';
import { showToast } from '../ui/Toast';
import { isMobilePlatform } from '../../utils/platform';

type Tab = 'animation' | 'motion' | 'geometry' | 'curvature' | 'export' | 'help';

export function MainCanvas() {
  const [activeTab, setActiveTab] = createSignal<Tab>('animation');
  const [exporting, setExporting] = createSignal<string | null>(null);
  const [exportProgress, setExportProgress] = createSignal(0);

  // 自定义导出状态
  const [customExportFormat, setCustomExportFormat] = createSignal<'png' | 'tiff' | 'svg'>('tiff');
  const [customExportDPI, setCustomExportDPI] = createSignal(300);
  const [customExportCharts, setCustomExportCharts] = createSignal({
    motion: true,
    pressure: true,
    curvature: true,
    profile: true,
  });
  const [customExportAnimFormat, setCustomExportAnimFormat] = createSignal<'gif' | 'png'>('gif');
  const [customExportAnimDPI, setCustomExportAnimDPI] = createSignal(150);
  const [customExportAnimation, setCustomExportAnimation] = createSignal(false);
  const [customExportData, setCustomExportData] = createSignal({
    csv: false,
    excel: false,
    dxf: false,
    preset: false,
  });

  // 检查是否有选中项
  const hasCustomSelection = () => {
    const charts = customExportCharts();
    const data = customExportData();
    return charts.motion || charts.pressure || charts.curvature || charts.profile ||
           customExportAnimation() || data.csv || data.excel || data.dxf || data.preset;
  };

  // 自动清除导出状态
  createEffect(() => {
    const status = exportStatus();
    if (status.type === 'success' || status.type === 'error') {
      const timer = setTimeout(() => {
        setExportStatus({ type: 'idle', message: '' });
      }, 5000);
      onCleanup(() => clearTimeout(timer));
    }
  });

  // 自动清除参数更新提示
  createEffect(() => {
    if (paramsUpdated()) {
      const timer = setTimeout(() => {
        setParamsUpdated(false);
      }, 2000);
      onCleanup(() => clearTimeout(timer));
    }
  });

  const tabs: { id: Tab; labelKey: string }[] = [
    { id: 'animation', labelKey: 'camProfile' },
    { id: 'motion', labelKey: 'motionCurves' },
    { id: 'curvature', labelKey: 'curvatureRadius' },
    { id: 'geometry', labelKey: 'pressureAngle' },
    { id: 'export', labelKey: 'export' },
    { id: 'help', labelKey: 'help' },
  ];

  const getTabLabel = (labelKey: string): string => {
    const currentT = t();
    switch (labelKey) {
      case 'camProfile': return currentT.tabs.camProfile;
      case 'motionCurves': return currentT.tabs.motionCurves;
      case 'pressureAngle': return currentT.tabs.pressureAngle;
      case 'curvatureRadius': return currentT.tabs.curvatureRadius;
      case 'export': return currentT.export.title;
      case 'help': return currentT.help.title;
      default: return labelKey;
    }
  };

  const formatTime = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const lang = getCurrentLang();

  // SVG 线性图标
  const icons = {
    chart: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    curvature: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    angle: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    profile: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12a3 3 0 106 0 3 3 0 00-6 0z" />
      </svg>
    ),
    animation: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    csv: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    excel: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
      </svg>
    ),
    svg: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    dxf: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    preset: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" class="w-5 h-5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217-.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  };

  // 导出按钮组件
  const ExportButton = (props: { id: string; icon: JSX.Element; label: string }) => {
    const isExportingThis = () => exporting() === props.id;
    const isExportingOther = () => exporting() !== null && exporting() !== props.id;
    const isIdle = () => exporting() === null;

    return (
      <button
        type="button"
        onClick={() => handleExport(props.id)}
        disabled={exporting() !== null}
        classList={{
          'flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 group': true,
          'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer': isIdle(),
          'bg-blue-100 dark:bg-blue-900/30 scale-105 shadow-md cursor-wait': isExportingThis(),
          'bg-gray-100 dark:bg-gray-700 opacity-50 cursor-not-allowed': isExportingOther(),
        }}
      >
        <span
          class="mb-1 transition-all duration-200"
          classList={{
            'text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:scale-110': isIdle(),
            'text-blue-500 dark:text-blue-400 animate-bounce': isExportingThis(),
            'text-gray-500 dark:text-gray-400': isExportingOther(),
          }}
        >{props.icon}</span>
        <span
          class="text-xs text-center transition-colors duration-200"
          classList={{
            'text-gray-500 dark:text-gray-400 group-hover:text-blue-500 dark:group-hover:text-blue-400': isIdle(),
            'text-blue-500 dark:text-blue-400': isExportingThis(),
            'text-gray-500 dark:text-gray-400': isExportingOther(),
          }}
        >{props.label}</span>
      </button>
    );
  };

  const handleExport = async (id: string) => {
    const data = simulationData();
    if (!data) return;

    setExporting(id);
    setExportProgress(0);
    const lang = getCurrentLang();
    const filename = getExportFilename(id.replace('_tiff', '').replace('_gif', ''), lang);

    const startTime = Date.now();
    const minDuration = 300;

    // 让 UI 有时间更新，避免卡顿
    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
      setExportStatus({ type: 'exporting', message: `${t().export.exportingFile} ${filename}...` });

      let result: { success: boolean; path?: string; error?: string } = { success: false };

      switch (id) {
        case 'motion_tiff': {
          const blob = await generateRealTIFF('motion', lang);
          result = await saveFile(blob, `${filename}.tiff`, 'image/tiff');
          break;
        }
        case 'curvature_tiff': {
          const blob = await generateRealTIFF('curvature', lang);
          result = await saveFile(blob, `${filename}.tiff`, 'image/tiff');
          break;
        }
        case 'pressure_tiff': {
          const blob = await generateRealTIFF('pressure', lang);
          result = await saveFile(blob, `${filename}.tiff`, 'image/tiff');
          break;
        }
        case 'profile_tiff': {
          const blob = await generateRealTIFF('profile', lang);
          result = await saveFile(blob, `${filename}.tiff`, 'image/tiff');
          break;
        }
        case 'animation_gif': {
          const blob = await generateGIF(lang, (progress) => {
            setExportProgress(Math.round(progress * 100));
          });
          result = await saveFile(blob, `${filename}.gif`, 'image/gif');
          break;
        }
        case 'csv': {
          const content = generateCSV(lang);
          const bom = '﻿';
          result = await saveFile(bom + content, `${filename}.csv`, 'text/csv;charset=utf-8');
          break;
        }
        case 'excel': {
          const blob = generateExcel(lang);
          result = await saveFile(blob, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          break;
        }
        case 'svg': {
          const content = generateSVG();
          result = await saveFile(content, `${filename}.svg`, 'image/svg+xml');
          break;
        }
        case 'dxf': {
          const content = generateDXF(true);
          result = await saveFile(content, `${filename}.dxf`, 'application/dxf');
          break;
        }
        case 'preset': {
          const content = generatePresetJSON();
          result = await saveFile(content, `${filename}.json`, 'application/json');
          break;
        }
      }

      if (result.success) {
        const pathInfo = result.path ? ` → ${result.path}` : '';
        setExportStatus({ type: 'success', message: `${t().export.exported}: ${filename}${pathInfo}`, files: [filename] });
        // 移动端显示 Toast 通知
        if (isMobilePlatform()) {
          const currentLang = getCurrentLang();
          const toastMsg = currentLang === 'zh'
            ? `已保存到下载目录: ${filename}`
            : `Saved to Downloads: ${filename}`;
          showToast(toastMsg, 'success', 5000);
        }
      } else if (result.error !== 'Cancelled') {
        setExportStatus({ type: 'error', message: `${t().export.exportFailed}: ${result.error}` });
        // 移动端显示错误 Toast
        if (isMobilePlatform()) {
          showToast(`${t().export.exportFailed}`, 'error', 4000);
        }
      }
    } catch (e) {
      console.error('Export error:', e);
      setExportStatus({ type: 'error', message: `${t().export.exportFailed}: ${e}` });
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < minDuration) {
      await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
    }

    setExporting(null);
    setExportProgress(0);
  };

  const handleCustomExport = async () => {
    const data = simulationData();
    if (!data) return;

    // 移动端不支持自定义导出（Tauri 文件对话框不可用）
    if (isMobilePlatform()) {
      const currentLang = getCurrentLang();
      showToast(
        currentLang === 'zh' ? '自定义导出仅支持桌面端' : 'Custom export is only available on desktop',
        'info',
        4000
      );
      return;
    }

    setExporting('custom');
    setExportProgress(0);
    const currentLang = getCurrentLang();

    const startTime = Date.now();
    const minDuration = 300;
    const exportedFiles: string[] = [];
    let saveDir = ''; // 保存目录路径

    try {
      const charts = customExportCharts();
      const dataExports = customExportData();
      const format = customExportFormat();
      const dpi = customExportDPI();
      const animFormat = customExportAnimFormat();
      const animDpi = customExportAnimDPI();

      const isTauriEnv = !!(window as any).__TAURI__;
      if (isTauriEnv) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selectedDir = await open({
          directory: true,
          multiple: false,
          title: currentLang === 'zh' ? '选择保存目录' : 'Select Save Directory',
        });
        if (!selectedDir) {
          setExporting(null);
          return;
        }
        saveDir = selectedDir as string;
      }

      const chartTypes: ('motion' | 'pressure' | 'curvature' | 'profile')[] = [];
      if (charts.motion) chartTypes.push('motion');
      if (charts.pressure) chartTypes.push('pressure');
      if (charts.curvature) chartTypes.push('curvature');
      if (charts.profile) chartTypes.push('profile');

      const totalItems = chartTypes.length + (customExportAnimation() ? 1 : 0) +
                        (dataExports.csv ? 1 : 0) + (dataExports.excel ? 1 : 0) + (dataExports.dxf ? 1 : 0) + (dataExports.preset ? 1 : 0);
      let currentItem = 0;

      for (const type of chartTypes) {
        const filename = getExportFilename(type, currentLang);
        setExportStatus({ type: 'exporting', message: `${currentLang === 'zh' ? '正在导出' : 'Exporting'} ${filename}...` });

        if (format === 'svg') {
          const content = generateSVG();
          await saveFile(content, `${filename}.svg`, 'image/svg+xml', { saveDir });
        } else if (format === 'tiff') {
          const blob = await generateRealTIFF(type, currentLang, dpi);
          await saveFile(blob, `${filename}.tiff`, 'image/tiff', { saveDir });
        } else {
          const blob = await generateHighResPNG(type, currentLang, dpi);
          await saveFile(blob, `${filename}.png`, 'image/png', { saveDir });
        }

        exportedFiles.push(filename);
        currentItem++;
        setExportProgress(Math.round((currentItem / totalItems) * 100));
      }

      if (customExportAnimation()) {
        const filename = getExportFilename('animation', currentLang);
        setExportStatus({ type: 'exporting', message: `${currentLang === 'zh' ? '正在生成动画...' : 'Generating animation...'}` });

        if (animFormat === 'gif') {
          const blob = await generateGIF(currentLang, (progress) => {
            setExportProgress(Math.round(((currentItem + progress) / totalItems) * 100));
          }, animDpi);
          await saveFile(blob, `${filename}.gif`, 'image/gif', { saveDir });
        } else {
          const blob = await generateHighResPNG('profile', currentLang, animDpi);
          await saveFile(blob, `${filename}.png`, 'image/png', { saveDir });
        }

        exportedFiles.push(filename);
        currentItem++;
        setExportProgress(Math.round((currentItem / totalItems) * 100));
      }

      if (dataExports.csv) {
        const filename = getExportFilename('csv', currentLang);
        setExportStatus({ type: 'exporting', message: `${currentLang === 'zh' ? '正在导出' : 'Exporting'} ${filename}...` });
        const content = generateCSV(currentLang);
        const bom = '﻿';
        await saveFile(bom + content, `${filename}.csv`, 'text/csv;charset=utf-8', { saveDir });
        exportedFiles.push(filename);
        currentItem++;
      }

      if (dataExports.excel) {
        const filename = getExportFilename('excel', currentLang);
        setExportStatus({ type: 'exporting', message: `${currentLang === 'zh' ? '正在导出' : 'Exporting'} ${filename}...` });
        const blob = generateExcel(currentLang);
        await saveFile(blob, `${filename}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', { saveDir });
        exportedFiles.push(filename);
        currentItem++;
      }

      if (dataExports.dxf) {
        const filename = getExportFilename('dxf', currentLang);
        setExportStatus({ type: 'exporting', message: `${currentLang === 'zh' ? '正在导出' : 'Exporting'} ${filename}...` });
        const content = generateDXF(true);
        await saveFile(content, `${filename}.dxf`, 'application/dxf', { saveDir });
        exportedFiles.push(filename);
        currentItem++;
      }

      if (dataExports.preset) {
        const filename = getExportFilename('preset', currentLang);
        setExportStatus({ type: 'exporting', message: `${currentLang === 'zh' ? '正在导出' : 'Exporting'} ${filename}...` });
        const content = generatePresetJSON();
        await saveFile(content, `${filename}.json`, 'application/json', { saveDir });
        exportedFiles.push(filename);
        currentItem++;
      }

      setExportProgress(100);
      const pathInfo = saveDir ? ` → ${saveDir}` : '';
      setExportStatus({
        type: 'success',
        message: currentLang === 'zh' ? `已导出 ${exportedFiles.length} 个文件${pathInfo}` : `Exported ${exportedFiles.length} files${pathInfo}`,
        files: exportedFiles
      });
      // 移动端显示 Toast 通知
      if (isMobilePlatform()) {
        const toastMsg = currentLang === 'zh'
          ? `已保存 ${exportedFiles.length} 个文件到下载目录`
          : `Saved ${exportedFiles.length} files to Downloads`;
        showToast(toastMsg, 'success', 5000);
      }
    } catch (e) {
      console.error('Custom export error:', e);
      setExportStatus({ type: 'error', message: currentLang === 'zh' ? `导出失败: ${e}` : `Export failed: ${e}` });
      // 移动端显示错误 Toast
      if (isMobilePlatform()) {
        showToast(currentLang === 'zh' ? `导出失败` : `Export failed`, 'error', 4000);
      }
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < minDuration) {
      await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
    }

    setExporting(null);
    setExportProgress(0);
  };

  // 检查压力角是否超限
  const isPressureAngleExceeded = () => {
    const data = simulationData();
    const p = params();
    if (!data) return false;
    return data.max_alpha > p.alpha_threshold;
  };

  return (
    <main class="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Tab Bar - 移动端垂直布局，桌面端水平布局 */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {/* Tab 栏 - 移动端独占一行，支持横向滚动 */}
        <div class="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
          {tabs.map((tab) => (
            <button
              type="button"
              onClick={() => setActiveTab(tab.id)}
              classList={{
                'px-3 py-2 text-sm rounded-md transition-colors min-h-[44px] min-w-[44px] whitespace-nowrap flex-shrink-0': true,
                'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400': activeTab() === tab.id,
                'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600': activeTab() !== tab.id,
              }}
            >
              {getTabLabel(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* 状态信息 - 桌面端显示 */}
        <div class="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 min-w-0">
          {/* 校验错误 */}
          <Show when={validationErrors().length > 0}>
            <span class="flex items-center gap-1.5 text-red-500 truncate max-w-[200px]" title={validationErrors()[0]}>
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span class="truncate">{validationErrors()[0]}</span>
            </span>
          </Show>
          {/* 参数已更新 */}
          <Show when={paramsUpdated() && validationErrors().length === 0}>
            <span class="flex items-center gap-1.5 text-green-500 flex-shrink-0">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t().status.paramsUpdated}
            </span>
          </Show>
          {/* 压力角超限警告 */}
          <Show when={isPressureAngleExceeded()}>
            <span class="flex items-center gap-1.5 text-amber-500 flex-shrink-0">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {t().status.pressureAngleExceeded}
            </span>
          </Show>
          <Show when={exportStatus().type !== 'idle'}>
            <span
              class="truncate max-w-[250px]"
              title={exportStatus().message}
              classList={{
                'text-green-500': exportStatus().type === 'success',
                'text-red-500': exportStatus().type === 'error',
                'text-blue-500': exportStatus().type === 'exporting',
              }}
            >
              {exportStatus().message}
            </span>
          </Show>
          <Show when={lastRunTime() && validationErrors().length === 0}>
            <span class="flex-shrink-0">{formatTime(lastRunTime())}</span>
          </Show>
        </div>
      </div>

      {/* 移动端状态提示 */}
      <div class="sm:hidden px-4 py-1.5 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-xs">
        <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* 校验错误 */}
          <Show when={validationErrors().length > 0}>
            <span class="flex items-center gap-1 text-red-500 whitespace-nowrap">
              <svg class="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span class="truncate max-w-[150px]">{validationErrors()[0]}</span>
            </span>
          </Show>
          {/* 参数已更新 */}
          <Show when={paramsUpdated() && validationErrors().length === 0}>
            <span class="flex items-center gap-1 text-green-500 whitespace-nowrap">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t().status.paramsUpdated}
            </span>
          </Show>
          {/* 压力角超限警告 */}
          <Show when={isPressureAngleExceeded()}>
            <span class="flex items-center gap-1 text-amber-500 whitespace-nowrap">
              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {t().status.pressureAngleExceeded}
            </span>
          </Show>
          {/* 导出状态 */}
          <Show when={exportStatus().type !== 'idle'}>
            <span
              class="truncate max-w-[150px] whitespace-nowrap"
              classList={{
                'text-green-500': exportStatus().type === 'success',
                'text-red-500': exportStatus().type === 'error',
                'text-blue-500': exportStatus().type === 'exporting',
              }}
            >
              {exportStatus().message}
            </span>
          </Show>
          {/* 运行时间 */}
          <Show when={lastRunTime() && validationErrors().length === 0}>
            <span class="text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatTime(lastRunTime())}</span>
          </Show>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-hidden">
        {/* 帮助页面始终显示 */}
        <Show when={activeTab() === 'help'}>
          <div class="w-full h-full overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
            <div class="max-w-3xl mx-auto space-y-6">
              {/* 快捷键 */}
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t().help.keyboardShortcuts}
                </h2>
                <div class="space-y-3">
                  <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span class="text-sm text-gray-600 dark:text-gray-300">{t().help.playPause}</span>
                    <kbd class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">Space</kbd>
                  </div>
                  <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span class="text-sm text-gray-600 dark:text-gray-300">{t().help.stepBackward}</span>
                    <kbd class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">←</kbd>
                  </div>
                  <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span class="text-sm text-gray-600 dark:text-gray-300">{t().help.stepForward}</span>
                    <kbd class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">→</kbd>
                  </div>
                  <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span class="text-sm text-gray-600 dark:text-gray-300">{t().help.undo}</span>
                    <kbd class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">Ctrl+Z</kbd>
                  </div>
                  <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span class="text-sm text-gray-600 dark:text-gray-300">{t().help.redo}</span>
                    <kbd class="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">Ctrl+Y</kbd>
                  </div>
                </div>
                <p class="mt-4 text-xs text-gray-500 dark:text-gray-400">
                  {t().help.shortcutsNote}
                </p>
              </div>

              {/* 关于 */}
              <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t().help.about}
                </h2>
                <div class="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                  <p>
                    <a
                      href="https://github.com/EkaEva/CamForge-Next"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="font-semibold text-gray-900 dark:text-white hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                    >
                      CamForge-Next
                    </a>
                  </p>
                  <p class="text-gray-500 dark:text-gray-400">
                    {t().help.aboutDesc}
                  </p>
                  <div class="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
                    <p class="text-gray-500 dark:text-gray-400">
                      {t().help.techStack}
                      <span class="text-gray-400">Tauri 2.0 · Rust · Solid.js · TypeScript · Tailwind CSS</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Show>

        {/* 其他页面需要模拟数据 */}
        <Show
          when={simulationData()}
          fallback={
            <Show when={activeTab() !== 'help'}>
              <div class="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <Show when={isLoading()} fallback={
                  <div class="text-center">
                    <svg class="w-24 h-24 mx-auto text-gray-300 dark:text-gray-600" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="1"/>
                      <path d="M50 10 A40 40 0 0 1 90 50" fill="none" stroke="currentColor" stroke-width="2" class="text-blue-500"/>
                    </svg>
                    <p class="mt-4 text-sm text-gray-500 dark:text-gray-400">
                      {t().mainCanvas.clickToStart}
                    </p>
                  </div>
                }>
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p class="text-sm text-gray-500 dark:text-gray-400">{t().status.running}</p>
                  </div>
                </Show>
              </div>
            </Show>
          }
        >
          <Switch>
            <Match when={activeTab() === 'animation'}>
              <CamAnimation isActive={true} />
            </Match>
            <Match when={activeTab() === 'motion'}>
              <MotionCurves />
            </Match>
            <Match when={activeTab() === 'curvature'}>
              <CurvatureChart />
            </Match>
            <Match when={activeTab() === 'geometry'}>
              <GeometryChart />
            </Match>
            <Match when={activeTab() === 'export'}>
              <div class="w-full h-full overflow-auto bg-gray-50 dark:bg-gray-900 p-6">
                <div class="max-w-4xl mx-auto space-y-6">
                  {/* 快速导出 */}
                  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {t().export.quickExport}
                    </h2>
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
                      <ExportButton id="motion_tiff" icon={icons.chart} label={t().export.items.motion} />
                      <ExportButton id="curvature_tiff" icon={icons.curvature} label={t().export.items.curvature} />
                      <ExportButton id="pressure_tiff" icon={icons.angle} label={t().export.items.pressure} />
                      <ExportButton id="profile_tiff" icon={icons.profile} label={t().export.items.profile} />
                      <ExportButton id="animation_gif" icon={icons.animation} label={t().export.items.animation} />
                      <ExportButton id="csv" icon={icons.csv} label="CSV" />
                      <ExportButton id="excel" icon={icons.excel} label="Excel" />
                      <ExportButton id="svg" icon={icons.svg} label="SVG" />
                      <ExportButton id="dxf" icon={icons.dxf} label="DXF" />
                      <ExportButton id="preset" icon={icons.preset} label={t().export.items.preset} />
                    </div>
                    <Show when={exporting() === 'animation_gif' && exportProgress() > 0}>
                      <div class="mt-4">
                        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>{t().export.generatingAnimation}</span>
                          <span>{exportProgress()}%</span>
                        </div>
                        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${exportProgress()}%` }}
                          />
                        </div>
                      </div>
                    </Show>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
                      {t().export.downloadTip}
                    </p>
                  </div>

                  {/* 自定义导出 */}
                  <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      {t().export.customExport}
                    </h2>

                    {/* 图表导出 */}
                    <div class="mb-6">
                      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {t().export.chartExport}
                      </h3>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
                            {t().export.imageFormat}
                          </label>
                          <select
                            value={customExportFormat()}
                            onChange={(e) => setCustomExportFormat(e.currentTarget.value as 'png' | 'tiff' | 'svg')}
                            class="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                          >
                            <option value="png">PNG</option>
                            <option value="tiff">TIFF</option>
                            <option value="svg">SVG</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
                            DPI
                          </label>
                          <select
                            value={customExportDPI()}
                            onChange={(e) => setCustomExportDPI(parseInt(e.currentTarget.value))}
                            class="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                          >
                            <option value="150">150 DPI</option>
                            <option value="300">300 DPI</option>
                            <option value="600">600 DPI</option>
                          </select>
                        </div>
                      </div>
                      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportCharts().motion} onChange={(e) => setCustomExportCharts({ ...customExportCharts(), motion: e.currentTarget.checked })} class="accent-blue-500 w-5 h-5" />
                          {t().export.charts.motion}
                        </label>
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportCharts().pressure} onChange={(e) => setCustomExportCharts({ ...customExportCharts(), pressure: e.currentTarget.checked })} class="accent-blue-500 w-5 h-5" />
                          {t().export.charts.pressure}
                        </label>
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportCharts().curvature} onChange={(e) => setCustomExportCharts({ ...customExportCharts(), curvature: e.currentTarget.checked })} class="accent-blue-500 w-5 h-5" />
                          {t().export.charts.curvature}
                        </label>
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportCharts().profile} onChange={(e) => setCustomExportCharts({ ...customExportCharts(), profile: e.currentTarget.checked })} class="accent-blue-500 w-5 h-5" />
                          {t().export.charts.profile}
                        </label>
                      </div>
                    </div>

                    {/* 动画导出 */}
                    <div class="mb-6">
                      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {t().export.animationExport}
                      </h3>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
                            {t().export.animationFormat}
                          </label>
                          <select
                            value={customExportAnimFormat()}
                            onChange={(e) => setCustomExportAnimFormat(e.currentTarget.value as 'gif' | 'png')}
                            class="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                          >
                            <option value="gif">GIF</option>
                            <option value="png">PNG 序列</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
                            DPI
                          </label>
                          <select
                            value={customExportAnimDPI()}
                            onChange={(e) => setCustomExportAnimDPI(parseInt(e.currentTarget.value))}
                            class="w-full px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                          >
                            <option value="100">100 DPI</option>
                            <option value="150">150 DPI</option>
                            <option value="200">200 DPI</option>
                          </select>
                        </div>
                      </div>
                      <div class="mt-4">
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportAnimation()} onChange={(e) => setCustomExportAnimation(e.currentTarget.checked)} class="accent-blue-500 w-5 h-5" />
                          {t().export.exportAnimation}
                        </label>
                      </div>
                    </div>

                    {/* 数据导出 */}
                    <div class="mb-6">
                      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        {t().export.dataExport}
                      </h3>
                      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportData().csv} onChange={(e) => setCustomExportData({ ...customExportData(), csv: e.currentTarget.checked })} class="accent-blue-500 w-5 h-5" />
                          CSV
                        </label>
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportData().excel} onChange={(e) => setCustomExportData({ ...customExportData(), excel: e.currentTarget.checked })} class="accent-blue-500 w-5 h-5" />
                          Excel
                        </label>
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportData().dxf} onChange={(e) => setCustomExportData({ ...customExportData(), dxf: e.currentTarget.checked })} class="accent-blue-500 w-5 h-5" />
                          DXF
                        </label>
                        <label class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
                          <input type="checkbox" checked={customExportData().preset} onChange={(e) => setCustomExportData({ ...customExportData(), preset: e.currentTarget.checked })} class="accent-blue-500 w-5 h-5" />
                          {lang === 'zh' ? '配置 (JSON)' : 'Config (JSON)'}
                        </label>
                      </div>
                    </div>

                    {/* 导出按钮 */}
                    <div class="flex justify-center">
                      <button
                        type="button"
                        onClick={handleCustomExport}
                        disabled={exporting() !== null || !hasCustomSelection()}
                        class="px-6 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:dark:bg-gray-600 text-white rounded-lg transition-colors"
                      >
                        {t().export.exportSelected}
                      </button>
                    </div>

                    <Show when={exporting() === 'custom' && exportProgress() > 0}>
                      <div class="mt-4">
                        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                          <span>{t().export.exporting}</span>
                          <span>{exportProgress()}%</span>
                        </div>
                        <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${exportProgress()}%` }}
                          />
                        </div>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>
            </Match>
          </Switch>
        </Show>
      </div>
    </main>
  );
}