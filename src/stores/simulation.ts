import { createSignal } from 'solid-js';
import type { CamParams, SimulationData, DisplayOptions } from '../types';
import { defaultParams, defaultDisplayOptions } from '../constants';
import { drawMotionCurves, drawPressureAngleChart, drawCurvatureChart, drawCamProfileChart } from '../utils/chartDrawing';
import type { ChartDrawOptions } from '../utils/chartDrawing';
import { computeMotion } from '../services/motion';
import { arrayMax, arrayMin, arrayMaxBy, arrayMinBy, filterFinite, findIndex } from '../utils/array';
import { isTauriEnv, invokeTauri } from '../utils/tauri';
import { isMobilePlatform } from '../utils/platform';
import { generateGifAsync, terminateGifWorker } from '../services/gifEncoder';
import { createHistory, type HistoryActions } from './history';
import { generateDXF as generateDXFCore, generateCSV as generateCSVCore, generateExcel as generateExcelCore, generateTIFFBlob } from '../exporters';
import { getApi } from '../api';
import { getDownloadDir, getDefaultDpi } from './settings';
import { t } from '../i18n';

// 检查是否在 Tauri 环境中
const isTauri = isTauriEnv();

// 参数历史管理（撤销/重做）
const paramsHistory: HistoryActions<CamParams> = createHistory(defaultParams);

// 参数状态
export const [params, setParams] = createSignal<CamParams>(defaultParams);

// 撤销/重做操作
export const canUndo = () => paramsHistory.canUndo();
export const canRedo = () => paramsHistory.canRedo();

export function undoParams(): boolean {
  if (paramsHistory.undo()) {
    setParams(() => paramsHistory.state());
    setParamsChanged(true);
    setParamsUpdated(true);
    runSimulation();
    return true;
  }
  return false;
}

export function redoParams(): boolean {
  if (paramsHistory.redo()) {
    setParams(() => paramsHistory.state());
    setParamsChanged(true);
    setParamsUpdated(true);
    runSimulation();
    return true;
  }
  return false;
}

// 显示选项状态
export const [displayOptions, setDisplayOptions] = createSignal<DisplayOptions>(defaultDisplayOptions);

// 模拟数据状态
export const [simulationData, setSimulationData] = createSignal<SimulationData | null>(null);

// 加载状态
export const [isLoading, setIsLoading] = createSignal(false);

// 最后运行时间
export const [lastRunTime, setLastRunTime] = createSignal<Date | null>(null);

// 参数是否已更新（需要重新运行）
export const [paramsChanged, setParamsChanged] = createSignal(false);

// 参数更新提示（用于状态栏显示）
export const [paramsUpdated, setParamsUpdated] = createSignal(false);

// 导出状态
export const [exportStatus, setExportStatus] = createSignal<{
  type: 'idle' | 'exporting' | 'success' | 'error';
  message: string;
  files?: string[];
}>({ type: 'idle', message: '' });

// 共享游标帧索引（图表拖动 ↔ 机构动画同步）
export const [cursorFrame, setCursorFrame] = createSignal(0);

// 曲线可见性（图例点击切换）
export const [curveVisible, setCurveVisible] = createSignal({ s: true, v: true, a: true });

// 保存上次运行的参数哈希
let lastRunParamsHash = '';

// 生成模拟数据
// Fallback: mirrors camforge-core::compute_full_motion. Keep formulas in sync with Rust.
function computeSimulationLocally(p: CamParams): SimulationData {
  const n = p.n_points;
  const delta_deg: number[] = [];
  const s: number[] = [];
  const v: number[] = [];
  const a: number[] = [];
  const ds_ddelta: number[] = [];

  // 各相位角度（弧度）
  const delta0_rad = (p.delta_0 * Math.PI) / 180;
  const delta01_rad = (p.delta_01 * Math.PI) / 180;
  const deltaRet_rad = (p.delta_ret * Math.PI) / 180;

  // 相位边界（弧度）
  const riseEnd = delta0_rad;
  const outerDwellEnd = riseEnd + delta01_rad;
  const returnEnd = outerDwellEnd + deltaRet_rad;

  for (let i = 0; i < n; i++) {
    const delta = (2 * Math.PI * i) / n;
    delta_deg.push((delta * 180) / Math.PI);

    let si = 0, vi = 0, ai = 0;

    if (delta <= riseEnd && delta0_rad > 0) {
      // 推程阶段
      const t = delta / delta0_rad;
      [si, vi, ai] = computeMotion(p.tc_law, t, p.h, p.omega, delta0_rad);
    } else if (delta <= outerDwellEnd) {
      // 远休止阶段
      si = p.h;
      vi = 0;
      ai = 0;
    } else if (delta <= returnEnd && deltaRet_rad > 0) {
      // 回程阶段
      const t = (delta - outerDwellEnd) / deltaRet_rad;
      [si, vi, ai] = computeMotion(p.hc_law, t, p.h, p.omega, deltaRet_rad);
      si = p.h - si;
      vi = -vi;
      ai = -ai;
    } else {
      // 近休止阶段
      si = 0;
      vi = 0;
      ai = 0;
    }

    s.push(si);
    v.push(vi);
    a.push(ai);
    ds_ddelta.push(vi / p.omega);
  }

  const s_0 = Math.sqrt(p.r_0 * p.r_0 - p.e * p.e);
  const x: number[] = [];
  const y: number[] = [];

  for (let i = 0; i < n; i++) {
    const delta = (2 * Math.PI * i) / n;
    const sp = s_0 + s[i];
    // 凸轮廓形方程
    let xi = sp * Math.sin(delta) + p.pz * p.e * Math.cos(delta);
    let yi = sp * Math.cos(delta) - p.pz * p.e * Math.sin(delta);
    // 旋向翻转
    xi = -p.sn * xi;
    x.push(xi);
    y.push(yi);
  }

  // 计算滚子从动件实际廓形
  let x_actual: number[] = [...x];
  let y_actual: number[] = [...y];

  if (p.r_r > 0) {
    x_actual = [];
    y_actual = [];
    for (let i = 0; i < n; i++) {
      // 中心差分求切线方向
      const iPrev = (i - 1 + n) % n;
      const iNext = (i + 1) % n;
      const dx = x[iNext] - x[iPrev];
      const dy = y[iNext] - y[iPrev];
      const lenT = Math.hypot(dx, dy);

      if (lenT < 1e-12) {
        x_actual.push(x[i]);
        y_actual.push(y[i]);
        continue;
      }

      const tx = dx / lenT;
      const ty = dy / lenT;

      // 内法线方向
      let nx: number, ny: number;
      if (p.sn === 1) {
        nx = ty;
        ny = -tx;
      } else {
        nx = -ty;
        ny = tx;
      }

      // 确保法线指向凸轮中心
      const dot = -x[i] * nx + -y[i] * ny;
      if (dot < 0) {
        nx = -nx;
        ny = -ny;
      }

      x_actual.push(x[i] + p.r_r * nx);
      y_actual.push(y[i] + p.r_r * ny);
    }
  }

  // 计算压力角
  // 压力角公式: α = arctan((ds/dδ - pz·e) / (s₀ + s))
  const alpha_all: number[] = [];
  for (let i = 0; i < n; i++) {
    const sp = s_0 + s[i];
    const dsd = ds_ddelta[i];
    // 压力角计算
    const tanAlpha = (dsd - p.pz * p.e) / sp;
    const alpha = Math.atan(tanAlpha) * 180 / Math.PI;
    alpha_all.push(Math.abs(alpha));
  }

  const r_max = arrayMaxBy(x, (xi, i) => Math.sqrt(xi * xi + y[i] * y[i]));
  const max_alpha = arrayMax(alpha_all);

  // 计算曲率半径
  // 使用参数曲线曲率公式: ρ = ((x'^2 + y'^2)^(3/2)) / (x'y'' - y'x'')
  const rho: number[] = [];
  for (let i = 0; i < n; i++) {
    const iPrev = (i - 1 + n) % n;
    const iNext = (i + 1) % n;

    // 中心差分求一阶导数
    const dx = (x[iNext] - x[iPrev]) / 2.0;
    const dy = (y[iNext] - y[iPrev]) / 2.0;

    // 中心差分求二阶导数
    const ddx = x[iNext] - 2 * x[i] + x[iPrev];
    const ddy = y[iNext] - 2 * y[i] + y[iPrev];

    // 曲率 κ = (x'y'' - y'x'') / (x'^2 + y'^2)^(3/2)
    const cross = dx * ddy - dy * ddx;
    const speedCubed = Math.pow(dx * dx + dy * dy, 1.5);

    // 避免除零
    if (speedCubed > 1e-12 && Math.abs(cross) > 1e-12) {
      rho.push(speedCubed / cross);
    } else {
      rho.push(Infinity);
    }
  }

  // 计算实际轮廓曲率半径（滚子从动件）
  // ρ_a = ρ - r_r (外凸部分，ρ > 0)
  // ρ_a = ρ + r_r (内凹部分，ρ < 0，实际为 |ρ| + r_r)
  // 简化公式: ρ_a = ρ - sign(ρ) * r_r
  let rho_actual: number[] = [];
  if (p.r_r > 0) {
    for (let i = 0; i < n; i++) {
      if (isFinite(rho[i])) {
        // 理论轮廓曲率半径决定内外凸
        // 外凸 (ρ > 0): 实际轮廓向内收缩，ρ_a = ρ - r_r
        // 内凹 (ρ < 0): 实际轮廓向外扩展，ρ_a = ρ + r_r (更负)
        rho_actual.push(rho[i] - Math.sign(rho[i]) * p.r_r);
      } else {
        rho_actual.push(Infinity);
      }
    }
  } else {
    // 尖底从动件，实际轮廓即理论轮廓
    rho_actual = [...rho];
  }

  // 计算最小曲率半径（理论轮廓）
  const rhoFinite = filterFinite(rho);
  let min_rho: number | null = null;
  let min_rho_idx = 0;
  if (rhoFinite.length > 0) {
    min_rho = arrayMinBy(rhoFinite, Math.abs);
    min_rho_idx = findIndex(rho, r => isFinite(r) && Math.abs(r) === min_rho);
    if (min_rho_idx < 0) min_rho_idx = 0;
  }

  // 计算最小曲率半径（实际轮廓）
  const rhoActualFinite = filterFinite(rho_actual);
  let min_rho_actual: number | null = null;
  let min_rho_actual_idx = 0;
  if (rhoActualFinite.length > 0) {
    min_rho_actual = arrayMinBy(rhoActualFinite, Math.abs);
    min_rho_actual_idx = findIndex(rho_actual, r => isFinite(r) && Math.abs(r) === min_rho_actual);
    if (min_rho_actual_idx < 0) min_rho_actual_idx = 0;
  }

  // NaN 检测
  if (s.some(val => !Number.isFinite(val)) || x.some(val => !Number.isFinite(val)) || y.some(val => !Number.isFinite(val))) {
    console.warn('Simulation produced non-finite values');
  }

  return {
    delta_deg,
    s, v, a, ds_ddelta,
    phase_bounds: [0, p.delta_0, p.delta_0 + p.delta_01, p.delta_0 + p.delta_01 + p.delta_ret, 360],
    x, y,
    x_actual,
    y_actual,
    rho,
    rho_actual,
    alpha_all,
    s_0,
    r_max,
    max_alpha,
    min_rho,
    min_rho_idx,
    min_rho_actual,
    min_rho_actual_idx,
    h: p.h,
  };
}

// 计算参数哈希
function getParamsHash(p: CamParams): string {
  return JSON.stringify(p);
}

// 运行模拟
export async function runSimulation() {
  const currentParams = params();
  setIsLoading(true);

  try {
    if (isTauri) {
      // Tauri 环境：使用 IPC 调用 Rust 后端
      const data = await invokeTauri<SimulationData>('run_simulation', { params: currentParams });
      setSimulationData(data);
    } else {
      // Web 环境：尝试使用 HTTP API，失败则使用前端计算
      try {
        const api = await getApi();
        const data = await api.runSimulation(currentParams);
        setSimulationData(data);
      } catch (apiError) {
        console.warn('HTTP API unavailable, using frontend calculation:', apiError);
        await new Promise(resolve => setTimeout(resolve, 100));
        const data = computeSimulationLocally(currentParams);
        setSimulationData(() => data);
      }
    }
    // 更新状态
    setLastRunTime(new Date());
    lastRunParamsHash = getParamsHash(currentParams);
    setParamsChanged(false);
  } catch (e) {
    console.error('Simulation error:', e);
    // 错误时使用前端计算作为 fallback
    const data = computeSimulationLocally(params());
    setSimulationData(() => data);
  } finally {
    setIsLoading(false);
  }
}

export function updateParam<K extends keyof CamParams>(key: K, value: CamParams[K]) {
  setParams((prev) => {
    const newParams = { ...prev, [key]: value };
    // 记录到历史
    paramsHistory.push(newParams);
    // 检查参数是否与上次运行不同
    if (lastRunParamsHash && getParamsHash(newParams) !== lastRunParamsHash) {
      setParamsChanged(true);
    }
    return newParams;
  });
}

export function updateDisplayOption<K extends keyof DisplayOptions>(key: K, value: DisplayOptions[K]) {
  setDisplayOptions((o) => ({ ...o, [key]: value }));
}

// 保存配置到 localStorage
export function savePreset(name: string) {
  const preset = {
    params: params(),
    displayOptions: displayOptions(),
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(`camforge-preset-${name}`, JSON.stringify(preset));
}

// 加载配置从 localStorage
export function loadPreset(name: string): boolean {
  const stored = localStorage.getItem(`camforge-preset-${name}`);
  if (stored) {
    try {
      const preset = JSON.parse(stored);
      setParams(preset.params);
      setDisplayOptions(preset.displayOptions);
      setParamsChanged(true);
      setParamsUpdated(true);
      runSimulation();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// 获取所有保存的配置名称
export function getSavedPresets(): string[] {
  const presets: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('camforge-preset-')) {
      presets.push(key.replace('camforge-preset-', ''));
    }
  }
  return presets;
}

// 删除配置
export function deletePreset(name: string) {
  localStorage.removeItem(`camforge-preset-${name}`);
}

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
    // 移动端：使用浏览器下载方式（WebView 支持 <a download>）
    if (isMobilePlatform()) {
      try {
        downloadFile(content, filename, mimeType);
        return { success: true, path: filename };
      } catch (e) {
        console.error('Mobile download error:', e);
        return { success: false, error: String(e) };
      }
    }

    // 桌面端：使用 Tauri 文件系统
    try {
      const { writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
      const { join, dirname, downloadDir } = await import('@tauri-apps/api/path');

      // 确定保存路径
      let filePath: string;
      if (finalSaveDir) {
        filePath = await join(finalSaveDir, filename);
      } else if (showDialog) {
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
  return localStorage.getItem('language') || 'zh';
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

// 生成 SVG 内容（运动曲线 + 压力角 + 曲率半径 + 凸轮轮廓）
export function generateSVG(): string {
  const data = simulationData();
  const p = params();
  if (!data) return '';

  const lang = getCurrentLang();

  // 布局：2x2 网格，每个图表大小
  const chartWidth = 500;
  const chartHeight = 350;
  const gap = 20;
  const totalWidth = chartWidth * 2 + gap * 3;
  const totalHeight = chartHeight * 2 + gap * 3;

  const padding = { top: 50, right: 70, bottom: 50, left: 60 };

  // 标签
  const labels = {
    delta: lang === 'zh' ? '转角 δ (°)' : 'Angle δ (°)',
    s: lang === 'zh' ? '位移 s (mm)' : 'Displacement s (mm)',
    v: lang === 'zh' ? '速度 v (mm/s)' : 'Velocity v (mm/s)',
    a: lang === 'zh' ? '加速度 a (mm/s²)' : 'Acceleration a (mm/s²)',
    alpha: lang === 'zh' ? '压力角 α (°)' : 'Pressure Angle α (°)',
    rho: lang === 'zh' ? '曲率半径 ρ (mm)' : 'Curvature ρ (mm)',
    motion: lang === 'zh' ? '推杆运动线图' : 'Follower Motion Curves',
    pressure: lang === 'zh' ? '压力角曲线' : 'Pressure Angle Curve',
    curvature: lang === 'zh' ? '曲率半径曲线' : 'Curvature Radius Curve',
    profile: lang === 'zh' ? '凸轮廓形' : 'Cam Profile',
    theory: lang === 'zh' ? '理论廓形' : 'Theory Profile',
    actual: lang === 'zh' ? '实际廓形' : 'Actual Profile',
    baseCircle: lang === 'zh' ? '基圆' : 'Base Circle',
    threshold: lang === 'zh' ? '阈值' : 'Threshold',
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

  // 生成曲线路径（处理无穷值）- 理论轮廓
  const generateRhoPath = (
    offsetX: number,
    offsetY: number,
    plotWidth: number,
    plotHeight: number
  ): string => {
    const parts: string[] = [];
    let currentPath: string[] = [];

    for (let i = 0; i < data.rho.length; i++) {
      if (!isFinite(data.rho[i])) {
        if (currentPath.length > 0) {
          parts.push(`M ${currentPath.join(' L ')}`);
          currentPath = [];
        }
        continue;
      }
      const x = offsetX + padding.left + (data.delta_deg[i] / 360) * plotWidth;
      const y = offsetY + padding.top + (1 - (data.rho[i] - rhoMin) / (rhoMax - rhoMin)) * plotHeight;
      currentPath.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    if (currentPath.length > 0) {
      parts.push(`M ${currentPath.join(' L ')}`);
    }

    return parts.join(' ');
  };

  // 生成曲线路径（处理无穷值）- 实际轮廓
  const generateRhoActualPath = (
    offsetX: number,
    offsetY: number,
    plotWidth: number,
    plotHeight: number
  ): string => {
    if (!data.rho_actual || data.rho_actual.length === 0) return '';

    const parts: string[] = [];
    let currentPath: string[] = [];

    for (let i = 0; i < data.rho_actual.length; i++) {
      if (!isFinite(data.rho_actual[i])) {
        if (currentPath.length > 0) {
          parts.push(`M ${currentPath.join(' L ')}`);
          currentPath = [];
        }
        continue;
      }
      const x = offsetX + padding.left + (data.delta_deg[i] / 360) * plotWidth;
      const y = offsetY + padding.top + (1 - (data.rho_actual[i] - rhoMin) / (rhoMax - rhoMin)) * plotHeight;
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
    <path d="${generateRhoPath(positions[2].x, positions[2].y, plotWidth, plotHeight)}" class="curve-rho"/>
    ${p.r_r > 0 ? `<path d="${generateRhoActualPath(positions[2].x, positions[2].y, plotWidth, plotHeight)}" stroke="#3B82F6" stroke-width="1.5" fill="none" stroke-dasharray="4,2"/>` : ''}

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
    const MAX_DPI = 600;
    const dpi = Math.min(customDpi || getDefaultDpi(), MAX_DPI);
    const width = type === 'profile' ? 6 * dpi : 8 * dpi;
    const height = type === 'profile' ? 6 * dpi : 5 * dpi;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

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
  const MAX_DPI = 600;
  const dpi = Math.min(customDpi || getDefaultDpi(), MAX_DPI);
  const width = type === 'profile' ? 6 * dpi : 8 * dpi;
  const height = type === 'profile' ? 6 * dpi : 5 * dpi;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

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

// 导出当前配置为 JSON
export function generatePresetJSON(): string {
  const currentParams = params();
  const currentDisplay = displayOptions();
  const preset = {
    params: currentParams,
    displayOptions: currentDisplay,
    savedAt: new Date().toISOString(),
    version: '1.0.0'
  };
  return JSON.stringify(preset, null, 2);
}

// 从 JSON 字符串加载配置
export function loadPresetFromJSON(jsonString: string): { success: boolean; error?: string } {
  try {
    const preset = JSON.parse(jsonString);

    // 验证必要字段存在
    if (!preset.params) {
      return { success: false, error: '配置文件缺少 params 字段' };
    }

    // 验证 params 包含必要的参数
    const requiredKeys = ['delta_0', 'delta_01', 'delta_ret', 'delta_02', 'h', 'r_0', 'e', 'omega', 'r_r', 'n_points', 'alpha_threshold', 'tc_law', 'hc_law', 'sn', 'pz'];
    for (const key of requiredKeys) {
      if (!(key in preset.params)) {
        return { success: false, error: `配置文件缺少必要参数: ${key}` };
      }
    }

    // 应用参数
    setParams(preset.params);

    // 如果有显示选项，也应用
    if (preset.displayOptions) {
      setDisplayOptions(preset.displayOptions);
    }

    setParamsChanged(true);
    setParamsUpdated(true);
    runSimulation();
    return { success: true };
  } catch (e) {
    return { success: false, error: `JSON 解析失败: ${e}` };
  }
}

// 参数校验
export function validateParams(p: CamParams): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 四角之和必须等于 360°
  const sum = p.delta_0 + p.delta_01 + p.delta_ret + p.delta_02;
  if (Math.abs(sum - 360) > 0.01) {
    errors.push(`四角之和必须等于 360°（当前: ${sum}°）`);
  }

  // 基圆半径必须大于偏距
  if (p.r_0 <= Math.abs(p.e)) {
    errors.push('基圆半径必须大于偏距的绝对值');
  }

  // 行程必须为正
  if (p.h <= 0) {
    errors.push('行程必须为正数');
  }

  // 角速度必须为正
  if (p.omega <= 0) {
    errors.push('角速度必须为正数');
  }

  // 离散点数范围验证
  if (p.n_points < 36) {
    errors.push('离散点数不能小于 36');
  }
  if (p.n_points > 720) {
    errors.push('离散点数不能大于 720');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 获取当前参数校验错误（响应式）
export function validationErrors(): string[] {
  return validateParams(params()).errors;
}

// 获取哪些参数有校验错误（响应式，用于输入框高亮）
export function invalidParams(): Set<keyof CamParams> {
  const p = params();
  const invalid = new Set<keyof CamParams>();

  const sum = p.delta_0 + p.delta_01 + p.delta_ret + p.delta_02;
  if (Math.abs(sum - 360) > 0.01) {
    invalid.add('delta_0');
    invalid.add('delta_01');
    invalid.add('delta_ret');
    invalid.add('delta_02');
  }

  if (p.r_0 <= Math.abs(p.e)) {
    invalid.add('r_0');
    invalid.add('e');
  }

  if (p.h <= 0) {
    invalid.add('h');
  }

  if (p.omega <= 0) {
    invalid.add('omega');
  }

  if (p.n_points < 36 || p.n_points > 720) {
    invalid.add('n_points');
  }

  return invalid;
}

// 随机生成可运行的参数（仅运动参数和几何参数，仿真设置保持不变）
export function randomizeParams(): CamParams {
  const currentParams = params();

  // 随机生成四角（确保和为360°且每个角至少15°）
  const minAngle = 15;

  let delta_0 = Math.floor(Math.random() * 100) + minAngle; // 15-115
  let delta_01 = Math.floor(Math.random() * 80) + minAngle; // 15-95
  let delta_ret = Math.floor(Math.random() * 100) + minAngle; // 15-115

  let delta_02 = 360 - delta_0 - delta_01 - delta_ret;

  if (delta_02 < minAngle) {
    const excess = minAngle - delta_02;
    delta_0 = Math.max(minAngle, delta_0 - Math.ceil(excess / 3));
    delta_01 = Math.max(minAngle, delta_01 - Math.ceil(excess / 3));
    delta_ret = Math.max(minAngle, delta_ret - Math.ceil(excess / 3));
    delta_02 = 360 - delta_0 - delta_01 - delta_ret;
  }

  // 随机几何参数
  const e = Math.round((Math.random() * 16 - 8) * 10) / 10; // -8 到 8
  const r_0 = Math.floor(Math.random() * 30) + Math.abs(e) + 25;
  const h = Math.round((Math.random() * 15 + 5) * 10) / 10; // 5-20
  const r_r = Math.round((Math.random() * 5 + 3) * 10) / 10; // 3-8

  // 随机运动规律 (1-6)
  const tc_law = Math.floor(Math.random() * 6) + 1;
  const hc_law = Math.floor(Math.random() * 6) + 1;

  // 随机旋向和偏距方向
  const sn = Math.random() > 0.5 ? 1 : -1;
  const pz = Math.random() > 0.5 ? 1 : -1;

  const newParams: CamParams = {
    delta_0,
    delta_01,
    delta_ret,
    delta_02,
    h,
    r_0,
    e,
    omega: currentParams.omega, // 保持不变
    r_r,
    n_points: currentParams.n_points, // 保持不变
    alpha_threshold: currentParams.alpha_threshold, // 保持不变
    tc_law,
    hc_law,
    sn,
    pz,
  };

  setParams(newParams);
  setParamsChanged(true);
  setParamsUpdated(true);
  runSimulation();
  return newParams;
}
