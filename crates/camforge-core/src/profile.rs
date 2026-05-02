//! 凸轮轮廓计算模块
//!
//! 计算理论廓形和滚子从动件实际廓形

type RollerProfile = (Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>, f64);
type OscFlatProfile = (Vec<f64>, Vec<f64>, Vec<f64>, Vec<f64>);

/// 凸轮轮廓计算结果
pub struct ProfileResult {
    /// 理论廓形 X 坐标
    pub x: Vec<f64>,
    /// 理论廓形 Y 坐标
    pub y: Vec<f64>,
    /// 初始位移 sqrt(r_0² - e²)
    pub s_0: f64,
}

/// 计算凸轮理论廓形坐标
///
/// # Arguments
/// * `s` - 位移数组
/// * `r_0` - 基圆半径 (mm)
/// * `e` - 偏距 (mm)
/// * `sn` - 旋向符号 (+1 顺时针, -1 逆时针)
/// * `pz` - 偏距符号 (+1 正偏距, -1 负偏距)
///
/// # Returns
/// * `ProfileResult` - 包含 x, y, s_0
pub fn compute_cam_profile(
    s: &[f64],
    r_0: f64,
    e: f64,
    sn: i32,
    pz: i32,
) -> Result<ProfileResult, String> {
    if r_0 <= 0.0 {
        return Err(format!("r_0 must be > 0, got {}", r_0));
    }
    if e.abs() >= r_0 {
        return Err(format!("|e| must be < r_0, got e={}, r_0={}", e, r_0));
    }
    if sn != 1 && sn != -1 {
        return Err(format!("sn must be +1 or -1, got {}", sn));
    }
    if pz != 1 && pz != -1 {
        return Err(format!("pz must be +1 or -1, got {}", pz));
    }

    let n = s.len();
    // e 可以是负数，s_0 使用绝对值计算
    let e_abs = e.abs();
    let s_0 = (r_0.powi(2) - e_abs.powi(2)).sqrt();

    let mut x = vec![0.0; n];
    let mut y = vec![0.0; n];

    let sn_f = sn as f64;
    let pz_f = pz as f64;

    for i in 0..n {
        let delta = 2.0 * std::f64::consts::PI * i as f64 / n as f64;
        let sin_d = delta.sin();
        let cos_d = delta.cos();

        let sp = s_0 + s[i];

        // 理论廓形方程
        x[i] = sp * sin_d + pz_f * e * cos_d;
        y[i] = sp * cos_d - pz_f * e * sin_d;

        // 转向处理
        x[i] *= -sn_f;
    }

    Ok(ProfileResult { x, y, s_0 })
}

/// 计算滚子从动件实际廓形
///
/// 实际廓形 = 理论廓形向内偏移滚子半径 r_r 的等距曲线
///
/// # Arguments
/// * `x_theory` - 理论廓形 X 坐标
/// * `y_theory` - 理论廓形 Y 坐标
/// * `r_r` - 滚子半径 (mm)
/// * `sn` - 旋向符号
///
/// # Returns
/// * `(x_actual, y_actual)` - 实际廓形坐标
pub fn compute_roller_profile(
    x_theory: &[f64],
    y_theory: &[f64],
    r_r: f64,
    sn: i32,
) -> Result<(Vec<f64>, Vec<f64>), String> {
    if r_r < 0.0 {
        return Err(format!("r_r must be >= 0, got {}", r_r));
    }

    // 尖底从动件，直接返回理论廓形
    if r_r.abs() < f64::EPSILON {
        return Ok((x_theory.to_vec(), y_theory.to_vec()));
    }

    let n = x_theory.len();
    let mut x_actual = vec![0.0; n];
    let mut y_actual = vec![0.0; n];

    for i in 0..n {
        // 中心差分求切线方向（周期边界）
        let i_prev = if i == 0 { n - 1 } else { i - 1 };
        let i_next = if i == n - 1 { 0 } else { i + 1 };

        let dx = x_theory[i_next] - x_theory[i_prev];
        let dy = y_theory[i_next] - y_theory[i_prev];
        let len_t = (dx.powi(2) + dy.powi(2)).sqrt();

        // 处理退化点
        if len_t < 1e-12 {
            x_actual[i] = x_theory[i];
            y_actual[i] = y_theory[i];
            continue;
        }

        // 单位切向量
        let tx = dx / len_t;
        let ty = dy / len_t;

        // 内法线方向（指向凸轮中心）
        let (nx, ny) = if sn == 1 { (ty, -tx) } else { (-ty, tx) };

        // 确保法线指向凸轮中心 (0, 0)
        // 点积判断：如果 (x, y) · (nx, ny) > 0，则法线指向外侧，需要翻转
        let dot = -x_theory[i] * nx + -y_theory[i] * ny;
        let (nx, ny) = if dot < 0.0 { (-nx, -ny) } else { (nx, ny) };

        // 实际廓形 = 理论廓形 + r_r * 内法线
        x_actual[i] = x_theory[i] + r_r * nx;
        y_actual[i] = y_theory[i] + r_r * ny;
    }

    Ok((x_actual, y_actual))
}

/// 计算平底从动件实际廓形
///
/// 平底从动件的实际廓形是从动件平面位置族的包络线，
/// 需要位移对转角的解析导数 ds/dδ 直接参与计算。
///
/// 理论廓形（接触点轨迹）与 `compute_cam_profile` 公式相同。
/// 实际廓形公式：
///   x_a = (s_0+s)·sin(δ) + pz·e·cos(δ) + (ds/dδ)·cos(δ)
///   y_a = (s_0+s)·cos(δ) - pz·e·sin(δ) - (ds/dδ)·sin(δ)
///
/// # Arguments
/// * `s` - 位移数组
/// * `ds_ddelta` - 位移对转角的导数数组
/// * `r_0` - 基圆半径 (mm)
/// * `e` - 偏距 (mm)
/// * `sn` - 旋向符号 (+1 顺时针, -1 逆时针)
/// * `pz` - 偏距符号 (+1 正偏距, -1 负偏距)
/// * `flat_face_offset` - 平底中心线偏置量 (mm)
///
/// # Returns
/// * `(x_theory, y_theory, x_actual, y_actual, s_0)` - 理论廓形、实际廓形坐标和初始位移
pub fn compute_flat_faced_profile(
    s: &[f64],
    ds_ddelta: &[f64],
    r_0: f64,
    e: f64,
    sn: i32,
    pz: i32,
    flat_face_offset: f64,
) -> Result<RollerProfile, String> {
    if r_0 <= 0.0 {
        return Err(format!("r_0 must be > 0, got {}", r_0));
    }
    if e.abs() >= r_0 {
        return Err(format!("|e| must be < r_0, got e={}, r_0={}", e, r_0));
    }
    if s.len() != ds_ddelta.len() {
        return Err(format!(
            "s and ds_ddelta must have same length, got {} and {}",
            s.len(),
            ds_ddelta.len()
        ));
    }

    let n = s.len();
    let s_0 = (r_0.powi(2) - e.powi(2)).sqrt();
    let sn_f = sn as f64;
    let pz_f = pz as f64;

    let mut x_theory = vec![0.0; n];
    let mut y_theory = vec![0.0; n];
    let mut x_actual = vec![0.0; n];
    let mut y_actual = vec![0.0; n];

    for i in 0..n {
        let delta = 2.0 * std::f64::consts::PI * i as f64 / n as f64;
        let sin_d = delta.sin();
        let cos_d = delta.cos();

        let sp = s_0 + s[i];

        // 理论廓形（接触点轨迹）— 与滚子从动件公式相同
        let xt = sp * sin_d + pz_f * e * cos_d;
        let yt = sp * cos_d - pz_f * e * sin_d;
        x_theory[i] = -sn_f * xt;
        y_theory[i] = yt;

        // 实际廓形 — 从动件平面位置族的包络线
        // ds/dδ 参与垂直于从动件运动方向的分量
        let contact_offset = ds_ddelta[i] - flat_face_offset;
        let xa = sp * sin_d + pz_f * e * cos_d + contact_offset * cos_d;
        let ya = sp * cos_d - pz_f * e * sin_d - contact_offset * sin_d;
        x_actual[i] = -sn_f * xa;
        y_actual[i] = ya;
    }

    Ok((x_theory, y_theory, x_actual, y_actual, s_0))
}

/// 计算摆动从动件凸轮理论廓形
///
/// 摆动从动件的枢轴固定在距离凸轮中心 `pivot_distance` 处，
/// 臂长为 `arm_length`，初始臂角为 `initial_angle`。
///
/// 将位移 `s` 转换为角位移：ψ = s / arm_length
///
/// # Arguments
/// * `s` - 位移数组 (mm)，解释为滚子中心沿弧线的线性位移
/// * `arm_length` - 臂长 L (mm)
/// * `pivot_distance` - 枢轴至凸轮中心距 a (mm)
/// * `initial_angle` - 初始臂角 δ₀ (度)
/// * `sn` - 旋向符号 (+1 顺时针, -1 逆时针)
///
/// # Returns
/// * `(x_theory, y_theory)` - 理论廓形坐标
pub fn compute_oscillating_profile(
    s: &[f64],
    arm_length: f64,
    pivot_distance: f64,
    initial_angle: f64,
    sn: i32,
) -> Result<(Vec<f64>, Vec<f64>), String> {
    if arm_length <= 0.0 {
        return Err(format!("arm_length must be > 0, got {}", arm_length));
    }
    if pivot_distance <= 0.0 {
        return Err(format!(
            "pivot_distance must be > 0, got {}",
            pivot_distance
        ));
    }
    if arm_length + s.iter().cloned().fold(0.0_f64, f64::max) > pivot_distance {
        return Err("arm_length + max(s) must be <= pivot_distance for valid geometry".to_string());
    }

    let n = s.len();
    let sn_f = sn as f64;
    let delta_0 = initial_angle * std::f64::consts::PI / 180.0;
    let two_pi = 2.0 * std::f64::consts::PI;

    let mut x_theory = vec![0.0; n];
    let mut y_theory = vec![0.0; n];

    for i in 0..n {
        let delta = two_pi * i as f64 / n as f64;
        let sin_d = delta.sin();
        let cos_d = delta.cos();

        // 角位移 ψ = s / L
        let psi = s[i] / arm_length;
        let angle = delta_0 + psi - delta;
        let sin_a = angle.sin();
        let cos_a = angle.cos();

        // 理论廓形（摆动从动件）
        // 凸轮框架下，绕 -sn·δ 旋转
        x_theory[i] = -sn_f * (pivot_distance * cos_d - arm_length * cos_a);
        y_theory[i] = -pivot_distance * sin_d + arm_length * sin_a;
    }

    Ok((x_theory, y_theory))
}

/// 计算摆动平底从动件实际廓形
///
/// 实际廓形 = 理论廓形 + ds/dδ 沿臂法线方向偏移
/// （从动件平面垂直于臂方向，包络线计算）
///
/// # Arguments
/// * `s` - 位移数组 (mm)
/// * `ds_ddelta` - 位移对转角的导数 (mm/rad)
/// * `arm_length` - 臂长 L (mm)
/// * `pivot_distance` - 枢轴距离 a (mm)
/// * `initial_angle` - 初始臂角 δ₀ (度)
/// * `sn` - 旋向符号 (+1 顺时针, -1 逆时针)
/// * `flat_face_offset` - 平底中心线偏置量 (mm)
///
/// # Returns
/// * `(x_theory, y_theory, x_actual, y_actual)` - 理论和实际廓形坐标
pub fn compute_oscillating_flat_faced_profile(
    s: &[f64],
    ds_ddelta: &[f64],
    arm_length: f64,
    pivot_distance: f64,
    initial_angle: f64,
    sn: i32,
    flat_face_offset: f64,
) -> Result<OscFlatProfile, String> {
    if s.len() != ds_ddelta.len() {
        return Err(format!(
            "s and ds_ddelta must have same length, got {} and {}",
            s.len(),
            ds_ddelta.len()
        ));
    }

    // 先计算理论廓形
    let (x_theory, y_theory) =
        compute_oscillating_profile(s, arm_length, pivot_distance, initial_angle, sn)?;

    let n = s.len();
    let sn_f = sn as f64;
    let delta_0 = initial_angle * std::f64::consts::PI / 180.0;
    let two_pi = 2.0 * std::f64::consts::PI;

    let mut x_actual = vec![0.0; n];
    let mut y_actual = vec![0.0; n];

    for i in 0..n {
        let delta = two_pi * i as f64 / n as f64;
        let psi = s[i] / arm_length;
        let angle = delta_0 + psi - delta;

        // 沿臂法线方向偏移 ds/dδ
        // 法线方向垂直于臂：(cos(angle), sin(angle)) → (-sin(angle), cos(angle))
        let contact_offset = ds_ddelta[i] - flat_face_offset;
        let offset_x = -sn_f * contact_offset * angle.sin();
        let offset_y = contact_offset * angle.cos();

        x_actual[i] = x_theory[i] + offset_x;
        y_actual[i] = y_theory[i] + offset_y;
    }

    Ok((x_theory, y_theory, x_actual, y_actual))
}

/// 计算摆动从动件压力角
///
/// 使用公式：α = arctan(|L·(dψ/dδ)| / |a·sin(δ₀+ψ)|)
///
/// # Arguments
/// * `s` - 位移数组 (mm)
/// * `ds_ddelta` - 位移对转角的导数 (mm/rad)
/// * `arm_length` - 臂长 L (mm)
/// * `pivot_distance` - 枢轴距离 a (mm)
/// * `initial_angle` - 初始臂角 (度)
///
/// # Returns
/// * 压力角数组 (度)
pub fn compute_oscillating_pressure_angle(
    s: &[f64],
    ds_ddelta: &[f64],
    arm_length: f64,
    pivot_distance: f64,
    initial_angle: f64,
) -> Result<Vec<f64>, String> {
    if arm_length <= 0.0 {
        return Err(format!("arm_length must be > 0, got {}", arm_length));
    }
    if pivot_distance <= 0.0 {
        return Err(format!(
            "pivot_distance must be > 0, got {}",
            pivot_distance
        ));
    }

    let n = s.len();
    let delta_0 = initial_angle * std::f64::consts::PI / 180.0;
    let rad2deg = 180.0 / std::f64::consts::PI;

    let mut alpha = vec![0.0; n];

    for i in 0..n {
        let psi = s[i] / arm_length;
        let dpsi_ddelta = ds_ddelta[i] / arm_length;

        // 传动角 = arctan(L·dψ/dδ / (a·sin(δ₀+ψ)))
        let denom = pivot_distance * (delta_0 + psi).sin();
        let numer = arm_length * dpsi_ddelta;

        alpha[i] = if denom.abs() < f64::EPSILON {
            90.0
        } else {
            (numer / denom).abs().atan() * rad2deg
        };
    }

    Ok(alpha)
}

/// 旋转凸轮廓形
///
/// # Arguments
/// * `x_static` - 静态廓形 X 坐标
/// * `y_static` - 静态廓形 Y 坐标
/// * `angle_rad` - 旋转角度 (rad)
///
/// # Returns
/// * `(x_rot, y_rot)` - 旋转后的坐标
pub fn compute_rotated_cam(
    x_static: &[f64],
    y_static: &[f64],
    angle_rad: f64,
) -> (Vec<f64>, Vec<f64>) {
    let cos_a = angle_rad.cos();
    let sin_a = angle_rad.sin();

    let n = x_static.len();
    let mut x_rot = Vec::with_capacity(n);
    let mut y_rot = Vec::with_capacity(n);

    for (&x, &y) in x_static.iter().zip(y_static.iter()) {
        x_rot.push(x * cos_a - y * sin_a);
        y_rot.push(x * sin_a + y * cos_a);
    }

    (x_rot, y_rot)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cam_profile_closed() {
        // 简单圆形凸轮（位移为 0）
        let s = vec![0.0; 360];
        let result = compute_cam_profile(&s, 40.0, 0.0, 1, 1).unwrap();

        // 检查轮廓闭合（首尾点距离）
        let dx = result.x[0] - result.x[359];
        let dy = result.y[0] - result.y[359];
        let dist = (dx.powi(2) + dy.powi(2)).sqrt();
        // 360 点的离散化误差约 2πr/n ≈ 0.7
        assert!(
            dist < 1.0,
            "Profile should be approximately closed, got distance {}",
            dist
        );

        // 检查 s_0
        assert!((result.s_0 - 40.0).abs() < 1e-10);
    }

    #[test]
    fn test_roller_profile_no_roller() {
        let x = vec![1.0, 2.0, 3.0];
        let y = vec![0.0, 1.0, 2.0];
        let (x_actual, y_actual) = compute_roller_profile(&x, &y, 0.0, 1).unwrap();

        // 无滚子时应返回理论廓形
        assert_eq!(x_actual, x);
        assert_eq!(y_actual, y);
    }

    #[test]
    fn test_rotated_cam() {
        let x = vec![1.0, 0.0, -1.0, 0.0];
        let y = vec![0.0, 1.0, 0.0, -1.0];

        // 旋转 90 度
        let (x_rot, y_rot) = compute_rotated_cam(&x, &y, std::f64::consts::FRAC_PI_2);

        // 检查第一个点 (1, 0) 旋转后变为 (0, 1)
        assert!((x_rot[0] - 0.0).abs() < 1e-10);
        assert!((y_rot[0] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_flat_faced_profile_closed() {
        // 零位移和零导数应产生圆形轮廓
        let n = 360;
        let s = vec![0.0; n];
        let ds_ddelta = vec![0.0; n];
        let (x_t, y_t, x_a, y_a, s_0) =
            compute_flat_faced_profile(&s, &ds_ddelta, 40.0, 0.0, 1, 1, 0.0).unwrap();

        // s_0 = sqrt(40² - 0²) = 40
        assert!((s_0 - 40.0).abs() < 1e-10);

        // 零位移时理论和实际轮廓应相同
        for i in 0..n {
            assert!((x_t[i] - x_a[i]).abs() < 1e-10);
            assert!((y_t[i] - y_a[i]).abs() < 1e-10);
        }

        // 检查轮廓闭合
        let dx = x_a[0] - x_a[n - 1];
        let dy = y_a[0] - y_a[n - 1];
        let dist = (dx.powi(2) + dy.powi(2)).sqrt();
        assert!(
            dist < 1.0,
            "Flat-faced profile should be closed, got distance {}",
            dist
        );
    }

    #[test]
    fn test_flat_faced_profile_with_displacement() {
        // 有位移时，实际轮廓应与理论轮廓不同（ds_ddelta 非零）
        let n = 360;
        let s: Vec<f64> = (0..n)
            .map(|i| {
                let t = i as f64 / n as f64;
                10.0 * (2.0 * std::f64::consts::PI * t).sin().abs()
            })
            .collect();
        let ds_ddelta: Vec<f64> = (0..n)
            .map(|i| {
                let t = i as f64 / n as f64;
                10.0 * 2.0 * std::f64::consts::PI * (2.0 * std::f64::consts::PI * t).cos()
            })
            .collect();

        let (x_t, y_t, x_a, y_a, _) =
            compute_flat_faced_profile(&s, &ds_ddelta, 40.0, 0.0, 1, 1, 0.0).unwrap();

        // 理论和实际轮廓应不同
        let mut has_diff = false;
        for i in 0..n {
            if (x_t[i] - x_a[i]).abs() > 0.01 || (y_t[i] - y_a[i]).abs() > 0.01 {
                has_diff = true;
                break;
            }
        }
        assert!(
            has_diff,
            "Theory and actual profiles should differ when ds_ddelta is non-zero"
        );
    }

    #[test]
    fn test_flat_faced_profile_mismatched_lengths() {
        let s = vec![0.0; 10];
        let ds_ddelta = vec![0.0; 20];
        let result = compute_flat_faced_profile(&s, &ds_ddelta, 40.0, 0.0, 1, 1, 0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_flat_faced_profile_invalid_r0() {
        let s = vec![0.0; 10];
        let ds_ddelta = vec![0.0; 10];
        let result = compute_flat_faced_profile(&s, &ds_ddelta, -5.0, 0.0, 1, 1, 0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_oscillating_profile_closed() {
        // 零位移应产生闭合轮廓
        // 摆动从动件的离散化误差与有效半径 (a+L) 成正比
        let n = 360;
        let s = vec![0.0; n];
        let a = 120.0;
        let l = 80.0;
        let (x, y) = compute_oscillating_profile(&s, l, a, 0.0, 1).unwrap();

        // 检查轮廓闭合（允许离散化误差，约 2π·r_eff/n）
        let r_eff = a + l; // 有效半径
        let tolerance = 2.0 * std::f64::consts::PI * r_eff / n as f64 + 0.1;
        let dx = x[0] - x[n - 1];
        let dy = y[0] - y[n - 1];
        let dist = (dx.powi(2) + dy.powi(2)).sqrt();
        assert!(
            dist < tolerance,
            "Oscillating profile should be approximately closed, got distance {}, tolerance {}",
            dist,
            tolerance
        );
    }

    #[test]
    fn test_oscillating_profile_with_displacement() {
        let n = 360;
        // 简单正弦位移（周期为 2π，首尾值相同）
        let s: Vec<f64> = (0..n)
            .map(|i| {
                let t = i as f64 / n as f64;
                10.0 * (2.0 * std::f64::consts::PI * t).sin()
            })
            .collect();
        let (x, y) = compute_oscillating_profile(&s, 80.0, 120.0, 30.0, -1).unwrap();

        // 轮廓应闭合（s(0)=s(2π)=0）
        let r_eff = 120.0 + 80.0;
        let tolerance = 2.0 * std::f64::consts::PI * r_eff / n as f64 + 0.1;
        let dx = x[0] - x[n - 1];
        let dy = y[0] - y[n - 1];
        let dist = (dx.powi(2) + dy.powi(2)).sqrt();
        assert!(
            dist < tolerance,
            "Oscillating profile with displacement should be closed, got {}",
            dist
        );

        // 所有坐标应为有限值
        for i in 0..n {
            assert!(x[i].is_finite(), "x[{}] should be finite, got {}", i, x[i]);
            assert!(y[i].is_finite(), "y[{}] should be finite, got {}", i, y[i]);
        }
    }

    #[test]
    fn test_oscillating_profile_invalid_arm_length() {
        let s = vec![0.0; 10];
        let result = compute_oscillating_profile(&s, -5.0, 120.0, 0.0, 1);
        assert!(result.is_err());
    }

    #[test]
    fn test_oscillating_profile_invalid_pivot() {
        let s = vec![0.0; 10];
        let result = compute_oscillating_profile(&s, 80.0, -10.0, 0.0, 1);
        assert!(result.is_err());
    }

    #[test]
    fn test_oscillating_pressure_angle_zero_displacement() {
        let n = 360;
        let s = vec![0.0; n];
        let ds_ddelta = vec![0.0; n];
        // 使用非零初始臂角避免奇点（δ₀=0 时臂与凸轮中心线重合）
        let alpha = compute_oscillating_pressure_angle(&s, &ds_ddelta, 80.0, 120.0, 30.0).unwrap();

        // 零位移和零导数时，压力角应为 0（分子 L·dψ/dδ = 0）
        for a in &alpha {
            assert!(
                a.abs() < 1e-10,
                "Pressure angle should be 0 with zero displacement, got {}",
                a
            );
        }
    }

    #[test]
    fn test_oscillating_flat_faced_profile_zero_deriv() {
        // 零导数时，实际廓形应与理论廓形相同
        let n = 360;
        let s = vec![0.0; n];
        let ds_ddelta = vec![0.0; n];
        let (xt, yt, xa, ya) =
            compute_oscillating_flat_faced_profile(&s, &ds_ddelta, 80.0, 120.0, 30.0, 1, 0.0)
                .unwrap();

        for i in 0..n {
            assert!((xt[i] - xa[i]).abs() < 1e-10, "x should match at {}", i);
            assert!((yt[i] - ya[i]).abs() < 1e-10, "y should match at {}", i);
        }
    }

    #[test]
    fn test_oscillating_flat_faced_profile_with_deriv() {
        // 非零导数时，实际廓形应与理论廓形不同
        let n = 360;
        let s: Vec<f64> = (0..n)
            .map(|i| {
                let t = i as f64 / n as f64;
                10.0 * (2.0 * std::f64::consts::PI * t).sin()
            })
            .collect();
        let ds_ddelta: Vec<f64> = (0..n)
            .map(|i| {
                let t = i as f64 / n as f64;
                10.0 * 2.0 * std::f64::consts::PI * (2.0 * std::f64::consts::PI * t).cos()
            })
            .collect();

        let (xt, yt, xa, ya) =
            compute_oscillating_flat_faced_profile(&s, &ds_ddelta, 80.0, 120.0, 30.0, -1, 0.0)
                .unwrap();

        let mut has_diff = false;
        for i in 0..n {
            if (xt[i] - xa[i]).abs() > 0.01 || (yt[i] - ya[i]).abs() > 0.01 {
                has_diff = true;
                break;
            }
        }
        assert!(
            has_diff,
            "Actual profile should differ from theory when ds_ddelta is non-zero"
        );

        // 所有坐标应为有限值
        for i in 0..n {
            assert!(xa[i].is_finite(), "x_actual[{}] should be finite", i);
            assert!(ya[i].is_finite(), "y_actual[{}] should be finite", i);
        }
    }

    #[test]
    fn test_oscillating_flat_faced_profile_mismatched_lengths() {
        let s = vec![0.0; 10];
        let ds_ddelta = vec![0.0; 20];
        let result =
            compute_oscillating_flat_faced_profile(&s, &ds_ddelta, 80.0, 120.0, 30.0, 1, 0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_flat_face_offset_changes_actual_profile() {
        let n = 16;
        let s = vec![0.0; n];
        let ds_ddelta = vec![0.0; n];

        let (_, _, xa0, ya0, _) =
            compute_flat_faced_profile(&s, &ds_ddelta, 40.0, 0.0, 1, 1, 0.0).unwrap();
        let (_, _, xa1, ya1, _) =
            compute_flat_faced_profile(&s, &ds_ddelta, 40.0, 0.0, 1, 1, 5.0).unwrap();

        assert!(xa0
            .iter()
            .zip(xa1.iter())
            .any(|(a, b)| (a - b).abs() > 1e-9));
        assert!(ya0
            .iter()
            .zip(ya1.iter())
            .any(|(a, b)| (a - b).abs() > 1e-9));
    }

    #[test]
    fn test_oscillating_flat_face_offset_changes_actual_profile() {
        let n = 16;
        let s = vec![0.0; n];
        let ds_ddelta = vec![0.0; n];

        let (_, _, xa0, ya0) =
            compute_oscillating_flat_faced_profile(&s, &ds_ddelta, 80.0, 120.0, 30.0, 1, 0.0)
                .unwrap();
        let (_, _, xa1, ya1) =
            compute_oscillating_flat_faced_profile(&s, &ds_ddelta, 80.0, 120.0, 30.0, 1, 5.0)
                .unwrap();

        assert!(xa0
            .iter()
            .zip(xa1.iter())
            .any(|(a, b)| (a - b).abs() > 1e-9));
        assert!(ya0
            .iter()
            .zip(ya1.iter())
            .any(|(a, b)| (a - b).abs() > 1e-9));
    }

    #[test]
    fn test_gamma_rotation_preserves_shape() {
        let n = 360;
        let s: Vec<f64> = (0..n)
            .map(|i| 10.0 * (2.0 * std::f64::consts::PI * i as f64 / n as f64).sin())
            .collect();

        let (x0, y0) = compute_oscillating_profile(&s, 80.0, 120.0, 30.0, 1).unwrap();

        // Rotate by gamma=45 degrees
        let gamma = 45.0 * std::f64::consts::PI / 180.0;
        let (x_rot, y_rot) = compute_rotated_cam(&x0, &y0, gamma);

        // Radial distances should be unchanged (shape preserved)
        for i in 0..n {
            let r0 = (x0[i].powi(2) + y0[i].powi(2)).sqrt();
            let r_rot = (x_rot[i].powi(2) + y_rot[i].powi(2)).sqrt();
            assert!(
                (r0 - r_rot).abs() < 1e-10,
                "Gamma rotation should preserve radial distances at {}",
                i
            );
        }
    }

    #[test]
    fn test_gamma_zero_identity() {
        let n = 360;
        let s: Vec<f64> = (0..n)
            .map(|i| 10.0 * (2.0 * std::f64::consts::PI * i as f64 / n as f64).sin())
            .collect();

        let (x, y) = compute_oscillating_profile(&s, 80.0, 120.0, 30.0, 1).unwrap();
        let (x_rot, y_rot) = compute_rotated_cam(&x, &y, 0.0);

        for i in 0..n {
            assert!((x[i] - x_rot[i]).abs() < 1e-10, "x mismatch at {}", i);
            assert!((y[i] - y_rot[i]).abs() < 1e-10, "y mismatch at {}", i);
        }
    }
}
