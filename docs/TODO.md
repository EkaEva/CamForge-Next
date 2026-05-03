# CamForge 开发路线图

> **版本**: v0.4.12 → v0.6.0
> **最后更新**: 2026-05-01

---

## Phase 1: 安全修复与代码质量 (v0.5.0)

### 1.1 安全修复

- [x] **1.1.1** CR-02: 导出命令接受绝对路径 — `validate_export_path` 已实现，限制在允许目录内
- [ ] **1.1.2** CR-04: 替换 `std::fs::File::create` — `export.rs` 仍使用 `std::fs::File::create`，未改用 Tauri FS 插件 API
- [x] **1.1.3** 修复 `partial_cmp().unwrap()` — 服务端已改用 `unwrap_or(Ordering::Equal)`
- [x] **1.1.4** 修复服务端启动 `unwrap()` — 已改为优雅错误处理
- [ ] **1.1.5** CSV 注入防护 — `csv.ts` 未对公式前缀（`=`, `+`, `-`, `@`）进行转义
- [ ] **1.1.6** 服务端速率限制 — `camforge-server` 未添加 RateLimitLayer 或类似中间件

### 1.2 代码质量重构

- [x] **1.2.1** 拆分 `simulation.ts` — 已拆分为 `core.ts`, `compute.ts`, `exports.ts`, `presets.ts`, `animation.ts`, `randomize.ts`
- [x] **1.2.2** 拆分 `chartDrawing.ts` — 已拆分为 `src/utils/chartDrawing/` 子模块目录
- [x] **1.2.3** 提取 `useChartInteraction.ts` — 已提取到 `src/hooks/useChartInteraction.ts`
- [x] **1.2.4** 提取 `useChartPadding.ts` — 已提取到 `src/hooks/useChartPadding.ts`
- [x] **1.2.5** 提取 `chartColors.ts` — 已提取到 `src/constants/chartColors.ts`
- [x] **1.2.6** `motion.rs` 去重 — 已拆分到 `camforge-core` crate，服务端和 Tauri 共用
- [x] **1.2.7** 统一参数验证 — `CamParams::validate()` 已在 `camforge-core/src/types.rs` 中实现

### 1.3 测试

- [x] **1.3.1** CI 工作流 — `.github/workflows/` 已存在 CI 配置
- [ ] **1.3.2** 服务端集成测试 — `camforge-server` 无测试文件
- [x] **1.3.3** `camforge-core` 单元测试 — 已有 12 个测试通过
- [x] **1.3.4** 前端组件测试 — `src/exporters/__tests__/exporters.test.ts` 已存在
- [x] **1.3.5** ESLint + Prettier 配置 — `eslint.config.js` + `.prettierrc` 已存在
- [x] **1.3.6** TypeScript 严格模式 — 已启用 `strict: true`（tsconfig.json）
- [x] **1.3.7** TypeScript 版本 — 已升级到 5.8.x

### 1.4 其他

- [x] **1.4.1** 预设加载 — `presets.ts` 已实现 localStorage 和文件加载
- [x] **1.4.2** Canvas null safety — 项目使用 SVG 渲染，无 Canvas `getContext` 调用
- [ ] **1.4.3** `Math.max(...arr)` 大数组溢出 — 图表组件仍使用 spread 语法，未改用 `reduce`
- [ ] **1.4.4** SVG 导出 XML 转义 — `exporters/svg.ts` 未对特殊字符（`&`, `<`, `>`）转义
- [x] **1.4.5** CSP 安全头 — Rust 服务端已添加完整 CSP + 安全头中间件
- [x] **1.4.6** CSP nonce 替代 unsafe-inline — 已实现 nonce-based CSP（Vite 插件 + Rust 服务端注入）
- [ ] **1.4.7** 服务端 SVG 导出 — `camforge-server` 未实现 SVG 导出端点

---

## Phase 2: 摆动从动件支持 (v0.5.0)

### 2.1 类型系统

- [x] **2.1.1** `FollowerType` 枚举 — 已实现 5 种类型（TranslatingKnifeEdge/Roller/FlatFaced, OscillatingRoller/FlatFaced）
- [x] **2.1.2** 摆动参数 — `arm_length`, `pivot_distance`, `initial_angle`, `gamma` 已添加到 `CamParams`
- [x] **2.1.3** TypeScript 类型同步 — `src/types/index.ts` 与 Rust 类型一致

### 2.2 平底从动件计算

- [x] **2.2.1** 直动平底轮廓计算 — `compute_flat_faced_profile` 已实现
- [x] **2.2.2** 摆动平底轮廓计算 — `compute_oscillating_flat_faced_profile` 已实现
- [x] **2.2.3** 平底压力角 — `compute_flat_faced_pressure_angle` 已实现

### 2.3 摆动从动件计算

- [x] **2.3.1** 摆动轮廓计算 — `compute_oscillating_profile` 已实现
- [x] **2.3.2** 摆动压力角 — `compute_oscillating_pressure_angle` 已实现
- [x] **2.3.3** 摆动动画帧数据 — `get_frame_data` 已支持摆动从动件
- [x] **2.3.4** 安装偏角 gamma — 枢轴位置已使用 `gamma` 计算

### 2.4 后端集成

- [x] **2.4.1** Tauri 命令 — `run_simulation` 和 `get_frame_data` 已支持所有从动件类型
- [x] **2.4.2** 服务端路由 — `camforge-server` 已同步所有计算逻辑
- [x] **2.4.3** 凸性检测 — `has_concave_region` 和 `flat_face_min_half_width` 已计算

### 2.5 前端 UI

- [x] **2.5.1** 侧边栏参数面板 — 已根据从动件类型动态显示/隐藏参数
- [x] **2.5.2** 动画渲染 — `CamAnimation.tsx` 已支持所有 5 种从动件类型的动画
- [x] **2.5.3** 平底宽度提示 — 侧边栏显示最小平底宽度，凹区域警告
- [x] **2.5.4** 接触点偏置 — 直动/摆动平底接触点已按 `ds/ddelta` 偏置渲染
- [x] **2.5.5** 随机参数凸性保证 — `randomize.ts` 已实现平底凸性重试循环
- [x] **2.5.6** i18n — 中英文翻译已覆盖所有新增参数和状态文本

### 2.6 测试

- [x] **2.6.1** 导出模块测试 — `exporters.test.ts` 覆盖 DXF/CSV/Excel
- [ ] **2.6.2** 摆动从动件单元测试 — `camforge-core` 缺少摆动轮廓/压力角专项测试
- [ ] **2.6.3** 动画组件测试 — 无 `CamAnimation.test.tsx`
- [ ] **2.6.4** 端到端测试 — 无 Playwright 配置

---

## Phase 3: 凸轮优化算法 (v0.5.5)

### 3.1 优化核心

- [ ] **3.1.1** 优化框架 — 无 `optimization.rs`
- [ ] **3.1.2** 压力角优化 — 未实现
- [ ] **3.1.3** 曲率半径优化 — 未实现
- [ ] **3.1.4** 多目标优化 — 未实现
- [ ] **3.1.5** 优化约束系统 — 未实现

### 3.2 后端集成

- [ ] **3.2.1** Tauri 优化命令 — 未实现
- [ ] **3.2.2** 服务端优化路由 — 未实现
- [ ] **3.2.3** 优化结果缓存 — 未实现

### 3.3 前端 UI

- [ ] **3.3.1** `OptimizationPanel.tsx` — 不存在
- [ ] **3.3.2** 优化结果可视化 — 未实现
- [ ] **3.3.3** 参数敏感度分析 — 未实现
- [ ] **3.3.4** 优化历史记录 — 未实现

### 3.4 测试

- [ ] **3.4.1** 优化算法单元测试 — 未实现
- [ ] **3.4.2** 优化集成测试 — 未实现
- [ ] **3.4.3** 优化性能基准测试 — 未实现

---

## Phase 4: 增强功能 (v0.6.0)

### 4.1 批处理与参数化

- [ ] **4.1.1** 批量计算 — 无 `batch.rs`
- [ ] **4.1.2** 批量导出 — 未实现
- [ ] **4.1.3** `ParametricPanel.tsx` — 不存在

### 4.2 方案对比

- [ ] **4.2.1** 方案变体管理 — 无 `variants.ts`
- [ ] **4.2.2** `ComparisonView.tsx` — 不存在
- [ ] **4.2.3** 对比图表 — 未实现

### 4.3 高级功能

- [ ] **4.3.1** 敏感度可视化 — 未实现
- [ ] **4.3.2** 设计规则检查 — 未实现
- [ ] **4.3.3** 自定义运动规律编辑器 — 未实现

---

## Phase 5: 生产加固 (v0.6.0)

### 5.1 端到端测试

- [ ] **5.1.1** Playwright 配置 — 不存在
- [ ] **5.1.2** 核心流程 E2E 测试 — 未实现
- [ ] **5.1.3** 导出功能 E2E 测试 — 未实现
- [ ] **5.1.4** 跨浏览器测试 — 未实现
- [ ] **5.1.5** 性能基准测试 — 未实现

---

## Phase 6: 最终打磨 (v0.6.0+)

- [ ] **6.1** 文档完善 — API 文档、用户手册
- [ ] **6.2** 安全审计报告 — 未进行
- [ ] **6.3** 性能优化 — 未系统化进行
- [ ] **6.4** 无障碍访问 (a11y) — 未实现

---

## 完成度统计

| Phase | 总计 | 已完成 | 完成率 |
|-------|------|--------|--------|
| 1.1 安全修复 | 6 | 3 | 50% |
| 1.2 代码质量 | 7 | 7 | 100% |
| 1.3 测试 | 7 | 6 | 86% |
| 1.4 其他 | 7 | 4 | 57% |
| 2.1 类型系统 | 3 | 3 | 100% |
| 2.2 平底计算 | 3 | 3 | 100% |
| 2.3 摆动计算 | 4 | 4 | 100% |
| 2.4 后端集成 | 3 | 3 | 100% |
| 2.5 前端 UI | 6 | 6 | 100% |
| 2.6 测试 | 4 | 1 | 25% |
| 3.x 优化算法 | 12 | 0 | 0% |
| 4.x 增强功能 | 9 | 0 | 0% |
| 5.x 生产加固 | 5 | 0 | 0% |
| 6.x 最终打磨 | 4 | 0 | 0% |
| **总计** | **80** | **41** | **51%** |
