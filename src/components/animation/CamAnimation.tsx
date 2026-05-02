import { createSignal, createMemo, onCleanup, onMount, Show, createEffect } from 'solid-js';
import { simulationData, params, displayOptions, cursorFrame, setCursorFrame } from '../../stores/simulation';
import { t } from '../../i18n';
import { TARGET_FPS, EPSILON, ZOOM_MIN, ZOOM_MAX } from '../../constants/numeric';
import { FollowerType } from '../../types';
import { Icon } from '../ui/Icon';
import { useWindowSize } from '../../hooks/useWindowSize';

interface CamAnimationProps {
  isActive?: boolean;
  onZoomChange?: (zoom: number) => void;
}

export function CamAnimation(props: CamAnimationProps) {
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal(3);
  const [zoom, setZoom] = createSignal(1.0);

  // Responsive chart padding (must match chart components)
  const windowSize = useWindowSize();
  const chartPadding = createMemo(() => {
    const w = windowSize().width;
    if (w < 640) return { left: 45, right: 20 };
    if (w < 768) return { left: 55, right: 50 };
    return { left: 70, right: 70 };
  });

  // Use shared cursorFrame as frame source
  const frame = cursorFrame;
  const setFrame = setCursorFrame;

  // Notify parent of zoom changes
  createEffect(() => {
    const z = zoom();
    props.onZoomChange?.(z);
  });

  // Mouse wheel zoom handler
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom() + delta)));
  };

  let animationId: number | undefined;
  let lastTime = 0;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  let lastFrameTime = 0;

  // 触摸手势状态
  let touchStartDistance = 0;
  let touchStartZoom = 1;
  let touchStartX = 0;

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

  // 当切换回 cam profile 标签页时，立即重绘当前帧
  createEffect(() => {
    if (props.isActive) {
      // Trigger immediate redraw by re-setting the current frame
      setFrame(frame());
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

    const isFlatFaced = p.follower_type === FollowerType.TranslatingFlatFaced || p.follower_type === FollowerType.OscillatingFlatFaced;
    const isOscillating = p.follower_type === FollowerType.OscillatingRoller || p.follower_type === FollowerType.OscillatingFlatFaced;
    const useActual = r_r > 0 || isFlatFaced;
    const profileX = useActual ? x_actual : x;
    const profileY = useActual ? y_actual : y;

    // Direct-frame animation: rotate cam, fixed follower
    const [xRotTheory, yRotTheory] = getRotatedCam(x, y, angleRad);
    const [xRot, yRot] = getRotatedCam(profileX, profileY, angleRad);

    const followerX = -sn * pz * e;

    // Contact point and oscillating geometry
    let contactX: number;
    let contactY: number;
    let pivotX = 0;
    let pivotY = 0;
    let armAngle = 0;

    if (isOscillating) {
      // Direct-frame: cam rotates, pivot is fixed.
      // Compute contact point directly from pivot position and arm kinematics.
      const gammaRad = p.gamma * Math.PI / 180;
      pivotX = -p.pivot_distance * Math.cos(gammaRad);
      pivotY = -p.pivot_distance * Math.sin(gammaRad);

      // Arm angle = initial_angle + angular displacement ψ = s/L
      const delta0Rad = p.initial_angle * Math.PI / 180;
      const psi_i = s[frameIdx] / p.arm_length;
      const armAngleRad = delta0Rad + psi_i;

      // Arm endpoint / roller center
      contactX = pivotX + p.arm_length * Math.cos(armAngleRad);
      contactY = pivotY + p.arm_length * Math.sin(armAngleRad);
      armAngle = armAngleRad;
    } else if (isFlatFaced) {
      // Translating flat-faced: contact point offset by ds/ddelta from follower axis
      contactX = followerX + ds_ddelta[frameIdx];
      contactY = s_0 + s[frameIdx];
    } else {
      // Translating roller/knife-edge: contact on follower axis
      contactX = followerX;
      contactY = s_0 + s[frameIdx];
    }

    // Tangent and normal computation
    // For both oscillating (inverted frame) and translating (direct frame),
    // compute tangent from the profile that is displayed (fixed or rotated).
    const iPrev = (frameIdx - 1 + n) % n;
    const iNext = (frameIdx + 1) % n;
    let tx = xRotTheory[iNext] - xRotTheory[iPrev];
    let ty = yRotTheory[iNext] - yRotTheory[iPrev];
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
    const dot1 = (0 - contactX) * nx1 + (0 - contactY) * ny1;
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
      contactX,
      contactY,
      pivotX,
      pivotY,
      armAngle,
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
    const isFlatFaced = p.follower_type === FollowerType.TranslatingFlatFaced || p.follower_type === FollowerType.OscillatingFlatFaced;
    // Show theory profile when actual profile differs from theory:
    // - Roller followers (r_r > 0): actual is offset inward by r_r
    // - Flat-faced followers: actual is envelope, theory is contact trajectory
    if (p.r_r <= 0 && !isFlatFaced) return false;
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
  const animate = (timestamp: number) => {
    // Frame rate limiting
    const elapsed = timestamp - lastFrameTime;
    if (elapsed < FRAME_INTERVAL) {
      animationId = requestAnimationFrame(animate);
      return;
    }
    lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);

    const data = simulationData();
    const isPlaying = playing();
    const currentSpeed = speed();
    const currentFrame = frame();
    const max = maxFrame();

    // 如果组件不可用，暂停动画循环；如果不在 cam profile 标签页，跳过绘制但保持循环运行
    if (!data || max === 0) {
      animationId = requestAnimationFrame(animate);
      return;
    }
    if (!props.isActive) {
      animationId = requestAnimationFrame(animate);
      return;
    }

    const frameElapsed = timestamp - lastTime;
    const delay = 200 / currentSpeed ** 1.5;

    if (isPlaying && frameElapsed > delay) {
      const safeFrame = Math.min(currentFrame, max);
      const newFrame = safeFrame >= max ? 0 : safeFrame + 1;
      setFrame(newFrame);
      lastTime = timestamp;
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
    lastFrameTime = performance.now();
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
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      // 双指缩放
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
      if (touchStartDistance > 0) {
        const scale = currentDistance / touchStartDistance;
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, touchStartZoom * scale));
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

  return (
    <Show when={data} fallback={
      <div class="w-full h-full flex items-center justify-center text-on-surface-variant text-sm bg-surface-container-lowest rounded-lg font-display">
        {t().mainCanvas.clickToStart}
      </div>
    }>
      <div
        class="relative w-full h-full bg-surface-container-lowest drafting-grid rounded-lg overflow-hidden touch-manipulation"
        role="img"
        aria-label={t().tabs.camProfile}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onWheel={handleWheel}
      >
      <svg viewBox={viewBoxData().viewBox} class="w-full h-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {/* Coordinate axes and tick marks */}
        <Show when={displayOptions().showCenterLine}>
          {(() => {
            const rMax = viewBoxData().r_max;
            const z = zoom();
            const extent = rMax * z;
            const tickSpacing = 10 * z;
            const nTicks = Math.floor(extent / tickSpacing);
            return (
              <g>
                <line x1={-extent} y1={0} x2={extent} y2={0} stroke="var(--outline)" stroke-width={0.6 * z} />
                <line x1={0} y1={-extent} x2={0} y2={extent} stroke="var(--outline)" stroke-width={0.6 * z} />
                <circle cx={0} cy={0} r={1.5 * z} fill="var(--outline)" />
                {Array.from({ length: nTicks }, (_, i) => {
                  const pos = (i + 1) * tickSpacing;
                  return (
                    <g>
                      <line x1={pos} y1={-1.5 * z} x2={pos} y2={1.5 * z} stroke="var(--outline-variant)" stroke-width={0.4 * z} />
                      <line x1={-pos} y1={-1.5 * z} x2={-pos} y2={1.5 * z} stroke="var(--outline-variant)" stroke-width={0.4 * z} />
                      <line x1={-1.5 * z} y1={pos} x2={1.5 * z} y2={pos} stroke="var(--outline-variant)" stroke-width={0.4 * z} />
                      <line x1={-1.5 * z} y1={-pos} x2={1.5 * z} y2={-pos} stroke="var(--outline-variant)" stroke-width={0.4 * z} />
                    </g>
                  );
                })}
              </g>
            );
          })()}
        </Show>
        {/* 基圆 */}
        <Show when={displayOptions().showBaseCircle}>
          <circle cx="0" cy="0" r={data!.s_0 * zoom()} fill="none" stroke="var(--outline-variant)" stroke-width={0.5 * zoom()} stroke-dasharray="2,2" />
        </Show>

        {/* 偏距圆 */}
        <Show when={displayOptions().showOffsetCircle && params().e !== 0}>
          <circle cx="0" cy="0" r={Math.abs(params().e) * zoom()} fill="none" stroke="var(--outline-variant)" stroke-width={0.5 * zoom()} stroke-dasharray="2,2" />
        </Show>

        {/* 理论轮廓（滚子从动件时显示） */}
        <Show when={shouldShowTheoryProfile()}>
          <path d={theoryCamPath()} fill="none" stroke="#FFB6C1" stroke-width={0.5 * zoom()} stroke-dasharray="4,2" />
        </Show>

        {/* 凸轮轮廓 */}
        <path d={camPath()} fill="none" stroke="#EF4444" stroke-width={0.8 * zoom()} />

        {/* 推杆 */}
        {(() => {
          const fd = frameData()!;
          const z = zoom();
          const p2 = params();
          const r_0 = p2.r_0;
          const cxSvg = fd.contactX * z;
          const cySvg = -fd.contactY * z;

          const flatFacedFollower = (
            <>
              {/* 平底线段（以从动件轴线为中心） */}
              <line
                x1={(fd.followerX + p2.flat_face_offset) * z - (data ? data.flat_face_min_half_width > 0 ? data.flat_face_min_half_width * 1.3 : r_0 * 0.3 : r_0 * 0.3) * z} y1={cySvg}
                x2={(fd.followerX + p2.flat_face_offset) * z + (data ? data.flat_face_min_half_width > 0 ? data.flat_face_min_half_width * 1.3 : r_0 * 0.3 : r_0 * 0.3) * z} y2={cySvg}
                stroke="var(--on-surface)" stroke-width={1.2 * z}
              />
              {/* 竖直杆身（从动件轴线） */}
              <line
                x1={(fd.followerX + p2.flat_face_offset) * z} y1={cySvg}
                x2={(fd.followerX + p2.flat_face_offset) * z} y2={cySvg - viewBoxData().r_max * 0.3 * z}
                stroke="var(--on-surface)" stroke-width={0.8 * z}
              />
              {/* 实际接触点标记（在平底上偏置 ds/ddelta） */}
              <circle cx={cxSvg} cy={cySvg} r={r_0 * 0.025 * z}
                fill="var(--primary)" />
            </>
          );

          const oscillatingFollower = (() => {
            const pxSvg = fd.pivotX * z;
            const pySvg = -fd.pivotY * z;
            const armLen = Math.hypot(cxSvg - pxSvg, cySvg - pySvg);
            const cosA = armLen > EPSILON ? (cxSvg - pxSvg) / armLen : 1;
            const sinA = armLen > EPSILON ? (cySvg - pySvg) / armLen : 0;
            const faceCenterX = cxSvg + p2.flat_face_offset * z * sinA;
            const faceCenterY = cySvg - p2.flat_face_offset * z * cosA;

            const pivDist = Math.hypot(pxSvg, pySvg);
            const supCos = pivDist > EPSILON ? pxSvg / pivDist : 0;
            const supSin = pivDist > EPSILON ? pySvg / pivDist : 1;
            const sz = r_0 * 0.12 * z;
            const circleR = sz * 0.2;
            const triBase = circleR + sz * 0.05;
            const triHeight = sz * 1.35;
            const hw = sz * 1.3;
            const hatchLen = sz * 0.5;
            const nHatch = 5;

            const triTopX = pxSvg + supCos * triBase;
            const triTopY = pySvg + supSin * triBase;
            const triBotX = pxSvg + supCos * triHeight;
            const triBotY = pySvg + supSin * triHeight;
            const perpX2 = -supSin;
            const perpY2 = supCos;

            return (
              <>
                {/* 臂 */}
                <line
                  x1={pxSvg} y1={pySvg}
                  x2={cxSvg} y2={cySvg}
                  stroke="var(--on-surface)" stroke-width={0.8 * z}
                />
                {/* 滚子/平底端 */}
                {p2.follower_type === FollowerType.OscillatingRoller ? (
                  <>
                    <circle cx={cxSvg} cy={cySvg} r={p2.r_r * z}
                      fill="none" stroke="var(--on-surface)" stroke-width={0.8 * z} />
                    <circle cx={cxSvg} cy={cySvg} r={r_0 * 0.02 * z}
                      fill="var(--on-surface)" />
                  </>
                ) : (
                  // 平底线段（垂直于臂）
                  <line
                    x1={faceCenterX - r_0 * 0.25 * z * sinA} y1={faceCenterY + r_0 * 0.25 * z * cosA}
                    x2={faceCenterX + r_0 * 0.25 * z * sinA} y2={faceCenterY - r_0 * 0.25 * z * cosA}
                    stroke="var(--on-surface)" stroke-width={1.2 * z}
                  />
                )}
                {/* 固定铰支座 */}
                <circle cx={pxSvg} cy={pySvg} r={circleR}
                  fill="none" stroke="var(--on-surface)" stroke-width={0.7 * z} />
                <polygon
                  points={`${triTopX},${triTopY} ${triBotX - perpX2 * sz},${triBotY - perpY2 * sz} ${triBotX + perpX2 * sz},${triBotY + perpY2 * sz}`}
                  fill="var(--on-surface)"
                />
                <line
                  x1={triBotX - perpX2 * hw} y1={triBotY - perpY2 * hw}
                  x2={triBotX + perpX2 * hw} y2={triBotY + perpY2 * hw}
                  stroke="var(--on-surface)" stroke-width={1 * z}
                />
                {Array.from({ length: nHatch }).map((_, j) => {
                  const frac = (j + 0.5) / nHatch;
                  const bx = triBotX + perpX2 * hw * (2 * frac - 1);
                  const by = triBotY + perpY2 * hw * (2 * frac - 1);
                  return (
                    <line
                      x1={bx} y1={by}
                      x2={bx + supCos * hatchLen} y2={by + supSin * hatchLen}
                      stroke="var(--on-surface)" stroke-width={0.5 * z}
                    />
                  );
                })}
              </>
            );
          })();

          const rollerFollower = (
            <>
              {/* 滚子外圈 */}
              <circle
                cx={cxSvg} cy={cySvg}
                r={p2.r_r * z}
                fill="none" stroke="var(--on-surface)" stroke-width={0.8 * z}
              />
              {/* 滚子中心点 */}
              <circle
                cx={cxSvg} cy={cySvg}
                r={r_0 * 0.02 * z}
                fill="var(--on-surface)"
              />
              {/* 推杆杆身 */}
              <line
                x1={cxSvg} y1={cySvg}
                x2={cxSvg} y2={cySvg - viewBoxData().r_max * 0.3 * z}
                stroke="var(--on-surface)" stroke-width={0.8 * z}
              />
            </>
          );

          const knifeEdgeFollower = (
            <>
              <polygon
                points={`${cxSvg - r_0 * 0.075 * z},${cySvg - r_0 * 0.1 * z} ${cxSvg},${cySvg - 0.4 * z} ${cxSvg + r_0 * 0.075 * z},${cySvg - r_0 * 0.1 * z}`}
                fill="var(--on-surface)"
                stroke="var(--on-surface)"
                stroke-width={0.8 * z}
              />
              <line
                x1={cxSvg} y1={cySvg - r_0 * 0.1 * z}
                x2={cxSvg} y2={cySvg - viewBoxData().r_max * 0.3 * z}
                stroke="var(--on-surface)" stroke-width={0.8 * z}
              />
            </>
          );

          return p2.follower_type === FollowerType.TranslatingFlatFaced ? flatFacedFollower
            : p2.follower_type === FollowerType.OscillatingRoller || p2.follower_type === FollowerType.OscillatingFlatFaced ? oscillatingFollower
            : p2.r_r > 0 ? rollerFollower
            : knifeEdgeFollower;
        })()}

        {/* 切线 */}
        <Show when={displayOptions().showTangent && frameData()}>
          <line
            x1={(frameData()!.contactX - p.r_0 * frameData()!.tx) * zoom()}
            y1={(-frameData()!.contactY + p.r_0 * frameData()!.ty) * zoom()}
            x2={(frameData()!.contactX + p.r_0 * frameData()!.tx) * zoom()}
            y2={(-frameData()!.contactY - p.r_0 * frameData()!.ty) * zoom()}
            stroke="#10B981"
            stroke-width={0.3 * zoom()}
          />
        </Show>

        {/* 法线 */}
        <Show when={(displayOptions().showNormal || displayOptions().showPressureArc) && frameData()}>
          <line
            x1={(frameData()!.contactX + p.r_0 * frameData()!.nx) * zoom()}
            y1={(-frameData()!.contactY - p.r_0 * frameData()!.ny) * zoom()}
            x2={(frameData()!.contactX - p.r_0 * frameData()!.nx) * zoom()}
            y2={(-frameData()!.contactY + p.r_0 * frameData()!.ny) * zoom()}
            stroke="#F59E0B"
            stroke-width={0.3 * zoom()}
          />
        </Show>

        {/* 中心线（压力角弧显示时） */}
        <Show when={displayOptions().showPressureArc && frameData() && frameData()!.alphaI > 0.5}>
          <line
            x1={frameData()!.contactX * zoom()}
            y1={-frameData()!.contactY * zoom()}
            x2={frameData()!.contactX * zoom()}
            y2={(-frameData()!.contactY + p.r_0 * 0.5) * zoom()}
            stroke="var(--on-surface)"
            stroke-width={0.3 * zoom()}
          />
        </Show>

        {/* 压力角弧 */}
        <Show when={displayOptions().showPressureArc && frameData() && frameData()!.alphaI > 0.5}>
          <path
            d={generateArcPath(
              frameData()!.contactX * zoom(),
              -frameData()!.contactY * zoom(),
              frameData()!.nx,
              frameData()!.ny,
              frameData()!.alphaI,
              p.r_0 * 0.3 * zoom()
            )}
            fill="none"
            stroke="var(--on-surface)"
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
            {simulationData()!.phase_bounds.slice(1).map((bound) => {
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
            {simulationData()!.phase_bounds.slice(1).map((bound) => {
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
                  stroke="var(--outline-variant)"
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
                <circle cx={0} cy={0} r={circleR} fill="none" stroke="var(--on-surface)" stroke-width={0.7 * zoom()} />
                {/* 三角形支座（实心） */}
                <polygon
                  points={`0,${triTopY} ${-sz},${triBotY} ${sz},${triBotY}`}
                  fill="var(--on-surface)"
                />
                {/* 底座横线 */}
                <line x1={-hw} y1={baseY} x2={hw} y2={baseY} stroke="var(--on-surface)" stroke-width={1 * zoom()} />
                {/* 斜线阴影 */}
                {Array.from({ length: nHatch }).map((_, j) => {
                  const x0 = -hw + (2 * hw) * (j + 0.5) / nHatch;
                  return (
                    <line
                      x1={x0}
                      y1={baseY}
                      x2={x0 - hatchLen * 0.6}
                      y2={baseY + hatchLen}
                      stroke="var(--on-surface)"
                      stroke-width={0.5 * zoom()}
                    />
                  );
                })}
              </g>
            );
          })()
        }
      </svg>

      {/* Bottom playback bar */}
      <div class="absolute bottom-0 inset-x-0 h-10 flex items-center gap-2" style={{ 'background-color': 'var(--chrome-bg)', 'border-top': '1px solid var(--chrome-border)' }}>
        {/* Left padding zone: play button inside chart left margin */}
        <div class="flex items-center justify-end pr-1 shrink-0" style={{ width: `${chartPadding().left}px` }}>
          <button
            type="button"
            onClick={togglePlay}
            class="w-7 h-7 flex items-center justify-center rounded-full text-chrome-text-active transition-all duration-200 touch-manipulation hover:bg-chrome-surface-hover hover:shadow-md hover:-translate-y-0.5 active:bg-chrome-active active:translate-y-0 active:shadow-none active:scale-90"
          >
            <Show when={playing()} fallback={
              <Icon name="play_arrow" size={18} fill />
            }>
              <Icon name="pause" size={18} fill />
            </Show>
          </button>
        </div>

        {/* Slider - exactly spans chart plot area */}
        <input
          type="range"
          min={0}
          max={maxFrame()}
          value={frame()}
          onInput={(e) => {
            const newFrame = parseInt(e.currentTarget.value);
            setFrame(Math.min(newFrame, maxFrame()));
          }}
          class="flex-1 min-w-0 h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            'background-color': 'var(--chrome-border)',
            'accent-color': 'var(--chrome-text-active)',
          }}
        />

        {/* Right padding zone: partial spacer */}
        <div class="shrink-0" style={{ width: `${Math.round(chartPadding().right * 0.4)}px` }} />

        {/* Controls outside chart area */}
        <span class="text-xs text-chrome-text-active font-display tabular-nums whitespace-nowrap shrink-0">
          {(frameData()?.angleDeg.toFixed(0) ?? '0').padStart(3, ' ')}°/360°
        </span>
        <select
          value={speed()}
          onChange={(e) => setSpeed(parseInt(e.currentTarget.value))}
          class="text-xs font-display cursor-pointer h-6 px-1 rounded border-none shrink-0 mr-3"
          style={{
            'background-color': 'var(--chrome-surface-hover)',
            'color': 'var(--chrome-text-active)',
          }}
        >
          <option value="1">1x</option>
          <option value="2">2x</option>
          <option value="3">3x</option>
          <option value="5">5x</option>
          <option value="10">10x</option>
        </select>
      </div>

    </div>
    </Show>
  );
}
