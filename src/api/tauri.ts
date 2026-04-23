/**
 * Tauri IPC API 实现
 *
 * 通过 Tauri IPC 调用 Rust 后端
 */

import type { CamParams, SimulationData } from '../types';
import type { CamApi } from './index';
import { invokeTauri } from '../utils/tauri';

/**
 * Tauri IPC API 实现
 */
export class TauriApi implements CamApi {
  /**
   * 运行凸轮模拟
   */
  async runSimulation(params: CamParams): Promise<SimulationData> {
    return invokeTauri<SimulationData>('run_simulation', { params });
  }

  /**
   * 导出 DXF 文件
   *
   * 注意：Tauri 环境下直接保存到文件，不返回 Blob
   * 这里返回空 Blob 以保持接口一致性
   */
  async exportDxf(params: CamParams, includeActual = true): Promise<Blob> {
    // Tauri 环境下使用文件保存对话框
    // 实际实现需要调用 Tauri 的文件保存 API
    // 这里作为占位符，实际导出逻辑在 simulation.ts 中
    return new Blob();
  }

  /**
   * 导出 CSV 文件
   */
  async exportCsv(params: CamParams, lang = 'zh'): Promise<string> {
    // Tauri 环境下 CSV 生成在前端完成
    // 这里返回空字符串，实际逻辑在 simulation.ts
    return '';
  }

  /**
   * 导出 SVG 文件
   */
  async exportSvg(params: CamParams, lang = 'zh'): Promise<string> {
    // SVG 生成在前端完成
    return '';
  }

  /**
   * 导出 Excel 文件
   */
  async exportExcel(params: CamParams, lang = 'zh'): Promise<Blob> {
    // Excel 生成在前端完成
    return new Blob();
  }

  /**
   * 导出 GIF 动画
   */
  async exportGif(
    params: CamParams,
    lang = 'zh',
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    // GIF 生成在前端完成（使用 Web Worker）
    return new Blob();
  }
}