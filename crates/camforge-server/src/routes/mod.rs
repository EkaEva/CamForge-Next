//! API 路由模块

mod simulation;
mod export;

pub use simulation::simulate;
pub use export::{export_dxf, export_csv, export_svg};

use axum::Json;
use serde_json::json;

/// 健康检查端点
pub async fn health() -> Json<serde_json::Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}