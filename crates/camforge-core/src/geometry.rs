//! 几何分析模块
//!
//! 计算压力角和曲率半径

/// 常量：弧度转度
const RAD2DEG: f64 = 180.0 / std::f64::consts::PI;

/// 计算压力角
///
/// 使用解析公式：α = arctan2(ds/dδ - pz·e, s_0 + s)
///
/// # Arguments
/// * `s` - 位移数组
/// * `ds_ddelta` - 位移对转角的解析导数
/// * `s_0` - 初始位移 sqrt(r_0² - e²)
/// * `e` - 偏距 (mm)
/// * `pz` - 偏距符号 (+1 正偏距, -1 负偏距)
///
/// # Returns
/// * 压力角数组 (度)
pub fn compute_pressure_angle(
    s: &[f64],
    ds_ddelta: &[f64],
    s_0: f64,
    e: f64,
    pz: i32,
) -> Result<Vec<f64>, String> {
    if s_0 <= 0.0 {
        return Err(format!("s_0 must be > 0, got {}", s_0));
    }
    if pz != 1 && pz != -1 {
        return Err(format!("pz must be +1 or -1, got {}", pz));
    }

    let n = s.len();
    let mut alpha = vec![0.0; n];

    let pz_f = pz as f64;

    for i in 0..n {
        let numerator = ds_ddelta[i] - pz_f * e;
        let denominator = s_0 + s[i];
        // Use atan2 for correct quadrant handling; guard against zero denominator
        alpha[i] = if denominator.abs() < f64::EPSILON {
            90.0 // Pressure angle approaches 90° as denominator → 0
        } else {
            numerator.atan2(denominator).abs() * RAD2DEG
        };
    }

    Ok(alpha)
}

/// 计算曲率半径
///
/// 使用参数曲线曲率公式：ρ = ((x'² + y'²)^(3/2)) / |x'y'' - y'x''|
///
/// # Arguments
/// * `x` - 凸轮廓形 X 坐标
/// * `y` - 凸轮廓形 Y 坐标
///
/// # Returns
/// * 曲率半径数组（正值表示凸面，负值表示凹面/undercutting）
pub fn compute_curvature_radius(x: &[f64], y: &[f64]) -> Result<Vec<f64>, String> {
    let n = x.len();
    if n < 3 {
        return Err(format!("Need at least 3 points, got {}", n));
    }
    if y.len() != n {
        return Err(format!("x and y must have same length, got {} and {}", n, y.len()));
    }

    let mut rho = vec![0.0; n];

    for i in 0..n {
        // 中心差分（周期边界）
        let i_prev = if i == 0 { n - 1 } else { i - 1 };
        let i_next = if i == n - 1 { 0 } else { i + 1 };

        // 一阶导数
        let dx = (x[i_next] - x[i_prev]) / 2.0;
        let dy = (y[i_next] - y[i_prev]) / 2.0;

        // 二阶导数
        let ddx = x[i_next] - 2.0 * x[i] + x[i_prev];
        let ddy = y[i_next] - 2.0 * y[i] + y[i_prev];

        // 曲率 κ = (x'y'' - y'x'') / (x'² + y'²)^(3/2)
        let cross = dx * ddy - dy * ddx;
        let speed_sq = dx.powi(2) + dy.powi(2);
        let speed_cubed = speed_sq * speed_sq.sqrt(); // faster than powf(1.5)

        // 避免除零
        rho[i] = if speed_cubed > 1e-12 {
            speed_cubed / cross
        } else {
            f64::INFINITY
        };
    }

    Ok(rho)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pressure_angle_zero_offset() {
        // 无偏距时，压力角应较小
        let s = vec![0.0; 360];
        let ds_ddelta = vec![0.0; 360];
        let alpha = compute_pressure_angle(&s, &ds_ddelta, 40.0, 0.0, 1).unwrap();

        // 所有压力角应为 0（因为 ds_ddelta = 0）
        for a in &alpha {
            assert!(a.abs() < 1e-10, "Pressure angle should be 0, got {}", a);
        }
    }

    #[test]
    fn test_pressure_angle_with_offset() {
        // 有偏距时，压力角应非零
        let s = vec![5.0; 360];
        let ds_ddelta = vec![10.0; 360];
        let alpha = compute_pressure_angle(&s, &ds_ddelta, 40.0, 5.0, 1).unwrap();

        // 压力角应大于 0
        for a in &alpha {
            assert!(*a > 0.0, "Pressure angle should be positive, got {}", a);
        }
    }

    #[test]
    fn test_pressure_angle_invalid_s0() {
        let s = vec![0.0; 10];
        let ds_ddelta = vec![0.0; 10];
        let result = compute_pressure_angle(&s, &ds_ddelta, 0.0, 0.0, 1);
        assert!(result.is_err());
    }

    #[test]
    fn test_pressure_angle_invalid_pz() {
        let s = vec![0.0; 10];
        let ds_ddelta = vec![0.0; 10];
        let result = compute_pressure_angle(&s, &ds_ddelta, 40.0, 0.0, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_curvature_radius_circle() {
        // 圆形凸轮，曲率半径应等于半径
        let r = 40.0;
        let n = 360;
        let x: Vec<f64> = (0..n).map(|i| r * (2.0 * std::f64::consts::PI * i as f64 / n as f64).cos()).collect();
        let y: Vec<f64> = (0..n).map(|i| r * (2.0 * std::f64::consts::PI * i as f64 / n as f64).sin()).collect();

        let rho = compute_curvature_radius(&x, &y).unwrap();

        // 检查曲率半径接近 r（由于离散化会有误差）
        for (i, &r_val) in rho.iter().enumerate() {
            if r_val.is_finite() {
                assert!(
                    (r_val - r).abs() < 1.0,
                    "Curvature radius should be close to {}, got {} at index {}",
                    r,
                    r_val,
                    i
                );
            }
        }
    }

    #[test]
    fn test_curvature_radius_insufficient_points() {
        let x = vec![0.0, 1.0];
        let y = vec![0.0, 1.0];
        let result = compute_curvature_radius(&x, &y);
        assert!(result.is_err());
    }

    #[test]
    fn test_curvature_radius_mismatched_lengths() {
        let x = vec![0.0, 1.0, 2.0];
        let y = vec![0.0, 1.0];
        let result = compute_curvature_radius(&x, &y);
        assert!(result.is_err());
    }

    #[test]
    fn test_curvature_radius_straight_line() {
        // 直线的曲率半径应为无穷大
        let x: Vec<f64> = (0..100).map(|i| i as f64).collect();
        let y: Vec<f64> = vec![0.0; 100];

        let rho = compute_curvature_radius(&x, &y).unwrap();

        // 直线的曲率半径应接近无穷大
        for &r in &rho {
            assert!(r.abs() > 1000.0 || r.is_infinite(), "Straight line should have infinite curvature radius, got {}", r);
        }
    }
}