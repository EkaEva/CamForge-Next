import { onMount, onCleanup, createEffect, Show } from 'solid-js';
import { simulationData, params, cursorFrame, setCursorFrame } from '../../stores/simulation';
import { isDark as isDarkSignal } from '../../stores/settings';
import { t } from '../../i18n';

export function CurvatureChart() {
  let canvasRef: HTMLCanvasElement | undefined;
  let isDragging = false;
  let hoverFrame = -1;

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

    // 响应式边距计算
    const getResponsivePadding = () => {
      const w = window.innerWidth;
      if (w < 640) {
        return { top: 40, right: 20, bottom: 45, left: 45 };
      } else if (w < 768) {
        return { top: 50, right: 50, bottom: 50, left: 55 };
      }
      return { top: 55, right: 70, bottom: 55, left: 70 };
    };
    const padding = getResponsivePadding();
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const isDark = isDarkSignal();
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
      ctx.strokeStyle = '#6D9DC5';
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
    ctx.strokeStyle = '#E07A5F';
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
      ctx.strokeStyle = '#3D5A80';
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
        ctx.fillStyle = '#5B8C5A';
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
        ctx.fillStyle = '#C4A35A';
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
    ctx.fillStyle = isDark ? '#CCC' : '#333';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(16, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(currentT.chart.curvatureY, 0, 0);
    ctx.restore();

    ctx.textAlign = 'right';
    ctx.font = '9px -apple-system, sans-serif';
    for (let i = 0; i <= 4; i++) {
      const val = rhoMin + (rhoMax - rhoMin) * (1 - i / 4);
      const py = padding.top + (i / 4) * chartHeight;
      ctx.fillText(val.toFixed(1), padding.left - 5, py + 3);
    }

    // 图例
    const legendX = padding.left + 10;
    let legendY = padding.top + 12;
    ctx.font = '9px -apple-system, sans-serif';

    ctx.strokeStyle = '#E07A5F';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.textAlign = 'left';
    ctx.fillText(currentT.chart.theoryRho, legendX + 25, legendY + 4);

    if (r_r > 0 && data.rho_actual) {
      legendY += 16;
      ctx.strokeStyle = '#3D5A80';
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(legendX, legendY);
      ctx.lineTo(legendX + 20, legendY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText(currentT.chart.actualRho, legendX + 25, legendY + 4);
    }

    // ===== 游标线 =====
    const cf = cursorFrame();
    if (cf >= 0 && cf < delta_deg.length) {
      const cursorX = padding.left + (delta_deg[cf] / 360) * chartWidth;

      ctx.strokeStyle = isDark ? '#c8c6c5' : '#5f5e5e';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padding.top);
      ctx.lineTo(cursorX, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // 曲线上的圆点
      if (isFinite(rho[cf])) {
        const y = padding.top + (1 - (rho[cf] - rhoMin) / yRange) * chartHeight;
        ctx.fillStyle = '#E07A5F';
        ctx.beginPath();
        ctx.arc(cursorX, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (r_r > 0 && data.rho_actual && isFinite(data.rho_actual[cf])) {
        const y = padding.top + (1 - (data.rho_actual[cf] - rhoMin) / yRange) * chartHeight;
        ctx.fillStyle = '#3D5A80';
        ctx.beginPath();
        ctx.arc(cursorX, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ===== Hover tooltip =====
    if (hoverFrame >= 0 && hoverFrame < delta_deg.length) {
      const hi = hoverFrame;
      const hx = padding.left + (delta_deg[hi] / 360) * chartWidth;

      // Vertical guide line
      ctx.strokeStyle = isDark ? 'rgba(200,198,197,0.3)' : 'rgba(95,94,94,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, padding.top);
      ctx.lineTo(hx, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight dots
      if (isFinite(rho[hi])) {
        const hy = padding.top + (1 - (rho[hi] - rhoMin) / yRange) * chartHeight;
        ctx.fillStyle = '#E07A5F';
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#1C1C1E' : '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (r_r > 0 && data.rho_actual && isFinite(data.rho_actual[hi])) {
        const hy = padding.top + (1 - (data.rho_actual[hi] - rhoMin) / yRange) * chartHeight;
        ctx.fillStyle = '#3D5A80';
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#1C1C1E' : '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hx, hy, 4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Tooltip box
      const lines = [`θ = ${delta_deg[hi].toFixed(1)}°`];
      if (isFinite(rho[hi])) lines.push(`ρ = ${rho[hi].toFixed(2)} mm`);
      if (r_r > 0 && data.rho_actual && isFinite(data.rho_actual[hi])) lines.push(`ρ' = ${data.rho_actual[hi].toFixed(2)} mm`);
      if (r_r > 0) lines.push(`rᵣ = ${r_r.toFixed(2)} mm`);

      ctx.font = '11px -apple-system, sans-serif';
      const lineH = 16;
      const padInner = 8;
      const maxTextW = Math.max(...lines.map(l => ctx.measureText(l).width));
      const boxW = maxTextW + padInner * 2;
      const boxH = lines.length * lineH + padInner * 2 - 4;

      let tx = hx + 12;
      let ty = padding.top + 8;
      if (tx + boxW > width - padding.right) tx = hx - boxW - 12;
      if (ty + boxH > height - padding.bottom) ty = height - padding.bottom - boxH - 4;

      ctx.fillStyle = isDark ? 'rgba(44,44,46,0.92)' : 'rgba(255,255,255,0.95)';
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(tx, ty, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.font = '11px -apple-system, sans-serif';
      const colors = [isDark ? '#CCC' : '#555', '#E07A5F', '#3D5A80', '#6D9DC5'];
      lines.forEach((line, i) => {
        ctx.fillStyle = colors[i] || (isDark ? '#CCC' : '#555');
        ctx.fillText(line, tx + padInner, ty + padInner + (i + 1) * lineH - 4);
      });
    }
  };

  // 鼠标交互
  const getFrameFromX = (clientX: number): number => {
    const data = simulationData();
    if (!canvasRef || !data) return 0;

    const rect = canvasRef.getBoundingClientRect();
    const x = clientX - rect.left;
    const w = window.innerWidth;
    const padding = w < 640 ? { left: 45, right: 20 } : w < 768 ? { left: 55, right: 50 } : { left: 70, right: 70 };
    const chartWidth = rect.width - padding.left - padding.right;

    if (chartWidth <= 0) return 0;

    const angle = ((x - padding.left) / chartWidth) * 360;
    const frame = Math.round((angle / 360) * (data.delta_deg.length - 1));
    return Math.max(0, Math.min(data.delta_deg.length - 1, frame));
  };

  const handleMouseDown = (e: MouseEvent) => {
    isDragging = true;
    setCursorFrame(getFrameFromX(e.clientX));
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setCursorFrame(getFrameFromX(e.clientX));
    } else {
      handleHover(e);
    }
  };

  const handleMouseUp = () => {
    isDragging = false;
  };

  const handleHover = (e: MouseEvent) => {
    const data = simulationData();
    if (!canvasRef || !data) return;
    const rect = canvasRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = window.innerWidth;
    const padding = w < 640 ? { left: 45, right: 20 } : w < 768 ? { left: 55, right: 50 } : { left: 70, right: 70 };
    const chartWidth = rect.width - padding.left - padding.right;
    if (chartWidth <= 0 || x < padding.left || x > rect.width - padding.right) {
      hoverFrame = -1;
      draw();
      return;
    }
    const angle = ((x - padding.left) / chartWidth) * 360;
    const frame = Math.round((angle / 360) * (data.delta_deg.length - 1));
    hoverFrame = Math.max(0, Math.min(data.delta_deg.length - 1, frame));
    draw();
  };

  const handleMouseLeave = () => {
    hoverFrame = -1;
    draw();
  };

  onMount(() => {
    window.addEventListener('mouseup', handleMouseUp);
  });

  onCleanup(() => {
    window.removeEventListener('mouseup', handleMouseUp);
  });

  createEffect(() => {
    if (simulationData()) draw();
  });

  createEffect(() => {
    cursorFrame();
    draw();
  });

  createEffect(() => {
    isDarkSignal();
    draw();
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
          Run simulation to see curvature
        </div>
      }>
        <div role="img" aria-label={t().chart.curvatureTitle}>
          <canvas
            ref={canvasRef}
            class="w-full h-full"
            style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
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
