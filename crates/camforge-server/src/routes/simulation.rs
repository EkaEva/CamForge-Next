//! 模拟 API 路由

use axum::Json;
use camforge_core::{CamParams, SimulationData, compute_full_motion, compute_cam_profile, compute_roller_profile, compute_pressure_angle, compute_curvature_radius};
use crate::error::ApiError;

/// 运行模拟请求
#[derive(serde::Deserialize)]
pub struct SimulateRequest {
    params: CamParams,
}

/// 运行模拟响应
#[derive(serde::Serialize)]
pub struct SimulateResponse {
    data: SimulationData,
}

/// 运行凸轮模拟
pub async fn simulate(
    Json(req): Json<SimulateRequest>,
) -> Result<Json<SimulateResponse>, ApiError> {
    let params = req.params;

    // 验证参数
    params.validate().map_err(|e| ApiError::BadRequest(e))?;

    // 1. 计算运动规律
    let motion = compute_full_motion(&params)?;

    // 2. 计算凸轮理论廓形
    let profile = compute_cam_profile(&motion.s, params.r_0, params.e, params.sn, params.pz)?;

    // 3. 计算滚子从动件实际廓形
    let (x_actual, y_actual) = compute_roller_profile(&profile.x, &profile.y, params.r_r, params.sn)?;

    // 4. 计算几何特性
    let rho = compute_curvature_radius(&profile.x, &profile.y)?;
    let alpha_all = compute_pressure_angle(&motion.s, &motion.ds_ddelta, profile.s_0, params.e, params.pz)?;

    // 5. 计算实际轮廓曲率半径（滚子从动件）
    let rho_actual: Vec<f64> = if params.r_r > 0.0 {
        rho.iter().map(|r| {
            if r.is_finite() {
                r - r.signum() * params.r_r
            } else {
                f64::INFINITY
            }
        }).collect()
    } else {
        rho.clone()
    };

    // 6. 计算派生值
    let r_max = profile.x.iter().zip(profile.y.iter())
        .map(|(x, y)| (x.powi(2) + y.powi(2)).sqrt())
        .fold(0.0, f64::max);

    let max_alpha = alpha_all.iter()
        .map(|a| a.abs())
        .fold(0.0, f64::max);

    // 找最小曲率半径（理论轮廓）
    let (min_rho, min_rho_idx) = rho.iter().enumerate()
        .filter(|(_, &r)| r.is_finite())
        .min_by(|a, b| a.1.abs().partial_cmp(&b.1.abs()).unwrap())
        .map(|(i, &r)| (Some(r.abs()), i))
        .unwrap_or((None, 0));

    // 找最小曲率半径（实际轮廓）
    let (min_rho_actual, min_rho_actual_idx) = rho_actual.iter().enumerate()
        .filter(|(_, &r)| r.is_finite())
        .min_by(|a, b| a.1.abs().partial_cmp(&b.1.abs()).unwrap())
        .map(|(i, &r)| (Some(r.abs()), i))
        .unwrap_or((None, 0));

    let data = SimulationData {
        delta_deg: motion.delta_deg,
        s: motion.s,
        v: motion.v,
        a: motion.a,
        ds_ddelta: motion.ds_ddelta,
        phase_bounds: motion.phase_bounds,
        x: profile.x,
        y: profile.y,
        x_actual,
        y_actual,
        rho,
        rho_actual,
        alpha_all,
        s_0: profile.s_0,
        r_max,
        max_alpha,
        min_rho,
        min_rho_idx,
        min_rho_actual,
        min_rho_actual_idx,
        h: params.h,
    };

    Ok(Json(SimulateResponse { data }))
}