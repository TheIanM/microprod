import SwiftUI
import SwiftData

struct TodoListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TodoList.position) private var lists: [TodoList]

    @State private var newListName = ""
    @State private var selectedList: TodoList?
    @State private var newItemText = ""
    @State private var priorityFilter: Priority? = nil

    var body: some View {
        VStack(spacing: 0) {
            // Priority filter bar — "All" + each priority level
            HStack {
                ForEach([nil] + Priority.allCases.map { Optional($0) }, id: \.self) { priority in
                    Button(priority?.rawValue.capitalized ?? "All") {
                        priorityFilter = priority
                    }
                    .buttonStyle(.bordered)
                    .tint(priorityFilter == priority ? .accentColor : .secondary)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)

            if let list = selectedList {
                itemsView(for: list)
            } else {
                listsView
            }
        }
        .navigationTitle(selectedList?.name ?? "Todo Lists")
        .toolbar {
            if selectedList != nil {
                ToolbarItem(placement: .navigation) {
                    Button("Back") { selectedList = nil }
                }
            }
        }
    }

    // MARK: - Lists View

    private var listsView: some View {
        VStack {
            HStack {
                TextField("New list name", text: $newListName)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { addList() }
                Button("Add") { addList() }
                    .disabled(newListName.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()

            List {
                ForEach(filteredLists) { list in
                    Button {
                        selectedList = list
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(list.name).font(.headline)
                                let incomplete = list.items.filter { $0.status == .todo }.count
                                Text("\(incomplete) pending / \(list.items.count) total")
                                    .font(.caption)
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
        }
    }

    // MARK: - Items View

    private func itemsView(for list: TodoList) -> some View {
        VStack {
            HStack {
                TextField("New task", text: $newItemText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { addItem(to: list) }
                Button("Add") { addItem(to: list) }
                    .disabled(newItemText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()

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
        Text(priority.rawValue.capitalized)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(priorityColor(priority).opacity(0.2))
            .foregroundStyle(priorityColor(priority))
            .clipShape(Capsule())
    }

    private func priorityColor(_ priority: Priority) -> Color {
        switch priority {
        case .high:   return .red
        case .medium: return .orange
        case .low:    return .blue
        }
    }
}
