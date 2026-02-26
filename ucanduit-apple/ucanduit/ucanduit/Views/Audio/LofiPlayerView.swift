import SwiftUI

struct LofiPlayerView: View {
    @Environment(AudioEngine.self) private var audioEngine
    @Environment(\.isEmbedded) private var isEmbedded
    @EnvironmentObject private var toastStore: ToastStore

    @State private var categories: [AudioDirectory] = []
    @State private var selectedCategory: AudioDirectory?
    @State private var files: [AudioFile] = []
    @State private var volume: Float = 0.8
    @State private var currentIndex: Int = 0

    var body: some View {
        VStack(spacing: 12) {
            // Now playing indicator
            HStack {
                IconoirIcon("music-note", size: 14)
                    .foregroundStyle(.secondary)
                Text(audioEngine.isLofiPlaying ? audioEngine.lofiTrackName : "Nothing playing")
                    .font(.quicksand(13))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            // Category picker (only shown when multiple lofi folders exist)
            if categories.count > 1 {
                Picker("Category", selection: $selectedCategory) {
                    ForEach(categories, id: \.name) { cat in
                        Text(cat.name)
                            .font(.quicksand(14))
                            .tag(cat as AudioDirectory?)
                    }
                }
                .onChange(of: selectedCategory) { _, newCat in
                    if let cat = newCat {
                        files = AudioFileScanner.scanDirectory(at: cat.path)
                        currentIndex = 0
                    }
                }
            }

            // Track list — explicit type annotation avoids Swift 6 binding overload ambiguity
            // when @Environment(Observable.self) is accessed inside the closure.
            List {
                ForEach(files) { (file: AudioFile) in
                    Button {
                        if let idx = files.firstIndex(where: { $0.id == file.id }) {
                            currentIndex = idx
                        }
                        audioEngine.playLofi(file: file.path)
                        toastStore.show(file.name, type: .custom(icon: "music.note", color: .accentColor), duration: 2.5)
                    } label: {
                        HStack {
                            Text(file.name)
                                .font(.quicksand(14))
                                .lineLimit(1)
                            Spacer()
                            if audioEngine.lofiTrackName == file.path.deletingPathExtension().lastPathComponent {
                                IconoirIcon("sound-high", size: 14)
                                    .foregroundStyle(.tint)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .listStyle(.plain)
            .scrollDisabled(isEmbedded)
            .frame(minHeight: 80)

            // Playback controls: Previous | Play/Pause | Next
            HStack(spacing: 16) {
                Button { playPrevious() } label: {
                    IconoirIcon("nav-arrow-left", size: 20)
                }
                .buttonStyle(.plain)
                .disabled(files.isEmpty)

                Button {
                    if audioEngine.isLofiPlaying {
                        audioEngine.stopLofi()
                    } else if !files.isEmpty {
                        audioEngine.playLofi(file: files[currentIndex].path)
                    }
                } label: {
                    IconoirIcon(audioEngine.isLofiPlaying ? "pause" : "play", size: 24)
                }
                .buttonStyle(.plain)
                .disabled(files.isEmpty)

                Button { playNext() } label: {
                    IconoirIcon("nav-arrow-right", size: 20)
                }
                .buttonStyle(.plain)
                .disabled(files.isEmpty)
            }

            // Volume control
            HStack {
                IconoirIcon("sound-high", size: 14).foregroundStyle(.secondary)
                Slider(value: $volume, in: 0...1) { _ in
                    audioEngine.setLofiVolume(volume)
                }
                Text("\(Int(volume * 100))%")
                    .font(.quicksand(12))
                    .monospacedDigit()
                    .frame(width: 40)
            }
        }
        .onAppear {
            let all = AudioFileScanner.scanDirectories()
            categories = all.filter { $0.name.lowercased().contains("lofi") }
            if let first = categories.first {
                selectedCategory = first
                files = AudioFileScanner.scanDirectory(at: first.path)
            }
        }
    }

    // MARK: - Track Navigation

    private func playNext() {
        guard !files.isEmpty else { return }
        currentIndex = (currentIndex + 1) % files.count
        audioEngine.playLofi(file: files[currentIndex].path)
        showTrackToast()
    }

    private func playPrevious() {
        guard !files.isEmpty else { return }
        currentIndex = (currentIndex - 1 + files.count) % files.count
        audioEngine.playLofi(file: files[currentIndex].path)
        showTrackToast()
    }

    private func showTrackToast() {
        guard currentIndex < files.count else { return }
        let name = files[currentIndex].name
        toastStore.show(name, type: .custom(icon: "music.note", color: .accentColor), duration: 2.5)
    }
}
