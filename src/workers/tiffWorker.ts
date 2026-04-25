/**
 * TIFF 编码 Web Worker
 *
 * 在后台线程中执行 TIFF 编码，避免阻塞主线程
 */

import UTIF from 'utif2';

// Worker 消息类型
interface TiffEncodeMessage {
  type: 'encode';
  width: number;
  height: number;
  rgbaData: Uint8Array;
  dpi: number;
}

interface TiffResultMessage {
  type: 'result';
  data: Uint8Array;
}

interface TiffErrorMessage {
  type: 'error';
  error: string;
}

type WorkerMessage = TiffEncodeMessage;
type WorkerResponse = TiffResultMessage | TiffErrorMessage;

// 监听主线程消息
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, width, height, rgbaData, dpi } = event.data;

  if (type === 'encode') {
    try {
      // 将 RGBA 数据转换为 RGB
      const rgbData = new Uint8Array(width * height * 3);
      for (let i = 0; i < width * height; i++) {
        const rgbaIdx = i * 4;
        const rgbIdx = i * 3;
        rgbData[rgbIdx] = rgbaData[rgbaIdx];         // R
        rgbData[rgbIdx + 1] = rgbaData[rgbaIdx + 1]; // G
        rgbData[rgbIdx + 2] = rgbaData[rgbaIdx + 2]; // B
      }

      // 编码为 TIFF
      const tiffArray = UTIF.encode([width, height, rgbData, {
        dpi: [dpi, dpi],
        compression: 5,   // LZW 无损压缩
        photometric: 2,   // RGB
        bitsPerSample: 8,
        samplesPerPixel: 3,
      }]);

      // 返回结果
      const response: TiffResultMessage = {
        type: 'result',
        data: tiffArray,
      };
      self.postMessage(response, [tiffArray.buffer]);
    } catch (e) {
      const response: TiffErrorMessage = {
        type: 'error',
        error: String(e),
      };
      self.postMessage(response);
    }
  }
};

export {};
