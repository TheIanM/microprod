import SwiftUI

/// Lightweight observable shared between TimerView and ContentView.
/// ContentView reads this to render the timer progress ring around the oscilloscope.
/// TimerView mutates it as the timer ticks.
@Observable
final class TimerState {
    var isRunning = false
    var progress: Double = 0   // 0.0 (start) → 1.0 (complete)
    var remainingSeconds: Int = 0
    var totalSeconds: Int = 0

    /// Ring color mirrors the original JS app:
    ///   < 60s remaining → red
    ///   < 300s (5 min) remaining → orange
    ///   otherwise → udu-green
    var ringColor: Color {
        guard totalSeconds > 0 else { return Color(red: 0.306, green: 0.812, blue: 0.616) }
        if remainingSeconds < 60  { return .red }
        if remainingSeconds < 300 { return .orange }
        return Color(red: 0.306, green: 0.812, blue: 0.616)  // udu-green
    }
}
