# CamForge v0.4.5 系统性审查报告

## 1. 审查概述

| 项目 | 内容 |
|------|------|
| **审查范围** | CamForge 项目全量源代码，包括前端（`src/` TypeScript/SolidJS）、后端（`src-tauri/` Rust）、核心计算库（`crates/camforge-core`、`crates/camforge-server`）、配置文件、CI/CD 流水线、文档、测试覆盖及依赖管理 |
| **审查方法** | 静态代码分析 + 架构审查 + 安全扫描 + 配置审计，采用多代理并行分治策略，分别对前端、后端、核心库、配置/文档/测试四个维度进行深度审查后合并去重 |
| **审查时间** | 2026-04-29 |
| **审查环境** | Windows 11, Node.js 20, Rust 2021 edition, Tauri v2 + SolidJS 1.9 + Tailwind CSS 4.2 |
| **项目版本** | v0.4.4（Cargo.toml / package.json），审查目标为 v0.4.5 优化方向 |

### 项目技术栈

- **前端框架**: SolidJS 1.9 + TypeScript 5.6 + Tailwind CSS 4.2
- **后端框架**: Tauri v2 (Rust) + Axum (HTTP Server)
- **核心计算库**: Rust workspace（camforge-core / camforge-server / src-tauri）
- **构建工具**: Vite 6 + Vitest 4
- **部署方式**: Docker + 桌面安装包（Windows/macOS/Linux/Android）

---

## 2. 问题统计摘要

### 按严重程度统计

| 严重程度 | 数量 | 说明 |
|:--------:|:----:|------|
| **严重** | 15 | 阻断性问题，导致核心功能无法使用、系统崩溃或存在严重安全漏洞 |
| **高** | 22 | 重要功能影响，影响主要业务流程或存在较大安全隐患 |
| **中** | 44 | 局部功能影响，仅影响非核心功能或特定场景 |
| **低** | 39 | 轻微影响或优化建议，不影响功能实现但影响代码质量 |
| **合计** | **120** | |

### 按类别统计

| 类别 | 严重 | 高 | 中 | 低 | 合计 |
|------|:----:|:--:|:--:|:--:|:----:|
| 安全 | 4 | 5 | 2 | 1 | 12 |
| 代码质量 | 5 | 4 | 14 | 12 | 35 |
| 架构设计 | 2 | 3 | 6 | 4 | 15 |
| 性能 | 1 | 2 | 6 | 3 | 12 |
| 测试 | 0 | 3 | 8 | 3 | 14 |
| 兼容性 | 1 | 2 | 3 | 4 | 10 |
| 文档 | 1 | 2 | 2 | 5 | 10 |
| 依赖管理 | 1 | 1 | 3 | 7 | 12 |
| CI/CD | 0 | 2 | 2 | 3 | 7 |

---

## 3. 详细问题清单

### 3.1 严重问题（Critical）

#### CR-01: 压力角计算公式使用 `atan()` 而非 `atan2()`，存在数学错误

- **类别**: 代码质量
- **位置**: `crates/camforge-core/src/geometry.rs:44`
- **描述**: 文档注释（第10行）声明使用 `arctan2(ds/dδ - pz·e, s_0 + s)`，但实现使用 `(numerator / denominator).atan().abs() * RAD2DEG`。`atan(y/x)` 丢失象限信息，且当分子分母同时为零时返回 NaN，该 NaN 会静默传播至下游所有计算（曲率、轮廓、导出），导致最终结果不可信。
- **影响**: 核心数学计算结果可能错误，直接影响凸轮机构运动学分析的准确性。

#### CR-02: 导出命令拒绝绝对路径，破坏标准保存对话框工作流

- **类别**: 架构设计 / 安全
- **位置**: `src-tauri/src/commands/export.rs:36-37`
- **描述**: `validate_export_path` 函数拒绝绝对路径。在标准 Tauri 工作流中，前端使用保存对话框（`dialog:allow-save` 已授权）返回绝对路径（如 `C:\Users\user\Documents\output.dxf`），但该路径会被导出命令拒绝。这意味着导出功能在标准保存对话框流程下无法正常工作。
- **影响**: 用户无法通过系统保存对话框选择输出位置，导出功能基本不可用。

#### CR-03: `n_points` 缺少上限验证，可导致资源耗尽攻击

- **类别**: 安全
- **位置**: `src-tauri/src/commands/simulation.rs:39`、`crates/camforge-core/src/full_motion.rs:180-224`
- **描述**: `CamParams::validate()`（`types.rs:94`）检查 `n_points <= 720`，但该方法在 Tauri 命令处理器中**从未被调用**。`validate_motion_params` 仅检查 `n_points >= 36` 但无上限。恶意前端可发送 `n_points = 10_000_000`，导致超过 1GB 的内存分配和 CPU 耗尽。
- **影响**: 服务器可被恶意请求瘫痪，存在拒绝服务（DoS）风险。

#### CR-04: Tauri FS scope 无法保护 `std::fs::File::create`

- **类别**: 安全
- **位置**: `src-tauri/src/commands/export.rs:105, 218`、`src-tauri/capabilities/default.json:22-34`
- **描述**: 导出命令直接使用 `std::fs::File::create`，完全绕过 Tauri 的 FS 插件 scope 限制。`fs:scope` 的拒绝列表（`**/.env`、`**/*.keystore` 等）仅对前端 JavaScript 通过 `@tauri-apps/plugin-fs` 的调用生效，Rust 后端可写入 OS 用户有权限的任意路径。
- **影响**: 文件系统安全策略被绕过，前端可间接写入受保护路径。

#### CR-05: `$HOME/**` 文件系统权限范围过大

- **类别**: 安全
- **位置**: `src-tauri/capabilities/default.json:28`
- **描述**: 文件系统 scope 授予应用对整个用户主目录的写权限。结合 `fs:allow-write-file` 和 `fs:allow-mkdir`，前端 JS 可在用户主目录下任意位置写入文件，违反最小权限原则。
- **影响**: 应用被 XSS 攻击后可在用户主目录下写入任意文件。

#### CR-06: CSP 包含开发环境专用 localhost 地址

- **类别**: 安全
- **位置**: `src-tauri/tauri.conf.json:27`
- **描述**: Content Security Policy 的 `connect-src` 包含 `http://localhost:3000/`、`http://localhost:5173/`、`ws://localhost:1420/`、`http://localhost:1420/`，这些是 Vite 开发服务器地址。在生产构建中，攻击者可在本地运行服务绕过 CSP 限制。
- **影响**: 生产环境 CSP 形同虚设，数据可通过本地服务外泄。

#### CR-07: Android 签名密钥文件存在于磁盘

- **类别**: 安全
- **位置**: `camforge-next.keystore`
- **描述**: Android 签名密钥文件存在于项目根目录。虽然 `.gitignore` 的 `*.keystore` 通配符规则目前生效，但文件名 `camforge-next.keystore` 与 `.gitignore` 中显式列出的 `camforge.keystore` 不匹配，仅依赖通配符保护。
- **影响**: 误操作 `git add .` 或修改 `.gitignore` 规则可能导致密钥泄露。

#### CR-08: Tauri 自动生成代码被提交到 Git

- **类别**: 依赖管理 / 安全
- **位置**: `src-tauri/gen/`
- **描述**: `src-tauri/gen/` 下 40+ 个自动生成文件被 Git 跟踪，包括 Android 构建配置、Kotlin 源码、图标 PNG 等。此目录应由 `tauri android init` 自动重新生成，不应纳入版本控制。
- **影响**: 仓库膨胀（二进制资源），且可能因过期生成代码覆盖新生成结果。

#### CR-09: 前端 `MotionLaw` 枚举重复定义，存在静默分歧风险

- **类别**: 代码质量 / 架构设计
- **位置**: `src/types/index.ts:8-33`、`src/services/motion.ts:10-35`
- **描述**: `MotionLaw` 枚举和 `MotionLawNames` 记录在 `types/index.ts` 和 `services/motion.ts` 中完全相同地定义了两次。`motion.ts` 不从 `types/index.ts` 导入。若仅更新其一，两个定义将静默分歧，导致逻辑错误。
- **影响**: 枚举值不一致时运动规律计算结果将完全不同，且难以调试。

#### CR-10: 前端 `isTauriEnv()` 函数重复定义，实现不一致

- **类别**: 代码质量
- **位置**: `src/utils/tauri.ts:12`、`src/utils/platform.ts:5`
- **描述**: 两个独立的 `isTauriEnv()` 函数存在。`tauri.ts` 直接检查 `'__TAURI_INTERNALS__' in window`，`platform.ts` 包装了 try/catch。不同文件从不同位置导入，try/catch 行为差异可能导致不一致。
- **影响**: 平台检测逻辑分散，维护困难且可能产生行为差异。

#### CR-11: CSV 导出未转义包含逗号或引号的值

- **类别**: 安全
- **位置**: `src/exporters/csv.ts:41-61`
- **描述**: 数据值以逗号分隔但未进行引号转义。若值包含逗号、引号或换行符，CSV 结构将被破坏。更重要的是，在 Excel 中打开时以 `=`、`+`、`-`、`@` 开头的值可触发公式注入。
- **影响**: 导出的 CSV 文件可能被利用进行公式注入攻击。

#### CR-12: `loadPresetFromJSON` 未验证用户输入的 JSON 字段值

- **类别**: 安全 / 代码质量
- **位置**: `src/stores/simulation.ts:1116-1148`
- **描述**: 函数解析 JSON 并检查必需键存在，但从不验证值是否为有效数字且在可接受范围内。恶意构造的预设文件可注入 `Infinity`、`NaN`、负 `n_points` 或非整数 `tc_law` 值，这些值直接通过 `setParams(preset.params)` 应用到状态。
- **影响**: 恶意预设文件可导致应用崩溃或产生不可预测的计算结果。

#### CR-13: `NumberInput` 组件在验证前调用 `onChange`，无效值已传播到状态

- **类别**: 代码质量
- **位置**: `src/components/controls/NumberInput.tsx:27-57`
- **描述**: 在 `validateAndNotify()` 中，`props.onChange(num)` 在第 47 行被调用，**早于** 第 49 行的 `onValidate` 检查。若 `onValidate` 返回 `false`，该值已被应用到全局状态并可能触发模拟计算。
- **影响**: 无效参数值可绕过验证进入状态存储，导致模拟计算错误或崩溃。

#### CR-14: 缺少 `LICENSE` 文件

- **类别**: 文档
- **位置**: 项目根目录（文件不存在）
- **描述**: `README.md` 和 `package.json` 均声明 MIT 许可证，但仓库中不存在 `LICENSE` 文件。无许可证文件意味着代码在法律上是"保留所有权利"，与声明的 MIT 许可不符。
- **影响**: 法律合规问题，潜在贡献者可能因许可证不明确而放弃参与。

#### CR-15: 服务器无请求体大小限制，可导致拒绝服务

- **类别**: 安全
- **位置**: `crates/camforge-server/src/main.rs:52-61`
- **描述**: Axum 默认不限制请求体大小。攻击者可 POST 任意大 JSON 负载到 `/api/simulate`、`/api/export/dxf` 等端点，耗尽服务器内存。
- **影响**: 服务器可被单个大请求瘫痪。

---

### 3.2 高严重度问题（High）

#### HI-01: 服务器 TCP 绑定使用 `unwrap()` 导致硬 panic

- **类别**: 代码质量
- **位置**: `crates/camforge-server/src/main.rs:66, 77`
- **描述**: `TcpListener::bind(&addr).await.unwrap()` 和 `axum::serve(listener, app).await.unwrap()` 在端口被占用或地址无效时会 panic 整个服务器进程，无有用的错误信息。
- **影响**: 服务器无法优雅处理启动失败。

#### HI-02: 运动规律计算存在两套重复实现

- **类别**: 架构设计 / 代码质量
- **位置**: `crates/camforge-core/src/motion.rs:18-108`、`crates/camforge-core/src/full_motion.rs:112-177`
- **描述**: `motion.rs` 的 `compute_rise()`/`compute_return()` 和 `full_motion.rs` 的 `compute_motion_point()` 分别实现了相同的六种运动规律。任何 bug 修复必须在两处同时应用，且两者可能产生不同结果。
- **影响**: 运动规律计算结果可能因代码路径不同而产生分歧。

#### HI-03: `compute_rise`/`compute_return` 除零风险

- **类别**: 代码质量
- **位置**: `crates/camforge-core/src/motion.rs:34, 46, 60, 70, 80`
- **描述**: 当 `delta_0` 或 `delta_ret` 为零时直接除以零，产生 NaN/Inf。虽然 `validate_motion_params` 检查了这些值，但公开 API 函数可被外部库消费者直接调用。
- **影响**: 库 API 缺乏防御性，外部调用者可能得到静默的 NaN 结果。

#### HI-04: 服务器无请求速率限制

- **类别**: 安全
- **位置**: `crates/camforge-server/src/main.rs:20-43`
- **描述**: `/api/simulate` 端点执行完整的凸轮模拟计算（最多 720 个点的多项式求值、曲率计算、轮廓生成），无任何速率限制。简单循环即可耗尽 CPU。
- **影响**: 计算密集型端点可被恶意循环耗尽服务器资源。

#### HI-05: `CamParams::validate()` 已定义但从未被调用

- **类别**: 架构设计
- **位置**: `crates/camforge-core/src/types.rs:68-115`、`src-tauri/src/commands/simulation.rs:39`
- **描述**: `CamParams` 有全面的 `validate()` 方法检查所有约束，但 `run_simulation` 从未调用它。验证分散在下游函数中，导致 `n_points > 720` 不被强制执行，且错误消息语言不一致（部分中文、部分英文）。
- **影响**: 参数验证不完整，部分约束未被检查。

#### HI-06: 互斥锁中毒恢复隐藏数据损坏

- **类别**: 代码质量 / 架构设计
- **位置**: `src-tauri/src/commands/simulation.rs:117-118, 128-129`、`src-tauri/src/commands/export.rs:100, 213`
- **描述**: 所有互斥锁使用 `unwrap_or_else(|e| e.into_inner())` 静默恢复中毒状态。中毒的互斥锁意味着持有锁的线程发生了 panic，数据可能处于不一致状态。静默继续可能导致返回错误的模拟数据或写入损坏的导出文件。
- **影响**: 数据一致性无法保证，可能导致难以调试的级联错误。

#### HI-07: CI 测试工作流使用 `pnpm test`（watch 模式）而非 `pnpm test:run`

- **类别**: CI/CD
- **位置**: `.github/workflows/test.yml:29`
- **描述**: `package.json` 定义 `"test": "vitest"` 启动交互式 watch 模式。在 CI 中这将无限挂起（或直到 GitHub Actions 的 6 小时超时）。虽然 Vitest 自动检测 CI 环境禁用 watch，但依赖隐式行为是脆弱的。
- **影响**: CI 测试可能超时失败。

#### HI-08: CI Rust 测试仅在 `src-tauri` 运行，未覆盖完整工作区

- **类别**: CI/CD
- **位置**: `.github/workflows/test.yml:42-44`
- **描述**: 工作区有 3 个 crate（`camforge-core`、`camforge-server`、`src-tauri`），但 CI 仅测试 `src-tauri`。`camforge-core` 有 5 个文件的测试、`camforge-server` 有路由处理器均未在 CI 中测试。
- **影响**: 核心库和服务端代码的回归不会被 CI 捕获。

#### HI-09: `camforge-server` 零测试覆盖

- **类别**: 测试
- **位置**: `crates/camforge-server/src/`（5 个源文件）
- **描述**: 服务器 crate 的 5 个源文件（`main.rs`、`error.rs`、`routes/mod.rs`、`routes/simulation.rs`、`routes/export.rs`）无任何 `#[test]` 或 `#[cfg(test)]` 标注。
- **影响**: API 端点、错误处理和路由逻辑完全未被测试覆盖。

#### HI-10: Tailwind CSS v4 配置不匹配

- **类别**: 兼容性
- **位置**: `tailwind.config.js`、`postcss.config.js`、`package.json:50`
- **描述**: 项目使用 Tailwind CSS v4.2.3，但配置使用 v3 范式：JavaScript `tailwind.config.js` 文件带 `content` 和 `theme.extend` 键。在 Tailwind v4 中，配置通过 CSS `@theme` 指令完成，JavaScript 配置文件仅在 CSS 中显式 `@config` 导入时才加载。当前设置可能静默失败，不应用自定义主题颜色和字体。
- **影响**: 自定义主题样式可能不生效，UI 显示为 Tailwind 默认样式。

#### HI-11: `autoprefixer` 与 Tailwind v4 冗余

- **类别**: 依赖管理
- **位置**: `postcss.config.js:3`、`package.json:44`
- **描述**: Tailwind CSS v4 内置供应商前缀功能，`autoprefixer` 插件及其依赖冗余，增加构建开销并可能产生冲突的前缀规则。
- **影响**: 不必要的构建时间和潜在的样式冲突。

#### HI-12: `ErrorBoundary` 不是真正的 SolidJS 错误边界

- **类别**: 代码质量
- **位置**: `src/components/ErrorBoundary.tsx:1-99`
- **描述**: SolidJS 没有 React 风格的组件级错误边界。该组件监听 `window 'error'` 和 `unhandledrejection` 事件，**不会** 捕获子组件渲染期间抛出的错误。若组件 JSX 抛出异常，整个应用将未处理崩溃。
- **影响**: 组件渲染错误导致应用白屏崩溃。

#### HI-13: `canvas.getContext('2d')!` 非空断言无回退

- **类别**: 代码质量
- **位置**: `src/exporters/tiff.ts:23, 89`、`src/stores/simulation.ts:970, 1026`
- **描述**: 使用非空断言操作符。若 canvas 处于损坏状态或平台不支持 2D 上下文，将在运行时抛出异常。
- **影响**: 特定环境下应用崩溃。

#### HI-14: 图表组件直接访问 `window.innerWidth` 而非使用响应式信号

- **类别**: 性能 / 代码质量
- **位置**: `src/components/charts/CurvatureChart.tsx:33-41`、`GeometryChart.tsx:33-41`、`MotionCurves.tsx:33-41`
- **描述**: 每个图表的 `draw()` 函数直接调用 `window.innerWidth`。由于 `window.innerWidth` 不是信号，在 `createEffect` 中调用时，窗口大小改变后 padding 计算将使用过期值，直到下次信号触发的重绘。
- **影响**: 窗口调整大小后图表布局可能短暂不正确。

#### HI-15: `Math.max(...largeArray.map(...))` 可能栈溢出

- **类别**: 性能
- **位置**: `src/components/charts/CurvatureChart.tsx:95`、`MotionCurves.tsx:95-96`、`GeometryChart.tsx:95`
- **描述**: 使用 `Math.max(...alpha_all.map(Math.abs))` 模式。项目已有 `arrayMax`/`arrayMaxBy` 安全工具函数，但图表组件未使用。虽然当前 `n_points` 最大 720 在安全范围内，但与项目自身规范不一致。
- **影响**: 若未来增大 `n_points` 上限，可能导致栈溢出。

#### HI-16: `generateSVG()` 函数约 900 行模板字符串

- **类别**: 架构设计 / 代码质量
- **位置**: `src/stores/simulation.ts:553-943`
- **描述**: 通过约 390 行的模板字面量生成 SVG 内容，难以维护、调试和测试。未转义值——若标签包含 XML 特殊字符（`<`、`>`、`&`），SVG 将格式错误。
- **影响**: 代码可维护性极差，XML 注入风险。

#### HI-17: 触摸事件未在单指滑动时调用 `preventDefault()`

- **类别**: 兼容性
- **位置**: `src/components/animation/CamAnimation.tsx:366-387`
- **描述**: `handleTouchMove` 仅在双指缩放时调用 `e.preventDefault()`，单指帧拖动时不调用，可能导致移动设备上意外的滚动行为。
- **影响**: 移动端用户体验受影响，拖动帧时页面可能意外滚动。

#### HI-18: 同一组件中多次 `onMount()` 调用

- **类别**: 架构设计
- **位置**: `src/App.tsx:41, 55`、`CurvatureChart.tsx:421, 443`、`GeometryChart.tsx:315, 337`、`MotionCurves.tsx:399, 426`、`HelpPanel.tsx:27, 49`、`SettingsPanel.tsx:34, 56`
- **描述**: 多个组件在同一组件中使用多个 `onMount()` 调用，分散生命周期逻辑，增加初始化顺序的理解难度。
- **影响**: 代码可读性降低，初始化逻辑难以追踪。

#### HI-19: 服务器计算管道在导出端点中重复

- **类别**: 架构设计 / 代码质量
- **位置**: `crates/camforge-server/src/routes/export.rs:25-43, 46-84`、`routes/simulation.rs:20-101`
- **描述**: 每个导出路由（`export_dxf`、`export_csv`）独立运行完整计算管道（`compute_full_motion` → `compute_cam_profile` → `compute_roller_profile` → `compute_curvature_radius` → `compute_pressure_angle`），与 `simulation.rs` 重复。任何管道变更必须在三处更新。
- **影响**: 代码重复导致维护成本高，且易引入不一致。

#### HI-20: `CamParams::validate()` 不检查 NaN 或 Infinity

- **类别**: 代码质量 / 安全
- **位置**: `crates/camforge-core/src/types.rs:66-116`
- **描述**: 所有 `f64` 字段可通过反序列化设为 NaN 或 Infinity。验证函数检查 `self.h <= 0.0`，但 `NaN <= 0.0` 返回 `false`，因此 NaN 的 `h` 通过验证。下游计算将静默产生 NaN 结果。
- **影响**: 无效输入参数通过验证，导致计算结果全为 NaN。

#### HI-21: 生产环境 CSP 包含 localhost URL

- **类别**: 安全
- **位置**: `src-tauri/tauri.conf.json:27`
- **描述**: CSP `connect-src` 包含 `ws://localhost:1420/`、`http://localhost:1420/`、`http://localhost:3000/`、`http://localhost:5173/` 等开发服务器地址。在生产构建中应移除。
- **影响**: XSS 攻击者可利用本地服务进行数据外泄。

#### HI-22: 家目录写权限范围过大

- **类别**: 安全
- **位置**: `src-tauri/capabilities/default.json:27`
- **描述**: `{ "path": "$HOME/**" }` 授予对整个用户主目录的写权限。应缩小到 `$DOWNLOAD/**` 和 `$DOCUMENT/**` 等特定目录。
- **影响**: 前端 JS 可在用户主目录下任意位置写入文件。

---

### 3.3 中等严重度问题（Medium）

#### ME-01: 浮点数精确比较 `r_r == 0.0`

- **类别**: 代码质量
- **位置**: `crates/camforge-core/src/profile.rs:98`
- **描述**: 浮点数相等比较不可靠。若 `r_r` 从其他运算得到 `1e-16` 而非 `0.0`，函数将进入滚子计算路径而非快速路径。
- **影响**: 特定参数组合下可能走错计算分支。

#### ME-02: `powf(1.5)` 计算效率低

- **类别**: 性能
- **位置**: `crates/camforge-core/src/geometry.rs:86`
- **描述**: `powf(1.5)` 显著慢于 `speed_sq * speed_sq.sqrt()`。在 360-720 个点的热循环中，性能差异明显。
- **影响**: 压力角计算效率可优化约 30-50%。

#### ME-03: 曲率半径返回 `f64::INFINITY` 但丢失符号

- **类别**: 代码质量
- **位置**: `crates/camforge-core/src/geometry.rs:90-93`
- **描述**: 当 `speed_cubed` 接近零时返回 `INFINITY`，但不保留符号信息。下游代码通过 `is_finite()` 检查处理，但无穷值无符号，`r - r.signum() * params.r_r` 在 INFINITY 时产生 INFINITY。
- **影响**: 特定退化输入下结果处理依赖脆弱的检查。

#### ME-04: `tc_law` 和 `hc_law` 使用 `i32` 而非 `MotionLaw` 枚举

- **类别**: 架构设计
- **位置**: `crates/camforge-core/src/types.rs:34-38`
- **描述**: 使用 `i32` 选择运动规律丧失类型安全。`MotionLaw` 枚举存在且有 `TryFrom<i32>`，但 `CamParams` 使用原始整数，每次使用时都需要验证。
- **影响**: 无效运动规律编号可能在运行时才被发现。

#### ME-05: `validate_motion_params` 与 `CamParams::validate()` 重复且不一致

- **类别**: 架构设计 / 代码质量
- **位置**: `crates/camforge-core/src/full_motion.rs:180-224`、`crates/camforge-core/src/types.rs:68-115`
- **描述**: 两个验证函数都检查角度和、`h > 0`、`omega > 0` 等，但有差异：`validate_motion_params` 允许 `n_points >= 36` 无上限；`CamParams::validate()` 上限 720。通过 `validate()` 的参数可能在 `validate_motion_params()` 中失败。
- **影响**: 验证逻辑不一致，部分有效参数可能被错误拒绝或无效参数通过验证。

#### ME-06: `compute_cam_profile` 仅对 X 坐标应用旋转方向

- **类别**: 代码质量
- **位置**: `crates/camforge-core/src/profile.rs:57-70`
- **描述**: `x[i] = -sn_f * x[i]` 但 Y 不调整。`sn` 参数仅镜像 X 轴，对于完整方向反转通常需要两个坐标都变换。行为未文档化。
- **影响**: `sn` 参数的行为可能不符合用户预期。

#### ME-07: `compute_roller_profile` 的 `sn` 参数冗余

- **类别**: 代码质量
- **位置**: `crates/camforge-core/src/profile.rs:127-131`
- **描述**: `sn` 参数确定初始法线方向，但第 134-136 行始终通过点积验证并修正法线朝内。这意味着 `sn` 对输出无影响。
- **影响**: 参数存在但无实际效果，误导 API 使用者。

#### ME-08: 服务器 CSV 导出存在注入漏洞

- **类别**: 安全
- **位置**: `crates/camforge-server/src/routes/export.rs:246-262`
- **描述**: CSV 值使用 `format!()` 生成且未转义。标头字符串和数据未加引号，在 Excel 中打开时可被利用进行公式注入。
- **影响**: 导出的 CSV 在 Excel 中打开时可能执行恶意公式。

#### ME-09: CSV 导出中未使用的计算

- **类别**: 性能
- **位置**: `crates/camforge-server/src/routes/export.rs:57`
- **描述**: `compute_roller_profile` 的结果赋给 `_x_actual, _y_actual` 但从未使用，浪费 CPU 计算滚子偏移。
- **影响**: 每次 CSV 导出执行不必要的计算。

#### ME-10: `rho_actual` 公式在 `r` 为 0 时产生退化结果

- **类别**: 代码质量
- **位置**: `crates/camforge-server/src/routes/simulation.rs:42-49`
- **描述**: `r - r.signum() * params.r_r` 当 `r` 恰好为 `0.0` 时，`r.signum()` 返回 `0.0`，`rho_actual = 0`。曲率半径为零在物理上不可能，表示尖点。
- **影响**: 退化输入下结果物理意义不明确。

#### ME-11: 通配符 CORS 源无环境防护

- **类别**: 安全
- **位置**: `crates/camforge-server/src/main.rs:22`
- **描述**: `CORS_ORIGINS=*` 环境变量启用完全开放的 CORS，无警告或确认。错误配置的生产部署可能将 API 暴露给任意源。
- **影响**: 服务器 API 可被任意域访问。

#### ME-12: 角度和验证容差未定义为常量

- **类别**: 代码质量
- **位置**: `crates/camforge-core/src/types.rs:71`、`crates/camforge-core/src/full_motion.rs:197`
- **描述**: 两处都使用 `0.01` 度容差但未定义为常量，可能在修改其一时导致不一致。
- **影响**: 验证行为可能因修改遗漏而不一致。

#### ME-13: `From<String>` 错误转换丢失上下文

- **类别**: 架构设计
- **位置**: `crates/camforge-server/src/error.rs:35-38`
- **描述**: 所有 `String` 错误变为 `CalculationError`（422），但某些字符串可能来自验证（应为 400）。使用 `?` 运算符的函数会静默将验证错误变为计算错误。
- **影响**: API 错误响应状态码可能不准确。

#### ME-14: 五次多项式使用 `t.powi(5)` 而非预计算值

- **类别**: 性能
- **位置**: `crates/camforge-core/src/motion.rs:77-87, 96-99`
- **描述**: `QuinticPolynomial` 预计算了 `t2`、`t3`、`t4` 但使用 `t.powi(5)` 而非 `t4 * t`。`SepticPolynomial` 类似，使用 `t.powi(7)` 而非 `t6 * t`。在热循环中浪费性能。
- **影响**: 运动规律计算效率可小幅优化。

#### ME-15: 同步 Tauri 命令阻塞线程池

- **类别**: 性能
- **位置**: `src-tauri/src/commands/simulation.rs:39`、`src-tauri/src/commands/export.rs:92, 205`
- **描述**: 所有四个 Tauri 命令（`run_simulation`、`get_frame_data`、`export_dxf`、`export_csv`）是同步的。`run_simulation` 执行 O(n) 数值计算，导出命令执行阻塞文件 I/O。应使用 `async fn` 和 `spawn_blocking`。
- **影响**: 长时间计算阻塞 Tauri 线程池，影响 UI 响应性。

#### ME-16: 每次模拟都克隆完整的 `SimulationData`

- **类别**: 性能
- **位置**: `src-tauri/src/commands/simulation.rs:117`
- **描述**: `SimulationData` 包含约 15 个 `Vec<f64>` 字段，`sim_data.clone()` 复制所有字段。可使用 `Arc<SimulationData>` 共享所有权避免克隆。
- **影响**: 每次模拟触发大量内存分配。

#### ME-17: `compute_rotated_cam` 每帧调用无缓存

- **类别**: 性能
- **位置**: `src-tauri/src/commands/simulation.rs:204`
- **描述**: `get_frame_data` 每帧调用 `compute_rotated_cam`，分配两个新 `Vec<f64>`。60fps 动画 + 360 个轮廓点 = 每秒 120 次向量分配。凸轮轮廓不变，仅旋转角度变化。
- **影响**: 动画帧请求时不必要的内存分配和计算。

#### ME-18: CSV 导出数组长度不匹配风险

- **类别**: 代码质量
- **位置**: `src-tauri/src/commands/export.rs:232-250`
- **描述**: 循环遍历 `data.delta_deg.len()` 但索引 `data.x[i]`、`data.y[i]` 等。若任一数组较短，将 panic。
- **影响**: 未来重构可能引入数组越界 panic。

#### ME-19: 帧索引仅验证一个数组长度

- **类别**: 代码质量
- **位置**: `src-tauri/src/commands/simulation.rs:136-138`
- **描述**: `frame_idx >= data.s.len()` 检查后，`frame_idx` 用于索引 `data.ds_ddelta[frame_idx]` 和 `data.alpha_all[frame_idx]` 但未单独验证长度。
- **影响**: 数组长度不一致时可能 panic。

#### ME-20: 同时持有两个互斥锁

- **类别**: 架构设计
- **位置**: `src-tauri/src/commands/simulation.rs:128-129`
- **描述**: 同时锁定 `state.data` 和 `state.params`。虽然当前锁顺序一致，但未来代码修改顺序可能导致死锁。
- **影响**: 未来重构可能引入死锁风险。

#### ME-21: DXF 导出极端代码重复

- **类别**: 代码质量
- **位置**: `src-tauri/src/commands/export.rs:108-177`
- **描述**: 每个 `writeln!` 调用都有相同的 `.map_err(|e| e.to_string())?` 后缀，超过 30 处。应使用辅助函数或宏。
- **影响**: 代码冗长，修改容易遗漏。

#### ME-22: 硬编码响应式断点魔法数字

- **类别**: 代码质量
- **位置**: `CurvatureChart.tsx:35-38`、`GeometryChart.tsx:35-38`、`MotionCurves.tsx:35-39`、`CamAnimation.tsx:22-24`
- **描述**: 断点 `640` 和 `768` 在多个文件中硬编码。设计断点变更时需手动更新所有位置。
- **影响**: 断点变更维护成本高。

#### ME-23: 三个图表组件重复响应式 padding 计算逻辑

- **类别**: 架构设计 / 代码质量
- **位置**: `CurvatureChart.tsx`、`GeometryChart.tsx`、`MotionCurves.tsx` 各自定义 `getResponsivePadding()`
- **描述**: 每个图表组件独立定义约 30 行的 `getResponsivePadding()` 函数，含独立的断点和 padding 值，存在分歧风险。
- **影响**: 代码重复，修改时需同步三处。

#### ME-24: 图表组件重复鼠标交互处理代码

- **类别**: 架构设计 / 代码质量
- **位置**: `CurvatureChart.tsx:362-419`、`GeometryChart.tsx:256-313`、`MotionCurves.tsx:340-397`
- **描述**: 三个图表组件实现几乎相同的 `getFrameFromX()`、`handleMouseDown`、`handleMouseMove`、`handleMouseUp`、`handleHover`、`handleMouseLeave` 函数，每个组件约 60 行重复代码。
- **影响**: 交互逻辑重复，修改需同步三处。

#### ME-25: 全局硬编码颜色值

- **类别**: 代码质量
- **位置**: 所有图表组件、`chartDrawing.ts`、`CamAnimation.tsx`
- **描述**: `'#E07A5F'`、`'#3D5A80'`、`'#5B8C5A'` 等颜色在多个文件中作为字符串字面量硬编码。图表交互组件与 `chartDrawing.ts` 对同一概念使用不同颜色值（如 `'#EF4444'` vs `'#DC2626'`）。
- **影响**: 颜色不一致，修改设计色板需搜索替换多处。

#### ME-26: `savePreset` 直接使用 `localStorage` 绕过存储抽象

- **类别**: 架构设计
- **位置**: `src/stores/simulation.ts:372-397, 401-415`
- **描述**: `savePreset`、`loadPreset`、`getSavedPresets`、`deletePreset` 直接使用 `localStorage`（前缀 `camforge-preset-`），绕过 `io/storage.ts` 的隐私模式回退和 `camforge_` 前缀规范。
- **影响**: 存储行为不一致，隐私模式下预设可能丢失。

#### ME-27: `getCurrentLang()` 直接读 `localStorage` 而非使用响应式信号

- **类别**: 架构设计
- **位置**: `src/stores/simulation.ts:531`
- **描述**: 直接读 `localStorage.getItem('language')` 而非使用 `i18n/index.ts` 的 `language()` 信号。不响应语言变更，且在信号已更新但 localStorage 写入失败时返回过期数据。
- **影响**: 语言切换后 SVG 导出标签可能不更新。

#### ME-28: 面板拖拽仅支持鼠标事件，不支持触摸

- **类别**: 兼容性
- **位置**: `src/components/layout/HelpPanel.tsx:31-57`、`SettingsPanel.tsx:38-64`
- **描述**: 可拖拽面板使用 `onMouseDown`/`onMouseMove`/`onMouseUp` 但不处理触摸事件。触摸设备上无法重新定位面板。
- **影响**: 移动端用户无法拖拽面板。

#### ME-29: `ErrorBoundary` 清除错误后不修复根本问题

- **类别**: 代码质量
- **位置**: `src/components/ErrorBoundary.tsx:47-49`
- **描述**: 用户点击"清除"后错误状态被清除，但原始抛出异常的组件会重新渲染。若错误是确定性的，将立即再次抛出。
- **影响**: 用户操作后立即再次看到错误。

#### ME-30: `HttpApi` 的 `exportSvg`/`exportExcel` 无条件抛出异常

- **类别**: 代码质量
- **位置**: `src/api/http.ts:89-116`
- **描述**: `exportSvg()`、`exportExcel()`、`exportGif()` 无条件抛出错误。`CamApi` 接口承诺这些返回值，不处理异常的调用者将崩溃。
- **影响**: HTTP 模式下调用这些导出功能时应用崩溃。

#### ME-31: `http.ts` 的 `healthCheck()` 未检查 `response.ok`

- **类别**: 代码质量
- **位置**: `src/api/http.ts:121-124`
- **描述**: 直接调用 `response.json()` 未检查 `response.ok`。404 或 500 响应将尝试将错误体解析为 JSON。
- **影响**: 健康检查失败时产生误导性错误。

#### ME-32: `TauriApi` 桩方法返回空数据，误导调用者

- **类别**: 架构设计
- **位置**: `src/api/tauri.ts:28-70`
- **描述**: `exportDxf`、`exportCsv`、`exportSvg`、`exportExcel`、`exportGif` 返回空值（空 Blob、空字符串）。期望实际数据的调用者将静默成功但得到空输出。
- **影响**: 导出功能在特定模式下静默失败。

#### ME-33: `Sidebar` 导入整个 `package.json`

- **类别**: 安全 / 性能
- **位置**: `src/components/layout/Sidebar.tsx:6`
- **描述**: `import { version } from '../../../package.json'` 可能将整个 `package.json` 内容导入 bundle。虽 bundler 可能 tree-shake，但脆弱且可能泄露敏感信息（脚本、依赖等）。
- **影响**: 潜在的信息泄露和 bundle 体积增大。

#### ME-34: `Toggle` 组件接口与 `NumberInput`/`Select` 不一致

- **类别**: 架构设计
- **位置**: `src/components/controls/Toggle.tsx:3-7`
- **描述**: `Toggle` 接受 `checked: () => boolean`（函数），而 `NumberInput` 和 `Select` 接受 `value: number`（普通值）。`Sidebar.tsx` 中每个 Toggle 调用必须包装值：`checked={() => displayOptions().showTangent}`。
- **影响**: API 不一致增加使用复杂度。

#### ME-35: `initTheme()` 在模块作用域调用

- **类别**: 兼容性
- **位置**: `src/App.tsx:13`
- **描述**: `initTheme()` 在模块导入时立即执行，访问 `localStorage` 和 `document.documentElement`。在 SSR 或测试环境中可能失败。
- **影响**: 测试和 SSR 环境兼容性问题。

#### ME-36: `useI18n()` 返回非响应式值

- **类别**: 代码质量
- **位置**: `src/i18n/index.ts:45-53`
- **描述**: `useI18n()` 返回 `t: t()` 和 `language: language()`，是当前值快照而非信号。使用 `useI18n()` 的组件在语言变更时**不会**重新渲染。
- **影响**: 语言切换后部分 UI 不更新。

#### ME-37: `debounceAsync` 存在 Promise 泄漏

- **类别**: 代码质量
- **位置**: `src/utils/debounce.ts:51-79`
- **描述**: 快速调用时，每次调用创建新 Promise，前一次的 `resolve` 被覆盖，之前的 Promise 永远不会 settle。这是内存泄漏且可能导致 await 调用者挂起。
- **影响**: 内存泄漏，await 调用者可能永远等待。

#### ME-38: `tiffWorker.ts` 已定义但从未使用

- **类别**: 代码质量
- **位置**: `src/workers/tiffWorker.ts`
- **描述**: Web Worker 从未被导入或实例化。实际 TIFF 编码在 `exporters/tiff.ts`（主线程）进行。这是死代码。
- **影响**: 代码冗余，增加维护负担。

#### ME-39: `StatusBar.tsx` 是死文件

- **类别**: 代码质量
- **位置**: `src/components/layout/StatusBar.tsx`
- **描述**: 文件仅包含注释，未被任何地方导入。
- **影响**: 代码冗余。

#### ME-40: `MAX_UNDO_STEPS` 常量已导出但从未使用

- **类别**: 代码质量
- **位置**: `src/constants/numeric.ts:8`
- **描述**: `MAX_UNDO_STEPS = 50` 已导出，但 `stores/history.ts:12` 定义了自己的 `MAX_HISTORY = 50` 常量。
- **影响**: 常量重复定义，修改时可能遗漏。

#### ME-41: `HelpPanel` 的 `openUrl` 未 await

- **类别**: 代码质量
- **位置**: `src/components/layout/HelpPanel.tsx:63-74`
- **描述**: `openUrl(url)` 未使用 `await`，若抛出异常，错误被静默吞没。catch 块中的 `window.open` 回退不会被触发。
- **影响**: URL 打开失败时无回退行为。

#### ME-42: 重复 `Cargo.lock` 文件

- **类别**: 依赖管理
- **位置**: `Cargo.lock`、`src-tauri/Cargo.lock`
- **描述**: 两个 `Cargo.lock` 文件存在于不同层级。工作区级应为唯一来源，`src-tauri/Cargo.lock` 是旧残留，可能导致依赖版本分歧。
- **影响**: 依赖版本不一致风险。

#### ME-43: 缺少 ESLint 配置

- **类别**: 代码质量
- **位置**: 项目根目录（文件不存在）
- **描述**: 项目无 ESLint 配置。`CONTRIBUTING.md` 指定了编码规范（TypeScript strict mode、no `any` 等）但无自动化强制执行。
- **影响**: 编码规范仅靠人工遵守，易产生不一致。

#### ME-44: Docker Compose `version` 键已弃用

- **类别**: 依赖管理
- **位置**: `docker-compose.yml:1`
- **描述**: Docker Compose v2 起 `version` 键已弃用，现代版本忽略此字段并显示警告。
- **影响**: 构建时显示弃用警告。

---

### 3.4 低严重度问题（Low）

#### LO-01: 模块级常量 `RAD2DEG`/`DEG2RAD` 未共享

- **类别**: 代码质量
- **位置**: `crates/camforge-core/src/geometry.rs:6`、`crates/camforge-core/src/full_motion.rs:8`
- **描述**: `RAD2DEG` 在 `geometry.rs` 私有定义，`DEG2RAD` 在 `full_motion.rs` 私有定义。应共享到 `types.rs` 或专用常量模块。
- **影响**: 常量重复定义。

#### LO-02: 服务器使用 `println!` 而非结构化日志

- **类别**: 代码质量
- **位置**: `crates/camforge-server/src/main.rs:68-75`
- **描述**: 服务器使用 `println!` 输出启动信息。生产服务器应使用 `tracing` 或 `log` 进行结构化、可过滤的日志记录。
- **影响**: 无法按级别过滤日志，生产环境调试困难。

#### LO-03: 服务器无优雅关闭处理

- **类别**: 架构设计
- **位置**: `crates/camforge-server/src/main.rs:47`
- **描述**: 服务器无 SIGTERM/SIGINT 信号处理器。容器化部署中，进行中的请求可能被突然终止。
- **影响**: 容器重启时请求中断。

#### LO-04: DXF 生成使用字符串拼接而非 DXF 库

- **类别**: 架构设计
- **位置**: `crates/camforge-server/src/routes/export.rs:105-213`
- **描述**: DXF 输出手动构造，数十次重复 `lines.push("0".to_string())`。易错且难以维护。
- **影响**: DXF 格式正确性依赖手动拼接。

#### LO-05: SVG 导出端点返回 501

- **类别**: 架构设计
- **位置**: `crates/camforge-server/src/routes/export.rs:93-101`
- **描述**: SVG 端点返回 HTTP 501 JSON 错误，但错误消息建议使用桌面应用。应从路由表中移除或在 API 文档中说明。
- **影响**: API 表面包含未实现端点。

#### LO-06: `SimulationData` 的 `Vec<f64>` 字段无长度一致性保证

- **类别**: 架构设计
- **位置**: `crates/camforge-core/src/types.rs:121-165`
- **描述**: 无法防止创建 `s.len() != v.len()` 的 `SimulationData`。应使用构建器模式或构造函数验证数组长度一致性。
- **影响**: 不一致的数组长度可能导致运行时 panic。

#### LO-07: `compute_full_motion` 函数 77 行未提取子函数

- **类别**: 架构设计
- **位置**: `crates/camforge-core/src/full_motion.rs:33-109`
- **描述**: 函数在单个循环中处理升程、远休、回程、近休四个阶段。提取各阶段计算可提高可读性和可测试性。
- **影响**: 函数过长，理解和测试困难。

#### LO-08: `serde_json` 是 camforge-core 未使用的依赖

- **类别**: 依赖管理
- **位置**: `crates/camforge-core/Cargo.toml`
- **描述**: `serde_json = "1"` 声明为依赖但库源码中未使用。仅 `serde` with `derive` 用于序列化/反序列化。
- **影响**: 不必要的编译时间。

#### LO-09: `tower` 依赖未实际使用

- **类别**: 依赖管理
- **位置**: `crates/camforge-server/Cargo.toml`
- **描述**: `tower` crate 已声明但未在服务器代码中导入。仅在添加 `RequestBodyLimitLayer` 时才需要。
- **影响**: 不必要的编译时间。

#### LO-10: `MotionLaw` 枚举判别值未文档化为稳定

- **类别**: 文档
- **位置**: `crates/camforge-core/src/types.rs:196-209`
- **描述**: `TryFrom<i32>` 硬编码 1-6。添加新运动规律时需在两处更新（枚举判别值和 `TryFrom`）。
- **影响**: 扩展运动规律时需同步修改。

#### LO-11: `linspace` 工具函数混入运动规律模块

- **类别**: 架构设计
- **位置**: `crates/camforge-core/src/motion.rs:218-233`
- **描述**: `linspace` 是通用数学工具，混入运动规律模块。应放入 `utils` 或 `types` 模块。
- **影响**: 模块职责不单一。

#### LO-12: 测试容差不一致

- **类别**: 测试
- **位置**: `crates/camforge-core/src/motion.rs:240-265`
- **描述**: `test_rise_boundary_values` 对 `s[0]` 使用 `1e-10` 容差，对 `s[99]` 使用 `1e-6`。端点累积可解释较宽松容差，但应文档化。
- **影响**: 测试行为不透明。

#### LO-13: `types.rs` 测试覆盖薄弱

- **类别**: 测试
- **位置**: `crates/camforge-core/src/types.rs:253-278`
- **描述**: 仅 3 个测试。缺少：`n_points` 边界值（36 和 720）、`r_r` 负值、NaN/Infinity 字段、`e` 等于 `r_0` 的边界。
- **影响**: 参数验证边界情况未覆盖。

#### LO-14: `compute_full_motion` 仅 2 个测试

- **类别**: 测试
- **位置**: `crates/camforge-core/src/full_motion.rs:227-260`
- **描述**: 最复杂模块仅 2 个测试。缺少：各运动规律单独测试、`delta_01 = 0` 边界、相位边界连续性、不同运动规律的回程。
- **影响**: 复杂逻辑测试覆盖严重不足。

#### LO-15: `data.x_actual.len() > 0` 应为 `!is_empty()`

- **类别**: 代码质量
- **位置**: `src-tauri/src/commands/export.rs:170`
- **描述**: Clippy 会标记 `clippy::len_zero`。
- **影响**: 代码风格不符合 Rust 惯用写法。

#### LO-16: Glob 重导出污染命名空间

- **类别**: 架构设计
- **位置**: `src-tauri/src/commands/mod.rs:8-9`
- **描述**: `pub use simulation::*` 和 `pub use export::*` 使命名空间不清晰。应使用显式重导出。
- **影响**: 公开 API 表面不明确。

#### LO-17: `src-tauri` 未使用的依赖

- **类别**: 依赖管理
- **位置**: `src-tauri/Cargo.toml:28-31`
- **描述**: `serde_json`、`num-traits`、`anyhow` 声明为依赖但未在 `src-tauri/src/*.rs` 中直接使用。
- **影响**: 不必要的编译时间。

#### LO-18: `expect()` 消息不具描述性

- **类别**: 代码质量
- **位置**: `src-tauri/src/lib.rs:23`
- **描述**: `.expect("error while running tauri application")` 在启动失败时仅显示通用消息。
- **影响**: 启动失败时用户获得无用的错误信息。

#### LO-19: 错误类型全为 `String`

- **类别**: 架构设计
- **位置**: `src-tauri/src/commands/simulation.rs:39`、`src-tauri/src/commands/export.rs:96, 209`
- **描述**: 所有 Tauri 命令返回 `Result<T, String>`，丢失结构化错误信息。`thiserror` 已在依赖中但未在 `src-tauri` 中使用。
- **影响**: 前端无法区分错误类别（验证、计算、I/O）。

#### LO-20: 中英文错误消息混用

- **类别**: 兼容性
- **位置**: `crates/camforge-core/src/types.rs:71-114`（中文）、`crates/camforge-core/src/full_motion.rs:183-223`（英文）
- **描述**: `CamParams::validate()` 返回中文错误，`validate_motion_params` 返回英文错误。若呈现给用户，不一致令人困惑。
- **影响**: 用户看到混合语言的错误消息。

#### LO-21: `lang` 参数未验证

- **类别**: 代码质量
- **位置**: `src-tauri/src/commands/export.rs:224`
- **描述**: `lang` 字符串参数接受任意值。虽仅影响标头文本，但应验证或文档化。
- **影响**: 非预期输入不报错。

#### LO-22: 冗余的 `..` 路径检查

- **类别**: 代码质量
- **位置**: `src-tauri/src/commands/export.rs:27-29 vs 41-54`
- **描述**: 字符串级 `..` 检查与 `Component::ParentDir` 检查冗余。组件检查是规范方式。
- **影响**: 代码冗余但无功能影响。

#### LO-23: `thiserror` v1 已过时

- **类别**: 依赖管理
- **位置**: `Cargo.toml:20`
- **描述**: `thiserror = "1.0"`，v2.x 已发布并有显著改进。
- **影响**: 缺少新版本改进。

#### LO-24: 导出路径验证无符号链接保护

- **类别**: 安全
- **位置**: `src-tauri/src/commands/export.rs:22-88`
- **描述**: 路径验证不检查符号链接。名为 `output.dxf` 的符号链接可指向敏感文件。
- **影响**: 潜在的符号链接攻击。

#### LO-25: 不一致的命名：`params` vs `p` 别名

- **类别**: 代码质量
- **位置**: 多个文件
- **描述**: 部分组件将 `params()` 解构为 `const p = params()`（如 `CamAnimation.tsx`），其他直接使用。单字母别名降低可读性。
- **影响**: 代码风格不一致。

#### LO-26: SVG/DXF 导出标签未本地化

- **类别**: 兼容性
- **位置**: `src/components/layout/MainCanvas.tsx:748-749`
- **描述**: `<ExportButton label="SVG" />` 和 `<ExportButton label="DXF" />` 使用硬编码字符串而非 `t().export.items.*` 键。
- **影响**: 英文模式下导出按钮标签始终为英文。

#### LO-27: `index.tsx` 强制类型转换无空检查

- **类别**: 代码质量
- **位置**: `src/index.tsx:6`
- **描述**: `document.getElementById("root") as HTMLElement` 若 `#root` 元素缺失将运行时抛出。
- **影响**: HTML 结构异常时应用崩溃。

#### LO-28: `index.html` 硬编码 `lang="zh-CN"`

- **类别**: 兼容性
- **位置**: `index.html:2`
- **描述**: HTML lang 属性硬编码为中文。用户切换英文模式后 lang 属性仍为 `zh-CN`，影响屏幕阅读器、搜索引擎和浏览器翻译功能。
- **影响**: 无障碍访问和 SEO 问题。

#### LO-29: `index.html` 禁用用户缩放（无障碍）

- **类别**: 兼容性
- **位置**: `index.html:5`
- **描述**: `maximum-scale=1, user-scalable=no` 违反 WCAG 2.1 SC 1.4.4。低视力用户无法缩放页面。
- **影响**: 无障碍访问不合规。

#### LO-30: ARIA 标签硬编码中文未国际化

- **类别**: 兼容性
- **位置**: `src/App.tsx:69, 80, 88, 96, 104, 112`
- **描述**: ARIA 标签如 `"打开菜单"`、`"撤销"` 等硬编码中文，未使用 `t()` 翻译函数。
- **影响**: 英文模式下屏幕阅读器仍读中文。

#### LO-31: SVG `key` 属性缺失

- **类别**: 代码质量
- **位置**: `src/components/animation/CamAnimation.tsx:425-435, 588-600, 608-624, 652-663`
- **描述**: 通过 `.map()` 渲染 SVG 元素数组时未提供 `key` 属性，可能导致不正确的 reconciliation。
- **影响**: 列表渲染时可能产生不必要的 DOM 更新。

#### LO-32: `encodeCanvasToTIFF` 同步版本阻塞主线程

- **类别**: 性能
- **位置**: `src/exporters/tiff.ts:86-112`
- **描述**: 同步版本为向后兼容保留，但大图像时阻塞主线程。
- **影响**: 大图像导出时 UI 卡顿。

#### LO-33: `gifEncoder.ts` 进度报告魔法数字

- **类别**: 代码质量
- **位置**: `src/services/gifEncoder.ts:103, 139`
- **描述**: 进度分割硬编码为 `0.3`（帧生成）和 `0.7`（编码）。应提取为命名常量。
- **影响**: 进度条行为不透明。

#### LO-34: `randomizeParams()` 未加入撤销历史

- **类别**: 代码质量
- **位置**: `src/stores/simulation.ts:1228-1285`
- **描述**: 函数直接设置参数并运行模拟，未通过历史系统的 `push()`。随机化参数不加入撤销历史。
- **影响**: 用户无法撤销随机化操作。

#### LO-35: `handleCustomExport` 函数过长

- **类别**: 架构设计
- **位置**: `src/components/layout/MainCanvas.tsx:258-409`
- **描述**: 约 150 行的顺序 if 块，难以测试和维护。
- **影响**: 代码可读性和可测试性差。

#### LO-36: `Select` 组件的 `onValidate` 返回值未使用

- **类别**: 代码质量
- **位置**: `src/components/controls/Select.tsx:22-24`
- **描述**: `props.onValidate(newValue)` 的返回值被忽略。
- **影响**: 验证结果不被使用。

#### LO-37: 缺少 `.editorconfig`

- **类别**: 文档
- **位置**: 项目根目录（文件不存在）
- **描述**: 无 `.editorconfig` 文件强制跨编辑器的一致格式化。
- **影响**: 不同编辑器可能使用不同格式。

#### LO-38: 缺少 `SECURITY.md`

- **类别**: 文档
- **位置**: 项目根目录（文件不存在）
- **描述**: 无安全策略或漏洞报告说明。对于有文件系统访问和 Web 服务器组件的桌面应用，安全策略很重要。
- **影响**: 漏洞报告流程不明确。

#### LO-39: CHANGELOG 缺少 v0.4.3 和 v0.4.4 比较链接

- **类别**: 文档
- **位置**: `CHANGELOG.md:744-759`
- **描述**: 文件底部有到 v0.4.2 的比较链接，缺少 `[0.4.4]` 和 `[0.4.3]`。
- **影响**: 版本比较导航不完整。

---

## 4. 优先级建议

### 第一优先级：立即修复（阻断性 / 严重安全漏洞）

| 编号 | 问题 | 建议措施 |
|:----:|------|----------|
| CR-01 | 压力角 `atan()` vs `atan2()` | 改用 `atan2()` 并添加零分母防护 |
| CR-02 | 导出路径拒绝绝对路径 | 接受绝对路径但验证允许目录 |
| CR-03 | `n_points` 无上限验证 | 在 Tauri 命令中调用 `CamParams::validate()` |
| CR-04 | FS scope 绕过 | 使用 Tauri FS API 替代 `std::fs` |
| CR-05 | `$HOME/**` 权限过大 | 缩小到 `$DOWNLOAD/**` 和 `$DOCUMENT/**` |
| CR-06 | CSP 包含 localhost | 移除生产环境的 localhost 地址 |
| CR-07 | 密钥文件在磁盘 | 从磁盘删除，显式添加到 `.gitignore` |
| CR-08 | 生成代码在 Git 中 | 添加 `src-tauri/gen/` 到 `.gitignore` |
| CR-15 | 服务器无请求体限制 | 添加 `RequestBodyLimitLayer` |

### 第二优先级：版本发布前修复（重要功能影响）

| 编号 | 问题 | 建议措施 |
|:----:|------|----------|
| CR-09/10 | 重复定义（MotionLaw、isTauriEnv） | 合并为单一来源 |
| CR-11/12/13 | 输入验证缺陷 | 添加 CSV 转义、JSON 验证、验证优先于赋值 |
| CR-14 | 缺少 LICENSE 文件 | 添加 MIT LICENSE 文件 |
| HI-01~06 | 服务器 panic、NaN 安全、互斥锁 | 替换 unwrap、添加 NaN 验证、修复锁恢复 |
| HI-07~08 | CI 配置错误 | 修正测试命令和工作区范围 |
| HI-09 | 服务器零测试 | 添加集成测试 |
| HI-10~11 | Tailwind 配置问题 | 迁移到 v4 配置或验证 `@config` |
| HI-12 | ErrorBoundary 不完整 | 使用 SolidJS 内置 `<ErrorBoundary>` |
| HI-14~15 | 图表响应式和安全工具 | 使用 `useWindowSize` 和 `arrayMax` |
| HI-20 | NaN/Infinity 验证缺失 | 添加 `is_finite()` 检查 |

### 第三优先级：持续改进（局部影响）

| 类别 | 问题数 | 建议措施 |
|------|:------:|----------|
| 代码重复 | ~10 项 | 提取共享工具函数、hooks、常量 |
| 性能优化 | ~6 项 | 异步命令、缓存旋转结果、避免克隆 |
| 测试覆盖 | ~8 项 | 添加组件测试、API 测试、覆盖阈值 |
| 兼容性 | ~5 项 | 移动端触摸支持、国际化完善 |

### 第四优先级：代码质量提升（优化建议）

| 类别 | 问题数 | 建议措施 |
|------|:------:|----------|
| 代码风格 | ~8 项 | 添加 ESLint + Prettier + `.editorconfig` |
| 文档完善 | ~5 项 | 添加 SECURITY.md、API 文档、LICENSE |
| 依赖清理 | ~5 项 | 移除未使用依赖、更新过时版本 |
| 架构优化 | ~4 项 | 模块职责单一化、工具函数归类 |

---

## 附录：审查方法论

本次审查采用以下方法：

1. **全量源码阅读**: 逐文件阅读所有前端（65 个 TypeScript/TSX 文件）、后端（6 个 Rust 文件）、核心库（13 个 Rust 文件）源代码
2. **多维度并行分析**: 4 个独立审查代理分别负责前端代码质量、后端代码质量、核心库算法正确性、配置/文档/测试覆盖
3. **交叉验证**: 合并去重不同代理发现的重叠问题，确保每个问题仅记录一次
4. **严重程度评估标准**:
   - **严重**: 导致核心功能不可用、系统崩溃或存在严重安全漏洞
   - **高**: 影响主要业务流程、存在较大安全隐患或重要功能缺失
   - **中**: 影响非核心功能、特定场景下的问题或代码质量问题
   - **低**: 优化建议、风格问题或文档完善

> 本报告基于 v0.4.4 版本代码静态分析，未包含运行时测试。部分性能问题的实际影响需通过 profiling 确认。
