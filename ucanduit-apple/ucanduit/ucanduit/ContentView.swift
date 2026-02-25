import SwiftUI

struct ContentView: View {
    // AudioEngine lives here so it's created once and shared via environment
    @State private var audioEngine = AudioEngine()

    var body: some View {
        ZStack {
            // Animated circle background — always behind all content
            AnimatedBackgroundView()
                .ignoresSafeArea()

            #if os(macOS)
            macOSLayout
                .environment(audioEngine)
                .onAppear {
                    FloatingWindowManager.configureMainWindow()
                    audioEngine.start()
                }
            #else
            AdaptiveNavigationView()
                .environment(audioEngine)
                .onAppear { audioEngine.start() }
            #endif
        }
    }

    #if os(macOS)
    /// Scrollable column of collapsible tool sections — mirrors the Tauri app's sidebar layout.
    private var macOSLayout: some View {
        ScrollView {
            VStack(spacing: 16) {
                OscilloscopeView(frequencyData: audioEngine.frequencyData)
                    .frame(width: 300, height: 300)

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

/// Accordion-style collapsible panel — matches the Tauri app's tool section style.
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
                    Text(title).font(.headline)
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
