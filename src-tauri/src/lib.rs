use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            let window = app.get_window("main").unwrap();

            // Open DevTools only in debug mode
            #[cfg(debug_assertions)]
            window.open_devtools();

            // Show window after a short delay — prevents white flash on startup
            let win = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(120));
                win.show().unwrap_or(());
                win.set_focus().unwrap_or(());
            });

            Ok(())
        })
        .on_window_event(|event| {
            if let WindowEvent::CloseRequested { .. } = event.event() {
                // Graceful shutdown — let in-flight writes complete
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
