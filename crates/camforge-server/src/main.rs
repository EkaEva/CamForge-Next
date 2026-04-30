//! CamForge HTTP API 服务器
//!
//! 提供 REST API 供 Web 前端调用

use axum::{
    routing::{get, post},
    Router,
    http::{HeaderValue, Method, header::CONTENT_TYPE},
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;
use tower_http::limit::RequestBodyLimitLayer;
use std::env;

mod routes;
mod error;

use routes::{simulate, export_dxf, export_csv, export_svg, health};

/// 构建 CORS 层，支持环境变量配置白名单
fn build_cors_layer() -> CorsLayer {
    let allowed_origins = env::var("CORS_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://localhost:5173,http://localhost:1420".to_string());

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
    let allowed: Vec<HeaderValue> = origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(allowed)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([CONTENT_TYPE])
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
        .layer(cors)
        .layer(RequestBodyLimitLayer::new(1024 * 1024)); // 1MB limit

    // 启动服务器
    let port = env::var("SERVER_PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();

    println!("CamForge server running at http://{}", addr);
    println!("CORS allowed origins: {}", env::var("CORS_ORIGINS").unwrap_or_else(|_| "default (localhost only)".to_string()));
    println!("API endpoints:");
    println!("  POST /api/simulate    - Run cam simulation");
    println!("  POST /api/export/dxf  - Export DXF file");
    println!("  POST /api/export/csv  - Export CSV file");
    println!("  POST /api/export/svg  - Export SVG file");
    println!("  GET  /health          - Health check");

    axum::serve(listener, app).await.unwrap();
}