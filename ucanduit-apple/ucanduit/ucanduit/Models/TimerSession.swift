import Foundation
import SwiftData

/// Session types matching the JS app's timer presets
enum SessionType: String, Codable, CaseIterable {
    case pomodoro, shortBreak, longBreak, focus, quick, custom
}

@Model
final class TimerSession {
    var id: String
    var duration: Int           // Total planned seconds
    var type: SessionType
    var completed: Bool
    var startTime: Date
    var endTime: Date?
    var actualDuration: Int?    // Seconds actually elapsed before stop/complete

    init(duration: Int, type: SessionType) {
        self.id = UUID().uuidString
        self.duration = duration
        self.type = type
        self.completed = false
        self.startTime = Date()
    }
}
