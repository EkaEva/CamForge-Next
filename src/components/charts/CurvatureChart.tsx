import { onMount, onCleanup, createEffect, Show } from 'solid-js';
import { simulationData, params } from '../../stores/simulation';
import { t } from '../../i18n';

export function CurvatureChart() {
  let canvasRef: HTMLCanvasElement | undefined;

  const draw = () => {
    const data = simulationData();
    const p = params();
    if (!canvasRef || !data) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const currentT = t();
    const { delta_deg, rho } = data;

    const rect = canvasRef.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 55, right: 70, bottom: 55, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 标题
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(currentT.chart.curvatureTitle, width / 2, 25);

    // 网格线（点线）
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);

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
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    for (const bound of data.phase_bounds.slice(1, -1)) {
      const px = padding.left + (bound / 360) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(px, padding.top);
      ctx.lineTo(px, height - padding.bottom);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 过滤有限值计算范围
    const rhoFinite = rho.filter(r => isFinite(r) && !isNaN(r));
    const rhoActualFinite = data.rho_actual ? data.rho_actual.filter(r => isFinite(r) && !isNaN(r)) : [];
    const allRhoFinite = [...rhoFinite, ...rhoActualFinite];

    if (allRhoFinite.length === 0) {
      ctx.fillStyle = isDark ? '#FFF' : '#000';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(currentT.chart.noData, width / 2, height / 2);
      return;
    }

    // 使用百分位数来避免极端值影响显示
    const rhoSorted = [...allRhoFinite].sort((a, b) => a - b);
    const p5Idx = Math.floor(rhoSorted.length * 0.05);
    const p95Idx = Math.floor(rhoSorted.length * 0.95);
    const p5 = rhoSorted[p5Idx];
    const p95 = rhoSorted[p95Idx];

    let rhoMin: number, rhoMax: number;
    const range = p95 - p5;

    // 如果范围太大，使用百分位裁剪
    const p10 = rhoSorted[Math.floor(rhoSorted.length * 0.1)];
    const p90 = rhoSorted[Math.floor(rhoSorted.length * 0.9)];
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
    const r_r = p.r_r;
    if (r_r > 0) {
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
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
    ctx.lineWidth = 1.5;
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
    if (r_r > 0 && data.rho_actual) {
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      started = false;
      for (let i = 0; i < data.rho_actual.length; i++) {
        if (!isFinite(data.rho_actual[i]) || isNaN(data.rho_actual[i])) continue;
        const px = padding.left + (delta_deg[i] / 360) * chartWidth;
        const py = padding.top + (1 - (data.rho_actual[i] - rhoMin) / yRange) * chartHeight;
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
    if (data.min_rho !== null && data.min_rho_idx >= 0 && data.min_rho_idx < rho.length) {
      const idx = data.min_rho_idx;
      if (isFinite(rho[idx])) {
        const px = padding.left + (delta_deg[idx] / 360) * chartWidth;
        const py = padding.top + (1 - (rho[idx] - rhoMin) / yRange) * chartHeight;
        ctx.fillStyle = '#16A34A';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // 标记实际轮廓最小曲率半径点（仅滚子从动件）
    if (r_r > 0 && data.min_rho_actual !== null && data.min_rho_actual_idx >= 0 && data.min_rho_actual_idx < data.rho_actual.length) {
      const idx = data.min_rho_actual_idx;
      if (isFinite(data.rho_actual[idx])) {
        const px = padding.left + (delta_deg[idx] / 360) * chartWidth;
        const py = padding.top + (1 - (data.rho_actual[idx] - rhoMin) / yRange) * chartHeight;
        ctx.fillStyle = '#F97316';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // 绘制坐标轴边框
    ctx.strokeStyle = isDark ? '#555' : '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // X轴标签
    ctx.fillStyle = isDark ? '#CCC' : '#333';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(currentT.chart.angleX, padding.left + chartWidth / 2, height - 10);

    ctx.textAlign = 'center';
    for (let x = 0; x <= 360; x += 30) {
      const px = padding.left + (x / 360) * chartWidth;
      ctx.fillText(String(x), px, height - padding.bottom + 15);
    }

    // 左侧Y轴 - 曲率半径ρ
    ctx.fillStyle = '#DC2626';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(16, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(currentT.chart.curvatureY, 0, 0);
    ctx.restore();

    ctx.textAlign = 'right';
    ctx.font = '9px -apple-system, sans-serif';
    // ρ轴刻度（5个）
    for (let i = 0; i <= 4; i++) {
      const val = rhoMin + (rhoMax - rhoMin) * (1 - i / 4);
      const py = padding.top + (i / 4) * chartHeight;
      ctx.fillText(val.toFixed(1), padding.left - 5, py + 3);
    }

    // 图例
    const legendX = padding.left + 10;
    let legendY = padding.top + 12;
    ctx.font = '9px -apple-system, sans-serif';

    // 理论轮廓曲率半径
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.textAlign = 'left';
    ctx.fillText(currentT.chart.theoryRho, legendX + 25, legendY + 4);

    // 实际轮廓曲率半径（仅滚子从动件）
    if (r_r > 0) {
      legendY += 14;
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(legendX, legendY);
      ctx.lineTo(legendX + 20, legendY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = isDark ? '#FFF' : '#333';
      ctx.fillText(currentT.chart.actualRho, legendX + 25, legendY + 4);
    }

    // 显示理论轮廓最小曲率半径值
    if (data.min_rho !== null) {
      legendY += 16;
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.arc(legendX + 10, legendY, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = isDark ? '#FFF' : '#333';
      // ρ_min 中 min 为下标
      ctx.font = '11px sans-serif';
      ctx.fillText('ρ', legendX + 25, legendY + 4);
      const rhoWidth = ctx.measureText('ρ').width;
      ctx.font = '8px sans-serif';
      ctx.fillText('min', legendX + 25 + rhoWidth, legendY + 6);
      ctx.font = '11px sans-serif';
      const minWidth = ctx.measureText('min').width;
      ctx.fillText(` = ${data.min_rho.toFixed(2)} mm`, legendX + 25 + rhoWidth + minWidth, legendY + 4);
    }

    // 显示实际轮廓最小曲率半径值（仅滚子从动件）
    if (r_r > 0 && data.min_rho_actual !== null) {
      legendY += 16;
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.arc(legendX + 10, legendY, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = isDark ? '#FFF' : '#333';
      ctx.font = '11px sans-serif';
      ctx.fillText('ρ', legendX + 25, legendY + 4);
      const rhoWidth = ctx.measureText('ρ').width;
      ctx.font = '8px sans-serif';
      ctx.fillText('a,min', legendX + 25 + rhoWidth, legendY + 6);
      ctx.font = '11px sans-serif';
      const minWidth = ctx.measureText('a,min').width;
      ctx.fillText(` = ${data.min_rho_actual.toFixed(2)} mm`, legendX + 25 + rhoWidth + minWidth, legendY + 4);
    }

    // 滚子半径阈值
    if (r_r > 0) {
      legendY += 16;
      ctx.strokeStyle = '#06B6D4';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(legendX, legendY);
      ctx.lineTo(legendX + 20, legendY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = isDark ? '#FFF' : '#333';
      ctx.fillText(`${currentT.chart.threshold} ${r_r} mm`, legendX + 25, legendY + 4);
    }
  };

  createEffect(() => {
    if (simulationData()) draw();
  });

  onMount(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    onCleanup(() => window.removeEventListener('resize', handleResize));
  });

  const data = simulationData();

  return (
    <div class="w-full h-full bg-white dark:bg-gray-900 rounded-lg overflow-hidden">
      <Show when={data} fallback={
        <div class="w-full h-full flex items-center justify-center text-gray-400 text-sm">
          Run simulation to see curvature radius
        </div>
      }>
        <div role="img" aria-label={t().chart.curvatureTitle}>
          <canvas
            ref={canvasRef}
            class="w-full h-full"
            style={{ width: '100%', height: '100%' }}
            aria-hidden="true"
          />
          <span class="sr-only">
            {t().chart.curvatureTitle}: curvature radius over angle
          </span>
        </div>
      </Show>
    </div>
  );
}