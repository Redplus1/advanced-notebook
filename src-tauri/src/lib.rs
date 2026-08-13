use tauri::{Manager, WindowEvent};

// ─── Attachment file storage ──────────────────────────────────────────────────

/// Reduce one caller-supplied string to a single safe path component.
/// Separators become underscores so a value can never introduce a new path
/// level, and the relative-path names are neutralised so `..` cannot walk out
/// of the attachments directory.
fn safe_component(raw: &str) -> String {
    let cleaned = raw.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let trimmed = cleaned.trim();
    if trimmed.is_empty() || trimmed.chars().all(|c| c == '.') {
        "_".to_string()
    } else {
        trimmed.to_string()
    }
}

#[tauri::command]
fn save_attachment(
    note_id: String,
    file_name: String,
    data: Vec<u8>,
    sub_dir: Option<String>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let base = app.path_resolver()
        .app_data_dir()
        .ok_or("Cannot get app data dir")?;

    // `sub_dir` is a per-attachment folder. Without it the file is named purely
    // after the original filename, so two different pictures that happen to
    // share a name (two IMG_0001.jpg off a phone, say) overwrote each other and
    // the first one was lost. Giving each attachment its own folder keeps the
    // real filename on disk — which is what the user sees when the file opens
    // in another application — while making collisions impossible.
    let mut dir = base.join("attachments").join(safe_component(&note_id));
    if let Some(sub) = sub_dir.filter(|s| !s.trim().is_empty()) {
        dir = dir.join(safe_component(&sub));
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let path = dir.join(safe_component(&file_name));
    std::fs::write(&path, &data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_attachment(path: String) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    // Drop the per-attachment folder once it is empty. `remove_dir` refuses to
    // touch a non-empty directory, so this can never take anything else with it.
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = std::fs::remove_dir(parent);
    }
    Ok(())
}

#[tauri::command]
fn read_attachment(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::safe_component;

    #[test]
    fn leaves_existing_ids_untouched() {
        // Every id the app already stores must map to itself, or previously
        // saved attachments would stop resolving.
        for id in ["blueprint_msrxj27xd01", "images_root", "files_root", "mgk3f2a1x", "cat.png"] {
            assert_eq!(safe_component(id), id);
        }
    }

    #[test]
    fn cannot_escape_the_attachments_directory() {
        for evil in ["..", "../..", "../../etc", "..\\..\\windows", "/etc/passwd", "."] {
            let safe = safe_component(evil);
            assert!(!safe.contains('/'), "{evil} kept a separator: {safe}");
            assert!(!safe.contains('\\'), "{evil} kept a separator: {safe}");
            assert_ne!(safe, "..");
            assert_ne!(safe, ".");
        }
    }

    #[test]
    fn empty_and_blank_names_get_a_placeholder() {
        assert_eq!(safe_component(""), "_");
        assert_eq!(safe_component("   "), "_");
    }

    #[test]
    fn keeps_the_original_filename_readable() {
        assert_eq!(safe_component("Отчёт за 2026.pdf"), "Отчёт за 2026.pdf");
        assert_eq!(safe_component("a:b*c?.jpg"), "a_b_c_.jpg");
    }
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
