import Foundation
import SwiftData

/// Priority levels matching the JS app's 'high'/'medium'/'low' values
enum Priority: String, Codable, CaseIterable {
    case high, medium, low
}

/// Task status matching the JS app's 'todo'/'done' values
enum TaskStatus: String, Codable {
    case todo, done
}

@Model
final class TodoItem {
    var id: String
    var text: String
    var status: TaskStatus
    var priority: Priority
    var dueDate: Date?
    var position: Int
    var createdAt: Date
    var completedAt: Date?

    // Relationship back to parent list
    var list: TodoList?

    init(text: String, priority: Priority = .medium, position: Int = 0) {
        self.id = UUID().uuidString
        self.text = text
        self.status = .todo
        self.priority = priority
        self.position = position
        self.createdAt = Date()
    }
}
