# CamForge User Guide | CamForge 用户指南

> CamForge is a cam mechanism kinematics simulator. Design cam profiles, analyze motion laws, and export results in multiple formats.

## Installation | 安装

### Desktop App (Recommended) | 桌面应用（推荐）

Download the latest release from [GitHub Releases](https://github.com/EkaEva/CamForge/releases):

| Platform | File | Notes |
|----------|------|-------|
| Windows | `CamForge_x.y.z_x64-setup.exe` | NSIS installer |
| macOS | `CamForge_x.y.z_x64.dmg` | Intel |
| macOS | `CamForge_x.y.z_aarch64.dmg` | Apple Silicon |
| Linux | `CamForge_x.y.z_amd64.deb` | Debian/Ubuntu |

### Web Mode | Web 模式

Access the deployed instance at `https://camforge.yneko.com` or run locally:

```bash
git clone https://github.com/EkaEva/CamForge.git
cd CamForge
pnpm install
cargo run -p camforge-server --release
# Server starts at http://localhost:3000
```

### Build from Source | 从源码构建

```bash
# Prerequisites: Node.js 18+, pnpm 8+, Rust 1.70+
pnpm install
pnpm tauri dev        # Development mode
pnpm tauri build      # Production build
```

## Basic Operation | 基本操作

### 1. Set Parameters | 设置参数

Use the left sidebar to configure cam design parameters:

**Motion Parameters (运动参数)**:
- **Motion law** (推程/回程运动规律): Choose from 6 standard laws:
  - Constant Velocity (等速运动)
  - Constant Acceleration (等加速等减速)
  - Simple Harmonic (简谐运动)
  - Cycloidal (摆线运动)
  - 3-4-5 Polynomial (3-4-5 多项式)
  - 4-5-6-7 Polynomial (4-5-6-7 多项式)
- **Rise angle** (推程运动角 delta_0)
- **Far dwell angle** (远休止角 delta_01)
- **Return angle** (回程运动角 delta_ret)
- **Near dwell angle** (近休止角 delta_02)
- **Stroke** (推杆最大位移 h, mm)
- **Cam angular velocity** (角速度 omega, rad/s)

**Geometry Parameters (几何参数)**:
- **Base circle radius** (基圆半径 r_0, mm)
- **Offset** (偏距 e, mm)
- **Roller radius** (滚子半径 r_r, mm) — for roller followers only
- **Follower type** (从动件类型):
  1. Translating Knife-Edge (直动尖底)
  2. Translating Roller (直动滚子)
  3. Translating Flat-Faced (直动平底)
  4. Oscillating Roller (摆动滚子)
  5. Oscillating Flat-Faced (摆动平底)

Parameters are validated automatically. Angle sum must equal 360 degrees (within 0.01 degree tolerance).

### 2. Run Simulation | 运行仿真

Simulation runs automatically when parameters change. In desktop mode, computation is performed by the Rust backend via Tauri IPC. In web mode, it uses the HTTP API. Both call the same `camforge-core` computation engine.

### 3. View Results | 查看结果

The main canvas displays four panels:

| Panel | Content |
|-------|---------|
| **Motion Curves** (运动曲线) | Displacement s, velocity v, acceleration a vs cam angle |
| **Pressure Angle** (压力角) | Pressure angle alpha vs cam angle, with threshold line |
| **Curvature Radius** (曲率半径) | Theoretical/actual curvature radius rho vs cam angle |
| **Cam Animation** (凸轮动画) | Animated cam rotation with follower motion, interactive zoom/pan |

**Animation Controls**:
- Play/Pause: `Space` or click the play button
- Step forward/backward: `Right Arrow` / `Left Arrow`
- Speed: adjust via slider (0.1x - 5x)
- Zoom: mouse wheel or pinch gesture
- Pan: click and drag

**Display Options** (in sidebar): Toggle tangent, normal, pressure arc, center line, base circle, offset circle, limit lines, nodes, phase boundaries.

### 4. Export Results | 导出结果

Switch to the Export tab to export simulation results:

**Vector Formats**:
- **SVG** — Scalable vector graphic of the cam profile with charts
- **DXF** — CAD-compatible drawing exchange format (with optional actual profile for roller followers)

**Raster Formats**:
- **PNG** — High-resolution rasterized charts (configurable DPI, up to 600)
- **TIFF** — Lossless raster format for print-quality output

**Data Formats**:
- **CSV** — Comma-separated values with all computed data columns (displacement, velocity, acceleration, coordinates, pressure angle, curvature radius)
- **Excel** (.xlsx) — Formatted spreadsheet with data and parameters

**Animation Formats**:
- **GIF** — Animated cam rotation with follower motion

In desktop mode, exports are saved to your Downloads folder (or a custom directory configured in Settings). A save dialog is available for one-click exports. In web mode, files download via the browser.

## Keyboard Shortcuts | 键盘快捷键

| Shortcut | Action | 操作 |
|----------|--------|------|
| `Ctrl+Z` | Undo parameter change | 撤销参数修改 |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo parameter change | 重做参数修改 |
| `Space` | Play / Pause animation | 播放/暂停动画 |
| `Right Arrow` | Step animation forward | 动画步进前进 |
| `Left Arrow` | Step animation backward | 动画步进后退 |

> Shortcuts are disabled when a text input is focused.

## Supported Export Formats | 支持的导出格式

| Format | Extension | Content | Mode |
|--------|-----------|---------|------|
| DXF | `.dxf` | Cam profile contour (CAD-ready) | Desktop + Web |
| SVG | `.svg` | Cam profile with charts (scalable) | Desktop + Web |
| CSV | `.csv` | Full numerical data table | Desktop + Web |
| Excel | `.xlsx` | Formatted data + parameters | Desktop + Web |
| PNG | `.png` | Rasterized charts (up to 600 DPI) | Desktop + Web |
| TIFF | `.tiff` | Lossless raster (print quality) | Desktop + Web |
| GIF | `.gif` | Animated cam rotation | Desktop + Web |

## Presets | 预设

The sidebar includes a Preset Manager (预设管理) where you can:
- Load built-in example configurations
- Save current parameters as a custom preset (stored in localStorage)
- Import/Export presets as JSON files

## Language / 语言

Switch between English and Chinese using the language toggle in the title bar. All UI labels, chart titles, and export content adjust to the selected language.

## Troubleshooting | 常见问题

| Problem | Solution |
|---------|----------|
| "Angles must sum to 360 degrees" | Adjust delta_0, delta_01, delta_ret, delta_02 so they sum to 360 |
| Flat-faced follower shows concave region warning | Increase base circle radius or decrease stroke; flat-faced followers require convex cam profiles |
| Canvas appears blank | Ensure parameters are valid and simulation has completed; check browser console for errors |
| Export file is empty | Simulation data may not be ready; wait for computation to finish before exporting |
| Desktop app won't start on Linux | Ensure WebKitGTK is installed: `sudo apt install libwebkit2gtk-4.1-dev` |

## More Information | 更多信息

- Architecture: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- Contributing: [CONTRIBUTING.md](../CONTRIBUTING.md)
- Testing: [docs/TESTING.md](TESTING.md)
- Algorithms: [docs/ALGORITHMS.md](ALGORITHMS.md)
