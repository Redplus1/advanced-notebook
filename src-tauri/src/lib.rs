use tauri::{Manager, WindowEvent};

// ─── Attachment file storage ──────────────────────────────────────────────────

#[tauri::command]
fn save_attachment(
    note_id: String,
    file_name: String,
    data: Vec<u8>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let base = app.path_resolver()
        .app_data_dir()
        .ok_or("Cannot get app data dir")?;
    let dir = base.join("attachments").join(&note_id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe = file_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let path = dir.join(&safe);
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_attachment(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_attachment(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file_native(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    app.path_resolver()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or("Cannot get app data dir".into())
}

// ─── App ──────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            save_attachment, delete_attachment, read_attachment, get_app_data_dir, open_file_native,
        ])
        .setup(|app| {
            let window = app.get_window("main").unwrap();
            #[cfg(debug_assertions)] window.open_devtools();
            let win = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(120));
                win.show().unwrap_or(());
                win.set_focus().unwrap_or(());
            });
            Ok(())
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { .. } = event.event() {}
        })
        .run(tauri::generate_context!())
        .expect("error running application");
}
