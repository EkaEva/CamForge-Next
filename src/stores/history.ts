/**
 * 历史状态管理
 *
 * 实现撤销/重做功能，支持最多 50 步历史记录。
 * 使用时间旅行状态模式，维护 past、present、future 三个状态栈。
 */

import { createSignal } from 'solid-js';
import { MAX_UNDO_STEPS } from '../constants';

/** 最大历史记录数 */

/**
 * 历史状态内部结构
 * @template T - 状态类型
 */
interface HistoryState<T> {
  /** 过去状态栈 */
  past: T[];
  /** 当前状态 */
  present: T;
  /** 未来状态栈（用于重做） */
  future: T[];
}

/**
 * 历史状态操作接口
 * @template T - 状态类型
 */
export interface HistoryActions<T> {
  /** 获取当前状态 */
  state: () => T;
  /** 撤销操作，返回是否成功 */
  undo: () => boolean;
  /** 重做操作，返回是否成功 */
  redo: () => boolean;
  /** 推入新状态 */
  push: (newState: T) => void;
  /** 是否可撤销 */
  canUndo: () => boolean;
  /** 是否可重做 */
  canRedo: () => boolean;
  /** 清空历史记录 */
  clear: () => void;
}

/**
 * 创建历史状态管理器
 *
 * @template T - 状态类型，必须可序列化为 JSON
 * @param initialState - 初始状态
 * @returns 历史状态操作对象
 *
 * @example
 * ```ts
 * const history = createHistory({ value: 0 });
 *
 * // 推入新状态
 * history.push({ value: 1 });
 * history.push({ value: 2 });
 *
 * // 撤销
 * history.undo(); // state = { value: 1 }
 *
 * // 重做
 * history.redo(); // state = { value: 2 }
 * ```
 */
export function createHistory<T>(initialState: T): HistoryActions<T> {
  const [state, setState] = createSignal<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = () => state().past.length > 0;
  const canRedo = () => state().future.length > 0;

  const undo = (): boolean => {
    const s = state();
    if (s.past.length === 0) return false;

    const previous = s.past[s.past.length - 1];
    const newPast = s.past.slice(0, -1);

    setState({
      past: newPast,
      present: previous,
      future: [s.present, ...s.future],
    });

    return true;
  };

  const redo = (): boolean => {
    const s = state();
    if (s.future.length === 0) return false;

    const next = s.future[0];
    const newFuture = s.future.slice(1);

    setState({
      past: [...s.past, s.present],
      present: next,
      future: newFuture,
    });

    return true;
  };

  const push = (newPresent: T): void => {
    const s = state();

    // 如果新状态与当前状态相同，不记录
    if (JSON.stringify(newPresent) === JSON.stringify(s.present)) {
      return;
    }

    setState({
      past: [...s.past.slice(-MAX_UNDO_STEPS + 1), s.present],
      present: newPresent,
      future: [], // 新操作清空重做栈
    });
  };

  const clear = (): void => {
    const s = state();
    setState({
      past: [],
      present: s.present,
      future: [],
    });
  };

  return {
    state: () => state().present,
    undo,
    redo,
    push,
    canUndo,
    canRedo,
    clear,
  };
}
