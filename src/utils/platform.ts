/**
 * 平台检测工具函数
 */

interface TauriInternals {
  metadata?: {
    platform?: string;
  };
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

export function isTauriEnv(): boolean {
  try {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  } catch {
    return false;
  }
}

export function isMobilePlatform(): boolean {
  if (typeof window === 'undefined') return false;

  if (isTauriEnv()) {
    const internals = window.__TAURI_INTERNALS__;
    const platform = internals?.metadata?.platform;
    if (platform === 'android' || platform === 'ios') return true;

    // 回退：Tauri 环境下通过 userAgent 检测
    const ua = navigator.userAgent || '';
    if (/Android/i.test(ua) || /iPhone|iPad|iPod/i.test(ua)) return true;

    return false;
  }

  return false;
}

export function isDesktopPlatform(): boolean {
  return isTauriEnv() && !isMobilePlatform();
}
