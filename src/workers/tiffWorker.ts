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
      // encodeImage 接受 RGBA 数据、宽、高和可选元数据
      const metadata = {
        t282: [[dpi, 1]],   // XResolution
        t283: [[dpi, 1]],   // YResolution
        t296: [2],           // ResolutionUnit = inch
      };
      const tiffArray = new Uint8Array(UTIF.encodeImage(rgbaData, width, height, metadata));

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
