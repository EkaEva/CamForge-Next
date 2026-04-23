# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.1.2]: https://github.com/EkaEva/CamForge-Next/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/EkaEva/CamForge-Next/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/EkaEva/CamForge-Next/releases/tag/v0.1.0
