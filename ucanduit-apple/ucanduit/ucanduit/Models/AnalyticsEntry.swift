import Foundation
import SwiftData

@Model
final class AnalyticsEntry {
    var id: String
    var toolName: String
    var usageCount: Int
    var lastUsed: Date

    init(toolName: String) {
        self.id = UUID().uuidString
        self.toolName = toolName
        self.usageCount = 0
        self.lastUsed = Date()
    }
}
