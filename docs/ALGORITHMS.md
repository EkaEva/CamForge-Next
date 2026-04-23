# CamForge-Next 算法公式文档

> 本文档详细描述凸轮机构运动学计算所使用的数学公式和算法。

## 一、基本参数定义

| 参数 | 符号 | 说明 | 单位 |
|------|------|------|------|
| 推程运动角 | δ₀ | 推杆上升阶段凸轮转角 | ° |
| 远休止角 | δ₀₁ | 推杆静止在上止点的阶段 | ° |
| 回程运动角 | δᵣ | 推杆下降阶段凸轮转角 | ° |
| 近休止角 | δ₀₂ | 推杆静止在下止点的阶段 | ° |
| 行程 | h | 推杆最大位移 | mm |
| 基圆半径 | r₀ | 凸轮最小向径 | mm |
| 偏距 | e | 推杆导路与凸轮轴心的偏移量 | mm |
| 角速度 | ω | 凸轮旋转角速度 | rad/s |
| 滚子半径 | rᵣ | 滚子从动件的滚子半径 | mm |

**约束条件**：δ₀ + δ₀₁ + δᵣ + δ₀₂ = 360°

## 二、运动规律公式

运动规律描述推杆位移 s 与凸轮转角 δ 的关系。设 t = δ/δ₀（推程）或 t = δ/δᵣ（回程），t ∈ [0, 1]。

### 2.1 等速运动 (Constant Velocity)

**位移**：
$$s = h \cdot t$$

**速度**：
$$v = \frac{h \cdot \omega}{\delta_0}$$

**加速度**：
$$a = 0$$（除起点和终点存在刚性冲击）

**特点**：最简单的运动规律，但存在刚性冲击，仅适用于低速场合。

---

### 2.2 等加速等减速运动 (Constant Acceleration)

**位移**（前半段 t ∈ [0, 0.5]）：
$$s = 2h \cdot t^2$$

**位移**（后半段 t ∈ [0.5, 1]）：
$$s = h - 2h(1-t)^2$$

**速度**：
$$v = \frac{4h \cdot \omega \cdot t}{\delta_0}$$（前半段）
$$v = \frac{4h \cdot \omega \cdot (1-t)}{\delta_0}$$（后半段）

**加速度**：
$$a = \frac{4h \cdot \omega^2}{\delta_0^2}$$（前半段，常数）
$$a = -\frac{4h \cdot \omega^2}{\delta_0^2}$$（后半段，常数）

**特点**：存在柔性冲击，适用于中低速场合。

---

### 2.3 简谐运动 (Simple Harmonic)

**位移**：
$$s = \frac{h}{2}\left(1 - \cos(\pi t)\right)$$

**速度**：
$$v = \frac{\pi h \cdot \omega}{2\delta_0} \sin(\pi t)$$

**加速度**：
$$a = \frac{\pi^2 h \cdot \omega^2}{2\delta_0^2} \cos(\pi t)$$

**特点**：无冲击，加速度连续，适用于中低速场合。

---

### 2.4 摆线运动 (Cycloidal)

**位移**：
$$s = h\left(t - \frac{\sin(2\pi t)}{2\pi}\right)$$

**速度**：
$$v = \frac{h \cdot \omega}{\delta_0}\left(1 - \cos(2\pi t)\right)$$

**加速度**：
$$a = \frac{2\pi h \cdot \omega^2}{\delta_0^2} \sin(2\pi t)$$

**特点**：无冲击，加速度在起点和终点为零，动力性能好，适用于高速场合。

---

### 2.5 3-4-5 多项式运动 (3-4-5 Polynomial)

**位移**：
$$s = h(10t^3 - 15t^4 + 6t^5)$$

**速度**：
$$v = \frac{h \cdot \omega}{\delta_0}(30t^2 - 60t^3 + 30t^4)$$

**加速度**：
$$a = \frac{h \cdot \omega^2}{\delta_0^2}(60t - 180t^2 + 120t^3)$$

**特点**：无冲击，加速度连续，边界加速度为零，综合性能好。

---

### 2.6 4-5-6-7 多项式运动 (4-5-6-7 Polynomial)

**位移**：
$$s = h(35t^4 - 84t^5 + 70t^6 - 20t^7)$$

**速度**：
$$v = \frac{h \cdot \omega}{\delta_0}(140t^3 - 420t^4 + 420t^5 - 140t^6)$$

**加速度**：
$$a = \frac{h \cdot \omega^2}{\delta_0^2}(420t^2 - 1680t^3 + 2100t^4 - 840t^5)$$

**加加速度**（Jerk）：
$$j = \frac{h \cdot \omega^3}{\delta_0^3}(840t - 5040t^2 + 8400t^3 - 4200t^4)$$

**特点**：无冲击，加速度和加加速度均连续，动力性能最优，适用于超高速场合。

---

## 三、凸轮轮廓计算

### 3.1 基本几何关系

**初始位置**（s = 0 时）：
$$s_0 = \sqrt{r_0^2 - e^2}$$

**偏距方向系数**：
- pz = 1：推杆偏于凸轮旋转方向一侧
- pz = -1：推杆偏于凸轮旋转反方向一侧

### 3.2 理论轮廓方程

对于直动从动件，凸轮理论轮廓坐标：

$$x = (s_0 + s) \sin\delta + pz \cdot e \cos\delta$$
$$y = (s_0 + s) \cos\delta - pz \cdot e \sin\delta$$

考虑旋向 sn（顺时针 sn = 1，逆时针 sn = -1）：
$$x' = -sn \cdot x$$

### 3.3 实际轮廓方程（滚子从动件）

滚子从动件的实际轮廓是理论轮廓的内等距曲线。

**切线方向**（中心差分）：
$$t_x = \frac{x_{i+1} - x_{i-1}}{2}$$
$$t_y = \frac{y_{i+1} - y_{i-1}}{2}$$

**法线方向**（内法线）：
$$n_x = t_y / \sqrt{t_x^2 + t_y^2}$$
$$n_y = -t_x / \sqrt{t_x^2 + t_y^2}$$

**实际轮廓坐标**：
$$x_a = x + r_r \cdot n_x$$
$$y_a = y + r_r \cdot n_y$$

---

## 四、压力角计算

压力角 α 是推杆受力方向与运动方向的夹角。

### 4.1 计算公式

$$\tan\alpha = \frac{ds/d\delta - pz \cdot e}{s_0 + s}$$

其中 ds/dδ = v/ω（位移对转角的导数）。

### 4.2 许用压力角

- 推程：α ≤ 30° ~ 35°
- 回程：α ≤ 35° ~ 45°

当压力角超过许用值时，机构可能出现自锁或效率下降。

---

## 五、曲率半径计算

### 5.1 参数曲线曲率公式

对于参数曲线 (x(δ), y(δ))：

$$\rho = \frac{(x'^2 + y'^2)^{3/2}}{x'y'' - y'x''}$$

其中：
- x', y'：一阶导数（中心差分）
- x'', y''：二阶导数（中心差分）

### 5.2 实际轮廓曲率半径

对于滚子从动件：

$$\rho_a = \rho - \text{sign}(\rho) \cdot r_r$$

### 5.3 失真条件

当 |ρ_a| < 0 时，实际轮廓出现失真（变尖或交叉）。

**避免失真的条件**：
$$\rho_{min} > r_r$$

---

## 六、数值计算方法

### 6.1 离散化

将凸轮转角 0° ~ 360° 离散为 n 个点（n = 36 ~ 720）：

$$\delta_i = \frac{360° \cdot i}{n}, \quad i = 0, 1, ..., n-1$$

### 6.2 中心差分

一阶导数：
$$f'(x_i) = \frac{f(x_{i+1}) - f(x_{i-1})}{2h}$$

二阶导数：
$$f''(x_i) = \frac{f(x_{i+1}) - 2f(x_i) + f(x_{i-1})}{h^2}$$

### 6.3 边界处理

对于周期性曲线，使用循环索引：
$$i_{prev} = (i - 1 + n) \mod n$$
$$i_{next} = (i + 1) \mod n$$

---

## 七、代码实现参考

### 7.1 运动规律计算 (TypeScript)

```typescript
export function computeMotion(
  law: MotionLaw,
  t: number,
  h: number,
  omega: number,
  deltaRad: number
): [number, number, number] {
  let s: number, v: number, a: number;

  switch (law) {
    case MotionLaw.Cycloidal:
      s = h * (t - Math.sin(2 * Math.PI * t) / (2 * Math.PI));
      v = h * omega / deltaRad * (1 - Math.cos(2 * Math.PI * t));
      a = 2 * Math.PI * h * omega * omega / (deltaRad * deltaRad) * Math.sin(2 * Math.PI * t);
      break;
    // ... 其他运动规律
  }

  return [s, v, a];
}
```

### 7.2 压力角计算 (Rust)

```rust
pub fn calculate_pressure_angle(
    ds_ddelta: f64,
    pz: f64,
    e: f64,
    s0: f64,
    s: f64,
) -> f64 {
    let tan_alpha = (ds_ddelta - pz * e) / (s0 + s);
    let alpha = atan(tan_alpha) * 180.0 / PI;
    abs(alpha)
}
```

---

## 八、参考文献

1. 《机械原理》（第七版），孙桓等著，高等教育出版社
2. 《凸轮机构设计》，石永刚等著，机械工业出版社
3. Norton, R. L. "Design of Machinery" 5th Edition, McGraw-Hill