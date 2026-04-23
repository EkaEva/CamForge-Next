//! 完整运动循环计算模块
//!
//! 计算凸轮一整圈运动的位移、速度、加速度

use crate::types::{CamParams, MotionLaw};

/// 常量：度转弧度
const DEG2RAD: f64 = std::f64::consts::PI / 180.0;

/// 完整运动循环计算结果
pub struct FullMotionResult {
    /// 全程转角 (度)
    pub delta_deg: Vec<f64>,
    /// 位移数组 (mm)
    pub s: Vec<f64>,
    /// 速度数组 (mm/s)
    pub v: Vec<f64>,
    /// 加速度数组 (mm/s²)
    pub a: Vec<f64>,
    /// 位移对转角的解析导数 ds/dδ
    pub ds_ddelta: Vec<f64>,
    /// 各阶段分界点 (度)
    pub phase_bounds: Vec<f64>,
}

/// 计算凸轮一整圈运动的位移、速度、加速度
///
/// # Arguments
/// * `params` - 凸轮参数
///
/// # Returns
/// * `FullMotionResult` - 包含所有运动数据
pub fn compute_full_motion(params: &CamParams) -> Result<FullMotionResult, String> {
    // 参数验证
    validate_motion_params(params)?;

    let n = params.n_points;
    let delta_0 = params.delta_0 * DEG2RAD;
    let delta_ret = params.delta_ret * DEG2RAD;

    let tc_law = MotionLaw::try_from(params.tc_law)?;
    let hc_law = MotionLaw::try_from(params.hc_law)?;

    // 创建全程转角数组 (度)
    let delta_deg: Vec<f64> = (0..n).map(|i| i as f64 * 360.0 / n as f64).collect();

    let mut s = vec![0.0; n];
    let mut v = vec![0.0; n];
    let mut a = vec![0.0; n];

    // 使用与前端一致的阶段划分逻辑（基于 delta 比较）
    let delta0_deg = params.delta_0;
    let delta01_deg = params.delta_01;
    let delta_ret_deg = params.delta_ret;

    // 相位边界（度）
    let rise_end_deg = delta0_deg;
    let outer_dwell_end_deg = delta0_deg + delta01_deg;
    let return_end_deg = outer_dwell_end_deg + delta_ret_deg;

    for i in 0..n {
        let delta_deg_i = delta_deg[i];
        let delta_rad = delta_deg_i * DEG2RAD;

        if delta_deg_i <= rise_end_deg && delta0_deg > 0.0 {
            // 推程阶段
            let t = delta_rad / delta_0;
            let (si, vi, ai) = compute_motion_point(t, params.h, params.omega, delta_0, tc_law);
            s[i] = si;
            v[i] = vi;
            a[i] = ai;
        } else if delta_deg_i <= outer_dwell_end_deg {
            // 远休止阶段
            s[i] = params.h;
            v[i] = 0.0;
            a[i] = 0.0;
        } else if delta_deg_i <= return_end_deg && delta_ret_deg > 0.0 {
            // 回程阶段
            let t = (delta_rad - outer_dwell_end_deg * DEG2RAD) / delta_ret;
            let (si, vi, ai) = compute_motion_point(t, params.h, params.omega, delta_ret, hc_law);
            s[i] = params.h - si;
            v[i] = -vi;
            a[i] = -ai;
        } else {
            // 近休止阶段 (already initialized to 0)
        }
    }

    // ds/ddelta = v/omega
    let ds_ddelta: Vec<f64> = v.iter().map(|&vi| vi / params.omega).collect();

    // 阶段分界点 (度)
    let phase_bounds = vec![
        0.0,
        params.delta_0,
        params.delta_0 + params.delta_01,
        params.delta_0 + params.delta_01 + params.delta_ret,
        360.0,
    ];

    Ok(FullMotionResult {
        delta_deg,
        s,
        v,
        a,
        ds_ddelta,
        phase_bounds,
    })
}

/// 计算单个点的运动值（归一化时间 t: 0-1）
fn compute_motion_point(
    t: f64,
    h: f64,
    omega: f64,
    delta_rad: f64,
    law: MotionLaw,
) -> (f64, f64, f64) {
    match law {
        MotionLaw::Uniform => {
            let s = h * t;
            let v = h * omega / delta_rad;
            let a = 0.0;
            (s, v, a)
        }
        MotionLaw::ConstantAcceleration => {
            if t < 0.5 {
                let s = 2.0 * h * t * t;
                let v = 4.0 * h * omega * t / delta_rad;
                let a = 4.0 * h * omega * omega / (delta_rad * delta_rad);
                (s, v, a)
            } else {
                let s = h * (1.0 - 2.0 * (1.0 - t) * (1.0 - t));
                let v = 4.0 * h * omega * (1.0 - t) / delta_rad;
                let a = -4.0 * h * omega * omega / (delta_rad * delta_rad);
                (s, v, a)
            }
        }
        MotionLaw::SimpleHarmonic => {
            let s = h * (1.0 - (std::f64::consts::PI * t).cos()) / 2.0;
            let v = h * omega * std::f64::consts::PI * (std::f64::consts::PI * t).sin() / (2.0 * delta_rad);
            let a = h * omega * omega * std::f64::consts::PI * std::f64::consts::PI
                * (std::f64::consts::PI * t).cos() / (2.0 * delta_rad * delta_rad);
            (s, v, a)
        }
        MotionLaw::Cycloidal => {
            let s = h * (t - (2.0 * std::f64::consts::PI * t).sin() / (2.0 * std::f64::consts::PI));
            let v = h * omega * (1.0 - (2.0 * std::f64::consts::PI * t).cos()) / delta_rad;
            let a = h * omega * omega * 2.0 * std::f64::consts::PI * (2.0 * std::f64::consts::PI * t).sin()
                / (delta_rad * delta_rad);
            (s, v, a)
        }
        MotionLaw::QuinticPolynomial => {
            let t2 = t * t;
            let t3 = t2 * t;
            let t4 = t3 * t;
            let t5 = t4 * t;
            let s = h * (10.0 * t3 - 15.0 * t4 + 6.0 * t5);
            let v = h * omega * (30.0 * t2 - 60.0 * t3 + 30.0 * t4) / delta_rad;
            let a = h * omega * omega * (60.0 * t - 180.0 * t2 + 120.0 * t3) / (delta_rad * delta_rad);
            (s, v, a)
        }
        MotionLaw::SepticPolynomial => {
            let t2 = t * t;
            let t3 = t2 * t;
            let t4 = t3 * t;
            let t5 = t4 * t;
            let t6 = t5 * t;
            let t7 = t6 * t;
            let s = h * (35.0 * t4 - 84.0 * t5 + 70.0 * t6 - 20.0 * t7);
            let v = h * omega * (140.0 * t3 - 420.0 * t4 + 420.0 * t5 - 140.0 * t6) / delta_rad;
            let a = h * omega * omega * (420.0 * t2 - 1680.0 * t3 + 2100.0 * t4 - 840.0 * t5)
                / (delta_rad * delta_rad);
            (s, v, a)
        }
    }
}

/// 验证运动参数
fn validate_motion_params(params: &CamParams) -> Result<(), String> {
    // 角度必须为正
    if params.delta_0 <= 0.0 {
        return Err(format!("delta_0 must be > 0, got {}", params.delta_0));
    }
    if params.delta_01 < 0.0 {
        return Err(format!("delta_01 must be >= 0, got {}", params.delta_01));
    }
    if params.delta_ret <= 0.0 {
        return Err(format!("delta_ret must be > 0, got {}", params.delta_ret));
    }
    if params.delta_02 < 0.0 {
        return Err(format!("delta_02 must be >= 0, got {}", params.delta_02));
    }

    // 四角之和必须为 360 度
    let sum = params.delta_0 + params.delta_01 + params.delta_ret + params.delta_02;
    if (sum - 360.0).abs() > 0.01 {
        return Err(format!(
            "Four angles must sum to 360°, got {:.2}",
            sum
        ));
    }

    // 其他参数验证
    if params.h <= 0.0 {
        return Err(format!("h must be > 0, got {}", params.h));
    }
    if params.r_0 <= 0.0 {
        return Err(format!("r_0 must be > 0, got {}", params.r_0));
    }
    if params.e.abs() >= params.r_0 {
        return Err(format!(
            "|e| must be < r_0, got e={}, r_0={}",
            params.e, params.r_0
        ));
    }
    if params.omega <= 0.0 {
        return Err(format!("omega must be > 0, got {}", params.omega));
    }
    if params.n_points < 36 {
        return Err(format!("n_points must be >= 36, got {}", params.n_points));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_motion_default_params() {
        let params = CamParams::default();
        let result = compute_full_motion(&params);

        assert!(result.is_ok());
        let data = result.unwrap();

        // 检查数组长度
        assert_eq!(data.s.len(), 360);
        assert_eq!(data.v.len(), 360);
        assert_eq!(data.a.len(), 360);

        // 检查相位边界
        assert_eq!(data.phase_bounds.len(), 5);
        assert!((data.phase_bounds[0] - 0.0).abs() < 1e-10);
        assert!((data.phase_bounds[4] - 360.0).abs() < 1e-10);
    }

    #[test]
    fn test_full_motion_invalid_angles() {
        let mut params = CamParams::default();
        params.delta_0 = 100.0;
        params.delta_01 = 100.0;
        params.delta_ret = 100.0;
        params.delta_02 = 100.0; // Sum = 400, not 360

        let result = compute_full_motion(&params);
        assert!(result.is_err());
    }
}