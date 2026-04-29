// CamForge TypeScript 类型定义

/**
 * 运动规律枚举
 *
 * 定义凸轮机构常用的 6 种标准运动规律。
 */
export enum MotionLaw {
  /** 等速运动 - 速度恒定，加速度在端点处有突变 */
  ConstantVelocity = 1,
  /** 等加速等减速 - 加速度恒定，速度线性变化 */
  ConstantAccel = 2,
  /** 简谐运动 - 按余弦规律运动，加速度连续 */
  SimpleHarmonic = 3,
  /** 摆线运动 - 按正弦规律运动，加速度平滑 */
  Cycloidal = 4,
  /** 3-4-5 多项式 - 位移、速度、加速度均连续 */
  Polynomial345 = 5,
  /** 4-5-6-7 多项式 - 位移、速度、加速度、加加速度均连续 */
  Polynomial4567 = 6,
}

/**
 * 运动规律名称映射（支持国际化）
 */
export const MotionLawNames: Record<MotionLaw, { zh: string; en: string }> = {
  [MotionLaw.ConstantVelocity]: { zh: '等速运动', en: 'Uniform Motion' },
  [MotionLaw.ConstantAccel]: { zh: '等加速等减速', en: 'Constant Acceleration' },
  [MotionLaw.SimpleHarmonic]: { zh: '简谐运动', en: 'Simple Harmonic' },
  [MotionLaw.Cycloidal]: { zh: '摆线运动', en: 'Cycloidal' },
  [MotionLaw.Polynomial345]: { zh: '3-4-5 多项式', en: '3-4-5 Polynomial' },
  [MotionLaw.Polynomial4567]: { zh: '4-5-6-7 多项式', en: '4-5-6-7 Polynomial' },
};

/// 凸轮设计参数
export interface CamParams {
  delta_0: number;        // 推程运动角 (度)
  delta_01: number;       // 远休止角 (度)
  delta_ret: number;      // 回程运动角 (度)
  delta_02: number;       // 近休止角 (度)
  h: number;              // 推杆最大位移 (mm)
  r_0: number;            // 基圆半径 (mm)
  e: number;              // 偏距 (mm)
  omega: number;          // 凸轮角速度 (rad/s)
  r_r: number;            // 滚子半径 (mm)
  n_points: number;       // 离散点数
  alpha_threshold: number;// 压力角阈值 (度)
  tc_law: MotionLaw;      // 推程运动规律
  hc_law: MotionLaw;      // 回程运动规律
  sn: number;             // 旋向符号 (+1 顺时针, -1 逆时针)
  pz: number;             // 偏距符号 (+1 正偏距, -1 负偏距)
}

/// 完整模拟数据
export interface SimulationData {
  delta_deg: number[];
  s: number[];
  v: number[];
  a: number[];
  ds_ddelta: number[];
  phase_bounds: number[];
  x: number[];
  y: number[];
  x_actual: number[];
  y_actual: number[];
  rho: number[];           // 理论轮廓曲率半径
  rho_actual: number[];    // 实际轮廓曲率半径（滚子从动件）
  alpha_all: number[];
  s_0: number;
  r_max: number;
  max_alpha: number;
  min_rho: number | null;
  min_rho_idx: number;
  min_rho_actual: number | null;  // 实际轮廓最小曲率半径
  min_rho_actual_idx: number;
  h: number;
}

/// 显示选项
export interface DisplayOptions {
  showTangent: boolean;
  showNormal: boolean;
  showPressureArc: boolean;
  showCenterLine: boolean;
  showBaseCircle: boolean;
  showOffsetCircle: boolean;
  showUpperLimit: boolean;
  showLowerLimit: boolean;
  showNodes: boolean;
  showBoundaries: boolean;
}
