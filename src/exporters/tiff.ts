/**
 * TIFF 图像导出模块
 *
 * 使用 utif2 库实现 TIFF 编码，支持 DPI 元数据
 * 使用异步处理避免阻塞主线程
 */

import UTIF from 'utif2';

/**
 * 将 Canvas 内容编码为 TIFF 格式（异步）
 *
 * @param canvas 源 Canvas 元素
 * @param dpi 图像 DPI（用于打印）
 * @returns TIFF Blob
 */
export async function encodeCanvasToTIFFAsync(canvas: HTMLCanvasElement, dpi: number = 600): Promise<Blob> {
  // 让 UI 有机会更新，避免卡顿
  await new Promise(resolve => requestAnimationFrame(resolve));

  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  const imageData = ctx.getImageData(0, 0, width, height);

  // utif2 encodeImage expects RGBA Uint8Array directly
  const rgba = new Uint8Array(imageData.data);

  // 分块让出主线程，避免长时间阻塞
  const totalPixels = width * height;
  const chunkSize = 100000;
  for (let start = 0; start < totalPixels; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPixels);
    // 触摸数据确保已读取
    void rgba[start * 4];
    void rgba[Math.min(end * 4 - 1, rgba.length - 1)];
    if (end < totalPixels) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // 创建 TIFF 文件 — encodeImage 接受 RGBA 数据、宽、高和可选元数据
  const metadata = {
    t282: [[dpi, 1]],   // XResolution
    t283: [[dpi, 1]],   // YResolution
    t296: [2],           // ResolutionUnit = inch
  };
  const tiffArray = UTIF.encodeImage(rgba, width, height, metadata);

  return new Blob([tiffArray], { type: 'image/tiff' });
}

/**
 * 生成 TIFF 图像 Blob（异步）
 *
 * @param canvas 源 Canvas 元素
 * @param dpi 图像 DPI
 * @returns TIFF Blob
 */
export async function generateTIFFBlob(canvas: HTMLCanvasElement, dpi: number = 600): Promise<Blob> {
  try {
    return await encodeCanvasToTIFFAsync(canvas, dpi);
  } catch (e) {
    console.error('TIFF encoding error:', e);
    const err = new Error('TIFF encoding failed — please try PNG or SVG export instead');
    err.cause = e;
    throw err;
  }
}

/**
 * 同步编码（保留向后兼容）
 * 注意：大图像可能阻塞主线程
 */
export function encodeCanvasToTIFF(canvas: HTMLCanvasElement, dpi: number = 600): Blob {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context');
  const imageData = ctx.getImageData(0, 0, width, height);

  const rgba = new Uint8Array(imageData.data);

  const metadata = {
    t282: [[dpi, 1]],
    t283: [[dpi, 1]],
    t296: [2],
  };
  const tiffArray = UTIF.encodeImage(rgba, width, height, metadata);

  return new Blob([tiffArray], { type: 'image/tiff' });
}
