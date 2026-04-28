# CamForge-Next v0.4.0 UI 界面优化

> **制定日期**：2026-04-27
> **目标版本**：v0.4.0
> **依据**：UI.html 参考设计 + 当前 v0.3.7 代码库审查

---

## 已完成

所有 Phase 0-5 已实施完成，详见 CHANGELOG.md v0.4.0 记录。

### 变更文件清单

| 文件 | 变更性质 |
|---|---|
| `index.html` | 添加字体链接 |
| `src/index.css` | CSS token 系统 + 滚动条 + 制图网格 + 面板头 + 数据叠加层 |
| `tailwind.config.js` | 颜色/字体扩展 |
| `src/components/ui/Icon.tsx` | 新增 — Material Symbols 包装 |
| `src/stores/settings.ts` | data-theme 属性设置 |
| `src/components/layout/TitleBar.tsx` | Chrome token + Icon |
| `src/components/layout/Sidebar.tsx` | Chrome token + 技术面板头 + Icon |
| `src/components/layout/StatusBar.tsx` | Chrome token + Icon |
| `src/components/layout/MainCanvas.tsx` | Surface token + Icon + Tab 样式 |
| `src/components/layout/SettingsPanel.tsx` | Chrome/surface token + Icon |
| `src/components/animation/CamAnimation.tsx` | Surface token + 制图网格 + 浮动叠加 + Icon |
| `src/components/controls/NumberInput.tsx` | Surface token + font-display + Icon |
| `src/components/controls/Select.tsx` | Surface token + font-display |
| `src/components/controls/Toggle.tsx` | Surface/primary/outline token |
| `src/components/charts/MotionCurves.tsx` | CSS 变量颜色 + Space Grotesk |
| `src/components/charts/CurvatureChart.tsx` | CSS 变量颜色 + Space Grotesk |
| `src/components/charts/GeometryChart.tsx` | CSS 变量颜色 + Space Grotesk |
| `src/components/ui/Toast.tsx` | 语义 token |
| `src/components/ErrorBoundary.tsx` | Error/surface token + Icon |
| `src/App.tsx` | Chrome token + Icon + body 背景 |
| `package.json` | 版本 0.4.0 |
| `Cargo.toml` | 版本 0.4.0 |
| `src-tauri/tauri.conf.json` | 版本 0.4.0 |
| `README.md` | 版本徽章 0.4.0 |
| `CHANGELOG.md` | v0.4.0 记录 |
