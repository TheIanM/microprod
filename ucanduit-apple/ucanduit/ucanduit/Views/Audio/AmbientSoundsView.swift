import SwiftUI

struct AmbientSoundsView: View {
    @Environment(AudioEngine.self) private var audioEngine
    @Environment(\.isEmbedded) private var isEmbedded

    @State private var categories: [AudioDirectory] = []
    @State private var playingIds: Set<String> = []
    @State private var volume: Float = 0.5

    var body: some View {
        VStack(spacing: 12) {
            if categories.isEmpty {
                Text("No ambient sounds found")
                    .font(.quicksand(13))
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 16)
            } else {
                // Each category is a toggle — multiple can play simultaneously
                List(categories, id: \.name) { category in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(category.name)
                                .font(.quicksand(14, weight: .medium))
                            Text("\(category.fileCount) tracks")
                                .font(.quicksand(12))
                                .foregroundStyle(.secondary)
                        }

                        Spacer()

                        Button { toggleCategory(category) } label: {
                            IconoirIcon(
                                playingIds.contains(category.name) ? "sound-high" : "play",
                                size: 22
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .listStyle(.plain)
                .scrollDisabled(isEmbedded)
            }

            // Master ambient volume
            HStack {
                IconoirIcon("sound-high", size: 14).foregroundStyle(.secondary)
                Slider(value: $volume, in: 0...1) { _ in
                    audioEngine.setAmbientVolume(volume)
                }
                Text("\(Int(volume * 100))%")
                    .font(.quicksand(12))
                    .monospacedDigit()
                    .frame(width: 40)
            }

            if !playingIds.isEmpty {
                Button {
                    audioEngine.stopAllAmbient()
                    playingIds.removeAll()
                } label: {
                    HStack(spacing: 4) {
                        IconoirIcon("sound-off", size: 14)
                        Text("Stop All")
                            .font(.quicksand(14, weight: .medium))
                    }
                }
                .buttonStyle(.ucanduit)
            }
        }
        .onAppear {
            let all = AudioFileScanner.scanDirectories()
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
