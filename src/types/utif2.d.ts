// utif2 库类型补充
// encodeImage 在运行时存在但类型定义未导出
// 参见 https://github.com/nicholasareed/utif2
declare module 'utif2' {
  import type { IFD } from 'utif2';

  export function encode(ifds: IFD[]): ArrayBuffer;
  export function encodeImage(
    rgba: Uint8Array,
    w: number,
    h: number,
    metadata?: Partial<IFD>
  ): ArrayBuffer;
}
