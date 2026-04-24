import { createSignal, createMemo, onCleanup, onMount, Show, createEffect } from 'solid-js';
import { simulationData, params, displayOptions } from '../../stores/simulation';
import { t } from '../../i18n';

interface CamAnimationProps {
  isActive?: boolean;
}

export function CamAnimation(props: CamAnimationProps) {
  const [frame, setFrame] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal(3);
  const [zoom, setZoom] = createSignal(0.8);

  let animationId: number | undefined;
  let lastTime = 0;

  // 触摸手势状态
  let touchStartDistance = 0;
  let touchStartZoom = 1;
  let touchStartX = 0;
  let touchStartY = 0;

  // 计算最大帧数
  const maxFrame = createMemo(() => {
    const data = simulationData();
    return data ? data.s.length - 1 : 0;
  });

  // 当最大帧数变化时，重置帧索引
  createEffect(() => {
    const max = maxFrame();
    if (frame() > max) {
      setFrame(0);
    }
  });

  // 计算旋转后的凸轮轮廓
  const getRotatedCam = (x: number[], y: number[], angleRad: number): [number[], number[]] => {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const xRot: number[] = [];
    const yRot: number[] = [];
    for (let i = 0; i < x.length; i++) {
      xRot.push(x[i] * cosA - y[i] * sinA);
      yRot.push(x[i] * sinA + y[i] * cosA);
    }
    return [xRot, yRot];
  };

  // 生成 SVG 路径
  const generatePath = (coords: number[][]): string => {
    if (coords.length === 0) return '';
    let path = `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
    for (let i = 1; i < coords.length; i++) {
      path += ` L ${coords[i][0].toFixed(2)} ${coords[i][1].toFixed(2)}`;
    }
    path += ' Z';
    return path;
  };

  // 生成压力角弧线路径
  const generateArcPath = (cx: number, cy: number, nx: number, ny: number, alphaI: number, arcR: number): string => {
    if (arcR <= 0 || alphaI < 0.5) return '';

    const alphaRad = (alphaI * Math.PI) / 180;
    const thetaStart = Math.PI / 2;
    let thetaN = Math.atan2(-ny, nx);
    let diff = ((thetaN - thetaStart + Math.PI) % (2 * Math.PI)) - Math.PI;

    if (Math.abs(Math.abs(diff) - alphaRad) > 0.1) {
      thetaN = Math.atan2(ny, -nx);
      diff = ((thetaN - thetaStart + Math.PI) % (2 * Math.PI)) - Math.PI;
    }

    const points: string[] = [];
    const nPoints = 30;
    for (let i = 0; i <= nPoints; i++) {
      const t = i / nPoints;
      const theta = thetaStart + diff * t;
      const x = cx + arcR * Math.cos(theta);
      const y = cy + arcR * Math.sin(theta);
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }

    return `M ${points.join(' L ')}`;
  };

  // 帧数据 memo
  const frameData = createMemo(() => {
    const data = simulationData();
    const p = params();
    const frameIdx = frame();

    if (!data) return null;

    const { s, x, y, x_actual, y_actual, s_0, alpha_all, ds_ddelta } = data;
    const n = s.length;
    const sn = p.sn;
    const pz = p.pz;
    const e = p.e;
    const r_r = p.r_r;

    const angleDeg = (frameIdx * 360) / n;
    const angleRad = -sn * (angleDeg * Math.PI / 180);

    const [xRotTheory, yRotTheory] = getRotatedCam(x, y, angleRad);

    const useActual = r_r > 0;
    const profileX = useActual ? x_actual : x;
    const profileY = useActual ? y_actual : y;
    const [xRot, yRot] = getRotatedCam(profileX, profileY, angleRad);

    const followerX = -sn * pz * e;
    const contactY = s_0 + s[frameIdx];

    const deltaI = (angleDeg * Math.PI) / 180;
    const theta = -sn * deltaI;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosD = Math.cos(deltaI);
    const sinD = Math.sin(deltaI);

    const sp = s_0 + s[frameIdx];
    const dsd = ds_ddelta[frameIdx];

    const dx0 = sp * cosD + dsd * sinD - pz * e * sinD;
    const dy0 = -sp * sinD + dsd * cosD - pz * e * cosD;
    const dx = -sn * dx0;
    const dy = dy0;
    let tx = dx * cosT - dy * sinT;
    let ty = dx * sinT + dy * cosT;
    const lenT = Math.hypot(tx, ty);
    if (lenT > 1e-10) {
      tx /= lenT;
      ty /= lenT;
    } else {
      tx = 1;
      ty = 0;
    }

    const nx1 = -ty, ny1 = tx;
    const nx2 = ty, ny2 = -tx;
    const cx = followerX;
    const cy = contactY;
    const dot1 = (0 - cx) * nx1 + (0 - cy) * ny1;
    let nx: number, ny: number;
    if (dot1 > 0) {
      nx = nx1;
      ny = ny1;
    } else {
      nx = nx2;
      ny = ny2;
    }

    const phase_bounds = data.phase_bounds;
    const isRising = angleDeg >= phase_bounds[0] && angleDeg < phase_bounds[1];
    const isReturning = angleDeg >= phase_bounds[2] && angleDeg < phase_bounds[3];

    return {
      angleDeg,
      followerX,
      contactY,
      tx, ty,
      nx, ny,
      alphaI: alpha_all[frameIdx],
      sI: s[frameIdx],
      xRot,
      yRot,
      xRotTheory,
      yRotTheory,
      isRising,
      isReturning,
    };
  });

  // SVG 路径 memo
  const camPath = createMemo(() => {
    const fd = frameData();
    const z = zoom();
    if (!fd) return '';
    const points = fd.xRot.map((x, i) => [x * z, -fd.yRot[i] * z]);
    return generatePath(points);
  });

  // 理论轮廓路径 memo
  const theoryCamPath = createMemo(() => {
    const fd = frameData();
    const z = zoom();
    if (!fd) return '';
    const points = fd.xRotTheory.map((x, i) => [x * z, -fd.yRotTheory[i] * z]);
    return generatePath(points);
  });

  // 判断是否需要显示理论轮廓
  const shouldShowTheoryProfile = createMemo(() => {
    const p = params();
    const opts = displayOptions();
    if (p.r_r <= 0) return false;
    return opts.showTangent || opts.showNormal || opts.showPressureArc || opts.showCenterLine ||
           opts.showBaseCircle || opts.showOffsetCircle || opts.showUpperLimit || opts.showLowerLimit;
  });

  // viewBox 固定
  const viewBoxData = createMemo(() => {
    const data = simulationData();
    if (!data) return { viewBox: '0 0 100 100', r_max: 50 };
    const r_max = data.r_max;
    const margin = r_max * 0.15;
    const size = 2 * (r_max + margin);
    return {
      viewBox: `${-r_max - margin} ${-r_max - margin} ${size} ${size}`,
      r_max
    };
  });

  // 动画循环
  const animate = (time: number) => {
    const data = simulationData();
    const isPlaying = playing();
    const currentSpeed = speed();
    const currentFrame = frame();
    const max = maxFrame();

    // 如果组件不可用或没有数据，暂停动画循环
    if (!data || !props.isActive) {
      animationId = requestAnimationFrame(animate);
      return;
    }

    const elapsed = time - lastTime;
    const delay = 200 / currentSpeed ** 1.5;

    if (isPlaying && elapsed > delay) {
      const safeFrame = Math.min(currentFrame, max);
      const newFrame = safeFrame >= max ? 0 : safeFrame + 1;
      setFrame(newFrame);
      lastTime = time;
    }

    animationId = requestAnimationFrame(animate);
  };

  // 键盘事件处理
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isActive) return;

    const max = maxFrame();

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (!playing()) {
          const newFrame = frame() - 1;
          setFrame(newFrame < 0 ? max : newFrame);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (!playing()) {
          const newFrame = frame() + 1;
          setFrame(newFrame > max ? 0 : newFrame);
        }
        break;
    }
  };

  onMount(() => {
    lastTime = performance.now();
    animationId = requestAnimationFrame(animate);
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = undefined;
    }
    window.removeEventListener('keydown', handleKeyDown);
  });

  const togglePlay = () => {
    const newState = !playing();
    setPlaying(newState);
    if (newState) {
      lastTime = performance.now();
    }
  };

  // 触摸手势处理
  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指缩放开始
      touchStartDistance = getTouchDistance(e.touches[0], e.touches[1]);
      touchStartZoom = zoom();
    } else if (e.touches.length === 1) {
      // 单指触摸开始
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指缩放
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (touchStartDistance > 0) {
        const scale = currentDistance / touchStartDistance;
        const newZoom = Math.max(0.1, Math.min(1, touchStartZoom * scale));
        setZoom(newZoom);
      }
    } else if (e.touches.length === 1 && !playing()) {
      // 单指滑动控制帧（仅在暂停时）
      const dx = e.touches[0].clientX - touchStartX;
      if (Math.abs(dx) > 20) {
        const max = maxFrame();
        const direction = dx > 0 ? 1 : -1;
        const newFrame = frame() + direction;
        setFrame(newFrame < 0 ? max : (newFrame > max ? 0 : newFrame));
        touchStartX = e.touches[0].clientX;
      }
    }
  };

  const data = simulationData();
  const p = params();

  if (!data) {
    return (
      <div class="w-full h-full flex items-center justify-center text-gray-400 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg">
        {t().mainCanvas.clickToStart}
      </div>
    );
  }

  const { s_0 } = data;

  return (
    <div
      class="relative w-full h-full bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden touch-manipulation"
      role="img"
      aria-label={t().mainCanvas.camProfile}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <svg viewBox={viewBoxData().viewBox} class="w-full h-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {/* 基圆 */}
        <Show when={displayOptions().showBaseCircle}>
          <circle cx="0" cy="0" r={s_0 * zoom()} fill="none" stroke="#9CA3AF" stroke-width={0.5 * zoom()} stroke-dasharray="2,2" />
        </Show>

        {/* 偏距圆 */}
        <Show when={displayOptions().showOffsetCircle && params().e !== 0}>
          <circle cx="0" cy="0" r={Math.abs(params().e) * zoom()} fill="none" stroke="#9CA3AF" stroke-width={0.5 * zoom()} stroke-dasharray="2,2" />
        </Show>

        {/* 理论轮廓（滚子从动件时显示） */}
        <Show when={shouldShowTheoryProfile()}>
          <path d={theoryCamPath()} fill="none" stroke="#FFB6C1" stroke-width={0.5 * zoom()} stroke-dasharray="4,2" />
        </Show>

        {/* 凸轮轮廓 */}
        <path d={camPath()} fill="none" stroke="#EF4444" stroke-width={0.8 * zoom()} />

        {/* 推杆 */}
        <Show when={params().r_r > 0} fallback={
          // 尖底从动件
          <>
            <polygon
              points={`${frameData()!.followerX * zoom() - params().r_0 * 0.075 * zoom()},${-frameData()!.contactY * zoom() - params().r_0 * 0.1 * zoom()} ${frameData()!.followerX * zoom()},${-frameData()!.contactY * zoom() - 0.4 * zoom()} ${frameData()!.followerX * zoom() + params().r_0 * 0.075 * zoom()},${-frameData()!.contactY * zoom() - params().r_0 * 0.1 * zoom()}`}
              fill="#4B5563"
              stroke="#4B5563"
              stroke-width={0.8 * zoom()}
            />
            <line
              x1={frameData()!.followerX * zoom()}
              y1={-frameData()!.contactY * zoom() - params().r_0 * 0.1 * zoom()}
              x2={frameData()!.followerX * zoom()}
              y2={-frameData()!.contactY * zoom() - viewBoxData().r_max * 0.3 * zoom()}
              stroke="#4B5563"
              stroke-width={0.8 * zoom()}
            />
          </>
        }>
          {/* 滚子从动件 */}
          {/* 滚子外圈 */}
          <circle
            cx={frameData()!.followerX * zoom()}
            cy={-frameData()!.contactY * zoom()}
            r={params().r_r * zoom()}
            fill="none"
            stroke="#4B5563"
            stroke-width={0.8 * zoom()}
          />
          {/* 滚子中心点 */}
          <circle
            cx={frameData()!.followerX * zoom()}
            cy={-frameData()!.contactY * zoom()}
            r={params().r_0 * 0.02 * zoom()}
            fill="#4B5563"
          />
          {/* 推杆杆身 */}
          <line
            x1={frameData()!.followerX * zoom()}
            y1={-frameData()!.contactY * zoom()}
            x2={frameData()!.followerX * zoom()}
            y2={-frameData()!.contactY * zoom() - viewBoxData().r_max * 0.3 * zoom()}
            stroke="#4B5563"
            stroke-width={0.8 * zoom()}
          />
        </Show>

        {/* 切线 */}
        <Show when={displayOptions().showTangent && frameData()}>
          <line
            x1={(frameData()!.followerX - p.r_0 * frameData()!.tx) * zoom()}
            y1={(-frameData()!.contactY + p.r_0 * frameData()!.ty) * zoom()}
            x2={(frameData()!.followerX + p.r_0 * frameData()!.tx) * zoom()}
            y2={(-frameData()!.contactY - p.r_0 * frameData()!.ty) * zoom()}
            stroke="#10B981"
            stroke-width={0.3 * zoom()}
          />
        </Show>

        {/* 法线 */}
        <Show when={(displayOptions().showNormal || displayOptions().showPressureArc) && frameData()}>
          <line
            x1={(frameData()!.followerX + p.r_0 * frameData()!.nx) * zoom()}
            y1={(-frameData()!.contactY - p.r_0 * frameData()!.ny) * zoom()}
            x2={(frameData()!.followerX - p.r_0 * frameData()!.nx) * zoom()}
            y2={(-frameData()!.contactY + p.r_0 * frameData()!.ny) * zoom()}
            stroke="#F59E0B"
            stroke-width={0.3 * zoom()}
          />
        </Show>

        {/* 中心线（压力角弧显示时） */}
        <Show when={displayOptions().showPressureArc && frameData() && frameData()!.alphaI > 0.5}>
          <line
            x1={frameData()!.followerX * zoom()}
            y1={-frameData()!.contactY * zoom()}
            x2={frameData()!.followerX * zoom()}
            y2={(-frameData()!.contactY + p.r_0 * 0.5) * zoom()}
            stroke="#4B5563"
            stroke-width={0.3 * zoom()}
          />
        </Show>

        {/* 压力角弧 */}
        <Show when={displayOptions().showPressureArc && frameData() && frameData()!.alphaI > 0.5}>
          <path
            d={generateArcPath(
              frameData()!.followerX * zoom(),
              -frameData()!.contactY * zoom(),
              frameData()!.nx,
              frameData()!.ny,
              frameData()!.alphaI,
              p.r_0 * 0.3 * zoom()
            )}
            fill="none"
            stroke="#4B5563"
            stroke-width={0.3 * zoom()}
          />
        </Show>

        {/* 下止点 */}
        <Show when={displayOptions().showLowerLimit && simulationData()}>
          <line
            x1={-params().r_0 * 0.8 * zoom()}
            y1={-simulationData()!.s_0 * zoom()}
            x2={params().r_0 * 0.8 * zoom()}
            y2={-simulationData()!.s_0 * zoom()}
            stroke="#06B6D4"
            stroke-width={0.3 * zoom()}
            stroke-dasharray="4,2"
          />
        </Show>

        {/* 上止点 */}
        <Show when={displayOptions().showUpperLimit && simulationData()}>
          <line
            x1={-params().r_0 * 0.8 * zoom()}
            y1={-(simulationData()!.s_0 + params().h) * zoom()}
            x2={params().r_0 * 0.8 * zoom()}
            y2={-(simulationData()!.s_0 + params().h) * zoom()}
            stroke="#D946EF"
            stroke-width={0.3 * zoom()}
            stroke-dasharray="2,2"
          />
        </Show>

        {/* 节点 */}
        <Show when={displayOptions().showNodes && frameData()}>
          <>
            {simulationData()!.phase_bounds.slice(1).map((bound, idx) => {
              const boundIdx = Math.floor(bound * simulationData()!.s.length / 360);
              if (boundIdx >= simulationData()!.s.length) return null;
              const xNode = frameData()!.xRot[boundIdx] * zoom();
              const yNode = -frameData()!.yRot[boundIdx] * zoom();
              return (
                <circle
                  cx={xNode}
                  cy={yNode}
                  r={1 * zoom()}
                  fill="#06B6D4"
                />
              );
            })}
          </>
        </Show>

        {/* 角度分界线 */}
        <Show when={displayOptions().showBoundaries && frameData()}>
          <>
            {simulationData()!.phase_bounds.slice(1).map((bound, idx) => {
              const boundIdx = Math.floor(bound * simulationData()!.s.length / 360);
              if (boundIdx >= simulationData()!.s.length) return null;
              const xEnd = frameData()!.xRot[boundIdx] * zoom();
              const yEnd = -frameData()!.yRot[boundIdx] * zoom();
              return (
                <line
                  x1={0}
                  y1={0}
                  x2={xEnd}
                  y2={yEnd}
                  stroke="#9CA3AF"
                  stroke-width={0.3 * zoom()}
                />
              );
            })}
          </>
        </Show>

        {/* 固定铰支座 */}
        {
          (() => {
            const r_0 = p.r_0;
            const sz = r_0 * 0.12 * zoom();
            const circleR = sz * 0.2;
            const triTopY = circleR + sz * 0.05;
            const triBotY = sz * 1.35;
            const hw = sz * 1.3;
            const baseY = triBotY;
            const hatchLen = sz * 0.5;
            const nHatch = 5;

            return (
              <g>
                {/* 铰链小圆圈（空心） */}
                <circle cx={0} cy={0} r={circleR} fill="none" stroke="#4B5563" stroke-width={0.7 * zoom()} />
                {/* 三角形支座（实心） */}
                <polygon
                  points={`0,${triTopY} ${-sz},${triBotY} ${sz},${triBotY}`}
                  fill="#4B5563"
                />
                {/* 底座横线 */}
                <line x1={-hw} y1={baseY} x2={hw} y2={baseY} stroke="#4B5563" stroke-width={1 * zoom()} />
                {/* 斜线阴影 */}
                {Array.from({ length: nHatch }).map((_, j) => {
                  const x0 = -hw + (2 * hw) * (j + 0.5) / nHatch;
                  return (
                    <line
                      x1={x0}
                      y1={baseY}
                      x2={x0 - hatchLen * 0.6}
                      y2={baseY + hatchLen}
                      stroke="#4B5563"
                      stroke-width={0.5 * zoom()}
                    />
                  );
                })}
              </g>
            );
          })()
        }
      </svg>

      {/* 信息面板 */}
      <div class="absolute top-3 right-3 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-lg p-3 text-xs">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1">
          <span class="text-gray-500 dark:text-gray-400">{t().info.angle}:</span>
          <span class="font-medium text-gray-900 dark:text-white tabular-nums w-16 text-right">{frameData()?.angleDeg.toFixed(1) ?? 0}°</span>
          <span class="text-gray-500 dark:text-gray-400">{t().info.displacement}:</span>
          <span class="font-medium text-gray-900 dark:text-white tabular-nums w-16 text-right">{frameData()?.sI.toFixed(3) ?? 0} mm</span>
          <span class="text-gray-500 dark:text-gray-400">{t().info.pressureAngle}:</span>
          <span class="font-medium text-gray-900 dark:text-white tabular-nums w-16 text-right">{frameData()?.alphaI.toFixed(2) ?? 0}°</span>
        </div>
      </div>

      {/* 播放控制 */}
      <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-white/90 dark:bg-gray-800/90 rounded-full px-3 sm:px-4 py-2 shadow-lg">
        <button
          type="button"
          onClick={togglePlay}
          class="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors touch-manipulation"
        >
          <Show when={playing()} fallback={
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          }>
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          </Show>
        </button>

        <input
          type="range"
          min={0}
          max={maxFrame()}
          value={frame()}
          onInput={(e) => {
            const newFrame = parseInt(e.currentTarget.value);
            setFrame(Math.min(newFrame, maxFrame()));
          }}
          class="w-24 sm:w-32 h-2 bg-gray-300 dark:bg-gray-600 rounded-full appearance-none cursor-pointer"
        />

        <span class="text-xs text-gray-500 dark:text-gray-400 w-10 text-center">
          {frameData()?.angleDeg.toFixed(0) ?? 0}°
        </span>

        <select
          value={speed()}
          onChange={(e) => setSpeed(parseInt(e.currentTarget.value))}
          class="text-xs bg-transparent border-none text-gray-500 dark:text-gray-400 cursor-pointer min-h-[44px]"
        >
          <option value="1">1x</option>
          <option value="2">2x</option>
          <option value="3">3x</option>
          <option value="5">5x</option>
          <option value="10">10x</option>
        </select>
      </div>

      {/* 缩放控制 - 移动端隐藏，使用双指缩放手势 */}
      <div class="hidden sm:flex absolute bottom-3 right-3 items-center gap-2 bg-white/90 dark:bg-gray-800/90 rounded-full px-3 py-1.5 shadow-lg">
        <button
          type="button"
          onClick={() => setZoom(Math.max(0.1, zoom() - 0.05))}
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" d="M20 12H4" />
          </svg>
        </button>

        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={zoom()}
          onInput={(e) => setZoom(parseFloat(e.currentTarget.value))}
          class="w-20 h-2 bg-gray-300 dark:bg-gray-600 rounded-full appearance-none cursor-pointer"
        />

        <button
          type="button"
          onClick={() => setZoom(Math.min(1, zoom() + 0.05))}
          class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 text-gray-500 dark:text-gray-400 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}