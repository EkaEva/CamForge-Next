# 贡献指南 | Contributing Guide

感谢您有兴趣为 CamForge-Next 做出贡献！

Thank you for your interest in contributing to CamForge-Next!

## 目录 | Table of Contents

- [行为准则](#行为准则--code-of-conduct)
- [如何贡献](#如何贡献--how-to-contribute)
- [开发环境设置](#开发环境设置--development-setup)
- [项目结构](#项目结构--project-structure)
- [代码规范](#代码规范--coding-standards)
- [提交规范](#提交规范--commit-guidelines)
- [Pull Request 流程](#pull-request-流程)

---

## 行为准则 | Code of Conduct

请阅读并遵守我们的行为准则。我们致力于提供友好、安全和受欢迎的环境。

---

## 如何贡献 | How to Contribute

### 报告 Bug | Reporting Bugs

如果您发现了 Bug，请通过 [GitHub Issues](https://github.com/EkaEva/CamForge-Next/issues) 提交报告。

提交 Bug 报告时，请包含：

1. **问题描述**：清晰简洁地描述问题
2. **复现步骤**：详细的复现步骤
3. **预期行为**：您期望发生什么
4. **实际行为**：实际发生了什么
5. **截图**：如果适用，添加截图
6. **环境信息**：操作系统、版本等

### 建议新功能 | Suggesting Features

我们欢迎新功能建议！请在 Issue 中详细描述：

1. 功能描述
2. 使用场景
3. 可能的实现方式

### 提交代码 | Submitting Code

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

---

## 开发环境设置 | Development Setup

### 环境要求 | Prerequisites

- **Node.js** 18.0 或更高版本
- **pnpm** 8.0 或更高版本
- **Rust** 1.70 或更高版本
- **Windows 10/11**（当前仅支持 Windows）

### 安装步骤 | Installation Steps

```bash
# 克隆仓库
git clone https://github.com/EkaEva/CamForge-Next.git
cd CamForge-Next

# 安装前端依赖
pnpm install

# 开发模式运行
pnpm tauri dev
```

### 构建发布版本 | Build for Production

```bash
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录。

---

## 项目结构 | Project Structure

```
camforge-next/
├── src/                    # 前端源码
│   ├── components/         # UI 组件
│   ├── services/           # 业务服务层
│   ├── stores/             # 状态管理
│   ├── io/                 # I/O 抽象层
│   ├── i18n/               # 国际化
│   ├── constants/          # 常量定义
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数
├── src-tauri/              # Tauri 后端
│   ├── src/                # Rust 源码
│   │   ├── cam/            # 凸轮计算模块
│   │   ├── commands/       # Tauri 命令
│   │   └── types/          # Rust 类型定义
│   └── tauri.conf.json     # Tauri 配置
├── docs/                   # 文档
└── public/                 # 静态资源
```

详细架构说明请参阅 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

---

## 代码规范 | Coding Standards

### TypeScript

- 使用 TypeScript 严格模式
- 为所有函数添加类型注解
- 避免使用 `any` 类型
- 使用 `const` 和 `let`，避免 `var`

### Rust

- 遵循 Rust 标准命名规范
- 使用 `clippy` 进行代码检查
- 为公共函数添加文档注释

### 代码风格

- 使用 2 空格缩进
- 使用分号
- 组件使用 PascalCase
- 函数和变量使用 camelCase
- 常量使用 UPPER_SNAKE_CASE

### 注释规范

```typescript
/**
 * 计算运动规律
 * @param law - 运动规律类型
 * @param t - 归一化时间 (0-1)
 * @param h - 行程 (mm)
 * @param omega - 角速度 (rad/s)
 * @param deltaRad - 运动角 (rad)
 * @returns [位移, 速度, 加速度]
 */
export function computeMotion(
  law: MotionLaw,
  t: number,
  h: number,
  omega: number,
  deltaRad: number
): [number, number, number]
```

---

## 提交规范 | Commit Guidelines

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型 (type)

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构 |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建/工具相关 |

### 示例

```
feat(motion): add 4-5-6-7 polynomial motion law

Add support for 4-5-6-7 polynomial motion law which provides
continuous jerk for ultra-high-speed applications.

Closes #123
```

---

## Pull Request 流程

1. **确保测试通过**：运行 `pnpm test` 确保所有测试通过
2. **更新文档**：如有必要，更新 README 和相关文档
3. **添加测试**：为新功能添加测试用例
4. **描述更改**：在 PR 描述中详细说明更改内容

### PR 检查清单

- [ ] 代码遵循项目规范
- [ ] 所有测试通过
- [ ] 新功能有对应测试
- [ ] 文档已更新
- [ ] 提交信息符合规范

---

## 许可证 | License

本项目采用 MIT 许可证。提交代码即表示您同意您的贡献将在相同许可证下发布。

---

## 联系方式 | Contact

如有问题，请通过 GitHub Issues 联系我们。

感谢您的贡献！Thank you for your contribution!