/**
 * TIFF 图像导出模块
 *
 * 使用 utif2 库实现 TIFF 编码，支持无损压缩和 DPI 元数据
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
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, width, height);

  // 将 RGBA 数据转换为 TIFF 格式
  const rgba = imageData.data;
  const rgbData = new Uint8Array(width * height * 3);

  // 分块处理，避免长时间阻塞
  const chunkSize = 100000; // 每次处理 100k 像素
  const totalPixels = width * height;

  for (let start = 0; start < totalPixels; start += chunkSize) {
    const end = Math.min(start + chunkSize, totalPixels);
    for (let i = start; i < end; i++) {
      const rgbaIdx = i * 4;
      const rgbIdx = i * 3;
      rgbData[rgbIdx] = rgba[rgbaIdx];         // R
      rgbData[rgbIdx + 1] = rgba[rgbaIdx + 1]; // G
      rgbData[rgbIdx + 2] = rgba[rgbaIdx + 2]; // B
    }
    // 每处理完一个块，让出主线程
    if (end < totalPixels) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // 创建 TIFF 文件
  const tiffArray = UTIF.encode([width, height, rgbData, {
    dpi: [dpi, dpi],
    compression: 5,   // LZW 无损压缩
    photometric: 2,   // RGB
    bitsPerSample: 8,
    samplesPerPixel: 3,
  }]);

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
    // 失败时返回 PNG 作为 fallback
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob || new Blob());
      }, 'image/png');
    });
  }
}

/**
 * 同步编码（保留向后兼容）
 * 注意：大图像可能阻塞主线程
 */
export function encodeCanvasToTIFF(canvas: HTMLCanvasElement, dpi: number = 600): Blob {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, width, height);

  const rgba = imageData.data;
  const rgbData = new Uint8Array(width * height * 3);

  for (let i = 0; i < width * height; i++) {
    const rgbaIdx = i * 4;
    const rgbIdx = i * 3;
    rgbData[rgbIdx] = rgba[rgbaIdx];
    rgbData[rgbIdx + 1] = rgba[rgbaIdx + 1];
    rgbData[rgbIdx + 2] = rgba[rgbaIdx + 2];
  }

  const tiffArray = UTIF.encode([width, height, rgbData, {
    dpi: [dpi, dpi],
    compression: 5,
    photometric: 2,
    bitsPerSample: 8,
    samplesPerPixel: 3,
  }]);

  return new Blob([tiffArray], { type: 'image/tiff' });
}
