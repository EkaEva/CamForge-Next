//! CamForge Tauri 桌面应用入口
//!
//! 凸轮机构运动学计算应用

mod commands;

use commands::simulation::SimState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(SimState::default())
        .invoke_handler(tauri::generate_handler![
            commands::run_simulation,
            commands::get_frame_data,
            commands::export_dxf,
            commands::export_csv,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to start Tauri application — check that system dependencies (WebView2 on Windows, libwebkit2gtk/libgtk-3 on Linux) are installed");
}
