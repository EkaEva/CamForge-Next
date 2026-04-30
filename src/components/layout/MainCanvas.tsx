import { createSignal, Show, Switch, Match, createEffect, onCleanup, JSX, createMemo } from 'solid-js';
import { simulationData, isLoading, lastRunTime, validationErrors, params, generateDXF, generateCSV, generateSVG, generateHighResPNG, generateRealTIFF, generateGIF, generatePresetJSON, generateExcel, saveFile, getCurrentLang, getExportFilename, exportStatus, setExportStatus, paramsUpdated, setParamsUpdated, curveVisible, setCurveVisible, cursorFrame } from '../../stores/simulation';
import { t } from '../../i18n';
import { CamAnimation } from '../animation';
import { MotionCurves, GeometryChart, CurvatureChart } from '../charts';
import { showToast } from '../ui/Toast';
import { isTauriEnv } from '../../utils/tauri';

async function revealFileInManager(filePath: string) {
  if (!isTauriEnv()) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('reveal_item_in_dir', { path: filePath });
  } catch (e) {
    console.error('Failed to reveal file:', e);
  }
}
import { isMobilePlatform, isTauriEnv as checkIsTauriEnv } from '../../utils/platform';
import { getDownloadDir } from '../../stores/settings';
import { Icon } from '../ui/Icon';
type Tab = 'simulation' | 'export';
type AnalysisView = 'kinematics' | 'curvature' | 'pressure';

interface MainCanvasProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function MainCanvas(props: MainCanvasProps) {
  const [exporting, setExporting] = createSignal<string | null>(null);
  const [exportProgress, setExportProgress] = createSignal(0);
  const [analysisView, setAnalysisView] = createSignal<AnalysisView>('kinematics');
  const [zoomPercent, setZoomPercent] = createSignal(100);
  const animFrameData = createMemo(() => {
    const data = simulationData();
    const frameIdx = cursorFrame();
    if (!data || frameIdx < 0 || frameIdx >= data.s.length) return { sI: 0, alphaI: 0 };
    return { sI: data.s[frameIdx], alphaI: data.alpha_all[frameIdx] };
  });

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
  const [customExportAnimFrames, setCustomExportAnimFrames] = createSignal(120);
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
    { id: 'simulation', labelKey: 'simulation' },
    { id: 'export', labelKey: 'export' },
  ];

  const getTabLabel = (labelKey: string): string => {
    const currentT = t();
    switch (labelKey) {
      case 'simulation': return currentT.tabs.simulation;
      case 'export': return currentT.export.title;
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
    chart: <Icon name="bar_chart" size={20} />,
    curvature: <Icon name="radio_button_unchecked" size={20} />,
    angle: <Icon name="wb_sunny" size={20} />,
    profile: <Icon name="circle" size={20} />,
    animation: <Icon name="smart_display" size={20} />,
    csv: <Icon name="description" size={20} />,
    excel: <Icon name="table_chart" size={20} />,
    svg: <Icon name="draw" size={20} />,
    dxf: <Icon name="code" size={20} />,
    preset: <Icon name="settings" size={20} />,
  };

  // 导出按钮组件
  const ExportButton = (eprops: { id: string; icon: JSX.Element; label: string }) => {
    const isExportingThis = () => exporting() === eprops.id;
    const isExportingOther = () => exporting() !== null && exporting() !== eprops.id;
    const isIdle = () => exporting() === null;

    return (
      <button
        type="button"
        onClick={() => handleExport(eprops.id)}
        disabled={exporting() !== null}
        classList={{
          'flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 group': true,
          'bg-surface-container hover:bg-surface-container-high hover:scale-105 hover:shadow-md active:scale-95 cursor-pointer': isIdle(),
          'bg-surface-container-high scale-105 shadow-md cursor-wait': isExportingThis(),
          'bg-surface-container opacity-50 cursor-not-allowed': isExportingOther(),
        }}
      >
        <span
          class="mb-1 transition-all duration-200"
          classList={{
            'text-on-surface-variant group-hover:text-on-surface group-hover:scale-110': isIdle(),
            'text-on-surface animate-bounce': isExportingThis(),
            'text-on-surface-variant': isExportingOther(),
          }}
        >{eprops.icon}</span>
        <span
          class="text-xs text-center transition-colors duration-200"
          classList={{
            'text-on-surface-variant group-hover:text-on-surface': isIdle(),
            'text-on-surface': isExportingThis(),
            'text-on-surface-variant': isExportingOther(),
          }}
        >{eprops.label}</span>
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
          }, 100);
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
        const path = result.path || filename;
        const shortName = path.split(/[/\\]/).pop() || filename;
        const pathInfo = result.path ? ` → ${result.path}` : '';
        setExportStatus({ type: 'success', message: `${t().export.exported}: ${filename}${pathInfo}`, files: [filename] });
        if (isMobilePlatform()) {
          const currentLang = getCurrentLang();
          const toastMsg = currentLang === 'zh'
            ? `已导出: ${path}`
            : `Exported: ${path}`;
          showToast(
            toastMsg,
            'success',
            6000,
            isTauriEnv() && result.path ? {
              label: currentLang === 'zh' ? '打开位置' : 'Open',
              onClick: () => revealFileInManager(result.path!),
            } : undefined,
          );
        }
      } else if (result.error !== 'Cancelled') {
        setExportStatus({ type: 'error', message: `${t().export.exportFailed}: ${result.error}` });
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

    setExporting('custom');
    setExportProgress(0);
    const currentLang = getCurrentLang();

    const startTime = Date.now();
    const minDuration = 300;
    const exportedFiles: string[] = [];
    const failedFiles: string[] = [];
    let saveDir = getDownloadDir() || '';

    try {
      const charts = customExportCharts();
      const dataExports = customExportData();
      const format = customExportFormat();
      const dpi = customExportDPI();
      const animFormat = customExportAnimFormat();
      const animDpi = customExportAnimDPI();

      const isTauriEnv = checkIsTauriEnv();
      if (isTauriEnv && !isMobilePlatform() && !saveDir) {
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
          }, animDpi, customExportAnimFrames());
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
      if (isMobilePlatform()) {
        const toastMsg = currentLang === 'zh'
          ? `已保存 ${exportedFiles.length} 个文件${saveDir ? ' → ' + saveDir : ''}`
          : `Saved ${exportedFiles.length} files${saveDir ? ' → ' + saveDir : ''}`;
        showToast(
          toastMsg,
          'success',
          6000,
          isTauriEnv() && saveDir ? {
            label: currentLang === 'zh' ? '打开位置' : 'Open',
            onClick: () => revealFileInManager(saveDir),
          } : undefined,
        );
      }
    } catch (e) {
      console.error('Custom export error:', e);
      setExportStatus({ type: 'error', message: currentLang === 'zh' ? `导出失败: ${e}` : `Export failed: ${e}` });
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

  // 状态文字
  const getStatus = () => {
    const currentT = t();
    if (isLoading()) return currentT.status.running;
    if (validationErrors().length > 0) return validationErrors()[0];
    return currentT.status.ready;
  };

  // 状态颜色：红色=参数错误，绿色=正常/计算中，黄色=压力角超限
  const getStatusColor = () => {
    if (validationErrors().length > 0) return 'text-error';
    if (isPressureAngleExceeded()) return 'text-warning';
    return 'text-success';
  };

  // 图例线段 SVG — 与 canvas 图表颜色和线型一致
  const LegendLine = (lp: { color: string; dash?: string }) => (
    <svg width="16" height="4" viewBox="0 0 16 4" class="inline-block flex-shrink-0">
      <line x1="0" y1="2" x2="16" y2="2" stroke={lp.color} stroke-width="2" stroke-dasharray={lp.dash ?? 'none'} />
    </svg>
  );

  // 图例渲染 — 颜色与 canvas 图表一致
  const renderKinematicsLegend = () => {
    const vis = curveVisible();
    return (
      <div class="flex items-center gap-4 font-display text-[11px] text-on-surface-variant">
        <button
          type="button"
          onClick={() => setCurveVisible(p => ({ ...p, s: !p.s }))}
          classList={{
            'flex items-center gap-1.5 cursor-pointer transition-opacity': true,
            'opacity-40 line-through': !vis.s,
            'opacity-100': vis.s,
          }}
        >
          <LegendLine color="#E07A5F" />
          {t().chart.displacement}
        </button>
        <button
          type="button"
          onClick={() => setCurveVisible(p => ({ ...p, v: !p.v }))}
          classList={{
            'flex items-center gap-1.5 cursor-pointer transition-opacity': true,
            'opacity-40 line-through': !vis.v,
            'opacity-100': vis.v,
          }}
        >
          <LegendLine color="#3D5A80" dash="6,4" />
          {t().chart.velocity}
        </button>
        <button
          type="button"
          onClick={() => setCurveVisible(p => ({ ...p, a: !p.a }))}
          classList={{
            'flex items-center gap-1.5 cursor-pointer transition-opacity': true,
            'opacity-40 line-through': !vis.a,
            'opacity-100': vis.a,
          }}
        >
          <LegendLine color="#5B8C5A" dash="2,3" />
          {t().chart.acceleration}
        </button>
      </div>
    );
  };

  const renderCurvatureLegend = () => {
    const p = params();
    const hasRoller = p.r_r > 0;
    return (
      <div class="flex items-center gap-4 font-display text-[11px] text-on-surface-variant">
        <span class="flex items-center gap-1.5">
          <LegendLine color="#E07A5F" />
          {t().chart.theoryRho}
        </span>
        <Show when={hasRoller}>
          <span class="flex items-center gap-1.5">
            <LegendLine color="#3D5A80" dash="4,2" />
            {t().chart.actualRho}
          </span>
          <span class="flex items-center gap-1.5">
            <LegendLine color="#6D9DC5" dash="4,4" />
            {t().chart.threshold}
          </span>
        </Show>
      </div>
    );
  };

  const renderPressureLegend = () => (
    <div class="flex items-center gap-4 font-display text-[11px] text-on-surface-variant">
      <span class="flex items-center gap-1.5">
        <LegendLine color="#E07A5F" />
        {t().chart.pressureAngle}
      </span>
      <span class="flex items-center gap-1.5">
        <LegendLine color="#C4A35A" dash="4,4" />
        {t().chart.threshold}
      </span>
    </div>
  );

  return (
    <main class="flex-1 flex flex-col bg-surface-container-low overflow-hidden">
      {/* Tab Bar */}
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-2 border-b border-outline-variant bg-surface-container-lowest">
        {/* Tab 栏 */}
        <div role="tablist" class="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
          {tabs.map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={props.activeTab === tab.id}
              onClick={() => props.onTabChange(tab.id)}
              classList={{
                'tab-btn px-4 py-1.5 text-sm rounded-md transition-all duration-200 min-h-[36px] min-w-[44px] whitespace-nowrap flex-shrink-0 font-medium': true,
                'tab-btn-active': props.activeTab === tab.id,
                'tab-btn-inactive': props.activeTab !== tab.id,
              }}
            >
              {getTabLabel(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* 状态信息 - 桌面端 */}
        <div class="hidden sm:flex items-center gap-3 text-xs font-display min-w-0 flex-1 justify-end">
          <Show when={isLoading()}>
            <div classList={{ 'w-3 h-3 border-2 border-t-transparent rounded-full animate-spin': true, [getStatusColor()]: true }} style={{ 'border-color': 'currentColor', 'border-top-color': 'transparent' }} />
          </Show>
          <span class={`${getStatusColor()}`}>{getStatus()}</span>
          <Show when={validationErrors().length > 0}>
            <span class="flex items-center gap-1.5 text-error truncate max-w-[200px]" title={validationErrors()[0]}>
              <Icon name="warning" size={14} class="text-error flex-shrink-0" />
              <span class="truncate">{validationErrors()[0]}</span>
            </span>
          </Show>
          <Show when={isPressureAngleExceeded()}>
            <span class="flex items-center gap-1.5 text-warning flex-shrink-0">
              <Icon name="warning" size={14} class="text-warning" />
              {t().status.pressureAngleExceeded}
            </span>
          </Show>
          <Show when={exportStatus().type !== 'idle'}>
            <span
              class="truncate max-w-[500px]"
              title={exportStatus().message}
              classList={{
                'text-success': exportStatus().type === 'success',
                'text-error': exportStatus().type === 'error',
                'text-on-surface-variant': exportStatus().type === 'exporting',
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
      <div class="sm:hidden px-4 py-1.5 bg-surface-container-low border-b border-outline-variant text-xs" style={{ 'padding-bottom': 'calc(0.375rem + env(safe-area-inset-bottom))' }}>
        <div class="flex items-start gap-2 overflow-x-auto scrollbar-hide">
          <Show when={isLoading()}>
            <div classList={{ 'w-3 h-3 border-2 border-t-transparent rounded-full animate-spin': true, [getStatusColor()]: true }} style={{ 'border-color': 'currentColor', 'border-top-color': 'transparent' }} />
          </Show>
          <span class={`${getStatusColor()} whitespace-nowrap truncate max-w-[150px]`}>{getStatus()}</span>
          <Show when={validationErrors().length > 0}>
            <span class="flex items-center gap-1 text-error whitespace-nowrap">
              <Icon name="warning" size={12} class="text-error" />
              <span class="truncate max-w-[150px]">{validationErrors()[0]}</span>
            </span>
          </Show>
          <Show when={isPressureAngleExceeded()}>
            <span class="flex items-center gap-1 text-warning whitespace-nowrap">
              <Icon name="warning" size={12} class="text-warning" />
              {t().status.pressureAngleExceeded}
            </span>
          </Show>
          <Show when={exportStatus().type !== 'idle'}>
            <span
              class="max-w-full break-all"
              classList={{
                'text-success': exportStatus().type === 'success',
                'text-error': exportStatus().type === 'error',
                'text-on-surface-variant': exportStatus().type === 'exporting',
              }}
            >
              {exportStatus().message}
            </span>
          </Show>
          <Show when={lastRunTime() && validationErrors().length === 0}>
            <span class="text-on-surface-variant whitespace-nowrap">{formatTime(lastRunTime())}</span>
          </Show>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-hidden">
        {/* 仿真页面 - 双卡片布局 */}
        <Show when={props.activeTab === 'simulation'}>
          <Show
            when={simulationData()}
            fallback={
              <div class="w-full h-full flex items-center justify-center bg-surface-container-low">
                <Show when={isLoading()} fallback={
                  <div class="text-center">
                    <svg class="w-24 h-24 mx-auto text-outline-variant" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="1"/>
                      <path d="M50 10 A40 40 0 0 1 90 50" fill="none" stroke="currentColor" stroke-width="2" class="text-on-surface-variant"/>
                    </svg>
                    <p class="mt-4 text-sm text-on-surface-variant">
                      {t().mainCanvas.clickToStart}
                    </p>
                  </div>
                }>
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
                    <p class="text-sm text-on-surface-variant">{t().status.running}</p>
                  </div>
                </Show>
              </div>
            }
          >
            <div class="w-full h-full overflow-auto bg-surface-container-low p-2 camforge-scrollbar">
              {/* 上方卡片：机构模型 */}
              <section class="flex flex-col border border-outline-variant bg-surface-container-low rounded overflow-hidden h-[320px] sm:h-[480px] relative">
                <div class="h-10 border-b border-outline-variant flex items-center justify-between px-4 bg-surface flex-shrink-0 overflow-hidden">
                  <span class="font-display text-xs uppercase tracking-wider text-on-surface-variant truncate min-w-0">
                    {t().tabs.mechanismModel}
                  </span>
                  <div class="flex items-center gap-1 sm:gap-2 font-display text-xs text-on-surface-variant min-w-0 flex-shrink-0 pl-1 sm:pl-0">
                    <Show when={simulationData()}>
                      <span class="whitespace-nowrap">{t().info.displacement}: <span class="tabular-nums inline-block w-[3rem] sm:w-[3.5rem] text-right">{animFrameData().sI.toFixed(3)}</span>mm</span>
                      <span class="whitespace-nowrap">{t().info.pressureAngle}: <span class="tabular-nums inline-block w-[2.5rem] sm:w-[2.5rem] text-right">{animFrameData().alphaI.toFixed(2)}</span>°</span>
                    </Show>
                    <span class="whitespace-nowrap">{t().info.zoom}: <span class="tabular-nums inline-block w-[1.5rem] text-right">{zoomPercent()}</span>%</span>
                  </div>
                </div>
                <div class="flex-1 relative overflow-hidden">
                  <CamAnimation
                    isActive={true}
                    onZoomChange={(z: number) => setZoomPercent(Math.round(z * 100))}
                  />
                </div>
              </section>

              {/* 下方卡片：分析 */}
              <section class="flex flex-col border border-outline-variant bg-surface-container-low rounded overflow-hidden min-h-[280px] sm:min-h-[480px] mt-2 relative">
                <div class="h-10 border-b border-outline-variant flex items-center justify-between px-4 bg-surface flex-shrink-0">
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const views: AnalysisView[] = ['kinematics', 'curvature', 'pressure'];
                        const idx = views.indexOf(analysisView());
                        setAnalysisView(views[(idx + 1) % views.length]);
                      }}
                      class="analysis-cycle-btn flex items-center gap-1.5"
                    >
                      <span class="cycle-label" key={analysisView()}>
                        {analysisView() === 'kinematics' ? t().chart.kinematicsLabel :
                         analysisView() === 'curvature' ? t().tabs.curvatureRadius :
                         t().tabs.pressureAngle}
                      </span>
                    </button>
                  </div>
                  {/* 横向图例 */}
                  <Switch>
                    <Match when={analysisView() === 'kinematics'}>{renderKinematicsLegend()}</Match>
                    <Match when={analysisView() === 'curvature'}>{renderCurvatureLegend()}</Match>
                    <Match when={analysisView() === 'pressure'}>{renderPressureLegend()}</Match>
                  </Switch>
                </div>
                <div class="flex-1 relative overflow-hidden">
                  <Switch>
                    <Match when={analysisView() === 'kinematics'}>
                      <div role="tabpanel" class="w-full h-full"><MotionCurves hideLegend /></div>
                    </Match>
                    <Match when={analysisView() === 'curvature'}>
                      <div role="tabpanel" class="w-full h-full"><CurvatureChart hideLegend /></div>
                    </Match>
                    <Match when={analysisView() === 'pressure'}>
                      <div role="tabpanel" class="w-full h-full"><GeometryChart hideLegend /></div>
                    </Match>
                  </Switch>
                </div>
              </section>
            </div>
          </Show>
        </Show>

        {/* 导出页面 */}
        <Show when={props.activeTab === 'export'}>
          <Show
            when={simulationData()}
            fallback={
              <div class="w-full h-full flex items-center justify-center bg-surface-container-low">
                <Show when={isLoading()} fallback={
                  <div class="text-center">
                    <p class="text-sm text-on-surface-variant">{t().mainCanvas.clickToStart}</p>
                  </div>
                }>
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
                    <p class="text-sm text-on-surface-variant">{t().status.running}</p>
                  </div>
                </Show>
              </div>
            }
          >
            <div role="tabpanel" class="w-full h-full overflow-auto bg-surface-container-low p-6">
              <div class="max-w-4xl mx-auto space-y-6">
                {/* 快速导出 */}
                <div class="bg-surface-container-lowest rounded-lg border border-outline-variant p-6">
                  <h2 class="text-lg font-semibold text-on-surface mb-4">
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
                  <p class="text-xs text-on-surface-variant mt-4 text-center">
                    {t().export.downloadTip}
                  </p>
                  <Show when={exporting() === 'animation_gif' && exportProgress() > 0}>
                    <div class="mt-4">
                      <div class="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                        <span>{t().export.generatingAnimation}</span>
                        <span>{exportProgress()}%</span>
                      </div>
                      <div class="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                        <div
                          class="h-full transition-all duration-300 rounded-full silver-progress-bar"
                          style={{ width: `${exportProgress()}%` }}
                        />
                      </div>
                    </div>
                  </Show>
                </div>

                {/* 自定义导出 */}
                <div class="bg-surface-container-lowest rounded-lg border border-outline-variant p-6">
                  <h2 class="text-lg font-semibold text-on-surface mb-4">
                    {t().export.customExport}
                  </h2>

                  {/* 图表导出 */}
                  <div class="mb-6">
                    <h3 class="text-sm font-medium text-on-surface font-display mb-3">
                      {t().export.chartExport}
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label class="text-xs text-on-surface-variant font-display mb-1.5 block">
                          {t().export.imageFormat}
                        </label>
                        <select
                          value={customExportFormat()}
                          onChange={(e) => setCustomExportFormat(e.currentTarget.value as 'png' | 'tiff' | 'svg')}
                          class="w-full px-3 py-1.5 text-sm bg-surface-container border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-outline text-on-surface font-display"
                        >
                          <option value="png">PNG</option>
                          <option value="tiff">TIFF</option>
                          <option value="svg">SVG</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-xs text-on-surface-variant font-display mb-1.5 block">
                          DPI
                        </label>
                        <select
                          value={customExportDPI()}
                          onChange={(e) => setCustomExportDPI(parseInt(e.currentTarget.value))}
                          class="w-full px-3 py-1.5 text-sm bg-surface-container border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-outline text-on-surface font-display"
                        >
                          <option value="150">150 DPI</option>
                          <option value="300">300 DPI</option>
                          <option value="600">600 DPI</option>
                        </select>
                      </div>
                    </div>
                    <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportCharts().motion} onChange={(e) => setCustomExportCharts({ ...customExportCharts(), motion: e.currentTarget.checked })} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
                        {t().export.charts.motion}
                      </label>
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportCharts().pressure} onChange={(e) => setCustomExportCharts({ ...customExportCharts(), pressure: e.currentTarget.checked })} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
                        {t().export.charts.pressure}
                      </label>
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportCharts().curvature} onChange={(e) => setCustomExportCharts({ ...customExportCharts(), curvature: e.currentTarget.checked })} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
                        {t().export.charts.curvature}
                      </label>
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportCharts().profile} onChange={(e) => setCustomExportCharts({ ...customExportCharts(), profile: e.currentTarget.checked })} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
                        {t().export.charts.profile}
                      </label>
                    </div>
                  </div>

                  {/* 动画导出 */}
                  <div class="mb-6">
                    <h3 class="text-sm font-medium text-on-surface font-display mb-3">
                      {t().export.animationExport}
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      <div>
                        <label class="text-xs text-on-surface-variant font-display mb-1.5 block">
                          {t().export.animationFormat}
                        </label>
                        <select
                          value={customExportAnimFormat()}
                          onChange={(e) => setCustomExportAnimFormat(e.currentTarget.value as 'gif' | 'png')}
                          class="w-full px-3 py-1.5 text-sm bg-surface-container border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-outline text-on-surface font-display"
                        >
                          <option value="gif">GIF</option>
                          <option value="png">PNG 序列</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-xs text-on-surface-variant font-display mb-1.5 block">
                          DPI
                        </label>
                        <select
                          value={customExportAnimDPI()}
                          onChange={(e) => setCustomExportAnimDPI(parseInt(e.currentTarget.value))}
                          class="w-full px-3 py-1.5 text-sm bg-surface-container border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-outline text-on-surface font-display"
                        >
                          <option value="100">100 DPI</option>
                          <option value="150">150 DPI</option>
                          <option value="200">200 DPI</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-xs text-on-surface-variant font-display mb-1.5 block">
                          {t().export.animationFrames}
                        </label>
                        <select
                          value={customExportAnimFrames()}
                          onChange={(e) => setCustomExportAnimFrames(parseInt(e.currentTarget.value))}
                          class="w-full px-3 py-1.5 text-sm bg-surface-container border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-outline text-on-surface font-display"
                        >
                          <option value="60">60</option>
                          <option value="120">120</option>
                          <option value="180">180</option>
                          <option value="360">360</option>
                        </select>
                      </div>
                    </div>
                    <div class="mt-4">
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportAnimation()} onChange={(e) => setCustomExportAnimation(e.currentTarget.checked)} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
                        {t().export.exportAnimation}
                      </label>
                    </div>
                  </div>

                  {/* 数据导出 */}
                  <div class="mb-6">
                    <h3 class="text-sm font-medium text-on-surface font-display mb-3">
                      {t().export.dataExport}
                    </h3>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportData().csv} onChange={(e) => setCustomExportData({ ...customExportData(), csv: e.currentTarget.checked })} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
                        CSV
                      </label>
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportData().excel} onChange={(e) => setCustomExportData({ ...customExportData(), excel: e.currentTarget.checked })} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
                        Excel
                      </label>
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportData().dxf} onChange={(e) => setCustomExportData({ ...customExportData(), dxf: e.currentTarget.checked })} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
                        DXF
                      </label>
                      <label class="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                        <input type="checkbox" checked={customExportData().preset} onChange={(e) => setCustomExportData({ ...customExportData(), preset: e.currentTarget.checked })} class="w-5 h-5" style={{ 'accent-color': 'var(--on-surface-variant)' }} />
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
                      class="px-6 py-2 text-sm font-medium border-2 rounded-lg transition-all duration-200 disabled:opacity-40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
                      style={{
                        'background-color': 'transparent',
                        'border-color': 'var(--primary)',
                        color: 'var(--primary)',
                      }}
                    >
                      {t().export.exportSelected}
                    </button>
                  </div>
                  <Show when={exporting() === 'custom' && exportProgress() > 0}>
                    <div class="mt-4">
                      <div class="flex items-center justify-between text-xs text-on-surface-variant mb-1">
                        <span>{t().export.exporting}</span>
                        <span>{exportProgress()}%</span>
                      </div>
                      <div class="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                        <div
                          class="h-full transition-all duration-300 rounded-full silver-progress-bar"
                          style={{ width: `${exportProgress()}%` }}
                        />
                      </div>
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          </Show>
        </Show>
      </div>
    </main>
  );
}