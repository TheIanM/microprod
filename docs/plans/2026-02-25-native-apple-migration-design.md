# Native Apple Migration Design

**Date:** 2026-02-25
**Status:** Approved
**Goal:** Port ucanduit from Tauri to a native Apple SwiftUI app targeting macOS, iOS, and iPadOS with full feature parity.

## Context

The existing Tauri app (~7700 lines JS, ~300 lines Rust) is a lightweight gamified productivity suite with an audio-reactive oscilloscope, productivity tools (todos, kanban, timer, memos), audio systems (lofi player, ambient sounds), weather display, and analytics. This native version will live alongside the Tauri version for performance comparison.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | SwiftUI | Modern, declarative, shared across all Apple platforms |
| Persistence | SwiftData | Native Apple persistence with optional iCloud sync later |
| Audio | AVFoundation (AVAudioEngine) | Real-time FFT for oscilloscope, multi-track mixing |
| Oscilloscope | SwiftUI Canvas (Metal fallback) | Start simple, optimize if needed |
| macOS windows | NSPanel via AppKit bridge | SwiftUI has no native always-on-top support |
| iOS/iPadOS navigation | NavigationSplitView + tabs | Adaptive sidebar on iPad, tabs on iPhone |
| Project structure | Single Xcode project, multi-platform | Maximum code sharing, Apple's recommended approach |
| Audio assets | Bundle as-is | User will convert to lossy formats later |

## Project Structure

```
ucanduit-apple/
├── ucanduit/
│   ├── ucanduitApp.swift              # App entry, scene setup, ModelContainer
│   ├── ContentView.swift              # Root view with adaptive layout
│   │
│   ├── Models/                        # SwiftData models
│   │   ├── TodoItem.swift             # Task with text, priority, completed
│   │   ├── TodoList.swift             # Named list containing TodoItems
│   │   ├── Memo.swift                 # Title, content, dates
│   │   ├── TimerSession.swift         # Duration, type, completedAt
│   │   ├── AppSettings.swift          # Theme, window mode, timer defaults
│   │   └── AnalyticsEntry.swift       # Tool name, usage count, last used
│   │
│   ├── Services/                      # Business logic (platform-agnostic)
│   │   ├── AudioEngine.swift          # AVAudioEngine: playback, FFT, mixing
│   │   ├── AudioFileScanner.swift     # Scan bundled audio directories
│   │   ├── WeatherService.swift       # Environment Canada public API
│   │   └── AnalyticsService.swift     # Usage tracking
│   │
│   ├── Views/
│   │   ├── Oscilloscope/
│   │   │   └── OscilloscopeView.swift # Metaballs visualization via Canvas
│   │   ├── Timer/
│   │   │   └── TimerView.swift        # Pomodoro timer with presets
│   │   ├── Todos/
│   │   │   ├── TodoListView.swift     # Priority-based task management
│   │   │   └── KanbanView.swift       # Drag-and-drop kanban board
│   │   ├── Memos/
│   │   │   └── MemosView.swift        # Quick notes with rich text
│   │   ├── Audio/
│   │   │   ├── LofiPlayerView.swift   # Music player with category browsing
│   │   │   └── AmbientSoundsView.swift # Multi-track ambient mixing
│   │   ├── Weather/
│   │   │   └── WeatherView.swift      # Current conditions display
│   │   └── Settings/
│   │       └── SettingsView.swift     # Theme, defaults, preferences
│   │
│   ├── Platform/                      # Platform-specific code
│   │   ├── macOS/
│   │   │   └── FloatingWindowManager.swift  # NSPanel always-on-top bridge
│   │   └── iOS/
│   │       └── AdaptiveNavigationView.swift # Tab/sidebar navigation
│   │
│   ├── Resources/
│   │   └── audio/                     # Bundled audio files
│   │
│   └── Assets.xcassets                # App icons, accent colors
│
├── ucanduit.xcodeproj
└── README.md
```

## Data Layer

### SwiftData Models

| Model | Fields | Relationships |
|-------|--------|---------------|
| TodoList | name: String | items: [TodoItem] (cascade delete) |
| TodoItem | text: String, priority: Priority (enum), completed: Bool, createdAt: Date | parent: TodoList |
| Memo | title: String, content: String, createdAt: Date, modifiedAt: Date | none |
| TimerSession | duration: Int, type: SessionType (enum), completedAt: Date | none |
| AppSettings | theme: Theme (enum), windowMode: WindowMode (enum), defaultTimerMinutes: Int | none (singleton) |
| AnalyticsEntry | toolName: String, usageCount: Int, lastUsed: Date | none |

### Container Setup
- Single `ModelContainer` created at the `App` level
- Injected via `.modelContainer()` on the root `WindowGroup`
- All windows and views inherit the same container automatically

## Audio Engine

### AVAudioEngine Architecture
```
AVAudioPlayerNode (lofi)     ──┐
AVAudioPlayerNode (ambient 1) ─┤
AVAudioPlayerNode (ambient 2) ─┼──► AVAudioMixerNode ──► AVAudioOutputNode
AVAudioPlayerNode (ambient 3) ─┤         │
AVAudioPlayerNode (ambient N) ─┘         │
                                    FFT tap (frequency data → oscilloscope)
```

- Per-node volume control for individual tracks
- Main mixer tap for real-time FFT analysis
- FFT data published via `@Observable` for SwiftUI consumption
- iOS: `AVAudioSession` configured with `.playback` category + interruption handling (`#if os(iOS)`)

## Platform Adaptation

### macOS
- Main window: always-on-top borderless floating panel via `NSPanel` (AppKit bridge, ~30 lines)
- Sub-windows for timer detail, kanban, memos via `openWindow(id:)`
- Oscilloscope as central visual in main window
- Collapsible tool sections below oscilloscope (matching current layout)

### iOS / iPadOS
- Single window with adaptive navigation
- iPhone: tab bar with oscilloscope as home tab
- iPad: `NavigationSplitView` sidebar with oscilloscope header
- Each tool is a navigation destination
- No floating windows (not supported on iOS)

## Known Pitfalls & Mitigations

| Pitfall | Mitigation |
|---------|------------|
| Audio bundle is 832MB | Bundle as-is for now; user will convert to lossy formats later |
| SwiftUI Canvas may be too slow for 60fps oscilloscope | Start with Canvas + TimelineView; swap to Metal wrapper if profiling shows frame drops. Keep rendering logic in separate file for easy swap. |
| SwiftUI has no always-on-top window modifier | Small NSPanel AppKit bridge (~30 lines), isolated in Platform/macOS/ |
| AVAudioSession only exists on iOS | `#if os(iOS)` block inside AudioEngine.swift for session config |
| SwiftData ModelContainer must be shared across windows | Create once at App level, inject via .modelContainer() modifier |
| Kanban drag-and-drop differs between platforms | Use SwiftUI's `.draggable()` / `.dropDestination()` — works on both platforms |

## Feature Parity Checklist

- [ ] Oscilloscope visualization (metaballs, audio-reactive)
- [ ] Pomodoro timer with presets and session tracking
- [ ] Todo lists with priorities
- [ ] Kanban board with drag-and-drop
- [ ] Quick memos with rich text
- [ ] Lofi music player with category browsing
- [ ] Ambient sounds with multi-track mixing
- [ ] Weather display (Environment Canada API)
- [ ] Usage analytics
- [ ] Settings (theme, timer defaults)
- [ ] Persistent data storage
- [ ] Always-on-top floating windows (macOS)
- [ ] Adaptive layout (iOS/iPadOS)
