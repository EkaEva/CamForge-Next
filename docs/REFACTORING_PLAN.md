# CamForge-Next 前后端分离改造方案

> 创建日期：2026-04-23
> 目标：支持桌面应用 + Web 服务器双模式部署

---

## 一、改造目标

### 1.1 当前架构

```
┌─────────────────────────────────────────────────────────┐
│                    Tauri Desktop App                     │
│  ┌─────────────────┐      ┌─────────────────────────┐   │
│  │   SolidJS 前端   │◄────►│   Rust 后端 (Tauri)     │   │
│  │   (TypeScript)  │ IPC  │   - cam/ (计算模块)     │   │
│  │                 │      │   - commands/ (IPC)     │   │
│  └─────────────────┘      └─────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2 目标架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        部署模式选择                              │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────────┐
│   模式 A: 桌面应用       │     │      模式 B: Web 服务器          │
│  ┌───────────────────┐  │     │  ┌───────────────────────────┐  │
│  │  SolidJS 前端      │  │     │  │     SolidJS 前端          │  │
│  │  (打包进应用)      │  │     │  │   (静态文件部署)          │  │
│  └─────────┬─────────┘  │     │  └─────────────┬─────────────┘  │
│            │ Tauri IPC  │     │                │ HTTP API       │
│  ┌─────────▼─────────┐  │     │  ┌─────────────▼─────────────┐  │
│  │  camforge-tauri   │  │     │  │    camforge-server        │  │
│  │  (Tauri 包装层)   │  │     │  │    (Axum HTTP Server)     │  │
│  └─────────┬─────────┘  │     │  └─────────────┬─────────────┘  │
│            │            │     │                │                │
│  ┌─────────▼─────────┐  │     │  ┌─────────────▼─────────────┐  │
│  │   camforge-core   │  │     │  │     camforge-core         │  │
│  │   (共享核心库)    │◄─┼──────┼──┤     (共享核心库)          │  │
│  └───────────────────┘  │     │  └───────────────────────────┘  │
└─────────────────────────┘     │              ▲                 │
                                │  ┌───────────┴───────────┐     │
                                │  │      Docker 容器      │     │
                                │  └───────────────────────┘     │
                                └─────────────────────────────────┘
```

### 1.3 核心原则

1. **零功能损失**：桌面应用所有功能保持不变
2. **代码复用**：核心计算逻辑只维护一份
3. **独立部署**：Web 模式可独立部署到服务器
4. **向后兼容**：现有用户无需改变使用方式

---

## 二、项目结构变更

### 2.1 新目录结构

```
camforge-next/
├── crates/                      # Rust crates (新增)
│   ├── camforge-core/           # 核心计算库 (新增)
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── motion.rs        # 从 src-tauri/src/cam/ 迁移
│   │       ├── full_motion.rs
│   │       ├── profile.rs
│   │       ├── geometry.rs
│   │       └── types.rs         # 从 src-tauri/src/types/ 迁移
│   │
│   └── camforge-server/         # HTTP API 服务器 (新增)
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           ├── routes/
│           │   ├── simulation.rs
│           │   └── export.rs
│           └── error.rs
│
├── src-tauri/                   # Tauri 桌面应用 (重构)
│   ├── Cargo.toml               # 依赖 camforge-core
│   └── src/
│       ├── main.rs
│       ├── lib.rs               # 简化为 Tauri 入口
│       └── commands/            # Tauri IPC 命令 (简化)
│           └── mod.rs
│
├── src/                         # SolidJS 前端 (重构)
│   ├── api/                     # API 适配层 (新增)
│   │   ├── index.ts             # 统一 API 入口
│   │   ├── tauri.ts             # Tauri IPC 实现
│   │   └── http.ts              # HTTP API 实现
│   └── ...                      # 其他前端代码不变
│
├── Cargo.toml                   # Workspace 配置 (新增)
├── Dockerfile                   # Docker 部署 (新增)
└── docker-compose.yml           # Docker Compose (新增)
```

### 2.2 Cargo Workspace 配置

```toml
# 根目录 Cargo.toml
[workspace]
resolver = "2"
members = [
    "crates/camforge-core",
    "crates/camforge-server",
    "src-tauri",
]

[workspace.package]
version = "0.1.2"
edition = "2021"
authors = ["CamForge Team"]

[workspace.dependencies]
# 共享依赖版本
serde = { version = "1", features = ["derive"] }
serde_json = "1"
ndarray = "0.15"
num-traits = "0.2"
rayon = "1.8"
thiserror = "1.0"
anyhow = "1.0"
```

---

## 三、分步实施计划

### 阶段 1：创建共享核心库 (camforge-core)

**目标**：将计算逻辑从 Tauri 项目中提取出来

**步骤**：

| 步骤 | 任务 | 验证方法 |
|------|------|----------|
| 1.1 | 创建 `crates/camforge-core/` 目录结构 | 目录存在 |
| 1.2 | 创建 `Cargo.toml`，配置依赖 | `cargo check` 通过 |
| 1.3 | 迁移 `types/params.rs` → `camforge-core/src/types.rs` | 编译通过 |
| 1.4 | 迁移 `cam/motion.rs` → `camforge-core/src/motion.rs` | 编译通过 |
| 1.5 | 迁移 `cam/full_motion.rs` → `camforge-core/src/full_motion.rs` | 编译通过 |
| 1.6 | 迁移 `cam/profile.rs` → `camforge-core/src/profile.rs` | 编译通过 |
| 1.7 | 迁移 `cam/geometry.rs` → `camforge-core/src/geometry.rs` | 编译通过 |
| 1.8 | 创建 `lib.rs` 导出所有模块 | `cargo test` 通过 |
| 1.9 | 添加单元测试 | 测试覆盖率 > 80% |

**验证命令**：
```bash
cd crates/camforge-core
cargo test
cargo clippy -- -D warnings
```

---

### 阶段 2：重构 Tauri 项目

**目标**：让 Tauri 项目依赖共享核心库

**步骤**：

| 步骤 | 任务 | 验证方法 |
|------|------|----------|
| 2.1 | 创建根目录 `Cargo.toml` workspace 配置 | `cargo metadata` 正常 |
| 2.2 | 修改 `src-tauri/Cargo.toml` 依赖 `camforge-core` | 编译通过 |
| 2.3 | 删除 `src-tauri/src/cam/` 目录（已迁移） | 编译通过 |
| 2.4 | 删除 `src-tauri/src/types/` 目录（已迁移） | 编译通过 |
| 2.5 | 简化 `commands/simulation.rs`，调用 core | 功能不变 |
| 2.6 | 简化 `commands/export.rs`，调用 core | 功能不变 |
| 2.7 | 运行完整测试 | `cargo test` 通过 |
| 2.8 | 构建桌面应用 | `pnpm tauri build` 成功 |

**验证命令**：
```bash
# 在项目根目录
cargo build
cargo test

# 构建桌面应用
pnpm tauri dev
# 手动测试：运行模拟、导出文件
```

---

### 阶段 3：创建 HTTP API 服务器

**目标**：创建 Axum HTTP 服务器，提供 REST API

**步骤**：

| 步骤 | 任务 | 验证方法 |
|------|------|----------|
| 3.1 | 创建 `crates/camforge-server/` 目录结构 | 目录存在 |
| 3.2 | 创建 `Cargo.toml`，添加 axum/tower 依赖 | `cargo check` 通过 |
| 3.3 | 创建 `main.rs`，启动基础 HTTP 服务器 | 访问 `http://localhost:3000/health` |
| 3.4 | 创建 `routes/simulation.rs`，实现 `/api/simulate` | POST 请求返回数据 |
| 3.5 | 创建 `routes/export.rs`，实现 `/api/export/*` | 各格式导出正常 |
| 3.6 | 添加 CORS 支持 | 前端可跨域访问 |
| 3.7 | 添加错误处理 | 错误返回正确 HTTP 状态码 |
| 3.8 | 添加 API 文档注释 | 文档生成正常 |

**API 端点设计**：

```
POST /api/simulate
  请求: CamParams JSON
  响应: SimulationData JSON

POST /api/export/dxf
  请求: { params: CamParams, include_actual: bool }
  响应: application/octet-stream (DXF 文件)

POST /api/export/csv
  请求: { params: CamParams, lang: string }
  响应: text/csv

POST /api/export/svg
  请求: { params: CamParams, lang: string }
  响应: image/svg+xml
```

**验证命令**：
```bash
cd crates/camforge-server
cargo run

# 另一个终端测试
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"delta_0":90,"delta_01":30,"delta_ret":90,"delta_02":150,"h":10,"r_0":40,"e":0,"omega":10,"r_r":5,"n_points":360,"alpha_threshold":30,"tc_law":5,"hc_law":6,"sn":1,"pz":1}'
```

---

### 阶段 4：创建前端 API 适配层

**目标**：前端自动检测环境，选择正确的 API 实现

**步骤**：

| 步骤 | 任务 | 验证方法 |
|------|------|----------|
| 4.1 | 创建 `src/api/index.ts` 统一接口定义 | TypeScript 编译通过 |
| 4.2 | 重构 `src/api/tauri.ts` 实现 Tauri IPC | 桌面应用功能正常 |
| 4.3 | 创建 `src/api/http.ts` 实现 HTTP API | Web 模式功能正常 |
| 4.4 | 修改 `src/stores/simulation.ts` 使用适配层 | 编译通过 |
| 4.5 | 添加环境检测逻辑 | 自动切换正确 |
| 4.6 | 添加 API 超时和重试机制 | 网络异常处理正常 |

**API 适配层接口**：

```typescript
// src/api/index.ts
export interface CamApi {
  runSimulation(params: CamParams): Promise<SimulationData>;
  exportDxf(params: CamParams, includeActual: boolean): Promise<Blob>;
  exportCsv(params: CamParams, lang: string): Promise<string>;
  exportSvg(params: CamParams, lang: string): Promise<string>;
  exportExcel(params: CamParams, lang: string): Promise<Blob>;
  exportGif(params: CamParams, lang: string, onProgress?: (p: number) => void): Promise<Blob>;
}

// 自动选择实现
export function getApi(): CamApi {
  return isTauriEnv() ? new TauriApi() : new HttpApi();
}
```

**验证命令**：
```bash
# 桌面模式测试
pnpm tauri dev

# Web 模式测试 (需要先启动 server)
cd crates/camforge-server && cargo run &
pnpm dev
```

---

### 阶段 5：Docker 部署支持

**目标**：支持 Docker 一键部署 Web 服务

**步骤**：

| 步骤 | 任务 | 验证方法 |
|------|------|----------|
| 5.1 | 创建 `Dockerfile` 多阶段构建 | `docker build` 成功 |
| 5.2 | 创建 `docker-compose.yml` | `docker-compose up` 成功 |
| 5.3 | 创建 `.dockerignore` | 构建上下文优化 |
| 5.4 | 添加健康检查配置 | `docker ps` 显示 healthy |
| 5.5 | 编写部署文档 | 文档清晰完整 |

**Dockerfile 示例**：

```dockerfile
# 阶段 1: 构建后端
FROM rust:1.75-alpine AS backend-builder
WORKDIR /app
COPY crates/camforge-core ./crates/camforge-core
COPY crates/camforge-server ./crates/camforge-server
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release -p camforge-server

# 阶段 2: 构建前端
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY src ./src
COPY public ./public
COPY index.html ./
RUN pnpm build

# 阶段 3: 运行时镜像
FROM alpine:3.19
WORKDIR /app
COPY --from=backend-builder /app/target/release/camforge-server ./server
COPY --from=frontend-builder /app/dist ./static
EXPOSE 3000
CMD ["./server"]
```

**验证命令**：
```bash
docker build -t camforge-next .
docker run -p 3000:3000 camforge-next
curl http://localhost:3000/health
```

---

## 四、风险评估与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| Tauri 功能回归 | 高 | 中 | 每步验证，保留完整测试 |
| 性能下降 | 中 | 低 | Benchmark 对比 |
| 类型不一致 | 中 | 中 | 共享类型定义 |
| 部署复杂度增加 | 低 | 高 | 提供详细文档 |

---

## 五、验收标准

### 5.1 阶段 1 验收
- [ ] `camforge-core` 编译通过
- [ ] 所有单元测试通过
- [ ] 无 clippy 警告

### 5.2 阶段 2 验收
- [ ] 桌面应用编译通过
- [ ] 所有功能正常（模拟、导出、动画）
- [ ] 构建产物大小无明显增加

### 5.3 阶段 3 验收
- [ ] HTTP 服务器启动正常
- [ ] 所有 API 端点响应正确
- [ ] CORS 配置正确

### 5.4 阶段 4 验收
- [ ] 桌面模式功能完整
- [ ] Web 模式功能完整
- [ ] 自动环境检测正确

### 5.5 阶段 5 验收
- [ ] Docker 镜像构建成功
- [ ] 容器运行正常
- [ ] 部署文档完整

---

## 六、时间估算

| 阶段 | 预计时间 | 说明 |
|------|----------|------|
| 阶段 1 | 2-3 小时 | 代码迁移，相对机械 |
| 阶段 2 | 1-2 小时 | 依赖调整，验证为主 |
| 阶段 3 | 3-4 小时 | 新代码编写 |
| 阶段 4 | 2-3 小时 | 前端重构 |
| 阶段 5 | 1-2 小时 | Docker 配置 |
| **总计** | **9-14 小时** | 可分多天完成 |

---

## 七、后续优化方向

完成本次改造后，可考虑：

1. **API 版本控制**：`/api/v1/simulate`
2. **WebSocket 支持**：实时推送计算进度
3. **批量任务队列**：支持批量模拟
4. **用户认证**：多用户支持
5. **结果缓存**：相同参数复用结果
