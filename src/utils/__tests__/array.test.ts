/**
 * 数组工具函数测试
 */

import { describe, it, expect } from 'vitest';
import { arrayMax, arrayMin, arrayMaxBy, arrayMinBy, filterFinite, findIndex } from '../array';

describe('array utilities', () => {
  describe('arrayMax', () => {
    it('should find maximum value in array', () => {
      expect(arrayMax([1, 5, 3, 9, 2])).toBe(9);
    });

    it('should handle negative values', () => {
      expect(arrayMax([-5, -3, -10, -1])).toBe(-1);
    });

    it('should handle empty array', () => {
      expect(arrayMax([])).toBe(-Infinity);
    });

    it('should handle large array without stack overflow', () => {
      const largeArray = Array.from({ length: 100000 }, (_, i) => i);
      expect(() => arrayMax(largeArray)).not.toThrow();
      expect(arrayMax(largeArray)).toBe(99999);
    });

    it('should handle single element', () => {
      expect(arrayMax([42])).toBe(42);
    });
  });

  describe('arrayMin', () => {
    it('should find minimum value in array', () => {
      expect(arrayMin([1, 5, 3, 9, 2])).toBe(1);
    });

    it('should handle negative values', () => {
      expect(arrayMin([-5, -3, -10, -1])).toBe(-10);
    });

    it('should handle empty array', () => {
      expect(arrayMin([])).toBe(Infinity);
    });

    it('should handle large array without stack overflow', () => {
      const largeArray = Array.from({ length: 100000 }, (_, i) => i);
      expect(() => arrayMin(largeArray)).not.toThrow();
      expect(arrayMin(largeArray)).toBe(0);
    });
  });

  describe('arrayMaxBy', () => {
    it('should find maximum by transform function', () => {
      const objects = [{ x: 1 }, { x: 5 }, { x: 3 }];
      expect(arrayMaxBy(objects, obj => obj.x)).toBe(5);
    });

    it('should handle absolute value transform', () => {
      expect(arrayMaxBy([-5, 3, -10, 2], Math.abs)).toBe(10);
    });

    it('should handle empty array', () => {
      expect(arrayMaxBy([], x => x)).toBe(-Infinity);
    });
  });

  describe('arrayMinBy', () => {
    it('should find minimum by transform function', () => {
      const objects = [{ x: 1 }, { x: 5 }, { x: 3 }];
      expect(arrayMinBy(objects, obj => obj.x)).toBe(1);
    });

    it('should handle absolute value transform', () => {
      expect(arrayMinBy([-5, 3, -10, 2], Math.abs)).toBe(2);
    });

    it('should handle empty array', () => {
      expect(arrayMinBy([], x => x)).toBe(Infinity);
    });
  });

  describe('filterFinite', () => {
    it('should filter out non-finite values', () => {
      expect(filterFinite([1, Infinity, 2, NaN, 3, -Infinity])).toEqual([1, 2, 3]);
    });

    it('should keep all finite values', () => {
      expect(filterFinite([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle empty array', () => {
      expect(filterFinite([])).toEqual([]);
    });

    it('should handle array with only non-finite values', () => {
      expect(filterFinite([Infinity, NaN, -Infinity])).toEqual([]);
    });
  });

  describe('findIndex', () => {
    it('should find index of first matching element', () => {
      expect(findIndex([1, 2, 3, 4, 5], x => x === 3)).toBe(2);
    });

    it('should return -1 if not found', () => {
      expect(findIndex([1, 2, 3], x => x === 10)).toBe(-1);
    });

    it('should handle empty array', () => {
      expect(findIndex([], x => x === 1)).toBe(-1);
    });

    it('should find first occurrence', () => {
      expect(findIndex([1, 2, 2, 2, 3], x => x === 2)).toBe(1);
    });
  });
});