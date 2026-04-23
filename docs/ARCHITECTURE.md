# CamForge-Next 架构设计文档

> 本文档描述 CamForge-Next 的系统架构、技术选型和模块设计。

## 一、系统概述

CamForge-Next 是一款现代化的凸轮机构运动学模拟器桌面应用程序，采用 Tauri v2 + SolidJS 架构，实现跨平台部署。

### 核心功能

- 凸轮轮廓设计与可视化
- 运动规律计算与分析
- 压力角、曲率半径检测
- 动画演示
- 多格式数据导出

## 二、技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (SolidJS)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Components │  │   Stores    │  │     Services        │  │
│  │  (UI 层)    │  │  (状态管理) │  │  (业务逻辑)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                          │                                   │
│                    Tauri IPC                                │
│                          ▼                                   │
├─────────────────────────────────────────────────────────────┤
│                      Backend (Rust)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Commands  │  │  Cam Module │  │    Types/Models     │  │
│  │  (Tauri)    │  │  (计算核心) │  │  (数据结构)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Tauri | v2 | 跨平台桌面应用框架 |
| 前端 | SolidJS | 1.9 | 响应式 UI 框架 |
| 语言 | TypeScript | 5.6 | 类型安全 |
| 样式 | Tailwind CSS | 4.2 | 原子化 CSS |
| 后端 | Rust | 1.70+ | 高性能计算 |
| 数值计算 | ndarray | 0.15 | Rust 数组运算 |
| 并行计算 | rayon | 1.8 | Rust 并行处理 |

## 三、前端架构

### 3.1 目录结构

```
src/
├── components/          # UI 组件
│   ├── animation/       # 动画组件 (CamAnimation)
│   ├── charts/          # 图表组件 (MotionCurves, CurvatureChart, GeometryChart)
│   ├── controls/        # 控件组件 (NumberInput, Select, Toggle)
│   └── layout/          # 布局组件 (Sidebar, MainCanvas, TitleBar, StatusBar)
├── services/            # 业务服务层
│   ├── motion.ts        # 运动规律计算
│   └── gifEncoder.ts    # GIF 编码服务
├── stores/              # 状态管理
│   ├── simulation.ts    # 模拟状态
│   ├── settings.ts      # 设置状态
│   └── history.ts       # 历史记录（撤销/重做）
├── io/                  # I/O 抽象层
│   └── storage.ts       # localStorage 封装
├── i18n/                # 国际化
│   └── translations.ts  # 中英文翻译
├── constants/           # 常量定义
├── types/               # TypeScript 类型
└── utils/               # 工具函数
    ├── array.ts         # 数组操作
    ├── debounce.ts      # 防抖函数
    ├── tauri.ts         # Tauri API 封装
    └── chartDrawing.ts  # 图表绘制
```

### 3.2 状态管理

采用 SolidJS 的 `createSignal` 进行细粒度响应式状态管理：

```typescript
// 参数状态
export const [params, setParams] = createSignal<CamParams>(defaultParams);

// 模拟数据状态
export const [simulationData, setSimulationData] = createSignal<SimulationData | null>(null);

// 显示选项状态
export const [displayOptions, setDisplayOptions] = createSignal<DisplayOptions>(defaultDisplayOptions);
```

### 3.3 数据流

```
用户输入 → updateParam() → params Signal 变化
                              ↓
                         runSimulation()
                              ↓
                    Tauri IPC / 前端计算
                              ↓
                    setSimulationData()
                              ↓
                    UI 自动更新（响应式）
```

## 四、后端架构

### 4.1 目录结构

```
src-tauri/src/
├── cam/                 # 凸轮计算模块
│   ├── motion.rs        # 运动规律计算
│   ├── profile.rs       # 轮廓计算
│   ├── geometry.rs      # 几何分析
│   └── mod.rs           # 模块导出
├── commands/            # Tauri 命令
│   ├── simulation.rs    # 模拟命令
│   └── export.rs        # 导出命令
├── types/               # 数据类型
│   └── params.rs        # 参数定义
├── lib.rs               # 库入口
└── main.rs              # 程序入口
```

### 4.2 Tauri 命令

```rust
#[tauri::command]
fn run_simulation(params: CamParams) -> SimulationData {
    // 调用 Rust 计算模块
}

#[tauri::command]
fn export_dxf(filepath: String, data: SimulationData) -> Result<(), String> {
    // 导出 DXF 文件
}
```

### 4.3 计算模块

- **motion.rs**: 实现 6 种运动规律的计算
- **profile.rs**: 计算凸轮理论轮廓和实际轮廓
- **geometry.rs**: 计算压力角、曲率半径

## 五、关键设计决策

### 5.1 前后端分离

- **前端**: 负责用户界面、状态管理、简单计算（浏览器环境 fallback）
- **后端**: 负责高性能数值计算、文件系统操作

### 5.2 双环境支持

应用同时支持 Tauri 环境和纯浏览器环境：

```typescript
const isTauri = isTauriEnv();

if (isTauri) {
  // 使用 Rust 后端计算
  const data = await invokeTauri<SimulationData>('run_simulation', { params });
} else {
  // 使用前端 TypeScript 计算
  const data = generateMockData(params);
}
```

### 5.3 响应式设计

- 使用 SolidJS 的细粒度响应式系统
- 参数变化自动触发重新计算
- 图表自动更新

### 5.4 错误处理

- 前端: ErrorBoundary 组件捕获渲染错误
- 后端: Rust Result 类型确保错误安全
- 输入校验: 参数验证函数

## 六、性能优化

### 6.1 计算优化

- Rust 后端使用 rayon 并行计算
- 前端使用 requestAnimationFrame 分批处理
- GIF 编码使用 Web Worker

### 6.2 渲染优化

- Canvas 高 DPI 支持
- 参数更新防抖
- 按需渲染

### 6.3 内存优化

- 大数组使用 reduce 替代展开运算符
- DPI 导出上限保护
- 及时清理 Worker

## 七、扩展性设计

### 7.1 运动规律扩展

新增运动规律只需：

1. 在 `MotionLaw` 枚举中添加新值
2. 在 `computeMotion` 函数中添加计算逻辑
3. 更新 UI 选项

### 7.2 从动件类型扩展

当前支持尖底和滚子从动件，可扩展：

- 平底从动件
- 摆动从动件

### 7.3 导出格式扩展

导出模块采用策略模式，易于添加新格式：

```typescript
export function generateDXF(data: SimulationData): string { ... }
export function generateCSV(data: SimulationData): string { ... }
export function generateSVG(data: SimulationData): string { ... }
```

## 八、安全设计

### 8.1 输入验证

- 前端: 参数范围校验
- 后端: 文件路径验证

### 8.2 文件操作安全

- 使用 Tauri Dialog API 让用户选择保存位置
- 验证文件扩展名
- 防止路径遍历攻击

## 九、测试策略

### 9.1 前端测试

- Vitest 单元测试
- 运动规律计算测试
- 数组工具函数测试

### 9.2 后端测试

- Rust 内置测试框架
- 运动规律计算测试
- 几何计算测试

### 9.3 CI/CD

- GitHub Actions 自动化测试
- 跨平台构建
- 自动发布
