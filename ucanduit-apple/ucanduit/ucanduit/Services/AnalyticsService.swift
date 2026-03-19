import Foundation
import SwiftData

/// Tracks tool usage, mirroring analytics.js in the JS app.
@Observable
final class AnalyticsService {
    private var modelContext: ModelContext?
    private(set) var sessionStart = Date()

    func configure(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    /// Increment the usage counter for a named tool
    func trackUsage(tool: String) {
        guard let context = modelContext else { return }

        let descriptor = FetchDescriptor<AnalyticsEntry>(
            predicate: #Predicate { $0.toolName == tool }
        )

        if let existing = try? context.fetch(descriptor).first {
            existing.usageCount += 1
            existing.lastUsed = Date()
        } else {
            let entry = AnalyticsEntry(toolName: tool)
            entry.usageCount = 1
            context.insert(entry)
        }
    }

    func trackTimerStart(minutes: Int) { trackUsage(tool: "timer") }
    func trackTimerComplete()          { trackUsage(tool: "timer_complete") }
    func trackTodoCreated()            { trackUsage(tool: "todo_created") }
    func trackTodoCompleted()          { trackUsage(tool: "todo_completed") }
    func trackMemoCreated()            { trackUsage(tool: "memo_created") }
}
