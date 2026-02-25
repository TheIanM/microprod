#if os(macOS)
import AppKit
import SwiftUI

/// Configures the main window as an always-on-top floating panel.
/// SwiftUI has no native always-on-top support, so we bridge to AppKit.
final class FloatingWindowManager {
    static func configureMainWindow() {
        // Defer to next runloop tick so the window exists by the time we configure it
        DispatchQueue.main.async {
            if let window = NSApplication.shared.windows.first {
                window.level = .floating
                window.isOpaque = false
                window.backgroundColor = .clear
                window.titlebarAppearsTransparent = true
                window.styleMask.insert(.fullSizeContentView)
            }
        }
    }

    /// Toggle always-on-top for the main window
    static func setAlwaysOnTop(_ enabled: Bool) {
        if let window = NSApplication.shared.windows.first {
            window.level = enabled ? .floating : .normal
        }
    }
}
#endif
