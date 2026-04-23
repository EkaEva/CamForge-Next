/**
 * GIF 编码服务
 *
 * 使用 gif.js 内置 Worker 池异步生成 GIF 动画，不阻塞主线程。
 * 支持进度回调和超时保护。
 */

import type { AnimationFrameOptions } from '../utils/chartDrawing';
import type { SimulationData, CamParams, DisplayOptions } from '../types';
import { drawAnimationFrame } from '../utils/chartDrawing';
import GIF from 'gif.js';

/**
 * GIF 编码选项
 */
export interface GifEncodeOptions {
  /** 输出宽度（像素） */
  width: number;
  /** 输出高度（像素） */
  height: number;
  /** DPI（用于尺寸计算） */
  dpi: number;
  /** 帧延迟（毫秒），默认 33ms (~30fps) */
  delay: number;
  /** 编码质量 (1-20)，越小质量越高 */
  quality: number;
  /** 最大帧数限制 */
  maxFrames: number;
}

/** 默认 GIF 编码选项 */
const DEFAULT_GIF_OPTIONS: GifEncodeOptions = {
  width: 750,
  height: 750,
  dpi: 150,
  delay: 33, // ~30fps
  quality: 10,
  maxFrames: 360,
};

/**
 * 异步生成 GIF 动画
 *
 * 使用 gif.js 内置的 Worker 池进行编码，不阻塞主线程。
 * 帧生成在主线程分批执行，编码在 Worker 中并行执行。
 *
 * @param data - 模拟数据
 * @param params - 凸轮参数
 * @param displayOptions - 显示选项
 * @param options - GIF 编码选项（部分可选）
 * @param onProgress - 进度回调 (0-1)
 * @returns GIF Blob
 *
 * @example
 * ```ts
 * const blob = await generateGifAsync(
 *   simulationData,
 *   params,
 *   displayOptions,
 *   { width: 500, height: 500 },
 *   (progress) => console.log(`Progress: ${progress * 100}%`)
 * );
 * ```
 */
export async function generateGifAsync(
  data: SimulationData,
  params: CamParams,
  displayOptions: DisplayOptions,
  options: Partial<GifEncodeOptions> = {},
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const opts = { ...DEFAULT_GIF_OPTIONS, ...options };

  // 帧数限制保护
  const totalFrames = Math.min(data.s.length, opts.maxFrames);
  const frameSkip = Math.ceil(data.s.length / totalFrames);

  // 创建离屏 Canvas
  const canvas = new OffscreenCanvas(opts.width, opts.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get 2D context from OffscreenCanvas');
  }

  // 预渲染所有帧
  const frames: ImageData[] = [];
  const frameOptions: AnimationFrameOptions = {
    width: opts.width,
    height: opts.height,
    frameIndex: 0,
    displayOptions,
    zoom: 0.8,
  };

  for (let i = 0; i < totalFrames; i++) {
    const actualIndex = i * frameSkip;
    frameOptions.frameIndex = actualIndex;

    // 清除画布
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, opts.width, opts.height);

    // 绘制帧
    drawAnimationFrame(ctx, data, params, frameOptions);

    // 获取帧数据
    frames.push(ctx.getImageData(0, 0, opts.width, opts.height));

    if (onProgress) {
      onProgress((i / totalFrames) * 0.3); // 帧生成占 30% 进度
    }

    // 让出主线程
    if (i % 30 === 0) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }

  // 使用 gif.js 内置 Worker 池编码
  return new Promise((resolve, reject) => {
    // Worker 路径根据环境动态设置
    const workerScript = import.meta.env.DEV
      ? '/node_modules/gif.js/dist/gif.worker.js'
      : '/gif.worker.js';

    const gif = new GIF({
      workers: 4, // 使用 4 个 Worker 并行编码
      quality: opts.quality,
      width: opts.width,
      height: opts.height,
      workerScript,
      repeat: 0, // 无限循环
    });

    // 添加所有帧
    frames.forEach((frame) => {
      gif.addFrame(frame, { delay: opts.delay });
    });

    // 设置超时保护
    const timeout = setTimeout(() => {
      gif.abort();
      reject(new Error('GIF encoding timeout'));
    }, 120000); // 2分钟超时

    gif.on('progress', (p: number) => {
      if (onProgress) {
        onProgress(0.3 + p * 0.7); // 编码占 70% 进度
      }
    });

    gif.on('finished', (blob: Blob) => {
      clearTimeout(timeout);
      resolve(blob);
    });

    gif.on('abort', () => {
      clearTimeout(timeout);
      reject(new Error('GIF encoding was aborted'));
    });

    gif.render();
  });
}

/**
 * 终止 GIF Worker（兼容性保留）
 */
export function terminateGifWorker(): void {
  // gif.js 内部管理 Worker，无需手动清理
}
