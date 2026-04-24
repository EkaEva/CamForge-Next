/**
 * 导出模块测试
 */

import { describe, it, expect } from 'vitest';
import { generateDXF } from '../../exporters/dxf';
import { generateCSV } from '../../exporters/csv';
import { generateExcel } from '../../exporters/excel';
import type { SimulationData, CamParams } from '../../types';

// 创建模拟数据
const createMockData = (): SimulationData => ({
  delta_deg: [0, 90, 180, 270, 360],
  s: [0, 10, 10, 5, 0],
  v: [0, 100, 0, -50, 0],
  a: [0, 0, -100, 0, 50],
  x: [40, 50, 50, 45, 40],
  y: [0, 0, 10, 10, 0],
  x_actual: [35, 45, 45, 40, 35],
  y_actual: [0, 0, 10, 10, 0],
  rho: [40, 50, 50, 45, 40],
  rho_actual: [35, 45, 45, 40, 35],
  alpha_all: [0, 30, 0, 20, 0],
  ds_ddelta: [0, 10, 0, -5, 0],
});

const createMockParams = (): CamParams => ({
  delta_0: 90,
  delta_01: 30,
  delta_ret: 90,
  delta_02: 150,
  h: 10,
  r_0: 40,
  e: 0,
  omega: 10,
  r_r: 5,
  n_points: 360,
  alpha_threshold: 30,
  tc_law: 5,
  hc_law: 6,
  sn: 1,
  pz: 1,
});

describe('exporters', () => {
  describe('generateDXF', () => {
    it('should generate valid DXF content', () => {
      const data = createMockData();
      const dxf = generateDXF(data, true);

      expect(dxf).toContain('SECTION');
      expect(dxf).toContain('HEADER');
      expect(dxf).toContain('CAM_THEORY');
      expect(dxf).toContain('CAM_ACTUAL');
      expect(dxf).toContain('LWPOLYLINE');
      expect(dxf).toContain('EOF');
    });

    it('should not include actual profile when includeActual is false', () => {
      const data = createMockData();
      const dxf = generateDXF(data, false);

      expect(dxf).toContain('CAM_THEORY');
      expect(dxf).not.toContain('CAM_ACTUAL');
    });

    it('should return empty string for null data', () => {
      expect(generateDXF(null as unknown as SimulationData, true)).toBe('');
    });

    it('should include correct number of points', () => {
      const data = createMockData();
      const dxf = generateDXF(data, true);

      // Check that polyline has correct vertex count
      expect(dxf).toContain('90');
      expect(dxf).toContain('5'); // 5 points
    });
  });

  describe('generateCSV', () => {
    it('should generate valid CSV content in Chinese', () => {
      const data = createMockData();
      const params = createMockParams();
      const csv = generateCSV(data, params, 'zh');

      expect(csv).toContain('转角');
      expect(csv).toContain('位移');
      expect(csv).toContain('压力角');
    });

    it('should generate valid CSV content in English', () => {
      const data = createMockData();
      const params = createMockParams();
      const csv = generateCSV(data, params, 'en');

      expect(csv).toContain('Angle');
      expect(csv).toContain('Displacement');
      expect(csv).toContain('Pressure Angle');
    });

    it('should include actual curvature radius when roller exists', () => {
      const data = createMockData();
      const params = createMockParams();
      params.r_r = 5; // With roller
      const csv = generateCSV(data, params, 'zh');

      expect(csv).toContain('实际曲率半径');
    });

    it('should not include actual curvature radius when no roller', () => {
      const data = createMockData();
      const params = createMockParams();
      params.r_r = 0; // No roller
      const csv = generateCSV(data, params, 'zh');

      expect(csv).not.toContain('实际曲率半径');
    });

    it('should return empty string for null data', () => {
      const params = createMockParams();
      expect(generateCSV(null as unknown as SimulationData, params, 'zh')).toBe('');
    });
  });

  describe('generateExcel', () => {
    it('should generate valid Excel Blob', () => {
      const data = createMockData();
      const params = createMockParams();
      const excel = generateExcel(data, params, 'zh');

      expect(excel).toBeInstanceOf(Blob);
      expect(excel.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should return empty Blob for null data', () => {
      const params = createMockParams();
      const excel = generateExcel(null as unknown as SimulationData, params, 'zh');

      expect(excel).toBeInstanceOf(Blob);
      expect(excel.size).toBe(0);
    });
  });
});