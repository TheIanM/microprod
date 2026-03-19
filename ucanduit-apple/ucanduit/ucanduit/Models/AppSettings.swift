import Foundation
import SwiftData

/// Singleton settings model — only one instance should ever exist.
/// Mirrors the JS app's settings structure.
@Model
final class AppSettings {
    // Timer
    var defaultTimerMinutes: Int
    var timerSoundEnabled: Bool

    // UI
    var theme: String           // "auto", "light", "dark"
    var alwaysOnTop: Bool
    var showNotifications: Bool

    // Audio
    var masterVolume: Float
    var ambientVolume: Float
    var musicVolume: Float

    // General
    var analyticsEnabled: Bool

    init() {
        self.defaultTimerMinutes = 25
        self.timerSoundEnabled = true
        self.theme = "auto"
        self.alwaysOnTop = true
        self.showNotifications = true
        self.masterVolume = 0.7
        self.ambientVolume = 0.5
        self.musicVolume = 0.8
        self.analyticsEnabled = true
    }
}
