import SwiftUI

struct LofiPlayerView: View {
    @Environment(AudioEngine.self) private var audioEngine

    @State private var categories: [AudioDirectory] = []
    @State private var selectedCategory: AudioDirectory?
    @State private var files: [AudioFile] = []
    @State private var volume: Float = 0.8

    var body: some View {
        VStack(spacing: 12) {
            // Now playing indicator
            if audioEngine.isLofiPlaying {
                HStack {
                    Image(systemName: "music.note")
                    Text(audioEngine.lofiTrackName).lineLimit(1)
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            // Category picker (only shown when multiple lofi folders exist)
            if categories.count > 1 {
                Picker("Category", selection: $selectedCategory) {
                    ForEach(categories, id: \.name) { cat in
                        Text(cat.name).tag(cat as AudioDirectory?)
                    }
                }
                .onChange(of: selectedCategory) { _, newCat in
                    if let cat = newCat {
                        files = AudioFileScanner.scanDirectory(at: cat.path)
                    }
                }
            }

            // Track list — List { ForEach } avoids Swift 6 overload ambiguity
            // when @Environment(Observable.self) is accessed inside the row closure
            List {
                ForEach(files) { (file: AudioFile) in
                    Button {
                        audioEngine.playLofi(file: file.path)
                    } label: {
                        HStack {
                            Text(file.name).lineLimit(1)
                            Spacer()
                            if audioEngine.lofiTrackName == file.path.deletingPathExtension().lastPathComponent {
                                Image(systemName: "speaker.wave.2.fill")
                                    .foregroundStyle(.tint)
                            }
                        }
                    }
                }
            }

            // Play/stop + volume
            HStack {
                Button {
                    if audioEngine.isLofiPlaying {
                        audioEngine.stopLofi()
                    } else if let file = files.randomElement() {
                        audioEngine.playLofi(file: file.path)
                    }
                } label: {
                    Image(systemName: audioEngine.isLofiPlaying ? "stop.fill" : "play.fill")
                }

                Slider(value: $volume, in: 0...1) { _ in
                    audioEngine.setLofiVolume(volume)
                }

                Text("\(Int(volume * 100))%")
                    .monospacedDigit()
                    .frame(width: 40)
            }
        }
        .padding()
        .navigationTitle("Lo-Fi Music")
        .onAppear {
            let all = AudioFileScanner.scanDirectories()
            categories = all.filter { $0.name.lowercased().contains("lofi") }
            if let first = categories.first {
                selectedCategory = first
                files = AudioFileScanner.scanDirectory(at: first.path)
            }
        }
    }
}
