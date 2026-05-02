# CamForge v0.4.11 系统性审查报告

## 1. 审查概述

| 项目 | 内容 |
|------|------|
| **审查范围** | CamForge 项目全量源代码，包括前端（`src/` TypeScript/SolidJS，~65 源文件）、后端（`src-tauri/` Rust Tauri 命令处理器）、核心计算库（`crates/camforge-core`、`crates/camforge-server`）、配置文件（Vite、TypeScript、ESLint、Tailwind、Cargo）、CI/CD 流水线（GitHub Actions）、Docker 部署、项目文档（8 篇）、测试覆盖（13 个 TypeScript 测试文件 + 5 个 Rust 内联测试模块）及依赖管理 |
| **审查方法** | 静态代码分析 + 架构审查 + 安全扫描 + 配置审计 + 测试覆盖率评估，采用多代理并行分治策略，分别对前端代码质量、Rust 后端代码质量、测试与文档完整性、依赖管理与安全性 4 个维度进行深度审查后合并去重 |
| **审查时间** | 2026-05-01 |
| **审查环境** | Windows 11 Home China 10.0.26200, Node.js 20, Rust 2021 edition, Tauri v2 + SolidJS 1.9 + Tailwind CSS 4.2 + Axum 0.7 |
| **项目版本** | v0.4.11（package.json / Cargo.toml 当前版本），审查目标为 v0.4.11 优化方向 |

### 项目技术栈

- **前端框架**: SolidJS 1.9 + TypeScript 5.6 + Tailwind CSS 4.2
- **桌面壳**: Tauri v2 (Rust)，支持 Windows/macOS/Linux/Android/iOS
- **Web 后端**: Axum 0.7 (Rust) + Tokio，RESTful API
- **核心计算库**: Rust workspace（camforge-core / camforge-server / src-tauri）
- **构建工具**: Vite 6 + Vitest 4 + pnpm
- **部署方式**: Docker (Web 模式) + NSIS/DMG/AppImage (桌面模式)

---

## 修复进度跟踪

> 最后更新: 2026-05-02 | 修复目标版本: v0.4.11

| 严重程度 | 总数 | 已修复 | 未修复 | 完成率 |
|:--------:|:----:|:------:|:------:|:------:|
| 严重 | 3 | 3 | 0 | 100% |
| 高 | 18 | 9 | 9 | 50% |
| 中 | 35 | 20 | 15 | 57% |
| 低 | 32 | 21 | 11 | 66% |
| **合计** | **88** | **53** | **35** | **60%** |

状态标记: ✅ 已修复 | ⬜ 未修复 | ⚠️ 已验证无需修复

---

## 2. 问题统计摘要

### 按严重程度统计

| 严重程度 | 数量 | 说明 |
|:--------:|:----:|------|
| **严重** | 3 | 阻断性问题，导致核心功能无法使用、系统崩溃或存在严重安全漏洞 |
| **高** | 18 | 重要功能影响，影响主要业务流程或存在较大安全隐患 |
| **中** | 35 | 局部功能影响，仅影响非核心功能或特定场景 |
| **低** | 32 | 轻微影响或优化建议，不影响功能实现但影响代码质量或维护性 |

### 按类别统计

| 类别 | 严重 | 高 | 中 | 低 | 合计 |
|:-----|:----:|:---:|:---:|:---:|:----:|
| **代码质量** | 1 | 6 | 12 | 11 | 30 |
| **架构设计** | 0 | 5 | 6 | 5 | 16 |
| **性能** | 0 | 0 | 3 | 6 | 9 |
| **安全** | 1 | 3 | 5 | 6 | 15 |
| **兼容性** | 0 | 0 | 0 | 2 | 2 |
| **文档** | 0 | 2 | 4 | 3 | 9 |
| **依赖管理** | 0 | 1 | 3 | 2 | 6 |
| **测试** | 1 | 2 | 5 | 2 | 10 |

---

## 3. 详细问题清单

### 3.1 严重（Critical）

#### ✅ CR-01: Android 签名密钥库文件已提交至仓库

- **问题描述**: 项目根目录存在 `camforge-next.keystore`（2774 字节）二进制 Android 密钥库文件，已直接提交至代码仓库。密钥库文件包含用于签名 Android APK 的私钥。如果密钥库密码强度不足或在 CI 中以明文形式使用，任何能访问此仓库的攻击者均可冒充 CamForge 开发者签名应用程序，分发恶意 APK。CI 流水线（`release.yml` 第 162-177 行）在构建时通过 `ANDROID_KEYSTORE_BASE64` secret 解码生产密钥库是正确的做法，但仓库中的此文件可能是旧版或调试密钥库，仍构成安全隐患。`.gitignore` 中未排除 `*.keystore` 类型文件。
- **问题位置**: `camforge-next.keystore`（项目根目录）
- **严重程度**: 严重
- **问题类别**: 安全
- **影响范围**: Android 应用签名安全，潜在的供应链攻击风险

#### ✅ CR-02: 前端运动计算 NaN/Infinity 静默传播

- **问题描述**: `computeSimulationLocally` 函数在检测到计算产生非有限值（NaN 或 Infinity）时，仅输出 `console.warn` 警告（[compute.ts:282-284](src/stores/simulation/compute.ts#L282-L284)），但随后将包含无效数值的 `SimulationData` 正常返回给调用方。下游消费者（三个图表组件、SVG 生成、所有导出格式）会接收到 NaN/Infinity 值，导致画布渲染垃圾图形、导出文件内容损坏、或抛出难以调试的运行时错误（如 `ctx.arc(NaN, ...)` 等）。当前没有任何错误状态机制阻止无效数据向下游传播。
- **问题位置**: [src/stores/simulation/compute.ts:282-284](src/stores/simulation/compute.ts#L282-L284)
- **严重程度**: 严重
- **问题类别**: 代码质量
- **影响范围**: 核心仿真计算→图表渲染→导出全链路数据完整性

#### ✅ CR-03: `randomizeParams` 平底从动件重试循环存在竞态条件

- **问题描述**: 在随机化参数后为避免平底从动件产生凹面区域的重试循环中（[randomize.ts:110-120](src/stores/simulation/randomize.ts#L110-L120)），`runSimulation()` 是异步函数但调用时未使用 `await`。由于 `setSimulationData(data)` 在 [core.ts:102](src/stores/simulation/core.ts#L102) 中是异步执行的，循环中立即读取的 `simulationData()?.has_concave_region` 获取的是**上一次模拟运行的陈旧数据**。这导致重试逻辑完全失效——循环可能在首次迭代就错误退出，或执行完所有 10 次迭代才退出（每次读到的都是变更前的旧状态）。平底从动件随机化时无法正确规避凹面区域。
- **问题位置**: [src/stores/simulation/randomize.ts:110-120](src/stores/simulation/randomize.ts#L110-L120)
- **严重程度**: 严重
- **问题类别**: 代码质量、测试
- **影响范围**: 平底从动件随机化功能完全不可靠

---

### 3.2 高（High）

#### ⬜ HI-01: Tauri 命令与 Axum 路由间存在大量计算逻辑重复

- **问题描述**: `run_simulation`（[commands/simulation.rs:41-235](src-tauri/src/commands/simulation.rs#L41-L235)）和 `simulate`（[routes/simulation.rs:25-212](crates/camforge-server/src/routes/simulation.rs#L25-L212)）包含约 200 行几乎逐行相同的凸轮轮廓计算、曲率半径计算、最小曲率半径搜索及凹面检测代码。此外，[commands/export.rs:155-245](src-tauri/src/commands/export.rs#L155-L245) 和 [routes/export.rs:257-365](crates/camforge-server/src/routes/export.rs#L257-L365) 中的 DXF 生成逻辑也完全重复。任何计算逻辑的变更或 Bug 修复需要在两处同步进行，极易产生不一致。`camforge-core` 作为共享库本应封装完整的仿真计算流程，但目前每次调用仍需消费者自行组装多步骤计算管道。
- **问题位置**:
  - [src-tauri/src/commands/simulation.rs:41-235](src-tauri/src/commands/simulation.rs#L41-L235)
  - [crates/camforge-server/src/routes/simulation.rs:25-212](crates/camforge-server/src/routes/simulation.rs#L25-L212)
  - [src-tauri/src/commands/export.rs:155-245](src-tauri/src/commands/export.rs#L155-L245)
  - [crates/camforge-server/src/routes/export.rs:257-365](crates/camforge-server/src/routes/export.rs#L257-L365)
- **严重程度**: 高
- **问题类别**: 架构设计
- **影响范围**: 双模式（桌面+Web）代码一致性维护成本极高

#### ⬜ HI-02: 三个图表组件各自实现完全独立但逻辑相同的交互处理代码

- **问题描述**: `MotionCurves.tsx`（[341-397](src/components/charts/MotionCurves.tsx#L341-L397)）、`GeometryChart.tsx`（[257-313](src/components/charts/GeometryChart.tsx#L257-L313)）、`CurvatureChart.tsx`（[363-419](src/components/charts/CurvatureChart.tsx#L363-L419)）三个图表组件中各自独立实现了鼠标悬停提示框渲染（~200 行重复）、`getFrameFromX` 坐标转换、`handleMouseDown/Move/Up` 事件处理等完全相同的逻辑。项目中已存在共享 Hook `useChartInteraction.ts`（149 行）和 `useChartPadding.ts`（71 行）专门为此设计，但三个图表组件均未导入这些 Hook。此外，7 个图表相关文件各自独立绘制了相同的网格线/相位边界/背景/标题样板代码（~350 行重复）。
- **问题位置**:
  - [src/components/charts/MotionCurves.tsx:271-397](src/components/charts/MotionCurves.tsx#L271-L397)
  - [src/components/charts/GeometryChart.tsx:195-313](src/components/charts/GeometryChart.tsx#L195-L313)
  - [src/components/charts/CurvatureChart.tsx:286-419](src/components/charts/CurvatureChart.tsx#L286-L419)
  - [src/utils/chartDrawing/motionCurves.ts:53-88](src/utils/chartDrawing/motionCurves.ts#L53-L88)
  - [src/utils/chartDrawing/curvature.ts:53-88](src/utils/chartDrawing/curvature.ts#L53-L88)
  - [src/utils/chartDrawing/pressureAngle.ts:53-88](src/utils/chartDrawing/pressureAngle.ts#L53-L88)
  - [src/hooks/useChartInteraction.ts](src/hooks/useChartInteraction.ts) (未被引用)
  - [src/hooks/useChartPadding.ts](src/hooks/useChartPadding.ts) (未被引用)
- **严重程度**: 高
- **问题类别**: 代码质量、架构设计
- **影响范围**: 每次修改交互行为需要同时修改 3-7 个文件

#### ✅ HI-03: `chartColors.ts` 颜色常量完整定义但从未被图表绘制函数使用

- **问题描述**: [chartColors.ts](src/constants/chartColors.ts) 定义了 37 个颜色常量，组织为 6 个语义色彩对象（`MOTION_COLORS`、`PRESSURE_ANGLE_COLORS`、`CURVATURE_COLORS`、`CAM_PROFILE_COLORS`、`ANIMATION_COLORS`、`CHART_COLORS`）。然而，所有图表绘制工具函数和组件中均直接硬编码了十六进制颜色字符串（如 `motionCurves.ts` 使用 `'#DC2626'`、`'#2563EB'` 而应使用 `MOTION_COLORS`；`curvature.ts` 使用 `'#DC2626'` 而非 `CURVATURE_COLORS.theoryRho`）。这不仅使颜色常量文件成为死代码，也使得全局颜色方案调整需要逐个修改散落在 8 个文件中的硬编码值。
- **问题位置**:
  - [src/constants/chartColors.ts](src/constants/chartColors.ts) (完整定义但未被引用)
  - [src/utils/chartDrawing/motionCurves.ts](src/utils/chartDrawing/motionCurves.ts) (硬编码颜色)
  - [src/utils/chartDrawing/curvature.ts](src/utils/chartDrawing/curvature.ts) (硬编码颜色)
  - [src/utils/chartDrawing/pressureAngle.ts](src/utils/chartDrawing/pressureAngle.ts) (硬编码颜色)
  - [src/utils/chartDrawing/camProfile.ts](src/utils/chartDrawing/camProfile.ts) (硬编码颜色)
- **严重程度**: 高
- **问题类别**: 代码质量
- **影响范围**: 全局配色方案维护困难，设计不一致风险

#### ✅ HI-04: `io/storage.ts` 模块完全未被任何源文件导入

- **问题描述**: [io/storage.ts](src/io/storage.ts) 是一个 147 行的存储抽象层实现，提供了 `StorageAdapter` 接口、`LocalStorageAdapter`（含 JSON 序列化/反序列化）和 `MemoryStorageAdapter`（localStorage 不可用时的内存回退）。然而，项目中无任何源文件导入该模块。所有需要存储功能的模块（`settings.ts`、`presets.ts`、`i18n/index.ts`）均直接操作 `localStorage` 全局对象，这相当于存在一个完整的抽象层但完全未被使用。
- **问题位置**: [src/io/storage.ts](src/io/storage.ts)
- **严重程度**: 高
- **问题类别**: 代码质量、架构设计
- **影响范围**: 147 行死代码，同时各模块绕过统一存储接口，增加了存储逻辑不一致的风险

#### ⬜ HI-05: `MainCanvas.tsx` 严重单文件巨型组件（983 行）

- **问题描述**: [MainCanvas.tsx](src/components/layout/MainCanvas.tsx) 包含仿真/导出双标签页逻辑、导出按钮组件、图例渲染、自定义导出 UI（200+ 行表单状态管理）、动画帧数据计算、状态显示等多个职责域。单文件 983 行的体量使其极难维护，自定义导出表单和导出逻辑可单独提取为独立组件。
- **问题位置**: [src/components/layout/MainCanvas.tsx](src/components/layout/MainCanvas.tsx)
- **严重程度**: 高
- **问题类别**: 代码质量
- **影响范围**: 导出功能维护困难，代码理解成本高

#### ⬜ HI-06: `CamAnimation.tsx` 严重单文件巨型组件（877 行）

- **问题描述**: [CamAnimation.tsx](src/components/animation/CamAnimation.tsx) 同时包含 SVG 渲染、动画帧循环、触摸/捏合手势处理、键盘事件绑定、缩放/平移状态、5 种不同从动件类型的渲染逻辑及播放控制条。建议拆分为独立模块：`followerRenderer.ts`、`animationLoop.ts`、`touchHandlers.ts` 各自负责单一职责。
- **问题位置**: [src/components/animation/CamAnimation.tsx](src/components/animation/CamAnimation.tsx)
- **严重程度**: 高
- **问题类别**: 代码质量
- **影响范围**: 核心动画组件几乎无法进行增量修改或单元测试

#### ✅ HI-07: `GeometryChart` 组件命名与功能不匹配

- **问题描述**: 组件文件命名为 `GeometryChart.tsx`，在 `MainCanvas.tsx` 中也以 `GeometryChart` 导入，但图表标题显示"压力角曲线 / Pressure Angle Curve"。该组件实际渲染的是压力角图表而非凸轮几何图。命名误导性严重影响代码导航和理解。
- **问题位置**:
  - [src/components/charts/GeometryChart.tsx:1](src/components/charts/GeometryChart.tsx#L1) (组件定义)
  - [src/components/charts/GeometryChart.tsx:54](src/components/charts/GeometryChart.tsx#L54) (标题"压力角曲线")
  - [src/components/layout/MainCanvas.tsx:6](src/components/layout/MainCanvas.tsx#L6) (导入引用)
- **严重程度**: 高
- **问题类别**: 代码质量
- **影响范围**: 代码导航混淆，新开发者需要额外时间理解组件映射

#### ✅ HI-08: Axum 安全中间件对每个响应完整缓冲 1MB 请求体

- **问题描述**: CSP nonce 替换中间件（[main.rs:143-150](crates/camforge-server/src/main.rs#L143-L150)）对每个 HTTP 响应执行 `axum::body::to_bytes(body, 1024 * 1024).await`，将整个响应体读入内存以替换 `__CSP_NONCE__` 占位符。此操作对所有响应执行——包括不包含 HTML 的 JSON API 响应和二进制导出数据——因为内容类型检查在缓冲之后才执行。对于主要返回 JSON/二进制的 API 服务器而言，这是不必要的性能开销。
- **问题位置**: [crates/camforge-server/src/main.rs:143-150](crates/camforge-server/src/main.rs#L143-L150)
- **严重程度**: 高
- **问题类别**: 性能、架构设计
- **影响范围**: 每个 API 响应均增加不必要的内存分配和延迟
- **v0.4.10 修复**: Content-Type 检查已移至缓冲之前，仅对 `text/html` 响应执行 nonce 替换和缓冲

#### ⬜ HI-09: Axum API 服务器完全无身份验证机制

- **问题描述**: Web 服务器模式下的所有端点（`/api/simulate`、`/api/export/*`）均无需任何身份验证即可访问。虽然后端配置了 CORS 和 CSP（提供浏览器层面的基础保护），但任何能路由到服务器的非浏览器客户端（同一网络上的对等节点、SSRF 攻击源）均可无限制调用所有计算密集型 API。
- **问题位置**: [crates/camforge-server/src/main.rs:100-140](crates/camforge-server/src/main.rs#L100-L140) (路由注册无认证中间件)
- **严重程度**: 高
- **问题类别**: 安全
- **影响范围**: Web 部署模式下所有 API 端点无保护暴露

#### ✅ HI-10: 速率限制参数被解析但从未实施

- **问题描述**: [main.rs:175-179](crates/camforge-server/src/main.rs#L175-L179) 读取环境变量 `RATE_LIMIT`，打印 `"Rate limit: 60 requests/minute per IP"` 日志，但该值从未传递给任何 Tower 速率限制中间件。服务器实际上**完全无速率限制保护**。攻击者可对 `/api/simulate` 等计算密集型端点发起洪水攻击。误导性的日志输出会让运维人员以为防护已生效。
- **问题位置**: [crates/camforge-server/src/main.rs:175-179](crates/camforge-server/src/main.rs#L175-L179)
- **严重程度**: 高
- **问题类别**: 安全、性能
- **影响范围**: Web 服务可被恶意请求洪泛导致拒绝服务

#### ✅ HI-11: Tauri CSV 导出缺少 `rho_actual` 列且无公式注入防护

- **问题描述**: 服务器端 CSV 导出（[routes/export.rs:367-438](crates/camforge-server/src/routes/export.rs#L367-L438)）在滚子半径 > 0 时包含 `rho_actual`（实际轮廓曲率半径）列，并且使用 `csv_escape` 对单元格进行公式注入防护（转义以 `=`、`+`、`-`、`@` 开头的值）。但 Tauri 桌面端 CSV 导出（[commands/export.rs:269-312](src-tauri/src/commands/export.rs#L269-L312)）完全省略了 `rho_actual` 列，也没有任何 CSV 转义处理。这导致桌面用户获得不完整的数据集且面临 Excel 公式注入风险。
- **问题位置**:
  - [src-tauri/src/commands/export.rs:269-312](src-tauri/src/commands/export.rs#L269-L312)
  - [crates/camforge-server/src/routes/export.rs:367-438](crates/camforge-server/src/routes/export.rs#L367-L438)
- **严重程度**: 高
- **问题类别**: 安全、兼容性
- **影响范围**: 桌面端导出数据不完整且存在安全风险

#### ✅ HI-12: 项目同时存在 `package-lock.json` 和 `pnpm-lock.yaml` 两个锁文件

- **问题描述**: 项目根目录同时存在 npm 的 `package-lock.json`（最后修改 4月28日）和 pnpm 的 `pnpm-lock.yaml`（最后修改 4月30日）。`README.md` 推荐使用 pnpm，但若有人无意中执行 `npm install`，两个锁文件将产生不同的依赖树，导致难以排查的环境不一致问题。
- **问题位置**: `package-lock.json`、`pnpm-lock.yaml`（项目根目录）
- **严重程度**: 高
- **问题类别**: 依赖管理
- **影响范围**: 多人协作时依赖版本不一致，导致"在我机器上能跑"问题

#### ✅ HI-13: Tauri 命令锁序契约无文档记录，存在潜在死锁风险

- **问题描述**: `get_frame_data`（[commands/simulation.rs:246-254](src-tauri/src/commands/simulation.rs#L246-L254)）和 `run_simulation`（[commands/simulation.rs:225-232](src-tauri/src/commands/simulation.rs#L225-L232)）均按 `data`→`params` 的顺序获取 `Mutex` 锁，当前不存在死锁。但如果未来的开发者在新增函数中以相反顺序（`params`→`data`）获取锁，将产生经典死锁条件。关键的锁获取顺序契约没有被任何注释、文档或基于作用域的 Drop 守卫记录下来。
- **问题位置**: [src-tauri/src/commands/simulation.rs:225-254](src-tauri/src/commands/simulation.rs#L225-L254)
- **严重程度**: 高
- **问题类别**: 架构设计
- **影响范围**: 后续代码变更可能引入运行时死锁

#### ⬜ HI-14: SECURITY.md 安全声明与代码实际状态不符

- **问题描述**: `SECURITY.md` 中声称的安全措施——"Input validation: All simulation parameters are validated for NaN/Infinity"、"CSV escaping: Export data is sanitized to prevent formula injection"、"Request limiting: API rate limiting is enforced"——这些是 v0.4.5 安全修复后的**期望状态**而非当前代码的真实状态。如上文 HI-10 所示，速率限制并未实施；HI-11 显示只有服务器端 CSV 有转义。文档与实际的不一致可能导致错误的信任假设。
- **问题位置**: [SECURITY.md](SECURITY.md)
- **严重程度**: 高
- **问题类别**: 文档、安全
- **影响范围**: 安全审计和合规性评估可能基于错误信息

#### ⬜ HI-15: 缺少 OpenAPI/Swagger API 规范文档

- **问题描述**: 尽管 `docs/ARCHITECTURE.md` 列出了端点列表，`docs/DEPLOYMENT.md` 包含 curl 示例，但项目完全没有 OpenAPI/Swagger 规范、自动生成式 API 文档或正式的 API 参考文档。所有 API 文档仅以 Rust 内联 doc 注释的形式存在。`REFACTORING_PLAN.md` Phase 3 步骤 3.8 "Add API documentation comments" 标记为未完成。
- **问题位置**: 项目整体
- **严重程度**: 高
- **问题类别**: 文档
- **影响范围**: API 消费者（包括前端团队和第三方集成者）缺乏结构化参考

#### ⬜ HI-16: 前端 TypeScript JSDoc 覆盖率仅约 17%

- **问题描述**: 在约 65 个前端源文件中，仅有 6 个文件包含 JSDoc `/** */` 注释（`types/index.ts`、`useChartInteraction.ts`、`useChartPadding.ts`、`gifEncoder.ts`、`history.ts`、`csv.ts`）。其余 ~59 个文件——包括所有图表组件、动画组件、UI 控件、API 适配层、状态管理模块——均缺乏 JSDoc 文档。`CONTRIBUTING.md` 虽然规定了 JSDoc 格式标准，但未被遵守。
- **问题位置**: `src/` 目录中 59 个文件缺少 JSDoc
- **严重程度**: 高
- **问题类别**: 文档
- **影响范围**: 新开发者上手困难，IDE 智能提示信息缺失

#### ✅ HI-17: Tauri 桌面模式下 CSP 允许加载 Google Fonts CDN 外部资源

- **问题描述**: [tauri.conf.json:27](src-tauri/tauri.conf.json#L27) 的 CSP 策略中 `style-src`、`font-src`、`connect-src` 均允许 `https://fonts.googleapis.com` 和 `https://fonts.gstatic.com`。对于桌面应用程序（Tauri 模式），没有理由从外部 CDN 加载字体——字体应当本地打包或随应用分发。允许外部字体 CDN 连接增加了不必要的网络依赖和潜在的内容篡改风险。
- **问题位置**: [src-tauri/tauri.conf.json:27](src-tauri/tauri.conf.json#L27)
- **严重程度**: 高
- **问题类别**: 安全、架构设计
- **影响范围**: 桌面应用在离线环境下字体加载失败，外部 CDN 依赖增加攻击面
- **v0.4.10 修复**: 字体已完全本地化（`public/fonts/`），CSP 中 Google Fonts 域名已移除

#### ⬜ HI-18: Tauri 桌面端命令零测试覆盖

- **问题描述**: `src-tauri/src/commands/` 下的 `run_simulation`、`get_frame_data`、`export_dxf`、`export_csv` 四个核心 IPC 命令完全没有任何单元测试。这是桌面应用的主要入口点，数据验证和业务逻辑的关键路径。`camforge-core` 库的测试仅覆盖底层数学模型，不覆盖命令处理器中的 IPC 参数解析、状态管理、锁行为和导出路径验证。
- **问题位置**: [src-tauri/src/commands/](src-tauri/src/commands/)（整个目录零测试）
- **严重程度**: 高
- **问题类别**: 测试
- **影响范围**: 桌面应用核心命令路径回归风险极高

---

### 3.3 中（Medium）

#### ⬜ ME-01: `TitleBar.tsx`、`SettingsPanel.tsx` 等布局组件零测试

- **问题描述**: 自定义标题栏组件（含窗口控制按钮：最小化/最大化/关闭）、设置面板（含拖拽调整宽度）、帮助面板、侧边栏、状态栏等关键布局组件均无任何测试覆盖。
- **问题位置**: [src/components/layout/TitleBar.tsx](src/components/layout/TitleBar.tsx)、[SettingsPanel.tsx](src/components/layout/SettingsPanel.tsx)、[HelpPanel.tsx](src/components/layout/HelpPanel.tsx)、[Sidebar.tsx](src/components/layout/Sidebar.tsx)
- **严重程度**: 中
- **问题类别**: 测试

#### ⬜ ME-02: 图表组件零 Canvas 渲染测试

- **问题描述**: `MotionCurves.tsx`、`CurvatureChart.tsx`、`GeometryChart.tsx` 三个 Canvas 图表组件完全无测试覆盖。`chartDrawing.test.ts` 仅测试了 `validateChartData` 和 `normalizeChartOptions` 两个入口参数校验函数，而核心绘制函数（`drawMotionCurves`、`drawCamProfile`、`drawCurvatureRadius`、`drawPressureAngle`、`drawAnimationFrame`、`exportToCanvas`）均未测试。Canvas 2D 上下文的 mock 机制在 Vitest + jsdom 中可用但未被利用。
- **问题位置**:
  - [src/components/charts/](src/components/charts/) (零组件测试)
  - [src/utils/__tests__/chartDrawing.test.ts](src/utils/__tests__/chartDrawing.test.ts) (仅有 2 个测试)
- **严重程度**: 中
- **问题类别**: 测试

#### ⬜ ME-03: 动画组件零测试覆盖

- **问题描述**: `CamAnimation.tsx`（877 行）包含复杂的 SVG 渲染、requestAnimationFrame 循环、触摸手势和键盘事件处理，但完全无测试覆盖。动画状态机（播放/暂停/帧步进）的正确性无法通过自动化验证。
- **问题位置**: [src/components/animation/CamAnimation.tsx](src/components/animation/CamAnimation.tsx)
- **严重程度**: 中
- **问题类别**: 测试

#### ⬜ ME-04: 缺少端到端（E2E）测试框架

- **问题描述**: 项目中无 Playwright、Cypress 或任何 E2E 测试配置。整个应用的关键用户流程（参数修改→仿真计算→结果可视化→导出）无法自动化验证。`TODO.md` Phase 5 "E2E Tests & Final Polish" 所有 5 项任务完成度为 0%。
- **问题位置**: 项目整体
- **严重程度**: 中
- **问题类别**: 测试

#### ⬜ ME-05: API 适配器层无测试

- **问题描述**: [src/api/tauri.ts](src/api/tauri.ts) 和 [src/api/http.ts](src/api/http.ts) 是前端自适应切换 Tauri IPC / HTTP REST 两种模式的关键适配层，但均无测试。自动检测逻辑、请求参数序列化、错误处理路径均未被验证。
- **问题位置**: [src/api/tauri.ts](src/api/tauri.ts)、[src/api/http.ts](src/api/http.ts)、[src/api/index.ts](src/api/index.ts)
- **严重程度**: 中
- **问题类别**: 测试

#### ⬜ ME-06: `Sidebar.tsx` 单文件过长（630 行），含 5 个可折叠面板

- **问题描述**: 侧边栏管理 5 个可折叠面板（运动规律、几何参数、仿真设置、显示选项、预设管理），每个面板含表单控件和验证逻辑。所有面板逻辑耦合在一个文件中，降低了可维护性和可复用性。
- **问题位置**: [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ⬜ ME-07: `exports.ts`（stores）单文件过长（699 行）

- **问题描述**: 该文件同时包含 SVG 生成（~400 行模板字符串 XML）、PNG/TIFF/GIF/Excel 多格式导出编排，以及 Tauri 和浏览器两种环境下的文件保存逻辑。职责过多，各导出格式处理逻辑可提取到 `exporters/` 目录下各自独立的模块中。
- **问题位置**: [src/stores/simulation/exports.ts](src/stores/simulation/exports.ts)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ✅ ME-08: `computeMotion` 默认分支静默回退到简谐运动

- **问题描述**: [motion.ts:96-103](src/services/motion.ts#L96-L103) 中 `switch` 语句的 `default` 分支在收到无效运动规律值时静默回退到简谐运动，不抛出警告或错误通知用户其选择无效。这会隐藏配置错误并产生意外的仿真结果。
- **问题位置**: [src/services/motion.ts:96-103](src/services/motion.ts#L96-L103)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ✅ ME-09: TIFF 编码失败静默回退为 PNG

- **问题描述**: [tiff.ts:72-81](src/exporters/tiff.ts#L72-L81) 中 `catch` 块在 TIFF 编码失败时静默生成 PNG 格式的 Blob（但文件扩展名仍为 `.tiff`）。用户期望获得 TIFF 文件却接收到错误编码的 PNG 数据，UI 无任何错误提示，仅控制台输出错误日志。
- **问题位置**: [src/exporters/tiff.ts:72-81](src/exporters/tiff.ts#L72-L81)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ✅ ME-10: `loadPresetFromJSON` 将原始异常信息暴露给用户

- **问题描述**: [presets.ts:154](src/stores/simulation/presets.ts#L154) 的 catch 子句将原始异常对象直接拼接入错误消息（`"JSON 解析失败: ${e}"`），异常信息可能包含调用栈等内部细节，通过 UI 暴露给最终用户。
- **问题位置**: [src/stores/simulation/presets.ts:154](src/stores/simulation/presets.ts#L154)
- **严重程度**: 中
- **问题类别**: 代码质量、安全

#### ✅ ME-11: `(window as any)` 类型绕过

- **问题描述**: [platform.ts:18](src/utils/platform.ts#L18) 使用 `(window as any).__TAURI_INTERNALS__` 访问 Tauri 内部对象。应使用 `@tauri-apps/api` 提供的适当类型接口或自定义接口声明。
- **问题位置**: [src/utils/platform.ts:18](src/utils/platform.ts#L18)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ✅ ME-12: `value as never` 类型强制转换绕过类型系统

- **问题描述**: [Sidebar.tsx:72-73](src/components/layout/Sidebar.tsx#L72-L73) 在 `Object.entries` 遍历默认参数时使用 `value as never` 完全绕过 TypeScript 类型检查，任何类型的值都可以被传递给 `updateParam`。
- **问题位置**: [src/components/layout/Sidebar.tsx:72-73](src/components/layout/Sidebar.tsx#L72-L73)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ✅ ME-13: `compute.ts` 中 epsilon 值不一致

- **问题描述**: [constants/numeric.ts](src/constants/numeric.ts) 定义 `EPSILON = 1e-10`。但 [compute.ts](src/stores/simulation/compute.ts) 中多处使用了不同的精度阈值：第 134 行 `1e-12`、第 236 行 `1e-12`（与第 180 行、第 202 行的 `1e-10` 不一致）。在关键数值计算中使用不一致的 epsilon 可能导致浮点比较行为不一致。
- **问题位置**:
  - [src/stores/simulation/compute.ts:134](src/stores/simulation/compute.ts#L134) (`1e-12`)
  - [src/stores/simulation/compute.ts:236](src/stores/simulation/compute.ts#L236) (`1e-12`)
  - [src/stores/simulation/compute.ts:180](src/stores/simulation/compute.ts#L180) (`1e-10`)
  - [src/stores/simulation/compute.ts:202](src/stores/simulation/compute.ts#L202) (`1e-10`)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ⬜ ME-14: 前端与 Rust 后端运动规律实现存在版本同步风险

- **问题描述**: [compute.ts:1](src/stores/simulation/compute.ts#L1) 注释说明该文件为 `camforge-core::compute_full_motion` 的前端镜像实现，但注释仅使用 `//` 行注释而未使用更显眼的 `TODO` 或引用具体 Rust 文件路径。如果 Rust 后端公式更新而前端不同步，两套计算将产生分歧，而当前无自动化的跨语言测试来检测这种不一致。
- **问题位置**: [src/stores/simulation/compute.ts:1](src/stores/simulation/compute.ts#L1)
- **严重程度**: 中
- **问题类别**: 代码质量、架构设计

#### ✅ ME-15: 声明但未使用的 Rust 依赖 `anyhow`

- **问题描述**: `anyhow` 在 workspace `Cargo.toml` 中声明并在 `camforge-server/Cargo.toml` 中引用（`anyhow.workspace = true`），但 `camforge-server` 的任何源代码中均未使用该 crate。所有错误处理均通过自定义 `ApiError` 枚举和 `String` 类型完成。
- **问题位置**:
  - [Cargo.toml:20](Cargo.toml#L20)
  - [crates/camforge-server/Cargo.toml:17](crates/camforge-server/Cargo.toml#L17)
- **严重程度**: 中
- **问题类别**: 依赖管理

#### ✅ ME-16: 声明但未使用的 Rust 依赖 `thiserror`

- **问题描述**: `thiserror` 在 workspace `Cargo.toml` 和 `camforge-core/Cargo.toml` 中声明，但在任何 Rust 源文件中均无 `use thiserror` 导入。核心 crate 使用 `String` 作为错误类型（`Result<T, String>`），服务器使用自定义错误枚举。该依赖完全未被使用。
- **问题位置**:
  - [Cargo.toml:19](Cargo.toml#L19)
  - [crates/camforge-core/Cargo.toml:18](crates/camforge-core/Cargo.toml#L18)
- **严重程度**: 中
- **问题类别**: 依赖管理

#### ✅ ME-17: 声明但未被使用的 Rust 依赖 `num-traits`

- **问题描述**: `num-traits` 在 `camforge-core/Cargo.toml` 中声明，但核心 crate 的任何源文件中均无 `use num_traits` 或 `num_traits::` 调用。该依赖对二进制文件大小有微小贡献但无任何功能作用。
- **问题位置**: [crates/camforge-core/Cargo.toml:15](crates/camforge-core/Cargo.toml#L15)
- **严重程度**: 中
- **问题类别**: 依赖管理

#### ⬜ ME-18: 前端 `@types/react` 和 `@types/react-dom` 对 SolidJS 项目不必要

- **问题描述**: `package.json` devDependencies 中包含 `@types/react`（^19.2.14）、`@types/react-dom`（^19.2.3）、`react`（^19.2.5）、`react-dom`（^19.2.5）。项目主力是 SolidJS 框架，React 仅由 Remotion（启动画面）使用。且 `tsconfig.json` 显式排除了 `src/splash` 目录，因此这些 React 类型包对主项目的类型检查也无实际作用。
- **问题位置**: [package.json:48-53](package.json#L48-L53)
- **严重程度**: 中
- **问题类别**: 依赖管理

#### ✅ ME-19: Dockerfile 用 `sed` 原地修改 `Cargo.toml` 是脆弱方案

- **问题描述**: [Dockerfile:20](Dockerfile#L20) 使用 `sed '/src-tauri/d' Cargo.toml > Cargo.toml.tmp && mv Cargo.toml.tmp Cargo.toml` 排除 Tauri 工作区成员。如果工作区结构或 `src-tauri` 命名在未来变更，sed 模式可能静默失效导致构建错误。应使用 `cargo` 的原生标志或独立于主工作区的 Cargo.toml。
- **问题位置**: [Dockerfile:20](Dockerfile#L20)
- **严重程度**: 中
- **问题类别**: 架构设计、兼容性

#### ✅ ME-20: 缺少 `.dockerignore` 文件

- **问题描述**: 项目根目录无 `.dockerignore` 文件，Docker 构建上下文将包含 `node_modules/`、`target/`、`camforge-next.keystore` 及其他大文件/二进制文件，不仅拖慢构建速度还可能将敏感数据（如密钥库文件）泄露到 Docker 构建缓存中。
- **问题位置**: 项目根目录
- **严重程度**: 中
- **问题类别**: 安全、性能

#### ✅ ME-21: Docker 运行时容器以 root 用户运行

- **问题描述**: [Dockerfile](Dockerfile) 的运行阶段基于 `alpine:3.19` 且无 `USER` 指令，容器以 root 权限运行。最佳实践要求容器以非 root 用户运行以限制潜在漏洞的影响范围。
- **问题位置**: [Dockerfile:70](Dockerfile#L70)
- **严重程度**: 中
- **问题类别**: 安全

#### ✅ ME-22: CI 签名失败回退上传未签名 APK

- **问题描述**: [release.yml:190-199](.github/workflows/release.yml#L190-L199) 当 `ANDROID_KEYSTORE_BASE64` 环境变量未设置时，构建流程回退为直接上传未签名的 APK。未签名 APK 无法在绝大多数 Android 设备上安装，且可能引发完整性信任问题。
- **问题位置**: [.github/workflows/release.yml:190-199](.github/workflows/release.yml#L190-L199)
- **严重程度**: 中
- **问题类别**: 安全、兼容性

#### ✅ ME-23: 服务器缺少 `Strict-Transport-Security`（HSTS）响应头

- **问题描述**: 服务器安全中间件（[main.rs:100-120](crates/camforge-server/src/main.rs#L100-L120)）实现了 CSP、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy` 等优质安全头，但缺少 `Strict-Transport-Security` 头。对于 `camforge.top` 生产 Web 部署，应强制 HTTPS。
- **问题位置**: [crates/camforge-server/src/main.rs:100-120](crates/camforge-server/src/main.rs#L100-L120)
- **严重程度**: 中
- **问题类别**: 安全

#### ⬜ ME-24: Rust 代码中文注释占比过高，国际化协作存在障碍

- **问题描述**: 所有 Rust 模块文档（`//!` 注释）及大多数函数内注释使用中文。对于本地中文团队适合，但如果项目发展为国际化团队或接受外部贡献，中文注释会造成理解障碍。同时 TypeScript 文件中中英文注释混用也不一致（`compute.ts` 使用中文注释，`history.ts` 使用英文注释）。
- **问题位置**: `crates/` 和 `src/` 中超过 30 处中文注释
- **严重程度**: 中
- **问题类别**: 代码质量

#### ⬜ ME-25: `compute_oscillating_profile` 返回元组而非结构体

- **问题描述**: [profile.rs:237](crates/camforge-core/src/profile.rs#L237) `compute_oscillating_profile` 返回 `Result<(Vec<f64>, Vec<f64>), String>`，而类似函数 `compute_cam_profile` 返回 `Result<ProfileResult, String>` 结构体。`compute_flat_faced_profile`（[profile.rs:163-171](crates/camforge-core/src/profile.rs#L163-L171)）更返回 5 元组（`Result<(Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>, f64), String>`），调用方必须按位置解构，易出错。
- **问题位置**:
  - [crates/camforge-core/src/profile.rs:237](crates/camforge-core/src/profile.rs#L237)
  - [crates/camforge-core/src/profile.rs:163-171](crates/camforge-core/src/profile.rs#L163-L171)
- **严重程度**: 中
- **问题类别**: 架构设计

#### ✅ ME-26: `full_motion.rs` 中的 `validate_motion_params` 包装函数是多余的间接层

- **问题描述**: [full_motion.rs:114-116](crates/camforge-core/src/full_motion.rs#L114-L116) 中定义的 `validate_motion_params` 函数体仅为 `params.validate()` 的直接委托，添加了一个函数调用层但无任何附加值。该包装仅在一处被调用（第 37 行）。
- **问题位置**: [crates/camforge-core/src/full_motion.rs:114-116](crates/camforge-core/src/full_motion.rs#L114-L116)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ✅ ME-27: `#[allow(dead_code)]` 在 `csv_escape` 上不正确

- **问题描述**: [routes/export.rs:441](crates/camforge-server/src/routes/export.rs#L441) `csv_escape` 函数标注了 `#[allow(dead_code)]`，但该函数实际被同文件中的 `generate_csv_content` 调用（第 414+ 行）。该属性要么已过时/不正确，要么暗示在某些编译条件下该函数不可达。
- **问题位置**: [crates/camforge-server/src/routes/export.rs:441](crates/camforge-server/src/routes/export.rs#L441)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ⬜ ME-28: `get_frame_data` 在持有锁期间执行计算密集型操作

- **问题描述**: [commands/simulation.rs:246-361](src-tauri/src/commands/simulation.rs#L246-L361) 中 `get_frame_data` 在持有 `data` 和 `params` 两个 Mutex 锁的整个期间内执行凸轮轮廓旋转等非平凡计算，锁持有时间较长。应考虑先克隆必要数据再释放锁进行计算。
- **问题位置**: [src-tauri/src/commands/simulation.rs:246-361](src-tauri/src/commands/simulation.rs#L246-L361)
- **严重程度**: 中
- **问题类别**: 性能

#### ✅ ME-29: `CamParams::validate()` 角度容差可能过严

- **问题描述**: [types.rs:224-226](crates/camforge-core/src/types.rs#L224-L226) 角度和校验的容差设为 `0.01` 度（`(sum - 360.0).abs() > 0.01`）。当用户通过 UI 输入不精确的角度值（如含舍入误差的滑块值）时，此严格容差可能导致不必要的校验失败。0.01 度的工程精度容差值得商榷但应文档化说明。
- **问题位置**: [crates/camforge-core/src/types.rs:224-226](crates/camforge-core/src/types.rs#L224-L226)
- **严重程度**: 中
- **问题类别**: 代码质量

#### ⬜ ME-30: `docs/WEB_OPTIMIZATION.md` 内容严重不完整

- **问题描述**: 该文档仅包含约 3 段关于 Logo 压缩的文字（约 660 字节），标题为"Web 部署优化说明"但完全未涉及：bundle 大小分析、代码分割策略、懒加载方案、CDN 配置、缓存头设置、预加载/预获取策略或性能预算设定。
- **问题位置**: [docs/WEB_OPTIMIZATION.md](docs/WEB_OPTIMIZATION.md)
- **严重程度**: 中
- **问题类别**: 文档

#### ⬜ ME-31: 缺少架构决策记录（ADR）

- **问题描述**: `REFACTORING_PLAN.md` 记录了计划中的架构变更，但项目没有任何 ADR 来解释关键设计决策的**原因**——例如为何选择 6 种特定运动规律、为何选择特定的多项式阶数、为何选择 Rust 而非 Python、为何选择 Tauri 而非 Electron、为何 SolidJS 而非 React。
- **问题位置**: 项目整体
- **严重程度**: 中
- **问题类别**: 文档

#### ⬜ ME-32: 缺少独立的测试策略/指南文档

- **问题描述**: 尽管 `CONTRIBUTING.md` 简要提及"确保测试通过"，但没有专门文档说明如何运行测试、如何编写测试、测试策略是什么、覆盖率目标是多少。这让新贡献者在编写测试时缺少指导。
- **问题位置**: 项目整体
- **严重程度**: 中
- **问题类别**: 文档、测试

#### ✅ ME-33: Unicode path traversal 变体在导出路径验证中未覆盖

- **问题描述**: [commands/export.rs:25-30](src-tauri/src/commands/export.rs#L25-L30) 的 `validate_export_path` 检查了 `..`、`%2e%2e`、`%2e.`、`.%2e` 路径遍历变体，但未检查其他已知的编码变体，如 `%c0%ae%c0%ae/`（超长 UTF-8 编码）、`%252e%252e`（双重 URL 编码）以及 Unicode 变体（如 `‥` 双点字符）。虽然这些在现代操作系统上不太可能成功利用，但安全审计工具可能标记此问题。
- **问题位置**: [src-tauri/src/commands/export.rs:25-30](src-tauri/src/commands/export.rs#L25-L30)
- **严重程度**: 中
- **问题类别**: 安全

#### ✅ ME-34: CI 工作流未包含依赖安全扫描

- **问题描述**: 所有 GitHub Actions 工作流（`test.yml`、`release.yml`、`docker.yml`）均未包含 `cargo audit`（Rust 依赖漏洞扫描）或 `pnpm audit`/`npm audit`（Node 依赖漏洞扫描）步骤。依赖中的已知漏洞无法在 CI 阶段被自动检测。
- **问题位置**: [.github/workflows/test.yml](.github/workflows/test.yml)、[release.yml](.github/workflows/release.yml)、[docker.yml](.github/workflows/docker.yml)
- **严重程度**: 中
- **问题类别**: 安全、依赖管理

#### ✅ ME-35: `generateRhoPath` 和 `generateRhoActualPath` 代码几乎相同

- **问题描述**: [exports.ts:241-268](src/stores/simulation/exports.ts#L241-L268) 和 [exports.ts:271-300](src/stores/simulation/exports.ts#L271-L300) 两个 SVG 路径生成函数唯一的区别是访问 `data.rho` 还是 `data.rho_actual`。应参数化 `isActual` 标志以消除约 60 行重复代码。
- **问题位置**: [src/stores/simulation/exports.ts:241-300](src/stores/simulation/exports.ts#L241-L300)
- **严重程度**: 中
- **问题类别**: 代码质量

---

### 3.4 低（Low）

#### ✅ LO-01: `StatusBar.tsx` 为空占位文件

- **问题描述**: [StatusBar.tsx](src/components/layout/StatusBar.tsx) 仅包含注释"StatusBar has been removed. This file is kept empty to avoid breaking any potential imports."如果无任何文件导入此模块，应彻底删除。如存在导入，应修复导入而非保留空占位文件。
- **问题位置**: [src/components/layout/StatusBar.tsx](src/components/layout/StatusBar.tsx)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-02: `getLanguageButtonText` 函数已导出但从未被导入

- **问题描述**: [i18n/index.ts:40-42](src/i18n/index.ts#L40-L42) 导出了 `getLanguageButtonText()` 函数，但无任何源文件导入。语言切换按钮文本在 [App.tsx:98](src/App.tsx#L98) 和 [TitleBar.tsx:68-70](src/components/layout/TitleBar.tsx#L68-L70) 中是内联计算的。
- **问题位置**: [src/i18n/index.ts:40-42](src/i18n/index.ts#L40-L42)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-03: `App.tsx` 中存在两个 `onMount` 调用

- **问题描述**: [App.tsx:40-45](src/App.tsx#L40-L45) 和 [App.tsx:55-57](src/App.tsx#L55-L57) 分别注册了 `onMount` 回调。SolidJS 中这虽然合法（按注册顺序执行），但两个独立的 `onMount` 调用不利于代码理解和维护，建议合并。
- **问题位置**: [src/App.tsx:40-57](src/App.tsx#L40-L57)
- **严重程度**: 低
- **问题类别**: 代码质量
- **v0.4.10 修复**: 合并为单个 `onMount` 调用

#### ✅ LO-04: `debounce.ts` 使用 `any[]` 参数类型

- **问题描述**: [debounce.ts:7](src/utils/debounce.ts#L7) `debounceAsync<T extends (...args: any[]) => Promise<void>>` 使用 `any[]` 导致去抖函数参数失去类型检查。可使用 TypeScript 的 `Parameters<T>` 工具类型推断参数。
- **问题位置**: [src/utils/debounce.ts:7](src/utils/debounce.ts#L7)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-05: `utif2` 库使用 `@ts-expect-error` 抑制类型错误

- **问题描述**: [tiff.ts:51](src/exporters/tiff.ts#L51) 和 [tiffWorker.ts:48](src/workers/tiffWorker.ts#L48) 均使用 `@ts-expect-error` 抑制 `UTIF.encode` 的类型错误。虽然第三方库类型定义不完善是常见情况，但建议在代码中添加注释说明具体原因，或提供本地的类型增强声明。
- **问题位置**:
  - [src/exporters/tiff.ts:51](src/exporters/tiff.ts#L51)
  - [src/workers/tiffWorker.ts:48](src/workers/tiffWorker.ts#L48)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-06: `MAX_DPI` 常量在两处重复定义

- **问题描述**: [common.ts:28](src/utils/chartDrawing/common.ts#L28) 定义 `export const MAX_DPI = 600;`，但 [exports.ts:559](src/stores/simulation/exports.ts#L559) 和 [exports.ts:616](src/stores/simulation/exports.ts#L616) 各自内联重定义为 `const MAX_DPI = 600;`。导出模块应引用共享常量。
- **问题位置**:
  - [src/utils/chartDrawing/common.ts:28](src/utils/chartDrawing/common.ts#L28)
  - [src/stores/simulation/exports.ts:559](src/stores/simulation/exports.ts#L559)
  - [src/stores/simulation/exports.ts:616](src/stores/simulation/exports.ts#L616)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-07: SVG 导出布局尺寸硬编码

- **问题描述**: [exports.ts:159-164](src/stores/simulation/exports.ts#L159-L164) 中 SVG 图表宽度（500px）、高度（350px）、间距（20px）和内边距均为硬编码，不可配置也不响应式。
- **问题位置**: [src/stores/simulation/exports.ts:159-164](src/stores/simulation/exports.ts#L159-L164)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-08: 缩放限制在 `CamAnimation.tsx` 中两处硬编码

- **问题描述**: `Math.max(0.2, Math.min(3.0, ...))` 缩放边界在 [CamAnimation.tsx:41](src/components/animation/CamAnimation.tsx#L41)（滚轮事件）和 [CamAnimation.tsx:403](src/components/animation/CamAnimation.tsx#L403)（触摸捏合事件）各自硬编码。应提取为常量。
- **问题位置**: [src/components/animation/CamAnimation.tsx:41,403](src/components/animation/CamAnimation.tsx)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ⬜ LO-09: 动画循环在组件非活跃时持续运行

- **问题描述**: [CamAnimation.tsx:305-312](src/components/animation/CamAnimation.tsx#L305-L312) 的 `requestAnimationFrame` 循环在组件不可见或数据不可用时仍继续运行（虽跳过渲染但 CPU 仍在执行循环体）。应仅在活跃时启动循环。
- **问题位置**: [src/components/animation/CamAnimation.tsx:305-312](src/components/animation/CamAnimation.tsx#L305-L312)
- **严重程度**: 低
- **问题类别**: 性能

#### ✅ LO-10: `SettingsPanel` 的窗口级事件监听器缺少面板状态检查

- **问题描述**: [SettingsPanel.tsx:56-64](src/components/layout/SettingsPanel.tsx#L56-L64) 在 `window` 上注册 `mousemove`/`mouseup` 监听器。`handleMouseMove` 检查了 `dragging()` 状态但未检查面板是否打开——如果面板关闭时拖拽状态未正确清除，残留监听器将继续响应鼠标事件。
- **问题位置**: [src/components/layout/SettingsPanel.tsx:56-64](src/components/layout/SettingsPanel.tsx#L56-L64)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-11: 动画帧范围为 0（无数据）时动画循环仍继续

- **问题描述**: [CamAnimation.tsx:317-321](src/components/animation/CamAnimation.tsx#L317-L321) 当 `max === 0` 时，`safeFrame >= max` 条件始终为真，帧在 0 和 1 之间无限循环。第 305 行的早期返回 `if (!data)` 应能阻止此情况，但在 `simulationData()` 存在但 `s.length === 0` 时存在时间窗口。
- **问题位置**: [src/components/animation/CamAnimation.tsx:317-321](src/components/animation/CamAnimation.tsx#L317-L321)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-12: `compute_rotated_cam` 执行两次数组遍历

- **问题描述**: [profile.rs:419-430](crates/camforge-core/src/profile.rs#L419-L430) 对 `x_static`/`y_static` 进行两次独立的 `.map().collect()` 遍历以分别计算 `x_rot` 和 `y_rot`，每次都重复计算 `cos_a` 和 `sin_a`。由于 N ≤ 720，性能影响微小，但可合并为单次遍历生成两个结果向量。
- **问题位置**: [crates/camforge-core/src/profile.rs:419-430](crates/camforge-core/src/profile.rs#L419-L430)
- **严重程度**: 低
- **问题类别**: 性能

#### ⬜ LO-13: 非滚子从动件路径存在冗余 `rho.clone()`

- **问题描述**: [routes/simulation.rs:137](crates/camforge-server/src/routes/simulation.rs#L137) 和 [commands/simulation.rs:149](src-tauri/src/commands/simulation.rs#L149) 当 `params.r_r <= 0.0` 时执行 `rho.clone()` 然后赋值 `rho_actual = rho`。此时 `rho` 后续不再被使用，直接移动（`rho_actual = rho`）即可避免复制。但编译器优化可能已消除此开销。
- **问题位置**:
  - [crates/camforge-server/src/routes/simulation.rs:137](crates/camforge-server/src/routes/simulation.rs#L137)
  - [src-tauri/src/commands/simulation.rs:149](src-tauri/src/commands/simulation.rs#L149)
- **严重程度**: 低
- **问题类别**: 性能

#### ⬜ LO-14: 缺少性能基准测试

- **问题描述**: 项目无性能分析方法论、无基准测试套件、无性能基线数据。`docs/ARCHITECTURE.md` 提到了并行计算、Canvas HDPI、防抖等优化目标，但未提供量化的性能指标或测试方法。
- **问题位置**: 项目整体
- **严重程度**: 低
- **问题类别**: 性能、文档

#### ✅ LO-15: `.editorconfig` 文件缺失

- **问题描述**: `CONTRIBUTING.md` 规定了 2 空格缩进、分号、尾逗号等代码风格，但缺少 `.editorconfig` 文件来在编辑器层面自动强制执行这些规则。不同编辑器用户可能无意中引入风格不一致的代码。
- **问题位置**: 项目根目录
- **严重程度**: 低
- **问题类别**: 代码质量

#### ⬜ LO-16: `xlsx`（SheetJS）包曾有已知 CVE

- **问题描述**: `xlsx` 社区版（v0.18.5）有过安全漏洞历史记录，包括 CVE-2023-30533（原型污染）。版本 0.18.5 可能受影响。该库在 [src/exporters/excel.ts](src/exporters/excel.ts) 中用于生成 Excel 导出。
- **问题位置**: [package.json:36](package.json#L36)
- **严重程度**: 低
- **问题类别**: 安全、依赖管理

#### ⬜ LO-17: `gif.js` 版本较旧且无积极维护

- **问题描述**: `gif.js` v0.2.0 相对老旧，上游已无积极开发活动。当前功能正常实现 GIF 动画导出，但应长期关注替代方案。
- **问题位置**: [package.json:33](package.json#L33)
- **严重程度**: 低
- **问题类别**: 依赖管理

#### ✅ LO-18: `tauri-action@v0` 未锁定具体版本

- **问题描述**: [release.yml:79](.github/workflows/release.yml#L79) 使用 `tauri-apps/tauri-action@v0`，这会追踪最新的 v0.x 预生产版本，可能在不经意间引入破坏性变更。应固定到具体的发行版本。
- **问题位置**: [.github/workflows/release.yml:79](.github/workflows/release.yml#L79)
- **严重程度**: 低
- **问题类别**: 依赖管理、兼容性

#### ⬜ LO-19: 项目无 GitHub README 徽章

- **问题描述**: 根目录 `README.md` 缺乏 CI 状态、测试覆盖率、最新版本等常见项目徽章，这些徽章能帮助用户快速评估项目健康度和活跃度。
- **问题位置**: [README.md](README.md)
- **严重程度**: 低
- **问题类别**: 文档

#### ⬜ LO-20: 架构文档中无 SVG/PNG 架构图

- **问题描述**: `docs/ARCHITECTURE.md` 和 `docs/REFACTORING_PLAN.md` 中的 ASCII 艺术图功能可用但可读性较差。缺少 SVG/PNG 架构图使得数据流和模块关系的可视化打折扣。
- **问题位置**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)、[docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md)
- **严重程度**: 低
- **问题类别**: 文档

#### ⬜ LO-21: `FrameData` 结构体为直动从动件填充无意义 `0.0` 值

- **问题描述**: [types.rs:366-398](crates/camforge-core/src/types.rs#L366-L398) `FrameData` 中的 `pivot_x`、`pivot_y`、`arm_angle` 字段对于直动从动件设为 `0.0`。统一类型虽有便利性，但向 API 消费者暴露了无关的内部实现细节。
- **问题位置**: [crates/camforge-core/src/types.rs:366-398](crates/camforge-core/src/types.rs#L366-L398)
- **严重程度**: 低
- **问题类别**: 架构设计

#### ✅ LO-22: `simulate` API 响应包裹在冗余的 `data` 键中

- **问题描述**: [routes/simulation.rs:19-21](crates/camforge-server/src/routes/simulation.rs#L19-L21) 中 API 响应将 `SimulationData` 包装在 `{ data: SimulationData }` 对象中。这强制前端所有消费方都需进行 `response.data` 解包，却未提供任何额外信息（如分页、元数据等）来证明包装的必要性。
- **问题位置**: [crates/camforge-server/src/routes/simulation.rs:19-21](crates/camforge-server/src/routes/simulation.rs#L19-L21)
- **严重程度**: 低
- **问题类别**: 架构设计

#### ✅ LO-23: Rust 入口点使用通用 `expect` 消息

- **问题描述**: [lib.rs:23](src-tauri/src/lib.rs#L23) 使用 `.expect("error while running tauri application")` 处理 Tauri 应用启动错误。调试时通用消息提供的信息不够。可使用 `if let Err(e) = ...` 记录链式错误原因后再退出。
- **问题位置**: [src-tauri/src/lib.rs:23](src-tauri/src/lib.rs#L23)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-24: CSP 设置 `from_str` 失败时静默跳过

- **问题描述**: [main.rs:112-113](crates/camforge-server/src/main.rs#L112-L113) 中 CSP 头设置使用 `if let Ok(csp_value) = HeaderValue::from_str(&csp)`，如果 `from_str` 因编码问题或意外边缘情况失败，则 CSP 头在无任何日志的情况下被静默丢弃。应至少添加 `eprintln!` 或 `tracing::warn!`。
- **问题位置**: [crates/camforge-server/src/main.rs:112-113](crates/camforge-server/src/main.rs#L112-L113)
- **严重程度**: 低
- **问题类别**: 安全

#### ✅ LO-25: 服务器绑定到 `0.0.0.0`

- **问题描述**: [main.rs:183](crates/camforge-server/src/main.rs#L183) 服务器绑定到所有网络接口。虽然 Docker Compose 通过 `ports: "3000:3000"` 暴露，但在 Docker 外部运行时绑定 `0.0.0.0` 扩大了攻击面。
- **问题位置**: [crates/camforge-server/src/main.rs:183](crates/camforge-server/src/main.rs#L183)
- **严重程度**: 低
- **问题类别**: 安全

#### ✅ LO-26: CSP 中 `connect-src` 允许 Google Fonts 域名可能不必要

- **问题描述**: [main.rs:73-74](crates/camforge-server/src/main.rs#L73-L74) 中 CSP 的 `connect-src` 包含了 `https://fonts.googleapis.com` 和 `https://fonts.gstatic.com`。字体通过 `<link>` 标签加载（`default-src` 覆盖），`connect-src` 中的字体域名放宽了 XSS 数据外泄的约束面。
- **问题位置**: [crates/camforge-server/src/main.rs:73-74](crates/camforge-server/src/main.rs#L73-L74)
- **严重程度**: 低
- **问题类别**: 安全
- **v0.4.10 修复**: 字体已本地化，`connect-src` 中 Google Fonts 域名已移除，仅保留 `'self'`

#### ⬜ LO-27: 导出路径部分文件写入无清理机制

- **问题描述**: [commands/export.rs:170](src-tauri/src/commands/export.rs#L170) 如果 `writeln!` 调用在 DXF/CSV 文件写入中途失败，会留下损坏的部分文件在用户文件系统中，无重试或清理回滚机制。
- **问题位置**: [src-tauri/src/commands/export.rs:170](src-tauri/src/commands/export.rs#L170)
- **严重程度**: 低
- **问题类别**: 代码质量

#### ✅ LO-28: `CamParams::initial_angle` 默认值 0 导致摆动从动件压力角奇点

- **问题描述**: [types.rs:130-131](crates/camforge-core/src/types.rs#L130-L131) `initial_angle` 默认值为 `0.0`（`#[serde(default)]`）。当摆动从动件的 `initial_angle + psi == 0` 时，`compute_oscillating_pressure_angle` 的分母 `pivot_distance * sin(0) = 0`，压力角被强制为 90 度，这在物理上可能不正确。验证器应添加对零初始角度的警告（针对摆动从动件）或施加适当约束。
- **问题位置**: [crates/camforge-core/src/types.rs:130-131](crates/camforge-core/src/types.rs#L130-L131)
- **严重程度**: 低
- **问题类别**: 架构设计

#### ✅ LO-29: `camforge-core` 声明了可能不必要的 `serde_json` 直接依赖

- **问题描述**: [camforge-core/Cargo.toml:12](crates/camforge-core/Cargo.toml#L12) 声明了 `serde_json` 直接依赖，但核心 crate 本身不执行 JSON 序列化/反序列化操作（仅通过 `#[derive(Serialize, Deserialize)]` 使用 `serde` derive 宏）。下游消费者（server、tauri）独立声明了 `serde_json`。
- **问题位置**: [crates/camforge-core/Cargo.toml:12](crates/camforge-core/Cargo.toml#L12)
- **严重程度**: 低
- **问题类别**: 依赖管理

#### ⬜ LO-30: `CONTRIBUTING.md` 规定的代码规范未在代码库中一致执行

- **问题描述**: `CONTRIBUTING.md` 中规定了 JSDoc 格式、命名规范和代码组织标准，但这些规范在代码库中的执行不一致——例如 JSDoc 覆盖率仅约 17%、中英文注释混用等。
- **问题位置**: [CONTRIBUTING.md](CONTRIBUTING.md) vs 实际代码库
- **严重程度**: 低
- **问题类别**: 文档、代码质量

#### ✅ LO-31: `CHANGELOG.md` 底部比较链接可能不完整

- **问题描述**: CHANGELOG.md 的底部比较链接列表在 v0.4.5 版本标注"已修复"但可能未完全更新——需确认链接定义与实际发布版本的对应关系。
- **问题位置**: [CHANGELOG.md](CHANGELOG.md)（底部链接部分）
- **严重程度**: 低
- **问题类别**: 文档

#### ⬜ LO-32: 缺少用户操作手册

- **问题描述**: 项目无面向最终用户的使用指南文档。`README.md` 仅提供参数参考和键盘快捷键列表，但不是结构化的用户手册。`TODO.md` Phase 6 第 6.1 项"API docs, user manual"标记为未完成。
- **问题位置**: 项目整体
- **严重程度**: 低
- **问题类别**: 文档

---

## 4. 优先级建议

### 4.1 严重问题（必须立即处理）

| 优先级 | 问题编号 | 建议措施 | 预估工作量 |
|:------:|:--------|:---------|:----------:|
| P0 | CR-01 | 立即从仓库中移除 `camforge-next.keystore`；将 `*.keystore`、`*.jks` 添加至 `.gitignore`；若密钥库密码曾在 CI 日志中出现，轮换密钥 | 0.5h |
| P0 | CR-02 | 在 `computeSimulationLocally` 添加 `hasError` 状态标志或返回 `Result<SimulationData, Error>`；下游消费者检查错误状态并显示用户可见的错误提示 | 2h |
| P0 | CR-03 | 将 `randomize.ts` 第 110 行改为 `await runSimulation()`；添加单元测试验证 retry 循环行为 | 1h |

### 4.2 高优先级问题（建议 v0.4.10 解决）

| 优先级 | 问题编号 | 建议措施 | 预估工作量 | 状态 |
|:------:|:--------|:---------|:----------:|:----:|
| P1 | HI-01 | 在 `camforge-core` 中添加 `compute_full_simulation(params) -> SimulationData` 公共函数，统一 Tauri 命令和 Axum 路由的计算逻辑；同步 DXF 生成逻辑 | 8h | ⬜ |
| P1 | HI-02 | 重构三个图表组件以使用 `useChartInteraction` 和 `useChartPadding` Hook；提取共享的提示框渲染和图表背景绘制工具函数 | 6h | ⬜ |
| P1 | HI-03 | 替换所有图表绘制函数中的硬编码颜色为 `chartColors.ts` 常量引用 | 2h | ✅ |
| P1 | HI-08 | 在 CSP nonce 替换中间件中添加 Content-Type 检查，仅对 `text/html` 响应执行缓冲替换 | 1h | ✅ |
| P1 | HI-10 | 使用 `tower::limit::RateLimitLayer` 实现实际速率限制，或将代码中的误导性速率限制日志移除 | 2h | ✅ |
| P1 | HI-11 | 统一 Tauri CSV 导出逻辑：添加 `rho_actual` 列、实现 CSV 公式注入转义函数 | 1.5h | ✅ |
| P1 | HI-12 | 删除 `package-lock.json`，在 `.gitignore` 中添加排除规则；在 `CONTRIBUTING.md` 中明确仅使用 pnpm | 0.5h | ✅ |
| P1 | HI-13 | 在锁获取位置上方添加文档注释说明锁序契约；考虑使用基于作用域的 RAII 守卫来强制锁序 | 1h | ✅ |
| P1 | HI-17 | 将 Google Fonts 字体文件本地打包或在构建时下载，从 Tauri CSP 中移除外部字体 CDN 域名 | 2h | ✅ |

### 4.3 中优先级问题（建议 v0.4.9 或后续版本处理）

- **架构重构**（ME-06, ME-07, ME-25, ME-35）: 拆分 `Sidebar.tsx` 各面板为独立组件；拆分 `exports.ts` 各导出格式为独立模块；将元组返回值改为命名结构体；参数化重复的 `generateRhoPath` 函数。预估总工作量约 10h。
- **安全加固**（ME-19, ME-20, ME-21, ME-22, ME-23, ME-33, ME-34）: 添加 HSTS 头、添加 `.dockerignore`、Docker 非 root 用户、CI 依赖扫描、完善路径验证。预估总工作量约 6h。
- **测试补充**（ME-01, ME-02, ME-03, ME-04, ME-05）: 优先为 API 适配层、Tauri 命令和关键 UI 组件添加测试。E2E 测试框架（Playwright）为中长期目标。预估总工作量约 16h（分阶段）。
- **依赖清理**（ME-15, ME-16, ME-17, ME-18）: 移除 `anyhow`、`thiserror`、`num-traits`、`@types/react`、`@types/react-dom` 等未使用依赖。预估工作量 1h。
- **文档完善**（ME-30, ME-31, ME-32）: 补全 `WEB_OPTIMIZATION.md`、编写 ADR、添加测试策略文档。预估工作量约 6h。

### 4.4 低优先级问题（持续改进）

低优先级的 32 个问题主要涉及代码风格的统一化（LO-01 至 LO-11）、微性能优化（LO-12 至 LO-14）、边缘情况处理改进（LO-24 至 LO-28）和文档细节完善（LO-19 至 LO-20、LO-30 至 LO-32）。建议在日常开发中采用"童子军规则"（每次修改代码时顺手清理所在文件的低优问题），而非集中突击。

---

## 附录 A: 文件引用索引

为便于快速定位，以下是审查中引用的关键文件路径汇总：

### 前端核心文件（TypeScript/SolidJS）

| 文件 | 说明 |
|------|------|
| [src/App.tsx](src/App.tsx) | 应用根组件 |
| [src/stores/simulation/core.ts](src/stores/simulation/core.ts) | 核心仿真状态管理 |
| [src/stores/simulation/compute.ts](src/stores/simulation/compute.ts) | 前端仿真计算（Rust 镜像） |
| [src/stores/simulation/exports.ts](src/stores/simulation/exports.ts) | 多格式导出编排 |
| [src/stores/simulation/randomize.ts](src/stores/simulation/randomize.ts) | 随机参数生成 |
| [src/stores/simulation/presets.ts](src/stores/simulation/presets.ts) | 预设管理 |
| [src/components/animation/CamAnimation.tsx](src/components/animation/CamAnimation.tsx) | 凸轮动画组件 |
| [src/components/charts/MotionCurves.tsx](src/components/charts/MotionCurves.tsx) | 运动曲线图表 |
| [src/components/charts/GeometryChart.tsx](src/components/charts/GeometryChart.tsx) | 压力角图表（命名不当） |
| [src/components/charts/CurvatureChart.tsx](src/components/charts/CurvatureChart.tsx) | 曲率半径图表 |
| [src/components/layout/MainCanvas.tsx](src/components/layout/MainCanvas.tsx) | 主画布区域 |
| [src/components/layout/Sidebar.tsx](src/components/layout/Sidebar.tsx) | 侧边栏参数面板 |
| [src/constants/chartColors.ts](src/constants/chartColors.ts) | 图表颜色常量（未被引用） |
| [src/io/storage.ts](src/io/storage.ts) | 存储抽象层（未被引用） |
| [src/hooks/useChartInteraction.ts](src/hooks/useChartInteraction.ts) | 图表交互 Hook（未被引用） |
| [src/api/index.ts](src/api/index.ts) | API 适配器接口 |

### Rust 后端核心文件

| 文件 | 说明 |
|------|------|
| [crates/camforge-core/src/types.rs](crates/camforge-core/src/types.rs) | 共享类型与参数验证 |
| [crates/camforge-core/src/profile.rs](crates/camforge-core/src/profile.rs) | 凸轮轮廓计算 |
| [crates/camforge-core/src/motion.rs](crates/camforge-core/src/motion.rs) | 运动规律计算 |
| [crates/camforge-core/src/full_motion.rs](crates/camforge-core/src/full_motion.rs) | 完整周期运动计算 |
| [crates/camforge-server/src/main.rs](crates/camforge-server/src/main.rs) | Axum HTTP 服务器入口 |
| [crates/camforge-server/src/routes/simulation.rs](crates/camforge-server/src/routes/simulation.rs) | 仿真 API 端点 |
| [crates/camforge-server/src/routes/export.rs](crates/camforge-server/src/routes/export.rs) | 导出 API 端点 |
| [src-tauri/src/commands/simulation.rs](src-tauri/src/commands/simulation.rs) | Tauri 仿真 IPC 命令 |
| [src-tauri/src/commands/export.rs](src-tauri/src/commands/export.rs) | Tauri 导出 IPC 命令 |

### 配置文件

| 文件 | 说明 |
|------|------|
| [Cargo.toml](Cargo.toml) | Rust 工作区根清单 |
| [package.json](package.json) | Node.js 包清单 |
| [tsconfig.json](tsconfig.json) | TypeScript 配置 |
| [vite.config.ts](vite.config.ts) | Vite 构建配置 |
| [tauri.conf.json](src-tauri/tauri.conf.json) | Tauri 应用 + CSP 配置 |
| [Dockerfile](Dockerfile) | Docker 多阶段构建 |
| [eslint.config.js](eslint.config.js) | ESLint 配置 |

---

*审查完成时间: 2026-05-01 | 审查工具版本: Claude Code (deepseek-v4-pro) | 当前修复版本: v0.4.11*
