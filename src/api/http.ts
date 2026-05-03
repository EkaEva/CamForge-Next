/**
 * HTTP API 实现
 *
 * 通过 HTTP REST API 调用后端服务器
 */

import type { CamParams, SimulationData } from '../types';
import type { CamApi } from './index';

/**
 * HTTP API 配置
 *
 * 生产环境使用空字符串（相对路径），浏览器自动解析为页面同源 URL，
 * 从而满足 CSP `connect-src 'self'` 限制。
 * 本地开发通过 .env 设置 VITE_API_URL=http://localhost:3000。
 */
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * HTTP API 实现
 */
export class HttpApi implements CamApi {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_BASE_URL;
  }

  /**
   * 运行凸轮模拟
   */
  async runSimulation(params: CamParams): Promise<SimulationData> {
    const response = await fetch(`${this.baseUrl}/api/simulate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data as SimulationData;
  }

  /**
   * 导出 DXF 文件
   */
  async exportDxf(params: CamParams, includeActual = true): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/export/dxf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params, include_actual: includeActual }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.blob();
  }

  /**
   * 导出 CSV 文件
   */
  async exportCsv(params: CamParams, lang = 'zh'): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/export/csv`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ params, lang }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  }

  /**
   * 导出 SVG 文件
   *
   * 注意：SVG 导出需要前端渲染，HTTP API 不支持
   */
  async exportSvg(_params: CamParams, _lang = 'zh'): Promise<string> {
    // SVG 需要前端 Canvas 渲染，无法在纯后端生成
    throw new Error('SVG export requires frontend rendering. Use the desktop app.');
  }

  /**
   * 导出 Excel 文件
   *
   * 注意：Excel 导出需要前端库，HTTP API 不支持
   */
  async exportExcel(_params: CamParams, _lang = 'zh'): Promise<Blob> {
    // Excel 生成需要 xlsx 库，在前端完成
    throw new Error('Excel export requires frontend library. Use the desktop app.');
  }

  /**
   * 导出 GIF 动画
   *
   * 注意：GIF 导出需要前端 Canvas 渲染
   */
  async exportGif(
    _params: CamParams,
    _lang = 'zh',
    _onProgress?: (progress: number) => void
  ): Promise<Blob> {
    // GIF 需要前端 Canvas 渲染
    throw new Error('GIF export requires frontend rendering. Use the desktop app.');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; version: string }> {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }
}