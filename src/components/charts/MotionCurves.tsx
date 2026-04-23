import { onMount, onCleanup, createEffect, Show } from 'solid-js';
import { simulationData } from '../../stores/simulation';
import { t } from '../../i18n';

export function MotionCurves() {
  let canvasRef: HTMLCanvasElement | undefined;

  const draw = () => {
    const data = simulationData();
    if (!canvasRef || !data) return;

    const ctx = canvasRef.getContext('2d');
    if (!ctx) return;

    const currentT = t();
    const { delta_deg, s, v, a, phase_bounds, h } = data;

    const rect = canvasRef.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvasRef.width = rect.width * dpr;
    canvasRef.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    // 三Y轴布局：左侧s，右侧v（内）和a（外偏移60px）
    const padding = { top: 55, right: 130, bottom: 55, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#1C1C1E' : '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // 标题
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(currentT.chart.motionTitle, width / 2, 25);

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

    // 相位分界线（灰色虚线）
    ctx.strokeStyle = isDark ? '#666' : '#999';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 4]);
    for (const bound of phase_bounds.slice(1, -1)) {
      const px = padding.left + (bound / 360) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(px, padding.top);
      ctx.lineTo(px, height - padding.bottom);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 计算各轴范围
    const sMax = h * 1.15;
    const vMax = Math.max(...v.map(Math.abs)) * 1.15 || 1;
    const aMax = Math.max(...a.map(Math.abs)) * 1.15 || 1;

    // 绘制曲线的通用函数
    const drawCurve = (
      yData: number[],
      color: string,
      yMin: number,
      yMax: number,
      lineStyle: 'solid' | 'dashed' | 'dashdot' = 'solid'
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;

      if (lineStyle === 'dashed') {
        ctx.setLineDash([6, 4]);
      } else if (lineStyle === 'dashdot') {
        ctx.setLineDash([8, 4, 2, 4]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      for (let i = 0; i < yData.length; i++) {
        const px = padding.left + (delta_deg[i] / 360) * chartWidth;
        const py = padding.top + (1 - (yData[i] - yMin) / (yMax - yMin)) * chartHeight;

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
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // 右侧Y轴1 - 速度v（蓝色）
    const vAxisX = width - padding.right;
    ctx.strokeStyle = '#2563EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vAxisX, padding.top);
    ctx.lineTo(vAxisX, height - padding.bottom);
    ctx.stroke();

    // 右侧Y轴2 - 加速度a（绿色，向外偏移）
    const aAxisX = width - padding.right + 60;
    ctx.strokeStyle = '#16A34A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(aAxisX, padding.top);
    ctx.lineTo(aAxisX, height - padding.bottom);
    ctx.stroke();

    // X轴标签和刻度
    ctx.fillStyle = isDark ? '#CCC' : '#333';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(currentT.chart.angleX, padding.left + chartWidth / 2, height - 10);

    ctx.textAlign = 'center';
    for (let x = 0; x <= 360; x += 30) {
      const px = padding.left + (x / 360) * chartWidth;
      ctx.fillText(String(x), px, height - padding.bottom + 15);
    }

    // 左侧Y轴 - 位移s（红色）
    ctx.fillStyle = '#DC2626';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(16, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(currentT.chart.displacementY, 0, 0);
    ctx.restore();

    ctx.textAlign = 'right';
    ctx.font = '9px -apple-system, sans-serif';
    // s轴刻度（5个）
    for (let i = 0; i <= 4; i++) {
      const val = (sMax * i / 4).toFixed(1);
      const py = padding.top + (1 - i / 4) * chartHeight;
      ctx.fillText(val, padding.left - 5, py + 3);
    }

    // 右侧Y轴1 - 速度v（蓝色）
    ctx.fillStyle = '#2563EB';
    ctx.textAlign = 'center';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.save();
    ctx.translate(vAxisX + 22, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(currentT.chart.velocityY, 0, 0);
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.font = '9px -apple-system, sans-serif';
    // v轴刻度（5个）
    for (let i = 0; i <= 4; i++) {
      const val = (vMax * (2 - i) / 2);
      const py = padding.top + (i / 4) * chartHeight;
      ctx.fillText(val.toFixed(1), vAxisX + 4, py + 3);
    }

    // 右侧Y轴2 - 加速度a（绿色）
    ctx.fillStyle = '#16A34A';
    ctx.textAlign = 'center';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.save();
    ctx.translate(aAxisX + 22, padding.top + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(currentT.chart.accelerationY, 0, 0);
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.font = '9px -apple-system, sans-serif';
    // a轴刻度（5个）
    for (let i = 0; i <= 4; i++) {
      const val = (aMax * (2 - i) / 2);
      const py = padding.top + (i / 4) * chartHeight;
      ctx.fillText(val.toFixed(1), aAxisX + 4, py + 3);
    }

    // 图例（三行，右上角）
    const legendX = width - padding.right - 100;
    let legendY = padding.top + 12;
    ctx.font = '9px -apple-system, sans-serif';

    // 位移图例
    ctx.strokeStyle = '#DC2626';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.textAlign = 'left';
    ctx.fillText(currentT.chart.displacement, legendX + 25, legendY + 4);

    // 速度图例
    legendY += 16;
    ctx.strokeStyle = '#2563EB';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillText(currentT.chart.velocity, legendX + 25, legendY + 4);

    // 加速度图例
    legendY += 16;
    ctx.strokeStyle = '#16A34A';
    ctx.setLineDash([8, 4, 2, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(currentT.chart.acceleration, legendX + 25, legendY + 4);
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
          Run simulation to see motion curves
        </div>
      }>
        <div role="img" aria-label={t().chart.motionTitle}>
          <canvas
            ref={canvasRef}
            class="w-full h-full"
            style={{ width: '100%', height: '100%' }}
            aria-hidden="true"
          />
          <span class="sr-only">
            {t().chart.motionTitle}: {t().chart.displacement}, {t().chart.velocity}, {t().chart.acceleration} curves over angle
          </span>
        </div>
      </Show>
    </div>
  );
}