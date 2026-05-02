// utif2 库的 encode 函数接受两种调用格式:
// 1. IFD[] — 标准格式（库类型定义已覆盖）
// 2. [width, height, data, metadata] — 简化遗留格式（类型定义缺失）
// 参见 https://github.com/nicholasareed/utif2
declare module 'utif2' {
  import type { IFD } from 'utif2';

  export function encode(ifds: IFD[]): ArrayBuffer;
  export function encode(
    simplified: [number, number, Uint8Array, Partial<IFD>?]
  ): ArrayBuffer;
}
