import SwiftUI

struct ContentView: View {
    // AudioEngine and TimerState live here — created once, shared via environment
    @State private var audioEngine = AudioEngine()
    @State private var timerState = TimerState()

    var body: some View {
        ZStack {
            // Animated circle background — always behind all content
            AnimatedBackgroundView()
                .ignoresSafeArea()

            #if os(macOS)
            macOSLayout
                .environment(audioEngine)
                .environment(timerState)
                .onAppear {
                    FloatingWindowManager.configureMainWindow()
                    audioEngine.start()
                }
            #else
            AdaptiveNavigationView()
                .environment(audioEngine)
                .environment(timerState)
                .onAppear { audioEngine.start() }
            #endif
        }
    }

    #if os(macOS)
    /// Scrollable column of collapsible tool sections — mirrors the Tauri app's sidebar layout.
    private var macOSLayout: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Oscilloscope + timer ring overlay.
                // The ring is an SVG-style Circle().trim() that fades in when a timer is running,
                // matching the original JS timer-ring behavior in styles.css.
                ZStack {
                    OscilloscopeView(frequencyData: audioEngine.frequencyData)

                    if timerState.isRunning || timerState.progress > 0 {
                        // Faint background track
                        Circle()
                            .stroke(Color.gray.opacity(0.15), lineWidth: 3)

                        // Progress arc — rotated to start at top (−90°)
                        Circle()
                            .trim(from: 0, to: timerState.progress)
                            .stroke(
                                timerState.ringColor,
                                style: StrokeStyle(lineWidth: 3, lineCap: .round)
                            )
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 1), value: timerState.progress)
                    }
                }
                .frame(width: 380, height: 380)

                TickerView()

                CollapsibleSection("Timer",          icon: "timer")       { TimerView() }
                CollapsibleSection("Todo Lists",     icon: "task-list")   { TodoListView() }
                CollapsibleSection("Quick Memos",    icon: "notes")       { MemosView() }
                CollapsibleSection("Lo-Fi Music",    icon: "music-note")  { LofiPlayerView() }
                CollapsibleSection("Ambient Sounds", icon: "sound-high")  { AmbientSoundsView() }
                CollapsibleSection("Weather",        icon: "cloud-sunny") { WeatherView() }
                CollapsibleSection("Settings",       icon: "settings")    { SettingsView() }
            }
            .padding()
        }
        .frame(width: 420)
    }
    #endif
}

// MARK: - CollapsibleSection

/// Glass-card accordion section matching the original .collapsible-section CSS.
///
/// CSS reference (styles.css):
///   background: rgba(255,255,255,0.2) + backdrop-filter: blur(10px) → .ultraThinMaterial
///   border-radius: 15px
///   border: .1px solid var(--not-black)
///   box-shadow: 0 2px 8px rgba(0,0,0,0.2)
///
/// Toggle: Iconoir "plus" rotates 45° (open) or 90° (closed)
struct CollapsibleSection<Content: View>: View {
    let title: String
    let icon: String          // Iconoir regular icon name
    let content: () -> Content
    @State private var isExpanded = false

    init(_ title: String, icon: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header button
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            } label: {
                HStack(spacing: 10) {
                    IconoirIcon(icon, size: 18)
                        .foregroundStyle(.primary)
                    Text(title)
                        .font(.quicksand(16, weight: .semibold))
                        .foregroundStyle(.primary)
                    Spacer()
                    IconoirIcon("plus", size: 16)
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(isExpanded ? 45 : 0))
                        .animation(.easeInOut(duration: 0.2), value: isExpanded)
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 12)
            }
            .buttonStyle(.plain)

            if isExpanded {
                content()
                    .environment(\.isEmbedded, true)  // disables inner List scroll conflict
                    .padding(.horizontal, 15)
                    .padding(.bottom, 25)
            }
        }
        .background(.ultraThinMaterial)                          // rgba(255,255,255,0.2) + blur
        .clipShape(RoundedRectangle(cornerRadius: 15))           // border-radius: 15px
        .overlay {
            RoundedRectangle(cornerRadius: 15)
                .stroke(
                    Color(red: 0.165, green: 0.176, blue: 0.204).opacity(0.3),
                    lineWidth: 0.5                               // border: .1px solid --not-black
                )
        }
        .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)  // box-shadow
    }
}
