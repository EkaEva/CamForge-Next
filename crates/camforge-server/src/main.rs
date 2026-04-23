//! CamForge-Next HTTP API 服务器
//!
//! 提供 REST API 供 Web 前端调用

use axum::{
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

mod routes;
mod error;

use routes::{simulate, export_dxf, export_csv, export_svg, health};

#[tokio::main]
async fn main() {
    // CORS 配置，允许前端跨域访问
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

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
        .layer(cors);

    // 启动服务器
    let addr = "0.0.0.0:3000";
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    println!("CamForge-Next server running at http://{}", addr);
    println!("API endpoints:");
    println!("  POST /api/simulate    - Run cam simulation");
    println!("  POST /api/export/dxf  - Export DXF file");
    println!("  POST /api/export/csv  - Export CSV file");
    println!("  POST /api/export/svg  - Export SVG file");
    println!("  GET  /health          - Health check");

    axum::serve(listener, app).await.unwrap();
}