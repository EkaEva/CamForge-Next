//! CamForge HTTP API 服务器
//!
//! 提供 REST API 供 Web 前端调用

use axum::{
    body::Body,
    extract::Request,
    http::{header::CONTENT_TYPE, HeaderValue, Method},
    middleware,
    response::Response,
    routing::{get, post},
    Router,
};
use base64::Engine;
use rand::Rng;
use std::env;
use tower_http::cors::{Any, CorsLayer};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::services::ServeDir;

mod error;
mod routes;

use routes::{export_csv, export_dxf, export_svg, health, simulate};

/// 生成加密安全的随机 nonce（Base64 编码，16 字节）
fn generate_nonce() -> String {
    let mut rng = rand::rng();
    let mut bytes = [0u8; 16];
    rng.fill(&mut bytes);
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

/// 构建 CORS 层，支持环境变量配置白名单
fn build_cors_layer() -> CorsLayer {
    let allowed_origins = env::var("CORS_ORIGINS").unwrap_or_else(|_| {
        "http://localhost:3000,http://localhost:5173,http://localhost:1420".to_string()
    });

    let origins: Vec<&str> = allowed_origins.split(',').map(|s| s.trim()).collect();

    // 如果包含 "*"，则允许所有来源（开发模式）
    if origins.contains(&"*") {
        eprintln!("[WARN] CORS_ORIGINS=* allows any origin. Do not use in production!");
        return CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);
    }

    // 生产环境：使用白名单
    let allowed: Vec<HeaderValue> = origins.iter().filter_map(|o| o.parse().ok()).collect();

    CorsLayer::new()
        .allow_origin(allowed)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE])
}

/// 构建 CSP 策略字符串（使用 nonce 替代 'unsafe-inline'）
fn build_csp(nonce: &str) -> String {
    let default_src = "default-src 'self'";
    // script-src 使用 nonce：内联脚本（splash 动画）通过 Vite 插件注入 nonce 属性
    let script_src = format!("script-src 'self' 'nonce-{}' 'wasm-unsafe-eval'", nonce);
    // style-src: 'unsafe-inline' is required by SolidJS — its production build
    // sets styles via element.style.cssText and setAttribute("style",...),
    // which CSP treats as inline styles and blocks without 'unsafe-inline'.
    // This is a SolidJS framework constraint, not a code quality issue.
    // 字体已本地化，无需外部 CDN
    let style_src = "style-src 'self' 'unsafe-inline'";
    let img_src = "img-src 'self' data: blob:";
    let font_src = "font-src 'self' data:";
    let connect_src = "connect-src 'self'";
    let worker_src = "worker-src 'self' blob:";
    // object-src 'none' blocks Flash, Java applets, etc.
    let object_src = "object-src 'none'";
    // base-uri 'self' prevents injecting <base> tag
    let base_uri = "base-uri 'self'";
    // form-action 'self' restricts form submissions
    let form_action = "form-action 'self'";
    // frame-ancestors 'none' prevents clickjacking (equivalent to X-Frame-Options: DENY)
    let frame_ancestors = "frame-ancestors 'none'";

    [
        default_src,
        &script_src,
        style_src,
        img_src,
        font_src,
        connect_src,
        worker_src,
        object_src,
        base_uri,
        form_action,
        frame_ancestors,
    ]
    .join("; ")
}

/// 缓存控制中间件
///
/// - `index.html`: `no-cache` — 每次验证，确保用户拿到最新版本
/// - `assets/*` (Vite 带 hash 的 JS/CSS): `max-age=31536000, immutable` — 1 年强缓存
/// - 其他静态资源 (字体、splash 等): `max-age=86400` — 1 天缓存
async fn cache_control(request: Request, next: middleware::Next) -> Response<Body> {
    let path = request.uri().path().to_owned();
    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    let cache_value = if path == "/" || path == "/index.html" {
        "no-cache"
    } else if path.starts_with("/assets/") {
        "public, max-age=31536000, immutable"
    } else {
        "public, max-age=86400"
    };

    if let Ok(val) = HeaderValue::from_str(cache_value) {
        headers.insert("cache-control", val);
    }

    response
}

/// 安全响应头中间件
///
/// 为每个请求生成 nonce，注入到 HTML 响应和 CSP 头中
async fn security_headers(request: Request, next: middleware::Next) -> Response<Body> {
    // 为每个请求生成唯一 nonce
    let nonce = generate_nonce();
    let csp = build_csp(&nonce);

    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    // Content-Security-Policy（使用 nonce 替代 'unsafe-inline'）
    if let Ok(csp_value) = HeaderValue::from_str(&csp) {
        headers.insert("content-security-policy", csp_value);
    } else {
        eprintln!("[WARN] CSP header value contains invalid bytes, CSP header dropped");
    }

    // X-Content-Type-Options: 防止 MIME 嗅探
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );

    // X-Frame-Options: 防止点击劫持 (CSP frame-ancestors 已覆盖，此为兼容回退)
    headers.insert("x-frame-options", HeaderValue::from_static("DENY"));

    // Referrer-Policy: 限制 Referer 泄露
    headers.insert(
        "referrer-policy",
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );

    // Permissions-Policy: 禁用不需要的浏览器 API
    headers.insert(
        "permissions-policy",
        HeaderValue::from_static("camera=(), microphone=(), geolocation=()"),
    );

    // Strict-Transport-Security: 强制 HTTPS（1年，含子域名）
    headers.insert(
        "strict-transport-security",
        HeaderValue::from_static("max-age=31536000; includeSubDomains"),
    );

    // 将 nonce 注入到 HTML 响应中（替换占位符 __CSP_NONCE__）
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if content_type.contains("text/html") {
        let body = std::mem::replace(response.body_mut(), Body::empty());
        if let Ok(full_body) = axum::body::to_bytes(body, 1024 * 1024).await {
            if let Ok(mut html) = String::from_utf8(full_body.to_vec()) {
                html = html.replace("__CSP_NONCE__", &nonce);
                *response.body_mut() = Body::from(html);
            }
        }
    }

    response
}

#[tokio::main]
async fn main() {
    // CORS 配置，支持环境变量白名单
    let cors = build_cors_layer();

    // 构建路由
    let app = Router::new()
        // API 路由
        .route("/api/simulate", post(simulate))
        .route("/api/export/dxf", post(export_dxf))
        .route("/api/export/csv", post(export_csv))
        .route("/api/export/svg", post(export_svg))
        .route("/health", get(health))
        // 静态文件服务（前端）
        .fallback_service(ServeDir::new("static"))
        .layer(middleware::from_fn(security_headers))
        .layer(middleware::from_fn(cache_control))
        .layer(cors)
        .layer(RequestBodyLimitLayer::new(1024 * 1024)); // 1MB limit

    // 速率限制配置（每分钟最大请求数）
    // TODO: Wire into tower::limit::RateLimitLayer for actual enforcement
    let _rate_limit = env::var("RATE_LIMIT")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(60); // 默认 60 请求/分钟
    println!("Rate limit configured: {} requests/minute per IP (enforcement pending)", _rate_limit);

    // 启动服务器
    let port = env::var("SERVER_PORT").unwrap_or_else(|_| "3000".to_string());
    // 绑定 0.0.0.0 是 Docker 容器部署的必要条件——容器外部流量通过 CNI 桥接转发，若绑定
    // 127.0.0.1 则只能接受容器内回环连接，外部请求无法到达服务。生产部署应配合防火墙限制。
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| {
            eprintln!(
                "Failed to bind to {}: {}. Is the port already in use?",
                addr, e
            );
            std::process::exit(1);
        });
    println!("CamForge server running at http://{}", addr);
    println!("CSP: {}", build_csp("<per-request-nonce>"));
    println!(
        "CORS allowed origins: {}",
        env::var("CORS_ORIGINS").unwrap_or_else(|_| "default (localhost only)".to_string())
    );
    println!("API endpoints:");
    println!("  POST /api/simulate    - Run cam simulation");
    println!("  POST /api/export/dxf  - Export DXF file");
    println!("  POST /api/export/csv  - Export CSV file");
    println!("  POST /api/export/svg  - Export SVG file");
    println!("  GET  /health          - Health check");

    axum::serve(listener, app).await.unwrap_or_else(|e| {
        eprintln!("Server error: {}", e);
        std::process::exit(1);
    });
}
