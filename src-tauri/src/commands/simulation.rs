//! 模拟命令模块
//!
//! 提供运行模拟、获取帧数据等 IPC 命令

use std::sync::Mutex;
use tauri::State;

// 使用 camforge-core 的类型和函数
use camforge_core::{
    CamParams, SimulationData, FrameData,
    compute_full_motion, compute_cam_profile, compute_roller_profile,
    compute_pressure_angle, compute_curvature_radius, compute_rotated_cam,
};

/// 常量：度转弧度
const DEG2RAD: f64 = std::f64::consts::PI / 180.0;

/// 共享模拟状态
pub struct SimState {
    /// 模拟数据
    pub data: Mutex<Option<SimulationData>>,
    /// 参数
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

    // 2. 计算凸轮理论廓形
    let profile = compute_cam_profile(&motion.s, params.r_0, params.e, params.sn, params.pz)?;

    // 3. 计算滚子从动件实际廓形
    let (x_actual, y_actual) = compute_roller_profile(&profile.x, &profile.y, params.r_r, params.sn)?;

    // 4. 计算几何特性
    let rho = compute_curvature_radius(&profile.x, &profile.y)?;
    let alpha_all = compute_pressure_angle(&motion.s, &motion.ds_ddelta, profile.s_0, params.e, params.pz)?;

    // 5. 计算实际轮廓曲率半径（滚子从动件）
    // ρ_a = ρ - sign(ρ) * r_r
    let rho_actual: Vec<f64> = if params.r_r > 0.0 {
        rho.iter().map(|r| {
            if r.is_finite() {
                r - r.signum() * params.r_r
            } else {
                f64::INFINITY
            }
        }).collect()
    } else {
        // 尖底从动件，实际轮廓即理论轮廓
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
        .min_by(|a, b| a.1.abs().partial_cmp(&b.1.abs()).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, &r)| (Some(r.abs()), i))
        .unwrap_or((None, 0));

    // 找最小曲率半径（实际轮廓）
    let (min_rho_actual, min_rho_actual_idx) = rho_actual.iter().enumerate()
        .filter(|(_, &r)| r.is_finite())
        .min_by(|a, b| a.1.abs().partial_cmp(&b.1.abs()).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, &r)| (Some(r.abs()), i))
        .unwrap_or((None, 0));

    // 构建结果
    let sim_data = SimulationData {
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

    // 存储状态
    *state.data.lock().map_err(|e| format!("State lock poisoned: {}", e))? = Some(sim_data.clone());
    *state.params.lock().map_err(|e| format!("State lock poisoned: {}", e))? = Some(params);

    Ok(sim_data)
}

/// 获取动画帧数据
///
/// 计算单帧动画所需的全部数据
#[tauri::command]
pub fn get_frame_data(frame_idx: usize, state: State<SimState>) -> Result<FrameData, String> {
    let data_guard = state.data.lock().map_err(|e| format!("State lock poisoned: {}", e))?;
    let params_guard = state.params.lock().map_err(|e| format!("State lock poisoned: {}", e))?;

    let data = data_guard.as_ref()
        .ok_or("No simulation data available. Run simulation first.")?;
    let params = params_guard.as_ref()
        .ok_or("No parameters available. Run simulation first.")?;

    if frame_idx >= data.s.len() {
        return Err(format!("Frame index {} out of range [0, {})", frame_idx, data.s.len()));
    }

    let n = data.s.len();
    let sn_f = params.sn as f64;
    let pz_f = params.pz as f64;

    // 推杆固定 X 坐标（反转法）
    let follower_x = -sn_f * pz_f * params.e;

    // 接触点 Y 坐标
    let contact_y = data.s_0 + data.s[frame_idx];

    // 计算切线/法线方向
    let angle_deg = frame_idx as f64 * 360.0 / n as f64;
    let delta_i = angle_deg * DEG2RAD;
    let theta = -sn_f * delta_i;

    let cos_t = theta.cos();
    let sin_t = theta.sin();
    let cos_d = delta_i.cos();
    let sin_d = delta_i.sin();

    let sp = data.s_0 + data.s[frame_idx];
    let dsd = data.ds_ddelta[frame_idx];

    // 翻转前廓形导数
    let dx0 = sp * cos_d + dsd * sin_d - pz_f * params.e * sin_d;
    let dy0 = -sp * sin_d + dsd * cos_d - pz_f * params.e * cos_d;

    // 翻转后
    let dx = -sn_f * dx0;
    let dy = dy0;

    // 旋转后得到切线方向
    let mut tx = dx * cos_t - dy * sin_t;
    let mut ty = dx * sin_t + dy * cos_t;

    let len_t = (tx.powi(2) + ty.powi(2)).sqrt();
    if len_t > 1e-10 {
        tx /= len_t;
        ty /= len_t;
    } else {
        tx = 1.0;
        ty = 0.0;
    }

    // 法线方向（指向凸轮中心）
    let nx1 = -ty;
    let ny1 = tx;
    let nx2 = ty;
    let ny2 = -tx;

    // 选择指向凸轮中心 (0, 0) 的法线
    let dot1 = (0.0 - follower_x) * nx1 + (0.0 - contact_y) * ny1;
    let (nx, ny) = if dot1 > 0.0 {
        (nx1, ny1)
    } else {
        (nx2, ny2)
    };

    // 旋转凸轮轮廓
    let angle_rad = if params.sn == 1 {
        -angle_deg * DEG2RAD
    } else {
        angle_deg * DEG2RAD
    };
    let (x_rot, y_rot) = compute_rotated_cam(&data.x, &data.y, angle_rad);

    Ok(FrameData {
        follower_x,
        contact_y,
        nx,
        ny,
        tx,
        ty,
        alpha_i: data.alpha_all[frame_idx].abs(),
        s_i: data.s[frame_idx],
        x_rot,
        y_rot,
    })
}