import SwiftUI

struct ContentView: View {
    // AudioEngine and TimerState live here — created once, shared via environment
    @State private var audioEngine = AudioEngine()
    @State private var timerState = TimerState()
    // Toast store — ObservableObject, injected as environmentObject so child views can show toasts
    @StateObject private var toastStore = ToastStore()
    // Scroll offset read from macOS ScrollView via PreferenceKey — drives background blur
    @State private var scrollOffset: CGFloat = 0

    var body: some View {
        ZStack {
            // Animated circle background — always behind all content.
            // scrollOffset adds extra blur as the user scrolls deeper into the panel.
            AnimatedBackgroundView(scrollOffset: scrollOffset)
                .ignoresSafeArea()

            #if os(macOS)
            macOSLayout
                .environment(audioEngine)
                .environment(timerState)
                .environmentObject(toastStore)
                .onAppear {
                    FloatingWindowManager.configureMainWindow()
                    audioEngine.start()
                }
            #else
            AdaptiveNavigationView()
                .environment(audioEngine)
                .environment(timerState)
                .environmentObject(toastStore)
                .onAppear { audioEngine.start() }
            #endif
        }
        // Toasts overlay the entire panel — attached at the ZStack root so they
        // appear above all content including CollapsibleSection cards.
        .toastHost(store: toastStore)
    }

    #if os(macOS)
    /// Scrollable column of collapsible tool sections — mirrors the Tauri app's sidebar layout.
    private var macOSLayout: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Invisible GeometryReader at the top of the scroll content.
                // Reports its current y-position in the ScrollView's coordinate space
                // via ScrollOffsetKey so ContentView can pass it to AnimatedBackgroundView.
                GeometryReader { geo in
                    Color.clear
                        .preference(
                            key: ScrollOffsetKey.self,
                            value: -geo.frame(in: .named("mainScroll")).minY
                        )
                }
                .frame(height: 0)  // zero height — purely a measurement tool
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

                    // Confetti burst on timer completion — visible for the 3-second celebration window.
                    // progress reaches 1.0 exactly when complete() fires; TimerState resets it to 0 after 3s.
                    if timerState.progress >= 1.0 && !timerState.isRunning {
                        ConfettiView()
                    }
                }
                .frame(width: 380, height: 380)
                .clipped()  // keeps confetti within the oscilloscope frame

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
        .coordinateSpace(name: "mainScroll")
        .onPreferenceChange(ScrollOffsetKey.self) { offset in
            // Clamp to ≥ 0 so rubber-band over-scrolling at the top doesn't invert the blur
            scrollOffset = max(offset, 0)
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
