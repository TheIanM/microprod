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

    // Preset name, type, duration in seconds — matches JS app
    private let presets: [(SessionType, String, Int)] = [
        (.pomodoro,   "Pomodoro",    25 * 60),
        (.quick,      "Quick",       10 * 60),
        (.focus,      "Focus",       45 * 60),
        (.shortBreak, "Short Break",  5 * 60),
        (.longBreak,  "Long Break",  15 * 60),
    ]

    var body: some View {
        VStack(spacing: 16) {
            // Time remaining display
            Text(formatTime(remainingSeconds))
                .font(.system(size: 48, weight: .light, design: .monospaced))
                .foregroundStyle(timerColor)

            // Circular progress ring
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

            // Preset selector buttons
            HStack(spacing: 8) {
                ForEach(presets, id: \.0) { preset in
                    Button(preset.1) {
                        selectPreset(preset.0, seconds: preset.2)
                    }
                    .buttonStyle(.bordered)
                    .tint(selectedPreset == preset.0 ? .accentColor : .secondary)
                }
            }

            // Custom duration slider (disabled while running)
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

            // Start/Pause and Reset controls
            HStack(spacing: 16) {
                Button(isRunning ? "Pause" : "Start") {
                    isRunning ? pause() : start()
                }
                .buttonStyle(.borderedProminent)

                Button("Reset") { reset() }
                    .buttonStyle(.bordered)
                    .disabled(!isRunning && remainingSeconds == totalSeconds)
            }

            // Completed session count
            let completedCount = sessions.filter { $0.completed }.count
            if completedCount > 0 {
                Text("\(completedCount) sessions completed")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .navigationTitle("Timer")
        .onDisappear { pause() } // stop timer if view is dismissed
    }

    // MARK: - Computed

    private var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        return Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
    }

    /// Color shifts from accent → orange → red as time runs low
    private var timerColor: Color {
        let ratio = Double(remainingSeconds) / Double(totalSeconds)
        if ratio > 0.5 { return .accentColor }
        if ratio > 0.2 { return .orange }
        return .red
    }

    // MARK: - Actions

    private func start() {
        // Create a new session record when the timer first starts
        if currentSession == nil {
            let session = TimerSession(duration: totalSeconds, type: selectedPreset)
            modelContext.insert(session)
            currentSession = session
        }
        isRunning = true
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            tick()
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

    private func tick() {
        guard remainingSeconds > 0 else {
            complete()
            return
        }
        remainingSeconds -= 1
    }

    private func complete() {
        pause()
        // Mark the session as completed in SwiftData
        if let session = currentSession {
            session.completed = true
            session.endTime = Date()
            session.actualDuration = totalSeconds
        }
        currentSession = nil
        remainingSeconds = totalSeconds
    }

    private func selectPreset(_ type: SessionType, seconds: Int) {
        guard !isRunning else { return } // don't switch mid-session
        selectedPreset = type
        setDuration(seconds)
    }

    private func setDuration(_ seconds: Int) {
        totalSeconds = seconds
        remainingSeconds = seconds
        currentSession = nil
    }

    // MARK: - Helpers

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}
