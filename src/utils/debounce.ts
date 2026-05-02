/**
 * 异步防抖工具
 *
 * 确保在指定延迟内只执行最后一次调用，并自动取消过期调用的结果
 */

export function debounceAsync<T extends (...args: unknown[]) => Promise<void>>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => Promise<void> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let callId = 0;

  const debounced = async (...args: Parameters<T>): Promise<void> => {
    const thisCall = ++callId;

    if (timer) clearTimeout(timer);

    return new Promise<void>((resolve) => {
      timer = setTimeout(async () => {
        if (thisCall !== callId) {
          resolve();
          return;
        }
        try {
          await fn(...args);
        } finally {
          resolve();
        }
      }, delayMs);
    });
  };

  return debounced;
}
