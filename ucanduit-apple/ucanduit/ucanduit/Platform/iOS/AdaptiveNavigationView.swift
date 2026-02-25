#if os(iOS)
import SwiftUI

/// Tab-based navigation for iPhone; same tabs work on iPad.
/// The "More" tab holds the less-used tools so the primary tabs stay clean.
struct AdaptiveNavigationView: View {
    @Environment(AudioEngine.self) private var audioEngine

    var body: some View {
        TabView {
            // Home: oscilloscope visualizer
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

            // Overflow tab for less-used tools
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
