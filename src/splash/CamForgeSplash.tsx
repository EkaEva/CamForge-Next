import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion';

/* CamForge 设计系统色值 */
const COLORS = {
  bg: '#1c1b1b',
  surface: '#201f1f',
  surfaceHigh: '#2b2a2a',
  outline: '#8e9192',
  outlineVariant: '#444748',
  onSurface: '#e5e2e1',
  onSurfaceVariant: '#c4c7c7',
  primary: '#c8c6c5',
  camProfile: '#E07A5F',
  velocity: '#3D5A80',
  acceleration: '#5B8C5A',
};

/* 凸轮轮廓 SVG 路径（简化） */
const CamPath: React.FC<{ progress: number; color: string; strokeWidth: number }> = ({
  progress,
  color,
  strokeWidth,
}) => {
  const cx = 640;
  const cy = 380;
  const r0 = 80;
  const h = 40;
  const points = 120;
  const visiblePoints = Math.floor(points * progress);

  const getPoint = (i: number): [number, number] => {
    const angle = (i / points) * 2 * Math.PI;
    const s = h * (0.5 - 0.5 * Math.cos(angle));
    const r = r0 + s;
    return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
  };

  let d = '';
  for (let i = 0; i <= visiblePoints; i++) {
    const [x, y] = getPoint(i);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }
  if (progress >= 1) d += ' Z';

  return <path d={d} fill="none" stroke={color} stroke-width={strokeWidth} />;
};

export const CamForgeSplash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* 阶段划分：0-25 入场，25-65 展示，65-90 退场 */
  const camDrawProgress = interpolate(frame, [8, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleSpring = spring({ frame, fps, delay: 20, config: { damping: 12 } });
  const subtitleSpring = spring({ frame, fps, delay: 30, config: { damping: 14 } });
  const taglineSpring = spring({ frame, fps, delay: 40, config: { damping: 16 } });

  const fadeOut = interpolate(frame, [70, 88], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const camRotation = interpolate(frame, [45, 70], [0, 360], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* 网格背景 */}
      <svg
        style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.15 * fadeOut }}
      >
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke={COLORS.outlineVariant} stroke-width="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* 凸轮轮廓动画 */}
      <svg
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: fadeOut,
        }}
      >
        <g transform={`rotate(${camRotation}, 640, 380)`}>
          {/* 基圆虚线 */}
          <circle
            cx={640}
            cy={380}
            r={80}
            fill="none"
            stroke={COLORS.outlineVariant}
            stroke-width="0.8"
            stroke-dasharray="4,4"
          />
          {/* 凸轮轮廓 */}
          <CamPath progress={camDrawProgress} color={COLORS.camProfile} strokeWidth={2} />
        </g>
        {/* 固定支座 */}
        <circle cx={640} cy={380} r={3} fill="none" stroke={COLORS.onSurface} stroke-width="1.5" />
        <polygon
          points={`640,386 ${640 - 10},400 ${640 + 10},400`}
          fill={COLORS.onSurface}
          opacity={camDrawProgress > 0.3 ? 1 : 0}
        />
      </svg>

      {/* 文字层 */}
      <div
        style={{
          position: 'absolute',
          top: 120,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: fadeOut,
        }}
      >
        {/* CamForge 标题 */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: COLORS.onSurface,
            letterSpacing: '-0.02em',
            transform: `translateY(${interpolate(titleSpring, [0, 1], [30, 0])}px)`,
            opacity: titleSpring,
          }}
        >
          Cam
          <span style={{ color: COLORS.camProfile }}>Forge</span>
        </div>

        {/* 副标题 */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 400,
            color: COLORS.onSurfaceVariant,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginTop: 8,
            transform: `translateY(${interpolate(subtitleSpring, [0, 1], [20, 0])}px)`,
            opacity: subtitleSpring,
          }}
        >
          凸轮机构运动学仿真
        </div>

        {/* 版本标签 */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.outline,
            marginTop: 24,
            transform: `translateY(${interpolate(taglineSpring, [0, 1], [15, 0])}px)`,
            opacity: taglineSpring,
          }}
        >
          v0.4.0 · SolidJS + Tauri
        </div>
      </div>

      {/* 底部运动曲线装饰线 */}
      <Sequence from={35}>
        <svg
          style={{
            position: 'absolute',
            bottom: 80,
            left: 200,
            width: 880,
            height: 60,
            opacity: interpolate(frame - 35, [0, 15], [0, 0.4], {
              extrapolateRight: 'clamp',
            }) * fadeOut,
          }}
        >
          {/* 位移曲线 */}
          <path
            d="M 0 30 Q 110 10 220 30 Q 330 50 440 30 Q 550 10 660 30 Q 770 50 880 30"
            fill="none"
            stroke={COLORS.camProfile}
            stroke-width="1.5"
          />
          {/* 速度曲线 */}
          <path
            d="M 0 30 Q 110 5 220 30 Q 330 55 440 30 Q 550 5 660 30 Q 770 55 880 30"
            fill="none"
            stroke={COLORS.velocity}
            stroke-width="1"
            stroke-dasharray="6,4"
          />
          {/* 加速度曲线 */}
          <path
            d="M 0 30 Q 110 0 220 30 Q 330 60 440 30 Q 550 0 660 30 Q 770 60 880 30"
            fill="none"
            stroke={COLORS.acceleration}
            stroke-width="1"
            stroke-dasharray="2,3"
          />
        </svg>
      </Sequence>
    </AbsoluteFill>
  );
};
