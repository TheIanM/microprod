import SwiftUI
import SwiftData

/// Kanban board view — two columns (To Do / Done) with drag-and-drop between them.
/// Dragging a card between columns updates the TodoItem's status in SwiftData.
struct KanbanView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TodoList.position) private var lists: [TodoList]

    @State private var selectedList: TodoList?

    var body: some View {
        VStack {
            // List picker — only shown when there are multiple lists
            if lists.count > 1 {
                Picker("List", selection: $selectedList) {
                    Text("Select a list").tag(nil as TodoList?)
                    ForEach(lists) { list in
                        Text(list.name).tag(list as TodoList?)
                    }
                }
                .pickerStyle(.segmented)
                .padding()
            }

            if let list = selectedList ?? lists.first {
                kanbanBoard(for: list)
            } else {
                ContentUnavailableView(
                    "No Lists",
                    systemImage: "list.bullet",
                    description: Text("Create a todo list first")
                )
            }
        }
        .navigationTitle("Kanban")
        .onAppear {
            if selectedList == nil { selectedList = lists.first }
        }
    }

    // MARK: - Board

    private func kanbanBoard(for list: TodoList) -> some View {
        HStack(alignment: .top, spacing: 12) {
            kanbanColumn(
                title: "To Do",
                items: list.items.filter { $0.status == .todo },
                targetStatus: .todo
            )
            kanbanColumn(
                title: "Done",
                items: list.items.filter { $0.status == .done },
                targetStatus: .done
            )
        }
        .padding()
    }

    private func kanbanColumn(title: String, items: [TodoItem], targetStatus: TaskStatus) -> some View {
        VStack(alignment: .leading) {
            HStack {
                Text(title).font(.headline)
                Spacer()
                Text("\(items.count)").font(.caption).foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(items.sorted { $0.createdAt < $1.createdAt }) { item in
                        kanbanCard(item)
                            .draggable(item.id) // drag the item's string ID
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.gray.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            // Accept drops — move the dropped item to this column's status
            .dropDestination(for: String.self) { droppedIds, _ in
                for droppedId in droppedIds {
                    guard let item = findItem(id: droppedId) else { continue }
                    item.status = targetStatus
                    item.completedAt = (targetStatus == .done) ? Date() : nil
                }
                return true
            }
        }
    }

    // MARK: - Card

    private func kanbanCard(_ item: TodoItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.text).font(.body)
            HStack {
                Text(item.priority.rawValue.capitalized)
                    .font(.caption2)
                    .foregroundStyle(priorityColor(item.priority))
                Spacer()
                if let date = item.dueDate {
                    Text(date, style: .date)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(8)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 6))
        .shadow(radius: 1)
    }

    // MARK: - Helpers

    /// Search all lists for a TodoItem by its string ID
    private func findItem(id: String) -> TodoItem? {
        for list in lists {
            if let item = list.items.first(where: { $0.id == id }) { return item }
        }
        return nil
    }

    private func priorityColor(_ priority: Priority) -> Color {
        switch priority {
        case .high:   return .red
        case .medium: return .orange
        case .low:    return .blue
        }
    }
}
