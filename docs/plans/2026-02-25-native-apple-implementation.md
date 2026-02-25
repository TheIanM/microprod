# Native Apple Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port ucanduit from Tauri to a native SwiftUI app targeting macOS, iOS, and iPadOS with full feature parity.

**Architecture:** Single Xcode multi-platform project using SwiftUI for UI, SwiftData for persistence, and AVFoundation for audio. Platform-specific code isolated in Platform/ directory for macOS floating windows and iOS adaptive navigation.

**Tech Stack:** Swift, SwiftUI, SwiftData, AVFoundation, URLSession

**Design Doc:** `docs/plans/2026-02-25-native-apple-migration-design.md`

---

### Task 1: Xcode Project Scaffolding

**Files:**
- Create: `ucanduit-apple/ucanduit.xcodeproj` (via Xcode project generation)
- Create: `ucanduit-apple/ucanduit/ucanduitApp.swift`
- Create: `ucanduit-apple/ucanduit/ContentView.swift`
- Create: `ucanduit-apple/ucanduit/Assets.xcassets`

**Step 1: Create the branch**

```bash
cd /Users/devian/Documents/productivity/ucanduit-v2
git checkout -b native-apple
```

**Step 2: Create Xcode project directory structure**

```bash
mkdir -p ucanduit-apple/ucanduit/{Models,Services,Views/{Oscilloscope,Timer,Todos,Memos,Audio,Weather,Settings},Platform/{macOS,iOS},Resources}
```

**Step 3: Create the Swift Package / Xcode project**

Create `ucanduit-apple/Package.swift` for initial development (we'll convert to .xcodeproj when adding platform targets):

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ucanduit",
    platforms: [
        .macOS(.v14),
        .iOS(.v17)
    ],
    targets: [
        .executableTarget(
            name: "ucanduit",
            path: "ucanduit"
        )
    ]
)
```

> **Note:** We use macOS 14+ and iOS 17+ as minimum targets because SwiftData requires these versions. This is non-negotiable.

**Step 4: Create the app entry point**

`ucanduit-apple/ucanduit/ucanduitApp.swift`:
```swift
import SwiftUI
import SwiftData

@main
struct UcanduitApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            // Models will be added as we build them
        ])
        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false
        )
        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
    }
}
```

**Step 5: Create placeholder ContentView**

`ucanduit-apple/ucanduit/ContentView.swift`:
```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Text("ucanduit")
                .font(.largeTitle)
            Text("Native Apple Edition")
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
```

**Step 6: Build and verify**

```bash
cd ucanduit-apple
swift build
```

Expected: Clean build, no errors.

**Step 7: Commit**

```bash
git add ucanduit-apple/
git commit -m "feat: scaffold native Apple SwiftUI project structure"
```

---

### Task 2: SwiftData Models

**Files:**
- Create: `ucanduit-apple/ucanduit/Models/TodoList.swift`
- Create: `ucanduit-apple/ucanduit/Models/TodoItem.swift`
- Create: `ucanduit-apple/ucanduit/Models/Memo.swift`
- Create: `ucanduit-apple/ucanduit/Models/TimerSession.swift`
- Create: `ucanduit-apple/ucanduit/Models/AppSettings.swift`
- Create: `ucanduit-apple/ucanduit/Models/AnalyticsEntry.swift`
- Modify: `ucanduit-apple/ucanduit/ucanduitApp.swift` (register models)

**Step 1: Create TodoList and TodoItem models**

`ucanduit-apple/ucanduit/Models/TodoItem.swift`:
```swift
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
```

`ucanduit-apple/ucanduit/Models/TodoList.swift`:
```swift
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
```

**Step 2: Create Memo model**

`ucanduit-apple/ucanduit/Models/Memo.swift`:
```swift
import Foundation
import SwiftData

@Model
final class Memo {
    var id: String
    var title: String
    var content: String
    var preview: String
    var createdAt: Date
    var updatedAt: Date

    init(content: String = "") {
        self.id = UUID().uuidString
        self.content = content
        self.createdAt = Date()
        self.updatedAt = Date()

        // Generate title from first line, stripping markdown
        let firstLine = content.components(separatedBy: .newlines).first ?? ""
        let cleaned = firstLine.replacingOccurrences(
            of: "[#*_`~\\[\\]()]",
            with: "",
            options: .regularExpression
        )
        self.title = String(cleaned.prefix(50)).isEmpty ? "Untitled Note" : String(cleaned.prefix(50))

        // Preview: first 80 chars, no markdown
        let plain = content.replacingOccurrences(
            of: "[#*_`~\\[\\]()]",
            with: "",
            options: .regularExpression
        )
        self.preview = String(plain.prefix(80))
    }
}
```

**Step 3: Create TimerSession model**

`ucanduit-apple/ucanduit/Models/TimerSession.swift`:
```swift
import Foundation
import SwiftData

/// Session types matching the JS app's timer presets
enum SessionType: String, Codable, CaseIterable {
    case pomodoro, shortBreak, longBreak, focus, quick, custom
}

@Model
final class TimerSession {
    var id: String
    var duration: Int          // Total seconds
    var type: SessionType
    var completed: Bool
    var startTime: Date
    var endTime: Date?
    var actualDuration: Int?   // Seconds actually elapsed

    init(duration: Int, type: SessionType) {
        self.id = UUID().uuidString
        self.duration = duration
        self.type = type
        self.completed = false
        self.startTime = Date()
    }
}
```

**Step 4: Create AppSettings model**

`ucanduit-apple/ucanduit/Models/AppSettings.swift`:
```swift
import Foundation
import SwiftData

/// Singleton settings model — only one instance should exist.
/// Mirrors the JS app's settings structure.
@Model
final class AppSettings {
    // Timer
    var defaultTimerMinutes: Int
    var timerSoundEnabled: Bool

    // UI
    var theme: String          // "auto", "light", "dark"
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
```

**Step 5: Create AnalyticsEntry model**

`ucanduit-apple/ucanduit/Models/AnalyticsEntry.swift`:
```swift
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
```

**Step 6: Register all models in the app**

Update `ucanduitApp.swift` — replace the schema line:
```swift
let schema = Schema([
    TodoList.self,
    TodoItem.self,
    Memo.self,
    TimerSession.self,
    AppSettings.self,
    AnalyticsEntry.self,
])
```

**Step 7: Build and verify**

```bash
cd ucanduit-apple
swift build
```

Expected: Clean build. SwiftData models compile without errors.

**Step 8: Commit**

```bash
git add ucanduit-apple/ucanduit/Models/ ucanduit-apple/ucanduit/ucanduitApp.swift
git commit -m "feat: add SwiftData models for todos, memos, timer, settings, analytics"
```

---

### Task 3: Settings Service & App Settings View

**Files:**
- Create: `ucanduit-apple/ucanduit/Views/Settings/SettingsView.swift`

Settings is the simplest tool and establishes the SwiftData CRUD pattern all other views will follow.

**Step 1: Create SettingsView**

`ucanduit-apple/ucanduit/Views/Settings/SettingsView.swift`:
```swift
import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var allSettings: [AppSettings]

    /// Returns the singleton settings, creating defaults if none exist
    private var settings: AppSettings {
        if let existing = allSettings.first {
            return existing
        }
        let newSettings = AppSettings()
        modelContext.insert(newSettings)
        return newSettings
    }

    var body: some View {
        Form {
            // Timer section
            Section("Timer") {
                Stepper(
                    "Default duration: \(settings.defaultTimerMinutes) min",
                    value: Bindable(settings).defaultTimerMinutes,
                    in: 1...120
                )
                Toggle("Timer sounds", isOn: Bindable(settings).timerSoundEnabled)
            }

            // Audio section
            Section("Audio") {
                VolumeSlider(label: "Master", value: Bindable(settings).masterVolume)
                VolumeSlider(label: "Ambient", value: Bindable(settings).ambientVolume)
                VolumeSlider(label: "Music", value: Bindable(settings).musicVolume)
            }

            // UI section
            Section("Appearance") {
                Picker("Theme", selection: Bindable(settings).theme) {
                    Text("Auto").tag("auto")
                    Text("Light").tag("light")
                    Text("Dark").tag("dark")
                }
                Toggle("Always on top", isOn: Bindable(settings).alwaysOnTop)
                Toggle("Notifications", isOn: Bindable(settings).showNotifications)
            }

            // General
            Section("General") {
                Toggle("Usage analytics", isOn: Bindable(settings).analyticsEnabled)
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Settings")
    }
}

/// Reusable volume slider (0.0 - 1.0 displayed as 0-100%)
struct VolumeSlider: View {
    let label: String
    @Binding var value: Float

    var body: some View {
        HStack {
            Text(label)
            Slider(value: $value, in: 0...1)
            Text("\(Int(value * 100))%")
                .monospacedDigit()
                .frame(width: 40, alignment: .trailing)
        }
    }
}
```

**Step 2: Build and verify**

```bash
cd ucanduit-apple && swift build
```

Expected: Clean build.

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/Views/Settings/
git commit -m "feat: add settings view with SwiftData persistence"
```

---

### Task 4: Timer Tool

**Files:**
- Create: `ucanduit-apple/ucanduit/Views/Timer/TimerView.swift`

**Step 1: Create TimerView**

`ucanduit-apple/ucanduit/Views/Timer/TimerView.swift`:
```swift
import SwiftUI
import SwiftData

struct TimerView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TimerSession.startTime, order: .reverse) private var sessions: [TimerSession]

    // Timer state
    @State private var totalSeconds: Int = 25 * 60
    @State private var remainingSeconds: Int = 25 * 60
    @State private var isRunning = false
    @State private var timer: Timer?
    @State private var currentSession: TimerSession?
    @State private var selectedPreset: SessionType = .pomodoro

    // Presets matching the JS app
    private let presets: [(SessionType, String, Int)] = [
        (.pomodoro, "Pomodoro", 25 * 60),
        (.quick, "Quick", 10 * 60),
        (.focus, "Focus", 45 * 60),
        (.shortBreak, "Short Break", 5 * 60),
        (.longBreak, "Long Break", 15 * 60),
    ]

    var body: some View {
        VStack(spacing: 16) {
            // Time display
            Text(formatTime(remainingSeconds))
                .font(.system(size: 48, weight: .light, design: .monospaced))
                .foregroundStyle(timerColor)

            // Progress ring
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.2), lineWidth: 4)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(timerColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: progress)
            }
            .frame(width: 120, height: 120)

            // Preset buttons
            HStack(spacing: 8) {
                ForEach(presets, id: \.0) { preset in
                    Button(preset.1) {
                        selectPreset(preset.0, seconds: preset.2)
                    }
                    .buttonStyle(.bordered)
                    .tint(selectedPreset == preset.0 ? .accentColor : .secondary)
                }
            }

            // Duration slider for custom
            VStack {
                Slider(
                    value: Binding(
                        get: { Double(totalSeconds) / 60.0 },
                        set: { setDuration(Int($0) * 60) }
                    ),
                    in: 1...120,
                    step: 1
                )
                .disabled(isRunning)
                Text("\(totalSeconds / 60) minutes")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Controls
            HStack(spacing: 16) {
                Button(isRunning ? "Pause" : "Start") {
                    isRunning ? pause() : start()
                }
                .buttonStyle(.borderedProminent)

                Button("Reset") {
                    reset()
                }
                .buttonStyle(.bordered)
                .disabled(!isRunning && remainingSeconds == totalSeconds)
            }

            // Session stats
            if !sessions.isEmpty {
                let completed = sessions.filter { $0.completed }
                Text("\(completed.count) sessions completed")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .navigationTitle("Timer")
    }

    // MARK: - Computed Properties

    private var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        return Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
    }

    /// Color changes based on time remaining, matching the JS app
    private var timerColor: Color {
        if remainingSeconds <= 60 { return .red }
        if remainingSeconds <= 300 { return .orange }
        return .green
    }

    // MARK: - Timer Actions

    private func start() {
        // Create a session record
        let session = TimerSession(duration: totalSeconds, type: selectedPreset)
        modelContext.insert(session)
        currentSession = session

        isRunning = true
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            if remainingSeconds > 0 {
                remainingSeconds -= 1
            } else {
                complete()
            }
        }
    }

    private func pause() {
        isRunning = false
        timer?.invalidate()
        timer = nil
    }

    private func reset() {
        pause()
        remainingSeconds = totalSeconds
        currentSession = nil
    }

    private func complete() {
        pause()
        if let session = currentSession {
            session.completed = true
            session.endTime = Date()
            session.actualDuration = totalSeconds - remainingSeconds
        }
        remainingSeconds = totalSeconds
        currentSession = nil
        // TODO: Play completion sound (Task 8: Audio Engine)
    }

    private func selectPreset(_ type: SessionType, seconds: Int) {
        guard !isRunning else { return }
        selectedPreset = type
        setDuration(seconds)
    }

    private func setDuration(_ seconds: Int) {
        guard !isRunning else { return }
        totalSeconds = max(60, min(seconds, 120 * 60))
        remainingSeconds = totalSeconds
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}
```

**Step 2: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/Views/Timer/
git commit -m "feat: add pomodoro timer with presets, progress ring, and session tracking"
```

---

### Task 5: Todo List Tool

**Files:**
- Create: `ucanduit-apple/ucanduit/Views/Todos/TodoListView.swift`
- Create: `ucanduit-apple/ucanduit/Views/Todos/KanbanView.swift`

**Step 1: Create TodoListView**

`ucanduit-apple/ucanduit/Views/Todos/TodoListView.swift`:
```swift
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
            // Priority filter bar
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
                // Item view for selected list
                itemsView(for: list)
            } else {
                // List of lists
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
            // Add new list
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
                                Text(list.name)
                                    .font(.headline)
                                let incomplete = list.items.filter { $0.status == .todo }.count
                                let total = list.items.count
                                Text("\(incomplete) pending / \(total) total")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            priorityBadge(list.priority)
                        }
                    }
                }
                .onDelete(perform: deleteLists)
            }
        }
    }

    // MARK: - Items View

    private func itemsView(for list: TodoList) -> some View {
        VStack {
            // Add new item
            HStack {
                TextField("New task", text: $newItemText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { addItem(to: list) }
                Button("Add") { addItem(to: list) }
                    .disabled(newItemText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding()

            List {
                // Incomplete items first, then completed
                let incomplete = list.items
                    .filter { $0.status == .todo }
                    .sorted { $0.createdAt < $1.createdAt }
                let completed = list.items
                    .filter { $0.status == .done }
                    .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }

                if !incomplete.isEmpty {
                    Section("To Do") {
                        ForEach(incomplete) { item in
                            todoItemRow(item)
                        }
                    }
                }

                if !completed.isEmpty {
                    Section("Done") {
                        ForEach(completed) { item in
                            todoItemRow(item)
                        }
                    }
                }
            }
        }
    }

    private func todoItemRow(_ item: TodoItem) -> some View {
        HStack {
            Button {
                toggleItem(item)
            } label: {
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
        let list = TodoList(name: name, position: lists.count)
        modelContext.insert(list)
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
        case .high: return .red
        case .medium: return .orange
        case .low: return .blue
        }
    }
}
```

**Step 2: Create KanbanView**

`ucanduit-apple/ucanduit/Views/Todos/KanbanView.swift`:
```swift
import SwiftUI
import SwiftData

/// Kanban board with drag-and-drop between columns.
/// Columns represent todo status: To Do, In Progress, Done.
/// Uses the same TodoItem model — status maps to columns.
struct KanbanView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \TodoList.position) private var lists: [TodoList]

    @State private var selectedList: TodoList?

    var body: some View {
        VStack {
            // List picker
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

    private func kanbanBoard(for list: TodoList) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // To Do column
            kanbanColumn(
                title: "To Do",
                items: list.items.filter { $0.status == .todo },
                targetStatus: .todo
            )

            // Done column
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
                Text(title)
                    .font(.headline)
                Spacer()
                Text("\(items.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 8)

            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(items.sorted { $0.createdAt < $1.createdAt }) { item in
                        kanbanCard(item)
                            .draggable(item.id) // Drag source
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.gray.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .dropDestination(for: String.self) { droppedIds, _ in
                // Move dropped items to this column's status
                for droppedId in droppedIds {
                    if let item = items.first(where: { $0.id == droppedId })
                        ?? findItem(id: droppedId)
                    {
                        item.status = targetStatus
                        if targetStatus == .done {
                            item.completedAt = Date()
                        } else {
                            item.completedAt = nil
                        }
                    }
                }
                return true
            }
        }
    }

    private func kanbanCard(_ item: TodoItem) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.text)
                .font(.body)
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

    /// Find any TodoItem across all lists by ID
    private func findItem(id: String) -> TodoItem? {
        for list in lists {
            if let item = list.items.first(where: { $0.id == id }) {
                return item
            }
        }
        return nil
    }

    private func priorityColor(_ priority: Priority) -> Color {
        switch priority {
        case .high: return .red
        case .medium: return .orange
        case .low: return .blue
        }
    }
}
```

**Step 3: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 4: Commit**

```bash
git add ucanduit-apple/ucanduit/Views/Todos/
git commit -m "feat: add todo list view with priorities and kanban board with drag-and-drop"
```

---

### Task 6: Memos Tool

**Files:**
- Create: `ucanduit-apple/ucanduit/Views/Memos/MemosView.swift`

**Step 1: Create MemosView**

`ucanduit-apple/ucanduit/Views/Memos/MemosView.swift`:
```swift
import SwiftUI
import SwiftData

struct MemosView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Memo.updatedAt, order: .reverse) private var memos: [Memo]

    @State private var selectedMemo: Memo?
    @State private var editorContent = ""

    var body: some View {
        HSplitView {
            // Memo list sidebar
            VStack {
                Button("New Memo") { createMemo() }
                    .padding(8)

                List(memos, selection: $selectedMemo) { memo in
                    VStack(alignment: .leading) {
                        Text(memo.title)
                            .font(.headline)
                            .lineLimit(1)
                        Text(memo.preview)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                        Text(memo.updatedAt, style: .relative)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    .tag(memo)
                    .contextMenu {
                        Button("Delete", role: .destructive) {
                            deleteMemo(memo)
                        }
                    }
                }
            }
            .frame(minWidth: 180, maxWidth: 250)

            // Editor
            if let memo = selectedMemo {
                TextEditor(text: Binding(
                    get: { memo.content },
                    set: { newValue in
                        memo.content = newValue
                        memo.updatedAt = Date()
                        updateMemoMetadata(memo)
                    }
                ))
                .font(.body)
                .padding()
            } else {
                ContentUnavailableView(
                    "No Memo Selected",
                    systemImage: "note.text",
                    description: Text("Select or create a memo")
                )
            }
        }
        .navigationTitle("Memos")
    }

    private func createMemo() {
        let memo = Memo(content: "")
        modelContext.insert(memo)
        selectedMemo = memo
    }

    private func deleteMemo(_ memo: Memo) {
        if selectedMemo == memo { selectedMemo = nil }
        modelContext.delete(memo)
    }

    /// Update title and preview from content (matches JS app behavior)
    private func updateMemoMetadata(_ memo: Memo) {
        let firstLine = memo.content.components(separatedBy: .newlines).first ?? ""
        let cleaned = firstLine.replacingOccurrences(
            of: "[#*_`~\\[\\]()]",
            with: "",
            options: .regularExpression
        )
        memo.title = cleaned.trimmingCharacters(in: .whitespaces).isEmpty
            ? "Untitled Note"
            : String(cleaned.prefix(50))

        let plain = memo.content.replacingOccurrences(
            of: "[#*_`~\\[\\]()]",
            with: "",
            options: .regularExpression
        )
        memo.preview = String(plain.prefix(80))
    }
}
```

**Step 2: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/Views/Memos/
git commit -m "feat: add memos view with split-view editor and auto-save"
```

---

### Task 7: Weather Service & View

**Files:**
- Create: `ucanduit-apple/ucanduit/Services/WeatherService.swift`
- Create: `ucanduit-apple/ucanduit/Views/Weather/WeatherView.swift`

**Step 1: Create WeatherService**

`ucanduit-apple/ucanduit/Services/WeatherService.swift`:
```swift
import Foundation

/// Weather data model matching the JS app's WeatherData structure
struct WeatherData {
    let location: String
    let temperature: Double       // Celsius
    let feelsLike: Double
    let condition: String         // Normalized: "clear", "cloudy", "rain", etc.
    let humidity: Int?
    let windSpeed: Int?           // km/h
    let windDirection: String?
    let pressure: Double?         // kPa
    let timestamp: Date
}

/// Fetches weather from Environment Canada's public API.
/// Currently hardcoded to Toronto (matching the JS app).
@Observable
final class WeatherService {
    var currentWeather: WeatherData?
    var isLoading = false
    var errorMessage: String?

    // Cache: 30-minute TTL matching the JS app
    private var cachedWeather: WeatherData?
    private var cacheTimestamp: Date?
    private let cacheTTL: TimeInterval = 30 * 60

    // Toronto, ON — same as JS app's hardcoded location
    private let cityCode = "on-143"
    private let locationName = "Toronto, ON"

    func fetchWeather() async {
        // Return cache if fresh
        if let cached = cachedWeather,
           let ts = cacheTimestamp,
           Date().timeIntervalSince(ts) < cacheTTL
        {
            currentWeather = cached
            return
        }

        isLoading = true
        errorMessage = nil

        let urlString = "https://weather.gc.ca/rss/city/\(cityCode)_e.xml"
        guard let url = URL(string: urlString) else {
            errorMessage = "Invalid weather URL"
            isLoading = false
            return
        }

        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let xml = String(data: data, encoding: .utf8) else {
                throw URLError(.cannotDecodeContentData)
            }

            let weather = parseWeatherXML(xml)
            currentWeather = weather
            cachedWeather = weather
            cacheTimestamp = Date()
        } catch {
            errorMessage = "Weather unavailable — have you tried looking out a window?"
            // Return stale cache if available
            if let cached = cachedWeather {
                currentWeather = cached
            }
        }

        isLoading = false
    }

    /// Parse Environment Canada RSS XML for current conditions.
    /// Uses the same regex patterns as the JS app's weather-service.js.
    private func parseWeatherXML(_ xml: String) -> WeatherData? {
        // Extract temperature from first <item> title
        var temperature: Double = 0
        if let range = xml.range(of: "(-?\\d+\\.?\\d*)°C", options: .regularExpression) {
            let match = String(xml[range]).replacingOccurrences(of: "°C", with: "")
            temperature = Double(match) ?? 0
        }

        // Extract condition from title
        var condition = "unknown"
        if let range = xml.range(of: "<title>Current Conditions: ([^<]+)</title>",
                                  options: .regularExpression) {
            let full = String(xml[range])
            condition = full
                .replacingOccurrences(of: "<title>Current Conditions: ", with: "")
                .replacingOccurrences(of: "</title>", with: "")
                .lowercased()
        }

        // Extract humidity
        var humidity: Int?
        if let range = xml.range(of: "Humidity:\\s*(\\d+)\\s*%", options: .regularExpression) {
            let match = String(xml[range])
                .replacingOccurrences(of: "Humidity:", with: "")
                .replacingOccurrences(of: "%", with: "")
                .trimmingCharacters(in: .whitespaces)
            humidity = Int(match)
        }

        // Extract wind
        var windSpeed: Int?
        var windDirection: String?
        if let range = xml.range(of: "Wind:\\s*([A-Z]+)\\s*(\\d+)\\s*km/h",
                                  options: .regularExpression) {
            let match = String(xml[range])
            let parts = match.components(separatedBy: .whitespaces).filter { !$0.isEmpty }
            if parts.count >= 3 {
                windDirection = parts[1]
                windSpeed = Int(parts[2])
            }
        }

        return WeatherData(
            location: locationName,
            temperature: temperature,
            feelsLike: temperature, // Simplified; humidex parsing can be added later
            condition: normalizeCondition(condition),
            humidity: humidity,
            windSpeed: windSpeed,
            windDirection: windDirection,
            pressure: nil,
            timestamp: Date()
        )
    }

    /// Normalize condition strings to match the JS app's categories
    private func normalizeCondition(_ raw: String) -> String {
        let lower = raw.lowercased()
        if lower.contains("clear") || lower.contains("sunny") { return "clear" }
        if lower.contains("cloud") || lower.contains("overcast") { return "cloudy" }
        if lower.contains("rain") || lower.contains("shower") || lower.contains("drizzle") { return "rain" }
        if lower.contains("snow") || lower.contains("flurr") { return "snow" }
        if lower.contains("thunder") || lower.contains("storm") { return "storm" }
        if lower.contains("fog") || lower.contains("mist") || lower.contains("haze") { return "fog" }
        if lower.contains("partly") { return "partly cloudy" }
        return lower
    }
}
```

**Step 2: Create WeatherView**

`ucanduit-apple/ucanduit/Views/Weather/WeatherView.swift`:
```swift
import SwiftUI

struct WeatherView: View {
    @State private var weatherService = WeatherService()

    var body: some View {
        VStack(spacing: 12) {
            if weatherService.isLoading {
                ProgressView("Loading weather...")
            } else if let weather = weatherService.currentWeather {
                // Location
                Text(weather.location)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                // Temperature
                Text("\(Int(weather.temperature))°C")
                    .font(.system(size: 42, weight: .light))

                // Condition with SF Symbol
                HStack {
                    Image(systemName: conditionIcon(weather.condition))
                        .font(.title2)
                    Text(weather.condition.capitalized)
                }

                // Details grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                    if let humidity = weather.humidity {
                        detailItem("Humidity", value: "\(humidity)%")
                    }
                    if let wind = weather.windSpeed, let dir = weather.windDirection {
                        detailItem("Wind", value: "\(dir) \(wind) km/h")
                    }
                }
                .font(.caption)
            } else if let error = weatherService.errorMessage {
                Text(error)
                    .foregroundStyle(.secondary)
            }

            Button("Refresh") {
                Task { await weatherService.fetchWeather() }
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .navigationTitle("Weather")
        .task {
            await weatherService.fetchWeather()
        }
    }

    private func detailItem(_ label: String, value: String) -> some View {
        VStack {
            Text(label)
                .foregroundStyle(.secondary)
            Text(value)
                .fontWeight(.medium)
        }
    }

    /// Map condition strings to SF Symbols
    private func conditionIcon(_ condition: String) -> String {
        switch condition {
        case "clear": return "sun.max.fill"
        case "cloudy": return "cloud.fill"
        case "partly cloudy": return "cloud.sun.fill"
        case "rain": return "cloud.rain.fill"
        case "snow": return "cloud.snow.fill"
        case "storm": return "cloud.bolt.fill"
        case "fog": return "cloud.fog.fill"
        default: return "cloud.fill"
        }
    }
}
```

**Step 3: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 4: Commit**

```bash
git add ucanduit-apple/ucanduit/Services/WeatherService.swift ucanduit-apple/ucanduit/Views/Weather/
git commit -m "feat: add weather service (Environment Canada API) and weather view"
```

---

### Task 8: Audio Engine (AVFoundation)

**Files:**
- Create: `ucanduit-apple/ucanduit/Services/AudioEngine.swift`
- Create: `ucanduit-apple/ucanduit/Services/AudioFileScanner.swift`

**Step 1: Create AudioFileScanner**

`ucanduit-apple/ucanduit/Services/AudioFileScanner.swift`:
```swift
import Foundation

/// Represents a directory of audio files (mirrors Rust's AudioDirectory struct)
struct AudioDirectory {
    let name: String
    let path: URL
    let fileCount: Int
}

/// Represents an audio file (mirrors Rust's AudioFile)
struct AudioFile {
    let name: String
    let path: URL
    let ext: String
}

/// Scans bundled audio directories.
/// Replaces the Tauri backend's scan_audio_directories/scan_audio_directory commands.
struct AudioFileScanner {
    static let supportedFormats = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "wma"]

    /// Scan the audio resource directory for category folders
    static func scanDirectories() -> [AudioDirectory] {
        guard let audioURL = Bundle.main.resourceURL?.appendingPathComponent("audio") else {
            return []
        }

        let fm = FileManager.default
        guard let contents = try? fm.contentsOfDirectory(
            at: audioURL,
            includingPropertiesForKeys: [.isDirectoryKey]
        ) else {
            return []
        }

        return contents.compactMap { url in
            var isDir: ObjCBool = false
            guard fm.fileExists(atPath: url.path, isDirectory: &isDir), isDir.boolValue else {
                return nil
            }
            let files = scanDirectory(at: url)
            return AudioDirectory(name: url.lastPathComponent, path: url, fileCount: files.count)
        }
    }

    /// Scan a specific directory for audio files
    static func scanDirectory(at url: URL) -> [AudioFile] {
        let fm = FileManager.default
        guard let enumerator = fm.enumerator(
            at: url,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var files: [AudioFile] = []
        for case let fileURL as URL in enumerator {
            let ext = fileURL.pathExtension.lowercased()
            if supportedFormats.contains(ext) {
                files.append(AudioFile(
                    name: fileURL.lastPathComponent,
                    path: fileURL,
                    ext: ext
                ))
            }
        }
        return files
    }
}
```

**Step 2: Create AudioEngine**

`ucanduit-apple/ucanduit/Services/AudioEngine.swift`:
```swift
import AVFoundation
import Foundation

/// Central audio engine managing playback and FFT analysis.
/// Replaces Web Audio API usage in the JS app.
///
/// Architecture:
///   PlayerNode(lofi) ──┐
///   PlayerNode(amb1) ──┼──► MixerNode ──► OutputNode
///   PlayerNode(amb2) ──┘        │
///                          FFT tap (→ oscilloscope)
@Observable
final class AudioEngine {
    // FFT data for the oscilloscope (256 bins, matching JS app's fftSize=512)
    var frequencyData: [Float] = Array(repeating: 0, count: 256)

    // Playback state
    var isLofiPlaying = false
    var lofiTrackName = ""

    private let engine = AVAudioEngine()
    private let lofiPlayer = AVAudioPlayerNode()
    private var ambientPlayers: [String: AVAudioPlayerNode] = [:]

    // Volume control nodes
    private let lofiMixer = AVAudioMixerNode()
    private let ambientMixer = AVAudioMixerNode()

    // FFT
    private let fftSize: Int = 512
    private var fftSetup: vDSP.FFT<DSPSplitComplex>?

    init() {
        setupEngine()
    }

    // MARK: - Engine Setup

    private func setupEngine() {
        let mainMixer = engine.mainMixerNode

        // Attach nodes
        engine.attach(lofiPlayer)
        engine.attach(lofiMixer)
        engine.attach(ambientMixer)

        // Connect: lofiPlayer → lofiMixer → mainMixer
        let format = engine.outputNode.inputFormat(forBus: 0)
        engine.connect(lofiPlayer, to: lofiMixer, format: format)
        engine.connect(lofiMixer, to: mainMixer, format: format)
        engine.connect(ambientMixer, to: mainMixer, format: format)

        // Install FFT tap on the main mixer for oscilloscope data
        mainMixer.installTap(onBus: 0, bufferSize: UInt32(fftSize), format: format) {
            [weak self] buffer, _ in
            self?.processAudioBuffer(buffer)
        }

        #if os(iOS)
        // iOS requires explicit audio session configuration
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)
        } catch {
            print("Audio session setup failed: \(error)")
        }
        #endif
    }

    func start() {
        guard !engine.isRunning else { return }
        do {
            try engine.start()
        } catch {
            print("Audio engine failed to start: \(error)")
        }
    }

    func stop() {
        engine.stop()
    }

    // MARK: - Lofi Playback

    func playLofi(file: URL) {
        do {
            let audioFile = try AVAudioFile(forReading: file)
            lofiPlayer.stop()
            lofiPlayer.scheduleFile(audioFile, at: nil) { [weak self] in
                DispatchQueue.main.async {
                    self?.isLofiPlaying = false
                }
            }
            if !engine.isRunning { start() }
            lofiPlayer.play()
            isLofiPlaying = true
            lofiTrackName = file.deletingPathExtension().lastPathComponent
        } catch {
            print("Failed to play lofi: \(error)")
        }
    }

    func stopLofi() {
        lofiPlayer.stop()
        isLofiPlaying = false
    }

    func setLofiVolume(_ volume: Float) {
        lofiMixer.outputVolume = volume
    }

    // MARK: - Ambient Playback

    /// Play an ambient sound. Multiple can play simultaneously.
    func playAmbient(id: String, file: URL, volume: Float = 0.5) {
        do {
            let audioFile = try AVAudioFile(forReading: file)
            let player: AVAudioPlayerNode

            if let existing = ambientPlayers[id] {
                existing.stop()
                player = existing
            } else {
                player = AVAudioPlayerNode()
                engine.attach(player)
                let format = engine.outputNode.inputFormat(forBus: 0)
                engine.connect(player, to: ambientMixer, format: format)
                ambientPlayers[id] = player
            }

            // Loop by scheduling repeatedly
            player.scheduleFile(audioFile, at: nil)
            player.volume = volume
            if !engine.isRunning { start() }
            player.play()
        } catch {
            print("Failed to play ambient \(id): \(error)")
        }
    }

    func stopAmbient(id: String) {
        ambientPlayers[id]?.stop()
    }

    func stopAllAmbient() {
        ambientPlayers.values.forEach { $0.stop() }
    }

    func setAmbientVolume(_ volume: Float) {
        ambientMixer.outputVolume = volume
    }

    // MARK: - FFT Processing

    /// Extract frequency magnitudes from audio buffer for oscilloscope
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData?[0] else { return }
        let frameCount = Int(buffer.frameLength)
        guard frameCount >= fftSize else { return }

        // Simple magnitude spectrum using vDSP
        var magnitudes = [Float](repeating: 0, count: fftSize / 2)

        // Windowed FFT
        var windowed = [Float](repeating: 0, count: fftSize)
        var window = [Float](repeating: 0, count: fftSize)
        vDSP_hann_window(&window, vDSP_Length(fftSize), Int32(vDSP_HANN_NORM))
        vDSP_vmul(channelData, 1, window, 1, &windowed, 1, vDSP_Length(fftSize))

        // Forward FFT
        windowed.withUnsafeMutableBufferPointer { ptr in
            var realParts = [Float](repeating: 0, count: fftSize / 2)
            var imagParts = [Float](repeating: 0, count: fftSize / 2)

            realParts.withUnsafeMutableBufferPointer { realBuf in
                imagParts.withUnsafeMutableBufferPointer { imagBuf in
                    var splitComplex = DSPSplitComplex(
                        realp: realBuf.baseAddress!,
                        imagp: imagBuf.baseAddress!
                    )
                    ptr.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: fftSize / 2) {
                        vDSP_ctoz($0, 2, &splitComplex, 1, vDSP_Length(fftSize / 2))
                    }

                    if let fftSetup = vDSP_create_fftsetup(
                        vDSP_Length(log2(Double(fftSize))),
                        FFTRadix(kFFTRadix2)
                    ) {
                        vDSP_fft_zrip(fftSetup, &splitComplex, 1, vDSP_Length(log2(Double(fftSize))), FFTDirection(FFT_FORWARD))
                        vDSP_zvmags(&splitComplex, 1, &magnitudes, 1, vDSP_Length(fftSize / 2))
                        vDSP_destroy_fftsetup(fftSetup)
                    }
                }
            }
        }

        // Normalize to 0-255 range (matching JS app's Uint8Array output)
        var scaledMagnitudes = [Float](repeating: 0, count: 256)
        var maxVal: Float = 0
        vDSP_maxv(magnitudes, 1, &maxVal, vDSP_Length(magnitudes.count))
        if maxVal > 0 {
            var scale: Float = 255.0 / maxVal
            vDSP_vsmul(magnitudes, 1, &scale, &scaledMagnitudes, 1, vDSP_Length(min(256, magnitudes.count)))
        }

        DispatchQueue.main.async { [weak self] in
            self?.frequencyData = scaledMagnitudes
        }
    }
}
```

**Step 3: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 4: Commit**

```bash
git add ucanduit-apple/ucanduit/Services/
git commit -m "feat: add AVFoundation audio engine with FFT analysis and file scanner"
```

---

### Task 9: Oscilloscope Visualization

**Files:**
- Create: `ucanduit-apple/ucanduit/Views/Oscilloscope/OscilloscopeView.swift`

This is the most complex visual component. It ports the metaballs algorithm from the JS app.

**Step 1: Create OscilloscopeView**

`ucanduit-apple/ucanduit/Views/Oscilloscope/OscilloscopeView.swift`:
```swift
import SwiftUI

/// A single metaball with position, velocity, and audio-responsive radius.
/// Mirrors the JS app's metaball object in oscilloscope.js.
struct Metaball {
    var x: CGFloat
    var y: CGFloat
    var baseRadius: CGFloat
    var currentRadius: CGFloat
    var vx: CGFloat
    var vy: CGFloat
    var breathingPhase: CGFloat
    var breathingSpeed: CGFloat
    var frequencyRange: (start: Int, end: Int)
    var audioAmplitude: CGFloat = 0

    // Wall deformation (stretch when hitting container bounds)
    var deformationX: CGFloat = 1.0
    var deformationY: CGFloat = 1.0
}

/// A breathing gradient circle that shows through the metaball silhouette.
struct BreathingCircle {
    var x: CGFloat
    var y: CGFloat
    var baseRadius: CGFloat
    var color1: Color
    var color2: Color
    var breathingPhase: CGFloat
    var breathingSpeed: CGFloat
    var breathingScale: CGFloat
    var opacity: Double
}

/// Audio-reactive metaballs visualization.
/// Uses SwiftUI Canvas + TimelineView for 60fps rendering.
///
/// Rendering pipeline (matches JS app):
/// 1. Draw metaballs as radial gradients on offscreen image
/// 2. Alpha-threshold at 0.38 to create merged silhouette
/// 3. Breathing circles masked by silhouette
/// 4. Glow outline based on average audio amplitude
struct OscilloscopeView: View {
    var frequencyData: [Float]
    var size: CGSize = CGSize(width: 300, height: 300)

    @State private var balls: [Metaball] = []
    @State private var circles: [BreathingCircle] = []
    @State private var isInitialized = false

    // 4 metaballs, each responding to a quarter of the frequency spectrum
    private let ballCount = 4

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { context, canvasSize in
                let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
                let bounds = CGRect(origin: .zero, size: canvasSize)

                // Update physics
                updateBalls(in: bounds, center: center)
                updateAudio()

                // Draw breathing circles masked by metaball silhouette
                drawMetaballs(context: context, bounds: bounds, center: center)
            }
        }
        .frame(width: size.width, height: size.height)
        .onAppear { initializeIfNeeded() }
    }

    private mutating func initializeIfNeeded() {
        guard !isInitialized else { return }
        let binCount = 256
        let rangeSize = binCount / ballCount

        balls = (0..<ballCount).map { i in
            Metaball(
                x: CGFloat.random(in: -30...30),
                y: CGFloat.random(in: -30...30),
                baseRadius: 25 + CGFloat.random(in: 0...10),
                currentRadius: 25 + CGFloat.random(in: 0...10),
                vx: CGFloat.random(in: -1...1),
                vy: CGFloat.random(in: -1...1),
                breathingPhase: CGFloat.random(in: 0...(2 * .pi)),
                breathingSpeed: 0.008 + CGFloat.random(in: 0...0.015),
                frequencyRange: (start: i * rangeSize, end: (i + 1) * rangeSize)
            )
        }

        // 5 breathing background circles
        circles = (0..<5).map { _ in
            BreathingCircle(
                x: CGFloat.random(in: -40...40),
                y: CGFloat.random(in: -40...40),
                baseRadius: 20 + CGFloat.random(in: 0...30),
                color1: Color(hue: Double.random(in: 0...1), saturation: 0.6, brightness: 0.8),
                color2: Color(hue: Double.random(in: 0...1), saturation: 0.5, brightness: 0.9),
                breathingPhase: CGFloat.random(in: 0...(2 * .pi)),
                breathingSpeed: 0.005 + CGFloat.random(in: 0...0.01),
                breathingScale: 0.8 + CGFloat.random(in: 0...0.4),
                opacity: 0.7 + Double.random(in: 0...0.3)
            )
        }

        isInitialized = true
    }

    // MARK: - Physics Update

    private func updateBalls(in bounds: CGRect, center: CGPoint) {
        for i in balls.indices {
            // Breathing animation
            balls[i].breathingPhase += balls[i].breathingSpeed
            let breathOffset = sin(balls[i].breathingPhase) * 3

            // Audio-driven radius
            let audioBoost = balls[i].audioAmplitude * 55
            balls[i].currentRadius = balls[i].baseRadius + breathOffset + audioBoost

            // Movement with audio influence
            let audioInfluence = balls[i].audioAmplitude * 1.8
            balls[i].x += sin(balls[i].breathingPhase) * (0.4 + audioInfluence)
            balls[i].y += cos(balls[i].breathingPhase * 0.7) * (0.3 + audioInfluence)

            // Add velocity
            balls[i].x += balls[i].vx
            balls[i].y += balls[i].vy

            // Container bounds collision
            let halfW = bounds.width * 0.4
            let halfH = bounds.height * 0.4
            let r = balls[i].currentRadius

            if abs(balls[i].x) + r > halfW {
                balls[i].vx *= -0.5
                balls[i].x = balls[i].x > 0
                    ? halfW - r
                    : -(halfW - r)
            }
            if abs(balls[i].y) + r > halfH {
                balls[i].vy *= -0.5
                balls[i].y = balls[i].y > 0
                    ? halfH - r
                    : -(halfH - r)
            }

            // Damping
            balls[i].vx *= 0.98
            balls[i].vy *= 0.98
        }
    }

    private func updateAudio() {
        guard !frequencyData.isEmpty else { return }
        for i in balls.indices {
            let range = balls[i].frequencyRange
            let start = min(range.start, frequencyData.count - 1)
            let end = min(range.end, frequencyData.count)
            guard end > start else { continue }

            let slice = frequencyData[start..<end]
            let sum = slice.reduce(0, +)
            balls[i].audioAmplitude = CGFloat(sum / Float(slice.count)) / 255.0
        }
    }

    // MARK: - Rendering

    private func drawMetaballs(context: GraphicsContext, bounds: CGRect, center: CGPoint) {
        let avgAmplitude = balls.reduce(0) { $0 + $1.audioAmplitude } / CGFloat(balls.count)

        // Draw each metaball as a filled circle with glow
        // Note: True alpha-threshold metaballs require pixel-level access.
        // SwiftUI Canvas can approximate this with overlapping circles and blend modes.
        // If this isn't sufficient, we swap to Metal (see design doc).

        // Glow layer
        for ball in balls {
            let pos = CGPoint(x: center.x + ball.x, y: center.y + ball.y)
            let glowRadius = ball.currentRadius * 1.5

            var glowContext = context
            glowContext.opacity = Double(0.3 + avgAmplitude * 0.4)
            glowContext.addFilter(.blur(radius: 12))

            let gradient = Gradient(colors: [
                .purple.opacity(0.6),
                .blue.opacity(0.3),
                .clear
            ])
            glowContext.drawLayer { ctx in
                ctx.fill(
                    Circle().path(in: CGRect(
                        x: pos.x - glowRadius,
                        y: pos.y - glowRadius,
                        width: glowRadius * 2,
                        height: glowRadius * 2
                    )),
                    with: .radialGradient(
                        gradient,
                        center: pos,
                        startRadius: 0,
                        endRadius: glowRadius
                    )
                )
            }
        }

        // Solid metaball bodies
        for ball in balls {
            let pos = CGPoint(x: center.x + ball.x, y: center.y + ball.y)
            let r = ball.currentRadius

            let bodyGradient = Gradient(colors: [
                .purple.opacity(0.8),
                .blue.opacity(0.6),
                .indigo.opacity(0.4),
            ])
            context.fill(
                Circle().path(in: CGRect(
                    x: pos.x - r, y: pos.y - r,
                    width: r * 2, height: r * 2
                )),
                with: .radialGradient(
                    bodyGradient,
                    center: pos,
                    startRadius: 0,
                    endRadius: r
                )
            )
        }

        // Breathing circles (drawn on top with blending)
        for circle in circles {
            var phase = circle.breathingPhase + circle.breathingSpeed
            let scale = 1.0 + sin(phase) * 0.2 * circle.breathingScale
            let r = circle.baseRadius * scale
            let pos = CGPoint(x: center.x + circle.x, y: center.y + circle.y)

            var circContext = context
            circContext.opacity = circle.opacity * 0.4
            circContext.blendMode = .plusLighter

            let gradient = Gradient(colors: [circle.color1, circle.color2])
            circContext.fill(
                Circle().path(in: CGRect(
                    x: pos.x - r, y: pos.y - r,
                    width: r * 2, height: r * 2
                )),
                with: .radialGradient(gradient, center: pos, startRadius: 0, endRadius: r)
            )
        }
    }
}
```

> **Note:** This is an approximation of the JS app's alpha-threshold metaballs using SwiftUI Canvas blend modes. The visual may not be identical — true pixel-level alpha thresholding would need Metal or CIFilter. We start with this and optimize later if needed.

**Step 2: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/Views/Oscilloscope/
git commit -m "feat: add oscilloscope metaballs visualization with audio-reactive rendering"
```

---

### Task 10: Lofi Player & Ambient Sounds Views

**Files:**
- Create: `ucanduit-apple/ucanduit/Views/Audio/LofiPlayerView.swift`
- Create: `ucanduit-apple/ucanduit/Views/Audio/AmbientSoundsView.swift`

**Step 1: Create LofiPlayerView**

`ucanduit-apple/ucanduit/Views/Audio/LofiPlayerView.swift`:
```swift
import SwiftUI

struct LofiPlayerView: View {
    @Environment(AudioEngine.self) private var audioEngine

    @State private var categories: [AudioDirectory] = []
    @State private var selectedCategory: AudioDirectory?
    @State private var files: [AudioFile] = []
    @State private var volume: Float = 0.8

    var body: some View {
        VStack(spacing: 12) {
            // Now playing
            if audioEngine.isLofiPlaying {
                HStack {
                    Image(systemName: "music.note")
                    Text(audioEngine.lofiTrackName)
                        .lineLimit(1)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            // Category picker
            if categories.count > 1 {
                Picker("Category", selection: $selectedCategory) {
                    ForEach(categories, id: \.name) { cat in
                        Text(cat.name).tag(cat as AudioDirectory?)
                    }
                }
                .onChange(of: selectedCategory) { _, newCat in
                    if let cat = newCat {
                        files = AudioFileScanner.scanDirectory(at: cat.path)
                    }
                }
            }

            // Track list
            List(files, id: \.name) { file in
                Button {
                    audioEngine.playLofi(file: file.path)
                } label: {
                    HStack {
                        Text(file.name)
                            .lineLimit(1)
                        Spacer()
                        if audioEngine.lofiTrackName == file.path.deletingPathExtension().lastPathComponent {
                            Image(systemName: "speaker.wave.2.fill")
                                .foregroundStyle(.accentColor)
                        }
                    }
                }
            }

            // Controls
            HStack {
                Button {
                    if audioEngine.isLofiPlaying {
                        audioEngine.stopLofi()
                    } else if let randomFile = files.randomElement() {
                        audioEngine.playLofi(file: randomFile.path)
                    }
                } label: {
                    Image(systemName: audioEngine.isLofiPlaying ? "stop.fill" : "play.fill")
                }

                Slider(value: $volume, in: 0...1) { _ in
                    audioEngine.setLofiVolume(volume)
                }

                Text("\(Int(volume * 100))%")
                    .monospacedDigit()
                    .frame(width: 40)
            }
        }
        .padding()
        .navigationTitle("Lo-Fi Music")
        .onAppear {
            // Scan for lofi directories
            let allDirs = AudioFileScanner.scanDirectories()
            categories = allDirs.filter { $0.name.lowercased().contains("lofi") }
            if let first = categories.first {
                selectedCategory = first
                files = AudioFileScanner.scanDirectory(at: first.path)
            }
        }
    }
}
```

**Step 2: Create AmbientSoundsView**

`ucanduit-apple/ucanduit/Views/Audio/AmbientSoundsView.swift`:
```swift
import SwiftUI

struct AmbientSoundsView: View {
    @Environment(AudioEngine.self) private var audioEngine

    @State private var categories: [AudioDirectory] = []
    @State private var playingIds: Set<String> = []
    @State private var volume: Float = 0.5

    var body: some View {
        VStack(spacing: 12) {
            // Category toggles — multiple can play simultaneously
            List(categories, id: \.name) { category in
                HStack {
                    VStack(alignment: .leading) {
                        Text(category.name)
                            .font(.headline)
                        Text("\(category.fileCount) tracks")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Button {
                        toggleCategory(category)
                    } label: {
                        Image(systemName: playingIds.contains(category.name)
                              ? "speaker.wave.2.fill"
                              : "play.circle")
                        .font(.title2)
                    }
                    .buttonStyle(.plain)
                }
            }

            // Master ambient volume
            HStack {
                Text("Volume")
                    .font(.caption)
                Slider(value: $volume, in: 0...1) { _ in
                    audioEngine.setAmbientVolume(volume)
                }
                Text("\(Int(volume * 100))%")
                    .monospacedDigit()
                    .frame(width: 40)
            }
            .padding(.horizontal)

            // Stop all button
            if !playingIds.isEmpty {
                Button("Stop All") {
                    audioEngine.stopAllAmbient()
                    playingIds.removeAll()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .navigationTitle("Ambient Sounds")
        .onAppear {
            let allDirs = AudioFileScanner.scanDirectories()
            // Exclude Lofi directories (handled by LofiPlayerView)
            categories = allDirs.filter { !$0.name.lowercased().contains("lofi") }
        }
    }

    private func toggleCategory(_ category: AudioDirectory) {
        if playingIds.contains(category.name) {
            audioEngine.stopAmbient(id: category.name)
            playingIds.remove(category.name)
        } else {
            // Pick a random file from the category
            let files = AudioFileScanner.scanDirectory(at: category.path)
            if let file = files.randomElement() {
                audioEngine.playAmbient(id: category.name, file: file.path, volume: volume)
                playingIds.insert(category.name)
            }
        }
    }
}
```

**Step 3: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 4: Commit**

```bash
git add ucanduit-apple/ucanduit/Views/Audio/
git commit -m "feat: add lofi player and ambient sounds views with multi-track mixing"
```

---

### Task 11: Analytics Service

**Files:**
- Create: `ucanduit-apple/ucanduit/Services/AnalyticsService.swift`

**Step 1: Create AnalyticsService**

`ucanduit-apple/ucanduit/Services/AnalyticsService.swift`:
```swift
import Foundation
import SwiftData

/// Tracks tool usage and session analytics.
/// Mirrors the JS app's analytics.js tracking.
@Observable
final class AnalyticsService {
    private var modelContext: ModelContext?
    private(set) var sessionStart = Date()

    func configure(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    /// Record a tool usage event
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

    /// Track timer events
    func trackTimerStart(minutes: Int) {
        trackUsage(tool: "timer")
    }

    func trackTimerComplete(actualMinutes: Int) {
        trackUsage(tool: "timer_complete")
    }

    func trackTodoCreated() {
        trackUsage(tool: "todo_created")
    }

    func trackTodoCompleted() {
        trackUsage(tool: "todo_completed")
    }
}
```

**Step 2: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 3: Commit**

```bash
git add ucanduit-apple/ucanduit/Services/AnalyticsService.swift
git commit -m "feat: add analytics service for tool usage tracking"
```

---

### Task 12: Adaptive Layout & ContentView

**Files:**
- Modify: `ucanduit-apple/ucanduit/ContentView.swift`
- Create: `ucanduit-apple/ucanduit/Platform/macOS/FloatingWindowManager.swift`
- Create: `ucanduit-apple/ucanduit/Platform/iOS/AdaptiveNavigationView.swift`
- Modify: `ucanduit-apple/ucanduit/ucanduitApp.swift`

**Step 1: Create macOS FloatingWindowManager**

`ucanduit-apple/ucanduit/Platform/macOS/FloatingWindowManager.swift`:
```swift
#if os(macOS)
import AppKit
import SwiftUI

/// Configures the main window as an always-on-top floating panel.
/// SwiftUI has no native always-on-top support, so we bridge to AppKit.
final class FloatingWindowManager {
    static func configureMainWindow() {
        // Find the main window and set it to float above all others
        DispatchQueue.main.async {
            if let window = NSApplication.shared.windows.first {
                window.level = .floating
                window.isOpaque = false
                window.backgroundColor = .clear
                window.titlebarAppearsTransparent = true
                window.styleMask.insert(.fullSizeContentView)
            }
        }
    }

    /// Toggle always-on-top for the main window
    static func setAlwaysOnTop(_ enabled: Bool) {
        if let window = NSApplication.shared.windows.first {
            window.level = enabled ? .floating : .normal
        }
    }
}
#endif
```

**Step 2: Create iOS AdaptiveNavigationView**

`ucanduit-apple/ucanduit/Platform/iOS/AdaptiveNavigationView.swift`:
```swift
#if os(iOS)
import SwiftUI

/// Tab-based navigation for iPhone, sidebar for iPad.
struct AdaptiveNavigationView: View {
    @Environment(AudioEngine.self) private var audioEngine

    var body: some View {
        TabView {
            // Home tab with oscilloscope
            NavigationStack {
                VStack {
                    OscilloscopeView(frequencyData: audioEngine.frequencyData)
                        .frame(height: 300)
                    Text("ucanduit")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                }
                .navigationTitle("ucanduit")
            }
            .tabItem { Label("Home", systemImage: "waveform.circle") }

            NavigationStack { TimerView() }
                .tabItem { Label("Timer", systemImage: "timer") }

            NavigationStack { TodoListView() }
                .tabItem { Label("Todos", systemImage: "checklist") }

            NavigationStack { MemosView() }
                .tabItem { Label("Memos", systemImage: "note.text") }

            NavigationStack {
                List {
                    NavigationLink("Lo-Fi Music") { LofiPlayerView() }
                    NavigationLink("Ambient Sounds") { AmbientSoundsView() }
                    NavigationLink("Weather") { WeatherView() }
                    NavigationLink("Settings") { SettingsView() }
                }
                .navigationTitle("More")
            }
            .tabItem { Label("More", systemImage: "ellipsis.circle") }
        }
    }
}
#endif
```

**Step 3: Update ContentView for platform-adaptive layout**

`ucanduit-apple/ucanduit/ContentView.swift`:
```swift
import SwiftUI

struct ContentView: View {
    @State private var audioEngine = AudioEngine()

    var body: some View {
        #if os(macOS)
        macOSLayout
            .environment(audioEngine)
            .onAppear {
                FloatingWindowManager.configureMainWindow()
            }
        #else
        AdaptiveNavigationView()
            .environment(audioEngine)
        #endif
    }

    #if os(macOS)
    /// macOS layout: oscilloscope on top, collapsible tool sections below.
    /// Matches the Tauri app's sidebar layout.
    private var macOSLayout: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Oscilloscope
                OscilloscopeView(frequencyData: audioEngine.frequencyData)
                    .frame(width: 300, height: 300)

                // Collapsible tool sections
                CollapsibleSection("Timer") { TimerView() }
                CollapsibleSection("Todo Lists") { TodoListView() }
                CollapsibleSection("Quick Memos") { MemosView() }
                CollapsibleSection("Lo-Fi Music") { LofiPlayerView() }
                CollapsibleSection("Ambient Sounds") { AmbientSoundsView() }
                CollapsibleSection("Weather") { WeatherView() }
                CollapsibleSection("Settings") { SettingsView() }
            }
            .padding()
        }
        .frame(minWidth: 350, maxWidth: 400)
    }
    #endif
}

/// Collapsible section matching the Tauri app's accordion-style tool panels
struct CollapsibleSection<Content: View>: View {
    let title: String
    let content: () -> Content
    @State private var isExpanded = false

    init(_ title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }

    var body: some View {
        VStack(spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack {
                    Text(title)
                        .font(.headline)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
                .background(Color.gray.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
            .buttonStyle(.plain)

            if isExpanded {
                content()
                    .padding(.top, 8)
            }
        }
    }
}
```

**Step 4: Update ucanduitApp.swift with AudioEngine environment**

Replace the full `ucanduitApp.swift`:
```swift
import SwiftUI
import SwiftData

@main
struct UcanduitApp: App {
    var sharedModelContainer: ModelContainer = {
        let schema = Schema([
            TodoList.self,
            TodoItem.self,
            Memo.self,
            TimerSession.self,
            AppSettings.self,
            AnalyticsEntry.self,
        ])
        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false
        )
        do {
            return try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(sharedModelContainer)
    }
}
```

**Step 5: Build and verify**

```bash
cd ucanduit-apple && swift build
```

**Step 6: Commit**

```bash
git add ucanduit-apple/ucanduit/
git commit -m "feat: add adaptive layout with macOS floating window and iOS tab navigation"
```

---

### Task 13: Copy Audio Resources & Final Integration

**Files:**
- Copy: audio resources from `public/audio/` to `ucanduit-apple/ucanduit/Resources/audio/`
- Verify: full build compiles and runs

**Step 1: Copy audio assets**

```bash
cp -R /Users/devian/Documents/productivity/ucanduit-v2/public/audio/ \
      /Users/devian/Documents/productivity/ucanduit-v2/ucanduit-apple/ucanduit/Resources/audio/
```

> **Note:** These are ~832MB. We're copying them for now; you'll convert to lossy formats later. Add them to `.gitignore` to keep the repo light.

**Step 2: Add audio to gitignore**

Append to `.gitignore`:
```
ucanduit-apple/ucanduit/Resources/audio/
```

**Step 3: Build and verify the full project**

```bash
cd ucanduit-apple && swift build
```

**Step 4: Commit**

```bash
git add ucanduit-apple/ .gitignore
git commit -m "feat: complete native Apple app with all tools, audio engine, and adaptive layout"
```

---

### Task 14: Create Xcode Project for Multi-Platform Builds

The Swift Package approach works for development, but to build for iOS/iPadOS we need a proper Xcode project with platform targets.

**Step 1: Generate Xcode project**

Open Xcode and create a new Multi-platform App project:
- Product Name: ucanduit
- Team: (your team)
- Organization Identifier: com.ucanduit
- Interface: SwiftUI
- Storage: SwiftData
- Location: save as `ucanduit-apple/`

Then move all the Swift files from our package structure into the Xcode project's target.

> **Note:** This step is interactive (Xcode GUI). The agent should guide the user through it or use `xcodebuild` where possible.

**Step 2: Verify macOS build**

```bash
cd ucanduit-apple
xcodebuild -scheme ucanduit -destination 'platform=macOS' build
```

**Step 3: Verify iOS simulator build**

```bash
xcodebuild -scheme ucanduit -destination 'platform=iOS Simulator,name=iPhone 16' build
```

**Step 4: Commit the Xcode project**

```bash
git add ucanduit-apple/
git commit -m "feat: add Xcode project for multi-platform macOS/iOS builds"
```

---

## Summary

| Task | Component | Key Deliverable |
|------|-----------|----------------|
| 1 | Project scaffolding | Branch, directory structure, App entry point |
| 2 | SwiftData models | TodoList, TodoItem, Memo, TimerSession, AppSettings, AnalyticsEntry |
| 3 | Settings | SettingsView with SwiftData CRUD pattern |
| 4 | Timer | Pomodoro timer with presets, progress ring, session tracking |
| 5 | Todos | Todo lists with priorities, kanban board with drag-and-drop |
| 6 | Memos | Split-view memo editor with auto-save |
| 7 | Weather | Environment Canada API service and weather display |
| 8 | Audio Engine | AVFoundation playback, FFT analysis, multi-track mixing |
| 9 | Oscilloscope | Metaballs visualization with audio reactivity |
| 10 | Audio Views | Lofi player and ambient sounds UI |
| 11 | Analytics | Tool usage tracking service |
| 12 | Adaptive Layout | macOS floating window, iOS tabs, collapsible sections |
| 13 | Resources | Audio assets, final integration |
| 14 | Xcode Project | Multi-platform build targets |
