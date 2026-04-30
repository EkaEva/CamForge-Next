import { describe, it, expect, vi } from 'vitest';
import { debounceAsync } from '../debounce';

describe('debounceAsync', () => {
  it('should debounce async calls', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue(undefined);
    const debounced = debounceAsync(fn, 50);

    debounced('a');
    debounced('b');
    debounced('c');

    vi.advanceTimersByTime(100);
    await vi.runAllTimersAsync();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    vi.useRealTimers();
  });

  it('should resolve after delay', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockResolvedValue('result');
    const debounced = debounceAsync(fn, 30);

    const promise = debounced('test');
    vi.advanceTimersByTime(50);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});