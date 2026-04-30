/**
 * 运动规律计算服务
 *
 * 提供凸轮运动规律的计算功能，支持 6 种标准运动规律。
 */

import { MotionLaw } from '../types';

/**
 * 计算运动规律
 *
 * 根据给定的运动规律类型，计算归一化时间 t 处的位移、速度和加速度。
 *
 * @param law - 运动规律类型 (1-6)
 * @param t - 归一化时间 (0-1)
 * @param h - 最大位移 (mm)
 * @param omega - 角速度 (rad/s)
 * @param deltaRad - 运动角度 (rad)
 * @returns [位移, 速度, 加速度]
 *
 * @example
 * ```ts
 * // 计算简谐运动在 t=0.5 时的运动参数
 * const [s, v, a] = computeMotion(3, 0.5, 10, 1, Math.PI/2);
 * ```
 */
export function computeMotion(
  law: number,
  t: number,
  h: number,
  omega: number,
  deltaRad: number
): [number, number, number] {
  let s: number, v: number, a: number;

  switch (law) {
    case MotionLaw.ConstantVelocity: // 等速运动
      s = h * t;
      v = (h * omega) / deltaRad;
      a = 0;
      break;

    case MotionLaw.ConstantAccel: // 等加速等减速
      if (t < 0.5) {
        s = 2 * h * t * t;
        v = (4 * h * omega * t) / deltaRad;
        a = (4 * h * omega * omega) / (deltaRad * deltaRad);
      } else {
        s = h * (1 - 2 * (1 - t) * (1 - t));
        v = (4 * h * omega * (1 - t)) / deltaRad;
        a = (-4 * h * omega * omega) / (deltaRad * deltaRad);
      }
      break;

    case MotionLaw.SimpleHarmonic: // 简谐运动
      s = (h * (1 - Math.cos(Math.PI * t))) / 2;
      v = (h * omega * Math.PI * Math.sin(Math.PI * t)) / (2 * deltaRad);
      a =
        (h * omega * omega * Math.PI * Math.PI * Math.cos(Math.PI * t)) /
        (2 * deltaRad * deltaRad);
      break;

    case MotionLaw.Cycloidal: // 摆线运动
      s = h * (t - Math.sin(2 * Math.PI * t) / (2 * Math.PI));
      v = (h * omega * (1 - Math.cos(2 * Math.PI * t))) / deltaRad;
      a =
        (h * omega * omega * 2 * Math.PI * Math.sin(2 * Math.PI * t)) /
        (deltaRad * deltaRad);
      break;

    case MotionLaw.Polynomial345: // 3-4-5 多项式
      s = h * (10 * t * t * t - 15 * t * t * t * t + 6 * t * t * t * t * t);
      v =
        (h * omega * (30 * t * t - 60 * t * t * t + 30 * t * t * t * t)) /
        deltaRad;
      a =
        (h * omega * omega * (60 * t - 180 * t * t + 120 * t * t * t)) /
        (deltaRad * deltaRad);
      break;

    case MotionLaw.Polynomial4567: // 4-5-6-7 多项式
      const t2 = t * t;
      const t3 = t2 * t;
      const t4 = t3 * t;
      const t5 = t4 * t;
      const t6 = t5 * t;
      const t7 = t6 * t;
      s = h * (35 * t4 - 84 * t5 + 70 * t6 - 20 * t7);
      v =
        (h * omega * (140 * t3 - 420 * t4 + 420 * t5 - 140 * t6)) / deltaRad;
      a =
        (h * omega * omega * (420 * t2 - 1680 * t3 + 2100 * t4 - 840 * t5)) /
        (deltaRad * deltaRad);
      break;

    default:
      // 默认使用简谐运动
      s = (h * (1 - Math.cos(Math.PI * t))) / 2;
      v = (h * omega * Math.PI * Math.sin(Math.PI * t)) / (2 * deltaRad);
      a =
        (h * omega * omega * Math.PI * Math.PI * Math.cos(Math.PI * t)) /
        (2 * deltaRad * deltaRad);
  }

  return [s, v, a];
}

/**
 * 验证运动规律值是否有效
 */
export function isValidMotionLaw(law: number): boolean {
  return law >= 1 && law <= 6 && Number.isInteger(law);
}
