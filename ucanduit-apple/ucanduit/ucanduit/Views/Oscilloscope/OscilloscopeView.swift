import SwiftUI
import Combine

/// A single metaball with position, velocity, and audio-reactive radius.
/// Mirrors the JS app's metaball object in oscilloscope.js.
struct Metaball {
    var x: CGFloat
    var y: CGFloat
    var baseRadius: CGFloat
    var currentRadius: CGFloat
    var vx: CGFloat
    var vy: CGFloat
    var breathingPhase: CGFloat
    var breathingSpeed: CGFloat
    var frequencyRange: (start: Int, end: Int)
    var audioAmplitude: CGFloat = 0
}

/// Audio-reactive metaballs visualization using SwiftUI Canvas.
///
/// Rendering pipeline:
/// 1. Glow layer — blurred radial gradients behind the blob
/// 2. Merged blob — SwiftUI's built-in .alphaThreshold filter fuses nearby balls:
///    balls are drawn white into a temp buffer → blur spreads their alpha outward →
///    alphaThreshold snaps combined alpha ≥ 0.5 to solid color, below to clear.
///    Where two balls are close, blurred edge alphas add up above the threshold → they fuse.
struct OscilloscopeView: View {
    var frequencyData: [Float]
    var size: CGSize = CGSize(width: 300, height: 300)

    @State private var balls: [Metaball] = []
    @State private var isInitialized = false

    // 4 balls matching JS app's numMetaballs
    private let ballCount = 4

    // 60 fps timer drives physics — @State mutations here persist (unlike inside Canvas)
    private let timer = Timer.publish(every: 1.0 / 60.0, on: .main, in: .common).autoconnect()

    var body: some View {
        Canvas { context, canvasSize in
            // READ-ONLY — no state mutations here, just draw whatever balls holds right now
            let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
            let bounds = CGRect(origin: .zero, size: canvasSize)
            drawMetaballs(context: context, bounds: bounds, center: center)
        }
        .frame(width: size.width, height: size.height)
        .onAppear { initializeIfNeeded() }
        .onReceive(timer) { _ in
            guard isInitialized else { return }
            let bounds = CGRect(origin: .zero, size: size)
            updateBalls(in: bounds)
            updateAudio()
        }
    }

    // MARK: - Initialization

    private func initializeIfNeeded() {
        guard !isInitialized else { return }
        let binCount = 256
        let rangeSize = binCount / ballCount

        // Spawn balls in a tight organic cluster near center — matches JS clusterRadius approach.
        // evenly spaced angles + small random jitter, short spawn distance.
        balls = (0..<ballCount).map { i in
            let angle = CGFloat(i) * (2 * .pi / CGFloat(ballCount))
                        + CGFloat.random(in: -0.4...0.4)
            let distance = CGFloat.random(in: 0...20)
            return Metaball(
                x: cos(angle) * distance,
                y: sin(angle) * distance,
                baseRadius: 45 + CGFloat.random(in: 0...15),  // larger than before — blobs need to overlap
                currentRadius: 45 + CGFloat.random(in: 0...15),
                vx: CGFloat.random(in: -0.2...0.2),           // gentle drift, matching JS vx max 0.2
                vy: CGFloat.random(in: -0.2...0.2),
                breathingPhase: CGFloat.random(in: 0...(2 * .pi)),
                breathingSpeed: 0.008 + CGFloat.random(in: 0...0.015),
                frequencyRange: (start: i * rangeSize, end: (i + 1) * rangeSize)
            )
        }

        isInitialized = true
    }

    // MARK: - Physics

    private func updateBalls(in bounds: CGRect) {
        let center = CGPoint(x: bounds.width / 2, y: bounds.height / 2)
        for i in balls.indices {
            balls[i].breathingPhase += balls[i].breathingSpeed

            let breathOffset = sin(balls[i].breathingPhase) * 3
            let audioBoost = balls[i].audioAmplitude * 55  // matches JS: normalizedAmplitude * 55
            balls[i].currentRadius = balls[i].baseRadius + breathOffset + audioBoost

            // Orbital drift with audio-reactive speed — mirrors JS updateMetaballsFromAudio
            let audioInfluence = balls[i].audioAmplitude * 1.8
            balls[i].x += sin(balls[i].breathingPhase) * (0.4 + audioInfluence)
            balls[i].y += cos(balls[i].breathingPhase * 0.7) * (0.3 + audioInfluence)
            balls[i].x += balls[i].vx
            balls[i].y += balls[i].vy

            // Tight container — keep balls within 35% of the canvas half-size so they stay
            // close enough to the center to overlap and trigger the merging effect.
            let halfW = center.x * 0.35
            let halfH = center.y * 0.35
            let r = balls[i].currentRadius * 0.8

            if abs(balls[i].x) + r > halfW {
                balls[i].vx *= -0.5  // gentle bounce, matches JS 0.5 factor
                balls[i].x = balls[i].x > 0 ? halfW - r : -(halfW - r)
            }
            if abs(balls[i].y) + r > halfH {
                balls[i].vy *= -0.5
                balls[i].y = balls[i].y > 0 ? halfH - r : -(halfH - r)
            }

            balls[i].vx *= 0.98
            balls[i].vy *= 0.98
        }
    }

    private func updateAudio() {
        guard !frequencyData.isEmpty else { return }
        for i in balls.indices {
            let range = balls[i].frequencyRange
            let start = min(range.start, frequencyData.count - 1)
            let end   = min(range.end,   frequencyData.count)
            guard end > start else { continue }
            let slice = frequencyData[start..<end]
            balls[i].audioAmplitude = CGFloat(slice.reduce(0, +) / Float(slice.count)) / 255.0
        }
    }

    // MARK: - Rendering

    private func drawMetaballs(context: GraphicsContext, bounds: CGRect, center: CGPoint) {
        let avgAmplitude = balls.isEmpty ? 0 :
            balls.reduce(0) { $0 + $1.audioAmplitude } / CGFloat(balls.count)

        // --- Pass 1: Glow (blurred aura behind the blob) ---
        context.drawLayer { glow in
            glow.addFilter(.blur(radius: 22))
            glow.opacity = Double(0.3 + avgAmplitude * 0.4)
            for ball in balls {
                let pos = CGPoint(x: center.x + ball.x, y: center.y + ball.y)
                let glowR = ball.currentRadius * 1.8
                glow.fill(
                    Circle().path(in: CGRect(x: pos.x - glowR, y: pos.y - glowR,
                                             width: glowR * 2, height: glowR * 2)),
                    with: .radialGradient(
                        Gradient(colors: [.purple.opacity(0.6), .indigo.opacity(0.3), .clear]),
                        center: pos, startRadius: 0, endRadius: glowR
                    )
                )
            }
        }

        // --- Pass 2: Merged blob ---
        // Filters on the outer context are applied to the drawLayer output as a whole
        // (not per draw call inside), so the sequence is:
        //   1. All white circles rendered into a temp buffer (alphas composite normally)
        //   2. Blur spreads each ball's alpha outward — overlapping balls accumulate alpha
        //   3. alphaThreshold snaps anything ≥ 0.5 to solid purple, anything below to clear
        // Where two balls are close enough, the blurred overlap pushes combined alpha above
        // 0.5 and they fuse into one organic shape.
        var blobCtx = context
        blobCtx.addFilter(.alphaThreshold(min: 0.5, color: .purple))
        blobCtx.addFilter(.blur(radius: 30))
        blobCtx.drawLayer { blob in
            for ball in balls {
                let pos = CGPoint(x: center.x + ball.x, y: center.y + ball.y)
                let r = ball.currentRadius
                blob.fill(
                    Circle().path(in: CGRect(x: pos.x - r, y: pos.y - r,
                                             width: r * 2, height: r * 2)),
                    with: .color(.white)
                )
            }
        }
    }
}
