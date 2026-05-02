import { drawMotionCurves, drawPressureAngleChart, drawCurvatureChart, drawCamProfileChart, MAX_DPI } from '../../utils/chartDrawing';
import type { ChartDrawOptions } from '../../utils/chartDrawing';
import { isTauriEnv } from '../../utils/tauri';
import { isMobilePlatform } from '../../utils/platform';
import { generateGifAsync, terminateGifWorker } from '../../services/gifEncoder';
import { generateDXF as generateDXFCore, generateCSV as generateCSVCore, generateExcel as generateExcelCore, generateTIFFBlob } from '../../exporters';
import { getDownloadDir, getDefaultDpi } from '../settings';
import { t, language } from '../../i18n';
import { arrayMax, arrayMin, arrayMaxBy, filterFinite } from '../../utils/array';
import { simulationData, params, displayOptions } from './core';

// 检查是否在 Tauri 环境中
const isTauri = isTauriEnv();

// 生成 DXF 内容
export function generateDXF(includeActual: boolean): string {
  const data = simulationData();
  if (!data) return '';
  return generateDXFCore(data, includeActual);
}

// 生成 CSV 内容
export function generateCSV(lang: string): string {
  const data = simulationData();
  const p = params();
  if (!data) return '';
  return generateCSVCore(data, p, lang);
}

// 下载文件（浏览器环境）
export function downloadFile(content: string | Blob, filename: string, mimeType: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 统一的文件保存函数（自动判断环境）
export async function saveFile(
  content: string | Blob,
  filename: string,
  mimeType: string,
  options?: {
    showDialog?: boolean;
    saveDir?: string; // Tauri 环境下指定的保存目录
  }
): Promise<{ success: boolean; path?: string; error?: string }> {
  const showDialog = options?.showDialog ?? false;
  const finalSaveDir = options?.saveDir || getDownloadDir();

  if (isTauri) {
    // Tauri 环境：使用文件系统 API（桌面端和移动端）
    try {
      const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
      const { join, dirname, downloadDir } = await import('@tauri-apps/api/path');

      // 确定保存路径
      let filePath: string;
      if (finalSaveDir) {
        filePath = await join(finalSaveDir, filename);
      } else if (showDialog && !isMobilePlatform()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const ext = filename.split('.').pop() || '*';
        const filterName = ext.toUpperCase();
        const selectedPath = await save({
          defaultPath: filename,
          filters: [{ name: filterName, extensions: [ext] }],
        });
        if (!selectedPath) {
          return { success: false, error: 'Cancelled' };
        }
        filePath = selectedPath;
      } else {
        // 无对话框且无目录，使用系统下载目录
        const dlDir = await downloadDir();
        filePath = await join(dlDir, filename);
      }

      // 转换内容为 Uint8Array
      let data: Uint8Array;
      if (content instanceof Blob) {
        const buffer = await content.arrayBuffer();
        data = new Uint8Array(buffer);
      } else {
        const encoder = new TextEncoder();
        data = encoder.encode(content);
      }

      // 确保目录存在
      const dir = await dirname(filePath);
      try {
        await mkdir(dir, { recursive: true });
      } catch {
        // 目录可能已存在，忽略错误
      }

      // 写入文件
      await writeFile(filePath, data);

      return { success: true, path: filePath };
    } catch (e) {
      console.error('Save file error:', e);
      return { success: false, error: String(e) };
    }
  } else {
    // 浏览器环境
    downloadFile(content, filename, mimeType);
    return { success: true };
  }
}

// 获取当前语言
export function getCurrentLang(): string {
  return language();
}

// 获取导出文件名
export function getExportFilename(type: string, lang: string): string {
  const names: Record<string, Record<string, string>> = {
    motion: { zh: '推杆运动线图', en: 'motion_curves' },
    curvature: { zh: '曲率半径曲线', en: 'curvature_radius' },
    pressure: { zh: '压力角曲线', en: 'pressure_angle' },
    profile: { zh: '凸轮廓形', en: 'cam_profile' },
    animation: { zh: '凸轮动画', en: 'cam_animation' },
    csv: { zh: '凸轮数据', en: 'cam_data' },
    excel: { zh: '凸轮数据', en: 'cam_data' },
    svg: { zh: '凸轮综合图', en: 'cam_all' },
    dxf: { zh: '凸轮廓形', en: 'cam_profile' },
    preset: { zh: '凸轮预设', en: 'cam_preset' },
  };
  return names[type]?.[lang] || names[type]?.zh || type;
}

// SVG XML 转义
function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// SVG 导出布局常量
const SVG_CHART_WIDTH = 500;
const SVG_CHART_HEIGHT = 350;
const SVG_GAP = 20;
const SVG_PADDING = { top: 50, right: 70, bottom: 50, left: 60 };
const SVG_TOTAL_WIDTH = SVG_CHART_WIDTH * 2 + SVG_GAP * 3;
const SVG_TOTAL_HEIGHT = SVG_CHART_HEIGHT * 2 + SVG_GAP * 3;

// 生成 SVG 内容（运动曲线 + 压力角 + 曲率半径 + 凸轮轮廓）
export function generateSVG(): string {
  const data = simulationData();
  const p = params();
  if (!data) return '';

  const lang = getCurrentLang();

  const chartWidth = SVG_CHART_WIDTH;
  const chartHeight = SVG_CHART_HEIGHT;
  const gap = SVG_GAP;
  const totalWidth = SVG_TOTAL_WIDTH;
  const totalHeight = SVG_TOTAL_HEIGHT;
  const padding = SVG_PADDING;

  // 标签（XML 安全）
  const labels = {
    delta: xmlEscape(lang === 'zh' ? '转角 δ (°)' : 'Angle δ (°)'),
    s: xmlEscape(lang === 'zh' ? '位移 s (mm)' : 'Displacement s (mm)'),
    v: xmlEscape(lang === 'zh' ? '速度 v (mm/s)' : 'Velocity v (mm/s)'),
    a: xmlEscape(lang === 'zh' ? '加速度 a (mm/s²)' : 'Acceleration a (mm/s²)'),
    alpha: xmlEscape(lang === 'zh' ? '压力角 α (°)' : 'Pressure Angle α (°)'),
    rho: xmlEscape(lang === 'zh' ? '曲率半径 ρ (mm)' : 'Curvature ρ (mm)'),
    motion: xmlEscape(lang === 'zh' ? '推杆运动线图' : 'Follower Motion Curves'),
    pressure: xmlEscape(lang === 'zh' ? '压力角曲线' : 'Pressure Angle Curve'),
    curvature: xmlEscape(lang === 'zh' ? '曲率半径曲线' : 'Curvature Radius Curve'),
    profile: xmlEscape(lang === 'zh' ? '凸轮廓形' : 'Cam Profile'),
    theory: xmlEscape(lang === 'zh' ? '理论廓形' : 'Theory Profile'),
    actual: xmlEscape(lang === 'zh' ? '实际廓形' : 'Actual Profile'),
    baseCircle: xmlEscape(lang === 'zh' ? '基圆' : 'Base Circle'),
    threshold: xmlEscape(lang === 'zh' ? '阈值' : 'Threshold'),
  };

  // 计算范围
  const sMax = data.h * 1.15;
  const vMax = arrayMaxBy(data.v, Math.abs) * 1.15 || 1;
  const aMax = arrayMaxBy(data.a, Math.abs) * 1.15 || 1;
  const alphaMax = Math.max(arrayMaxBy(data.alpha_all, Math.abs), p.alpha_threshold) * 1.15;
  const rhoFinite = filterFinite(data.rho);
  const rhoActualFinite = data.rho_actual ? filterFinite(data.rho_actual) : [];
  const allRhoFinite = [...rhoFinite, ...rhoActualFinite];

  // 使用百分位数来避免极端值影响显示
  let rhoMin: number, rhoMax: number;
  if (allRhoFinite.length > 0) {
    const rhoSorted = [...allRhoFinite].sort((a, b) => a - b);
    const p5Idx = Math.floor(rhoSorted.length * 0.05);
    const p95Idx = Math.floor(rhoSorted.length * 0.95);
    const p5 = rhoSorted[p5Idx];
    const p95 = rhoSorted[p95Idx];
    const range = p95 - p5;

    // 如果范围太大，使用百分位裁剪
    const p10 = rhoSorted[Math.floor(rhoSorted.length * 0.1)];
    const p90 = rhoSorted[Math.floor(rhoSorted.length * 0.9)];
    if (range > 10 * (p90 - p10 + 1)) {
      rhoMin = p5 - range * 0.1;
      rhoMax = p95 + range * 0.1;
    } else {
      rhoMin = arrayMin(allRhoFinite) * 0.9;
      rhoMax = arrayMax(allRhoFinite) * 1.1;
      if (rhoMin > 0) rhoMin = arrayMin(allRhoFinite) * 0.9;
      else rhoMin = arrayMin(allRhoFinite) - 1;
      if (rhoMax < 0) rhoMax = arrayMax(allRhoFinite) + 1;
    }
  } else {
    rhoMin = 0;
    rhoMax = 100;
  }

  // 生成路径的通用函数
  const generatePath = (
    yData: number[],
    yMin: number,
    yMax: number,
    offsetX: number,
    offsetY: number,
    plotWidth: number,
    plotHeight: number
  ): string => {
    const points: string[] = [];
    for (let i = 0; i < yData.length; i++) {
      const x = offsetX + padding.left + (data.delta_deg[i] / 360) * plotWidth;
      const y = offsetY + padding.top + (1 - (yData[i] - yMin) / (yMax - yMin)) * plotHeight;
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    return `M ${points.join(' L ')}`;
  };

  // 生成曲线路径（处理无穷值）
  const generateRhoPathFromData = (
    rhoData: number[],
    offsetX: number,
    offsetY: number,
    plotWidth: number,
    plotHeight: number
  ): string => {
    if (!rhoData || rhoData.length === 0) return '';

    const parts: string[] = [];
    let currentPath: string[] = [];

    for (let i = 0; i < rhoData.length; i++) {
      if (!isFinite(rhoData[i])) {
        if (currentPath.length > 0) {
          parts.push(`M ${currentPath.join(' L ')}`);
          currentPath = [];
        }
        continue;
      }
      const x = offsetX + padding.left + (data.delta_deg[i] / 360) * plotWidth;
      const y = offsetY + padding.top + (1 - (rhoData[i] - rhoMin) / (rhoMax - rhoMin)) * plotHeight;
      currentPath.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    if (currentPath.length > 0) {
      parts.push(`M ${currentPath.join(' L ')}`);
    }

    return parts.join(' ');
  };

  // 凸轮轮廓路径
  const generateCamPath = (
    xData: number[],
    yData: number[],
    centerX: number,
    centerY: number,
    scale: number
  ): string => {
    const points: string[] = [];
    for (let i = 0; i < xData.length; i++) {
      const px = centerX + xData[i] * scale;
      const py = centerY - yData[i] * scale;
      points.push(`${px.toFixed(2)},${py.toFixed(2)}`);
    }
    return `M ${points.join(' L ')} Z`;
  };

  // 四个图表的位置
  const positions = [
    { x: gap, y: gap },                              // 运动曲线（左上）
    { x: chartWidth + gap * 2, y: gap },             // 压力角（右上）
    { x: gap, y: chartHeight + gap * 2 },            // 曲率半径（左下）
    { x: chartWidth + gap * 2, y: chartHeight + gap * 2 }, // 凸轮轮廓（右下）
  ];

  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  // 凸轮轮廓参数
  const profileCenterX = positions[3].x + chartWidth / 2;
  const profileCenterY = positions[3].y + chartHeight / 2;
  const profileScale = Math.min(chartWidth, chartHeight) / (2 * data.r_max * 1.3);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <style>
    .bg { fill: white; }
    .axis { stroke: #333; stroke-width: 1; fill: none; }
    .grid { stroke: #ddd; stroke-width: 0.5; stroke-dasharray: 2,2; }
    .phase-line { stroke: #999; stroke-width: 0.8; stroke-dasharray: 4,4; }
    .curve-s { stroke: #DC2626; stroke-width: 1.5; fill: none; }
    .curve-v { stroke: #2563EB; stroke-width: 1.5; fill: none; stroke-dasharray: 6,4; }
    .curve-a { stroke: #16A34A; stroke-width: 1.5; fill: none; stroke-dasharray: 8,4,2,4; }
    .curve-alpha { stroke: #DC2626; stroke-width: 1.5; fill: none; }
    .curve-rho { stroke: #DC2626; stroke-width: 1.5; fill: none; }
    .threshold-line { stroke: #F59E0B; stroke-width: 1; stroke-dasharray: 4,4; }
    .theory-profile { stroke: #DC2626; stroke-width: 2; fill: none; }
    .actual-profile { stroke: #2563EB; stroke-width: 2; fill: none; }
    .base-circle { stroke: #999; stroke-width: 1; fill: none; stroke-dasharray: 5,5; }
    .label { font-family: -apple-system, sans-serif; font-size: 10px; fill: #333; }
    .title { font-family: -apple-system, sans-serif; font-size: 14px; fill: #333; font-weight: bold; }
    .axis-label { font-family: -apple-system, sans-serif; font-size: 10px; fill: #333; }
    .tick { font-family: -apple-system, sans-serif; font-size: 9px; fill: #333; }
    .legend { font-family: -apple-system, sans-serif; font-size: 9px; fill: #333; }
  </style>

  <!-- 背景 -->
  <rect width="${totalWidth}" height="${totalHeight}" class="bg"/>

  <!-- ========== 运动曲线（左上）========== -->
  <g transform="translate(0, 0)">
    <text x="${positions[0].x + chartWidth/2}" y="${positions[0].y + 20}" text-anchor="middle" class="title">${labels.motion}</text>

    <!-- 网格 -->
    ${Array.from({length: 13}, (_, i) => {
      const x = positions[0].x + padding.left + (i / 12) * plotWidth;
      return `<line x1="${x}" y1="${positions[0].y + padding.top}" x2="${x}" y2="${positions[0].y + chartHeight - padding.bottom}" class="grid"/>`;
    }).join('\n    ')}
    ${Array.from({length: 11}, (_, i) => {
      const y = positions[0].y + padding.top + (i / 10) * plotHeight;
      return `<line x1="${positions[0].x + padding.left}" y1="${y}" x2="${positions[0].x + chartWidth - padding.right}" y2="${y}" class="grid"/>`;
    }).join('\n    ')}

    <!-- 相位分界线 -->
    ${data.phase_bounds.slice(1, -1).map(bound => {
      const x = positions[0].x + padding.left + (bound / 360) * plotWidth;
      return `<line x1="${x}" y1="${positions[0].y + padding.top}" x2="${x}" y2="${positions[0].y + chartHeight - padding.bottom}" class="phase-line"/>`;
    }).join('\n    ')}

    <!-- 曲线 -->
    <path d="${generatePath(data.s, 0, sMax, positions[0].x, positions[0].y, plotWidth, plotHeight)}" class="curve-s"/>
    <path d="${generatePath(data.v, -vMax, vMax, positions[0].x, positions[0].y, plotWidth, plotHeight)}" class="curve-v"/>
    <path d="${generatePath(data.a, -aMax, aMax, positions[0].x, positions[0].y, plotWidth, plotHeight)}" class="curve-a"/>

    <!-- 坐标轴 -->
    <rect x="${positions[0].x + padding.left}" y="${positions[0].y + padding.top}" width="${plotWidth}" height="${plotHeight}" class="axis"/>

    <!-- X轴标签 -->
    <text x="${positions[0].x + chartWidth/2}" y="${positions[0].y + chartHeight - 10}" text-anchor="middle" class="axis-label">${labels.delta}</text>
    ${[0, 90, 180, 270, 360].map(val => {
      const x = positions[0].x + padding.left + (val / 360) * plotWidth;
      return `<text x="${x}" y="${positions[0].y + chartHeight - padding.bottom + 15}" text-anchor="middle" class="tick">${val}</text>`;
    }).join('\n    ')}

    <!-- Y轴标签 -->
    <text x="${positions[0].x + 16}" y="${positions[0].y + padding.top + plotHeight/2}" text-anchor="middle" class="axis-label" transform="rotate(-90, ${positions[0].x + 16}, ${positions[0].y + padding.top + plotHeight/2})">${labels.s}</text>

    <!-- 图例 -->
    <g transform="translate(${positions[0].x + chartWidth - 100}, ${positions[0].y + padding.top + 10})">
      <line x1="0" y1="0" x2="20" y2="0" class="curve-s"/>
      <text x="25" y="4" class="legend">${lang === 'zh' ? '位移 s' : 's'}</text>
      <line x1="0" y1="16" x2="20" y2="16" class="curve-v"/>
      <text x="25" y="20" class="legend">${lang === 'zh' ? '速度 v' : 'v'}</text>
      <line x1="0" y1="32" x2="20" y2="32" class="curve-a"/>
      <text x="25" y="36" class="legend">${lang === 'zh' ? '加速度 a' : 'a'}</text>
    </g>
  </g>

  <!-- ========== 压力角（右上）========== -->
  <g transform="translate(0, 0)">
    <text x="${positions[1].x + chartWidth/2}" y="${positions[1].y + 20}" text-anchor="middle" class="title">${labels.pressure}</text>

    <!-- 网格 -->
    ${Array.from({length: 13}, (_, i) => {
      const x = positions[1].x + padding.left + (i / 12) * plotWidth;
      return `<line x1="${x}" y1="${positions[1].y + padding.top}" x2="${x}" y2="${positions[1].y + chartHeight - padding.bottom}" class="grid"/>`;
    }).join('\n    ')}
    ${Array.from({length: 11}, (_, i) => {
      const y = positions[1].y + padding.top + (i / 10) * plotHeight;
      return `<line x1="${positions[1].x + padding.left}" y1="${y}" x2="${positions[1].x + chartWidth - padding.right}" y2="${y}" class="grid"/>`;
    }).join('\n    ')}

    <!-- 相位分界线 -->
    ${data.phase_bounds.slice(1, -1).map(bound => {
      const x = positions[1].x + padding.left + (bound / 360) * plotWidth;
      return `<line x1="${x}" y1="${positions[1].y + padding.top}" x2="${x}" y2="${positions[1].y + chartHeight - padding.bottom}" class="phase-line"/>`;
    }).join('\n    ')}

    <!-- 阈值线 -->
    <line x1="${positions[1].x + padding.left}" y1="${positions[1].y + padding.top + (1 - p.alpha_threshold / alphaMax) * plotHeight}" x2="${positions[1].x + chartWidth - padding.right}" y2="${positions[1].y + padding.top + (1 - p.alpha_threshold / alphaMax) * plotHeight}" class="threshold-line"/>

    <!-- 曲线 -->
    <path d="${generatePath(data.alpha_all, 0, alphaMax, positions[1].x, positions[1].y, plotWidth, plotHeight)}" class="curve-alpha"/>

    <!-- 坐标轴 -->
    <rect x="${positions[1].x + padding.left}" y="${positions[1].y + padding.top}" width="${plotWidth}" height="${plotHeight}" class="axis"/>

    <!-- X轴标签 -->
    <text x="${positions[1].x + chartWidth/2}" y="${positions[1].y + chartHeight - 10}" text-anchor="middle" class="axis-label">${labels.delta}</text>
    ${[0, 90, 180, 270, 360].map(val => {
      const x = positions[1].x + padding.left + (val / 360) * plotWidth;
      return `<text x="${x}" y="${positions[1].y + chartHeight - padding.bottom + 15}" text-anchor="middle" class="tick">${val}</text>`;
    }).join('\n    ')}

    <!-- Y轴标签 -->
    <text x="${positions[1].x + 16}" y="${positions[1].y + padding.top + plotHeight/2}" text-anchor="middle" class="axis-label" transform="rotate(-90, ${positions[1].x + 16}, ${positions[1].y + padding.top + plotHeight/2})">${labels.alpha}</text>

    <!-- 图例 -->
    <g transform="translate(${positions[1].x + padding.left + 10}, ${positions[1].y + padding.top + 10})">
      <line x1="0" y1="0" x2="20" y2="0" class="curve-alpha"/>
      <text x="25" y="4" class="legend">${lang === 'zh' ? '压力角 α' : 'α'}</text>
      <line x1="0" y1="16" x2="20" y2="16" class="threshold-line"/>
      <text x="25" y="20" class="legend">${labels.threshold} ${p.alpha_threshold}°</text>
    </g>
  </g>

  <!-- ========== 曲率半径（左下）========== -->
  <g transform="translate(0, 0)">
    <text x="${positions[2].x + chartWidth/2}" y="${positions[2].y + 20}" text-anchor="middle" class="title">${labels.curvature}</text>

    <!-- 网格 -->
    ${Array.from({length: 13}, (_, i) => {
      const x = positions[2].x + padding.left + (i / 12) * plotWidth;
      return `<line x1="${x}" y1="${positions[2].y + padding.top}" x2="${x}" y2="${positions[2].y + chartHeight - padding.bottom}" class="grid"/>`;
    }).join('\n    ')}
    ${Array.from({length: 11}, (_, i) => {
      const y = positions[2].y + padding.top + (i / 10) * plotHeight;
      return `<line x1="${positions[2].x + padding.left}" y1="${y}" x2="${positions[2].x + chartWidth - padding.right}" y2="${y}" class="grid"/>`;
    }).join('\n    ')}

    <!-- 相位分界线 -->
    ${data.phase_bounds.slice(1, -1).map(bound => {
      const x = positions[2].x + padding.left + (bound / 360) * plotWidth;
      return `<line x1="${x}" y1="${positions[2].y + padding.top}" x2="${x}" y2="${positions[2].y + chartHeight - padding.bottom}" class="phase-line"/>`;
    }).join('\n    ')}

    <!-- 曲线 -->
    <path d="${generateRhoPathFromData(data.rho, positions[2].x, positions[2].y, plotWidth, plotHeight)}" class="curve-rho"/>
    ${p.r_r > 0 ? `<path d="${generateRhoPathFromData(data.rho_actual, positions[2].x, positions[2].y, plotWidth, plotHeight)}" stroke="#3B82F6" stroke-width="1.5" fill="none" stroke-dasharray="4,2"/>` : ''}

    <!-- 滚子半径阈值线 -->
    ${p.r_r > 0 ? (() => {
      const thresholdY = positions[2].y + padding.top + (1 - (p.r_r - rhoMin) / (rhoMax - rhoMin)) * plotHeight;
      if (thresholdY >= positions[2].y + padding.top && thresholdY <= positions[2].y + chartHeight - padding.bottom) {
        return `<line x1="${positions[2].x + padding.left}" y1="${thresholdY}" x2="${positions[2].x + chartWidth - padding.right}" y2="${thresholdY}" stroke="#06B6D4" stroke-width="1" stroke-dasharray="4,4"/>`;
      }
      return '';
    })() : ''}

    <!-- 坐标轴 -->
    <rect x="${positions[2].x + padding.left}" y="${positions[2].y + padding.top}" width="${plotWidth}" height="${plotHeight}" class="axis"/>

    <!-- X轴标签 -->
    <text x="${positions[2].x + chartWidth/2}" y="${positions[2].y + chartHeight - 10}" text-anchor="middle" class="axis-label">${labels.delta}</text>
    ${[0, 90, 180, 270, 360].map(val => {
      const x = positions[2].x + padding.left + (val / 360) * plotWidth;
      return `<text x="${x}" y="${positions[2].y + chartHeight - padding.bottom + 15}" text-anchor="middle" class="tick">${val}</text>`;
    }).join('\n    ')}

    <!-- Y轴标签 -->
    <text x="${positions[2].x + 16}" y="${positions[2].y + padding.top + plotHeight/2}" text-anchor="middle" class="axis-label" transform="rotate(-90, ${positions[2].x + 16}, ${positions[2].y + padding.top + plotHeight/2})">${labels.rho}</text>

    <!-- 图例 -->
    <g transform="translate(${positions[2].x + padding.left + 10}, ${positions[2].y + padding.top + 10})">
      <line x1="0" y1="0" x2="20" y2="0" class="curve-rho"/>
      <text x="25" y="4" class="legend">${lang === 'zh' ? '理论轮廓 ρ' : 'Theory ρ'}</text>
      ${p.r_r > 0 ? `<line x1="0" y1="14" x2="20" y2="14" stroke="#3B82F6" stroke-width="1.5" stroke-dasharray="4,2"/><text x="25" y="18" class="legend">${lang === 'zh' ? '实际轮廓 ρₐ' : 'Actual ρₐ'}</text>` : ''}
      ${data.min_rho !== null ? `<circle cx="10" cy="${p.r_r > 0 ? 30 : 16}" r="4" fill="#16A34A"/><text x="25" y="${p.r_r > 0 ? 34 : 20}" class="legend">ρ<tspan baseline-shift="sub" font-size="8">min</tspan> = ${data.min_rho.toFixed(2)} mm</text>` : ''}
      ${p.r_r > 0 && data.min_rho_actual !== null ? `<circle cx="10" cy="${data.min_rho !== null ? 46 : 30}" r="4" fill="#F97316"/><text x="25" y="${data.min_rho !== null ? 50 : 34}" class="legend">ρ<tspan baseline-shift="sub" font-size="8">a,min</tspan> = ${data.min_rho_actual.toFixed(2)} mm</text>` : ''}
      ${p.r_r > 0 ? `<line x1="0" y1="${data.min_rho !== null ? (data.min_rho_actual !== null ? 62 : 46) : (data.min_rho_actual !== null ? 46 : 30)}" x2="20" y2="${data.min_rho !== null ? (data.min_rho_actual !== null ? 62 : 46) : (data.min_rho_actual !== null ? 46 : 30)}" stroke="#06B6D4" stroke-width="1" stroke-dasharray="4,4"/><text x="25" y="${data.min_rho !== null ? (data.min_rho_actual !== null ? 66 : 50) : (data.min_rho_actual !== null ? 50 : 34)}" class="legend">${lang === 'zh' ? '阈值' : 'Threshold'} ${p.r_r} mm</text>` : ''}
    </g>
  </g>

  <!-- ========== 凸轮轮廓（右下）========== -->
  <g transform="translate(0, 0)">
    <text x="${positions[3].x + chartWidth/2}" y="${positions[3].y + 20}" text-anchor="middle" class="title">${labels.profile}</text>

    <!-- 基圆 -->
    <circle cx="${profileCenterX}" cy="${profileCenterY}" r="${p.r_0 * profileScale}" class="base-circle"/>

    <!-- 偏距圆 -->
    ${Math.abs(p.e) > 0.01 ? `<circle cx="${profileCenterX}" cy="${profileCenterY}" r="${Math.abs(p.e) * profileScale}" stroke="#BBB" stroke-width="1" fill="none" stroke-dasharray="3,3"/>` : ''}

    <!-- 理论廓形 -->
    <path d="${generateCamPath(data.x, data.y, profileCenterX, profileCenterY, profileScale)}" class="theory-profile"/>

    <!-- 实际廓形 -->
    ${p.r_r > 0 && data.x_actual.length > 0 ? `<path d="${generateCamPath(data.x_actual, data.y_actual, profileCenterX, profileCenterY, profileScale)}" class="actual-profile"/>` : ''}

    <!-- 图例 -->
    <g transform="translate(${positions[3].x + 20}, ${positions[3].y + 30})">
      <line x1="0" y1="0" x2="30" y2="0" class="theory-profile"/>
      <text x="40" y="4" class="legend">${labels.theory}</text>
      ${p.r_r > 0 ? `<line x1="0" y1="16" x2="30" y2="16" class="actual-profile"/><text x="40" y="20" class="legend">${labels.actual}</text>` : ''}
      <line x1="0" y1="${p.r_r > 0 ? 32 : 16}" x2="30" y2="${p.r_r > 0 ? 32 : 16}" class="base-circle"/>
      <text x="40" y="${p.r_r > 0 ? 36 : 20}" class="legend">${labels.baseCircle}</text>
    </g>
  </g>
</svg>`;
}

// 生成高分辨率 PNG 图像（通过 Canvas）- 使用共享绘制函数
// 注意：此函数输出 PNG 格式，文件扩展名应为 .png
export function generateHighResPNG(
  type: 'motion' | 'curvature' | 'pressure' | 'profile',
  lang: string,
  customDpi?: number
): Promise<Blob> {
  return new Promise((resolve) => {
    const data = simulationData();
    const p = params();
    if (!data) {
      resolve(new Blob());
      return;
    }

    // DPI 上限保护，防止内存溢出
    const dpi = Math.min(customDpi || getDefaultDpi(), MAX_DPI);
    const width = type === 'profile' ? 6 * dpi : 8 * dpi;
    const height = type === 'profile' ? 6 * dpi : 5 * dpi;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');

    const options: ChartDrawOptions = {
      width,
      height,
      isDark: false,
      lang,
      dpi,
      translations: t()
    };

    switch (type) {
      case 'motion':
        drawMotionCurves(ctx, data, options);
        break;
      case 'pressure':
        drawPressureAngleChart(ctx, data, p, options);
        break;
      case 'curvature':
        drawCurvatureChart(ctx, data, p, options);
        break;
      case 'profile':
        drawCamProfileChart(ctx, data, p, options);
        break;
    }

    canvas.toBlob((blob) => {
      resolve(blob || new Blob());
    }, 'image/png');
  });
}

// 保持向后兼容的别名（PNG 格式）
export const generateTIFF = generateHighResPNG;

// 生成真正的 TIFF 格式图像
export async function generateRealTIFF(
  type: 'motion' | 'curvature' | 'pressure' | 'profile',
  lang: string,
  customDpi?: number
): Promise<Blob> {
  const data = simulationData();
  const p = params();
  if (!data) {
    return new Blob();
  }

  // DPI 上限保护
  const dpi = Math.min(customDpi || getDefaultDpi(), MAX_DPI);
  const width = type === 'profile' ? 6 * dpi : 8 * dpi;
  const height = type === 'profile' ? 6 * dpi : 5 * dpi;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');

  const options: ChartDrawOptions = {
    width,
    height,
    isDark: false,
    lang,
    dpi,
    translations: t()
  };

  switch (type) {
    case 'motion':
      drawMotionCurves(ctx, data, options);
      break;
    case 'pressure':
      drawPressureAngleChart(ctx, data, p, options);
      break;
    case 'curvature':
      drawCurvatureChart(ctx, data, p, options);
      break;
    case 'profile':
      drawCamProfileChart(ctx, data, p, options);
      break;
  }

  // 使用 TIFF 编码
  return generateTIFFBlob(canvas, dpi);
}

// 生成 GIF 动画（异步，使用 Web Worker 避免阻塞主线程）
export async function generateGIF(
  lang: string,
  onProgress?: (progress: number) => void,
  customDpi?: number,
  maxFrames?: number
): Promise<Blob> {
  const data = simulationData();
  const p = params();
  const disp = displayOptions();

  if (!data) return new Blob();

  const dpi = customDpi || 150;

  try {
    return await generateGifAsync(
      data,
      p,
      disp,
      {
        dpi,
        width: 5 * dpi,
        height: 5 * dpi,
        lang,
        maxFrames: maxFrames || 360,
      },
      onProgress
    );
  } catch (error) {
    console.error('GIF generation failed:', error);
    return new Blob();
  }
}

// 导出 Worker 清理函数，供应用退出时调用
export { terminateGifWorker };

// 生成 Excel 文件（真正的 xlsx 格式）
export function generateExcel(lang: string): Blob {
  const data = simulationData();
  const p = params();
  if (!data) return new Blob();
  return generateExcelCore(data, p, lang);
}