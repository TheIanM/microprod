use std::path::Path;
use std::fs;
use serde_json::{Value as JsonValue};

#[tauri::command]
async fn write_json_file(filename: String, data: JsonValue) -> Result<(), String> {
    let app_dir = match std::env::var("APPDATA") {
        Ok(appdata) => Path::new(&appdata).join("ucanduit"),
        Err(_) => {
            match std::env::var("HOME") {
                Ok(home) => Path::new(&home).join(".ucanduit"),
                Err(_) => {
                    std::env::current_dir().unwrap().join("data")
                }
            }
        }
    };
    
    if let Err(e) = fs::create_dir_all(&app_dir) {
        return Err(format!("Failed to create app directory: {}", e));
    }
    
    let file_path = app_dir.join(&filename);
    
    match serde_json::to_string_pretty(&data) {
        Ok(json_string) => {
            match fs::write(&file_path, json_string) {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Failed to write file: {}", e))
            }
        },
        Err(e) => Err(format!("Failed to serialize JSON: {}", e))
    }
}

#[tauri::command]
async fn read_json_file(filename: String) -> Result<JsonValue, String> {
    let app_dir = match std::env::var("APPDATA") {
        Ok(appdata) => Path::new(&appdata).join("ucanduit"),
        Err(_) => {
            match std::env::var("HOME") {
                Ok(home) => Path::new(&home).join(".ucanduit"),
                Err(_) => {
                    std::env::current_dir().unwrap().join("data")
                }
            }
        }
    };
    
    let file_path = app_dir.join(&filename);
    
    if !file_path.exists() {
        return Err(format!("File does not exist: {}", filename));
    }
    
    match fs::read_to_string(&file_path) {
        Ok(contents) => {
            match serde_json::from_str::<JsonValue>(&contents) {
                Ok(json_data) => Ok(json_data),
                Err(e) => Err(format!("Failed to parse JSON: {}", e))
            }
        },
        Err(e) => Err(format!("Failed to read file: {}", e))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_http::init())
    .invoke_handler(tauri::generate_handler![
      write_json_file,
      read_json_file
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
