import AVFoundation
import Accelerate
import Foundation

/// Central audio engine managing lofi playback, ambient mixing, and FFT analysis.
/// Replaces the Web Audio API used in the JS app.
///
/// Signal graph:
///   lofiPlayer  ──► lofiMixer  ──┐
///   ambPlayer1  ──► ambientMixer ──┼──► mainMixer ──► output
///   ambPlayer2  ──►             ──┘         │
///                                       FFT tap (→ OscilloscopeView)
@Observable
final class AudioEngine {
    // FFT frequency bins for the oscilloscope (256 bins, matching JS fftSize=512)
    var frequencyData: [Float] = Array(repeating: 0, count: 256)

    var isLofiPlaying = false
    var lofiTrackName = ""
    // Number of ambient sounds currently playing — used by the ticker
    var activeAmbientCount: Int = 0

    private let engine = AVAudioEngine()
    private let lofiPlayer = AVAudioPlayerNode()
    private let lofiMixer = AVAudioMixerNode()
    private let ambientMixer = AVAudioMixerNode()
    private var ambientPlayers: [String: AVAudioPlayerNode] = [:]

    private let fftSize = 512
    // Cached FFT setup — created once, reused every frame for performance
    private var fftSetup: FFTSetup?

    init() {
        fftSetup = vDSP_create_fftsetup(vDSP_Length(log2(Double(fftSize))), FFTRadix(kFFTRadix2))
        setupEngine()
    }

    deinit {
        if let setup = fftSetup { vDSP_destroy_fftsetup(setup) }
        engine.mainMixerNode.removeTap(onBus: 0)
    }

    // MARK: - Engine Setup

    private func setupEngine() {
        let mainMixer = engine.mainMixerNode
        let format = engine.outputNode.inputFormat(forBus: 0)

        engine.attach(lofiPlayer)
        engine.attach(lofiMixer)
        engine.attach(ambientMixer)

        engine.connect(lofiPlayer,    to: lofiMixer,    format: format)
        engine.connect(lofiMixer,     to: mainMixer,    format: format)
        engine.connect(ambientMixer,  to: mainMixer,    format: format)

        // FFT tap on main mixer feeds OscilloscopeView
        mainMixer.installTap(onBus: 0, bufferSize: UInt32(fftSize), format: format) {
            [weak self] buffer, _ in self?.processAudioBuffer(buffer)
        }

        #if os(iOS)
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default)
            try session.setActive(true)
        } catch {
            print("AudioEngine: audio session setup failed: \(error)")
        }
        #endif
    }

    func start() {
        guard !engine.isRunning else { return }
        do {
            try engine.start()
        } catch {
            print("AudioEngine: failed to start: \(error)")
        }
    }

    func stop() {
        engine.stop()
    }

    // MARK: - Lofi Playback

    func playLofi(file: URL) {
        do {
            let audioFile = try AVAudioFile(forReading: file)
            lofiPlayer.stop()
            lofiPlayer.scheduleFile(audioFile, at: nil) { [weak self] in
                DispatchQueue.main.async { self?.isLofiPlaying = false }
            }
            if !engine.isRunning { start() }
            lofiPlayer.play()
            isLofiPlaying = true
            lofiTrackName = file.deletingPathExtension().lastPathComponent
        } catch {
            print("AudioEngine: failed to play lofi: \(error)")
        }
    }

    func stopLofi() {
        lofiPlayer.stop()
        isLofiPlaying = false
    }

    func setLofiVolume(_ volume: Float) {
        lofiMixer.outputVolume = volume
    }

    // MARK: - Ambient Playback

    /// Start an ambient sound. Multiple can play simultaneously, keyed by id.
    func playAmbient(id: String, file: URL, volume: Float = 0.5) {
        do {
            let audioFile = try AVAudioFile(forReading: file)
            let player: AVAudioPlayerNode

            if let existing = ambientPlayers[id] {
                existing.stop()
                player = existing
            } else {
                player = AVAudioPlayerNode()
                engine.attach(player)
                let format = engine.outputNode.inputFormat(forBus: 0)
                engine.connect(player, to: ambientMixer, format: format)
                ambientPlayers[id] = player
            }

            player.scheduleFile(audioFile, at: nil)
            player.volume = volume
            if !engine.isRunning { start() }
            player.play()
            activeAmbientCount = ambientPlayers.count
        } catch {
            print("AudioEngine: failed to play ambient \(id): \(error)")
        }
    }

    func stopAmbient(id: String) {
        ambientPlayers[id]?.stop()
        activeAmbientCount = ambientPlayers.values.filter { $0.isPlaying }.count
    }

    func stopAllAmbient() {
        ambientPlayers.values.forEach { $0.stop() }
        activeAmbientCount = 0
    }

    func setAmbientVolume(_ volume: Float) {
        ambientMixer.outputVolume = volume
    }

    // MARK: - FFT Processing

    /// Extract frequency magnitudes from the audio buffer for the oscilloscope.
    /// Called on the audio thread — updates frequencyData on main thread.
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData?[0],
              let setup = fftSetup else { return }
        let frameCount = Int(buffer.frameLength)
        guard frameCount >= fftSize else { return }

        // Apply Hann window to reduce spectral leakage
        var windowed = [Float](repeating: 0, count: fftSize)
        var window   = [Float](repeating: 0, count: fftSize)
        vDSP_hann_window(&window, vDSP_Length(fftSize), Int32(vDSP_HANN_NORM))
        vDSP_vmul(channelData, 1, window, 1, &windowed, 1, vDSP_Length(fftSize))

        // Forward FFT using the cached setup
        var realParts = [Float](repeating: 0, count: fftSize / 2)
        var imagParts = [Float](repeating: 0, count: fftSize / 2)
        var magnitudes = [Float](repeating: 0, count: fftSize / 2)

        realParts.withUnsafeMutableBufferPointer { realBuf in
            imagParts.withUnsafeMutableBufferPointer { imagBuf in
                var split = DSPSplitComplex(realp: realBuf.baseAddress!, imagp: imagBuf.baseAddress!)
                windowed.withUnsafeBufferPointer { wBuf in
                    wBuf.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: fftSize / 2) {
                        vDSP_ctoz($0, 2, &split, 1, vDSP_Length(fftSize / 2))
                    }
                }
                vDSP_fft_zrip(setup, &split, 1, vDSP_Length(log2(Double(fftSize))), FFTDirection(FFT_FORWARD))
                vDSP_zvmags(&split, 1, &magnitudes, 1, vDSP_Length(fftSize / 2))
            }
        }

        // Normalize to 0–255 (matching the JS app's Uint8Array output)
        var result = [Float](repeating: 0, count: 256)
        var maxVal: Float = 0
        vDSP_maxv(magnitudes, 1, &maxVal, vDSP_Length(magnitudes.count))
        if maxVal > 0 {
            var scale = 255.0 / maxVal
            vDSP_vsmul(magnitudes, 1, &scale, &result, 1, vDSP_Length(min(256, magnitudes.count)))
        }

        DispatchQueue.main.async { [weak self] in
            self?.frequencyData = result
        }
    }
}
