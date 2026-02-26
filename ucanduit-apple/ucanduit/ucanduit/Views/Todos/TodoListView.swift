import SwiftUI
import SwiftData

struct TodoListView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.isEmbedded) private var isEmbedded
    @Query(sort: \TodoList.position) private var lists: [TodoList]

    @State private var newListName = ""
    @State private var selectedList: TodoList?
    @State private var newItemText = ""
    @State private var priorityFilter: Priority? = nil

    var body: some View {
        VStack(spacing: 0) {
            // Priority filter bar — "All" + each priority level
            HStack(spacing: 6) {
                ForEach([nil] + Priority.allCases.map { Optional($0) }, id: \.self) { priority in
                    Button(priority?.rawValue.capitalized ?? "All") {
                        priorityFilter = priority
                    }
                    .buttonStyle(.ucanduit)
                    .opacity(priorityFilter == priority ? 1.0 : 0.6)
                }
            }
            .padding(.vertical, 8)

            if let list = selectedList {
                itemsView(for: list)
            } else {
                listsView
            }
        }
        .toolbar {
            if selectedList != nil {
                ToolbarItem(placement: .navigation) {
                    Button("Back") { selectedList = nil }
                        .buttonStyle(.ucanduit)
                }
            }
        }
    }

    // MARK: - Lists View

    private var listsView: some View {
        VStack(spacing: 8) {
            HStack {
                TextField("New list name", text: $newListName)
                    .font(.quicksand(14))
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { addList() }
                Button("Add") { addList() }
                    .buttonStyle(.ucanduit)
                    .disabled(newListName.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            List {
                ForEach(filteredLists) { list in
                    Button {
                        selectedList = list
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(list.name)
                                    .font(.quicksand(14, weight: .medium))
                                let incomplete = list.items.filter { $0.status == .todo }.count
                                Text("\(incomplete) pending / \(list.items.count) total")
                                    .font(.quicksand(12))
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            priorityBadge(list.priority)
                        }
                    }
                    .buttonStyle(.plain)
                }
                .onDelete(perform: deleteLists)
            }
            .listStyle(.plain)
            .scrollDisabled(isEmbedded)
        }
    }

    // MARK: - Items View

    private func itemsView(for list: TodoList) -> some View {
        VStack(spacing: 8) {
            HStack {
                TextField("New task", text: $newItemText)
                    .font(.quicksand(14))
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { addItem(to: list) }
                Button("Add") { addItem(to: list) }
                    .buttonStyle(.ucanduit)
                    .disabled(newItemText.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            List {
                let incomplete = list.items
                    .filter { $0.status == .todo }
                    .sorted { $0.createdAt < $1.createdAt }
                let completed = list.items
                    .filter { $0.status == .done }
                    .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }

                if !incomplete.isEmpty {
                    Section("To Do") {
                        ForEach(incomplete) { item in todoItemRow(item) }
                    }
                }
                if !completed.isEmpty {
                    Section("Done") {
                        ForEach(completed) { item in todoItemRow(item) }
                    }
                }
            }
            .listStyle(.plain)
            .scrollDisabled(isEmbedded)
        }
    }

    private func todoItemRow(_ item: TodoItem) -> some View {
        HStack {
            Button { toggleItem(item) } label: {
                Image(systemName: item.status == .done ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(item.status == .done ? .green : .secondary)
            }
            .buttonStyle(.plain)

            Text(item.text)
                .font(.quicksand(14))
                .strikethrough(item.status == .done)
                .foregroundStyle(item.status == .done ? .secondary : .primary)

            Spacer()
            priorityBadge(item.priority)
        }
    }

    // MARK: - Actions

    private func addList() {
        let name = newListName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        modelContext.insert(TodoList(name: name, position: lists.count))
        newListName = ""
    }

    private func addItem(to list: TodoList) {
        let text = newItemText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        let item = TodoItem(text: text, priority: list.priority, position: list.items.count)
        item.list = list
        modelContext.insert(item)
        newItemText = ""
    }

    private func toggleItem(_ item: TodoItem) {
        item.status = (item.status == .todo) ? .done : .todo
        item.completedAt = (item.status == .done) ? Date() : nil
    }

    private func deleteLists(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(filteredLists[index])
        }
    }

    // MARK: - Helpers

    private var filteredLists: [TodoList] {
        guard let filter = priorityFilter else { return lists }
        return lists.filter { $0.priority == filter }
    }

    private func priorityBadge(_ priority: Priority) -> some View {
        HStack(spacing: 3) {
            // Iconoir priority arrow icons (coloured by priority)
            switch priority {
            case .high:
                IconoirIcon("priority-up", size: 14).foregroundStyle(.red)
            case .medium:
                IconoirIcon("priority-medium", size: 14).foregroundStyle(.orange)
            case .low:
                IconoirIcon("priority-down", size: 14).foregroundStyle(.blue)
            }
        }
    }
}
