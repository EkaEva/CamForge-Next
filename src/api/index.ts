/**
 * API 适配层
 *
 * 提供统一的 API 接口，自动检测环境并选择正确的实现：
 * - Tauri 环境：使用 IPC 调用
 * - Web 环境：使用 HTTP API
 */

import type { CamParams, SimulationData } from '../types';
import { isTauriEnv } from '../utils/tauri';

// 导出具体实现
export { TauriApi } from './tauri';
export { HttpApi } from './http';

// API 接口定义
export interface CamApi {
  /**
   * 运行凸轮模拟
   */
  runSimulation(params: CamParams): Promise<SimulationData>;

  /**
   * 导出 DXF 文件
   */
  exportDxf(params: CamParams, includeActual?: boolean): Promise<Blob>;

  /**
   * 导出 CSV 文件
   */
  exportCsv(params: CamParams, lang?: string): Promise<string>;

  /**
   * 导出 SVG 文件
   */
  exportSvg(params: CamParams, lang?: string): Promise<string>;

  /**
   * 导出 Excel 文件
   */
  exportExcel(params: CamParams, lang?: string): Promise<Blob>;

  /**
   * 导出 GIF 动画
   */
  exportGif(
    params: CamParams,
    lang?: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob>;
}

// 动态导入，避免循环依赖
async function getTauriApi(): Promise<import('./tauri').TauriApi> {
  const { TauriApi } = await import('./tauri');
  return new TauriApi();
}

async function getHttpApi(): Promise<import('./http').HttpApi> {
  const { HttpApi } = await import('./http');
  return new HttpApi();
}

/**
 * 获取当前环境的 API 实现
 *
 * 自动检测运行环境并返回对应的 API 实现
 */
export async function getApi(): Promise<CamApi> {
  if (isTauriEnv()) {
    return getTauriApi();
  }
  return getHttpApi();
}

/**
 * 同步获取 API 类型（用于类型推断）
 */
export function getApiType(): 'tauri' | 'http' {
  return isTauriEnv() ? 'tauri' : 'http';
}