# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.5] - 2026-04-29

### Security

- **文件系统权限收窄**：FS scope 从 `$HOME/**` 缩小到 `$DOWNLOAD/$DOCUMENT/$DESKTOP`
- **CSP 生产环境加固**：移除 `connect-src` 中的 localhost 开发地址
- **服务器请求体限制**：Axum 添加 `RequestBodyLimitLayer` 防止 DoS
- **参数验证加固**：Tauri 命令入口调用 `CamParams::validate()`，添加 NaN/Infinity 检查
- **密钥文件清理**：从项目目录移除 `camforge-next.keystore`
- **生成代码排除**：`src-tauri/gen/` 从 Git 跟踪中移除并加入 `.gitignore`

### Fixed

- **移动端顶部双行按钮修复**：TitleBar Web 模式在移动端隐藏，mobile header 添加语言切换按钮
- **移动端图表英文溢出**：图例仅保留物理符号（s, v, a, α, ρ），按钮文本缩短
- **机构模型信息栏优化**：移动端缩减数值字段宽度，隐藏缩放百分比，确保标题完整显示
- **图表画布右侧空白缩减**：移动端 right padding 从 105→80
- **压力角计算精度修复**：`atan()` → `atan2()`，修复退化输入下的 NaN 问题
- **NumberInput 验证顺序修复**：`onValidate` 在 `onChange` 之前调用
- **MotionLaw 枚举去重**：合并 `types/index.ts` 和 `services/motion.ts` 的重复定义
- **isTauriEnv 去重**：统一到 `platform.ts`
- **ErrorBoundary 改用 SolidJS 内置组件**
- **i18n useI18n 返回响应式信号**
- **debounceAsync Promise 泄漏修复**
- **CHANGELOG 比较链接补全**：添加 v0.4.3、v0.4.4 比较链接

### Changed

- **版本号更新**：v0.4.4 → v0.4.5（package.json, Cargo.toml, tauri.conf.json, README.md）

## [0.4.4] - 2026-04-29

### Fixed

- **英文版文本溢出修复**：机构模型卡片头部信息栏、图表图例在英文模式下溢出截断
  - 移除 `shrink-0`，添加 `truncate min-w-0`，允许长文本优雅截断
  - 图例容器添加 `overflow-hidden min-w-0`

- **术语一致性修复**：统一 "Uniform Motion"（原 "Constant Velocity"），"Motion Curves"（原 "Follower Motion Curves"）
  - 导出面板 items 名称从缩写改为全称（"Motion Curves", "Curvature Radius", "Pressure Angle", "Cam Profile"）

- **chartDrawing.ts 硬编码字符串 i18n 化**：所有 `lang === 'zh' ? '...' : '...'` 替换为 `tr()` 翻译函数
  - `ChartDrawOptions` 新增可选 `translations` 字段，绘图函数优先使用翻译对象
  - 动画信息面板 "Disp:" → "Disp.:"（带点号更专业）

- **侧边栏英文标签溢出修复**：NumberInput label 添加 `overflow-hidden text-ellipsis whitespace-nowrap`

- **侧边栏旋转选项 i18n 化**：`rotationOptions` 从硬编码改为使用 `t().sidebar.option.cw/ccw`

- **移动端运动曲线绘图区优化**：right padding 从 130→105，aAxisOffset 从 50→45，轴标题 translate 从 28→22
  - 绘图区向右扩展约 25px，Y 轴组整体右移

- **Canvas 图表右侧 padding 优化**：chartDrawing.ts 运动曲线图 right padding 从 130→155 scale，加速度轴偏移从 60→70 scale

- **启动动画版本号更新**：index.html 中 v0.4.2 → v0.4.4

- **图标字体 CSP 修复**：tauri.conf.json `font-src` 添加 `https://fonts.googleapis.com`

- **架构优化**：
  - `generateMockData` 重命名为 `computeSimulationLocally`，添加与 Rust 端对应关系的注释
  - 移除未使用的 `ndarray` 和 `rayon` 依赖（camforge-core、src-tauri、workspace Cargo.toml）
  - CI 分支配置修复：`.github/workflows/test.yml` 和 `docker.yml` 中 `main` → `master`

## [0.4.3] - 2026-04-29

### Fixed

- **移动端侧边栏背景透明**：侧边栏弹出时背景透明，可透过侧边栏看到主界面内容
  - 使用内联样式 `background-color: var(--surface-container-lowest)` 替代 Tailwind 类名，确保背景色生效

- **运动线图Y轴标签与刻度重叠**：右侧速度轴和加速度轴的标题文字与刻度数字重叠
  - 调整绘制顺序：先画刻度标签（紧贴轴线），再画轴标题（在刻度外侧）
  - 增大右侧 padding（桌面端 130→170px）和加速度轴偏移量（60→75px）
  - 轴标题距轴线距离从 22px 调整为 32px，确保与刻度标签不重叠
  - 修复 `axisTitleFont` / `tickFont` 变量在声明前被引用导致的 TDZ 错误，该错误使整个 `draw()` 函数崩溃，所有Y轴标签消失

- **位移/压力角数值不更新**：仿真卡片标题栏中的位移和压力角始终显示为 0
  - 移除不可靠的 callback 模式（`onFrameDataChange`），改为 `createMemo` 直接从 `cursorFrame()` 和 `simulationData()` 派生，确保响应式链路完整

### Changed

- **信息面板优化**：移除仿真动画中的信息面板 overlay（角度、位移、压力角）
  - 位移和压力角移至卡片标题栏，与缩放百分比并列显示
  - 角度信息已在底部播放条显示，无需重复

- **数值显示防抖动**：位移、压力角、缩放数值使用固定宽度 + 右对齐
  - 位移数值：`w-[3.5rem]`，压力角数值：`w-[2.5rem]`，缩放数值：`w-[1.5rem]`
  - `tabular-nums` 确保数字等宽，避免数值变化时布局抖动

- **默认参数更新**：更新项目默认凸轮设计参数
  - 推程角 90°→60°，远休止角 60°→70°，回程角 120°→100°，近休止角 90°→130°
  - 偏距 5→-5，滚子半径 0→5，旋向 1→-1，偏距方向 1→-1

- **版本号更新**：v0.4.3

## [0.4.2] - 2026-04-29

### Fixed

- **英文模式侧边栏标签溢出**：Return Motion Law 标签过长导致换行
  - 缩短翻译：Rise Motion Law → Rise Law，Return Motion Law → Return Law
  - Select 组件标签添加 `whitespace-nowrap overflow-hidden text-ellipsis`

- **英文模式导出动画信息面板**：GIF 导出帧的信息面板仍显示中文
  - `AnimationFrameOptions` 接口新增 `lang` 字段
  - `chartDrawing.ts` 中信息面板文本根据 `lang` 条件渲染
  - `gifEncoder.ts` 和 `simulation.ts` 传递语言参数

- **GIF 导出闪烁变色**：GIF 动画帧间闪烁和颜色跳变
  - 使用 `globalPalette: true` 让所有帧共用统一 256 色调色板，消除帧间调色板切换
  - 信息面板背景改为不透明白色，消除半透明混合导致的帧间像素差异
  - 动画帧渲染回退至 v0.3.7 简洁模式（移除网格、坐标轴、刻度线），降低颜色复杂度
  - 修复 `drawAnimationFrame` 中 `frameOptions.lang` 变量名错误导致的 GIF 导出 0 字节问题

- **移动端侧边栏背景透明**：侧边栏背景色过浅，与主内容区分不明显
  - 侧边栏背景从 `bg-surface-container-low` 改为 `bg-surface-container`
  - 间隙遮罩添加 `bg-black/30` 半透明背景

- **移动端状态栏导出路径**：导出成功后路径被截断不显示
  - 状态栏容器从 `items-center` 改为 `items-start` 支持多行
  - 路径文本从 `truncate max-w-[60vw] whitespace-nowrap` 改为 `max-w-full break-all`

- **移动端运动曲线图3Y轴显示不全**：加速度Y轴在移动端超出屏幕右侧
  - 移动端 `padding.right` 从 20px 增加到 50px
  - 移动端隐藏加速度Y轴（第三轴），仅显示位移和速度轴
  - 同步更新 `getFrameFromX` 和 hover handler 的 padding 值

- **移动端设置面板下载目录**：移动端设置缺少下载路径配置
  - 下载目录设置从 `isTauri && !isMobile` 改为 `isTauri`
  - 移动端显示只读提示文本，桌面端保持原有选择/清除功能
  - 新增 `downloadDirMobileHint` 中英文翻译

### Changed

- **项目重命名**：CamForge-Next → CamForge
  - 所有配置文件、源码、文档、CI/CD、Docker 中的名称统一更新
  - GitHub 仓库同步重命名
  - Tauri identifier 更新为 `com.camforge.app`

- **GIF 导出选项优化**
  - 快速导出动画默认 DPI 从 150 改为 100
  - 自定义导出新增帧数选项（60 / 120 / 180 / 360）
  - 自定义导出动画 DPI 选项恢复 200 DPI
  - 自定义导出动画布局改为三列（格式 + DPI + 帧数）
  - 快速导出提示文本更新为 "GIF 100 DPI"

## [0.4.1] - 2026-04-28

### Fixed

- **移动端侧边栏关闭**：侧边栏展开时占据大部分屏幕，右侧留出空白区域，点击空白区域即可关闭
  - 替换全屏半透明遮罩为右侧间隙点击区域
  - 侧边栏宽度固定 w-72，间隙区域从侧边栏右边缘延伸至屏幕右侧

- **移动端图表卡片高度**：分析卡片在移动端高度过大导致下方空白
  - 机构模型卡片：移动端 320px / 桌面端 480px
  - 分析卡片：移动端 min-h-280px / 桌面端 min-h-480px

- **图表图例重复**：移除 Canvas 图表内的图例绘制，仅保留 HTML 图例
  - MotionCurves、CurvatureChart、GeometryChart 的 draw() 函数不再绘制 Canvas 图例
  - HTML 图例（MainCanvas 顶部栏）为唯一图例来源
  - 导出图表不受影响，仍包含图例

### Changed

- **启动动画加速**：总时长从 2.93s 缩短至 1.8s
  - 凸轮绘制：0.27s-1.5s → 0.15s-0.9s
  - 标题入场：0.67s → 0.4s（阻尼 12→14）
  - 副标题入场：1.0s → 0.6s（阻尼 14→16）
  - 版本号入场：1.33s → 0.8s（阻尼 16→18）
  - 曲线淡入：1.17s → 0.7s
  - 凸轮旋转：1.5s-2.33s → 0.9s-1.4s
  - 全局淡出：2.33s-2.93s → 1.4s-1.8s

- **移动端视口缩放限制**：禁止双指缩放整个页面
  - viewport 添加 `maximum-scale=1, user-scalable=no`

- **移动端主题切换**：添加主题切换按钮到移动端头部

- **移动端侧边栏样式**：侧边栏背景改为 `bg-surface-container-low`，添加 `shadow-xl`

## [0.4.0] - 2026-04-28

### Added

- **启动动画**：应用启动时播放 CamForge 品牌动画
  - 凸轮轮廓逐点绘制动画（progressive point reveal）
  - 绘制完成后凸轮旋转动画（基圆+轮廓同步旋转）
  - 标题/副标题/版本号弹性入场动画（阻尼弹簧模拟）
  - 底部运动曲线装饰线淡入
  - 全局淡出退场，动画结束后自动移除
  - 基于 Remotion 设计稿还原，JS `requestAnimationFrame` 驱动

- **专业色板**：图表颜色替换为低饱和度专业色
  - 位移 s / 理论 ρ / 压力角 α：#DC2626 → #E07A5F（珊瑚红）
  - 速度 v / 实际 ρ：#2563EB → #3D5A80（深蓝）
  - 加速度 a：#16A34A → #5B8C5A（翡翠绿）
  - 阈值线：#F59E0B → #C4A35A（柔金）
  - 滚子半径线：#06B6D4 → #6D9DC5（灰蓝）
  - 超限标记：#EF4444 → #D4534B（柔红）
  - 同步更新 MotionCurves、CurvatureChart、GeometryChart、MainCanvas 图例

- **图例可点击切换曲线**：运动曲线图图例支持点击显示/隐藏对应曲线
  - 新增 `curveVisible` signal 控制位移/速度/加速度曲线可见性
  - 图例按钮带删除线+透明度反馈

- **导出动画网格与信息面板**：GIF/视频导出帧与演示动画一致
  - 制图网格背景（10mm 细线 + 50mm 粗线）
  - 坐标轴与刻度标识
  - 信息面板移至左上角，匹配 `.data-overlay` 样式

- **Remotion 视频框架**：集成 Remotion v4 用于启动动画预览与渲染
  - `src/splash/` 目录：CamForgeSplash 组件、Root 配置、render 脚本
  - `npm run splash:preview` / `npm run splash:render` 命令

### Changed

- **UI 设计系统重构**：基于 Material Design 3 暗色主题参考设计，全面升级视觉风格
  - CSS 自定义属性双套 token（亮色 `:root` + 暗色 `.dark`）
  - MD3 Surface token 用于内容面板、图表、输入控件
  - Zinc 系 Chrome token 用于标题栏、侧边栏、状态栏
  - 语义 token：`success`、`warning`、`error`
  - Tailwind `theme.extend.colors` 引用所有 CSS 变量

- **字体系统**：
  - Space Grotesk（技术标签、标题、数值）→ `font-display`
  - Inter（正文）→ `font-sans`
  - Google Fonts CDN 加载

- **图标系统**：
  - Material Symbols Outlined 替代内联 SVG
  - 新增 `Icon` 组件（支持 size/weight/fill 控制）

- **组件样式升级**：
  - TitleBar、Sidebar、StatusBar：Chrome token + Icon 组件
  - NumberInput、Select、Toggle：Surface token + font-display
  - 侧边栏参数组：技术面板头（panel-header CSS 类）
  - CamAnimation：制图网格背景（drafting-grid）+ 浮动数据叠加层（data-overlay）
  - 图表组件：CSS 变量驱动颜色 + Space Grotesk 字体
  - MainCanvas：Surface token 替代所有 Tailwind 默认色
  - SettingsPanel：Chrome surface + 按钮组选择器
  - Toast、ErrorBoundary：语义 token

- **CSS 基础设施**：
  - 自定义滚动条（`.camforge-scrollbar`）
  - 制图网格背景（`.drafting-grid`、`.drafting-grid-major`）
  - 技术面板头（`.panel-header`）
  - 浮动数据叠加层（`.data-overlay`）
  - `data-theme` 属性驱动 CSS 变量切换

- **导出界面优化**：
  - 进度条改为内联式（快速导出 + 自定义导出卡片内），流动银色渐变动画
  - 亮色/暗色主题下进度条颜色分别优化
  - 自定义导出复选框颜色匹配主题（`accent-color: var(--on-surface-variant)`）
  - 自定义导出按钮改为描边样式，添加悬停上浮+点击下沉动效

- **重置按钮**：点击重置后自动运行一次仿真

- **播放按钮**：添加悬停上浮+阴影动效、点击下沉+缩放动效

### Added (Components)

- `src/components/ui/Icon.tsx`：Material Symbols Outlined 包装组件

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

[0.3.6]: https://github.com/EkaEva/CamForge/compare/v0.3.5...v0.3.6

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

- 支持通过 `ghcr.io/ekaeva/camforge:latest` 拉取镜像
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
  - `camforge`：Tauri 桌面应用
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
  - CamForge 标题添加 GitHub 链接
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

- Initial release of CamForge
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

[0.4.2]: https://github.com/EkaEva/CamForge/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/EkaEva/CamForge/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/EkaEva/CamForge/compare/v0.3.7...v0.4.0
[0.3.7]: https://github.com/EkaEva/CamForge/compare/v0.3.6...v0.3.7
[0.3.5]: https://github.com/EkaEva/CamForge/compare/v0.3.4...v0.3.5
[0.3.4]: https://github.com/EkaEva/CamForge/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/EkaEva/CamForge/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/EkaEva/CamForge/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/EkaEva/CamForge/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/EkaEva/CamForge/compare/v0.2.2...v0.3.0
[0.2.2]: https://github.com/EkaEva/CamForge/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/EkaEva/CamForge/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/EkaEva/CamForge/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/EkaEva/CamForge/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/EkaEva/CamForge/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/EkaEva/CamForge/releases/tag/v0.1.0
