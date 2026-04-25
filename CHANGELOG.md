# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.7] - 2026-04-25

### Fixed

- **P-005**：设置面板下载目录输入框现在正确显示已配置的路径
  - 修复 `useExportSettings()` 返回静态值而非响应式 signal 的问题
  - 选择目录后输入框立即更新显示

- **P-006**：暗色主题现在正确应用于整个界面
  - 修复 Tailwind v4 `dark:` 变体配置（添加 `@custom-variant dark`）
  - 修复 `useTheme()` 返回静态值而非响应式 signal，导致主题切换无响应
  - 修复 `body` 背景色在暗色模式下不变化
  - 设置面板 Light/Dark 按钮现在正确响应点击

- **P-007**：Logo 和 apple-touch-icon 图片体积优化
  - `logo.png`：972KB → 16KB（98% 压缩），1080×1080 → 128×128
  - `apple-touch-icon.png`：972KB → 45KB，优化至 180×180
  - 添加 `width`/`height`/`decoding` 属性优化加载

[0.3.7]: https://github.com/EkaEva/CamForge-Next/compare/v0.3.6...v0.3.7

## [0.3.6] - 2026-04-25

### Fixed

- **P-001**：自定义导出现在读取设置面板的默认下载目录
  - 有默认目录时直接使用，不再强制弹出目录选择器
  - 无默认目录时才弹出选择器
- **P-002**：移动端平台检测增强
  - `isMobilePlatform()` 增加 `navigator.userAgent` 回退检测
  - 修复 `__TAURI_INTERNALS__.metadata.platform` 为 `undefined` 时检测失败
  - 移动端不再显示桌面窗口控制按钮
- **P-002**：移动端 header 按钮位置优化
  - 安全区域从 `padding-top` 改为 `margin-top`，按钮不再偏低
- **P-004**：移动端导出使用浏览器下载方式
  - `saveFile` 在移动端 Tauri 环境下使用 `<a download>` 触发系统下载
  - 修复移动端自定义导出报错问题
- **P-004**：移动端状态栏显示宽度增加
  - 导出状态从 `max-w-[150px]` 改为 `max-w-[60vw]`

### Added

- **P-003**：添加 OG meta 社交分享标签
  - Open Graph（og:title, og:description, og:image, og:url, og:type）
  - Twitter Card（summary_large_image）
  - SEO 增强（robots, canonical）
  - JSON-LD 结构化数据（WebApplication）

[0.3.6]: https://github.com/EkaEva/CamForge-Next/compare/v0.3.5...v0.3.6

## [0.3.5] - 2026-04-25

### Security

- **SEV-001**：Tauri fs 权限添加 scope 限制
  - `src-tauri/capabilities/default.json` 添加 fs scope 白名单
  - 允许 `$DOWNLOAD/**`、`$APPDATA/**`、`$HOME/**`
  - 拒绝 `.env`、`.keystore`、`.jks` 等敏感文件
- **H-001**：关闭 `withGlobalTauri`，改用 ES Module 导入
  - `tauri.conf.json` 设置 `withGlobalTauri: false`
  - 修复所有 `window.__TAURI__` 引用改用工具函数

### Fixed

- **SEV-003**：设置面板下载目录现在影响快速导出
  - `saveFile` 函数自动读取设置面板的下载目录
  - 新增 `getDefaultDpi()`、`getDefaultFormat()` 非响应式 getter
- **H-005**：添加 NaN 值防护，避免图表崩溃
  - `chartDrawing.ts` 添加 `sanitizeNumber` 辅助函数
  - 曲线绘制和凸轮廓形绘制过滤 NaN/Infinity 数据点
  - 模拟计算添加 NaN 检测警告
- **H-009**：移动端导出后 Toast 显示文件名
- **H-014**：Rust `partial_cmp().unwrap()` 安全化
  - 替换为 `partial_cmp().unwrap_or(Ordering::Equal)`
  - 防止 NaN 值导致 panic
- **H-017**：移动端支持自定义导出功能
  - 移除"仅支持桌面端"限制
  - 移动端直接保存到下载目录，无需目录选择器
- **H-022**：Rust `Mutex::lock().unwrap()` 安全化
  - 替换为 `lock().unwrap_or_else(|e| e.into_inner())`
  - 防止 poison panic 导致崩溃
- **M-006**：添加底部安全区域适配
- **M-014**：快速导出读取设置面板的默认 DPI 和格式

### Changed

- 非活动 Tab 暂停动画，降低 CPU 占用
- 动画帧率限制为 60fps
- Canvas 绘制适配高 DPI 屏幕
- Tab 栏添加 WAI-ARIA 语义

### Added

- **H-004**：新增 5 个前端测试文件
  - `src/stores/__tests__/simulation.test.ts`
  - `src/stores/__tests__/settings.test.ts`
  - `src/utils/__tests__/chartDrawing.test.ts`
  - `src/utils/__tests__/platform.test.ts`
  - `src/constants/__tests__/numeric.test.ts`
- **H-010**：设置面板添加焦点陷阱和 Escape 关闭
- **H-011**：Toast 添加 `role="status"` 和 `aria-live="polite"` 属性
- **H-012**：Toggle 添加键盘支持（Space/Enter）和 `role="switch"`
- **H-013**：Tab 栏添加 WAI-ARIA Tabs 语义标记
- **M-001**：新增 `src/constants/numeric.ts` 常量定义
  - 提取魔法数字为命名常量

---

## [0.3.4] - 2026-04-25

### Fixed

- **M-001**：移动端安全区域适配
  - 移动端 header 添加 `env(safe-area-inset-top)` 适配系统状态栏
  - 解决侧边栏展开按钮进入状态栏区域的问题
  - 侧边栏添加 `padding-top: env(safe-area-inset-top)` 防止遮挡状态栏

- **E-001**：TIFF 导出性能优化
  - 重构 `src/exporters/tiff.ts` 使用异步分块处理
  - 避免大图像编码阻塞主线程

- **E-002**：自定义导出多文件修复
  - 修复只导出一个文件的问题
  - 确保所有选中文件保存到同一目录

- **E-003**：自定义导出 TIFF 格式修复
  - 自定义导出现在正确支持 TIFF 格式
  - 默认格式改为 TIFF

- **M-002**：移动端导出路径显示优化
  - Toast 消息显示"已保存到下载目录"
  - 延长显示时间到 5 秒

- **E-005**：导出 Tab 卡死修复
  - 修复点击导出 Tab 导致应用卡死的问题
  - 修复 `currentLang` 未定义导致的运行时错误
  - 重构导出按钮组件避免响应式追踪问题

- **F-002**：设置面板点击无反应修复
  - 使用 `<Show when={...}>` 替代 `if (!props.isOpen) return null`

- **E-006**：GIF 勾选栏大小不一致修复
  - 统一 checkbox 尺寸为 `w-5 h-5`

### Added

- **E-004**：自定义导出添加 JSON 配置选项
  - 数据导出部分新增"配置 (JSON)"选项

- **F-001**：新增设置面板
  - 新增 `src/components/layout/SettingsPanel.tsx` 设置面板组件
  - 状态栏添加设置按钮
  - 支持语言、主题、默认 DPI、默认格式设置
  - 桌面端支持配置默认下载目录

- **W-002**：添加 PWA 图标和配置
  - 新增 `public/apple-touch-icon.png`
  - 新增 `public/manifest.json` PWA 配置
  - 更新 `index.html` 添加 PWA 相关 meta 标签

- **W-003**：添加 robots.txt
  - 新增 `public/robots.txt` 爬虫配置

### Changed

- 自定义导出默认格式从 PNG 改为 TIFF
- 自定义导出数据部分布局改为 2x4 网格
- "预设 (JSON)" 改为 "配置 (JSON)"

---

## [0.3.3] - 2026-04-25

### Fixed

- **H-009**：移动端隐藏窗口控制按钮
  - 新增 `src/utils/platform.ts` 平台检测工具函数
  - TitleBar 组件在移动端平台（Android/iOS）自动隐藏
- **H-010**：移动端导出状态提示优化
  - 新增 `src/components/ui/Toast.tsx` Toast 通知组件
  - 移动端导出成功后显示 Toast 提示
- **H-011**：移动端自定义导出功能修复
  - 移动端点击自定义导出显示提示而非报错
- **H-006**：CSP 配置收紧
  - 移除 `localhost:*/` 通配符，改为明确端口

### Added

- **M-001-B**：TIFF 导出功能实现
  - 新增 `utif2` 依赖库
  - 新增 `src/exporters/tiff.ts` TIFF 编码模块
  - 支持 LZW 无损压缩和 DPI 元数据
  - 快速导出 TIFF 格式现在输出真正的 TIFF 文件

### Security

- **S-001**：敏感文件泄露风险修复
  - `.gitignore` 添加 `*.jks`、`*.keystore`、`*.ks` 模式

---

## [0.3.2] - 2026-04-24

### Added

- **iOS/Android 移动端应用支持**：
  - 添加 iOS 项目配置（需要 macOS + Xcode 进行构建）
  - 初始化 Android 项目，生成完整的 Gradle 构建配置
  - 生成 iOS 图标集（17 个尺寸）
  - 生成 Android 图标集（mipmap 各密度）
  - 配置 Android 权限（网络、文件存储）
  - 安装 Android NDK 27.0.12077973
  - 安装 Rust Android 编译目标（aarch64, armv7, i686, x86_64）
- **GitHub Actions 自动构建**：
  - 自动构建 Android APK（通用版）
  - 自动构建 iOS IPA（模拟器版）
  - Android APK 自动签名
  - 自动发布到 GitHub Releases

### Changed

- 更新 `tauri.conf.json` 添加 iOS/Android 配置块
- 添加移动端文件导出适配计划（使用分享功能）
- 更新 README.md 添加结果展示部分

### Documentation

- 新增详细的 iOS/Android 开发计划文档（`TODO.md`）
- 包含分阶段实施步骤和验证方法

---

## [0.3.1] - 2026-04-24

### Fixed

- **移动端布局修复**：
  - 修复控制卡片重叠：移动端隐藏缩放控制卡片，使用双指缩放手势替代
  - 修复 Tab 栏显示不全：Tab 栏支持横向滑动，隐藏滚动条
  - 修复状态提示不可见：移动端新增独立状态提示区域

### Changed

- Tab 栏布局改为移动端垂直排列，桌面端水平排列
- 状态信息在移动端隐藏，改为独立状态提示区域显示
- 添加 `scrollbar-hide` CSS 类用于隐藏滚动条

---

## [0.3.0] - 2026-04-24

### Added

- **移动端适配**：完整的移动端和移动端网页访问支持
  - 响应式布局：支持 320px-1536px 宽度范围
  - 移动端导航栏：汉堡菜单 + 撤销/重做按钮
  - 侧边栏折叠：移动端可滑出/收起
  - 触摸手势：双指缩放、单指滑动控制帧

### Changed

- **Tailwind 配置**：
  - 新增 `xs: 475px` 断点
  - 新增 `touch: 44px` 触摸目标尺寸
- **触摸目标优化**：
  - 所有交互元素 ≥44x44px
  - Toggle 开关从 32x16px 增大到 48x28px
  - NumberInput 箭头按钮增大触摸区域
  - Tab 按钮增大触摸区域
- **图表响应式**：
  - MotionCurves、CurvatureChart、GeometryChart 边距响应式
  - 小屏幕自动调整图表边距
- **CSS 增强**：
  - 添加移动端触摸反馈样式
  - 禁用 hover 状态粘滞
  - 添加 `touch-manipulation` 优化

### Fixed

- 修复移动端地址栏导致的视口高度问题（使用 `100dvh`）
- 修复导出网格在小屏幕的布局问题

---

## [0.2.2] - 2026-04-24

### Added

- **GitHub Actions Docker 构建**：
  - 新增 `.github/workflows/docker.yml` 自动构建 Docker 镜像
  - 推送到 GitHub Container Registry (ghcr.io)
  - 支持 `main` 分支和版本标签自动触发

### Changed

- **Dockerfile 优化**：
  - 修复 workspace 包含 `src-tauri` 导致的构建失败
  - 构建时自动排除 Tauri 桌面应用模块
  - 升级 Rust 版本到 1.82 以支持 Cargo.lock v4

### Deployment

- 支持通过 `ghcr.io/ekaeva/camforge-next:latest` 拉取镜像
- 服务器部署简化为：拉取镜像 → 运行容器

---

## [0.2.1] - 2026-04-24

### Added

- **安全加固**：
  - SC-001：配置 CSP 内容安全策略
  - SC-002：CORS 白名单支持，通过环境变量配置
  - SC-004/005：增强文件路径安全验证
    - URL 编码路径遍历检测
    - 绝对路径和路径前缀阻止
    - 危险字符过滤
    - 7 个路径验证单元测试
- **架构重构**：
  - AR-001：拆分 simulation.ts（1327 → 1159 行）
  - 新增 `src/exporters/` 导出模块目录
    - `dxf.ts`：DXF 导出模块
    - `csv.ts`：CSV 导出模块
    - `excel.ts`：Excel 导出模块
  - CQ-001/002：完善 API 适配层，支持 HTTP API + 前端 fallback
- **测试完善**：
  - TS-001/002：前端测试从 1 个增加到 4 个文件
  - TS-003-006：Rust 测试从 13 个增加到 26 个
  - 总测试数：89 个通过

### Changed

- 改进 `runSimulation()` 支持 Web 环境 HTTP API 调用
- 更新测试配置，添加 localStorage 和 Canvas mock

### Security

- 添加 CSP 配置防止 XSS 攻击
- CORS 白名单防止未授权跨域访问
- 文件路径验证增强防止路径遍历攻击

---

## [0.2.0] - 2026-04-23

### Added

- **前后端分离架构**：项目支持桌面应用和 Web 服务器双模式部署
  - 桌面应用：Tauri + SolidJS，支持所有功能
  - Web 服务器：Axum + SolidJS，支持在线部署
- **共享核心库 `camforge-core`**：
  - 提取凸轮计算逻辑为独立 Rust crate
  - 运动规律、轮廓计算、几何分析模块
  - 13 个单元测试全部通过
- **HTTP API 服务器 `camforge-server`**：
  - 基于 Axum 框架的 REST API
  - 端点：`/api/simulate`、`/api/export/dxf`、`/api/export/csv`
  - CORS 支持、健康检查、静态文件服务
- **前端 API 适配层**：
  - 自动检测运行环境（Tauri/Web）
  - 统一 API 接口，透明切换实现
- **Docker 部署支持**：
  - 多阶段构建 Dockerfile
  - docker-compose.yml 一键部署
  - 健康检查配置
- **Cargo Workspace**：
  - 统一依赖版本管理
  - 共享 release profile 优化

### Changed

- 重构项目结构，拆分为三个 crate：
  - `camforge-core`：核心计算库
  - `camforge-server`：HTTP API 服务器
  - `camforge-next`：Tauri 桌面应用
- 迁移 `src-tauri/src/cam/` 和 `src-tauri/src/types/` 到 `camforge-core`
- 更新 `src-tauri/src/commands/simulation.rs` 使用 `camforge-core`

### Documentation

- 新增 `docs/REFACTORING_PLAN.md` 前后端分离改造方案
- 新增 `docs/DEPLOYMENT.md` 部署指南

---

## [0.1.2] - 2026-04-23

### Added

- **撤销/重做功能**：参数修改支持撤销和重做操作
  - 键盘快捷键：`Ctrl+Z` 撤销，`Ctrl+Y` 重做
  - 最多支持 50 步历史记录
- **无障碍性改进**：
  - 为所有交互组件添加 ARIA 属性
  - 为 Canvas 图表添加替代文本描述
  - 添加屏幕阅读器专用样式
- **Logo 动效**：
  - 鼠标悬停时放大旋转
  - 点击时缩小反馈
  - 点击跳转至 GitHub 仓库
- **帮助页面改进**：
  - 添加撤销/重做快捷键说明
  - CamForge-Next 标题添加 GitHub 链接
  - 移除版本号显示
- **文档完善**：
  - 新增 `docs/ARCHITECTURE.md` 架构设计文档
  - 新增 `docs/ALGORITHMS.md` 算法公式文档
  - 新增 `CONTRIBUTING.md` 贡献指南
  - 为核心函数添加 JSDoc 注释

### Fixed

- **GIF 生成优化**：使用 gif.js 内置 Worker 池，解决 30% 卡住问题
- **NSIS 安装包配置**：添加 Windows 安装包语言支持

### Changed

- 优化 `generateGifAsync` 使用 4 个 Worker 并行编码
- 更新 `tauri.conf.json` 添加 NSIS 配置

---

## [0.1.1] - 2026-04-23

### Added

- **GIF 异步导出**：使用 Web Worker 避免 UI 阻塞
- **错误边界组件**：防止渲染错误导致白屏
- **存储抽象层**：封装 localStorage 操作
- **安全数组操作**：避免大数组展开运算符栈溢出
- **CI 测试流水线**：GitHub Actions 自动化测试

### Fixed

- **S-01**：移除生产环境 DevTools
- **S-02**：添加文件路径安全验证
- **O-08**：修复 TIFF 导出实际输出 PNG 问题
- **Q-08**：统一前后端默认参数
- **C-01**：修复前后端角度参数类型不匹配
- **Q-01**：拆分巨型 simulation.ts 文件
- **Q-02**：修复测试代码重复
- **Q-04**：添加 MotionLaw 枚举替代魔法数字
- **Q-06**：添加图表绘制输入校验
- **Q-07**：动态化 GIF Worker 路径
- **P-01**：修复大数组栈溢出风险
- **P-05**：添加 DPI 导出上限保护
- **P-06**：添加参数更新防抖

### Changed

- 重构项目结构，拆分服务层
- 更新 README.md 项目结构和开发路线

---

## [0.1.0] - 2026-04-22

### Added

- Initial release of CamForge-Next
- Support for 6 motion laws:
  - Uniform Motion
  - Constant Acceleration
  - Simple Harmonic
  - Cycloidal
  - 3-4-5 Polynomial
  - 4-5-6-7 Polynomial
- Real-time visualization:
  - Cam profile (theoretical and actual)
  - Motion curves (displacement, velocity, acceleration)
  - Pressure angle curve
  - Curvature radius curve
  - Animation demonstration
- Display options:
  - Tangent/Normal lines
  - Pressure angle arc
  - Base circle/Offset circle
  - Upper/Lower limit marks
  - Node markers
  - Phase boundary lines
- Multi-format export:
  - DXF (AutoCAD compatible)
  - CSV
  - Excel
  - SVG
  - PNG (up to 600 DPI)
  - GIF animation
  - JSON preset
- Chinese/English internationalization
- Hot language switching without page reload
- Preset management (save/load/delete)
- Keyboard shortcuts for animation control

### Technical

- Built with Tauri v2 + SolidJS + TypeScript + Tailwind CSS
- Rust backend with ndarray and rayon for parallel computing
- Responsive UI with dark mode support
- Cross-platform support (Windows, macOS, Linux)

---

[0.3.5]: https://github.com/EkaEva/CamForge-Next/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/EkaEva/CamForge-Next/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/EkaEva/CamForge-Next/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/EkaEva/CamForge-Next/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/EkaEva/CamForge-Next/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/EkaEva/CamForge-Next/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/EkaEva/CamForge-Next/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/EkaEva/CamForge-Next/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/EkaEva/CamForge-Next/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/EkaEva/CamForge-Next/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/EkaEva/CamForge-Next/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/EkaEva/CamForge-Next/releases/tag/v0.1.0
