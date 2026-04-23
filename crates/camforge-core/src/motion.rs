//! 运动规律计算模块
//!
//! 实现六种推杆运动规律的位移、速度、加速度计算

use crate::types::MotionLaw;

/// 计算推程阶段的位移、速度、加速度
///
/// # Arguments
/// * `delta_arr` - 推程转角数组 (rad)，从 0 开始
/// * `delta_0` - 推程运动角 (rad)
/// * `h` - 推杆最大位移 (mm)
/// * `omega` - 凸轮角速度 (rad/s)
/// * `law` - 运动规律
///
/// # Returns
/// * `(s, v, a)` - 位移、速度、加速度数组
pub fn compute_rise(
    delta_arr: &[f64],
    delta_0: f64,
    h: f64,
    omega: f64,
    law: MotionLaw,
) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let n = delta_arr.len();
    let mut s = vec![0.0; n];
    let mut v = vec![0.0; n];
    let mut a = vec![0.0; n];

    match law {
        MotionLaw::Uniform => {
            // 等速运动
            for i in 0..n {
                s[i] = h * delta_arr[i] / delta_0;
                v[i] = h * omega / delta_0;
                // a[i] = 0 (already initialized)
            }
        }
        MotionLaw::ConstantAcceleration => {
            // 等加速等减速
            let half = delta_0 / 2.0;
            for i in 0..n {
                let delta = delta_arr[i];
                if delta <= half {
                    // 等加速段
                    s[i] = 2.0 * h * delta.powi(2) / delta_0.powi(2);
                    v[i] = 4.0 * h * omega * delta / delta_0.powi(2);
                    a[i] = 4.0 * h * omega.powi(2) / delta_0.powi(2);
                } else {
                    // 等减速段
                    s[i] = h - 2.0 * h * (delta_0 - delta).powi(2) / delta_0.powi(2);
                    v[i] = 4.0 * h * omega * (delta_0 - delta) / delta_0.powi(2);
                    a[i] = -4.0 * h * omega.powi(2) / delta_0.powi(2);
                }
            }
        }
        MotionLaw::SimpleHarmonic => {
            // 简谐运动
            for i in 0..n {
                let ratio = std::f64::consts::PI * delta_arr[i] / delta_0;
                s[i] = h * (1.0 - ratio.cos()) / 2.0;
                v[i] = std::f64::consts::PI * h * omega * ratio.sin() / (2.0 * delta_0);
                a[i] = std::f64::consts::PI.powi(2) * h * omega.powi(2) * ratio.cos()
                    / (2.0 * delta_0.powi(2));
            }
        }
        MotionLaw::Cycloidal => {
            // 摆线运动
            for i in 0..n {
                let ratio = 2.0 * std::f64::consts::PI * delta_arr[i] / delta_0;
                s[i] = h * (delta_arr[i] / delta_0 - ratio.sin() / (2.0 * std::f64::consts::PI));
                v[i] = h * omega * (1.0 - ratio.cos()) / delta_0;
                a[i] = 2.0 * std::f64::consts::PI * h * omega.powi(2) * ratio.sin()
                    / delta_0.powi(2);
            }
        }
        MotionLaw::QuinticPolynomial => {
            // 五次多项式 (3-4-5)
            for i in 0..n {
                let t = delta_arr[i] / delta_0;
                let t2 = t.powi(2);
                let t3 = t.powi(3);
                let t4 = t.powi(4);
                s[i] = h * (10.0 * t3 - 15.0 * t4 + 6.0 * t.powi(5));
                v[i] = h * omega / delta_0 * (30.0 * t2 - 60.0 * t3 + 30.0 * t4);
                a[i] = h * omega.powi(2) / delta_0.powi(2) * (60.0 * t - 180.0 * t2 + 120.0 * t3);
            }
        }
        MotionLaw::SepticPolynomial => {
            // 七次多项式 (4-5-6-7)
            for i in 0..n {
                let t = delta_arr[i] / delta_0;
                let t2 = t.powi(2);
                let t3 = t.powi(3);
                let t4 = t.powi(4);
                let t5 = t.powi(5);
                let t6 = t.powi(6);
                let t7 = t.powi(7);
                s[i] = h * (35.0 * t4 - 84.0 * t5 + 70.0 * t6 - 20.0 * t7);
                v[i] = h * omega / delta_0 * (140.0 * t3 - 420.0 * t4 + 420.0 * t5 - 140.0 * t6);
                a[i] = h * omega.powi(2) / delta_0.powi(2)
                    * (420.0 * t2 - 1680.0 * t3 + 2100.0 * t4 - 840.0 * t5);
            }
        }
    }

    (s, v, a)
}

/// 计算回程阶段的位移、速度、加速度
///
/// # Arguments
/// * `delta_arr` - 回程转角数组 (rad)，从 0 开始（局部坐标）
/// * `delta_ret` - 回程运动角 (rad)
/// * `h` - 推杆最大位移 (mm)
/// * `omega` - 凸轮角速度 (rad/s)
/// * `law` - 运动规律
///
/// # Returns
/// * `(s, v, a)` - 位移、速度、加速度数组
pub fn compute_return(
    delta_arr: &[f64],
    delta_ret: f64,
    h: f64,
    omega: f64,
    law: MotionLaw,
) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let n = delta_arr.len();
    let mut s = vec![0.0; n];
    let mut v = vec![0.0; n];
    let mut a = vec![0.0; n];

    match law {
        MotionLaw::Uniform => {
            // 等速运动
            for i in 0..n {
                s[i] = h * (1.0 - delta_arr[i] / delta_ret);
                v[i] = -h * omega / delta_ret;
                // a[i] = 0
            }
        }
        MotionLaw::ConstantAcceleration => {
            // 等加速等减速
            let half = delta_ret / 2.0;
            for i in 0..n {
                let delta = delta_arr[i];
                if delta <= half {
                    // 等加速段（速度减小）
                    s[i] = h - 2.0 * h * delta.powi(2) / delta_ret.powi(2);
                    v[i] = -4.0 * h * omega * delta / delta_ret.powi(2);
                    a[i] = -4.0 * h * omega.powi(2) / delta_ret.powi(2);
                } else {
                    // 等减速段
                    s[i] = 2.0 * h * (delta_ret - delta).powi(2) / delta_ret.powi(2);
                    v[i] = -4.0 * h * omega * (delta_ret - delta) / delta_ret.powi(2);
                    a[i] = 4.0 * h * omega.powi(2) / delta_ret.powi(2);
                }
            }
        }
        MotionLaw::SimpleHarmonic => {
            // 简谐运动
            for i in 0..n {
                let ratio = std::f64::consts::PI * delta_arr[i] / delta_ret;
                s[i] = h * (1.0 + ratio.cos()) / 2.0;
                v[i] = -std::f64::consts::PI * h * omega * ratio.sin() / (2.0 * delta_ret);
                a[i] = -std::f64::consts::PI.powi(2) * h * omega.powi(2) * ratio.cos()
                    / (2.0 * delta_ret.powi(2));
            }
        }
        MotionLaw::Cycloidal => {
            // 摆线运动
            for i in 0..n {
                let ratio = 2.0 * std::f64::consts::PI * delta_arr[i] / delta_ret;
                s[i] = h - h * (delta_arr[i] / delta_ret - ratio.sin() / (2.0 * std::f64::consts::PI));
                v[i] = -h * omega * (1.0 - ratio.cos()) / delta_ret;
                a[i] = -2.0 * std::f64::consts::PI * h * omega.powi(2) * ratio.sin()
                    / delta_ret.powi(2);
            }
        }
        MotionLaw::QuinticPolynomial => {
            // 五次多项式 (3-4-5)
            for i in 0..n {
                let t = delta_arr[i] / delta_ret;
                let t2 = t.powi(2);
                let t3 = t.powi(3);
                let t4 = t.powi(4);
                let poly = 10.0 * t3 - 15.0 * t4 + 6.0 * t.powi(5);
                s[i] = h * (1.0 - poly);
                v[i] = -h * omega / delta_ret * (30.0 * t2 - 60.0 * t3 + 30.0 * t4);
                a[i] = -h * omega.powi(2) / delta_ret.powi(2)
                    * (60.0 * t - 180.0 * t2 + 120.0 * t3);
            }
        }
        MotionLaw::SepticPolynomial => {
            // 七次多项式 (4-5-6-7)
            for i in 0..n {
                let t = delta_arr[i] / delta_ret;
                let t2 = t.powi(2);
                let t3 = t.powi(3);
                let t4 = t.powi(4);
                let t5 = t.powi(5);
                let t6 = t.powi(6);
                let poly = 35.0 * t4 - 84.0 * t5 + 70.0 * t6 - 20.0 * t.powi(7);
                s[i] = h * (1.0 - poly);
                v[i] = -h * omega / delta_ret * (140.0 * t3 - 420.0 * t4 + 420.0 * t5 - 140.0 * t6);
                a[i] = -h * omega.powi(2) / delta_ret.powi(2)
                    * (420.0 * t2 - 1680.0 * t3 + 2100.0 * t4 - 840.0 * t5);
            }
        }
    }

    (s, v, a)
}

/// 生成等间距数组
///
/// 类似 numpy.linspace，可选是否包含端点
pub fn linspace(start: f64, stop: f64, n: usize, endpoint: bool) -> Vec<f64> {
    if n == 0 {
        return vec![];
    }
    if n == 1 {
        return vec![start];
    }

    let step = if endpoint {
        (stop - start) / (n - 1) as f64
    } else {
        (stop - start) / n as f64
    };

    (0..n).map(|i| start + i as f64 * step).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rise_boundary_values() {
        let delta_0 = std::f64::consts::FRAC_PI_2; // 90 degrees
        let h = 10.0;
        let omega = 1.0;

        for law in 1..=6 {
            let law = MotionLaw::try_from(law).unwrap();
            let delta_arr = linspace(0.0, delta_0, 100, true);
            let (s, _, _) = compute_rise(&delta_arr, delta_0, h, omega, law);

            // 起点位移应为 0
            assert!(
                (s[0] - 0.0).abs() < 1e-10,
                "Rise start should be 0 for law {:?}, got {}",
                law,
                s[0]
            );

            // 终点位移应为 h
            assert!(
                (s[99] - h).abs() < 1e-6,
                "Rise end should be h for law {:?}, got {}",
                law,
                s[99]
            );
        }
    }

    #[test]
    fn test_return_boundary_values() {
        let delta_ret = std::f64::consts::FRAC_PI_2;
        let h = 10.0;
        let omega = 1.0;

        for law in 1..=6 {
            let law = MotionLaw::try_from(law).unwrap();
            let delta_arr = linspace(0.0, delta_ret, 100, true);
            let (s, _, _) = compute_return(&delta_arr, delta_ret, h, omega, law);

            // 起点位移应为 h
            assert!(
                (s[0] - h).abs() < 1e-6,
                "Return start should be h for law {:?}, got {}",
                law,
                s[0]
            );

            // 终点位移应为 0
            assert!(
                (s[99] - 0.0).abs() < 1e-6,
                "Return end should be 0 for law {:?}, got {}",
                law,
                s[99]
            );
        }
    }

    #[test]
    fn test_linspace() {
        let arr = linspace(0.0, 1.0, 5, true);
        assert_eq!(arr.len(), 5);
        assert!((arr[0] - 0.0).abs() < 1e-10);
        assert!((arr[4] - 1.0).abs() < 1e-10);

        let arr = linspace(0.0, 1.0, 5, false);
        assert_eq!(arr.len(), 5);
        assert!((arr[0] - 0.0).abs() < 1e-10);
        assert!((arr[4] - 0.8).abs() < 1e-10);
    }
}