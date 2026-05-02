//! 模拟 API 路由

use crate::error::ApiError;
use axum::Json;
use camforge_core::{
    compute_cam_profile, compute_curvature_radius, compute_flat_faced_pressure_angle,
    compute_flat_faced_profile, compute_full_motion, compute_oscillating_flat_faced_profile,
    compute_oscillating_pressure_angle, compute_oscillating_profile, compute_pressure_angle,
    compute_roller_profile, compute_rotated_cam, CamParams, FollowerType, SimulationData,
};

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
    params.validate().map_err(ApiError::BadRequest)?;

    // 1. 计算运动规律
    let motion = compute_full_motion(&params)?;

    // 2. 根据从动件类型计算轮廓和几何特性
    const DEG2RAD: f64 = std::f64::consts::PI / 180.0;
    let (x, y, x_actual, y_actual, s_0, alpha_all) = match params.follower_type {
        FollowerType::TranslatingKnifeEdge | FollowerType::TranslatingRoller => {
            let profile =
                compute_cam_profile(&motion.s, params.r_0, params.e, params.sn, params.pz)?;
            let (xa, ya) = compute_roller_profile(&profile.x, &profile.y, params.r_r, params.sn)?;
            let alpha = compute_pressure_angle(
                &motion.s,
                &motion.ds_ddelta,
                profile.s_0,
                params.e,
                params.pz,
            )?;
            (profile.x, profile.y, xa, ya, profile.s_0, alpha)
        }
        FollowerType::TranslatingFlatFaced => {
            let (xt, yt, xa, ya, s0) = compute_flat_faced_profile(
                &motion.s,
                &motion.ds_ddelta,
                params.r_0,
                params.e,
                params.sn,
                params.pz,
                params.flat_face_offset,
            )?;
            let alpha = compute_flat_faced_pressure_angle(motion.s.len());
            (xt, yt, xa, ya, s0, alpha)
        }
        FollowerType::OscillatingRoller => {
            let (xt, yt) = compute_oscillating_profile(
                &motion.s,
                params.arm_length,
                params.pivot_distance,
                params.initial_angle,
                params.sn,
            )?;
            let (xa, ya) = compute_roller_profile(&xt, &yt, params.r_r, params.sn)?;
            let alpha = compute_oscillating_pressure_angle(
                &motion.s,
                &motion.ds_ddelta,
                params.arm_length,
                params.pivot_distance,
                params.initial_angle,
            )?;
            let s0 = (params.pivot_distance.powi(2) + params.arm_length.powi(2)
                - 2.0
                    * params.pivot_distance
                    * params.arm_length
                    * (params.initial_angle * DEG2RAD).cos())
            .sqrt();
            (xt, yt, xa, ya, s0, alpha)
        }
        FollowerType::OscillatingFlatFaced => {
            let (xt, yt, xa, ya) = compute_oscillating_flat_faced_profile(
                &motion.s,
                &motion.ds_ddelta,
                params.arm_length,
                params.pivot_distance,
                params.initial_angle,
                params.sn,
                params.flat_face_offset,
            )?;
            let alpha = compute_flat_faced_pressure_angle(motion.s.len());
            let s0 = (params.pivot_distance.powi(2) + params.arm_length.powi(2)
                - 2.0
                    * params.pivot_distance
                    * params.arm_length
                    * (params.initial_angle * DEG2RAD).cos())
            .sqrt();
            (xt, yt, xa, ya, s0, alpha)
        }
    };

    // 2.5 摆动从动件：应用安装偏角 gamma 旋转轮廓
    // gamma 不改变轮廓形状，只改变朝向；压力角是旋转不变量
    let (x, y, x_actual, y_actual) =
        if params.follower_type.is_oscillating() && params.gamma.abs() > 1e-10 {
            let gamma_rad = params.gamma * DEG2RAD;
            let (rx, ry) = compute_rotated_cam(&x, &y, gamma_rad);
            let (rxa, rya) = compute_rotated_cam(&x_actual, &y_actual, gamma_rad);
            (rx, ry, rxa, rya)
        } else {
            (x, y, x_actual, y_actual)
        };

    // 3. 计算曲率半径
    let rho = compute_curvature_radius(&x, &y)?;

    // 4. 计算实际轮廓曲率半径
    let rho_actual: Vec<f64> = if params.r_r > 0.0 {
        rho.iter()
            .map(|r| {
                if r.is_finite() {
                    r - r.signum() * params.r_r
                } else {
                    f64::INFINITY
                }
            })
            .collect()
    } else {
        rho.clone()
    };

    // 5. 计算派生值
    let r_max = x
        .iter()
        .zip(y.iter())
        .map(|(x, y)| (x.powi(2) + y.powi(2)).sqrt())
        .fold(0.0, f64::max);

    let max_alpha = alpha_all.iter().map(|a| a.abs()).fold(0.0, f64::max);

    // 找最小曲率半径（理论轮廓）
    let (min_rho, min_rho_idx) = rho
        .iter()
        .enumerate()
        .filter(|(_, &r)| r.is_finite())
        .min_by(|a, b| {
            a.1.abs()
                .partial_cmp(&b.1.abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(i, &r)| (Some(r.abs()), i))
        .unwrap_or((None, 0));

    // 找最小曲率半径（实际轮廓）
    let (min_rho_actual, min_rho_actual_idx) = rho_actual
        .iter()
        .enumerate()
        .filter(|(_, &r)| r.is_finite())
        .min_by(|a, b| {
            a.1.abs()
                .partial_cmp(&b.1.abs())
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(i, &r)| (Some(r.abs()), i))
        .unwrap_or((None, 0));

    // 凸性检测：理论轮廓曲率半径是否全为正
    let has_concave = rho.iter().any(|&r| r < 0.0 && r.is_finite());

    // 平底最小半宽 = max(|ds/ddelta|)
    let flat_face_min_hw = motion
        .ds_ddelta
        .iter()
        .map(|v| (v - params.flat_face_offset).abs())
        .fold(0.0_f64, f64::max);

    let has_non_finite =
        motion.s.iter().any(|v| !v.is_finite()) || x.iter().any(|v| !v.is_finite());
    let data = SimulationData {
        delta_deg: motion.delta_deg,
        s: motion.s,
        v: motion.v,
        a: motion.a,
        ds_ddelta: motion.ds_ddelta,
        phase_bounds: motion.phase_bounds,
        x,
        y,
        x_actual,
        y_actual,
        rho,
        rho_actual,
        alpha_all,
        s_0,
        r_max,
        max_alpha,
        min_rho,
        min_rho_idx,
        min_rho_actual,
        min_rho_actual_idx,
        h: params.h,
        has_concave_region: has_concave,
        flat_face_min_half_width: flat_face_min_hw,
        computation_error: if has_non_finite {
            Some("Simulation produced non-finite values".to_string())
        } else {
            None
        },
    };

    Ok(Json(SimulateResponse { data }))
}
