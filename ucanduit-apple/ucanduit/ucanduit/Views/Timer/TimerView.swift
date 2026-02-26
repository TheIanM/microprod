import SwiftUI
import SwiftData
import UserNotifications

struct TimerView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(TimerState.self) private var timerState
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
            // Time remaining display — Quicksand matches .timer-main-display in timer.css
            Text(formatTime(remainingSeconds))
                .font(.quicksand(48, weight: .light))
                .foregroundStyle(timerColor)

            // Circular progress ring — AngularGradient sweep (adapted from pomodoro-timer snippet)
            ZStack {
                Circle()
                    .stroke(Color.gray.opacity(0.15), lineWidth: 4)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        AngularGradient(
                            gradient: Gradient(colors: [timerColor.opacity(0.4), timerColor]),
                            center: .center,
                            startAngle: .degrees(-90),
                            endAngle: .degrees(270)
                        ),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.linear(duration: 1), value: progress)
            }
            .frame(width: 120, height: 120)

            // Preset selector — 2-column grid matches .preset-buttons in timer.css
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                ForEach(presets, id: \.0) { preset in
                    Button {
                        selectPreset(preset.0, seconds: preset.2)
                    } label: {
                        VStack(spacing: 2) {
                            presetIcon(for: preset.0)
                            Text(preset.1).font(.quicksand(11, weight: .semibold))
                            Text("\(preset.2 / 60) min").font(.quicksand(10))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                    }
                    .buttonStyle(.ucanduit)
                    .opacity(selectedPreset == preset.0 ? 1.0 : 0.6)
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
                .buttonStyle(.ucanduit)

                Button("Reset") { reset() }
                    .buttonStyle(.ucanduit)
                    .disabled(!isRunning && remainingSeconds == totalSeconds)
            }

            // 4-dot session counter (adapted from PomodoroCounter in pomodoro-timer snippet)
            // Dots fill 1→4 within each cycle of 4 completed sessions.
            let completedCount = sessions.filter { $0.completed }.count
            SessionDotCounter(count: completedCount, color: timerColor)
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
        // Request notification permission on first start — no-op on subsequent calls.
        NotificationService.shared.requestAuthorization()

        // Create a new session record when the timer first starts
        if currentSession == nil {
            let session = TimerSession(duration: totalSeconds, type: selectedPreset)
            modelContext.insert(session)
            currentSession = session
        }
        isRunning = true
        pushTimerState()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            tick()
        }
    }

    private func pause() {
        isRunning = false
        timer?.invalidate()
        timer = nil
        pushTimerState()
    }

    private func reset() {
        pause()
        remainingSeconds = totalSeconds
        currentSession = nil
        pushTimerState()
    }

    private func tick() {
        guard remainingSeconds > 0 else {
            complete()
            return
        }
        remainingSeconds -= 1
        pushTimerState()
    }

    private func complete() {
        pause()
        // Mark the session as completed in SwiftData
        if let session = currentSession {
            session.completed = true
            session.endTime = Date()
            session.actualDuration = totalSeconds
        }

        // Fire a system notification so the user is informed even if they
        // stepped away from the app. The delegate in NotificationService suppresses
        // the banner when the app is foregrounded — the ring + confetti (Task 5)
        // handles the in-app celebration.
        NotificationService.shared.scheduleTimerCompletion(sessionType: selectedPreset)

        currentSession = nil
        remainingSeconds = totalSeconds
        // Keep ring visible briefly at 100% (mirrors JS: 3-second celebration)
        timerState.progress = 1.0
        timerState.isRunning = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [weak timerState] in
            timerState?.progress = 0
        }
    }

    /// Pushes current timer values to the shared TimerState so ContentView
    /// can render the progress ring around the oscilloscope.
    private func pushTimerState() {
        timerState.isRunning = isRunning
        timerState.totalSeconds = totalSeconds
        timerState.remainingSeconds = remainingSeconds
        timerState.progress = totalSeconds > 0
            ? Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
            : 0
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

    /// Maps session types to Iconoir icons — matches .preset-btn i in timer.css
    @ViewBuilder
    private func presetIcon(for type: SessionType) -> some View {
        switch type {
        case .pomodoro:   IconoirIcon("flash",      size: 18)
        case .quick:      IconoirIcon("timer",      size: 18)
        case .focus:      IconoirIcon("brain",      size: 18)
        case .shortBreak: IconoirIcon("coffee-cup", size: 18)
        case .longBreak:  IconoirIcon("coffee-cup", size: 18)
        case .custom: IconoirIcon("plus",
                                  size: 18)
        }
    }

    private func formatTime(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}

// MARK: - Session Dot Counter

/// Four-dot row showing progress within the current cycle of 4 sessions.
/// Adapted from PomodoroCounter in the pomodoro-timer snippet.
private struct SessionDotCounter: View {
    let count: Int
    let color: Color

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<4) { index in
                let filled = index < (count % 4) || (count > 0 && count % 4 == 0)
                Circle()
                    .fill(filled ? color : color.opacity(0.2))
                    .frame(width: 8, height: 8)
                    .overlay(Circle().stroke(color.opacity(0.4), lineWidth: 1))
                    .animation(.easeInOut(duration: 0.3), value: filled)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
        .background(Capsule().fill(.ultraThinMaterial))
    }
}
