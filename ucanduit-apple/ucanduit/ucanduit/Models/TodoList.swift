import Foundation
import SwiftData

@Model
final class TodoList {
    var id: String
    var name: String
    var priority: Priority
    var position: Int
    var createdAt: Date

    // Cascade: deleting a list deletes its items
    @Relationship(deleteRule: .cascade, inverse: \TodoItem.list)
    var items: [TodoItem]

    init(name: String, priority: Priority = .medium, position: Int = 0) {
        self.id = UUID().uuidString
        self.name = name
        self.priority = priority
        self.position = position
        self.createdAt = Date()
        self.items = []
    }
}
