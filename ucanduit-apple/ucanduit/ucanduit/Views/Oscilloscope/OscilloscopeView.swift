import SwiftUI

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

struct BreathingCircle {
    var x: CGFloat
    var y: CGFloat
    var baseRadius: CGFloat
    var color1: Color
    var color2: Color
    var breathingPhase: CGFloat
    var breathingSpeed: CGFloat
    var breathingScale: CGFloat
    var opacity: Double
}

/// Audio-reactive metaballs visualization using SwiftUI Canvas + TimelineView.
///
/// Rendering pipeline (mirrors JS app):
/// 1. Glow layer — blurred radial gradients per ball
/// 2. Solid ball bodies — radial gradient fill
/// 3. Breathing circles — additive blend on top
///
/// Note: True pixel-level alpha-threshold metaballs would need Metal/CIFilter.
/// This Canvas approximation is close enough; we can swap in Metal later if needed.
struct OscilloscopeView: View {
    var frequencyData: [Float]
    var size: CGSize = CGSize(width: 300, height: 300)

    @State private var balls: [Metaball] = []
    @State private var circles: [BreathingCircle] = []
    @State private var isInitialized = false

    private let ballCount = 4  // one ball per frequency quarter, matching JS app

    var body: some View {
        TimelineView(.animation) { _ in
            Canvas { context, canvasSize in
                let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
                let bounds = CGRect(origin: .zero, size: canvasSize)
                updateBalls(in: bounds)
                updateAudio()
                drawMetaballs(context: context, bounds: bounds, center: center)
            }
        }
        .frame(width: size.width, height: size.height)
        .onAppear { initializeIfNeeded() }  // no `mutating` needed — @State handles it
    }

    // MARK: - Initialization

    private func initializeIfNeeded() {
        guard !isInitialized else { return }
        let binCount = 256
        let rangeSize = binCount / ballCount

        balls = (0..<ballCount).map { i in
            Metaball(
                x: CGFloat.random(in: -30...30),
                y: CGFloat.random(in: -30...30),
                baseRadius: 25 + CGFloat.random(in: 0...10),
                currentRadius: 25 + CGFloat.random(in: 0...10),
                vx: CGFloat.random(in: -1...1),
                vy: CGFloat.random(in: -1...1),
                breathingPhase: CGFloat.random(in: 0...(2 * .pi)),
                breathingSpeed: 0.008 + CGFloat.random(in: 0...0.015),
                frequencyRange: (start: i * rangeSize, end: (i + 1) * rangeSize)
            )
        }

        circles = (0..<5).map { _ in
            BreathingCircle(
                x: CGFloat.random(in: -40...40),
                y: CGFloat.random(in: -40...40),
                baseRadius: 20 + CGFloat.random(in: 0...30),
                color1: Color(hue: Double.random(in: 0...1), saturation: 0.6, brightness: 0.8),
                color2: Color(hue: Double.random(in: 0...1), saturation: 0.5, brightness: 0.9),
                breathingPhase: CGFloat.random(in: 0...(2 * .pi)),
                breathingSpeed: 0.005 + CGFloat.random(in: 0...0.01),
                breathingScale: 0.8 + CGFloat.random(in: 0...0.4),
                opacity: 0.7 + Double.random(in: 0...0.3)
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
            let audioBoost = balls[i].audioAmplitude * 55
            balls[i].currentRadius = balls[i].baseRadius + breathOffset + audioBoost

            let audioInfluence = balls[i].audioAmplitude * 1.8
            balls[i].x += sin(balls[i].breathingPhase) * (0.4 + audioInfluence)
            balls[i].y += cos(balls[i].breathingPhase * 0.7) * (0.3 + audioInfluence)
            balls[i].x += balls[i].vx
            balls[i].y += balls[i].vy

            // Bounce off container walls
            let halfW = center.x * 0.8
            let halfH = center.y * 0.8
            let r = balls[i].currentRadius

            if abs(balls[i].x) + r > halfW {
                balls[i].vx *= -0.5
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
        let avgAmplitude = balls.isEmpty ? 0 : balls.reduce(0) { $0 + $1.audioAmplitude } / CGFloat(balls.count)

        // Glow pass
        for ball in balls {
            let pos = CGPoint(x: center.x + ball.x, y: center.y + ball.y)
            let glowR = ball.currentRadius * 1.5
            var ctx = context
            ctx.opacity = Double(0.3 + avgAmplitude * 0.4)
            ctx.addFilter(.blur(radius: 12))
            ctx.drawLayer { inner in
                inner.fill(
                    Circle().path(in: CGRect(x: pos.x - glowR, y: pos.y - glowR,
                                             width: glowR * 2, height: glowR * 2)),
                    with: .radialGradient(
                        Gradient(colors: [.purple.opacity(0.6), .blue.opacity(0.3), .clear]),
                        center: pos, startRadius: 0, endRadius: glowR
                    )
                )
            }
        }

        // Solid ball bodies
        for ball in balls {
            let pos = CGPoint(x: center.x + ball.x, y: center.y + ball.y)
            let r = ball.currentRadius
            context.fill(
                Circle().path(in: CGRect(x: pos.x - r, y: pos.y - r, width: r * 2, height: r * 2)),
                with: .radialGradient(
                    Gradient(colors: [.purple.opacity(0.8), .blue.opacity(0.6), .indigo.opacity(0.4)]),
                    center: pos, startRadius: 0, endRadius: r
                )
            )
        }

        // Breathing circles (additive blend)
        for circle in circles {
            let phase = circle.breathingPhase + circle.breathingSpeed
            let scale = 1.0 + sin(phase) * 0.2 * circle.breathingScale
            let r = circle.baseRadius * scale
            let pos = CGPoint(x: center.x + circle.x, y: center.y + circle.y)
            var ctx = context
            ctx.opacity = circle.opacity * 0.4
            ctx.blendMode = .plusLighter
            ctx.fill(
                Circle().path(in: CGRect(x: pos.x - r, y: pos.y - r, width: r * 2, height: r * 2)),
                with: .radialGradient(
                    Gradient(colors: [circle.color1, circle.color2]),
                    center: pos, startRadius: 0, endRadius: r
                )
            )
        }
    }
}
