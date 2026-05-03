//! CamForge 核心计算库
//!
//! 提供凸轮机构运动学计算的核心算法，包括：
//! - 运动规律计算（位移、速度、加速度）
//! - 凸轮轮廓计算（理论廓形、实际廓形）
//! - 几何分析（压力角、曲率半径）
//!
//! 该库可被 Tauri 桌面应用和 HTTP API 服务器共同使用。

pub mod full_motion;
pub mod geometry;
pub mod motion;
pub mod profile;
pub mod types;

// 重新导出主要类型和函数
pub use full_motion::{compute_full_motion, FullMotionResult};
pub use geometry::{
    compute_curvature_radius, compute_flat_faced_pressure_angle, compute_pressure_angle,
};
pub use motion::{compute_return, compute_rise, compute_rise_point, linspace};
pub use profile::{
    compute_cam_profile, compute_flat_faced_profile, compute_oscillating_flat_faced_profile,
    compute_oscillating_pressure_angle, compute_oscillating_profile, compute_roller_profile,
    compute_rotated_cam, FlatFacedProfileResult, OscFlatProfileResult, OscillatingProfileResult,
    ProfileResult,
};
pub use types::{CamParams, FollowerType, FrameData, MotionLaw, SimulationData};
