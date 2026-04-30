# CamForge v0.4.5 系统优化计划

> **制定日期**：2026-04-29
> **目标版本**：v0.4.5
> **依据**：`docs/Review.md` 系统性审查报告（120 项问题）+ 用户反馈的 4 项 UI 问题
> **原则**：每阶段可独立验证，阶段内按优先级排序，先安全后体验

---

## Phase 0：版本号更新与基线准备

**目标**：将版本号从 v0.4.4 更新至 v0.4.5，建立优化基线

### 步骤

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 0.1 | 更新前端版本号 | `package.json` | `"version": "0.4.5"` |
| 0.2 | 更新 Rust 工作区版本号 | `Cargo.toml` | `version = "0.4.5"` |
| 0.3 | 更新 Tauri 配置版本号 | `src-tauri/tauri.conf.json` | `"version": "0.4.5"` |
| 0.4 | 更新 README 版本徽章 | `README.md` | 所有 `0.4.4` 引用改为 `0.4.5` |
| 0.5 | 更新 CHANGELOG | `CHANGELOG.md` | 添加 `## [0.4.5]` 条目 |
| 0.6 | 开发服务器验证 | — | `pnpm dev` 启动正常，页面显示 v0.4.5 |

### 验证标准

- [ ] `grep -r "0.4.4" package.json Cargo.toml src-tauri/tauri.conf.json README.md` 返回空
- [ ] 开发服务器启动无错误
- [ ] 页面标题/关于信息显示 v0.4.5

---

## Phase 1：安全漏洞修复（严重级）

**目标**：消除审查报告中所有严重安全问题

### 1A. 文件系统安全

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 1.1 | 缩小 FS scope 到最小权限 | `src-tauri/capabilities/default.json` | `$HOME/**` → `$DOWNLOAD/**` + `$DOCUMENT/**` + `$DESKTOP/**` |
| 1.2 | 移除 CSP 中的 localhost 地址 | `src-tauri/tauri.conf.json` | `connect-src` 中删除 `ws://localhost:1420/`、`http://localhost:1420/`、`http://localhost:3000/`、`http://localhost:5173/` |
| 1.3 | 导出路径验证支持绝对路径 | `src-tauri/src/commands/export.rs` | 接受绝对路径但验证是否在允许目录列表内 |

### 1B. 服务器安全

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 1.4 | 添加请求体大小限制 | `crates/camforge-server/src/main.rs` | 添加 `RequestBodyLimitLayer::new(1024 * 1024)` |
| 1.5 | `CamParams::validate()` 在命令中调用 | `src-tauri/src/commands/simulation.rs` | 在 `run_simulation` 入口调用 `params.validate()?` |
| 1.6 | 添加 NaN/Infinity 验证 | `crates/camforge-core/src/types.rs` | `validate()` 中对所有 `f64` 字段添加 `is_finite()` 检查 |
| 1.7 | 替换服务器中的 `unwrap()` | `crates/camforge-server/src/main.rs` | `TcpListener::bind` 和 `axum::serve` 使用 `?` 传播错误 |
| 1.8 | CSV 导出转义 | `crates/camforge-server/src/routes/export.rs` | 值包含逗号/引号时加引号转义 |

### 1C. 密钥与生成文件清理

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 1.9 | 从磁盘删除密钥文件 | `camforge-next.keystore` | 文件不存在 |
| 1.10 | `.gitignore` 添加 `src-tauri/gen/` | `.gitignore` | 新增 `src-tauri/gen/` 行 |
| 1.11 | 从 Git 取消跟踪生成文件 | `src-tauri/gen/` | `git rm -r --cached src-tauri/gen/` |
| 1.12 | 添加 `LICENSE` 文件 | `LICENSE` | 标准 MIT 许可证文本 |

### 验证标准

- [ ] `cargo clippy --workspace` 无安全相关警告
- [ ] 向 `/api/simulate` 发送 2MB 请求体被拒绝（413）
- [ ] `CamParams` 中 `h = NaN` 时返回验证错误
- [ ] `camforge-next.keystore` 不存在于磁盘
- [ ] `git status` 中 `src-tauri/gen/` 不再出现
- [ ] CSP 中无 localhost 地址

---

## Phase 2：移动端 UI 修复（用户反馈）

**目标**：解决用户反馈的 4 项移动端 UI 问题

### 2A. 移动端顶部双行按钮问题

**问题描述**：移动端浏览器访问时，顶部出现两行都有主题/设置/帮助按钮。第一行（TitleBar 的 Web 模式）在移动端不需要，第二行（mobile header）缺少语言切换按钮。

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 2.1 | TitleBar Web 模式下隐藏移动端 | `src/components/layout/TitleBar.tsx` | Web 模式的 `return` 添加 `isMobile` 判断，移动端返回 `null` |
| 2.2 | mobile header 添加语言切换按钮 | `src/App.tsx` | 在 mobile header 右侧按钮组中添加语言切换按钮（`中文`/`EN`） |
| 2.3 | ARIA 标签国际化 | `src/App.tsx` | 硬编码中文 ARIA 标签改为 `t()` 翻译函数 |

**验证方法**：
- 移动端浏览器访问，顶部仅显示一行按钮栏
- 该行包含：汉堡菜单、CamForge 标题、撤销、重做、语言切换、主题切换、设置、帮助
- 语言切换按钮点击后切换中英文

### 2B. 移动端图表英文文本溢出

**问题描述**：移动端英文模式下，运动曲线/压力角/曲率半径卡片的按钮英文过长、图例过长。

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 2.4 | 缩短英文图表按钮文本 | `src/i18n/translations.ts` | `kinematicsLabel`: `"Kinematics Analysis"` → `"Kinematics"`；`curvatureRadius`/`pressureAngle` 保持不变（已较短） |
| 2.5 | 图例仅保留物理符号 | `src/i18n/translations.ts` | 英文图例：`"Displacement s"` → `"s"`，`"Velocity v"` → `"v"`，`"Acceleration a"` → `"a"`，`"Pressure Angle α"` → `"α"`，`"Theory ρ"` → `"ρ"`，`"Actual ρₐ"` → `"ρₐ"`，`"Threshold"` → `"Limit"` |
| 2.6 | 图例容器添加截断保护 | `src/components/layout/MainCanvas.tsx` | 图例 `div` 添加 `overflow-hidden` 和 `max-w` 约束 |

**验证方法**：
- 移动端英文模式下，图表切换按钮文本不溢出
- 图例仅显示物理符号（s, v, a, α, ρ, ρₐ），不显示英文单词
- 中文模式图例保持不变（中文标签较短）

### 2C. 机构模型卡片信息栏空间优化

**问题描述**：手机端仿真界面机构模型处，位移和压力角数值预留空间过多，导致"机构模型"字样显示不全。

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 2.7 | 移动端数值字段宽度缩减 | `src/components/layout/MainCanvas.tsx:655-658` | 位移数值 `w-[3.5rem]` → `w-[2.8rem]`，压力角 `w-[2.5rem]` → `w-[2rem]`，缩放 `w-[1.5rem]` → `w-[1.2rem]` |
| 2.8 | 移动端数值字号缩减 | 同上 | 移动端使用 `text-[10px]` 替代 `text-xs` |
| 2.9 | 移动端隐藏缩放百分比 | 同上 | `<Show when={!isMobile()}>` 包裹缩放信息 |
| 2.10 | 信息栏添加 `min-w-0` + `truncate` | 同上 | 标题 `span` 添加 `min-w-0 truncate` |

**验证方法**：
- 移动端 375px 宽度下，"机构模型"文字完整显示
- 位移、压力角数值正常显示不截断
- 缩放百分比在移动端隐藏

### 2D. 图表画布右侧空白优化

**问题描述**：运动曲线画布右侧空白空间可缩减。

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 2.11 | 移动端运动曲线 right padding 缩减 | `src/components/charts/MotionCurves.tsx:36` | `< 640` 时 `right: 105` → `right: 80` |
| 2.12 | 移动端曲率半径 right padding 缩减 | `src/components/charts/CurvatureChart.tsx` | 同上调整 |
| 2.13 | 移动端压力角 right padding 缩减 | `src/components/charts/GeometryChart.tsx` | 同上调整 |
| 2.14 | chartDrawing.ts 移动端 padding 同步 | `src/utils/chartDrawing.ts` | 移动端 right padding 同步缩减 |

**验证方法**：
- 移动端图表画布右侧空白明显减少
- Y 轴标签和图例不被裁切
- 桌面端布局不受影响

---

## Phase 3：前端代码质量修复

**目标**：消除审查报告中的前端严重/高优先级代码问题

### 3A. 重复定义合并

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 3.1 | 合并 MotionLaw 枚举 | `src/services/motion.ts` | 从 `types/index.ts` 导入，删除本地重复定义 |
| 3.2 | 合并 isTauriEnv | `src/utils/tauri.ts`、`src/utils/platform.ts` | 统一到 `platform.ts`（含 try/catch），`tauri.ts` 改为从 `platform.ts` 重导出 |
| 3.3 | 合并 MAX_UNDO_STEPS | `src/stores/history.ts`、`src/constants/numeric.ts` | `history.ts` 从 `constants/numeric.ts` 导入 |

### 3B. 验证逻辑修复

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 3.4 | NumberInput 验证优先 | `src/components/controls/NumberInput.tsx` | `onValidate` 在 `onChange` 之前调用 |
| 3.5 | loadPresetFromJSON 类型验证 | `src/stores/simulation.ts` | 解析后验证每个字段类型和范围 |
| 3.6 | CSV 导出转义 | `src/exporters/csv.ts` | 值包含逗号/引号时加引号 |

### 3C. 架构改进

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 3.7 | 使用 SolidJS ErrorBoundary | `src/components/ErrorBoundary.tsx` | 使用 `solid-js` 内置 `<ErrorBoundary>` 组件 |
| 3.8 | canvas getContext 空值检查 | `src/exporters/tiff.ts`、`src/stores/simulation.ts` | 移除 `!` 断言，添加 null 检查和错误处理 |
| 3.9 | useI18n 返回响应式值 | `src/i18n/index.ts` | 返回 `t: t` 和 `language: language`（信号本身） |
| 3.10 | debounceAsync Promise 泄漏修复 | `src/utils/debounce.ts` | 新调用到达时 reject 前一个 pending Promise |
| 3.11 | getCurrentLang 使用响应式信号 | `src/stores/simulation.ts` | 导入 `language` 信号替代直接读 localStorage |
| 3.12 | savePreset 使用 storage 抽象 | `src/stores/simulation.ts` | 预设操作使用 `io/storage.ts` |

### 3D. 性能优化

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 3.13 | 图表使用 arrayMax 替代展开运算符 | 图表组件 | `Math.max(...arr)` → `arrayMax(arr)` |
| 3.14 | 图表响应式使用 useWindowSize | 图表组件 | `window.innerWidth` → `useWindowSize()` hook |
| 3.15 | 提取共享 responsive padding | 新建 `src/utils/responsive.ts` | 三个图表组件共享 `getResponsivePadding()` |
| 3.16 | 提取共享鼠标交互 hook | 新建 `src/hooks/useChartInteraction.ts` | 三个图表组件共享交互逻辑 |
| 3.17 | 提取共享颜色常量 | `src/constants/colors.ts` | 统一调色板，消除硬编码颜色 |
| 3.18 | 移动端触摸 preventDefault | `src/components/animation/CamAnimation.tsx` | 单指滑动时调用 `e.preventDefault()` |
| 3.19 | 合并同组件多次 onMount | 多个组件文件 | 每个组件仅保留一个 `onMount` |

### 3E. 死代码清理

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 3.20 | 删除 tiffWorker.ts | `src/workers/tiffWorker.ts` | 文件不存在 |
| 3.21 | 删除 StatusBar.tsx | `src/components/layout/StatusBar.tsx` | 文件不存在 |
| 3.22 | Sidebar 版本号改用构建常量 | `src/components/layout/Sidebar.tsx`、`vite.config.ts` | 使用 Vite `define` 注入版本号 |
| 3.23 | initTheme 移入 onMount | `src/App.tsx` | 模块级 `initTheme()` 移入组件 `onMount` |

### 验证标准

- [ ] `grep -r "from.*motion.*MotionLaw" src/` 仅从 `types/index.ts` 导入
- [ ] `grep -r "isTauriEnv" src/` 所有导入指向 `platform.ts`
- [ ] `pnpm test:run` 全部通过
- [ ] TypeScript 编译无错误：`npx tsc --noEmit`
- [ ] 移动端浏览器访问无白屏、无控制台错误

---

## Phase 4：后端代码质量修复

**目标**：消除审查报告中的后端严重/高优先级问题

### 4A. 错误处理改进

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 4.1 | 互斥锁中毒恢复改为错误传播 | `src-tauri/src/commands/simulation.rs`、`export.rs` | `unwrap_or_else` → `map_err` 传播 |
| 4.2 | Tauri 命令使用结构化错误类型 | `src-tauri/src/commands/` | 定义 `AppError` 枚举实现 `Serialize`，替代 `String` |
| 4.3 | Response builder 移除 unwrap | `crates/camforge-server/src/routes/export.rs` | 使用 `?` 传播错误 |
| 4.4 | 统一错误消息语言 | `crates/camforge-core/src/types.rs` | 中文错误消息改为英文（与 `full_motion.rs` 一致） |

### 4B. 计算管道去重

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 4.5 | 合并运动规律计算实现 | `crates/camforge-core/src/motion.rs`、`full_motion.rs` | `full_motion.rs` 的 `compute_motion_point` 改为调用 `motion.rs` 的统一实现 |
| 4.6 | 提取共享计算管道 | `crates/camforge-server/src/routes/` | 提取 `run_computation_pipeline()` 函数，模拟和导出共用 |
| 4.7 | 移除 CSV 导出未使用的计算 | `crates/camforge-server/src/routes/export.rs:57` | 删除 `_x_actual, _y_actual` 的无用计算 |

### 4C. 数学精度修复

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 4.8 | 压力角 atan → atan2 | `crates/camforge-core/src/geometry.rs:44` | `numerator.atan2(denominator)` 替代 `(numerator / denominator).atan()` |
| 4.9 | 添加零分母防护 | 同上 | 分母为零时返回 `f64::INFINITY` 而非 NaN |
| 4.10 | 浮点比较改用 EPSILON | `crates/camforge-core/src/profile.rs:98` | `r_r == 0.0` → `r_r.abs() < f64::EPSILON` |
| 4.11 | powf(1.5) 优化 | `crates/camforge-core/src/geometry.rs:86` | `powf(1.5)` → `speed_sq * speed_sq.sqrt()` |
| 4.12 | 五次/七次多项式预计算优化 | `crates/camforge-core/src/motion.rs:77-99` | 使用预计算的 `t5 = t4 * t`、`t7 = t6 * t` |

### 4D. 服务器改进

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 4.13 | 同步命令改异步 | `src-tauri/src/commands/` | 重计算命令使用 `spawn_blocking` |
| 4.14 | SimulationData 使用 Arc 共享 | `src-tauri/src/commands/simulation.rs` | `Arc<SimulationData>` 替代 `.clone()` |
| 4.15 | 旋转轮廓缓存 | `src-tauri/src/commands/simulation.rs` | 缓存旋转后的轮廓，仅角度变化时重新计算 |
| 4.16 | 服务器结构化日志 | `crates/camforge-server/src/main.rs` | `println!` → `tracing::info!` |
| 4.17 | CORS 环境变量添加警告 | `crates/camforge-server/src/main.rs` | `CORS_ORIGINS=*` 时输出警告日志 |

### 验证标准

- [ ] `cargo test --workspace` 全部通过
- [ ] `cargo clippy --workspace -- -D warnings` 无警告
- [ ] 压力角计算在退化输入下不返回 NaN
- [ ] 服务器启动失败时显示有用错误信息而非 panic
- [ ] 服务器请求体超过 1MB 时返回 413

---

## Phase 5：测试覆盖提升

**目标**：补齐关键模块的测试覆盖

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 5.1 | camforge-server 集成测试 | `crates/camforge-server/tests/` | 健康检查、模拟、导出端点测试 |
| 5.2 | camforge-core 边界测试 | `crates/camforge-core/src/types.rs` | n_points 边界(36/720)、NaN/Infinity、e=r_0 |
| 5.3 | camforge-core 运动规律测试 | `crates/camforge-core/src/full_motion.rs` | 各运动规律单独测试、相位边界连续性 |
| 5.4 | API 适配器测试 | `src/api/__tests__/` | Tauri/HTTP 双模式切换测试 |
| 5.5 | history store 测试 | `src/stores/__tests__/history.test.ts` | 撤销/重做、最大步数、边界情况 |
| 5.6 | 组件核心测试 | `src/components/__tests__/` | NumberInput 验证、ErrorBoundary 捕获 |
| 5.7 | 设置覆盖率阈值 | `vitest.config.ts` | `coverage.thresholds: { lines: 40, branches: 30 }` |
| 5.8 | CI 测试命令修正 | `.github/workflows/test.yml` | `pnpm test:run`、`cargo test --workspace` |

### 验证标准

- [ ] `pnpm test:run` 全部通过
- [ ] `cargo test --workspace` 全部通过
- [ ] 前端行覆盖率 ≥ 40%
- [ ] CI 流水线绿色通过

---

## Phase 6：依赖管理与配置清理

**目标**：清理冗余依赖、修复配置问题

### 6A. 依赖清理

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 6.1 | 移除 camforge-core 未使用的 serde_json | `crates/camforge-core/Cargo.toml` | 编译通过 |
| 6.2 | 移除 src-tauri 未使用的依赖 | `src-tauri/Cargo.toml` | 移除 `anyhow`、确认 `serde_json`/`num-traits` 是否为传递依赖 |
| 6.3 | 移除冗余 autoprefixer | `postcss.config.js`、`package.json` | 构建正常 |
| 6.4 | Tailwind v4 配置验证 | `tailwind.config.js` | 确认 `@config` 指令存在或迁移到 CSS 配置 |
| 6.5 | 更新 TypeScript 版本 | `package.json` | `~5.6.2` → `^5.8.0` |
| 6.6 | 更新 thiserror 版本 | `Cargo.toml` | `"1.0"` → `"2"` |
| 6.7 | 删除重复 Cargo.lock | `src-tauri/Cargo.lock` | 文件不存在 |
| 6.8 | Docker Compose 移除 version | `docker-compose.yml` | 删除 `version: '3.8'` |

### 6B. 开发工具配置

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 6.9 | 添加 ESLint 配置 | `eslint.config.js` | `@typescript-eslint` + `eslint-plugin-solid` |
| 6.10 | 添加 Prettier 配置 | `.prettierrc` | 2 空格缩放、分号、单引号 |
| 6.11 | 添加 .editorconfig | `.editorconfig` | 与 CONTRIBUTING.md 规范一致 |
| 6.12 | 添加 pre-commit hooks | `.husky/`、`package.json` | `husky` + `lint-staged` |
| 6.13 | 添加 pnpm 版本约束 | `package.json` | `"packageManager": "pnpm@9.x.x"` |
| 6.14 | Dockerfile 使用 corepack | `Dockerfile` | `corepack enable && corepack prepare pnpm@9 --activate` |

### 验证标准

- [ ] `pnpm install` 无冗余依赖警告
- [ ] `cargo build --workspace` 编译通过
- [ ] `pnpm build` 构建成功
- [ ] ESLint + Prettier 运行无错误
- [ ] `docker compose build` 无弃用警告

---

## Phase 7：文档与仓库清理

**目标**：完善文档、清理仓库

### 7A. 文档完善

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 7.1 | 添加 SECURITY.md | `SECURITY.md` | 包含漏洞报告流程 |
| 7.2 | 修复 CHANGELOG 比较链接 | `CHANGELOG.md` | 添加 v0.4.3、v0.4.4、v0.4.5 比较链接 |
| 7.3 | 修复 CHANGELOG Tauri identifier 记录 | `CHANGELOG.md` | v0.4.2 条目中 `com.camforge.app` → `top.camforge.app` |
| 7.4 | 修复 robots.txt sitemap | `public/robots.txt` | 移除不存在的 Sitemap 引用或添加 sitemap.xml |
| 7.5 | PWA manifest 补充 192x192 图标 | `public/manifest.json` | 添加 192x192 图标条目 |

### 7B. 不必要文件清理（项目内）

以下文件/目录在项目内不再需要，应删除：

| # | 文件/目录 | 大小 | 原因 | 验证方法 |
|---|-----------|------|------|----------|
| 7.6 | `camforge-next.keystore` | 4KB | 签名密钥不应存于项目目录 | 文件不存在 |
| 7.7 | `package-lock.json` | 238KB | 使用 pnpm，npm lock 文件冗余 | 文件不存在 |
| 7.8 | `src-tauri/Cargo.lock` | 137KB | 工作区级 Cargo.lock 已存在 | 文件不存在 |
| 7.9 | `crates/camforge-core/target/` | — | 独立 target 目录冗余（工作区共享 target） | 目录不存在 |
| 7.10 | `src/components/layout/StatusBar.tsx` | — | 死文件，仅含注释 | 文件不存在 |
| 7.11 | `src/workers/tiffWorker.ts` | — | 死代码，从未使用 | 文件不存在 |
| 7.12 | `remotion.config.ts` | — | 仅用于 splash 动画预览，非核心功能 | 评估是否保留 |

### 7C. 不应同步到 GitHub 的文件/目录

以下文件/目录应从 Git 跟踪中移除并加入 `.gitignore`：

| # | 文件/目录 | 大小 | 原因 |
|---|-----------|------|------|
| 7.13 | `src-tauri/gen/` | 1.3MB | Tauri 自动生成，`tauri init` 时重新生成 |
| 7.14 | `camforge-next.keystore` | 4KB | 签名密钥，安全敏感 |
| 7.15 | `package-lock.json` | 238KB | 使用 pnpm 管理依赖，npm lock 冗余 |
| 7.16 | `pnpm-lock.yaml` | 153KB | 应保留在 Git 中（**不删除**，仅列示说明） |
| 7.17 | `public/showcase/` | 7.9MB | 大型 GIF/PNG，应使用 Git LFS 或外部托管 |
| 7.18 | `public/showcase-en/` | 8.0MB | 同上 |

**`.gitignore` 需新增的条目**：

```gitignore
# Tauri 自动生成
src-tauri/gen/

# 签名密钥（显式文件名）
camforge-next.keystore

# npm lock（使用 pnpm）
package-lock.json
```

### 验证标准

- [ ] `git ls-files src-tauri/gen/` 返回空
- [ ] `git ls-files camforge-next.keystore` 返回空
- [ ] `git ls-files package-lock.json` 返回空
- [ ] LICENSE、SECURITY.md 文件存在
- [ ] CHANGELOG 比较链接完整

---

## Phase 8：兼容性与可访问性改进

**目标**：改善移动端体验和无障碍访问

| # | 任务 | 文件 | 验证方法 |
|---|------|------|----------|
| 8.1 | HTML lang 属性动态化 | `index.html`、`src/i18n/index.ts` | 语言切换时更新 `document.documentElement.lang` |
| 8.2 | 移动端条件性禁用缩放 | `index.html` | 仅移动端设置 `user-scalable=no` |
| 8.3 | Toggle 组件接口统一 | `src/components/controls/Toggle.tsx` | 接受 `checked: boolean` 而非 `() => boolean` |
| 8.4 | 面板拖拽支持触摸 | `src/components/layout/HelpPanel.tsx`、`SettingsPanel.tsx` | 使用 pointer events 替代 mouse events |
| 8.5 | generateSVG XML 转义 | `src/stores/simulation.ts` | 插入值进行 XML 特殊字符转义 |
| 8.6 | DXF 导出辅助宏 | `src-tauri/src/commands/export.rs` | 提取 `dxf_line!` 宏减少重复 |

### 验证标准

- [ ] 英文模式下 `<html lang="en">`，中文模式下 `<html lang="zh-CN">`
- [ ] 移动端双指缩放功能正常
- [ ] Toggle 组件 props 使用 `checked={boolean}`
- [ ] 移动端面板可触摸拖拽

---

## 执行顺序与依赖关系

```
Phase 0 (版本号)
    ↓
Phase 1 (安全) ← 最高优先级，无依赖
    ↓
Phase 2 (移动端 UI) ← 依赖 Phase 0
    ↓
Phase 3 (前端代码) ← 依赖 Phase 1
    ↓
Phase 4 (后端代码) ← 依赖 Phase 1
    ↓
Phase 5 (测试) ← 依赖 Phase 3 + 4
    ↓
Phase 6 (依赖配置) ← 可与 Phase 5 并行
    ↓
Phase 7 (文档清理) ← 可与 Phase 5/6 并行
    ↓
Phase 8 (兼容性) ← 最后执行
```

**建议**：每个 Phase 完成后在开发服务器上验证，确认无回归后再进入下一阶段。

---

## 版本发布检查清单

Phase 0-8 全部完成后：

- [ ] 所有文件中版本号统一为 `0.4.5`
- [ ] `pnpm test:run` 全部通过
- [ ] `cargo test --workspace` 全部通过
- [ ] `cargo clippy --workspace -- -D warnings` 无警告
- [ ] `npx tsc --noEmit` 无类型错误
- [ ] `pnpm build` 构建成功
- [ ] `cargo build --release --workspace` 编译成功
- [ ] 开发服务器手动验证桌面端功能正常
- [ ] 移动端浏览器手动验证 UI 正常
- [ ] CHANGELOG.md 更新完整
- [ ] 无敏感文件（密钥、.env）在 Git 中
- [ ] `src-tauri/gen/` 已从 Git 移除
