//
//  ConfettiView.swift
//  ucanduit
//
//  Adapted from the confetti-rain snippet (Demo 05 – Confetti / Particle Rain).
//  Simplified for auto-burst-on-appear: no tap gesture, no HUD controls,
//  no UIKit haptics. Physics step drives 60 FPS via Combine Timer.
//
//  Usage in ContentView oscilloscope ZStack:
//    if timerState.progress >= 1.0 && !timerState.isRunning {
//        ConfettiView()
//            .allowsHitTesting(false)
//            .clipped()
//    }

import SwiftUI
import Combine

// MARK: - Confetti View

/// A Canvas-based particle burst that fires once on appear.
/// Designed to be overlaid on the 380×380 oscilloscope area.
struct ConfettiView: View {
    // 60 FPS physics ticker
    private let ticker = Timer.publish(every: 1.0/60.0, on: .main, in: .common).autoconnect()

    @StateObject private var vm = ConfettiVM()

    var body: some View {
        GeometryReader { geo in
            Canvas { ctx, _ in
                for p in vm.particles {
                    let hue = p.hue.truncatingRemainder(dividingBy: 1.0)
                    let color = Color(hue: hue, saturation: p.saturation, brightness: p.brightness)
                    var glyph = ctx.resolve(Text(p.symbol).font(.system(size: p.size)))
                    glyph.shading = .color(color)
                    ctx.draw(glyph, at: p.position)
                }
            }
            .onReceive(ticker) { _ in
                vm.step(size: geo.size)
            }
            .onAppear {
                let center = CGPoint(x: geo.size.width / 2, y: geo.size.height / 2)
                vm.burst(at: center, count: 55)
            }
        }
        .allowsHitTesting(false)
        .clipped()
    }
}

// MARK: - ViewModel

/// Separates physics mutations from SwiftUI draw pass.
/// Adapted from ParticleVM in the confetti-rain snippet.
final class ConfettiVM: ObservableObject {
    @Published var particles: [ConfettiParticle] = []

    private let wind: CGFloat = 0.0
    private let gravity: CGFloat = 0.045   // slightly gentler than snippet default

    func step(size: CGSize) {
        for i in particles.indices {
            particles[i].velocity.dx += wind * 0.6
            particles[i].velocity.dy += gravity

            particles[i].angle += 0.12
            let flutterX = sin(particles[i].angle) * 0.3
            particles[i].position.x += particles[i].velocity.dx + flutterX
            particles[i].position.y += particles[i].velocity.dy

            // Remove particles that have fallen off the bottom edge
            // (no wrap — this is a one-shot burst, not continuous rain)
        }
        particles.removeAll { $0.position.y > size.height + 30 }
    }

    func burst(at point: CGPoint, count: Int) {
        let new = ConfettiParticle.makeBurst(center: point, count: count)
        particles.append(contentsOf: new)
    }
}

// MARK: - Particle Model

struct ConfettiParticle: Identifiable {
    let id = UUID()
    var position: CGPoint
    var velocity: CGVector
    var size: CGFloat
    var symbol: String
    var angle: CGFloat

    var hue: Double
    var saturation: Double
    var brightness: Double

    static func makeBurst(center: CGPoint, count: Int) -> [ConfettiParticle] {
        (0..<count).map { _ in
            let speed = CGFloat.random(in: 2.0...6.0)
            let dir = CGFloat.random(in: 0...(2 * .pi))
            return ConfettiParticle(
                position: center,
                velocity: CGVector(dx: cos(dir) * speed, dy: sin(dir) * speed - 2), // slight upward bias
                size: .random(in: 10...20),
                symbol: ["★", "✦", "●", "▲", "◆", "✸", "✺"].randomElement()!,
                angle: .random(in: 0...(.pi * 2)),
                hue: Double.random(in: 0...1),
                saturation: 0.9,
                brightness: 1.0
            )
        }
    }
}
