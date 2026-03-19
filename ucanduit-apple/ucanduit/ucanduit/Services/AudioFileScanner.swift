import Foundation

/// A directory of audio files (mirrors Rust's AudioDirectory struct)
struct AudioDirectory: Hashable {
    let name: String
    let path: URL
    let fileCount: Int
}

/// An audio file (mirrors Rust's AudioFile struct)
struct AudioFile: Identifiable {
    var id: URL { path }   // URL is unique per file — safe as an ID
    let name: String
    let path: URL
    let ext: String
}

/// Scans the app bundle's audio resource directory.
/// Replaces the Tauri backend's scan_audio_directories/scan_audio_directory commands.
struct AudioFileScanner {
    static let supportedFormats = ["mp3", "wav", "ogg", "m4a", "aac", "flac"]

    /// Returns all subdirectories inside the bundled `audio/` folder
    static func scanDirectories() -> [AudioDirectory] {
        guard let audioURL = Bundle.main.resourceURL?.appendingPathComponent("audio") else {
            return []
        }

        let fm = FileManager.default
        guard let contents = try? fm.contentsOfDirectory(
            at: audioURL,
            includingPropertiesForKeys: [.isDirectoryKey]
        ) else {
            return []
        }

        return contents.compactMap { url in
            var isDir: ObjCBool = false
            guard fm.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue else {
                return nil
            }
            let files = scanDirectory(at: url)
            return AudioDirectory(name: url.lastPathComponent, path: url, fileCount: files.count)
        }
    }

    /// Returns all audio files in a specific directory (recursive)
    static func scanDirectory(at url: URL) -> [AudioFile] {
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(
            at: url,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var files: [AudioFile] = []
        for case let fileURL as URL in enumerator {
            let ext = fileURL.pathExtension.lowercased()
            if supportedFormats.contains(ext) {
                files.append(AudioFile(name: fileURL.lastPathComponent, path: fileURL, ext: ext))
            }
        }
        return files
    }
}
