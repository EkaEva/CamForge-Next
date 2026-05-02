//! 完整运动循环计算模块
//!
//! 计算凸轮一整圈运动的位移、速度、加速度
//! 委托至 `motion::compute_rise_point` 作为单一权威实现

use crate::motion::compute_rise_point;
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
    params.validate()?;

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
            let (si, vi, ai) = compute_rise_point(t, params.h, params.omega, delta_0, tc_law);
            s[i] = si;
            v[i] = vi;
            a[i] = ai;
        } else if delta_deg_i <= outer_dwell_end_deg {
            // 远休止阶段
            s[i] = params.h;
            v[i] = 0.0;
            a[i] = 0.0;
        } else if delta_deg_i <= return_end_deg && delta_ret_deg > 0.0 {
            // 回程阶段：委托至 compute_rise_point 并变换
            let t = (delta_rad - outer_dwell_end_deg * DEG2RAD) / delta_ret;
            let (si, vi, ai) = compute_rise_point(t, params.h, params.omega, delta_ret, hc_law);
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
        let params = CamParams { delta_0: 100.0, delta_01: 100.0, delta_ret: 100.0, delta_02: 100.0, ..CamParams::default() };

        let result = compute_full_motion(&params);
        assert!(result.is_err());
    }

    #[test]
    fn test_full_motion_phase_continuity() {
        let params = CamParams::default();
        let data = compute_full_motion(&params).unwrap();

        // 推程终点位移应接近 h
        let rise_end_idx = (params.delta_0 / 360.0 * params.n_points as f64) as usize;
        assert!(
            (data.s[rise_end_idx.min(data.s.len() - 1)] - params.h).abs() < 0.1,
            "Rise end displacement should be close to h"
        );

        // 远休止期间位移应保持 h
        let outer_dwell_start = rise_end_idx;
        let outer_dwell_end =
            ((params.delta_0 + params.delta_01) / 360.0 * params.n_points as f64) as usize;
        let mid_dwell = (outer_dwell_start + outer_dwell_end) / 2;
        if mid_dwell < data.s.len() {
            assert!(
                (data.s[mid_dwell] - params.h).abs() < 0.1,
                "Outer dwell displacement should be h"
            );
        }
    }

    #[test]
    fn test_full_motion_start_end_zero() {
        let params = CamParams::default();
        let data = compute_full_motion(&params).unwrap();

        // 起点位移为 0
        assert!((data.s[0] - 0.0).abs() < 1e-10);
        // 终点位移接近 0（近休止结束）
        assert!((data.s[data.s.len() - 1] - 0.0).abs() < 0.1);
    }

    #[test]
    fn test_full_motion_delta_0_zero_rejected() {
        let params = CamParams { delta_0: 0.0, delta_02: 180.0, ..CamParams::default() };
        let result = compute_full_motion(&params);
        assert!(result.is_err());
    }
}
