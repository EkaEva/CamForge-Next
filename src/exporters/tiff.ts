/**
 * TIFF 图像导出模块
 *
 * 使用 utif2 库实现 TIFF 编码，支持无损压缩和 DPI 元数据
 */

import UTIF from 'utif2';

/**
 * 将 Canvas 内容编码为 TIFF 格式
 *
 * @param canvas 源 Canvas 元素
 * @param dpi 图像 DPI（用于打印）
 * @returns TIFF Blob
 */
export function encodeCanvasToTIFF(canvas: HTMLCanvasElement, dpi: number = 600): Blob {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, width, height);

  // 将 RGBA 数据转换为 TIFF 格式
  // TIFF 格式：RGB（每像素 3 字节），从上到下、从左到右
  const rgba = imageData.data;
  const rgbData = new Uint8Array(width * height * 3);

  for (let i = 0; i < width * height; i++) {
    const rgbaIdx = i * 4;
    const rgbIdx = i * 3;
    rgbData[rgbIdx] = rgba[rgbaIdx];     // R
    rgbData[rgbIdx + 1] = rgba[rgbaIdx + 1]; // G
    rgbData[rgbIdx + 2] = rgba[rgbaIdx + 2]; // B
  }

  // 创建 TIFF 文件
  // UTIF.encode 使用数组格式：[width, height, data, options]
  const tiffArray = UTIF.encode([width, height, rgbData, {
    dpi: [dpi, dpi],  // X 和 Y DPI
    compression: 5,   // LZW 无损压缩
    photometric: 2,   // RGB
    bitsPerSample: 8,
    samplesPerPixel: 3,
  }]);

  return new Blob([tiffArray], { type: 'image/tiff' });
}

/**
 * 生成 TIFF 图像 Blob
 *
 * @param canvas 源 Canvas 元素
 * @param dpi 图像 DPI
 * @returns TIFF Blob
 */
export function generateTIFFBlob(canvas: HTMLCanvasElement, dpi: number = 600): Promise<Blob> {
  return new Promise((resolve) => {
    try {
      const blob = encodeCanvasToTIFF(canvas, dpi);
      resolve(blob);
    } catch (e) {
      console.error('TIFF encoding error:', e);
      // 失败时返回 PNG 作为 fallback
      canvas.toBlob((blob) => {
        resolve(blob || new Blob());
      }, 'image/png');
    }
  });
}