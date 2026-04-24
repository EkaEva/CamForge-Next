import { onMount, onCleanup, createEffect, Show } from 'solid-js';
import { simulationData, params } from '../../stores/simulation';
import { t } from '../../i18n';

export function GeometryChart() {
  let canvasRef: HTMLCanvasElement | undefined;

  const draw = () => {
    const data = simulationData();
    const p = params();
    if (!canvasRef || !data) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const currentT = t();
    const { delta_deg, alpha_all, rho } = data;

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

    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 标题
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(currentT.chart.pressureTitle, width / 2, 25);

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

    // 压力角范围
    const threshold = p.alpha_threshold;
    const alphaMax = Math.max(...alpha_all.map(Math.abs), threshold) * 1.15;

    // 压力角阈值线（橙色虚线）
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const thresholdY1 = padding.top + (1 - threshold / alphaMax) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, thresholdY1);
    ctx.lineTo(width - padding.right, thresholdY1);
    ctx.stroke();
    ctx.setLineDash([]);

    // 压力角曲线（红色实线）
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.5;
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
        ctx.arc(px, py, 2, 0, 2 * Math.PI);
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

    // 左侧Y轴 - 压力角α（红色）
    ctx.fillStyle = '#DC2626';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(16, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(currentT.chart.pressureY, 0, 0);
    ctx.restore();

    ctx.textAlign = 'right';
    ctx.font = '9px -apple-system, sans-serif';
    // α轴刻度（5个）
    for (let i = 0; i <= 4; i++) {
      const val = (alphaMax * (2 - i) / 2);
      const py = padding.top + (i / 4) * chartHeight;
      ctx.fillText(val.toFixed(0), padding.left - 5, py + 3);
    }

    // 图例（两行）
    const legendX = padding.left + 10;
    let legendY = padding.top + 12;
    ctx.font = '9px -apple-system, sans-serif';

    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.textAlign = 'left';
    ctx.fillText(currentT.chart.pressureAngle, legendX + 25, legendY + 4);

    legendY += 16;
    ctx.strokeStyle = '#F59E0B';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(`${currentT.chart.threshold} ${threshold}°`, legendX + 25, legendY + 4);
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
          Run simulation to see geometry constraints
        </div>
      }>
        <div role="img" aria-label={t().chart.pressureTitle}>
          <canvas
            ref={canvasRef}
            class="w-full h-full"
            style={{ width: '100%', height: '100%' }}
            aria-hidden="true"
          />
          <span class="sr-only">
            {t().chart.pressureTitle}: pressure angle over angle
          </span>
        </div>
      </Show>
    </div>
  );
}