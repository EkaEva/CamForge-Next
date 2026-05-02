//! 导出命令模块
//!
//! 提供 DXF、CSV 等格式导出功能

use std::fs::File;
use std::io::Write;
use std::path::{Component, Path, PathBuf};
use tauri::State;

use crate::commands::simulation::SimState;

/// 允许的导出文件扩展名
const ALLOWED_EXTENSIONS: &[&str] = &["dxf", "csv"];

/// Validate export path: accept absolute paths in safe directories (from save dialogs)
/// and relative paths, while blocking path traversal and dangerous locations.
fn validate_export_path(filepath: &str) -> Result<PathBuf, String> {
    let path = Path::new(filepath);
    let filepath_lower = filepath.to_lowercase();

    // 1. 检查路径遍历攻击（包括 URL 编码形式和 Unicode 变体）
    if filepath.contains("..") {
        return Err("Path traversal not allowed: path cannot contain '..'".to_string());
    }
    if filepath_lower.contains("%2e%2e")
        || filepath_lower.contains("%2e.")
        || filepath_lower.contains(".%2e")
        || filepath_lower.contains("%c0%ae%c0%ae")  // Overlong UTF-8 encoding of '..'
        || filepath_lower.contains("%252e%252e")     // Double URL encoding of '..'
    {
        return Err("Path traversal not allowed: encoded path traversal detected".to_string());
    }
    // Unicode two-dot character ‥ (U+2025) — rarely exploitable but flagged by scanners
    if filepath.contains('\u{2025}') {
        return Err("Path traversal not allowed: Unicode path traversal variant detected".to_string());
    }

    // 2. 验证文件扩展名（大小写不敏感）
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or("Missing file extension: file must have .dxf or .csv extension")?;

    if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        return Err(format!(
            "Invalid file extension: '{}'. Allowed extensions: {}",
            ext,
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    // 3. 获取文件名并验证
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid filename: unable to extract filename from path")?;

    if filename.is_empty() {
        return Err("Invalid filename: filename cannot be empty".to_string());
    }

    // 4. 检查文件名不包含危险字符
    let dangerous_chars = ['<', '>', ':', '"', '|', '?', '*', '\0'];
    if filename.chars().any(|c| dangerous_chars.contains(&c)) {
        return Err("Invalid filename: contains dangerous characters".to_string());
    }

    // 5. 检查危险文件类型（.env, .keystore 等）
    let filename_lower = filename.to_lowercase();
    if filename_lower.ends_with(".env")
        || filename_lower.ends_with(".keystore")
        || filename_lower.ends_with(".jks")
        || filename_lower.ends_with(".pem")
        || filename_lower.ends_with(".key")
    {
        return Err(format!("Dangerous file type not allowed: {}", filename));
    }

    // 6. 绝对路径：允许来自保存对话框的安全目录路径
    if path.is_absolute() {
        // 检查路径组件安全性（允许 Prefix 如 C: 但不允许 ParentDir/RootDir）
        for component in path.components() {
            match component {
                Component::ParentDir => {
                    return Err(
                        "Path traversal not allowed: parent directory reference detected"
                            .to_string(),
                    );
                }
                Component::RootDir => {
                    return Err("Root directory not allowed in path".to_string());
                }
                _ => {}
            }
        }

        // 验证绝对路径位于允许的用户目录内
        let allowed_dirs: Vec<PathBuf> = [
            dirs::download_dir(),
            dirs::document_dir(),
            dirs::desktop_dir(),
            dirs::home_dir(),
        ]
        .iter()
        .filter_map(|d| d.clone())
        .collect();

        let resolved = if path.exists() {
            dunce::canonicalize(path).unwrap_or_else(|_| path.to_path_buf())
        } else {
            // 文件尚不存在，检查父目录
            if let Some(parent) = path.parent() {
                if parent.exists() {
                    match dunce::canonicalize(parent) {
                        Ok(canonical_parent) => canonical_parent.join(filename),
                        Err(_) => path.to_path_buf(),
                    }
                } else {
                    path.to_path_buf()
                }
            } else {
                path.to_path_buf()
            }
        };

        for allowed_dir in &allowed_dirs {
            if resolved.starts_with(allowed_dir) {
                return Ok(path.to_path_buf());
            }
        }

        return Err(format!(
            "Absolute path not in allowed directories (Downloads, Documents, Desktop, Home): {}",
            filepath
        ));
    }

    // 相对路径：检查路径组件安全性
    for component in path.components() {
        match component {
            Component::ParentDir => {
                return Err(
                    "Path traversal not allowed: parent directory reference detected".to_string(),
                );
            }
            Component::RootDir => {
                return Err("Root directory not allowed in path".to_string());
            }
            Component::Prefix(_) => {
                return Err("Path prefix not allowed (e.g., C:)".to_string());
            }
            _ => {}
        }
    }

    Ok(path.to_path_buf())
}

/// 导出 DXF 格式
#[tauri::command]
pub fn export_dxf(
    filepath: String,
    include_actual: bool,
    state: State<SimState>,
) -> Result<(), String> {
    // 验证文件路径安全性
    let safe_path = validate_export_path(&filepath)?;

    let data_guard = state
        .data
        .lock()
        .map_err(|e| format!("State lock poisoned: {}", e))?;
    let data = data_guard.as_ref().ok_or("No simulation data available")?;

    let mut file = File::create(&safe_path).map_err(|e| e.to_string())?;

    // DXF Header
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "SECTION").map_err(|e| e.to_string())?;
    writeln!(file, "2").map_err(|e| e.to_string())?;
    writeln!(file, "HEADER").map_err(|e| e.to_string())?;
    writeln!(file, "9").map_err(|e| e.to_string())?;
    writeln!(file, "$INSUNITS").map_err(|e| e.to_string())?;
    writeln!(file, "70").map_err(|e| e.to_string())?;
    writeln!(file, "4").map_err(|e| e.to_string())?; // Millimeters
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "ENDSEC").map_err(|e| e.to_string())?;

    // Tables Section
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "SECTION").map_err(|e| e.to_string())?;
    writeln!(file, "2").map_err(|e| e.to_string())?;
    writeln!(file, "TABLES").map_err(|e| e.to_string())?;

    // Layer table
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "TABLE").map_err(|e| e.to_string())?;
    writeln!(file, "2").map_err(|e| e.to_string())?;
    writeln!(file, "LAYER").map_err(|e| e.to_string())?;
    writeln!(file, "70").map_err(|e| e.to_string())?;
    writeln!(file, "2").map_err(|e| e.to_string())?;

    // Theory layer
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "LAYER").map_err(|e| e.to_string())?;
    writeln!(file, "2").map_err(|e| e.to_string())?;
    writeln!(file, "CAM_THEORY").map_err(|e| e.to_string())?;
    writeln!(file, "70").map_err(|e| e.to_string())?;
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "62").map_err(|e| e.to_string())?;
    writeln!(file, "1").map_err(|e| e.to_string())?; // Red

    // Actual layer
    if include_actual {
        writeln!(file, "0").map_err(|e| e.to_string())?;
        writeln!(file, "LAYER").map_err(|e| e.to_string())?;
        writeln!(file, "2").map_err(|e| e.to_string())?;
        writeln!(file, "CAM_ACTUAL").map_err(|e| e.to_string())?;
        writeln!(file, "70").map_err(|e| e.to_string())?;
        writeln!(file, "0").map_err(|e| e.to_string())?;
        writeln!(file, "62").map_err(|e| e.to_string())?;
        writeln!(file, "5").map_err(|e| e.to_string())?; // Blue
    }

    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "ENDTAB").map_err(|e| e.to_string())?;
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "ENDSEC").map_err(|e| e.to_string())?;

    // Entities Section
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "SECTION").map_err(|e| e.to_string())?;
    writeln!(file, "2").map_err(|e| e.to_string())?;
    writeln!(file, "ENTITIES").map_err(|e| e.to_string())?;

    // Theory profile polyline
    write_polyline(&mut file, &data.x, &data.y, "CAM_THEORY")?;

    // Actual profile polyline (if roller follower)
    if include_actual && !data.x_actual.is_empty() {
        write_polyline(&mut file, &data.x_actual, &data.y_actual, "CAM_ACTUAL")?;
    }

    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "ENDSEC").map_err(|e| e.to_string())?;
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "EOF").map_err(|e| e.to_string())?;

    Ok(())
}

/// Write a polyline entity to DXF file
fn write_polyline(file: &mut File, x: &[f64], y: &[f64], layer: &str) -> Result<(), String> {
    writeln!(file, "0").map_err(|e| e.to_string())?;
    writeln!(file, "LWPOLYLINE").map_err(|e| e.to_string())?;
    writeln!(file, "8").map_err(|e| e.to_string())?;
    writeln!(file, "{}", layer).map_err(|e| e.to_string())?;
    writeln!(file, "90").map_err(|e| e.to_string())?;
    writeln!(file, "{}", x.len()).map_err(|e| e.to_string())?;
    writeln!(file, "70").map_err(|e| e.to_string())?;
    writeln!(file, "1").map_err(|e| e.to_string())?; // Closed

    for i in 0..x.len() {
        writeln!(file, "10").map_err(|e| e.to_string())?;
        writeln!(file, "{:.6}", x[i]).map_err(|e| e.to_string())?;
        writeln!(file, "20").map_err(|e| e.to_string())?;
        writeln!(file, "{:.6}", y[i]).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 导出 CSV 格式
#[tauri::command]
pub fn export_csv(filepath: String, lang: String, state: State<SimState>) -> Result<(), String> {
    // 验证文件路径安全性
    let safe_path = validate_export_path(&filepath)?;

    let data_guard = state
        .data
        .lock()
        .map_err(|e| format!("State lock poisoned: {}", e))?;
    let data = data_guard.as_ref().ok_or("No simulation data available")?;
    let params_guard = state
        .params
        .lock()
        .map_err(|e| format!("State lock poisoned: {}", e))?;
    let params = params_guard.as_ref().ok_or("No simulation parameters available")?;

    let mut file = File::create(&safe_path).map_err(|e| e.to_string())?;

    // Write BOM for Excel UTF-8 compatibility
    file.write_all(&[0xEF, 0xBB, 0xBF])
        .map_err(|e| e.to_string())?;

    // Compute actual curvature radius if roller follower
    let has_actual = params.r_r > 0.0;

    // Header row (i18n)
    let headers = if lang == "zh" {
        if has_actual {
            "转角 δ (°),向径 R (mm),推杆位移 s (mm),推杆速度 v (mm/s),推杆加速度 a (mm/s²),理论曲率半径 ρ (mm),实际曲率半径 ρₐ (mm),压力角 α (°)"
        } else {
            "转角 δ (°),向径 R (mm),推杆位移 s (mm),推杆速度 v (mm/s),推杆加速度 a (mm/s²),曲率半径 ρ (mm),压力角 α (°)"
        }
    } else {
        if has_actual {
            "Angle δ (°),Radius R (mm),Displacement s (mm),Velocity v (mm/s),Acceleration a (mm/s²),Theory ρ (mm),Actual ρₐ (mm),Pressure Angle α (°)"
        } else {
            "Angle δ (°),Radius R (mm),Displacement s (mm),Velocity v (mm/s),Acceleration a (mm/s²),Curvature ρ (mm),Pressure Angle α (°)"
        }
    };
    writeln!(file, "{}", headers).map_err(|e| e.to_string())?;

    // Data rows
    for i in 0..data.delta_deg.len() {
        let r = (data.x[i].powi(2) + data.y[i].powi(2)).sqrt();
        let rho_val = if data.rho[i].is_finite() {
            format!("{:.4}", data.rho[i].abs())
        } else {
            String::new()
        };
        let rho_actual_val = if has_actual && i < data.rho_actual.len() && data.rho_actual[i].is_finite() {
            format!("{:.4}", data.rho_actual[i].abs())
        } else {
            String::new()
        };

        if has_actual {
            writeln!(
                file,
                "{},{},{},{},{},{},{},{}",
                csv_escape(&format!("{:.2}", data.delta_deg[i])),
                csv_escape(&format!("{:.4}", r)),
                csv_escape(&format!("{:.4}", data.s[i])),
                csv_escape(&format!("{:.4}", data.v[i])),
                csv_escape(&format!("{:.4}", data.a[i])),
                csv_escape(&rho_val),
                csv_escape(&rho_actual_val),
                csv_escape(&format!("{:.4}", data.alpha_all[i]))
            )
            .map_err(|e| e.to_string())?;
        } else {
            writeln!(
                file,
                "{},{},{},{},{},{},{}",
                csv_escape(&format!("{:.2}", data.delta_deg[i])),
                csv_escape(&format!("{:.4}", r)),
                csv_escape(&format!("{:.4}", data.s[i])),
                csv_escape(&format!("{:.4}", data.v[i])),
                csv_escape(&format!("{:.4}", data.a[i])),
                csv_escape(&rho_val),
                csv_escape(&format!("{:.4}", data.alpha_all[i]))
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// Escape a CSV cell value to prevent formula injection
fn csv_escape(val: &str) -> String {
    let dangerous = ['=', '+', '-', '@', '\t', '\r'];
    if val.starts_with(dangerous) || val.contains(',') || val.contains('"') || val.contains('\n') {
        format!("\"{}\"", val.replace('"', "\"\""))
    } else {
        val.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_dxf_path() {
        assert!(validate_export_path("output.dxf").is_ok());
        assert!(validate_export_path("output.DXF").is_ok());
        assert!(validate_export_path("output.Dxf").is_ok());
    }

    #[test]
    fn test_valid_csv_path() {
        assert!(validate_export_path("data.csv").is_ok());
        assert!(validate_export_path("data.CSV").is_ok());
    }

    #[test]
    fn test_path_traversal_blocked() {
        assert!(validate_export_path("../../../etc/passwd").is_err());
        assert!(validate_export_path("..\\..\\windows\\system32").is_err());
    }

    #[test]
    fn test_encoded_path_traversal_blocked() {
        assert!(validate_export_path("%2e%2e/etc/passwd").is_err());
        assert!(validate_export_path("%2e./etc/passwd").is_err());
        assert!(validate_export_path(".%2e/etc/passwd").is_err());
        // Overlong UTF-8 encoding
        assert!(validate_export_path("%c0%ae%c0%ae/etc/passwd").is_err());
        // Double URL encoding
        assert!(validate_export_path("%252e%252e/etc/passwd").is_err());
        // Unicode two-dot character ‥ (U+2025)
        assert!(validate_export_path("\u{2025}/etc/passwd").is_err());
    }

    #[test]
    fn test_absolute_path_blocked() {
        assert!(validate_export_path("/etc/passwd").is_err());
        assert!(validate_export_path("C:\\Windows\\System32").is_err());
    }

    #[test]
    fn test_invalid_extension_blocked() {
        assert!(validate_export_path("output.exe").is_err());
        assert!(validate_export_path("output.txt").is_err());
        assert!(validate_export_path("output").is_err());
    }

    #[test]
    fn test_dangerous_chars_blocked() {
        assert!(validate_export_path("out<put.dxf").is_err());
        assert!(validate_export_path("out>put.dxf").is_err());
        assert!(validate_export_path("out:put.dxf").is_err());
    }
}
