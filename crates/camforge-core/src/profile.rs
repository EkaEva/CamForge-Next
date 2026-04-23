//! 凸轮轮廓计算模块
//!
//! 计算理论廓形和滚子从动件实际廓形

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
        x[i] = -sn_f * x[i];
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
    if r_r == 0.0 {
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
        let (nx, ny) = if sn == 1 {
            (ty, -tx)
        } else {
            (-ty, tx)
        };

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

    let x_rot: Vec<f64> = x_static
        .iter()
        .zip(y_static.iter())
        .map(|(&x, &y)| x * cos_a - y * sin_a)
        .collect();

    let y_rot: Vec<f64> = x_static
        .iter()
        .zip(y_static.iter())
        .map(|(&x, &y)| x * sin_a + y * cos_a)
        .collect();

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
        assert!(dist < 1.0, "Profile should be approximately closed, got distance {}", dist);

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
}