// 图表绘制工具函数
// 用于演示界面和导出功能共用

import type { SimulationData } from '../types';
import type { CamParams, DisplayOptions } from '../types';
import { DATA_RANGE_MARGIN, PERCENTILE_CLIP_LOW, PERCENTILE_CLIP_HIGH, PERCENTILE_CLIP_MID_LOW, PERCENTILE_CLIP_MID_HIGH, EPSILON } from '../constants/numeric';

export interface ChartDrawOptions {
  width: number;
  height: number;
  isDark: boolean;
  lang: string;
  dpi?: number;
}

export interface AnimationFrameOptions {
  width: number;
  height: number;
  frameIndex: number;
  displayOptions: DisplayOptions;
  zoom: number;
}

// 默认 DPI（屏幕显示）
const DEFAULT_DPI = 100;

// DPI 上限保护
const MAX_DPI = 600;
const MAX_DIMENSION = 10000;

export function sanitizeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * 验证图表数据有效性
 *
 * @param data - 模拟数据
 * @returns 数据是否有效
 */
export function validateChartData(data: SimulationData | null | undefined): boolean {
  if (!data) return false;
  if (!data.s?.length || !data.v?.length || !data.a?.length) return false;
  if (!data.delta_deg?.length) return false;
  if (data.s.length !== data.v.length || data.s.length !== data.a.length) return false;
  return true;
}

/**
 * 验证并规范化绘图选项
 *
 * @param options - 绘图选项
 * @returns 规范化后的选项
 */
export function normalizeChartOptions(options: ChartDrawOptions): ChartDrawOptions {
  const dpi = Math.min(options.dpi || DEFAULT_DPI, MAX_DPI);
  const width = Math.min(Math.max(options.width, 1), MAX_DIMENSION);
  const height = Math.min(Math.max(options.height, 1), MAX_DIMENSION);
  return { ...options, dpi, width, height };
}

/**
 * 验证动画帧选项
 *
 * @param options - 动画帧选项
 * @param dataLength - 数据数组长度
 * @returns 选项是否有效
 */
export function validateAnimationFrameOptions(
  options: AnimationFrameOptions,
  dataLength: number
): boolean {
  if (options.width <= 0 || options.height <= 0) return false;
  if (options.frameIndex < 0 || options.frameIndex >= dataLength) return false;
  if (options.zoom <= 0) return false;
  return true;
}

// 计算 DPI 缩放因子
function getScaleFactor(dpi: number): number {
  return dpi / DEFAULT_DPI;
}

// 绘制运动曲线图（三Y轴：位移、速度、加速度）
export function drawMotionCurves(
  ctx: CanvasRenderingContext2D,
  data: SimulationData,
  options: ChartDrawOptions
): void {
  // 输入验证
  if (!validateChartData(data)) {
    console.warn('Invalid simulation data for motion curves');
    return;
  }

  const normalizedOptions = normalizeChartOptions(options);
  const { width, height, isDark, lang, dpi = DEFAULT_DPI } = normalizedOptions;
  const { delta_deg, s, v, a, phase_bounds, h } = data;

  // DPI 缩放因子
  const scale = getScaleFactor(dpi);

  // 根据 DPI 缩放 padding（增加顶部空间给标题）
  const padding = {
    top: Math.round(55 * scale),
    right: Math.round(130 * scale),
    bottom: Math.round(55 * scale),
    left: Math.round(70 * scale)
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 背景
  ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 标题
  ctx.fillStyle = isDark ? '#FFF' : '#333';
  ctx.font = `bold ${Math.round(14 * scale)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '推杆运动线图' : 'Follower Motion Curves', width / 2, Math.round(25 * scale));

  // 网格线（点线）
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = Math.round(0.5 * scale);
  ctx.setLineDash([Math.round(2 * scale), Math.round(2 * scale)]);

  // 垂直网格线（每30°）
  for (let x = 0; x <= 360; x += 30) {
    const px = padding.left + (x / 360) * chartWidth;
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, height - padding.bottom);
    ctx.stroke();
  }

  // 水平网格线（更密集）
  for (let i = 0; i <= 10; i++) {
    const py = padding.top + (i / 10) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, py);
    ctx.lineTo(width - padding.right, py);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 相位分界线（灰色虚线）
  ctx.strokeStyle = isDark ? '#666' : '#999';
  ctx.lineWidth = Math.round(0.8 * scale);
  ctx.setLineDash([Math.round(4 * scale), Math.round(4 * scale)]);
  for (const bound of phase_bounds.slice(1, -1)) {
    const px = padding.left + (bound / 360) * chartWidth;
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, height - padding.bottom);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 计算各轴范围
  const sMax = h * DATA_RANGE_MARGIN;
  const vMax = Math.max(...v.map(Math.abs)) * DATA_RANGE_MARGIN || 1;
  const aMax = Math.max(...a.map(Math.abs)) * DATA_RANGE_MARGIN || 1;

  // 绘制曲线的通用函数
  const drawCurve = (
    yData: number[],
    color: string,
    yMin: number,
    yMax: number,
    lineStyle: 'solid' | 'dashed' | 'dashdot' = 'solid'
  ) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.round(1.5 * scale);

    if (lineStyle === 'dashed') {
      ctx.setLineDash([Math.round(6 * scale), Math.round(4 * scale)]);
    } else if (lineStyle === 'dashdot') {
      ctx.setLineDash([Math.round(8 * scale), Math.round(4 * scale), Math.round(2 * scale), Math.round(4 * scale)]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    for (let i = 0; i < yData.length; i++) {
      const yVal = yData[i];
      if (!Number.isFinite(yVal)) continue;
      const px = padding.left + (delta_deg[i] / 360) * chartWidth;
      const py = padding.top + (1 - (yVal - yMin) / (yMax - yMin)) * chartHeight;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // 绘制三条曲线
  drawCurve(s, '#DC2626', 0, sMax, 'solid');           // 位移：红色实线
  drawCurve(v, '#2563EB', -vMax, vMax, 'dashed');      // 速度：蓝色虚线
  drawCurve(a, '#16A34A', -aMax, aMax, 'dashdot');     // 加速度：绿色点划线

  // 绘制坐标轴边框
  ctx.strokeStyle = isDark ? '#555' : '#333';
  ctx.lineWidth = Math.round(1 * scale);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // 右侧Y轴1 - 速度v（蓝色）
  const vAxisX = width - padding.right;
  ctx.strokeStyle = '#2563EB';
  ctx.lineWidth = Math.round(1 * scale);
  ctx.beginPath();
  ctx.moveTo(vAxisX, padding.top);
  ctx.lineTo(vAxisX, height - padding.bottom);
  ctx.stroke();

  // 右侧Y轴2 - 加速度a（绿色，向外偏移）
  const aAxisX = width - padding.right + Math.round(60 * scale);
  ctx.strokeStyle = '#16A34A';
  ctx.lineWidth = Math.round(1 * scale);
  ctx.beginPath();
  ctx.moveTo(aAxisX, padding.top);
  ctx.lineTo(aAxisX, height - padding.bottom);
  ctx.stroke();

  // X轴标签和刻度
  ctx.fillStyle = isDark ? '#CCC' : '#333';
  ctx.font = `${Math.round(10 * scale)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '转角 δ (°)' : 'Angle δ (°)', padding.left + chartWidth / 2, height - Math.round(10 * scale));

  ctx.textAlign = 'center';
  for (let x = 0; x <= 360; x += 30) {
    const px = padding.left + (x / 360) * chartWidth;
    ctx.fillText(String(x), px, height - padding.bottom + Math.round(15 * scale));
  }

  // 左侧Y轴 - 位移s（红色）
  ctx.fillStyle = '#DC2626';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(Math.round(16 * scale), padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(lang === 'zh' ? '位移 s (mm)' : 'Displacement s (mm)', 0, 0);
  ctx.restore();

  ctx.textAlign = 'right';
  ctx.font = `${Math.round(9 * scale)}px -apple-system, sans-serif`;
  // s轴刻度（5个）
  for (let i = 0; i <= 4; i++) {
    const val = (sMax * i / 4).toFixed(1);
    const py = padding.top + (1 - i / 4) * chartHeight;
    ctx.fillText(val, padding.left - Math.round(5 * scale), py + Math.round(3 * scale));
  }

  // 右侧Y轴1 - 速度v（蓝色）
  ctx.fillStyle = '#2563EB';
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(10 * scale)}px -apple-system, sans-serif`;
  ctx.save();
  ctx.translate(vAxisX + Math.round(22 * scale), padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(lang === 'zh' ? '速度 v (mm/s)' : 'Velocity v (mm/s)', 0, 0);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.font = `${Math.round(9 * scale)}px -apple-system, sans-serif`;
  // v轴刻度（5个）
  for (let i = 0; i <= 4; i++) {
    const val = (vMax * (2 - i) / 2);
    const py = padding.top + (i / 4) * chartHeight;
    ctx.fillText(val.toFixed(1), vAxisX + Math.round(4 * scale), py + Math.round(3 * scale));
  }

  // 右侧Y轴2 - 加速度a（绿色）
  ctx.fillStyle = '#16A34A';
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(10 * scale)}px -apple-system, sans-serif`;
  ctx.save();
  ctx.translate(aAxisX + Math.round(22 * scale), padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(lang === 'zh' ? '加速度 a (mm/s²)' : 'Acceleration a (mm/s²)', 0, 0);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.font = `${Math.round(9 * scale)}px -apple-system, sans-serif`;
  // a轴刻度（5个）
  for (let i = 0; i <= 4; i++) {
    const val = (aMax * (2 - i) / 2);
    const py = padding.top + (i / 4) * chartHeight;
    ctx.fillText(val.toFixed(1), aAxisX + Math.round(4 * scale), py + Math.round(3 * scale));
  }

  // 图例（三行，右上角）
  const legendX = width - padding.right - Math.round(100 * scale);
  let legendY = padding.top + Math.round(12 * scale);
  ctx.font = `${Math.round(9 * scale)}px -apple-system, sans-serif`;

  // 位移图例
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = Math.round(1.5 * scale);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + Math.round(20 * scale), legendY);
  ctx.stroke();
  ctx.fillStyle = isDark ? '#FFF' : '#333';
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'zh' ? '位移 s' : 'Displacement s', legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));

  // 速度图例
  legendY += Math.round(16 * scale);
  ctx.strokeStyle = '#2563EB';
  ctx.setLineDash([Math.round(6 * scale), Math.round(4 * scale)]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + Math.round(20 * scale), legendY);
  ctx.stroke();
  ctx.fillText(lang === 'zh' ? '速度 v' : 'Velocity v', legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));

  // 加速度图例
  legendY += Math.round(16 * scale);
  ctx.strokeStyle = '#16A34A';
  ctx.setLineDash([Math.round(8 * scale), Math.round(4 * scale), Math.round(2 * scale), Math.round(4 * scale)]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + Math.round(20 * scale), legendY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText(lang === 'zh' ? '加速度 a' : 'Acceleration a', legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));
}

// 绘制压力角图
export function drawPressureAngleChart(
  ctx: CanvasRenderingContext2D,
  data: SimulationData,
  params: CamParams,
  options: ChartDrawOptions
): void {
  // 输入验证
  if (!validateChartData(data)) {
    console.warn('Invalid simulation data for pressure angle chart');
    return;
  }

  const normalizedOptions = normalizeChartOptions(options);
  const { width, height, isDark, lang, dpi = DEFAULT_DPI } = normalizedOptions;
  const { delta_deg, alpha_all, phase_bounds } = data;

  // DPI 缩放因子
  const scale = getScaleFactor(dpi);

  // 根据 DPI 缩放 padding（增加顶部空间给标题）
  const padding = {
    top: Math.round(55 * scale),
    right: Math.round(70 * scale),
    bottom: Math.round(55 * scale),
    left: Math.round(70 * scale)
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 背景
  ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 标题
  ctx.fillStyle = isDark ? '#FFF' : '#333';
  ctx.font = `bold ${Math.round(14 * scale)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '压力角曲线' : 'Pressure Angle Curve', width / 2, Math.round(25 * scale));

  // 网格线（点线）
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = Math.round(0.5 * scale);
  ctx.setLineDash([Math.round(2 * scale), Math.round(2 * scale)]);

  // 垂直网格线（每30°）
  for (let x = 0; x <= 360; x += 30) {
    const px = padding.left + (x / 360) * chartWidth;
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, height - padding.bottom);
    ctx.stroke();
  }

  // 水平网格线（更密集）
  for (let i = 0; i <= 10; i++) {
    const py = padding.top + (i / 10) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, py);
    ctx.lineTo(width - padding.right, py);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 相位分界线
  ctx.strokeStyle = isDark ? '#666' : '#999';
  ctx.lineWidth = Math.round(0.8 * scale);
  ctx.setLineDash([Math.round(4 * scale), Math.round(4 * scale)]);
  for (const bound of phase_bounds.slice(1, -1)) {
    const px = padding.left + (bound / 360) * chartWidth;
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, height - padding.bottom);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 压力角范围
  const threshold = params.alpha_threshold;
  const alphaMax = Math.max(...alpha_all.map(Math.abs), threshold) * DATA_RANGE_MARGIN;

  // 压力角阈值线（橙色虚线）
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = Math.round(1 * scale);
  ctx.setLineDash([Math.round(4 * scale), Math.round(4 * scale)]);
  const thresholdY1 = padding.top + (1 - threshold / alphaMax) * chartHeight;
  ctx.beginPath();
  ctx.moveTo(padding.left, thresholdY1);
  ctx.lineTo(width - padding.right, thresholdY1);
  ctx.stroke();
  ctx.setLineDash([]);

  // 压力角曲线（红色实线）
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = Math.round(1.5 * scale);
  ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i < alpha_all.length; i++) {
    const px = padding.left + (delta_deg[i] / 360) * chartWidth;
    const py = padding.top + (1 - alpha_all[i] / alphaMax) * chartHeight;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // 标记超限点
  ctx.fillStyle = '#EF4444';
  for (let i = 0; i < alpha_all.length; i++) {
    if (Math.abs(alpha_all[i]) > threshold) {
      const px = padding.left + (delta_deg[i] / 360) * chartWidth;
      const py = padding.top + (1 - alpha_all[i] / alphaMax) * chartHeight;
      ctx.beginPath();
      ctx.arc(px, py, Math.round(2 * scale), 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // 绘制坐标轴边框
  ctx.strokeStyle = isDark ? '#555' : '#333';
  ctx.lineWidth = Math.round(1 * scale);
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // X轴标签
  ctx.fillStyle = isDark ? '#CCC' : '#333';
  ctx.font = `${Math.round(10 * scale)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '转角 δ (°)' : 'Angle δ (°)', padding.left + chartWidth / 2, height - Math.round(10 * scale));

  ctx.textAlign = 'center';
  for (let x = 0; x <= 360; x += 30) {
    const px = padding.left + (x / 360) * chartWidth;
    ctx.fillText(String(x), px, height - padding.bottom + Math.round(15 * scale));
  }

  // 左侧Y轴 - 压力角α（红色）
  ctx.fillStyle = '#DC2626';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(Math.round(16 * scale), padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(lang === 'zh' ? '压力角 α (°)' : 'Pressure Angle α (°)', 0, 0);
  ctx.restore();

  ctx.textAlign = 'right';
  ctx.font = `${Math.round(9 * scale)}px -apple-system, sans-serif`;
  // α轴刻度（5个）
  for (let i = 0; i <= 4; i++) {
    const val = (alphaMax * (2 - i) / 2);
    const py = padding.top + (i / 4) * chartHeight;
    ctx.fillText(val.toFixed(0), padding.left - Math.round(5 * scale), py + Math.round(3 * scale));
  }

  // 图例（两行）
  const legendX = padding.left + Math.round(10 * scale);
  let legendY = padding.top + Math.round(12 * scale);
  ctx.font = `${Math.round(9 * scale)}px -apple-system, sans-serif`;

  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = Math.round(1.5 * scale);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + Math.round(20 * scale), legendY);
  ctx.stroke();
  ctx.fillStyle = isDark ? '#FFF' : '#333';
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'zh' ? '压力角 α' : 'Pressure Angle α', legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));

  legendY += Math.round(16 * scale);
  ctx.strokeStyle = '#F59E0B';
  ctx.setLineDash([Math.round(4 * scale), Math.round(4 * scale)]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + Math.round(20 * scale), legendY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText(`${lang === 'zh' ? '阈值' : 'Threshold'} ${threshold}°`, legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));
}

// 绘制曲率半径图
export function drawCurvatureChart(
  ctx: CanvasRenderingContext2D,
  data: SimulationData,
  params: CamParams,
  options: ChartDrawOptions
): void {
  // 输入验证
  if (!validateChartData(data)) {
    console.warn('Invalid simulation data for curvature chart');
    return;
  }

  const normalizedOptions = normalizeChartOptions(options);
  const { width, height, isDark, lang, dpi = DEFAULT_DPI } = normalizedOptions;
  const { delta_deg, rho, rho_actual, phase_bounds, min_rho, min_rho_idx, min_rho_actual, min_rho_actual_idx } = data;

  // DPI 缩放因子
  const scale = getScaleFactor(dpi);

  // 根据 DPI 缩放 padding（增加顶部空间给标题）
  const padding = {
    top: Math.round(55 * scale),
    right: Math.round(70 * scale),
    bottom: Math.round(55 * scale),
    left: Math.round(70 * scale)
  };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 背景
  ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 标题
  ctx.fillStyle = isDark ? '#FFF' : '#333';
  ctx.font = `bold ${Math.round(14 * scale)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '曲率半径曲线' : 'Curvature Radius Curve', width / 2, Math.round(25 * scale));

  // 网格线（点线）
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  ctx.lineWidth = Math.round(0.5 * scale);
  ctx.setLineDash([Math.round(2 * scale), Math.round(2 * scale)]);

  // 垂直网格线（每30°）
  for (let x = 0; x <= 360; x += 30) {
    const px = padding.left + (x / 360) * chartWidth;
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, height - padding.bottom);
    ctx.stroke();
  }

  // 水平网格线（更密集）
  for (let i = 0; i <= 10; i++) {
    const py = padding.top + (i / 10) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, py);
    ctx.lineTo(width - padding.right, py);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 相位分界线
  ctx.strokeStyle = isDark ? '#666' : '#999';
  ctx.lineWidth = Math.round(0.8 * scale);
  ctx.setLineDash([Math.round(4 * scale), Math.round(4 * scale)]);
  for (const bound of phase_bounds.slice(1, -1)) {
    const px = padding.left + (bound / 360) * chartWidth;
    ctx.beginPath();
    ctx.moveTo(px, padding.top);
    ctx.lineTo(px, height - padding.bottom);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // 过滤有限值计算范围（合并理论轮廓和实际轮廓）
  const rhoFinite = rho.filter(r => isFinite(r) && !isNaN(r));
  const rhoActualFinite = rho_actual ? rho_actual.filter(r => isFinite(r) && !isNaN(r)) : [];
  const allRhoFinite = [...rhoFinite, ...rhoActualFinite];

  if (allRhoFinite.length === 0) {
    ctx.fillStyle = isDark ? '#FFF' : '#000';
    ctx.font = `${Math.round(12 * scale)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(lang === 'zh' ? '无有效曲率数据' : 'No valid curvature data', width / 2, height / 2);
    return;
  }

  // 使用百分位数来避免极端值影响显示
  const rhoSorted = [...allRhoFinite].sort((a, b) => a - b);
  const p5Idx = Math.floor(rhoSorted.length * PERCENTILE_CLIP_LOW);
  const p95Idx = Math.floor(rhoSorted.length * PERCENTILE_CLIP_HIGH);
  const p5 = rhoSorted[p5Idx];
  const p95 = rhoSorted[p95Idx];

  let rhoMin: number, rhoMax: number;
  const range = p95 - p5;

  const p10 = rhoSorted[Math.floor(rhoSorted.length * PERCENTILE_CLIP_MID_LOW)];
  const p90 = rhoSorted[Math.floor(rhoSorted.length * PERCENTILE_CLIP_MID_HIGH)];
  if (range > 10 * (p90 - p10 + 1)) {
    rhoMin = p5 - range * 0.1;
    rhoMax = p95 + range * 0.1;
  } else {
    rhoMin = Math.min(...allRhoFinite) * 0.9;
    rhoMax = Math.max(...allRhoFinite) * 1.1;
    if (rhoMin > 0) rhoMin = Math.min(...allRhoFinite) * 0.9;
    else rhoMin = Math.min(...allRhoFinite) - 1;
    if (rhoMax < 0) rhoMax = Math.max(...allRhoFinite) + 1;
  }

  const yRange = rhoMax - rhoMin;

  // 滚子半径阈值线（如果存在滚子）
  const r_r = params.r_r;
  if (r_r > 0) {
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = Math.round(1 * scale);
    ctx.setLineDash([Math.round(4 * scale), Math.round(4 * scale)]);
    const thresholdRho = r_r;
    const thresholdY = padding.top + (1 - (thresholdRho - rhoMin) / yRange) * chartHeight;
    if (thresholdY >= padding.top && thresholdY <= height - padding.bottom) {
      ctx.beginPath();
      ctx.moveTo(padding.left, thresholdY);
      ctx.lineTo(width - padding.right, thresholdY);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // 绘制理论轮廓曲率半径曲线（红色实线）
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = Math.round(1.5 * scale);
  ctx.setLineDash([]);
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < rho.length; i++) {
    if (!isFinite(rho[i]) || isNaN(rho[i])) continue;
    const px = padding.left + (delta_deg[i] / 360) * chartWidth;
    const py = padding.top + (1 - (rho[i] - rhoMin) / yRange) * chartHeight;
    if (!started) {
      ctx.moveTo(px, py);
      started = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();

  // 绘制实际轮廓曲率半径曲线（蓝色虚线，仅滚子从动件）
  if (r_r > 0 && rho_actual) {
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = Math.round(1.5 * scale);
    ctx.setLineDash([Math.round(4 * scale), Math.round(2 * scale)]);
    ctx.beginPath();
    started = false;
    for (let i = 0; i < rho_actual.length; i++) {
      if (!isFinite(rho_actual[i]) || isNaN(rho_actual[i])) continue;
      const px = padding.left + (delta_deg[i] / 360) * chartWidth;
      const py = padding.top + (1 - (rho_actual[i] - rhoMin) / yRange) * chartHeight;
      if (!started) {
        ctx.moveTo(px, py);
        started = true;
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 标记理论轮廓最小曲率半径点
  if (min_rho !== null && min_rho_idx >= 0 && min_rho_idx < rho.length) {
    const idx = min_rho_idx;
    if (isFinite(rho[idx])) {
      const px = padding.left + (delta_deg[idx] / 360) * chartWidth;
      const py = padding.top + (1 - (rho[idx] - rhoMin) / yRange) * chartHeight;
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.arc(px, py, Math.round(4 * scale), 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // 标记实际轮廓最小曲率半径点（仅滚子从动件）
  if (r_r > 0 && min_rho_actual !== null && min_rho_actual_idx >= 0 && min_rho_actual_idx < rho_actual.length) {
    const idx = min_rho_actual_idx;
    if (isFinite(rho_actual[idx])) {
      const px = padding.left + (delta_deg[idx] / 360) * chartWidth;
      const py = padding.top + (1 - (rho_actual[idx] - rhoMin) / yRange) * chartHeight;
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(px, py, Math.round(4 * scale), 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // 绘制坐标轴边框
  ctx.strokeStyle = isDark ? '#555' : '#333';
  ctx.lineWidth = Math.round(1 * scale);
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // X轴标签
  ctx.fillStyle = isDark ? '#CCC' : '#333';
  ctx.font = `${Math.round(10 * scale)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '转角 δ (°)' : 'Angle δ (°)', padding.left + chartWidth / 2, height - Math.round(10 * scale));

  ctx.textAlign = 'center';
  for (let x = 0; x <= 360; x += 30) {
    const px = padding.left + (x / 360) * chartWidth;
    ctx.fillText(String(x), px, height - padding.bottom + Math.round(15 * scale));
  }

  // 左侧Y轴 - 曲率半径ρ
  ctx.fillStyle = '#DC2626';
  ctx.textAlign = 'center';
  ctx.save();
  ctx.translate(Math.round(16 * scale), padding.top + chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(lang === 'zh' ? '曲率半径 ρ (mm)' : 'Curvature Radius ρ (mm)', 0, 0);
  ctx.restore();

  ctx.textAlign = 'right';
  ctx.font = `${Math.round(9 * scale)}px -apple-system, sans-serif`;
  // ρ轴刻度（5个）
  for (let i = 0; i <= 4; i++) {
    const val = rhoMin + (rhoMax - rhoMin) * (1 - i / 4);
    const py = padding.top + (i / 4) * chartHeight;
    ctx.fillText(val.toFixed(1), padding.left - Math.round(5 * scale), py + Math.round(3 * scale));
  }

  // 图例
  const legendX = padding.left + Math.round(10 * scale);
  let legendY = padding.top + Math.round(12 * scale);
  ctx.font = `${Math.round(9 * scale)}px -apple-system, sans-serif`;

  // 理论轮廓曲率半径
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = Math.round(1.5 * scale);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + Math.round(20 * scale), legendY);
  ctx.stroke();
  ctx.fillStyle = isDark ? '#FFF' : '#333';
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'zh' ? '理论轮廓 ρ' : 'Theory ρ', legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));

  // 实际轮廓曲率半径（仅滚子从动件）
  if (r_r > 0) {
    legendY += Math.round(14 * scale);
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = Math.round(1.5 * scale);
    ctx.setLineDash([Math.round(4 * scale), Math.round(2 * scale)]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + Math.round(20 * scale), legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.fillText(lang === 'zh' ? '实际轮廓 ρₐ' : 'Actual ρₐ', legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));
  }

  // 显示理论轮廓最小曲率半径值
  if (min_rho !== null) {
    legendY += Math.round(16 * scale);
    ctx.fillStyle = '#16A34A';
    ctx.beginPath();
    ctx.arc(legendX + Math.round(10 * scale), legendY, Math.round(4 * scale), 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    // ρ_min 中 min 为下标
    const baseFontSize = Math.round(11 * scale);
    const subFontSize = Math.round(8 * scale);
    ctx.font = `${baseFontSize}px sans-serif`;
    ctx.fillText('ρ', legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));
    const rhoWidth = ctx.measureText('ρ').width;
    ctx.font = `${subFontSize}px sans-serif`;
    ctx.fillText('min', legendX + Math.round(25 * scale) + rhoWidth, legendY + Math.round(6 * scale));
    ctx.font = `${baseFontSize}px sans-serif`;
    const minWidth = ctx.measureText('min').width;
    ctx.fillText(` = ${min_rho.toFixed(2)} mm`, legendX + Math.round(25 * scale) + rhoWidth + minWidth, legendY + Math.round(4 * scale));
  }

  // 显示实际轮廓最小曲率半径值（仅滚子从动件）
  if (r_r > 0 && min_rho_actual !== null) {
    legendY += Math.round(16 * scale);
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(legendX + Math.round(10 * scale), legendY, Math.round(4 * scale), 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    const baseFontSize = Math.round(11 * scale);
    const subFontSize = Math.round(8 * scale);
    ctx.font = `${baseFontSize}px sans-serif`;
    ctx.fillText('ρ', legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));
    const rhoWidth = ctx.measureText('ρ').width;
    ctx.font = `${subFontSize}px sans-serif`;
    ctx.fillText('a,min', legendX + Math.round(25 * scale) + rhoWidth, legendY + Math.round(6 * scale));
    ctx.font = `${baseFontSize}px sans-serif`;
    const minWidth = ctx.measureText('a,min').width;
    ctx.fillText(` = ${min_rho_actual.toFixed(2)} mm`, legendX + Math.round(25 * scale) + rhoWidth + minWidth, legendY + Math.round(4 * scale));
  }

  // 滚子半径阈值
  if (r_r > 0) {
    legendY += Math.round(16 * scale);
    ctx.strokeStyle = '#06B6D4';
    ctx.setLineDash([Math.round(4 * scale), Math.round(4 * scale)]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + Math.round(20 * scale), legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.fillText(`${lang === 'zh' ? '阈值' : 'Threshold'} ${r_r} mm`, legendX + Math.round(25 * scale), legendY + Math.round(4 * scale));
  }
}

// 绘制凸轮廓形图
export function drawCamProfileChart(
  ctx: CanvasRenderingContext2D,
  data: SimulationData,
  params: CamParams,
  options: ChartDrawOptions
): void {
  // 输入验证
  if (!validateChartData(data)) {
    console.warn('Invalid simulation data for cam profile chart');
    return;
  }

  const normalizedOptions = normalizeChartOptions(options);
  const { width, height, isDark, lang, dpi = DEFAULT_DPI } = normalizedOptions;
  const { x, y, x_actual, y_actual, r_max } = data;

  // DPI 缩放因子
  const dpiScale = getScaleFactor(dpi);

  // 背景
  ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  const drawScale = Math.min(width, height) / (2 * r_max * 1.3);

  // 基圆
  ctx.strokeStyle = isDark ? '#666' : '#999';
  ctx.lineWidth = Math.round(1 * dpiScale);
  ctx.setLineDash([Math.round(5 * dpiScale), Math.round(5 * dpiScale)]);
  ctx.beginPath();
  ctx.arc(centerX, centerY, params.r_0 * drawScale, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  // 偏距圆
  if (Math.abs(params.e) > 0.01) {
    ctx.strokeStyle = isDark ? '#555' : '#BBB';
    ctx.lineWidth = Math.round(1 * dpiScale);
    ctx.setLineDash([Math.round(3 * dpiScale), Math.round(3 * dpiScale)]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.abs(params.e) * drawScale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 理论廓形
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = Math.round(2 * dpiScale);
  ctx.beginPath();
  let profileStarted = false;
  for (let i = 0; i < x.length; i++) {
    if (!Number.isFinite(x[i]) || !Number.isFinite(y[i])) continue;
    const px = centerX + x[i] * drawScale;
    const py = centerY - y[i] * drawScale;
    if (!profileStarted) { ctx.moveTo(px, py); profileStarted = true; }
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // 实际廓形（如果有滚子）
  if (params.r_r > 0 && x_actual.length > 0) {
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = Math.round(2 * dpiScale);
    ctx.beginPath();
    profileStarted = false;
    for (let i = 0; i < x_actual.length; i++) {
      if (!Number.isFinite(x_actual[i]) || !Number.isFinite(y_actual[i])) continue;
      const px = centerX + x_actual[i] * drawScale;
      const py = centerY - y_actual[i] * drawScale;
      if (!profileStarted) { ctx.moveTo(px, py); profileStarted = true; }
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // 图例
  const legendX = Math.round(20 * dpiScale);
  let legendY = Math.round(30 * dpiScale);
  ctx.font = `${Math.round(12 * dpiScale)}px -apple-system, sans-serif`;

  // 理论廓形
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = Math.round(2 * dpiScale);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + Math.round(30 * dpiScale), legendY);
  ctx.stroke();
  ctx.fillStyle = isDark ? '#FFF' : '#333';
  ctx.textAlign = 'left';
  ctx.fillText(lang === 'zh' ? '理论廓形' : 'Theory Profile', legendX + Math.round(40 * dpiScale), legendY + Math.round(4 * dpiScale));

  // 实际廓形
  if (params.r_r > 0) {
    legendY += Math.round(20 * dpiScale);
    ctx.strokeStyle = '#2563EB';
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + Math.round(30 * dpiScale), legendY);
    ctx.stroke();
    ctx.fillText(lang === 'zh' ? '实际廓形' : 'Actual Profile', legendX + Math.round(40 * dpiScale), legendY + Math.round(4 * dpiScale));
  }

  // 基圆
  legendY += Math.round(20 * dpiScale);
  ctx.strokeStyle = isDark ? '#666' : '#999';
  ctx.setLineDash([Math.round(5 * dpiScale), Math.round(5 * dpiScale)]);
  ctx.beginPath();
  ctx.moveTo(legendX, legendY);
  ctx.lineTo(legendX + Math.round(30 * dpiScale), legendY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText(lang === 'zh' ? '基圆' : 'Base Circle', legendX + Math.round(40 * dpiScale), legendY + Math.round(4 * dpiScale));

  // 标题
  ctx.fillStyle = isDark ? '#FFF' : '#333';
  ctx.font = `${Math.round(14 * dpiScale)}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '凸轮廓形' : 'Cam Profile', width / 2, Math.round(25 * dpiScale));
}

// 绘制动画单帧（用于 GIF 导出）
export function drawAnimationFrame(
  ctx: CanvasRenderingContext2D,
  data: SimulationData,
  params: CamParams,
  options: AnimationFrameOptions
): void {
  // 输入验证
  if (!validateChartData(data)) {
    console.warn('Invalid simulation data for animation frame');
    return;
  }
  if (!validateAnimationFrameOptions(options, data.s.length)) {
    console.warn('Invalid animation frame options');
    return;
  }

  const { width, height, frameIndex, displayOptions, zoom } = options;
  const { s, x, y, x_actual, y_actual, s_0, alpha_all, ds_ddelta, r_max, phase_bounds } = data;
  const n = s.length;
  const sn = params.sn;
  const pz = params.pz;
  const e = params.e;
  const r_r = params.r_r;
  const r_0 = params.r_0;
  const h = params.h;

  // 背景
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // 计算中心和缩放
  const margin = r_max * 0.15;
  const size = 2 * (r_max + margin);
  const centerX = width / 2;
  const centerY = height / 2;
  const scale = Math.min(width, height) / size * zoom;

  // 绘制网格背景（与演示界面 .drafting-grid 一致）
  const gridMinor = 10 * scale;
  const gridMajor = 50 * scale;

  // 合并所有网格线为单次 stroke
  ctx.beginPath();
  // 小网格线
  ctx.strokeStyle = '#CAC4C5';
  ctx.lineWidth = 0.5;
  for (let gx = centerX % gridMinor; gx < width; gx += gridMinor) {
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
  }
  for (let gy = centerY % gridMinor; gy < height; gy += gridMinor) {
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
  }
  ctx.stroke();

  // 大网格线
  ctx.strokeStyle = '#7B7576';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let gx = centerX % gridMajor; gx < width; gx += gridMajor) {
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
  }
  for (let gy = centerY % gridMajor; gy < height; gy += gridMajor) {
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
  }
  ctx.stroke();

  // 坐标轴和刻度（与演示界面 showCenterLine 一致）
  if (displayOptions.showCenterLine) {
    const tickSpacing = 10 * scale;
    const nTicks = Math.floor(r_max * zoom / 10);

    // X/Y 坐标轴
    ctx.strokeStyle = '#7B7576';
    ctx.lineWidth = 0.6 * scale;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    // 原点标记
    ctx.fillStyle = '#7B7576';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 1.5 * scale, 0, 2 * Math.PI);
    ctx.fill();

    // 刻度线 — 合并为单次 stroke
    ctx.strokeStyle = '#CAC4C5';
    ctx.lineWidth = 0.4 * scale;
    ctx.beginPath();
    for (let i = 1; i <= nTicks; i++) {
      const pos = i * tickSpacing;
      ctx.moveTo(centerX + pos, centerY - 1.5 * scale);
      ctx.lineTo(centerX + pos, centerY + 1.5 * scale);
      ctx.moveTo(centerX - pos, centerY - 1.5 * scale);
      ctx.lineTo(centerX - pos, centerY + 1.5 * scale);
      ctx.moveTo(centerX - 1.5 * scale, centerY - pos);
      ctx.lineTo(centerX + 1.5 * scale, centerY - pos);
      ctx.moveTo(centerX - 1.5 * scale, centerY + pos);
      ctx.lineTo(centerX + 1.5 * scale, centerY + pos);
    }
    ctx.stroke();
  }

  // 当前帧角度
  const angleDeg = (frameIndex * 360) / n;
  const angleRad = -sn * (angleDeg * Math.PI / 180);

  // 旋转凸轮轮廓
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const rotatePoint = (px: number, py: number): [number, number] => {
    return [px * cosA - py * sinA, px * sinA + py * cosA];
  };

  // 选择轮廓（实际或理论）
  const profileX = r_r > 0 ? x_actual : x;
  const profileY = r_r > 0 ? y_actual : y;

  // 绘制基圆（虚线）
  if (displayOptions.showBaseCircle) {
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 0.5 * scale;
    ctx.setLineDash([2 * scale, 2 * scale]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, s_0 * scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 绘制凸轮轮廓
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 0.8 * scale;
  ctx.beginPath();
  for (let i = 0; i < profileX.length; i++) {
    const [rx, ry] = rotatePoint(profileX[i], profileY[i]);
    const px = centerX + rx * scale;
    const py = centerY - ry * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

  // 推杆位置
  const followerX = centerX - sn * pz * e * scale;
  const contactY = centerY - (s_0 + s[frameIndex]) * scale;

  // 绘制推杆
  if (r_r > 0) {
    // 滚子从动件
    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath();
    ctx.arc(followerX, contactY, r_r * scale, 0, 2 * Math.PI);
    ctx.stroke();

    // 滚子中心点
    ctx.fillStyle = '#4B5563';
    ctx.beginPath();
    ctx.arc(followerX, contactY, r_0 * 0.02 * scale, 0, 2 * Math.PI);
    ctx.fill();

    // 推杆杆身
    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath();
    ctx.moveTo(followerX, contactY);
    ctx.lineTo(followerX, contactY - r_max * 0.3 * scale);
    ctx.stroke();
  } else {
    // 尖底从动件
    const tipWidth = r_0 * 0.075 * scale;
    const tipHeight = r_0 * 0.1 * scale;
    const outlineOffset = 0.4 * scale; // 凸轮轮廓线宽的一半

    ctx.fillStyle = '#4B5563';
    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 0.8 * scale;
    ctx.beginPath();
    ctx.moveTo(followerX - tipWidth, contactY - tipHeight);
    ctx.lineTo(followerX, contactY - outlineOffset);
    ctx.lineTo(followerX + tipWidth, contactY - tipHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 推杆杆身
    ctx.beginPath();
    ctx.moveTo(followerX, contactY - tipHeight);
    ctx.lineTo(followerX, contactY - r_max * 0.3 * scale);
    ctx.stroke();
  }

  // 计算切线和法线方向
  const deltaI = (angleDeg * Math.PI) / 180;
  const theta = -sn * deltaI;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const cosD = Math.cos(deltaI);
  const sinD = Math.sin(deltaI);

  const sp = s_0 + s[frameIndex];
  const dsd = ds_ddelta[frameIndex];

  const dx0 = sp * cosD + dsd * sinD - pz * e * sinD;
  const dy0 = -sp * sinD + dsd * cosD - pz * e * cosD;
  const dx = -sn * dx0;
  const dy = dy0;
  let tx = dx * cosT - dy * sinT;
  let ty = dx * sinT + dy * cosT;
  const lenT = Math.hypot(tx, ty);
  if (lenT > EPSILON) {
    tx /= lenT;
    ty /= lenT;
  } else {
    tx = 1;
    ty = 0;
  }

  const nx1 = -ty, ny1 = tx;
  const nx2 = ty, ny2 = -tx;
  const cfx = -sn * pz * e;
  const cfy = s_0 + s[frameIndex];
  const dot1 = (0 - cfx) * nx1 + (0 - cfy) * ny1;
  let nx: number, ny: number;
  if (dot1 > 0) {
    nx = nx1;
    ny = ny1;
  } else {
    nx = nx2;
    ny = ny2;
  }

  // 绘制切线
  if (displayOptions.showTangent) {
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 0.3 * scale;
    ctx.beginPath();
    ctx.moveTo(followerX - r_0 * tx * scale, contactY + r_0 * ty * scale);
    ctx.lineTo(followerX + r_0 * tx * scale, contactY - r_0 * ty * scale);
    ctx.stroke();
  }

  // 绘制法线
  if (displayOptions.showNormal || displayOptions.showPressureArc) {
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 0.3 * scale;
    ctx.beginPath();
    ctx.moveTo(followerX + r_0 * nx * scale, contactY - r_0 * ny * scale);
    ctx.lineTo(followerX - r_0 * nx * scale, contactY + r_0 * ny * scale);
    ctx.stroke();
  }

  // 绘制压力角弧
  if (displayOptions.showPressureArc) {
    const alphaI = alpha_all[frameIndex];
    if (alphaI > 0.5) {
      const alphaRad = (alphaI * Math.PI) / 180;
      const arcR = r_0 * 0.3 * scale;

      // 中心线（向下）
      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 0.3 * scale;
      ctx.beginPath();
      ctx.moveTo(followerX, contactY);
      ctx.lineTo(followerX, contactY + r_0 * 0.5 * scale);
      ctx.stroke();

      // 压力角弧线
      const thetaStart = Math.PI / 2; // 向下
      let thetaN = Math.atan2(-ny, nx);
      let diff = ((thetaN - thetaStart + Math.PI) % (2 * Math.PI)) - Math.PI;

      if (Math.abs(Math.abs(diff) - alphaRad) > 0.1) {
        thetaN = Math.atan2(ny, -nx);
        diff = ((thetaN - thetaStart + Math.PI) % (2 * Math.PI)) - Math.PI;
      }

      ctx.strokeStyle = '#4B5563';
      ctx.lineWidth = 0.3 * scale;
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        const theta = thetaStart + diff * t;
        const arcX = followerX + arcR * Math.cos(theta);
        const arcY = contactY + arcR * Math.sin(theta);
        if (i === 0) ctx.moveTo(arcX, arcY);
        else ctx.lineTo(arcX, arcY);
      }
      ctx.stroke();
    }
  }

  // 绘制行程极限
  if (displayOptions.showLowerLimit) {
    // 下限（基圆位置）
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 0.3 * scale;
    ctx.setLineDash([4 * scale, 2 * scale]);
    ctx.beginPath();
    ctx.moveTo(centerX - r_0 * 0.8 * scale, centerY - s_0 * scale);
    ctx.lineTo(centerX + r_0 * 0.8 * scale, centerY - s_0 * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (displayOptions.showUpperLimit) {
    // 上限（最大位移）
    ctx.strokeStyle = '#D946EF';
    ctx.lineWidth = 0.3 * scale;
    ctx.setLineDash([2 * scale, 2 * scale]);
    ctx.beginPath();
    ctx.moveTo(centerX - r_0 * 0.8 * scale, centerY - (s_0 + h) * scale);
    ctx.lineTo(centerX + r_0 * 0.8 * scale, centerY - (s_0 + h) * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 绘制相位边界线
  if (displayOptions.showBoundaries) {
    ctx.strokeStyle = '#9CA3AF';
    ctx.lineWidth = 0.3 * scale;
    for (const bound of phase_bounds.slice(1)) {
      const boundIdx = Math.floor(bound * n / 360);
      if (boundIdx < n) {
        const [bx, by] = rotatePoint(profileX[boundIdx], profileY[boundIdx]);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + bx * scale, centerY - by * scale);
        ctx.stroke();
      }
    }
  }

  // 绘制固定支座
  const sz = r_0 * 0.12 * scale;
  const circleR = sz * 0.2;
  const triTopY = circleR + sz * 0.05;
  const triBotY = sz * 1.35;
  const hw = sz * 1.3;
  const baseY = triBotY;
  const hatchLen = sz * 0.5;
  const nHatch = 5;

  ctx.strokeStyle = '#4B5563';
  ctx.fillStyle = '#4B5563';
  ctx.lineWidth = 0.7 * scale;

  // 铰链小圆圈
  ctx.beginPath();
  ctx.arc(centerX, centerY, circleR, 0, 2 * Math.PI);
  ctx.stroke();

  // 三角形支座
  ctx.beginPath();
  ctx.moveTo(centerX, centerY + triTopY);
  ctx.lineTo(centerX - sz, centerY + triBotY);
  ctx.lineTo(centerX + sz, centerY + triBotY);
  ctx.closePath();
  ctx.fill();

  // 底座横线
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(centerX - hw, centerY + baseY);
  ctx.lineTo(centerX + hw, centerY + baseY);
  ctx.stroke();

  // 斜线阴影
  ctx.lineWidth = 0.5 * scale;
  for (let j = 0; j < nHatch; j++) {
    const x0 = centerX - hw + (2 * hw) * (j + 0.5) / nHatch;
    ctx.beginPath();
    ctx.moveTo(x0, centerY + baseY);
    ctx.lineTo(x0 - hatchLen * 0.6, centerY + baseY + hatchLen);
    ctx.stroke();
  }

  // 信息面板（左上角，与演示界面 .data-overlay 一致）
  const panelX = 10;
  const panelY = 10;
  const panelW = 140;
  const panelH = 50;

  ctx.fillStyle = 'rgba(213, 211, 212, 0.8)';
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.strokeStyle = '#CAC4C5';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  ctx.fillStyle = '#494546';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'left';

  ctx.fillText('角度:', panelX + 8, panelY + 14);
  ctx.fillText('位移:', panelX + 8, panelY + 28);
  ctx.fillText('压力角:', panelX + 8, panelY + 42);

  ctx.fillStyle = '#1C1B1B';
  ctx.textAlign = 'right';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillText(`${angleDeg.toFixed(1)}°`, panelX + panelW - 8, panelY + 14);
  ctx.fillText(`${s[frameIndex].toFixed(3)} mm`, panelX + panelW - 8, panelY + 28);
  ctx.fillText(`${alpha_all[frameIndex].toFixed(2)}°`, panelX + panelW - 8, panelY + 42);
}
