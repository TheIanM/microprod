import SwiftUI

struct AmbientSoundsView: View {
    @Environment(AudioEngine.self) private var audioEngine

    @State private var categories: [AudioDirectory] = []
    @State private var playingIds: Set<String> = []
    @State private var volume: Float = 0.5

    var body: some View {
        VStack(spacing: 12) {
            // Each category is a toggle — multiple can play at once
            List(categories, id: \.name) { category in
                HStack {
                    VStack(alignment: .leading) {
                        Text(category.name).font(.headline)
                        Text("\(category.fileCount) tracks")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    Button { toggleCategory(category) } label: {
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
                Text("Volume").font(.caption)
                Slider(value: $volume, in: 0...1) { _ in
                    audioEngine.setAmbientVolume(volume)
                }
                Text("\(Int(volume * 100))%")
                    .monospacedDigit()
                    .frame(width: 40)
            }
            .padding(.horizontal)

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
            let all = AudioFileScanner.scanDirectories()
            // Lofi directories are handled by LofiPlayerView
            categories = all.filter { !$0.name.lowercased().contains("lofi") }
        }
    }

    private func toggleCategory(_ category: AudioDirectory) {
        if playingIds.contains(category.name) {
            audioEngine.stopAmbient(id: category.name)
            playingIds.remove(category.name)
        } else {
            let files = AudioFileScanner.scanDirectory(at: category.path)
            if let file = files.randomElement() {
                audioEngine.playAmbient(id: category.name, file: file.path, volume: volume)
                playingIds.insert(category.name)
            }
        }
    }
}
