import SwiftUI
import SwiftData
import Combine

// MARK: - Badge type

/// Maps to the CSS badge classes (badge-success, badge-warning, etc.)
enum TickerBadgeType {
    case success, warning, primary, accent, danger, secondary

    var color: Color {
        switch self {
        case .success:   return .uduGreen
        case .warning:   return .ohOrange
        case .primary:   return .canduBlue
        case .accent:    return .pleasePurple
        case .danger:    return .woohooRed
        case .secondary: return Color("TextSecondary")
        }
    }
}

struct TickerItem {
    let label: String
    let type: TickerBadgeType
}

// MARK: - TickerView

/// Rotating status badge that cycles through at-a-glance info for each module.
/// Mirrors the JS app's statusTicker in index.html.
///
/// Behaviour:
///   - Auto-cycles every 3 seconds
///   - ‹ / › buttons let the user navigate manually
///   - Manual navigation pauses auto-cycling for 10 seconds then resumes
struct TickerView: View {
    @Environment(TimerState.self)  private var timerState
    @Environment(AudioEngine.self) private var audioEngine
    @Query private var todoLists: [TodoList]

    @State private var currentIndex = 0
    @State private var isManualOverride = false
    @State private var overrideTask: Task<Void, Never>?

    // Matches JS: cycles every 3 seconds
    private let ticker = Timer.publish(every: 3, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack(spacing: 8) {
            Button("‹") { navigate(by: -1) }
                .buttonStyle(.plain)
                .font(.quicksand(16, weight: .semibold))
                .foregroundStyle(.secondary)

            let item = items[currentIndex]
            Text(item.label)
                .font(.quicksand(12, weight: .semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(item.type.color.opacity(0.18))
                .foregroundStyle(item.type.color)
                .clipShape(Capsule())
                .animation(.easeInOut(duration: 0.2), value: item.label)

            Button("›") { navigate(by: 1) }
                .buttonStyle(.plain)
                .font(.quicksand(16, weight: .semibold))
                .foregroundStyle(.secondary)
        }
        .onReceive(ticker) { _ in
            guard !isManualOverride else { return }
            advance()
        }
        // Keep index in bounds if items count changes
        .onChange(of: items.count) {
            currentIndex = currentIndex % max(items.count, 1)
        }
    }

    // MARK: - Items

    /// Computed each render — reads live state from the environment and SwiftData.
    private var items: [TickerItem] {
        [oscItem, timerItem, todosItem, ambientItem]
        // #TODO: add weatherItem once WeatherService is wired into the environment
    }

    private var oscItem: TickerItem {
        let ready = !audioEngine.frequencyData.allSatisfy { $0 == 0 }
        return TickerItem(
            label: ready ? "OssC: Active" : "OssC: Ready",
            type: ready ? .accent : .success
        )
    }

    private var timerItem: TickerItem {
        if timerState.isRunning {
            let m = timerState.remainingSeconds / 60
            let s = timerState.remainingSeconds % 60
            return TickerItem(label: String(format: "Timer: %02d:%02d", m, s), type: .warning)
        }
        if timerState.remainingSeconds < timerState.totalSeconds && timerState.totalSeconds > 0 {
            return TickerItem(label: "Timer: Paused", type: .accent)
        }
        return TickerItem(label: "Timer: Ready", type: .success)
    }

    private var todosItem: TickerItem {
        let allItems = todoLists.flatMap { $0.items }
        let pending   = allItems.filter { $0.status == .todo }.count
        let completed = allItems.filter { $0.status == .done }.count

        if allItems.isEmpty          { return TickerItem(label: "Todos: Empty", type: .secondary) }
        if pending == 0              { return TickerItem(label: "Todos: All done! (\(completed))", type: .success) }
        return TickerItem(label: "Todos: \(pending) pending", type: .primary)
    }

    private var ambientItem: TickerItem {
        let count = audioEngine.activeAmbientCount
        if count > 0 {
            return TickerItem(label: "Ambient: \(count) playing", type: .accent)
        }
        return TickerItem(label: "Ambient: Silent", type: .success)
    }

    // MARK: - Navigation

    private func navigate(by direction: Int) {
        advance(by: direction)
        // Pause auto-cycling for 10s after manual navigation, then resume
        // Cancel any pending resume so rapid taps don't stack up
        overrideTask?.cancel()
        isManualOverride = true
        overrideTask = Task {
            try? await Task.sleep(for: .seconds(10))
            guard !Task.isCancelled else { return }
            isManualOverride = false
        }
    }

    private func advance(by amount: Int = 1) {
        currentIndex = (currentIndex + amount + items.count) % items.count
    }
}
