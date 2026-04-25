/**
 * 平台检测工具函数
 *
 * 用于区分桌面端、移动端和 Web 环境
 */

/**
 * 检测是否为 Tauri 移动端平台 (Android/iOS)
 *
 * @returns true 表示运行在 Android 或 iOS 平台
 */
export function isMobilePlatform(): boolean {
  // 检查是否在 Tauri 环境中
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    // Tauri v2 平台检测
    // @ts-ignore - Tauri 内部 API
    const metadata = window.__TAURI_INTERNALS__?.metadata;
    if (metadata?.platform) {
      return metadata.platform === 'android' || metadata.platform === 'ios';
    }
    // 备用检测：通过 userAgent
    const ua = navigator.userAgent;
    return /Android|iPhone|iPad|iPod/i.test(ua);
  }
  return false;
}

/**
 * 检测是否为 Tauri 桌面端平台
 *
 * @returns true 表示运行在桌面端 (Windows/macOS/Linux)
 */
export function isDesktopPlatform(): boolean {
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return !isMobilePlatform();
  }
  return false;
}

/**
 * 检测是否为 Tauri 环境
 *
 * @returns true 表示运行在 Tauri 容器中
 */
export function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * 检测是否为移动端视口（响应式）
 *
 * 注意：这仅检测视口宽度，不区分平台
 *
 * @returns true 表示视口宽度小于 768px
 */
export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768;
}

/**
 * 检测是否应该显示移动端 UI
 *
 * 综合判断：移动端平台 或 小视口
 *
 * @returns true 表示应使用移动端 UI 布局
 */
export function shouldShowMobileUI(): boolean {
  return isMobilePlatform() || isMobileViewport();
}
