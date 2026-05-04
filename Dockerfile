# CamForge Docker 镜像
# 多阶段构建：后端 + 前端

# ============================================
# 阶段 1: 构建后端 (Rust)
# ============================================
FROM rust:1.82-alpine AS backend-builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache musl-dev

# Copy Cargo files and cache dependencies
COPY Cargo.toml Cargo.lock ./
COPY crates/camforge-core/Cargo.toml ./crates/camforge-core/
COPY crates/camforge-server/Cargo.toml ./crates/camforge-server/

# Remove src-tauri from workspace members (Docker only needs camforge-core + camforge-server)
# Uses grep -v for robustness: removes any line containing 'src-tauri'
RUN grep -v 'src-tauri' Cargo.toml > Cargo.toml.tmp && mv Cargo.toml.tmp Cargo.toml

# 创建空的 src 目录以缓存依赖
RUN mkdir -p crates/camforge-core/src crates/camforge-core/benches crates/camforge-server/src && \
    echo "fn main() {}" > crates/camforge-server/src/main.rs && \
    echo "" > crates/camforge-core/src/lib.rs && \
    echo "" > crates/camforge-core/benches/simulation_bench.rs

# 构建依赖（缓存层）
RUN cargo build --release -p camforge-server

# 复制实际源码
COPY crates/camforge-core/src ./crates/camforge-core/src
COPY crates/camforge-server/src ./crates/camforge-server/src

# 重新构建（只编译源码变更）
RUN touch crates/camforge-core/src/lib.rs && \
    cargo build --release -p camforge-server

# ============================================
# 阶段 2: 构建前端 (Node.js + pnpm)
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# 安装 pnpm
RUN npm install -g pnpm

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源码
COPY src ./src
COPY public ./public
COPY index.html ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# 构建前端
RUN pnpm build

# ============================================
# 阶段 3: 运行时镜像
# ============================================
FROM alpine:3.19

WORKDIR /app

# 安装运行时依赖
RUN apk add --no-cache ca-certificates

# Create non-root user for security
RUN addgroup -S camforge && adduser -S -G camforge camforge

# 从后端构建阶段复制可执行文件
COPY --from=backend-builder /app/target/release/camforge-server ./server

# 从前端构建阶段复制静态文件
COPY --from=frontend-builder /app/dist ./static

# Set ownership to non-root user
RUN chown -R camforge:camforge /app

# 暴露端口
EXPOSE 3000

# API Key for authentication (empty = disabled; set for production)
ENV API_KEY=""

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run as non-root user
USER camforge

# 启动服务器
CMD ["./server"]