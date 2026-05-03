//! 模拟命令模块
//!
//! 提供运行模拟、获取帧数据等 IPC 命令

use std::sync::Mutex;
use tauri::State;

// 使用 camforge-core 的类型和函数
use camforge_core::{
    compute_cam_profile, compute_curvature_radius, compute_flat_faced_pressure_angle,
    compute_flat_faced_profile, compute_full_motion, compute_oscillating_flat_faced_profile,
    compute_oscillating_pressure_angle, compute_oscillating_profile, compute_pressure_angle,
    compute_roller_profile, compute_rotated_cam, CamParams, FollowerType, FrameData,
    SimulationData,
};

/// 常量：度转弧度
const DEG2RAD: f64 = std::f64::consts::PI / 180.0;

/// 共享模拟状态
///
/// Lock ordering contract: `data` must always be acquired BEFORE `params`.
/// Reversing this order will cause a deadlock with `get_frame_data`.
pub struct SimState {
    /// 模拟数据 — lock FIRST
    pub data: Mutex<Option<SimulationData>>,
    /// 参数 — lock SECOND
    pub params: Mutex<Option<CamParams>>,
}

impl Default for SimState {
    fn default() -> Self {
        Self {
            data: Mutex::new(None),
            params: Mutex::new(None),
        }
    }
}

/// 运行完整模拟
///
/// 计算凸轮一整圈运动的所有数据
#[tauri::command]
pub fn run_simulation(params: CamParams, state: State<SimState>) -> Result<SimulationData, String> {
    // Validate all parameters upfront
    params.validate()?;
    // 1. 计算运动规律
    let motion = compute_full_motion(&params)?;

    // 2. 根据从动件类型计算轮廓和几何特性
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
            let result = compute_flat_faced_profile(
                &motion.s,
                &motion.ds_ddelta,
                params.r_0,
                params.e,
                params.sn,
                params.pz,
                params.flat_face_offset,
            )?;
            let alpha = compute_flat_faced_pressure_angle(motion.s.len());
            (result.x_theory, result.y_theory, result.x_actual, result.y_actual, result.s_0, alpha)
        }
        FollowerType::OscillatingRoller => {
            let osc = compute_oscillating_profile(
                &motion.s,
                params.arm_length,
                params.pivot_distance,
                params.initial_angle,
                params.sn,
            )?;
            let (xa, ya) = compute_roller_profile(&osc.x_theory, &osc.y_theory, params.r_r, params.sn)?;
            let alpha = compute_oscillating_pressure_angle(
                &motion.s,
                &motion.ds_ddelta,
                params.arm_length,
                params.pivot_distance,
                params.initial_angle,
            )?;
            // s_0 for oscillating: distance from cam center to roller at rest
            let s0 = (params.pivot_distance.powi(2) + params.arm_length.powi(2)
                - 2.0
                    * params.pivot_distance
                    * params.arm_length
                    * (params.initial_angle * DEG2RAD).cos())
            .sqrt();
            (osc.x_theory, osc.y_theory, xa, ya, s0, alpha)
        }
        FollowerType::OscillatingFlatFaced => {
            let osc = compute_oscillating_flat_faced_profile(
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
            (osc.x_theory, osc.y_theory, osc.x_actual, osc.y_actual, s0, alpha)
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
        // 尖底从动件，实际轮廓即理论轮廓
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

    // 构建结果
    let has_non_finite =
        motion.s.iter().any(|v| !v.is_finite()) || x.iter().any(|v| !v.is_finite());
    let sim_data = SimulationData {
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

    // 存储状态
    *state
        .data
        .lock()
        .map_err(|e| format!("State lock poisoned: {}", e))? = Some(sim_data.clone());
    *state
        .params
        .lock()
        .map_err(|e| format!("State lock poisoned: {}", e))? = Some(params);

    Ok(sim_data)
}

/// 获取动画帧数据
///
/// 计算单帧动画所需的全部数据
///
/// 直接法动画：凸轮旋转，从动件固定。
/// 摆动从动件的接触点通过运动学直接计算（枢轴固定 + 臂角 δ₀+ψ），
/// 而非从旋转后的轮廓上取点（反转法轮廓不能简单旋转得到正确的滚子中心位置）。
#[tauri::command]
pub fn get_frame_data(frame_idx: usize, state: State<SimState>) -> Result<FrameData, String> {
    // Clone data under lock, then release before computing.
    // This avoids holding both Mutex locks during expensive calculations
    // (profile rotation, oscillating geometry, tangent/normal computation).
    let (data, params) = {
        let data_guard = state
            .data
            .lock()
            .map_err(|e| format!("State lock poisoned: {}", e))?;
        let params_guard = state
            .params
            .lock()
            .map_err(|e| format!("State lock poisoned: {}", e))?;

        let data = data_guard
            .as_ref()
            .ok_or("No simulation data available. Run simulation first.")?
            .clone();
        let params = params_guard
            .as_ref()
            .ok_or("No parameters available. Run simulation first.")?
            .clone();

        (data, params)
        // Guards dropped here — locks released before computation begins
    };

    if frame_idx >= data.s.len() {
        return Err(format!(
            "Frame index {} out of range [0, {})",
            frame_idx,
            data.s.len()
        ));
    }

    let n = data.s.len();
    let sn_f = params.sn as f64;
    let pz_f = params.pz as f64;

    // 推杆固定 X 坐标（反转法）
    let follower_x = -sn_f * pz_f * params.e;

    // 旋转凸轮轮廓
    let angle_deg = frame_idx as f64 * 360.0 / n as f64;
    let angle_rad = if params.sn == 1 {
        -angle_deg * DEG2RAD
    } else {
        angle_deg * DEG2RAD
    };
    let (x_rot, y_rot) = compute_rotated_cam(&data.x, &data.y, angle_rad);

    // 判断从动件类型
    let is_oscillating = matches!(
        params.follower_type,
        FollowerType::OscillatingRoller | FollowerType::OscillatingFlatFaced
    );

    // 接触点坐标和摆动几何
    let (contact_x, contact_y, pivot_x, pivot_y, arm_angle) = if is_oscillating {
        // 直接法：凸轮旋转，枢轴固定
        // 通过运动学直接计算接触点
        let gamma_rad = params.gamma * DEG2RAD;
        let px = -params.pivot_distance * gamma_rad.cos();
        let py = -params.pivot_distance * gamma_rad.sin();

        // 臂角 = 初始角 + 角位移 ψ = s/L
        let delta0_rad = params.initial_angle * DEG2RAD;
        let psi_i = data.s[frame_idx] / params.arm_length;
        let arm_angle_rad = delta0_rad + psi_i;

        // 臂端点 / 滚子中心
        let cx = px + params.arm_length * arm_angle_rad.cos();
        let cy = py + params.arm_length * arm_angle_rad.sin();

        (cx, cy, px, py, arm_angle_rad)
    } else if params.follower_type == FollowerType::TranslatingFlatFaced {
        // 直动平底：接触点在平底上偏置 ds/dδ 处（不在从动件轴线上）
        let cx = follower_x + data.ds_ddelta[frame_idx];
        (cx, data.s_0 + data.s[frame_idx], 0.0, 0.0, 0.0)
    } else {
        // 直动滚子/尖底：接触点在推杆轴上
        (follower_x, data.s_0 + data.s[frame_idx], 0.0, 0.0, 0.0)
    };

    // 计算切线/法线方向
    let i_prev = if frame_idx == 0 { n - 1 } else { frame_idx - 1 };
    let i_next = if frame_idx == n - 1 { 0 } else { frame_idx + 1 };
    let mut tx = x_rot[i_next] - x_rot[i_prev];
    let mut ty = y_rot[i_next] - y_rot[i_prev];

    let len_t = (tx.powi(2) + ty.powi(2)).sqrt();
    if len_t > 1e-10 {
        tx /= len_t;
        ty /= len_t;
    } else {
        tx = 1.0;
        ty = 0.0;
    }

    // 法线方向
    let nx1 = -ty;
    let ny1 = tx;
    let nx2 = ty;
    let ny2 = -tx;

    // 选择指向凸轮中心 (0, 0) 的法线
    let dot1 = (0.0 - contact_x) * nx1 + (0.0 - contact_y) * ny1;
    let (nx, ny) = if dot1 > 0.0 { (nx1, ny1) } else { (nx2, ny2) };

    Ok(FrameData {
        follower_x,
        contact_x,
        contact_y,
        pivot_x,
        pivot_y,
        arm_angle,
        nx,
        ny,
        tx,
        ty,
        alpha_i: data.alpha_all[frame_idx].abs(),
        s_i: data.s[frame_idx],
        ds_ddelta_i: data.ds_ddelta[frame_idx],
        x_rot,
        y_rot,
    })
}
