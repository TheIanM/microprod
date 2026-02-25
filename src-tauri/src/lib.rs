use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub extension: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryContents {
    pub directory: String,
    pub files: Vec<AudioFile>,
    pub count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDirectory {
    pub name: String,
    pub path: String,
    pub file_count: usize,
}

const SUPPORTED_AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"];

/// Resolve the audio base directory. In production, audio files live in the
/// app's resource directory (Vite copies public/ contents to dist/, which Tauri
/// bundles into Resources/). In dev mode, they're at <project-root>/public/audio/.
fn resolve_audio_base(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Try resource dir first (production bundle)
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let prod_path = resource_dir.join("audio");
        if prod_path.exists() {
            return Ok(prod_path);
        }
    }

    // Fallback: dev mode path (CWD is src-tauri/, parent is project root)
    let current_dir =
        std::env::current_dir().map_err(|e| format!("Failed to get current dir: {}", e))?;
    if let Some(project_root) = current_dir.parent() {
        let dev_path = project_root.join("public").join("audio");
        if dev_path.exists() {
            return Ok(dev_path);
        }
    }

    Err("Could not find audio directory in resource or dev paths".to_string())
}

#[tauri::command]
async fn scan_audio_directories(app_handle: tauri::AppHandle) -> Result<Vec<AudioDirectory>, String> {
    let audio_path = resolve_audio_base(&app_handle)?;

    if !audio_path.exists() {
        return Err("public/audio directory does not exist".to_string());
    }

    let mut audio_directories = Vec::new();

    for entry in
        fs::read_dir(&audio_path).map_err(|e| format!("Failed to read audio dir: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let entry_path = entry.path();

        if entry_path.is_dir() {
            let dir_name = entry_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let audio_file_count = count_audio_files(&entry_path);

            if audio_file_count > 0 {
                audio_directories.push(AudioDirectory {
                    name: dir_name,
                    path: format!(
                        "/audio/{}",
                        entry_path.file_name().unwrap().to_string_lossy()
                    ),
                    file_count: audio_file_count,
                });
            }
        }
    }

    Ok(audio_directories)
}

#[tauri::command]
async fn scan_audio_directory(app_handle: tauri::AppHandle, directory_path: String) -> Result<DirectoryContents, String> {
    println!("🦀 Scanning directory: {}", directory_path);

    let audio_base = resolve_audio_base(&app_handle)?;
    // audio_base already points to the "audio" directory, so strip the leading
    // "/audio/" prefix from directory_path before joining.
    let relative = directory_path
        .trim_start_matches('/')
        .strip_prefix("audio/")
        .or_else(|| directory_path.trim_start_matches('/').strip_prefix("audio"))
        .unwrap_or(directory_path.trim_start_matches('/'));

    // Reject path traversal attempts (e.g. "../../etc/passwd")
    if relative.contains("..") {
        return Err("Invalid path: directory traversal not allowed".to_string());
    }

    let path = if relative.is_empty() {
        audio_base.clone()
    } else {
        audio_base.join(relative)
    };

    // Verify the resolved path is still within the audio base directory
    let canonical_base = audio_base.canonicalize().map_err(|e| format!("Failed to resolve audio base: {}", e))?;
    let canonical_path = path.canonicalize().map_err(|e| format!("Failed to resolve path: {}", e))?;
    if !canonical_path.starts_with(&canonical_base) {
        return Err("Invalid path: outside audio directory".to_string());
    }

    println!("🦀 Resolved path: {:?}", path);

    if !path.exists() {
        return Err(format!("Directory does not exist: {}", directory_path));
    }

    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", directory_path));
    }

    let mut audio_files = Vec::new();

    for entry in fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let file_path = entry.path();

        if file_path.is_file() {
            if let Some(extension) = file_path.extension() {
                if let Some(ext_str) = extension.to_str() {
                    let ext_lower = ext_str.to_lowercase();
                    if SUPPORTED_AUDIO_EXTENSIONS.contains(&ext_lower.as_str()) {
                        if let Some(file_name) = file_path.file_name() {
                            if let Some(name_str) = file_name.to_str() {
                                let metadata = fs::metadata(&file_path);
                                let size = metadata.map(|m| m.len()).unwrap_or(0);

                                audio_files.push(AudioFile {
                                    name: name_str.to_string(),
                                    path: file_path.to_string_lossy().to_string(),
                                    size,
                                    extension: ext_lower,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    let count = audio_files.len();

    Ok(DirectoryContents {
        directory: directory_path,
        files: audio_files,
        count,
    })
}

fn count_audio_files(dir_path: &Path) -> usize {
    let mut count = 0;

    if let Ok(entries) = fs::read_dir(dir_path) {
        for entry in entries {
            if let Ok(dir_entry) = entry {
                let file_path = dir_entry.path();
                if file_path.is_file() {
                    if let Some(extension) = file_path.extension() {
                        if let Some(ext_str) = extension.to_str() {
                            let ext_lower = ext_str.to_lowercase();
                            if SUPPORTED_AUDIO_EXTENSIONS.contains(&ext_lower.as_str()) {
                                count += 1;
                            }
                        }
                    }
                }
            }
        }
    }

    count
}

#[tauri::command]
async fn get_supported_audio_formats() -> Vec<String> {
    SUPPORTED_AUDIO_EXTENSIONS
        .iter()
        .map(|&s| s.to_string())
        .collect()
}

/// Validate that a JSON filename is safe: must start with "ucanduit-", end with ".json",
/// and contain no path separators. This prevents writing/reading arbitrary files.
fn validate_json_filename(filename: &str) -> Result<(), String> {
    if !filename.starts_with("ucanduit-") || !filename.ends_with(".json") {
        return Err(format!("Invalid filename: must match ucanduit-*.json pattern, got '{}'", filename));
    }
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err(format!("Invalid filename: path separators not allowed in '{}'", filename));
    }
    Ok(())
}

#[tauri::command]
async fn write_json_file(filename: String, data: JsonValue) -> Result<(), String> {
    validate_json_filename(&filename)?;

    let app_dir = match std::env::var("APPDATA") {
        Ok(appdata) => Path::new(&appdata).join("ucanduit"),
        Err(_) => match std::env::var("HOME") {
            Ok(home) => Path::new(&home).join(".ucanduit"),
            Err(_) => std::env::current_dir().unwrap().join("data"),
        },
    };

    if let Err(e) = fs::create_dir_all(&app_dir) {
        return Err(format!("Failed to create app directory: {}", e));
    }

    let file_path = app_dir.join(&filename);

    match serde_json::to_string_pretty(&data) {
        Ok(json_string) => match fs::write(&file_path, json_string) {
            Ok(_) => Ok(()),
            Err(e) => Err(format!("Failed to write file: {}", e)),
        },
        Err(e) => Err(format!("Failed to serialize JSON: {}", e)),
    }
}

#[tauri::command]
async fn read_json_file(filename: String) -> Result<JsonValue, String> {
    validate_json_filename(&filename)?;

    let app_dir = match std::env::var("APPDATA") {
        Ok(appdata) => Path::new(&appdata).join("ucanduit"),
        Err(_) => match std::env::var("HOME") {
            Ok(home) => Path::new(&home).join(".ucanduit"),
            Err(_) => std::env::current_dir().unwrap().join("data"),
        },
    };

    let file_path = app_dir.join(&filename);

    if !file_path.exists() {
        return Err(format!("File does not exist: {}", filename));
    }

    match fs::read_to_string(&file_path) {
        Ok(contents) => match serde_json::from_str::<JsonValue>(&contents) {
            Ok(json_data) => Ok(json_data),
            Err(e) => Err(format!("Failed to parse JSON: {}", e)),
        },
        Err(e) => Err(format!("Failed to read file: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            scan_audio_directory,
            scan_audio_directories,
            get_supported_audio_formats,
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
