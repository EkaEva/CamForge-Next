# CamForge-Next 部署指南

> 本文档说明如何部署 CamForge-Next 的两种模式：桌面应用和 Web 服务器

---

## 一、部署模式

CamForge-Next 支持两种部署模式：

| 模式 | 适用场景 | 技术栈 |
|------|----------|--------|
| **桌面应用** | 个人使用、离线使用 | Tauri + SolidJS |
| **Web 服务器** | 团队协作、在线演示 | Axum + SolidJS |

---

## 二、桌面应用部署

### 2.1 环境要求

- **Node.js** 18.0+
- **pnpm** 8.0+
- **Rust** 1.70+
- **Windows 10/11**（当前仅支持 Windows）

### 2.2 开发模式

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm tauri dev
```

### 2.3 构建发布

```bash
# 构建生产版本
pnpm tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录下。

---

## 三、Web 服务器部署

### 3.1 本地运行

```bash
# 构建前端
pnpm build

# 启动后端服务器
cargo run -p camforge-server

# 访问 http://localhost:3000
```

### 3.2 Docker 部署

#### 方式一：使用 Docker Compose（推荐）

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 方式二：手动构建 Docker 镜像

```bash
# 构建镜像
docker build -t camforge-next .

# 运行容器
docker run -d -p 3000:3000 --name camforge-next camforge-next

# 查看日志
docker logs -f camforge-next
```

### 3.3 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `RUST_LOG` | `info` | 日志级别 |
| `VITE_API_URL` | `http://localhost:3000` | API 地址（前端） |

### 3.4 反向代理配置

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name camforge.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 四、API 端点

Web 服务器提供以下 API 端点：

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/simulate` | POST | 运行凸轮模拟 |
| `/api/export/dxf` | POST | 导出 DXF 文件 |
| `/api/export/csv` | POST | 导出 CSV 文件 |
| `/api/export/svg` | POST | 导出 SVG 文件（未实现） |
| `/health` | GET | 健康检查 |

### 4.1 模拟请求示例

```bash
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "delta_0": 90,
      "delta_01": 60,
      "delta_ret": 120,
      "delta_02": 90,
      "h": 10,
      "r_0": 40,
      "e": 5,
      "omega": 1,
      "r_r": 5,
      "n_points": 360,
      "alpha_threshold": 30,
      "tc_law": 5,
      "hc_law": 6,
      "sn": 1,
      "pz": 1
    }
  }'
```

---

## 五、功能差异

| 功能 | 桌面应用 | Web 服务器 |
|------|:--------:|:----------:|
| 凸轮模拟 | ✅ | ✅ |
| DXF 导出 | ✅ | ✅ |
| CSV 导出 | ✅ | ✅ |
| SVG 导出 | ✅ | ❌ |
| Excel 导出 | ✅ | ❌ |
| GIF 动画 | ✅ | ❌ |
| PNG 高清导出 | ✅ | ❌ |
| 文件保存对话框 | ✅ | ❌ |

> 注：部分导出功能需要前端 Canvas 渲染，仅桌面应用支持。

---

## 六、故障排除

### 6.1 桌面应用无法启动

1. 检查 Rust 版本：`rustc --version`
2. 检查 Node.js 版本：`node --version`
3. 清理构建缓存：`cargo clean && rm -rf node_modules`

### 6.2 Web 服务器无法访问

1. 检查端口占用：`netstat -an | grep 3000`
2. 检查防火墙设置
3. 查看服务器日志

### 6.3 Docker 构建失败

1. 确保 Docker 有足够内存（至少 4GB）
2. 清理 Docker 缓存：`docker system prune -a`
3. 使用 `--no-cache` 重新构建：`docker build --no-cache -t camforge-next .`