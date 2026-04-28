import { onMount, onCleanup, createEffect, Show } from 'solid-js';
import { simulationData, cursorFrame, setCursorFrame, curveVisible } from '../../stores/simulation';
import { isDark as isDarkSignal } from '../../stores/settings';
import { t } from '../../i18n';

export function MotionCurves() {
  let canvasRef: HTMLCanvasElement | undefined;
  let isDragging = false;
  let hoverFrame = -1;

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

    // 响应式边距计算
    const getResponsivePadding = () => {
      const w = window.innerWidth;
      if (w < 640) {
        return { top: 40, right: 20, bottom: 45, left: 45 };
      } else if (w < 768) {
        return { top: 50, right: 80, bottom: 50, left: 55 };
      }
      return { top: 55, right: 130, bottom: 55, left: 70 };
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
    const vis = curveVisible();
    if (vis.s) drawCurve(s, '#E07A5F', 0, sMax, 'solid');
    if (vis.v) drawCurve(v, '#3D5A80', -vMax, vMax, 'dashed');
    if (vis.a) drawCurve(a, '#5B8C5A', -aMax, aMax, 'dashdot');

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
    ctx.strokeStyle = '#3D5A80';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vAxisX, padding.top);
    ctx.lineTo(vAxisX, height - padding.bottom);
    ctx.stroke();

    // 右侧Y轴2 - 加速度a（绿色，向外偏移）
    const aAxisOffset = window.innerWidth < 640 ? 40 : (window.innerWidth < 768 ? 50 : 60);
    const aAxisX = width - padding.right + aAxisOffset;
    ctx.strokeStyle = '#5B8C5A';
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
    ctx.fillStyle = '#E07A5F';
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
    ctx.fillStyle = '#3D5A80';
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
    ctx.fillStyle = '#5B8C5A';
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
    ctx.strokeStyle = '#E07A5F';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.fillStyle = isDark ? '#FFF' : '#333';
    ctx.textAlign = 'left';
    ctx.fillText(currentT.chart.displacement, legendX + 25, legendY + 4);

    legendY += 16;
    ctx.strokeStyle = '#3D5A80';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(currentT.chart.velocity, legendX + 25, legendY + 4);

    legendY += 16;
    ctx.strokeStyle = '#5B8C5A';
    ctx.setLineDash([8, 4, 2, 4]);
    ctx.beginPath();
    ctx.moveTo(legendX, legendY);
    ctx.lineTo(legendX + 20, legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(currentT.chart.acceleration, legendX + 25, legendY + 4);

    // ===== 游标线 =====
    const cf = cursorFrame();
    if (cf >= 0 && cf < delta_deg.length) {
      const cursorX = padding.left + (delta_deg[cf] / 360) * chartWidth;

      // 垂直虚线
      ctx.strokeStyle = isDark ? '#c8c6c5' : '#5f5e5e';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cursorX, padding.top);
      ctx.lineTo(cursorX, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // 曲线上的圆点
      const drawDot = (yData: number[], color: string, yMin: number, yMax: number) => {
        const y = padding.top + (1 - (yData[cf] - yMin) / (yMax - yMin)) * chartHeight;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cursorX, y, 3, 0, Math.PI * 2);
        ctx.fill();
      };
      if (vis.s) drawDot(s, '#E07A5F', 0, sMax);
      if (vis.v) drawDot(v, '#3D5A80', -vMax, vMax);
      if (vis.a) drawDot(a, '#5B8C5A', -aMax, aMax);
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

      // Highlight dots on curves
      const drawHoverDot = (yData: number[], color: string, yMin: number, yMax: number) => {
        const y = padding.top + (1 - (yData[hi] - yMin) / (yMax - yMin)) * chartHeight;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(hx, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isDark ? '#1C1C1E' : '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hx, y, 4, 0, Math.PI * 2);
        ctx.stroke();
      };
      if (vis.s) drawHoverDot(s, '#E07A5F', 0, sMax);
      if (vis.v) drawHoverDot(v, '#3D5A80', -vMax, vMax);
      if (vis.a) drawHoverDot(a, '#5B8C5A', -aMax, aMax);

      // Tooltip box
      const lines: string[] = [`θ = ${delta_deg[hi].toFixed(1)}°`];
      if (vis.s) lines.push(`s = ${s[hi].toFixed(3)} mm`);
      if (vis.v) lines.push(`v = ${v[hi].toFixed(3)} mm/rad`);
      if (vis.a) lines.push(`a = ${a[hi].toFixed(3)} mm/rad²`);
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
      const visColors: string[] = [];
      if (vis.s) visColors.push('#E07A5F');
      if (vis.v) visColors.push('#3D5A80');
      if (vis.a) visColors.push('#5B8C5A');
      lines.forEach((line, i) => {
        ctx.fillStyle = i === 0 ? (isDark ? '#CCC' : '#555') : visColors[i - 1] || (isDark ? '#CCC' : '#555');
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
    const padding = w < 640 ? { left: 45, right: 20 } : w < 768 ? { left: 55, right: 80 } : { left: 70, right: 130 };
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

  createEffect(() => {
    curveVisible();
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
          Run simulation to see motion curves
        </div>
      }>
        <div role="img" aria-label={t().chart.motionTitle}>
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
            {t().chart.motionTitle}: displacement, velocity, acceleration over angle
          </span>
        </div>
      </Show>
    </div>
  );
}
