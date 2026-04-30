//! 导出 API 路由

use axum::{
    body::Body,
    http::{header, Response, StatusCode},
    Json,
};
use camforge_core::{CamParams, compute_full_motion, compute_cam_profile, compute_roller_profile, compute_pressure_angle, compute_curvature_radius};
use crate::error::ApiError;

/// 导出请求
#[derive(serde::Deserialize)]
pub struct ExportRequest {
    params: CamParams,
    #[serde(default)]
    lang: Option<String>,
    #[serde(default)]
    include_actual: Option<bool>,
}

/// 导出 DXF 文件
pub async fn export_dxf(
    Json(req): Json<ExportRequest>,
) -> Result<Response<Body>, ApiError> {
    let params = req.params;
    params.validate().map_err(|e| ApiError::BadRequest(e))?;

    // 计算数据
    let motion = compute_full_motion(&params)?;
    let profile = compute_cam_profile(&motion.s, params.r_0, params.e, params.sn, params.pz)?;
    let (x_actual, y_actual) = compute_roller_profile(&profile.x, &profile.y, params.r_r, params.sn)?;

    // 生成 DXF
    let include_actual = req.include_actual.unwrap_or(true) && params.r_r > 0.0;
    let dxf = generate_dxf_content(&profile.x, &profile.y, &x_actual, &y_actual, include_actual);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(header::CONTENT_DISPOSITION, "attachment; filename=\"cam_profile.dxf\"")
        .body(Body::from(dxf))
        .map_err(|e| ApiError::Internal(e.to_string()))?)
}

/// 导出 CSV 文件
pub async fn export_csv(
    Json(req): Json<ExportRequest>,
) -> Result<Response<Body>, ApiError> {
    let params = req.params;
    params.validate().map_err(|e| ApiError::BadRequest(e))?;

    let lang = req.lang.unwrap_or_else(|| "zh".to_string());

    // 计算数据
    let motion = compute_full_motion(&params)?;
    let profile = compute_cam_profile(&motion.s, params.r_0, params.e, params.sn, params.pz)?;
    let rho = compute_curvature_radius(&profile.x, &profile.y)?;
    let alpha_all = compute_pressure_angle(&motion.s, &motion.ds_ddelta, profile.s_0, params.e, params.pz)?;

    // 计算实际轮廓曲率半径
    let rho_actual: Vec<f64> = if params.r_r > 0.0 {
        rho.iter().map(|r| {
            if r.is_finite() { r - r.signum() * params.r_r } else { f64::INFINITY }
        }).collect()
    } else {
        rho.clone()
    };

    let csv = generate_csv_content(
        &motion.delta_deg,
        &profile.x, &profile.y,
        &motion.s, &motion.v, &motion.a,
        &rho, &rho_actual, &alpha_all,
        &params, &lang,
    );

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/csv; charset=utf-8")
        .header(header::CONTENT_DISPOSITION, "attachment; filename=\"cam_data.csv\"")
        .body(Body::from(csv))
        .map_err(|e| ApiError::Internal(e.to_string()))?)
}

/// 导出 SVG 文件
pub async fn export_svg(
    Json(req): Json<ExportRequest>,
) -> Result<Response<Body>, ApiError> {
    let params = req.params;
    params.validate().map_err(|e| ApiError::BadRequest(e))?;

    // SVG 生成需要前端实现，这里返回提示
    let msg = r#"{"error": "SVG export requires frontend rendering. Use the desktop app or implement SVG generation in Rust."}"#;

    Ok(Response::builder()
        .status(StatusCode::NOT_IMPLEMENTED)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(msg))
        .map_err(|e| ApiError::Internal(e.to_string()))?)
}

// ===== 辅助函数 =====

fn generate_dxf_content(
    x: &[f64],
    y: &[f64],
    x_actual: &[f64],
    y_actual: &[f64],
    include_actual: bool,
) -> String {
    let mut lines: Vec<String> = Vec::new();

    // DXF Header
    lines.push("0".to_string());
    lines.push("SECTION".to_string());
    lines.push("2".to_string());
    lines.push("HEADER".to_string());
    lines.push("9".to_string());
    lines.push("$INSUNITS".to_string());
    lines.push("70".to_string());
    lines.push("4".to_string());
    lines.push("0".to_string());
    lines.push("ENDSEC".to_string());

    // Tables Section
    lines.push("0".to_string());
    lines.push("SECTION".to_string());
    lines.push("2".to_string());
    lines.push("TABLES".to_string());
    lines.push("0".to_string());
    lines.push("TABLE".to_string());
    lines.push("2".to_string());
    lines.push("LAYER".to_string());
    lines.push("70".to_string());
    lines.push("2".to_string());

    // Theory layer
    lines.push("0".to_string());
    lines.push("LAYER".to_string());
    lines.push("2".to_string());
    lines.push("CAM_THEORY".to_string());
    lines.push("70".to_string());
    lines.push("0".to_string());
    lines.push("62".to_string());
    lines.push("1".to_string());

    // Actual layer
    if include_actual {
        lines.push("0".to_string());
        lines.push("LAYER".to_string());
        lines.push("2".to_string());
        lines.push("CAM_ACTUAL".to_string());
        lines.push("70".to_string());
        lines.push("0".to_string());
        lines.push("62".to_string());
        lines.push("5".to_string());
    }

    lines.push("0".to_string());
    lines.push("ENDTAB".to_string());
    lines.push("0".to_string());
    lines.push("ENDSEC".to_string());

    // Entities Section
    lines.push("0".to_string());
    lines.push("SECTION".to_string());
    lines.push("2".to_string());
    lines.push("ENTITIES".to_string());

    // Theory profile polyline
    lines.push("0".to_string());
    lines.push("LWPOLYLINE".to_string());
    lines.push("8".to_string());
    lines.push("CAM_THEORY".to_string());
    lines.push("90".to_string());
    lines.push(x.len().to_string());
    lines.push("70".to_string());
    lines.push("1".to_string());

    for i in 0..x.len() {
        lines.push("10".to_string());
        lines.push(format!("{:.6}", x[i]));
        lines.push("20".to_string());
        lines.push(format!("{:.6}", y[i]));
    }

    // Actual profile polyline
    if include_actual && x_actual.len() > 0 {
        lines.push("0".to_string());
        lines.push("LWPOLYLINE".to_string());
        lines.push("8".to_string());
        lines.push("CAM_ACTUAL".to_string());
        lines.push("90".to_string());
        lines.push(x_actual.len().to_string());
        lines.push("70".to_string());
        lines.push("1".to_string());

        for i in 0..x_actual.len() {
            lines.push("10".to_string());
            lines.push(format!("{:.6}", x_actual[i]));
            lines.push("20".to_string());
            lines.push(format!("{:.6}", y_actual[i]));
        }
    }

    lines.push("0".to_string());
    lines.push("ENDSEC".to_string());
    lines.push("0".to_string());
    lines.push("EOF".to_string());

    lines.join("\n")
}

fn generate_csv_content(
    delta_deg: &[f64],
    x: &[f64],
    y: &[f64],
    s: &[f64],
    v: &[f64],
    a: &[f64],
    rho: &[f64],
    rho_actual: &[f64],
    alpha_all: &[f64],
    params: &CamParams,
    lang: &str,
) -> String {
    let mut lines: Vec<String> = Vec::new();

    // Header row
    if params.r_r > 0.0 {
        if lang == "zh" {
            lines.push("转角 δ (°),向径 R (mm),推杆位移 s (mm),推杆速度 v (mm/s),推杆加速度 a (mm/s²),理论曲率半径 ρ (mm),实际曲率半径 ρₐ (mm),压力角 α (°)".to_string());
        } else {
            lines.push("Angle δ (°),Radius R (mm),Displacement s (mm),Velocity v (mm/s),Acceleration a (mm/s²),Theory ρ (mm),Actual ρₐ (mm),Pressure Angle α (°)".to_string());
        }
    } else {
        if lang == "zh" {
            lines.push("转角 δ (°),向径 R (mm),推杆位移 s (mm),推杆速度 v (mm/s),推杆加速度 a (mm/s²),曲率半径 ρ (mm),压力角 α (°)".to_string());
        } else {
            lines.push("Angle δ (°),Radius R (mm),Displacement s (mm),Velocity v (mm/s),Acceleration a (mm/s²),Curvature ρ (mm),Pressure Angle α (°)".to_string());
        }
    }

    // Data rows with CSV-safe formatting
    for i in 0..delta_deg.len() {
        let r = (x[i].powi(2) + y[i].powi(2)).sqrt();
        let rho_val = if rho[i].is_finite() { format!("{:.4}", rho[i].abs()) } else { String::new() };
        let rho_actual_val = if rho_actual[i].is_finite() { format!("{:.4}", rho_actual[i].abs()) } else { String::new() };

        if params.r_r > 0.0 {
            lines.push(format!(
                "{:.2},{:.4},{:.4},{:.4},{:.4},{},{},{:.4}",
                delta_deg[i], r, s[i], v[i], a[i], rho_val, rho_actual_val, alpha_all[i]
            ));
        } else {
            lines.push(format!(
                "{:.2},{:.4},{:.4},{:.4},{:.4},{},{:.4}",
                delta_deg[i], r, s[i], v[i], a[i], rho_val, alpha_all[i]
            ));
        }
    }

    lines.join("\n")
}

/// Escape a CSV cell value to prevent formula injection
#[allow(dead_code)]
fn csv_escape(val: &str) -> String {
    let dangerous = ['=', '+', '-', '@', '\t', '\r'];
    if val.starts_with(dangerous) || val.contains(',') || val.contains('"') || val.contains('\n') {
        format!("\"{}\"", val.replace('"', "\"\""))
    } else {
        val.to_string()
    }
}