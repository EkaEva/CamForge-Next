// Fallback: mirrors camforge-core::compute_full_motion. Keep formulas in sync with Rust.
import type { CamParams, SimulationData } from '../../types';
import { FollowerType } from '../../types';
import { computeMotion } from '../../services/motion';
import { arrayMax, arrayMaxBy, arrayMinBy, filterFinite, findIndex } from '../../utils/array';
import { EPSILON } from '../../constants/numeric';

export function computeSimulationLocally(p: CamParams): SimulationData {
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

    let si: number, vi: number, ai: number;

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

  const isOscillating = p.follower_type === FollowerType.OscillatingRoller || p.follower_type === FollowerType.OscillatingFlatFaced;
  const isOscillatingFlatFaced = p.follower_type === FollowerType.OscillatingFlatFaced;

  // s_0 和理论廓形计算
  let s_0: number;
  const x: number[] = [];
  const y: number[] = [];

  if (isOscillating) {
    // 摆动从动件：余弦定理求 s_0
    const delta0Rad = p.initial_angle * Math.PI / 180;
    s_0 = Math.sqrt(
      p.pivot_distance * p.pivot_distance + p.arm_length * p.arm_length
      - 2 * p.pivot_distance * p.arm_length * Math.cos(delta0Rad)
    );

    // 摆动轮廓公式（对应 Rust compute_oscillating_profile）
    for (let i = 0; i < n; i++) {
      const delta = (2 * Math.PI * i) / n;
      const psi = s[i] / p.arm_length;
      const angle = delta0Rad + psi - delta;
      x.push(-p.sn * (p.pivot_distance * Math.cos(delta) - p.arm_length * Math.cos(angle)));
      y.push(-p.pivot_distance * Math.sin(delta) + p.arm_length * Math.sin(angle));
    }
  } else {
    // 直动从动件
    s_0 = Math.sqrt(p.r_0 * p.r_0 - p.e * p.e);

    for (let i = 0; i < n; i++) {
      const delta = (2 * Math.PI * i) / n;
      const sp = s_0 + s[i];
      let xi = sp * Math.sin(delta) + p.pz * p.e * Math.cos(delta);
      const yi = sp * Math.cos(delta) - p.pz * p.e * Math.sin(delta);
      xi = -p.sn * xi;
      x.push(xi);
      y.push(yi);
    }
  }

  // 实际廓形计算
  let x_actual: number[] = [];
  let y_actual: number[] = [];

  if (isOscillatingFlatFaced) {
    // 摆动平底实际廓形（对应 Rust compute_oscillating_flat_faced_profile）
    const delta0Rad = p.initial_angle * Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const delta = (2 * Math.PI * i) / n;
      const psi = s[i] / p.arm_length;
      const angle = delta0Rad + psi - delta;
      const contactOffset = ds_ddelta[i] - p.flat_face_offset;
      x_actual.push(x[i] + (-p.sn * contactOffset * Math.sin(angle)));
      y_actual.push(y[i] + (contactOffset * Math.cos(angle)));
    }
  } else if (p.follower_type === FollowerType.TranslatingFlatFaced) {
    // 直动平底实际廓形
    for (let i = 0; i < n; i++) {
      const delta = (2 * Math.PI * i) / n;
      const sp = s_0 + s[i];
      // 实际廓形 = 理论廓形 + ds/dδ 沿平底方向偏移
      const contactOffset = ds_ddelta[i] - p.flat_face_offset;
      const xa = sp * Math.sin(delta) + p.pz * p.e * Math.cos(delta) + contactOffset * Math.cos(delta);
      const ya = sp * Math.cos(delta) - p.pz * p.e * Math.sin(delta) - contactOffset * Math.sin(delta);
      x_actual.push(-p.sn * xa);
      y_actual.push(ya);
    }
  } else if (p.r_r > 0) {
    // 滚子从动件（直动/摆动）：等距偏移
    for (let i = 0; i < n; i++) {
      const iPrev = (i - 1 + n) % n;
      const iNext = (i + 1) % n;
      const dx = x[iNext] - x[iPrev];
      const dy = y[iNext] - y[iPrev];
      const lenT = Math.hypot(dx, dy);

      if (lenT < EPSILON) {
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
  } else {
    // 尖底从动件，实际廓形即理论廓形
    x_actual = [...x];
    y_actual = [...y];
  }

  // 计算压力角
  const alpha_all: number[] = [];
  if (isOscillating && !isOscillatingFlatFaced) {
    // 摆动滚子压力角: α = arctan(|L·dψ/dδ| / |a·sin(δ₀+ψ)|)
    const delta0Rad = p.initial_angle * Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const psi = s[i] / p.arm_length;
      const dpsiDd = ds_ddelta[i] / p.arm_length;
      const denom = p.pivot_distance * Math.sin(delta0Rad + psi);
      const numer = p.arm_length * dpsiDd;
      alpha_all.push(Math.abs(denom) < EPSILON ? 90 : Math.abs(Math.atan(numer / denom)) * 180 / Math.PI);
    }
  } else if (isOscillatingFlatFaced || p.follower_type === FollowerType.TranslatingFlatFaced) {
    // 平底从动件压力角为 0
    for (let i = 0; i < n; i++) {
      alpha_all.push(0);
    }
  } else {
    // 直动滚子/尖底: α = arctan((ds/dδ - pz·e) / (s₀ + s))
    for (let i = 0; i < n; i++) {
      const sp = s_0 + s[i];
      const dsd = ds_ddelta[i];
      const tanAlpha = (dsd - p.pz * p.e) / sp;
      alpha_all.push(Math.abs(Math.atan(tanAlpha) * 180 / Math.PI));
    }
  }

  const r_max = arrayMaxBy(x, (xi, i) => Math.sqrt(xi * xi + y[i] * y[i]));
  const max_alpha = arrayMax(alpha_all);

  // 摆动从动件：应用安装偏角 gamma 旋转轮廓
  // gamma 不改变轮廓形状，只改变朝向；压力角是旋转不变量
  if (isOscillating && Math.abs(p.gamma) > EPSILON) {
    const gammaRad = p.gamma * Math.PI / 180;
    const cosG = Math.cos(gammaRad);
    const sinG = Math.sin(gammaRad);
    for (let i = 0; i < n; i++) {
      const xi = x[i], yi = y[i];
      x[i] = xi * cosG - yi * sinG;
      y[i] = xi * sinG + yi * cosG;
      const xai = x_actual[i], yai = y_actual[i];
      x_actual[i] = xai * cosG - yai * sinG;
      y_actual[i] = xai * sinG + yai * cosG;
    }
  }

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
    if (speedCubed > EPSILON && Math.abs(cross) > EPSILON) {
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

  // NaN/Infinity 检测
  const hasNonFinite =
    s.some(val => !Number.isFinite(val)) ||
    x.some(val => !Number.isFinite(val)) ||
    y.some(val => !Number.isFinite(val));
  const computationError = hasNonFinite
    ? 'Simulation produced non-finite values — check input parameters (e.g. base radius too small, stroke too large, or invalid motion law combination)'
    : undefined;

  if (hasNonFinite) {
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
    has_concave_region: rho.some(r => r < 0 && isFinite(r)),
    flat_face_min_half_width: arrayMax(ds_ddelta.map(v => Math.abs(v - p.flat_face_offset))),
    computationError,
  };
}
