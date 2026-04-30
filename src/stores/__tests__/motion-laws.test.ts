import { describe, it, expect } from 'vitest';
import { MotionLaw } from '../../types';
import { computeMotion, isValidMotionLaw } from '../../services/motion';

describe('computeMotion', () => {
  const h = 10;
  const omega = 1;
  const deltaRad = Math.PI / 2;

  describe('等速运动 (law=1)', () => {
    it('t=0 时位移为 0', () => {
      const [s] = computeMotion(MotionLaw.ConstantVelocity, 0, h, omega, deltaRad);
      expect(s).toBe(0);
    });

    it('t=1 时位移为 h', () => {
      const [s] = computeMotion(MotionLaw.ConstantVelocity, 1, h, omega, deltaRad);
      expect(s).toBe(h);
    });

    it('加速度始终为 0', () => {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const [, , a] = computeMotion(MotionLaw.ConstantVelocity, t, h, omega, deltaRad);
        expect(a).toBe(0);
      }
    });
  });

  describe('等加速等减速 (law=2)', () => {
    it('t=0 时位移为 0', () => {
      const [s] = computeMotion(MotionLaw.ConstantAccel, 0, h, omega, deltaRad);
      expect(s).toBe(0);
    });

    it('t=1 时位移为 h', () => {
      const [s] = computeMotion(MotionLaw.ConstantAccel, 1, h, omega, deltaRad);
      expect(s).toBeCloseTo(h, 10);
    });

    it('t=0.5 时位移为 h/2', () => {
      const [s] = computeMotion(MotionLaw.ConstantAccel, 0.5, h, omega, deltaRad);
      expect(s).toBe(h / 2);
    });
  });

  describe('简谐运动 (law=3)', () => {
    it('t=0 时位移为 0', () => {
      const [s] = computeMotion(MotionLaw.SimpleHarmonic, 0, h, omega, deltaRad);
      expect(s).toBe(0);
    });

    it('t=1 时位移为 h', () => {
      const [s] = computeMotion(MotionLaw.SimpleHarmonic, 1, h, omega, deltaRad);
      expect(s).toBe(h);
    });

    it('t=0.5 时位移为 h/2', () => {
      const [s] = computeMotion(MotionLaw.SimpleHarmonic, 0.5, h, omega, deltaRad);
      expect(s).toBeCloseTo(h / 2, 10);
    });
  });

  describe('摆线运动 (law=4)', () => {
    it('t=0 时位移为 0', () => {
      const [s] = computeMotion(MotionLaw.Cycloidal, 0, h, omega, deltaRad);
      expect(s).toBe(0);
    });

    it('t=1 时位移为 h', () => {
      const [s] = computeMotion(MotionLaw.Cycloidal, 1, h, omega, deltaRad);
      expect(s).toBeCloseTo(h, 10);
    });
  });

  describe('3-4-5 多项式 (law=5)', () => {
    it('t=0 时位移为 0', () => {
      const [s] = computeMotion(MotionLaw.Polynomial345, 0, h, omega, deltaRad);
      expect(s).toBe(0);
    });

    it('t=1 时位移为 h', () => {
      const [s] = computeMotion(MotionLaw.Polynomial345, 1, h, omega, deltaRad);
      expect(s).toBe(h);
    });

    it('t=0 和 t=1 时速度为 0', () => {
      const [, v0] = computeMotion(MotionLaw.Polynomial345, 0, h, omega, deltaRad);
      const [, v1] = computeMotion(MotionLaw.Polynomial345, 1, h, omega, deltaRad);
      expect(v0).toBe(0);
      expect(v1).toBe(0);
    });
  });

  describe('4-5-6-7 多项式 (law=6)', () => {
    it('t=0 时位移为 0', () => {
      const [s] = computeMotion(MotionLaw.Polynomial4567, 0, h, omega, deltaRad);
      expect(s).toBe(0);
    });

    it('t=1 时位移为 h', () => {
      const [s] = computeMotion(MotionLaw.Polynomial4567, 1, h, omega, deltaRad);
      expect(s).toBe(h);
    });

    it('t=0 和 t=1 时速度为 0', () => {
      const [, v0] = computeMotion(MotionLaw.Polynomial4567, 0, h, omega, deltaRad);
      const [, v1] = computeMotion(MotionLaw.Polynomial4567, 1, h, omega, deltaRad);
      expect(v0).toBe(0);
      expect(v1).toBe(0);
    });

    it('t=0 和 t=1 时加速度为 0', () => {
      const [, , a0] = computeMotion(MotionLaw.Polynomial4567, 0, h, omega, deltaRad);
      const [, , a1] = computeMotion(MotionLaw.Polynomial4567, 1, h, omega, deltaRad);
      expect(a0).toBe(0);
      expect(a1).toBe(0);
    });
  });
});

describe('isValidMotionLaw', () => {
  it('有效值 1-6 返回 true', () => {
    expect(isValidMotionLaw(1)).toBe(true);
    expect(isValidMotionLaw(2)).toBe(true);
    expect(isValidMotionLaw(3)).toBe(true);
    expect(isValidMotionLaw(4)).toBe(true);
    expect(isValidMotionLaw(5)).toBe(true);
    expect(isValidMotionLaw(6)).toBe(true);
  });

  it('无效值返回 false', () => {
    expect(isValidMotionLaw(0)).toBe(false);
    expect(isValidMotionLaw(7)).toBe(false);
    expect(isValidMotionLaw(1.5)).toBe(false);
    expect(isValidMotionLaw(-1)).toBe(false);
  });
});

describe('MotionLaw 枚举', () => {
  it('枚举值与数字 1-6 对应', () => {
    expect(MotionLaw.ConstantVelocity).toBe(1);
    expect(MotionLaw.ConstantAccel).toBe(2);
    expect(MotionLaw.SimpleHarmonic).toBe(3);
    expect(MotionLaw.Cycloidal).toBe(4);
    expect(MotionLaw.Polynomial345).toBe(5);
    expect(MotionLaw.Polynomial4567).toBe(6);
  });
});
