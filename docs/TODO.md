# CamForge-Next v0.3.7 系统优化计划

> **制定日期**：2026-04-25
> **目标版本**：v0.3.7
> **依据**：v0.3.6 发布后用户反馈的 3 个问题

---

## 问题总览

| 编号 | 问题 | 严重度 | 影响范围 |
|:---:|------|:---:|------|
| P-005 | 设置面板下载目录输入框不显示已配置的路径 | 高 | 设置面板 UX |
| P-006 | 暗色主题仅图表变色，整体 UI 不变 + 设置面板主题切换无响应 | 高 | 全局主题 |
| P-007 | Logo 图片体积过大，移动端加载缓慢 | 中 | Web 部署性能 |

---

## 问题分析

### P-005: 下载目录输入框不显示已配置路径

**根因**：`SettingsPanel.tsx` 中下载目录输入框使用 `value={downloadDir()}` 绑定，但 `downloadDir` 来自 `useExportSettings()` 返回的 signal。`useExportSettings()` 内部从 `localStorage` 读取初始值，但 `handleSelectDir` 调用 `setDownloadDir()` 后，输入框的 signal 未正确更新。

具体代码路径：
1. `SettingsPanel.tsx:197` — `const { downloadDir, ... } = useExportSettings()`
2. `SettingsPanel.tsx:219` — `<input value={downloadDir()} />` — 依赖 signal 响应性
3. `settings.ts:useExportSettings()` — `downloadDir` signal 初始化后，`setDownloadDir` 是否正确触发更新

**修复方案**：确保 `handleSelectDir` 成功选择目录后调用 `setDownloadDir(selectedPath)` 更新 signal，使输入框自动刷新。

---

### P-006: 暗色主题问题（两处）

**根因 A — UI 不变色**：Tailwind CSS 的 `dark:` 变体需要 HTML 元素上有 `class="dark"` 才能生效。当前 `App.tsx` 的 `updateDarkMode()` 函数在 `<html>` 上添加/移除 `dark` class，但大量组件（Sidebar、MainCanvas、SettingsPanel 等）缺少 `dark:` 样式类。仅图表组件（chartDrawing.ts）手动处理了暗色配色，其余 UI 元素全是硬编码的浅色样式。

**根因 B — 主题切换无响应**：`SettingsPanel.tsx` 中主题选项使用 `onClick={() => setThemeMode('light')}` 和 `onClick={() => setThemeMode('dark')}`，但 `setThemeMode` 可能未正确触发 `updateDarkMode()`。需检查 `settings.ts` 中 `setThemeMode` 是否调用了 `updateDarkMode()`，以及 `SettingsPanel` 中是否正确绑定了点击事件。

**修复方案**：
1. 确认 `setThemeMode` 正确触发 `updateDarkMode()`
2. 为所有主要 UI 组件添加 `dark:` 样式变体
3. 重点区域：Sidebar、MainCanvas、SettingsPanel、StatusBar、Toast、移动端 header

---

### P-007: Logo 图片体积过大

**现状**：`public/logo.png` 为 128×128 像素，文件大小约 40KB+。移动端通过 Web 访问时加载缓慢。

**修复方案**：
1. 将 `logo.png` 压缩优化（使用更高效的 PNG 压缩或转换为 WebP）
2. 在 `<img>` 标签添加 `width`/`height` 属性避免布局偏移
3. 添加 `loading="eager"` 和 `decoding="async"` 属性优化加载
4. 考虑使用内联 SVG 替代（如果是简单图形）

---

## 实施步骤

### 第一阶段：修复 P-005 下载目录显示

#### 步骤 1.1：修复 `handleSelectDir` 更新 signal

**修改文件**：`src/components/layout/SettingsPanel.tsx`

**方案**：确保选择目录成功后，调用 `setDownloadDir(selectedPath)` 更新 signal，使输入框自动显示新值。

**验证方法**：
1. 设置面板点击"选择"按钮 → 选择目录 → 输入框立即显示所选路径
2. 关闭设置面板重新打开 → 输入框仍显示已配置的路径

---

### 第二阶段：修复 P-006 暗色主题

#### 步骤 2.1：修复主题切换响应

**修改文件**：`src/stores/settings.ts`、`src/components/layout/SettingsPanel.tsx`

**方案**：确保 `setThemeMode` 调用后触发 `updateDarkMode()`，在 `<html>` 元素上正确切换 `dark` class。

**验证方法**：
1. 设置面板点击 "Dark" → 整个界面立即切换为暗色
2. 设置面板点击 "Light" → 整个界面立即切换为浅色
3. 刷新页面后主题保持

#### 步骤 2.2：为主要 UI 组件添加 dark 样式

**修改文件**：
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/MainCanvas.tsx`
- `src/components/layout/SettingsPanel.tsx`
- `src/components/layout/StatusBar.tsx`
- `src/components/layout/TitleBar.tsx`
- `src/components/ui/Toast.tsx`
- `src/App.tsx`（移动端 header）

**方案**：为所有硬编码的浅色背景、文字、边框添加对应的 `dark:` 变体。

**验证方法**：
1. 切换暗色主题后，所有面板背景变为深色
2. 文字在暗色背景下清晰可读
3. 边框和分隔线在暗色模式下可见
4. 图表在暗色模式下配色协调

---

### 第三阶段：修复 P-007 Logo 加载优化

#### 步骤 3.1：优化 Logo 图片

**修改文件**：`public/logo.png`、`src/components/layout/Sidebar.tsx`、`src/App.tsx`

**方案**：
1. 压缩 logo.png 或转换为 WebP 格式
2. 为 `<img>` 标签添加 `width`/`height` 属性
3. 添加 `loading="eager"` 和 `decoding="async"` 属性

**验证方法**：
1. Logo 在移动端快速加载（< 1 秒）
2. Logo 显示清晰无模糊
3. 页面加载时无布局偏移

---

### 第四阶段：版本号更新

#### 步骤 4.1：更新所有版本号至 v0.3.7

**修改文件**：
1. `package.json` — `"version": "0.3.7"`
2. `src-tauri/tauri.conf.json` — `"version": "0.3.7"`
3. `Cargo.toml` — `version = "0.3.7"`
4. `crates/camforge-core/Cargo.toml` — `version = "0.3.7"`
5. `crates/camforge-server/Cargo.toml` — `version = "0.3.7"`
6. `src/components/layout/StatusBar.tsx` — `v0.3.7`
7. `README.md` — 版本徽章 `v0.3.7`
8. `CHANGELOG.md` — 添加 v0.3.7 记录

---

## 验证清单

| 验证项 | 验证方法 | 预期结果 |
|--------|----------|----------|
| 下载目录输入框显示 | 选择目录后查看输入框 | 立即显示所选路径 |
| 主题切换响应 | 点击 Light/Dark 按钮 | 界面立即切换 |
| 暗色主题 UI | 切换暗色后检查各面板 | 背景深色、文字清晰、边框可见 |
| Logo 加载速度 | 移动端 Web 访问 | Logo 快速加载 |
| 版本号一致 | 检查所有版本文件 | 均为 0.3.7 |

---

## 执行顺序

1. **P-005** → 修复下载目录输入框显示
2. **P-006 步骤 2.1** → 修复主题切换响应
3. **P-006 步骤 2.2** → 添加 dark 样式
4. **P-007** → Logo 优化
5. **版本更新** → 所有版本号 + CHANGELOG + README
6. **本地验证** → 开发服务器全功能测试
7. **用户验证** → 等待用户确认后再推送
